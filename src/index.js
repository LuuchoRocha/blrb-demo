import React, {useState, useRef, useCallback, useEffect} from 'react';
import ReactDOM from 'react-dom';
import MicRounded from '@material-ui/icons/MicRounded';
import './index.css';

const BLRB = () => {
  const [recording, setRecording] = useState(false);
  const [chunks, setChunks] = useState([]);
  const [src, setSrc] = useState('')

  const stream = useRef(null);
  const mediaRecorder = useRef(null);

  const audioCtx = useRef(null);
  const mediaStream = useRef(null);
  const analyser = useRef(null);

  useEffect(() => {
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices.getUserMedia({audio: true}).then((s) => {
        stream.current = s;
        mediaRecorder.current = new MediaRecorder(s);

        //////////////////////////////////////

        audioCtx.current = new(window.AudioContext || window.webkitAudioContext)();
        mediaStream.current = audioCtx.current.createMediaStreamSource(s);
        mediaStream.current.connect(audioCtx.current.destination);

        // analyser
        analyser.current = audioCtx.current.createAnalyser();
        analyser.current.fftSize = 64;

        // pipe
        mediaStream.current.connect(analyser.current);
      });
    }
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (analyser.current) {
        var bufferLength = analyser.current.frequencyBinCount;
        var dataArray = new Uint8Array(bufferLength);
        analyser.current.getByteFrequencyData(dataArray);
        console.log(dataArray);
      }
    }, 500);

    return () => {
      clearInterval(interval);
    }
  });

  const handleDataAvailable = useCallback((e) => {
    chunks.push(e.data);

  }, [chunks]);

  const handleOnStop = useCallback((e) => {
    var blob = new Blob(chunks, { 'type' : 'audio/ogg; codecs=opus' });
    var audioURL = window.URL.createObjectURL(blob);
    setSrc(audioURL);
  }, [chunks]);

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
  
  return (
    <div className="container">
      <div className="recordButton" onClick={handleOnClick}>
        <MicRounded className={'mic ' + (recording ? 'recording' : '')} />
      </div>
      <audio src={src} controls={true}></audio>
    </div>
  );
};

ReactDOM.render(<BLRB />, document.getElementById('root'));
