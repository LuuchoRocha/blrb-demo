import React, {useState, useRef, useCallback, useEffect} from 'react';
import ReactDOM from 'react-dom';
import MicRounded from '@material-ui/icons/MicRounded';
import './index.css';

const getColor = (value) => {
  return (
    'rgb(' +
    (value / 2 + 92) +
    ',' +
    (value / 2 + 84) +
    ',' +
    (value / 2 + 128) +
    ')'
  );
};

const BLRB = () => {
  const [recording, setRecording] = useState(false);
  const [chunks, setChunks] = useState([]);
  const [src, setSrc] = useState('');
  const [width, setWidth] = useState(window.innerWidth);
  const [height, setHeight] = useState(window.innerHeight);

  const stream = useRef(null);
  const mediaRecorder = useRef(null);
  const frame = useRef(null);

  const audioCtx = useRef(null);
  const mediaStream = useRef(null);
  const analyser = useRef(null);

  const animate = useCallback(() => {
    if (analyser.current) {
      let bufferLength = analyser.current.frequencyBinCount;
      let dataArray = new Uint8Array(bufferLength);

      analyser.current.getByteFrequencyData(dataArray);

      let canvas = document.getElementById('oscilloscope');
      let canvasCtx = canvas.getContext('2d');

      canvasCtx.clearRect(0, 0, width, height);

      let drawAlt = function () {
        frame.current = requestAnimationFrame(drawAlt);

        analyser.current.getByteFrequencyData(dataArray);
        canvasCtx.fillStyle = '#1f1f1f';
        canvasCtx.fillRect(0, 0, width, height);

        let barWidth = width / bufferLength;
        let barHeight;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
          barHeight = dataArray[i];

          canvasCtx.fillStyle = getColor(barHeight);
          canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);

          x += barWidth + 1;
        }
      };

      drawAlt();
    }
  }, [height, width]);

  const handleDataAvailable = useCallback(
    (e) => {
      chunks.push(e.data);
    },
    [chunks]
  );

  const handleOnStop = useCallback(
    (e) => {
      let blob = new Blob(chunks, {type: 'audio/ogg; codecs=opus'});
      let audioURL = window.URL.createObjectURL(blob);
      setSrc(audioURL);
    },
    [chunks]
  );

  const handleOnClick = useCallback(() => {
    if (!recording) {
      setChunks([]);
      setSrc([]);
      mediaStream.current.disconnect();
      mediaStream.current.connect(analyser.current);
      mediaRecorder.current.start(500);
      mediaRecorder.current.ondataavailable = handleDataAvailable;
      mediaRecorder.current.onstop = handleOnStop;
    } else {
      mediaRecorder.current.stop();
      mediaStream.current.connect(audioCtx.current.destination);
      mediaStream.current.connect(analyser.current);
    }

    setRecording(!recording);
  }, [handleDataAvailable, handleOnStop, recording]);

  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({audio: true}).then((s) => {
        stream.current = s;
        mediaRecorder.current = new MediaRecorder(stream.current);
        audioCtx.current = new (window.AudioContext ||
          window.webkitAudioContext)();
        mediaStream.current = audioCtx.current.createMediaStreamSource(s);
        mediaStream.current.connect(audioCtx.current.destination);
        analyser.current = audioCtx.current.createAnalyser();
        analyser.current.fftSize = 128;
        mediaStream.current.connect(analyser.current);
        animate();
      });
    }
  }, [animate]);

  return (
    <div className="container">
      <div
        className="canvas-wrapper"
        style={{width: width + 'px', height: height + 'px'}}
      >
        <canvas id="oscilloscope" width={width} height={height} />
      </div>
      <div className="recordButton" onClick={handleOnClick}>
        <MicRounded className={'mic ' + (recording ? 'recording' : '')} />
      </div>
      <audio src={src} controls={true}></audio>
    </div>
  );
};

ReactDOM.render(<BLRB />, document.getElementById('root'));
