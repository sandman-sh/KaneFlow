const chokidar = require('chokidar');
const EventEmitter = require('events');
const path = require('path');

class KaneWatcher extends EventEmitter {
  constructor(options = {}) {
    super();
    this.watchDirs = options.watchDirs || [
      path.resolve(__dirname, '../../demo-app'),
      path.resolve(__dirname, '../../specs')
    ];
    this.debounceMs = options.debounceMs || 800;
    this.watcher = null;
    this.timeoutId = null;
  }

  start() {
    this.watcher = chokidar.watch(this.watchDirs, {
      ignored: /(^|[\/\\])\..|node_modules/,
      persistent: true,
      ignoreInitial: true
    });

    this.watcher.on('change', (filePath) => {
      this.handleFileChange(filePath, 'change');
    });

    this.watcher.on('add', (filePath) => {
      this.handleFileChange(filePath, 'add');
    });

    this.watcher.on('unlink', (filePath) => {
      this.handleFileChange(filePath, 'unlink');
    });

    return this;
  }

  handleFileChange(filePath, eventType) {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      const isSpec = filePath.endsWith('.md');
      const filename = path.basename(filePath);
      
      this.emit('file_change', {
        path: filePath,
        filename,
        isSpec,
        eventType,
        timestamp: Date.now()
      });
    }, this.debounceMs);
  }

  stop() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }
}

module.exports = KaneWatcher;
