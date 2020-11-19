import React, {useState, useRef, useCallback, useEffect} from 'react';
import ReactDOM from 'react-dom';
import MicRounded from '@material-ui/icons/MicRounded';
import RecordRTC from 'recordrtc';
import io from 'socket.io-client';
import ss from 'socket.io-stream';
import './index.css';

const MIN_DECIBELS = -100.0;
const MAX_DECIBELS = 0.0;
const GAP = 2;
const MAX_BORDER = 100;

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
    width: window.innerWidth * window.devicePixelRatio,
    height: window.innerHeight,
  });

  useEffect(() => {
    const handleResize = () => {
      setWindowSize({
        width: window.innerWidth * window.devicePixelRatio,
        height: window.innerHeight,
      });
    };

    window.onresize = handleResize;
    handleResize();

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return windowSize;
}

const BLRB = () => {
  const [recording, setRecording] = useState(false);
  const [src, setSrc] = useState('');
  const [border, setBorder] = useState(0);
  const [borderColor, setBorderColor] = useState('#9977ff');
  const [transcript, setTranscript] = useState([]);

  const size = useWindowSize();

  const stream = useRef(null);
  const frame = useRef(null);

  const audioCtx = useRef(null);
  const mediaStream = useRef(null);
  const mediaRecorder = useRef(null);
  const analyser = useRef(null);

  const socket = useRef(null);
  const socketStream = useRef(null);

  const animate = useCallback(() => {
    let bufferLength = analyser.current.frequencyBinCount;
    let dataArray = new Float32Array(bufferLength);

    analyser.current.getFloatFrequencyData(dataArray);

    let osc = document.getElementById('oscilloscope');
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
      let barHeight, borderWidth, borderColorValue;

      for (let i = 0; i < bufferLength; i++) {
        barHeight = range(
          MIN_DECIBELS,
          MAX_DECIBELS,
          0,
          size.height / 2,
          dataArray[i]
        );
        average += barHeight;

        oscCtx.fillStyle = getColor(range(0, size.height, 0, 255, barHeight));
        oscCtx.fillRect(x, size.height - barHeight, barWidth, barHeight);

        x += barWidth + GAP;
      }

      average = average / bufferLength;
      borderWidth = range(0, size.height / 2, 0, MAX_BORDER, average);
      borderColorValue = range(0, size.height / 2, 0, 255, average);

      setBorder(borderWidth);
      setBorderColor(getColor(borderColorValue));
    };

    draw();
  }, [size.height, size.width]);

  const handleOnClick = useCallback(async () => {
    if (!recording) {
      setSrc('');
      setTranscript([]);
      mediaRecorder.current = RecordRTC(stream.current, {
        recorderType: RecordRTC.StereoAudioRecorder,
        type: 'audio',
        mimeType: 'audio/wav',
        numberOfAudioChannels: 1,
        timeSlice: 2000,
        sampleRate: 44100,
        desiredSampRate: 16000,
        ondataavailable: (blob) => {
          socketStream.current = ss.createStream();
          ss(socket.current).emit('stream', socketStream.current, {
            name: 'stream.wav',
            size: blob.size,
          });
          ss.createBlobReadStream(blob).pipe(socketStream.current);
        },
      });
      mediaRecorder.current.startRecording();
    } else {
      mediaRecorder.current.stopRecording(function () {
        const blob = mediaRecorder.current.getBlob();
        setSrc(URL.createObjectURL(blob));
        socket.current.emit('correct', blob);
      });
    }

    setRecording(!recording);
  }, [recording, stream]);

  const AudioPlayer = useCallback(() => {
    return (
      <audio controls={true}>
        <source type="audio/wav" src={src} />
      </audio>
    );
  }, [src]);

  useEffect(() => {
    socket.current = io();

    socket.current.on('translated', (data) => {
      transcript.push(data.transcript);
    });

    socket.current.on('corrected', (data) => {
      if (data && data.results) {
        setTranscript([data.results[0].alternatives[0].transcript]);
      }
    });

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({audio: true}).then(async (s) => {
        stream.current = s;
        audioCtx.current = new (window.AudioContext ||
          window.webkitAudioContext)();
        mediaStream.current = audioCtx.current.createMediaStreamSource(s);
        analyser.current = audioCtx.current.createAnalyser();
        analyser.current.fftSize = 128;
        analyser.current.smoothingTimeConstant = 0.8;
        mediaStream.current.connect(analyser.current);

        animate();
      });
    }

    return () => {
      if (frame.current) {
        cancelAnimationFrame(frame.current);
      }
    };
  }, [animate, transcript]);

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
      <p className="transcript">{transcript.join(' ')}</p>
    </div>
  );
};

ReactDOM.render(<BLRB />, document.getElementById('root'));
