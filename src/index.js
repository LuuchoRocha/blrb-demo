import React, {useState, useRef, useCallback, useEffect} from 'react';
import ReactDOM from 'react-dom';
import RecordRTC from 'recordrtc';
import io from 'socket.io-client';
import AudioCtx from './AudioCtx';
import Button from './Button';
import {useWindowSize} from './WindowSize';
import {range} from './Interpolations';
import {getColor, resampleBuffer} from './Utils';
import * as Constants from './Constants';
import './index.css';

const BLRB = () => {
  const size = useWindowSize();

  const audioCtx = useRef(null);
  const stream = useRef(null);
  const mediaStream = useRef(null);
  const mediaRecorder = useRef(null);
  const analyser = useRef(null);
  const processor = useRef(null);
  const source = useRef(null);

  const socket = useRef(null);
  const canvasFrame = useRef(null);
  const wordsFrame = useRef(null);

  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [src, setSrc] = useState('');
  const [border, setBorder] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxTime, setMaxTime] = useState(0);

  const animate = useCallback(() => {
    let bufferLength = analyser.current.frequencyBinCount;
    let dataArray = new Float32Array(bufferLength);

    analyser.current.getFloatFrequencyData(dataArray);

    let osc = document.getElementById('barsGraph');
    let oscCtx = osc.getContext('2d');

    oscCtx.clearRect(0, 0, size.width, size.height);

    const draw = function () {
      canvasFrame.current = requestAnimationFrame(draw);

      analyser.current.getFloatFrequencyData(dataArray);

      oscCtx.fillStyle = '#1f1f1f';
      oscCtx.fillRect(0, 0, size.width, size.height);

      let x = 0;
      let average = 0;
      let barWidth = size.width / bufferLength;
      let barHeight, borderWidth;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = range(
          Constants.MIN_DECIBELS,
          Constants.MAX_DECIBELS,
          0,
          size.height / 2,
          dataArray[i]
        );
        average += barHeight;

        oscCtx.fillStyle = getColor(range(0, size.height, 0, 255, barHeight));
        oscCtx.fillRect(x, size.height - barHeight, barWidth, barHeight);

        x += barWidth + Constants.GAP;
      }

      average = average / bufferLength;
      borderWidth = range(0, size.height / 2, 0, Constants.MAX_BORDER, average);
      setBorder(borderWidth);
    };

    draw();
  }, [size.height, size.width]);

  const animateWords = useCallback(() => {
    const drawWords = function () {
      let startTime, endTime;

      wordsFrame.current = requestAnimationFrame(drawWords);

      const words = document.querySelectorAll('.transcript span');
      const time = document.querySelector('audio').currentTime;

      for (const word of words) {
        startTime = parseFloat(word.getAttribute('start-time'));
        endTime = parseFloat(word.getAttribute('end-time'));

        word.className = startTime <= time && time <= endTime ? 'active' : '';
      }
    };

    drawWords();
  }, []);

  const handleRecord = useCallback(() => {
    setSrc('');
    setTranscript([]);
    setRecording(true);

    socket.current.emit('startRecognition');

    mediaRecorder.current = RecordRTC(stream.current, {
      recorderType: RecordRTC.StereoAudioRecorder,
      type: 'audio',
      mimeType: 'audio/wav',
      numberOfAudioChannels: 1,
    });

    mediaRecorder.current.startRecording();

    processor.current.onaudioprocess = (e) => {
      socket.current.emit(
        'streamAudio',
        resampleBuffer(e.inputBuffer.getChannelData(0), 44100, 16000)
      );
    };
  }, []);

  const handleStop = useCallback(() => {
    const audio = document.querySelector('audio');

    socket.current.emit('stopRecognition');

    audio.onended = () => {
      audio.load();
      setPlaying(false);
    };

    audio.ontimeupdate = () => {
      setCurrentTime(audio.currentTime);
    };

    audio.ondurationchange = () => {
      setMaxTime(audio.duration);
    };

    processor.current.onaudioprocess = null;
    mediaStream.current.disconnect();
    source.current = audioCtx.current.createMediaElementSource(audio);
    source.current.connect(analyser.current);
    analyser.current.connect(audioCtx.current.destination);

    mediaRecorder.current.stopRecording(function () {
      setSrc(URL.createObjectURL(mediaRecorder.current.getBlob()));
      setRecording(false);
    });
  }, []);

  const handlePlay = useCallback(() => {
    setPlaying(true);
    const audio = document.querySelector('audio');
    audio.play();
    animateWords();
  }, [animateWords]);

  const handlePause = useCallback(() => {
    setPlaying(false);
    const audio = document.querySelector('audio');
    audio.pause();
  }, []);

  const handleOnClick = useCallback(() => {
    switch (true) {
      case !src.length && !recording:
        return handleRecord();
      case !src.length && recording:
        return handleStop();
      case src.length && !playing:
        return handlePlay();
      case src.length && playing:
        return handlePause();
      default:
        return handleRecord();
    }
  }, [
    handlePause,
    handlePlay,
    handleRecord,
    handleStop,
    playing,
    recording,
    src.length,
  ]);

  useEffect(() => {
    socket.current = io();

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({audio: true}).then(async (s) => {
        stream.current = s;

        audioCtx.current = new AudioCtx({latencyHint: 'interactive'});

        analyser.current = audioCtx.current.createAnalyser();
        analyser.current.fftSize = 128;
        analyser.current.smoothingTimeConstant = 0.8;

        processor.current = audioCtx.current.createScriptProcessor(2048, 1, 1);
        processor.current.connect(audioCtx.current.destination);

        mediaStream.current = audioCtx.current.createMediaStreamSource(s);
        mediaStream.current.connect(analyser.current);
        mediaStream.current.connect(processor.current);

        animate();
      });
    }

    return () => {
      if (canvasFrame.current) {
        cancelAnimationFrame(canvasFrame.current);
      }
    };
  }, [animate]);

  const handleOnChangeSeekBar = useCallback((e) => {
    const time = e.nativeEvent.target.value;
    const audio = document.querySelector('audio');
    audio.currentTime = time;
    setCurrentTime(time);
  }, []);

  const renderTranscript = useCallback(
    (e) => {
      const content = transcript.map((t) => {
        if (t.isFinal) {
          return t.words.map((w) => {
            const startTime = parseFloat(
              w.startTime.seconds + '.' + w.startTime.nanos
            );
            const endTime = parseFloat(
              w.endTime.seconds + '.' + w.endTime.nanos
            );

            return (
              <span
                start-time={startTime}
                end-time={endTime}
                key={`${startTime}-${w.word}-${endTime}`}
              >
                {w.word}&nbsp;
              </span>
            );
          });
        } else {
          return <span key={t.words}>{t.words}&nbsp;</span>;
        }
      });

      return (
        <div className="transcript" key={Date.now()}>
          {content}
        </div>
      );
    },
    [transcript]
  );

  useEffect(() => {
    let offset = 0;
    if (socket.current) {
      socket.current.on('transcript', (data) => {
        const isFinal = data.results[0].isFinal;
        const words = isFinal
          ? data.results[0].alternatives[0].words
          : data.results[0].alternatives[0].transcript;

        transcript.splice(offset, transcript.length - offset);
        transcript.push({words, isFinal});

        if (isFinal) {
          offset += words.length;
        }
      });
    }
  }, [transcript]);

  useEffect(() => {
    if (!playing && wordsFrame.current) {
      cancelAnimationFrame(wordsFrame.current);
    }
  }, [playing]);

  return (
    <div className="container">
      <div
        id="canvas-wrapper"
        style={{width: size.width + 'px', height: size.height + 'px'}}
      >
        <canvas id="barsGraph" width={size.width} height={size.height} />
      </div>
      <Button
        onClick={handleOnClick}
        src={src}
        playing={playing}
        recording={recording}
        border={border}
      />
      <audio controls={false}>
        {src.length && <source src={src} type="audio/wav" />}
      </audio>
      <input
        type="range"
        className={'seek-bar ' + (src.length ? '' : 'hidden')}
        step="any"
        min={0}
        max={maxTime}
        value={currentTime}
        onChange={handleOnChangeSeekBar}
      />
      {renderTranscript()}
    </div>
  );
};

ReactDOM.render(<BLRB />, document.getElementById('root'));
