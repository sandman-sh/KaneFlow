const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');

const TargetAppServer = require('./target-server');
const KaneRunner = require('../runner/kane-runner');
const KaneHealer = require('../agent/healer');
const KaneWatcher = require('../watcher/file-watcher');

class KaneStudioServer {
  constructor(options = {}) {
    this.port = options.port || 4100;
    this.targetPort = options.targetPort || 4101;
    this.rootDir = path.resolve(__dirname, '../..');
    this.specsDir = path.join(this.rootDir, 'specs');
    this.demoAppDir = options.appDir || path.join(this.rootDir, 'demo-app');

    this.app = express();
    this.server = null;
    this.wss = null;
    this.clients = new Set();

    this.targetUrl = options.targetUrl || `http://localhost:${this.targetPort}`;
    this.targetServer = new TargetAppServer(this.targetPort, this.demoAppDir);
    this.runner = new KaneRunner({ cwd: this.rootDir, headless: true });
    this.healer = new KaneHealer({ appDir: this.demoAppDir, runner: this.runner });
    this.watcher = new KaneWatcher();

    this.customAiConfig = null;
    this.state = {
      status: 'IDLE',
      currentSpec: null,
      targetUrl: this.targetUrl,
      appDir: this.demoAppDir,
      lastVerdict: null,
      history: [],
      activeDiff: null,
      aiProvider: this.getAiProviderInfo(),
      metrics: {
        totalRuns: 0,
        healedRuns: 0,
        passedRuns: 0,
        failedRuns: 0
      }
    };

    this.setupExpress();
    this.setupRunnerEvents();
    this.setupWatcherEvents();
  }

  getAiProviderInfo() {
    if (this.customAiConfig) {
      if (this.customAiConfig.provider === 'semantic') {
        return { provider: 'SEMANTIC_ENGINE', name: 'Deterministic Semantic AST' };
      }
      return {
        provider: this.customAiConfig.provider,
        name: this.customAiConfig.name || `${this.customAiConfig.provider.toUpperCase()} (${this.customAiConfig.model || 'custom'})`,
        model: this.customAiConfig.model,
        baseUrl: this.customAiConfig.baseUrl
      };
    }
    if (process.env.GEMINI_API_KEY) return { provider: 'GEMINI', name: `Gemini (${process.env.GEMINI_MODEL || '1.5-flash'})`, model: process.env.GEMINI_MODEL };
    if (process.env.OPENAI_API_KEY) return { provider: 'OPENAI', name: `OpenAI (${process.env.OPENAI_MODEL || 'gpt-4o-mini'})`, model: process.env.OPENAI_MODEL };
    if (process.env.ANTHROPIC_API_KEY) return { provider: 'ANTHROPIC', name: `Claude (${process.env.ANTHROPIC_MODEL || '3.5-sonnet'})`, model: process.env.ANTHROPIC_MODEL };
    if (process.env.GROQ_API_KEY) return { provider: 'GROQ', name: `Groq (${process.env.GROQ_MODEL || 'llama-3.1-70b'})`, model: process.env.GROQ_MODEL };
    if (process.env.OPENAI_BASE_URL) return { provider: 'CUSTOM', name: `Custom (${process.env.OPENAI_MODEL || 'custom'})`, model: process.env.OPENAI_MODEL, baseUrl: process.env.OPENAI_BASE_URL };
    return { provider: 'SEMANTIC_ENGINE', name: 'Deterministic Semantic AST' };
  }

  setupExpress() {
    this.app.use(express.json());

    // Disable caching for studio UI
    this.app.use((req, res, next) => {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      next();
    });

    // Serve Studio frontend static files
    this.app.use(express.static(path.resolve(__dirname, '../ui')));

    // Explicit Studio dashboard route
    this.app.get('/studio', (req, res) => {
      res.sendFile(path.resolve(__dirname, '../ui/studio.html'));
    });

    // API Routes
    this.app.get('/api/specs', (req, res) => {
      try {
        if (!fs.existsSync(this.specsDir)) fs.mkdirSync(this.specsDir, { recursive: true });
        const files = fs.readdirSync(this.specsDir).filter(f => f.endsWith('.md'));
        const specs = files.map(filename => {
          const content = fs.readFileSync(path.join(this.specsDir, filename), 'utf8');
          const titleMatch = content.match(/description:\s*(.+)/i) || content.match(/^#+\s*(.+)/m);
          return {
            filename,
            path: `specs/${filename}`,
            description: titleMatch ? titleMatch[1].trim() : filename,
            content
          };
        });
        res.json({ specs });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.post('/api/specs/create', (req, res) => {
      try {
        let { filename, content } = req.body;
        if (!filename) return res.status(400).json({ error: 'Filename is required' });
        if (!filename.endsWith('.md')) filename += '.md';
        // sanitize filename
        filename = filename.replace(/[^a-zA-Z0-9_-]/g, '_') + '.md';

        const filePath = path.join(this.specsDir, filename);
        fs.writeFileSync(filePath, content || '## Step 1: Verification\nAssert true\n', 'utf8');
        res.json({ status: 'created', filename, path: `specs/${filename}` });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.put('/api/specs/:filename', (req, res) => {
      try {
        const filename = path.basename(req.params.filename);
        const { content } = req.body;
        const filePath = path.join(this.specsDir, filename);
        fs.writeFileSync(filePath, content || '', 'utf8');
        res.json({ status: 'updated', filename });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.delete('/api/specs/:filename', (req, res) => {
      try {
        const filename = path.basename(req.params.filename);
        const filePath = path.join(this.specsDir, filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
        res.json({ status: 'deleted', filename });
      } catch (err) {
        res.status(500).json({ error: err.message });
      }
    });

    this.app.get('/api/state', (req, res) => {
      this.state.aiProvider = this.getAiProviderInfo();
      res.json(this.state);
    });

    this.app.post('/api/target-url', (req, res) => {
      const { url } = req.body;
      if (!url) return res.status(400).json({ error: 'url is required' });
      this.targetUrl = url;
      this.state.targetUrl = url;
      this.broadcast({ type: 'TARGET_URL_CHANGED', targetUrl: url });
      res.json({ status: 'updated', targetUrl: url });
    });

    this.app.post('/api/ai-config', (req, res) => {
      const { provider, apiKey, model, baseUrl, name } = req.body;
      if (provider === 'semantic') {
        this.customAiConfig = { provider: 'semantic', name: 'Deterministic Semantic AST' };
      } else {
        if (apiKey) {
          if (provider === 'gemini') process.env.GEMINI_API_KEY = apiKey;
          else if (provider === 'anthropic') process.env.ANTHROPIC_API_KEY = apiKey;
          else if (provider === 'groq') process.env.GROQ_API_KEY = apiKey;
          else process.env.OPENAI_API_KEY = apiKey;
        }
        if (model) {
          if (provider === 'gemini') process.env.GEMINI_MODEL = model;
          else if (provider === 'anthropic') process.env.ANTHROPIC_MODEL = model;
          else if (provider === 'groq') process.env.GROQ_MODEL = model;
          else process.env.OPENAI_MODEL = model;
        }
        if (baseUrl) {
          process.env.OPENAI_BASE_URL = baseUrl;
        }
        this.customAiConfig = {
          provider: provider || 'custom',
          name: name || `${(provider || 'custom').toUpperCase()} (${model || 'default'})`,
          model,
          baseUrl
        };
      }

      this.state.aiProvider = this.getAiProviderInfo();
      this.broadcast({ type: 'AI_PROVIDER_CHANGED', aiProvider: this.state.aiProvider });
      res.json({ status: 'updated', aiProvider: this.state.aiProvider });
    });

    this.app.post('/api/run', async (req, res) => {
      const { spec, url } = req.body;
      if (!spec) return res.status(400).json({ error: 'spec is required' });
      
      const targetUrl = url || this.targetUrl;
      this.runSpec(spec, { url: targetUrl });
      res.json({ status: 'started', spec, url: targetUrl });
    });

    this.app.post('/api/heal', async (req, res) => {
      const { spec, url, appDir } = req.body;
      if (!spec) return res.status(400).json({ error: 'spec is required' });

      const targetUrl = url || this.targetUrl;
      const targetAppDir = appDir || this.demoAppDir;
      this.runHeal(spec, { url: targetUrl, appDir: targetAppDir });
      res.json({ status: 'healing_started', spec, url: targetUrl });
    });

    this.app.post('/api/inject-bug', (req, res) => {
      const appJsPath = path.join(this.demoAppDir, 'app.js');
      let code = fs.readFileSync(appJsPath, 'utf8');
      
      // Inject intentional priority filter bug
      if (!code.includes('this.hasInjectedBug = true; // Injected Demo Bug')) {
        code = code.replace(
          /matchesFilter\s*\(task\)\s*\{/g,
          `matchesFilter(task) {\n    // Injected Demo Bug: breaks priority filtering\n    if (this.currentFilter !== 'all') return false;`
        );
        fs.writeFileSync(appJsPath, code, 'utf8');
      }

      this.broadcast({ type: 'BUG_INJECTED', message: 'Priority filter bug injected into target app' });
      res.json({ status: 'bug_injected' });
    });

    this.app.post('/api/reset', (req, res) => {
      this.resetDemoAppCode();
      this.broadcast({ type: 'CODE_RESET', message: 'Demo app reset to clean state' });
      res.json({ status: 'reset_complete' });
    });
  }

  resetDemoAppCode() {
    const appJsPath = path.join(this.demoAppDir, 'app.js');
    let code = fs.readFileSync(appJsPath, 'utf8');
    
    // Clean any injected bug
    code = code.replace(
      /\/\/\s*Injected Demo Bug[\s\S]*?return\s+false;/g,
      ''
    );
    fs.writeFileSync(appJsPath, code, 'utf8');
  }

  setupRunnerEvents() {
    this.runner.on('start', (data) => {
      this.state.status = 'RUNNING';
      this.state.currentSpec = data.target;
      this.broadcast({ type: 'RUN_START', data });
    });

    this.runner.on('step', (step) => {
      this.broadcast({ type: 'RUN_STEP', step });
    });

    this.runner.on('log', (log) => {
      this.broadcast({ type: 'RUN_LOG', log });
    });

    this.runner.on('finish', (result) => {
      this.state.status = 'IDLE';
      this.state.lastVerdict = result.verdict;
      this.state.metrics.totalRuns++;
      if (result.success) this.state.metrics.passedRuns++;
      else this.state.metrics.failedRuns++;

      this.state.history.unshift({
        timestamp: Date.now(),
        target: result.target,
        verdict: result.verdict,
        durationMs: result.durationMs,
        stepsCount: result.steps.length
      });
      if (this.state.history.length > 20) this.state.history.pop();

      this.broadcast({ type: 'RUN_FINISH', result });
    });

    this.healer.on('timeline', (event) => {
      this.broadcast({ type: 'HEAL_TIMELINE', event });
    });

    this.healer.on('loop_finish', (loopResult) => {
      this.state.status = 'IDLE';
      this.state.activeDiff = loopResult.diff;
      if (loopResult.success && loopResult.iterations > 0) {
        this.state.metrics.healedRuns++;
      }
      this.broadcast({ type: 'HEAL_FINISH', loopResult });
    });
  }

  setupWatcherEvents() {
    this.watcher.on('file_change', (fileEvent) => {
      this.broadcast({ type: 'FILE_CHANGE', fileEvent });
      // Auto re-run default spec on target file change if idle
      if (this.state.status === 'IDLE') {
        const specToRun = fileEvent.isSpec ? fileEvent.path : 'specs/priority_filter_test.md';
        this.runSpec(specToRun);
      }
    });
  }

  async runSpec(spec, opts = {}) {
    if (this.state.status !== 'IDLE') return;
    this.state.status = 'RUNNING';
    this.state.currentSpec = spec;
    const finalOpts = { url: this.targetUrl, ...opts };
    return this.runner.run(spec, finalOpts);
  }

  async runHeal(spec, opts = {}) {
    if (this.state.status !== 'IDLE') return;
    this.state.status = 'HEALING';
    this.state.currentSpec = spec;
    const finalOpts = { url: this.targetUrl, appDir: this.demoAppDir, ...opts };
    return this.healer.heal(spec, finalOpts);
  }

  broadcast(message) {
    const payload = JSON.stringify(message);
    for (const client of this.clients) {
      if (client.readyState === 1) {
        client.send(payload);
      }
    }
  }

  async start() {
    // 1. Start target app dev server
    await this.targetServer.start();
    console.log(`✓ Target Demo App running at http://localhost:${this.targetPort}`);

    // 2. Start Studio web server
    return new Promise((resolve) => {
      this.server = http.createServer(this.app);
      this.wss = new WebSocketServer({ server: this.server });
      this.wss.on('error', (err) => {
        // Suppress unhandled wss port conflict errors handled by http server
      });

      this.wss.on('connection', (ws) => {
        this.clients.add(ws);
        // Send initial state snapshot
        ws.send(JSON.stringify({ type: 'INIT_STATE', state: this.state }));

        ws.on('message', (msg) => {
          try {
            const data = JSON.parse(msg.toString());
            this.handleWsMessage(data);
          } catch (e) {
            console.error('Invalid WS message', e);
          }
        });

        ws.on('close', () => {
          this.clients.delete(ws);
        });
      });

      this.watcher.start();

      this.server.on('error', (err) => {
        if (err.code === 'EADDRINUSE') {
          console.warn(`Studio port ${this.port} is already in use. Reusing port.`);
          resolve({
            studioPort: this.port,
            targetPort: this.targetPort,
            studioUrl: `http://localhost:${this.port}`,
            targetUrl: `http://localhost:${this.targetPort}`
          });
        } else {
          console.error('Server error:', err);
        }
      });

      this.server.listen(this.port, () => {
        console.log(`⚡ KaneFlow Studio live at http://localhost:${this.port}`);
        resolve({
          studioPort: this.port,
          targetPort: this.targetPort,
          studioUrl: `http://localhost:${this.port}`,
          targetUrl: `http://localhost:${this.targetPort}`
        });
      });
    });
  }

  handleWsMessage(data) {
    if (data.type === 'TRIGGER_RUN') {
      this.runSpec(data.spec, { url: data.url || this.targetUrl });
    } else if (data.type === 'TRIGGER_HEAL') {
      this.runHeal(data.spec, { url: data.url || this.targetUrl, appDir: data.appDir || this.demoAppDir });
    } else if (data.type === 'SET_TARGET_URL') {
      if (data.url) {
        this.targetUrl = data.url;
        this.state.targetUrl = data.url;
        this.broadcast({ type: 'TARGET_URL_CHANGED', targetUrl: data.url });
      }
    } else if (data.type === 'INJECT_BUG') {
      const appJsPath = path.join(this.demoAppDir, 'app.js');
      let code = fs.readFileSync(appJsPath, 'utf8');
      code = code.replace(
        /matchesFilter\s*\(task\)\s*\{/g,
        `matchesFilter(task) {\n    // Injected Demo Bug: breaks priority filtering\n    if (this.currentFilter !== 'all') return false;`
      );
      fs.writeFileSync(appJsPath, code, 'utf8');
      this.broadcast({ type: 'BUG_INJECTED', message: 'Priority filter bug injected into target app' });
    } else if (data.type === 'RESET_CODE') {
      this.resetDemoAppCode();
      this.broadcast({ type: 'CODE_RESET', message: 'Demo app reset to clean state' });
    }
  }

  async stop() {
    this.watcher.stop();
    if (this.runner) this.runner.stop();
    if (this.targetServer) await this.targetServer.stop();
    if (this.server) {
      await new Promise(r => this.server.close(r));
    }
  }
}

module.exports = KaneStudioServer;

