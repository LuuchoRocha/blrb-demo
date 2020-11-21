const express = require('express');
const bodyParser = require('body-parser');
const pino = require('express-pino-logger');
const http = require('http');
const io = require('socket.io');
const path = require('path');
const speechClient = require('./speech-client');

class Server {
  constructor() {
    this.createApp();
    this.addMiddlewares();
    this.defineRoutes();
    this.serveStatic();
    this.createServer();
    this.createSpeechClient();
    this.createSocket();
    this.initializeStreams();
  }

  createApp() {
    this.app = express();
  }

  addMiddlewares() {
    this.app.use(bodyParser.urlencoded({extended: false}));
    this.app.use(pino());
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

  serveStatic() {
    if (process.env.NODE_ENV === 'production') {
      this.app.use(express.static(path.join(__dirname, '../build')));
    }
  }

  createServer() {
    this.server = http.createServer(this.app);
  }

  createSpeechClient() {
    this.speechClient = speechClient();
  }

  createSocket() {
    this.socket = io(this.server);

    this.socket.on('connection', (socket) => {
      const id =
        process.env.NODE_ENV === 'production'
          ? socket.handshake.address
          : socket.handshake.headers['x-forwarded-for'];

      socket.on('startRecognition', () => {
        this.speechClient.startRecognitionStream(id, socket);
      });

      socket.on('stopRecognition', () => {
        this.speechClient.stopRecognitionStream(id);
      });

      socket.on('streamAudio', (chunk) => {
        this.speechClient.write(id, chunk);
      });
    });
  }

  initializeStreams() {
    this.streams = {};
  }

  listen() {
    this.server.listen(process.env.PORT || 3001, () => {
      console.log('Server up and listening...');
    });
  }
}

new Server().listen();
