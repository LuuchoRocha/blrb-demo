const recorder = require('node-record-lpcm16');
const speech = require('@google-cloud/speech');

const client = new speech.SpeechClient();

const request = {
  config: {
    encoding: 'LINEAR16',
    sampleRateHertz: 16000,
    languageCode: 'es-AR',
  },
};

const recognizeStream = client
  .streamingRecognize(request)
  .on('error', console.error)
  .on('data', (data) =>
    process.stdout.write(
      data.results[0] && data.results[0].alternatives[0]
        ? `Transcription: ${data.results[0].alternatives[0].transcript}\n`
        : '\n\nReached transcription time limit, press Ctrl+C\n'
    )
  );

recorder
  .record({
    sampleRateHertz: 16000,
    threshold: 0,
    verbose: false,
    recordProgram: 'rec',
    silence: '10.0',
  })
  .stream()
  .on('error', console.error)
  .pipe(recognizeStream);

console.log('Listening, press Ctrl+C to stop.');
