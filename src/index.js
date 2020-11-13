import React, {useState, useRef, useCallback, useEffect} from 'react';
import ReactDOM from 'react-dom';
import MicRounded from '@material-ui/icons/MicRounded';
import AudioRecorder from 'audio-recorder-polyfill';
import './index.css';

const OMITTED_BANDS = 2;
const MIN_DECIBELS = 0;
const MAX_DECIBELS = 255;
const GAP = 2;
const MAX_BORDER = 32;

window.MediaRecorder = AudioRecorder;

const lerp = (x, y, a) => x * (1 - a) + y * a;
const invlerp = (x, y, a) => clamp((a - x) / (y - x));
const clamp = (a, min = 0, max = 1) => Math.min(max, Math.max(min, a));
const range = (x1, y1, x2, y2, a) => lerp(x2, y2, invlerp(x1, y1, a));

function getColor(value) {
  const r = lerp(100, 180, value / 255);
  const g = lerp(90, 180, value / 255);
  const b = lerp(180, 250, value / 255);
  return `rgb(${r}, ${g}, ${b})`;
}

function useWindowSize() {
  const [windowSize, setWindowSize] = useState({
    width: undefined,
    height: undefined,
  });

  useEffect(() => {
    let timeoutID = NaN;
    const handleResize = () => {
      clearTimeout(timeoutID);
      timeoutID = setTimeout(() => {
        setWindowSize({
          width: window.innerWidth * window.devicePixelRatio,
          height: window.innerHeight,
        });
      }, 50);
    };

    window.onresize = handleResize;
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
      clearTimeout(timeoutID);
    };
  }, []);

  return windowSize;
}

const BLRB = () => {
  const [recording, setRecording] = useState(false);
  const [src, setSrc] = useState('');
  const [border, setBorder] = useState(0);
  const [borderColor, setBorderColor] = useState('#9977ff');
  const size = useWindowSize();

  const stream = useRef(null);
  const mediaRecorder = useRef(null);
  const frame = useRef(null);

  const audioCtx = useRef(null);
  const mediaStream = useRef(null);
  const analyser = useRef(null);

  const animate = useCallback(() => {
    let bufferLength = analyser.current.frequencyBinCount;
    let dataArray = new Uint8Array(bufferLength);
    let dataTimeArray = new Uint8Array(bufferLength);

    analyser.current.getByteFrequencyData(dataArray);
    analyser.current.getByteTimeDomainData(dataTimeArray);

    let osc = document.getElementById('oscilloscope');
    let oscCtx = osc.getContext('2d');
    let db = 0;

    oscCtx.clearRect(0, 0, size.width, size.height);

    const draw = function () {
      frame.current = requestAnimationFrame(draw);

      analyser.current.getByteFrequencyData(dataArray);

      oscCtx.fillStyle = '#1f1f1f';
      oscCtx.fillRect(0, 0, size.width, size.height);

      let barWidth = size.width / (bufferLength - OMITTED_BANDS);
      let barHeight;
      let x = 0;
      let values = 0;

      for (let i = 0; i < bufferLength - OMITTED_BANDS; i++) {
        values += dataArray[i + OMITTED_BANDS];
        barHeight = range(MIN_DECIBELS, MAX_DECIBELS, 0, size.height, dataArray[i]);

        oscCtx.fillStyle = getColor(dataArray[i]);
        oscCtx.fillRect(x, size.height - barHeight, barWidth, barHeight);

        x += barWidth + GAP;
      }

      values = values / (bufferLength - OMITTED_BANDS) * MAX_BORDER;
      values = range(MIN_DECIBELS, MAX_DECIBELS, 0, MAX_BORDER, values);

      setBorder(values);
      setBorderColor(getColor(values));
    };

    draw();
  }, [size.height, size.width]);

  const handleOnClick = useCallback(async () => {
    if (!recording) {
      setSrc([]);
      mediaRecorder.current.start();
    } else {
      mediaRecorder.current.stop();
    }

    setRecording(!recording);
  }, [recording]);

  const AudioPlayer = useCallback(() => {
    if (src) {
      return <audio src={src} controls={true} />;
    } else {
      return <audio controls={true} />;
    }
  }, [src]);

  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({audio: true}).then((s) => {
        stream.current = s;
        mediaRecorder.current = new MediaRecorder(stream.current);
        mediaRecorder.current.addEventListener('dataavailable', (e) => {
          setSrc(URL.createObjectURL(e.data));
        });
        audioCtx.current = new (window.AudioContext ||
          window.webkitAudioContext)();
        mediaStream.current = audioCtx.current.createMediaStreamSource(s);
        analyser.current = audioCtx.current.createAnalyser();
        analyser.current.fftSize = 256;
        analyser.current.minDecibels = -75.0;
        analyser.current.smoothingTimeConstant = 0.9;
        mediaStream.current.connect(analyser.current);
        animate();
      });
    }

    return () => {
      if (frame.current) {
        cancelAnimationFrame(frame.current);
      }
    };
  }, [animate]);

  return (
    <div className="container">
      <div
        className="canvas-wrapper"
        style={{width: size.width + 'px', height: size.height + 'px'}}
      >
        <canvas id="oscilloscope" width={size.width} height={size.height} />
      </div>
      <div
        className="recordButton"
        onClick={handleOnClick}
        style={{boxShadow: `0px 0px 0px ${border}px ${borderColor}`}}
      >
        <MicRounded className={'mic ' + (recording ? 'recording' : '')} />
      </div>
      <AudioPlayer />
    </div>
  );
};

ReactDOM.render(<BLRB />, document.getElementById('root'));
