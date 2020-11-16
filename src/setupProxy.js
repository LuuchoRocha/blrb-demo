const proxy = require("http-proxy-middleware");
const PORT = process.env.PROXY_PORT || 3001;
const URL = process.env.PROXY_URL || 'http://localhost';

const options = { 
  target: `${URL}:${PORT}`,
  ws: true,
  xfwd: true,
};

module.exports = app => {
  app.use(proxy.createProxyMiddleware("/api/*", options));
  app.use(proxy.createProxyMiddleware("/socket.io", options));
};
