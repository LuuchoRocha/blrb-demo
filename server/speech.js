const speechToText = require('@google-cloud/speech').v1p1beta1;

class Speech {
  constructor() {
    this.setupSpeech();
  }

  setupSpeech() {
    if (process.env.NODE_ENV === 'production') {
      this.stt = new speechToText.SpeechClient({
        projectId: process.env.GOOGLE_PROJECT_ID,
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        },
      });
    } else {
      this.stt = new speechToText.SpeechClient();
    }

    this.sttRequest = {
      interim_results: false,
      config: {
        useEnhanced: true,
        enableAutomaticPunctuation: true,
        enableWordTimeOffsets: true,
        sampleRateHertz: 16000,
        encoding: 'LINEAR16',
        languageCode: 'en-us',
        model: 'default',
        metadata: {
          interactionType: 'DICTATION',
        },
      },
    };
  }

  async speechToText(audio) {
    this.sttRequest.audio = {content: audio};
    const results = await this.stt.recognize(this.sttRequest);
    return results[0];
  }

  async speechStreamToText(stream, callback) {
    const recognizeStream = this.stt
      .streamingRecognize(this.sttRequest)
      .on('data', (data) => {
        callback(data.results[0].alternatives[0]);
      })
      .on('error', (error) => {
        console.log(error);
      });

    stream.pipe(recognizeStream);
  }
}

module.exports = new Speech();
