import React, {useState, useRef, useCallback, useEffect} from 'react';
import ReactDOM from 'react-dom';
import MicRounded from '@material-ui/icons/MicRounded';
import speech from '@google-cloud/speech';
import './index.css';

function lerp(start, end, t) {
  return start * (1 - t) + end * t;
}
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
          barHeight = lerp(0, height, dataArray[i] / 255);

          canvasCtx.fillStyle = '#9977ff';
          canvasCtx.fillRect(x, height - barHeight, barWidth, barHeight);

          x += barWidth + 10;
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
      mediaRecorder.current.start(500);
      mediaRecorder.current.ondataavailable = handleDataAvailable;
      mediaRecorder.current.onstop = handleOnStop;
    } else {
      mediaRecorder.current.stop();
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
