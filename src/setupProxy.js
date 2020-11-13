const proxy = require("http-proxy-middleware");
const PORT = process.env.PROXY_PORT || 3001;

module.exports = app => {
  app.use(proxy.createProxyMiddleware("/api/*", { target: `http://localhost:${PORT}/` }));
};
