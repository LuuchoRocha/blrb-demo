const speechToText = require('@google-cloud/speech');

export class Speech {
  constructor() {
    this.setupSpeech();
  }

  setupSpeech() {
    this.stt = new speechToText.SpeechClient();
    this.sttRequest = {
      config: {
        model: 'default',
        useEnhanced: true,
        enableAutomaticPunctuation: true,
        encoding: 'ENCODING_UNSPECIFIED',
        metadata: {
          microphoneDistance: 'MICROPHONE_DISTANCE_UNSPECIFIED',
          interactionType: 'INTERACTION_TYPE_UNSPECIFIED',
        },
      },
    };
  }

  async speechToText(audio, lang) {
    this.sttRequest.config.languageCode = lang;
    this.sttRequest.audio = {
      content: audio,
    };

    const responses = await this.stt.recognize(this.sttRequest);
    const results = responses[0].results[0].alternatives[0];

    return {
      transcript: results.transcript,
      detectLang: lang,
    };
  }

  async speechStreamToText(stream, lang, callback) {
    this.sttRequest.config.languageCode = lang;

    const recognizeStream = this.stt
      .streamingRecognize(this.sttRequest)
      .on('data', (data) => {
        console.log('Recognize stream in process');
        callback(data.results[0].alternatives[0]);
      })
      .on('error', (e) => {
        console.log('Recognize stream error');
        console.log(e);
      })
      .on('end', () => {
        console.log('Recognize stream finished');
      });

    stream.pipe(recognizeStream);
    stream.on('end', () => {
      console.log('Stream STT finished');
    });
  }
}

export let speech = new Speech();
