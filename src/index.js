import React from 'react';
import ReactDOM from 'react-dom';
import './index.css';
import MicRounded from '@material-ui/icons/MicRounded';

class BLRB extends React.Component {
  constructor(props) {
    super(props);
    
    this.state = {
      stream: null,
    };

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      const comp = this;
      navigator.mediaDevices
        .getUserMedia({audio: true})
        .then(function (stream) {
          comp.stream = stream;
        });
    }
  }

  render() {
    return (
      <div className="main">
        <MicRounded className="mic" />
      </div>
    );
  }
}

ReactDOM.render(<BLRB />, document.getElementById('root'));
