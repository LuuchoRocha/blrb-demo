const express = require('express');
const bodyParser = require('body-parser');
const pino = require('express-pino-logger');
const app = express();
const http = require('http');
const socketIo = require('socket.io');
const socketIoStream = require('socket.io-stream');

app.use(bodyParser.urlencoded({extended: false}));
app.use(pino());

app.get('/api/greeting', (req, res) => {
  const name = req.query.name || 'World';
  res.setHeader('Content-Type', 'application/json');
  res.send(JSON.stringify({greeting: `Hello ${name}!`}));
});

const server = http.createServer(app);

const io = socketIo(server);

io.on('connect', (client) => {
  client.emit('server_setup', `Server connected [id=${client.id}]`);
  socketIoStream(client).on('stream-speech', async function (stream, data) {
    console.log('Receiving trought Socket.IO');
    console.log(data);
    console.log(stream);
  });
});

server.listen(3001);
