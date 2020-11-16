const express = require('express');
const bodyParser = require('body-parser');
const pino = require('express-pino-logger');
const app = express();
const http = require('http');
const io = require('socket.io');
const ss = require('socket.io-stream');
const path = require('path');
const fs = require('fs');

app.use(bodyParser.urlencoded({extended: false}));
app.use(pino());

app.get('/api/greeting', (req, res) => {
  const name = req.query.name || 'World';
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({greeting: `Hello ${name}!`}));
});

const server = http.createServer(app);

const socket = io(server);

socket.on('connection', async (socket) => {
  const remoteAddress = socket.handshake.headers['x-forwarded-for'];
  console.log('Connected from ' + remoteAddress);
  socket.emit('success', remoteAddress);
  ss(socket).on('stream', function (stream, data) {
    stream.pipe(fs.createWriteStream(path.basename('stream.wav'), {flags: 'a'}));
  });
});

server.listen(3001, () => {
  console.log('Server up and listening...');
});
