const { spawn } = require('child_process');
const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');

class KaneRunner extends EventEmitter {
  constructor(options = {}) {
    super();
    this.options = {
      headless: options.headless !== undefined ? options.headless : true,
      timeout: options.timeout || 60,
      mode: options.mode || 'testing',
      cwd: options.cwd || process.cwd(),
      ...options
    };
    this.process = null;
  }

  /**
   * Run a plain-English objective string or test markdown file
   * @param {string} target - Natural language string OR path to .spec.md / _test.md
   * @param {Object} overrideOpts
   */
  run(target, overrideOpts = {}) {
    return new Promise((resolve) => {
      const opts = { ...this.options, ...overrideOpts };
      const isFile = typeof target === 'string' && (target.endsWith('.md') || target.endsWith('.spec.md') || target.endsWith('_test.md'));
      
      const isWindows = process.platform === 'win32';
      let spawnCmd = 'npx';
      let spawnArgs = ['@testmuai/kane-cli'];

      if (isWindows) {
        spawnCmd = 'cmd.exe';
        spawnArgs = ['/c', 'npx', '@testmuai/kane-cli'];
      }

      if (isFile) {
        spawnArgs.push('testmd', 'run', path.resolve(opts.cwd, target));
        spawnArgs.push('--url', opts.url || 'http://localhost:4101');
      } else {
        spawnArgs.push('run', target);
      }

      // Flags
      spawnArgs.push('--agent'); // NDJSON output for agent closed-loop
      if (opts.headless) spawnArgs.push('--headless');
      if (opts.mode) spawnArgs.push('--mode', opts.mode);
      if (opts.timeout) spawnArgs.push('--timeout', String(opts.timeout));

      const startTime = Date.now();
      const executionResult = {
        target,
        isFile,
        success: false,
        steps: [],
        rawLogs: [],
        error: null,
        failedStep: null,
        durationMs: 0,
        verdict: 'PENDING',
        artifacts: {}
      };

      this.emit('start', { target, isFile, startTime });

      try {
        this.process = spawn(spawnCmd, spawnArgs, {
          cwd: opts.cwd,
          env: { ...process.env, FORCE_COLOR: '0' },
          windowsHide: true
        });
      } catch (err) {
        executionResult.error = err.message;
        executionResult.durationMs = Date.now() - startTime;
        this.emit('error', err);
        return resolve(executionResult);
      }

      let buffer = '';

      const handleDataChunk = (chunk) => {
        buffer += chunk.toString();
        const lines = buffer.split(/\r?\n/);
        buffer = lines.pop(); // Keep partial line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;

          executionResult.rawLogs.push(trimmed);

          // Try parsing NDJSON
          let parsed = null;
          if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
            try {
              parsed = JSON.parse(trimmed);
            } catch (e) {
              // Not valid JSON, treated as standard text log
            }
          }

          if (parsed) {
            this.handleNdjsonEvent(parsed, executionResult);
          } else {
            // Text log parsing fallback
            this.handleTextLog(trimmed, executionResult);
          }
        }
      };

      this.process.stdout.on('data', handleDataChunk);
      this.process.stderr.on('data', (chunk) => {
        const text = chunk.toString().trim();
        if (text) {
          executionResult.rawLogs.push(`[stderr] ${text}`);
          this.emit('log', { level: 'warn', message: text });
        }
      });

      this.process.on('close', (exitCode) => {
        executionResult.durationMs = Date.now() - startTime;
        
        // Final verdict determination
        if (executionResult.verdict === 'PENDING') {
          executionResult.success = exitCode === 0;
          executionResult.verdict = exitCode === 0 ? 'PASS' : 'FAIL';
        } else {
          executionResult.success = executionResult.verdict === 'PASS';
        }

        // If failed and no explicit error captured, extract from logs
        if (!executionResult.success && !executionResult.error) {
          const errorLines = executionResult.rawLogs.filter(l => 
            l.toLowerCase().includes('error') || 
            l.toLowerCase().includes('failed') || 
            l.toLowerCase().includes('assert')
          );
          executionResult.error = errorLines.slice(-3).join('\n') || `Process exited with code ${exitCode}`;
        }

        this.emit('finish', executionResult);
        resolve(executionResult);
      });

      this.process.on('error', (err) => {
        executionResult.durationMs = Date.now() - startTime;
        executionResult.error = err.message;
        executionResult.success = false;
        executionResult.verdict = 'ERROR';
        this.emit('error', err);
        resolve(executionResult);
      });
    });
  }

  handleNdjsonEvent(data, result) {
    const eventType = data.type || data.event || data.status;

    if (eventType === 'step') {
      const stepIndex = data.index || result.steps.length + 1;
      let existing = result.steps.find(s => s.index === stepIndex);
      if (existing) {
        existing.status = (data.status || existing.status).toUpperCase();
        if (data.title) existing.title = data.title;
        if (data.details) existing.details = data.details;
      } else {
        existing = {
          index: stepIndex,
          title: data.title || `Step ${stepIndex}`,
          status: (data.status || 'RUNNING').toUpperCase(),
          details: data.details || '',
          timestamp: Date.now()
        };
        result.steps.push(existing);
      }
      this.emit('step', existing);
    } else if (eventType === 'action') {
      const actionDesc = `${data.action || 'action'}${data.url ? ` -> ${data.url}` : ''}${data.selector ? ` on ${data.selector}` : ''}`;
      this.emit('action', { step: data.step, action: data.action, desc: actionDesc, data });
      this.emit('log', { level: 'info', message: `[Action] ${actionDesc}` });
    } else if (eventType === 'checkpoint') {
      const status = (data.status || '').toUpperCase();
      const cpDesc = `Checkpoint [${data.name || 'cp'}]: ${data.assertion || 'check'} (${status})`;
      if (status === 'FAILED') {
        result.error = data.assertion || 'Checkpoint failed';
        result.failedStep = data.step;
        this.emit('failure', { error: result.error, step: data.step });
      }
      this.emit('checkpoint', { name: data.name, status, assertion: data.assertion });
      this.emit('log', { level: status === 'FAILED' ? 'warn' : 'info', message: cpDesc });
    } else if (data.type === 'run_end' || eventType === 'verdict' || data.verdict) {
      const isPassed = (data.status || data.verdict || '').toLowerCase() === 'passed' || (data.status || data.verdict || '').toLowerCase() === 'pass';
      result.verdict = isPassed ? 'PASS' : 'FAIL';
      result.success = isPassed;
      result.summary = data.summary || data.one_liner || '';
      result.oneLiner = data.one_liner || '';
      result.credits = data.credits_consumed;
      result.testUrl = data.test_url;
      this.emit('verdict', { verdict: result.verdict, summary: result.summary, testUrl: data.test_url });
    } else if (eventType === 'error' || data.error) {
      result.error = data.error || data.message;
      result.failedStep = data.step || result.steps[result.steps.length - 1] || null;
      this.emit('failure', { error: result.error, step: result.failedStep });
    }

    if (data.step && data.remark) {
      const stepInfo = {
        index: data.step,
        title: data.remark,
        status: (data.status || 'RUNNING').toUpperCase(),
        timestamp: Date.now()
      };
      result.steps.push(stepInfo);
      this.emit('step', stepInfo);
    }

    if (data.artifacts || data.video || data.screenshot || data.session_id) {
      result.artifacts = {
        ...result.artifacts,
        sessionId: data.session_id || result.artifacts.sessionId,
        video: data.video || result.artifacts.video,
        screenshot: data.screenshot || result.artifacts.screenshot
      };
    }

    this.emit('ndjson', data);
  }

  handleTextLog(text, result) {
    this.emit('log', { level: 'info', message: text });

    // Pattern match common Kane CLI output strings
    if (text.includes('✓') || text.includes('PASS') || text.includes('passed')) {
      if (!result.steps.some(s => s.title === text)) {
        const step = { title: text, status: 'PASS', timestamp: Date.now() };
        result.steps.push(step);
        this.emit('step', step);
      }
    } else if (text.includes('✗') || text.includes('FAIL') || text.includes('failed') || text.includes('AssertionError')) {
      const step = { title: text, status: 'FAIL', timestamp: Date.now() };
      result.steps.push(step);
      result.failedStep = step;
      result.error = text;
      this.emit('step', step);
      this.emit('failure', { error: text, step });
    }
  }

  stop() {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }
}

module.exports = KaneRunner;
