const express = require('express');
const bodyParser = require('body-parser');
const pino = require('express-pino-logger');
const http = require('http');
const io = require('socket.io');
const ss = require('socket.io-stream');
const fs = require('fs');

class Server {
  constructor() {
    this.clients = {};
    this.app = express();
    this.addMiddlewares();
    this.defineRoutes();
    this.createServer();
    this.createSocket();
  }

  addMiddlewares() {
    this.app.use(bodyParser.urlencoded({extended: false}));
    this.app.use(pino());
  }

  createServer() {
    this.server = http.createServer(this.app);
  }

  createSocket() {
    this.socket = io(this.server);

    this.socket.on('connection', (socket) => {
      const remoteAddress = socket.handshake.headers['x-forwarded-for'];
      console.log('Connected from ' + remoteAddress);

      socket.emit('success', remoteAddress);

      socket.on('start', () => {
        this.clients[remoteAddress] = {
          id: remoteAddress,
          file: `streams/${remoteAddress.replace(/[^\w]/gi, '-')}-${Date.now()}.wav`,
        }
      });

      ss(socket).on('stream', (stream, _data) => {
        stream.pipe(fs.createWriteStream(this.clients[remoteAddress].file, {flags: 'a'}));
      });
    });
  }

  defineRoutes() {
    this.app.get('/api/greeting', (req, res) => {
      const name = req.query.name || 'World';
      res.setHeader('Content-Type', 'application/json');
      res.send(JSON.stringify({greeting: `Hello ${name}!`}));
    });
  }

  listen() {
    this.server.listen(3001, () => {
      console.log('Server up and listening...');
    });
  }
}

new Server().listen();
