import React from 'react';
import RecordIcon from '@material-ui/icons/MicNoneRounded';
import StopIcon from '@material-ui/icons/StopRounded';
import PlayIcon from '@material-ui/icons/PlayArrowRounded';
import PauseIcon from '@material-ui/icons/PauseRounded';

export default function RecordButton({
  src,
  recording,
  playing,
  onClick,
  border,
  ...props
}) {
  let button;

  switch (true) {
    case !src.length && !recording:
      button = <RecordIcon {...props} className="record-button record" />;
      break;
    case !src.length && recording:
      button = <StopIcon {...props} className="record-button stop" />;
      break;
    case src.length && !playing:
      button = <PlayIcon {...props} className="record-button play" />;
      break;
    case src.length && playing:
      button = <PauseIcon {...props} className="record-button pause" />;
      break;
    default:
      button = <RecordIcon {...props} className="record-button record" />;
      break;
  }

  return (
    <div
      className={'record-button-wrapper ' + (recording ? 'recording' : '')}
      onClick={onClick}
      key="button"
      style={{boxShadow: `0px 0px 0px ${border}px #8a69f7`}}
    >
      {button}
    </div>
  )
}
