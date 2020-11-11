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
  const [border, setBorder] = useState(0);

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

    // let metter = document.getElementById('metter');
    // let metterContext = metter.getContext('2d');

    oscCtx.clearRect(0, 0, width, height);

    const draw = function () {
      frame.current = requestAnimationFrame(draw);

      analyser.current.getByteFrequencyData(dataArray);

      oscCtx.fillStyle = '#1f1f1f';
      oscCtx.fillRect(0, 0, width, height);

      let barWidth = width / bufferLength;
      let barHeight;
      let x = 0;
      let values = 0;

      for (let i = 0; i < bufferLength; i++) {
        values += dataArray[i];

        barHeight = lerp(0, height, dataArray[i] / 255) - 1;

        oscCtx.fillStyle = '#9977ff';
        oscCtx.fillRect(x, height - barHeight, barWidth, barHeight);

        x += barWidth + 3;
      }

      // metterContext.clearRect(0, 0, width, height);
      // metterContext.fillStyle = 'rgba(96, 96, 96, 0.2)';
      // metterContext.fillRect(
      //   0,
      //   0,
      //   width,
      //   lerp(0, height, values / bufferLength / 255)
      // );

      setBorder(Math.round(values / bufferLength));
    };

    draw();
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
        analyser.current.smoothingTimeConstant = 0.9;
        mediaStream.current.connect(analyser.current);
        animate();
      });

      window.onresize = () => {
        setWidth(window.innerWidth);
        setHeight(window.innerHeight);
      };
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
        style={{width: width + 'px', height: height + 'px'}}
      >
        <canvas id="oscilloscope" width={width} height={height} />
      </div>
      <canvas id="metter" width={width} height={height} />
      <div
        className="recordButton"
        onClick={handleOnClick}
        style={{boxShadow: `0px 0px ${border}px ${border/2}px #9977ffcc`}}
      >
        <MicRounded className={'mic ' + (recording ? 'recording' : '')} />
      </div>
      <audio src={src} controls={true}></audio>
    </div>
  );
};

ReactDOM.render(<BLRB />, document.getElementById('root'));
