const express = require('express');
const bodyParser = require('body-parser');
const pino = require('express-pino-logger');
const http = require('http');
const io = require('socket.io');
const ss = require('socket.io-stream');
const fs = require('fs');
const path = require('path');
const speech = require('./speech');
const uuid = require('uuid').v4;

class Server {
  constructor() {
    this.clients = {};
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
      const id = uuid();

      ss(socket).on('stream', (stream, data) => {
        if (!this.clients[id]) {
          this.clients[id] = {
            file: `${id}-${Date.now()}.wav`,
          };
        }

        stream.pipe(fs.createWriteStream(this.clients[id].file, {flags: 'a'}));

        speech.speechStreamToText(stream, (response) => {
          socket.emit('translated', response);
        });
      });

      socket.on('correct', async (audio) => {
        socket.emit('corrected', await speech.speechToText(audio));
      });
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
