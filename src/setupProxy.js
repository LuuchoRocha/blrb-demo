const proxy = require("http-proxy-middleware");
const PORT = process.env.PROXY_PORT || 3001;

const options = { 
  target: `http://localhost:${PORT}/`,
  ws: true,
  xfwd: true,
};

module.exports = app => {
  app.use(proxy.createProxyMiddleware("/api/*", options));
  app.use(proxy.createProxyMiddleware("/socket.io", options));
};
