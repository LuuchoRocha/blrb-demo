const express = require('express');
const https = require('https');
const path = require('path');
const fs = require('fs');
const port = process.env.PORT || 3000;
const key = fs.readFileSync(path.join(__dirname, '/../certs/selfsigned.key'));
const cert = fs.readFileSync(path.join(__dirname,'/../certs/selfsigned.crt'));
const app = express();

app.use(express.static(path.join(__dirname, '..', 'build')));

app.get('/', function (req, res) {
  res.sendFile(path.join(__dirname, '..', 'build', 'index.html'));
});

https.createServer({key, cert}, app).listen(port);
