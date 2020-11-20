const express = require('express');
const bodyParser = require('body-parser');
const pino = require('express-pino-logger');
const http = require('http');
const io = require('socket.io');
const path = require('path');
const speech = require('@google-cloud/speech');

const encoding = 'LINEAR16';
const sampleRateHertz = 16000;
const languageCode = 'en-US';

const request = {
  config: {
    encoding: encoding,
    sampleRateHertz: sampleRateHertz,
    languageCode: languageCode,
    enableWordTimeOffsets: true,
    enableAutomaticPunctuation: true,
  },
  interimResults: true,
};

class Server {
  constructor() {
    if (process.env.NODE_ENV === 'production') {
      this.client = new speech.SpeechClient({
        projectId: process.env.GOOGLE_PROJECT_ID,
        credentials: {
          client_email: process.env.GOOGLE_CLIENT_EMAIL,
          private_key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        },
      });
    } else {
      this.client = new speech.SpeechClient();
    }
    this.streams = {};
    this.app = express();
    this.addMiddlewares();
    this.serveStatic();
    this.defineRoutes();
    this.createServer();
    this.createSocket();
  }

  addMiddlewares() {
    this.app.use(bodyParser.urlencoded({extended: false}));
    this.app.use(pino());
  }

  serveStatic() {
    if (process.env.NODE_ENV === 'production') {
      this.app.use(express.static(path.join(__dirname, '../build')));
    }
  }

  createServer() {
    this.server = http.createServer(this.app);
  }

  createSocket() {
    this.socket = io(this.server);

    this.socket.on('connection', (socket) => {
      const id =
        process.env.NODE_ENV === 'production'
          ? socket.handshake.address
          : socket.handshake.headers['x-forwarded-for'];

      socket.on('startRecognition', () => {
        startRecognitionStream(socket);
      });

      socket.on('stopRecognition', () => {
        stopRecognitionStream();
      });

      socket.on('streamAudio', (chunk) => {
        if (this.streams[id]) {
          this.streams[id].write(chunk);
        }
      });

      const startRecognitionStream = (socket) => {
        this.streams[id] = this.client
          .streamingRecognize(request)
          .on('error', console.error)
          .on('data', (data) => {
            socket.emit('transcript', data);

            if (data.results[0] && data.results[0].isFinal) {
              stopRecognitionStream();
              startRecognitionStream(socket);
            }
          });
      };

      const stopRecognitionStream = () => {
        if (this.streams[id]) {
          this.streams[id].end();
        }
        this.streams[id] = null;
      };
    });
  }

  defineRoutes() {
    if (process.env.NODE_ENV === 'production') {
      this.app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
      });
    } else {
      this.app.get('/api/greeting', (req, res) => {
        const name = req.query.name || 'World';
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({greeting: `Hello ${name}!`}));
      });
    }
  }

  listen() {
    this.server.listen(process.env.PORT || 3001, () => {
      console.log('Server up and listening...');
    });
  }
}

new Server().listen();
