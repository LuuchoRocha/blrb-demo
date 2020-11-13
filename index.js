const express = require('express');
const path = require('path');
const app = express();
const PORT = process.env.PORT || 3000;

if (process.env.NODE_ENV === 'production') {
  app.use(express.static('build'));
  app.get('*', (req, res) => res.sendFile(path.resolve('build', 'index.html')));
}

if (process.env.NODE_ENV === 'dev') {
  app.use(express.static('public'));
  app.get('*', (req, res) =>
    res.sendFile(path.resolve('public', 'index.html'))
  );
}

app.get('/api/message', async (req, res, next) => {
  try {
    res.status(201).json({message: 'Hello world'});
  } catch (err) {
    next(err);
  }
});

app.listen(PORT);
