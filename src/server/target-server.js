const express = require('express');
const path = require('path');
const http = require('http');

class TargetAppServer {
  constructor(port = 4101, appDir = path.resolve(__dirname, '../../demo-app')) {
    this.port = port;
    this.appDir = appDir;
    this.app = express();
    this.server = null;
    this.setupRoutes();
  }

  setupRoutes() {
    // Disable caching for live dev & testing
    this.app.use((req, res, next) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      res.setHeader('Pragma', 'no-cache');
      res.setHeader('Expires', '0');
      next();
    });

    // Serve target app static files
    this.app.use(express.static(this.appDir));

    // Health check endpoint
    this.app.get('/__kaneflow/health', (req, res) => {
      res.json({ status: 'ok', app: 'TaskFlow Pro', timestamp: Date.now() });
    });
  }

  start() {
    return new Promise((resolve, reject) => {
      this.server = http.createServer(this.app);
      this.server.listen(this.port, () => {
        resolve({
          port: this.port,
          url: `http://localhost:${this.port}`,
          dir: this.appDir
        });
      });
      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`Target port ${this.port} is already in use. Reusing existing instance.`);
          resolve({ port: this.port, url: `http://localhost:${this.port}`, dir: this.appDir });
        } else {
          reject(err);
        }
      });
    });
  }

  stop() {
    return new Promise((resolve) => {
      if (this.server) {
        this.server.close(() => resolve());
      } else {
        resolve();
      }
    });
  }
}

module.exports = TargetAppServer;
