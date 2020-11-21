const googleSpeech = require('@google-cloud/speech');

class SpeechClient {
  constructor({encoding, sampleRateHertz}) {
    this.clients = {};

    if (process.env.NODE_ENV === 'production') {
      this.speechClient = new googleSpeech.SpeechClient({
        projectId: process.env.GOOGLE_PROJECT_ID,
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
      });
    } else {
      this.speechClient = new googleSpeech.SpeechClient();
    }

    this.request = {
      config: {
        encoding: encoding,
        sampleRateHertz: sampleRateHertz,
        enableWordTimeOffsets: true,
        enableAutomaticPunctuation: true,
      },
      interimResults: true,
    };
  }

  startRecognitionStream(id, socket, languageCode = 'en-US') {
    this.clients[id] = this.speechClient
      .streamingRecognize({
        ...this.request,
        config: {
          ...this.request.config,
          languageCode,
        },
      })
      .on('error', console.error)
      .on('data', (data) => {
        socket.emit('transcript', data);

        if (data.results[0] && data.results[0].isFinal) {
          this.stopRecognitionStream();
          this.startRecognitionStream(socket);
        }
      });
  }

  stopRecognitionStream(id) {
    if (this.clients[id]) {
      this.clients[id].end();
    }
    this.clients[id] = null;
  }

  write(id, chunk) {
    if (this.clients[id]) {
      this.clients[id].write(chunk);
    }
  }
}

module.exports = (args = {encoding: 'LINEAR16', sampleRateHertz: 16000}) => {
  return new SpeechClient(args);
};
