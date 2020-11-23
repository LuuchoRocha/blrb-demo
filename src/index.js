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

  const audioCtx = useRef();
  const stream = useRef();
  const mediaStream = useRef();
  const mediaRecorder = useRef();
  const analyser = useRef();
  const processor = useRef();
  const source = useRef();
  const socket = useRef();
  const barsFrame = useRef();
  const wordsFrame = useRef();
  const audio = useRef();

  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [src, setSrc] = useState('');
  const [border, setBorder] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [maxTime, setMaxTime] = useState(0);

  const animateBars = useCallback(() => {
    let bufferLength = analyser.current.frequencyBinCount;
    let dataArray = new Float32Array(bufferLength);

    analyser.current.getFloatFrequencyData(dataArray);

    let osc = document.getElementById('barsGraph');
    let oscCtx = osc.getContext('2d');

    oscCtx.clearRect(0, 0, size.width, size.height);

    const draw = function () {
      barsFrame.current = requestAnimationFrame(draw);

      analyser.current.getFloatFrequencyData(dataArray);

      oscCtx.fillStyle = '#1f1f1f';
      oscCtx.fillRect(0, 0, size.width, size.height);

      const barWidth = size.width / bufferLength;
      let x = 0;
      let average = 0;
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
    const draw = function () {
      wordsFrame.current = requestAnimationFrame(draw);

      let startTime, endTime;

      const words = document.querySelectorAll('.transcript span');
      const time = document.querySelector('audio').currentTime;

      for (const word of words) {
        startTime = parseFloat(word.getAttribute('start-time'));
        endTime = parseFloat(word.getAttribute('end-time'));

        word.className = startTime <= time && time <= endTime ? 'active' : '';
      }
    };

    draw();
  }, []);

  const stopBarsAnimation = () => {
    if (barsFrame.current) {
      cancelAnimationFrame(barsFrame.current);
    }
  };

  const stopWordsAnimation = () => {
    if (wordsFrame.current) {
      cancelAnimationFrame(wordsFrame.current);
    }
  };

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
    socket.current.emit('stopRecognition');

    audio.current.onended = () => {
      audio.current.load();
      setPlaying(false);
    };

    audio.current.ontimeupdate = () => {
      setCurrentTime(audio.current.currentTime);
    };

    audio.current.ondurationchange = () => {
      setMaxTime(audio.current.duration);
    };

    processor.current.onaudioprocess = null;
    mediaStream.current.disconnect();
    source.current = audioCtx.current.createMediaElementSource(audio.current);
    source.current.connect(analyser.current);
    analyser.current.connect(audioCtx.current.destination);

    mediaRecorder.current.stopRecording(function () {
      setSrc(URL.createObjectURL(mediaRecorder.current.getBlob()));
      setRecording(false);
    });
  }, []);

  const handlePlay = useCallback(() => {
    setPlaying(true);

    audio.current.play();

    animateBars();
    animateWords();
  }, [animateBars, animateWords]);

  const handlePause = useCallback(() => {
    setPlaying(false);

    audio.current.pause();

    stopWordsAnimation();
    stopBarsAnimation();
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

  const handleOnChangeSeekBar = useCallback((e) => {
    audio.current.currentTime = e.nativeEvent.target.value;
    setCurrentTime(audio.current.currentTime);
  }, []);

  const renderTranscript = useCallback(() => {
    return (
      <div className="transcript" key={Date.now()}>
        {transcript.map((t) => {
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
        })}
      </div>
    );
  }, [transcript]);

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

        animateBars();
      });
    }
  }, [animateBars]);

  return (
    <div className="container">
      <div id="canvas-wrapper" style={{width: size.width, height: size.height}}>
        <canvas id="barsGraph" width={size.width} height={size.height} />
      </div>
      <Button
        onClick={handleOnClick}
        src={src}
        playing={playing}
        recording={recording}
        border={border}
      />
      <audio controls={false} ref={audio}>
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
