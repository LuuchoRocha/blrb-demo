import React, {useState, useRef, useCallback, useEffect} from 'react';
import ReactDOM from 'react-dom';
import RecordRTC from 'recordrtc';
import io from 'socket.io-client';
import AudioCtx from './AudioCtx';
import Button from './Button'
import { useWindowSize } from './WindowSize'
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
  const frame = useRef(null);

  const [recording, setRecording] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [src, setSrc] = useState('');
  const [border, setBorder] = useState(0);
  const [transcript, setTranscript] = useState([]);

  const animate = useCallback(() => {
    let bufferLength = analyser.current.frequencyBinCount;
    let dataArray = new Float32Array(bufferLength);

    analyser.current.getFloatFrequencyData(dataArray);

    let osc = document.getElementById('barsGraph');
    let oscCtx = osc.getContext('2d');

    oscCtx.clearRect(0, 0, size.width, size.height);

    const draw = function () {
      frame.current = requestAnimationFrame(draw);

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
      sampleRate: 44100,
      desiredSampRate: 16000,
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
    setRecording(false);

    socket.current.emit('stopRecognition');

    processor.current.onaudioprocess = null;
    mediaStream.current.disconnect();
    source.current = audioCtx.current.createMediaElementSource(document.querySelector('audio'));
    source.current.connect(analyser.current);
    analyser.current.connect(audioCtx.current.destination);

    mediaRecorder.current.stopRecording(function () {
      const blob = mediaRecorder.current.getBlob();
      setSrc(URL.createObjectURL(blob));
      socket.current.emit('correct', blob);
    });
  }, []);

  const handlePlay = useCallback(() => {
    setPlaying(true);
    const audio = document.querySelector('audio');
    audio.play();
  }, []);

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
  }, [handlePause, handlePlay, handleRecord, handleStop, playing, recording, src.length]);

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
      if (frame.current) {
        cancelAnimationFrame(frame.current);
      }
    };
  }, [animate]);

  useEffect(() => {
    let offset = 0;
    if (socket.current) {
      socket.current.on('transcript', (data) => {
        transcript.splice(offset, 1);
        if (data.results && data.results[0].isFinal) {
          transcript.push(data.results[0].alternatives[0].transcript);
          offset++;
        } else {
          transcript.push(data.results[0].alternatives[0].transcript);
        }
      });
    }
  }, [transcript]);

  return (
    <div className="container">
      <div
        id="canvas-wrapper"
        style={{width: size.width + 'px', height: size.height + 'px'}}
      >
        <canvas id="barsGraph" width={size.width} height={size.height} />
      </div>
      <Button onClick={handleOnClick} src={src} playing={playing} recording={recording} border={border} />
      <p className={'transcript ' + (recording ? 'recording' : '')}>
        {transcript.join(' ')}
      </p>
      <audio controls={false}>
        {src.length && (
          <source src={src} type="audio/wav" />
        )}
      </audio>
    </div>
  );
};

ReactDOM.render(<BLRB />, document.getElementById('root'));
