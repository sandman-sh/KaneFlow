/**
 * KaneFlow Studio Client-Side Application
 * Universal Real-World Testing, Autonomous Spec-Driven DevLoop & Self-Healing Engine
 */

class KaneStudioClient {
  constructor() {
    this.ws = null;
    this.specs = [];
    this.timelineEvents = [];
    this.activeTab = 'timeline';
    this.currentTargetUrl = 'http://localhost:4101';
    this.currentEditingSpec = null;

    this.initElements();
    this.attachEvents();
    this.connectWs();
    this.fetchSpecs();
    this.fetchState();

    // Trigger guided tour on first visit
    setTimeout(() => this.checkFirstTimeTour(), 900);
  }

  initElements() {
    // Header status & metrics
    this.statusPill = document.getElementById('global-status-pill');
    this.statusText = document.getElementById('status-text');
    this.aiEngineName = document.getElementById('ai-engine-name');
    this.btnOpenAiSettings = document.getElementById('btn-open-ai-settings');
    this.btnStartTour = document.getElementById('btn-start-tour');
    this.metricTotal = document.getElementById('metric-total');
    this.metricHealed = document.getElementById('metric-healed');
    this.metricPassed = document.getElementById('metric-passed');

    // Sidebar & Specs
    this.specsList = document.getElementById('specs-list');
    this.specsCount = document.getElementById('specs-count');
    this.btnNewSpec = document.getElementById('btn-new-spec');
    this.btnDemoHeal = document.getElementById('btn-demo-heal');
    this.customPromptInput = document.getElementById('custom-prompt-input');
    this.btnRunCustom = document.getElementById('btn-run-custom');

    // Center Panels
    this.tabButtons = document.querySelectorAll('.tab-btn');
    this.tabContents = document.querySelectorAll('.tab-content');
    this.timelineContainer = document.getElementById('timeline-container');
    this.diffFilename = document.getElementById('diff-filename');
    this.diffCode = document.getElementById('diff-code');
    this.logStreamBox = document.getElementById('log-stream-box');

    // Right Preview & URL Bar
    this.targetIframe = document.getElementById('target-iframe');
    this.targetPresetSelect = document.getElementById('target-preset-select');
    this.targetUrlInput = document.getElementById('target-url-input');
    this.btnSetTarget = document.getElementById('btn-set-target');
    this.btnReloadPreview = document.getElementById('btn-reload-preview');
    this.targetExternalLink = document.getElementById('target-external-link');
    this.iframeFallback = document.getElementById('iframe-fallback');
    this.fallbackOpenLink = document.getElementById('fallback-open-link');

    // Spec Modal Elements
    this.specModal = document.getElementById('spec-editor-modal');
    this.modalSpecTitle = document.getElementById('modal-spec-title');
    this.modalSpecFilename = document.getElementById('modal-spec-filename');
    this.modalSpecContent = document.getElementById('modal-spec-content');
    this.btnCloseSpecModal = document.getElementById('btn-close-spec-modal');
    this.btnCancelSpec = document.getElementById('btn-cancel-spec');
    this.btnSaveSpec = document.getElementById('btn-save-spec');
    this.btnSaveAndRunSpec = document.getElementById('btn-save-and-run-spec');

    // AI Settings Modal Elements
    this.aiModal = document.getElementById('ai-settings-modal');
    this.btnCloseAiModal = document.getElementById('btn-close-ai-modal');
    this.btnCloseAiSettings = document.getElementById('btn-close-ai-settings');
    this.btnSaveAiSettings = document.getElementById('btn-save-ai-settings');
    this.modalAiProvider = document.getElementById('modal-ai-provider');
    this.modalAiKey = document.getElementById('modal-ai-key');
    this.modalAiModel = document.getElementById('modal-ai-model');
    this.modalAiBaseUrl = document.getElementById('modal-ai-baseurl');
    this.aiKeyGroup = document.getElementById('ai-api-key-group');
    this.aiModelGroup = document.getElementById('ai-model-group');
    this.aiBaseUrlGroup = document.getElementById('ai-baseurl-group');
  }

  attachEvents() {
    // Tab Switching
    this.tabButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tabName = btn.getAttribute('data-tab');
        this.switchTab(tabName);
      });
    });

    // 1-Click Demo Heal Trigger
    this.btnDemoHeal.addEventListener('click', () => {
      this.triggerDemoHeal();
    });

    // Custom Objective Run
    this.btnRunCustom.addEventListener('click', () => {
      const prompt = this.customPromptInput.value.trim();
      if (prompt) {
        this.runObjective(prompt);
      }
    });

    // Target URL Switcher
    this.targetPresetSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val !== 'custom') {
        this.targetUrlInput.value = val;
        this.applyTargetUrl(val);
      } else {
        this.targetUrlInput.focus();
      }
    });

    this.btnSetTarget.addEventListener('click', () => {
      const val = this.targetUrlInput.value.trim();
      if (val) this.applyTargetUrl(val);
    });

    this.targetUrlInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const val = this.targetUrlInput.value.trim();
        if (val) this.applyTargetUrl(val);
      }
    });

    // Preview Reload
    this.btnReloadPreview.addEventListener('click', () => {
      this.targetIframe.src = this.targetIframe.src;
    });

    // Spec Modal Controls
    this.btnNewSpec.addEventListener('click', () => {
      this.openSpecModal();
    });

    this.btnCloseSpecModal.addEventListener('click', () => this.closeSpecModal());
    this.btnCancelSpec.addEventListener('click', () => this.closeSpecModal());
    
    this.btnSaveSpec.addEventListener('click', () => this.saveSpec(false));
    this.btnSaveAndRunSpec.addEventListener('click', () => this.saveSpec(true));

    // Tour Trigger
    if (this.btnStartTour) {
      this.btnStartTour.addEventListener('click', () => {
        this.startTour();
      });
    }

    // AI Settings Modal Controls
    this.btnOpenAiSettings.addEventListener('click', () => {
      this.openAiModal();
    });

    this.modalAiProvider.addEventListener('change', (e) => {
      this.handleAiProviderChange(e.target.value);
    });

    this.btnCloseAiModal.addEventListener('click', () => this.closeAiModal());
    this.btnCloseAiSettings.addEventListener('click', () => this.closeAiModal());
    this.btnSaveAiSettings.addEventListener('click', () => this.saveAiSettings());
  }

  applyTargetUrl(url) {
    this.currentTargetUrl = url;
    this.targetExternalLink.href = url;
    this.sendWsMessage({ type: 'SET_TARGET_URL', url });
    this.appendLog(`🌐 Target URL updated: ${url}`, 'info');

    const isLocal = this.isLocalUrl(url);

    if (isLocal) {
      // Local URLs can be embedded directly
      this.targetIframe.src = url;
      this.iframeFallback.style.display = 'none';
    } else {
      // External sites usually block iframe embedding — show fallback
      this.targetIframe.src = 'about:blank';
      this.fallbackOpenLink.href = url;
      this.iframeFallback.style.display = 'flex';
      this.appendLog(`⚠ External site detected — iframe blocked by target. Use "Open in New Tab" or run Kane CLI directly.`, 'warn');
    }
  }

  isLocalUrl(url) {
    try {
      const parsed = new URL(url);
      const host = parsed.hostname.toLowerCase();
      return host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0' || host.endsWith('.local');
    } catch (e) {
      return true; // default to local for invalid URLs
    }
  }

  switchTab(tabName) {
    this.activeTab = tabName;
    this.tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabName);
    });
    this.tabContents.forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
  }

  connectWs() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    this.ws = new WebSocket(wsUrl);

    this.ws.onopen = () => {
      console.log('Connected to KaneFlow Studio Server');
      this.updateStatus('SYSTEM READY', 'ready');
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this.handleWsMessage(msg);
      } catch (e) {
        console.error('Error parsing WS message', e);
      }
    };

    this.ws.onclose = () => {
      this.updateStatus('DISCONNECTED', 'error');
      setTimeout(() => this.connectWs(), 2000);
    };
  }

  async fetchSpecs() {
    try {
      const res = await fetch('/api/specs');
      const data = await res.json();
      this.specs = data.specs || [];
      this.renderSpecsList();
    } catch (e) {
      console.error('Failed to load specs', e);
    }
  }

  renderSpecsList() {
    this.specsCount.textContent = `${this.specs.length} specs`;
    this.specsList.innerHTML = '';

    this.specs.forEach(spec => {
      const item = document.createElement('div');
      item.className = 'spec-item pixel-corner';
      item.innerHTML = `
        <div class="spec-item-header">
          <span class="spec-name">${this.escapeHtml(spec.filename)}</span>
        </div>
        <p class="spec-desc">${this.escapeHtml(spec.description)}</p>
        <div class="spec-actions">
          <button class="btn-ghost btn-spec-run" data-path="${spec.path}">▶ Run Kane</button>
          <button class="btn-primary btn-spec-heal" data-path="${spec.path}">⚡ Auto-Heal</button>
          <button class="btn-ghost btn-spec-edit" data-filename="${spec.filename}">✎ Edit</button>
          <button class="btn-ghost btn-spec-del text-rose" data-filename="${spec.filename}" title="Delete spec">✕</button>
        </div>
      `;

      item.querySelector('.btn-spec-run').addEventListener('click', () => {
        this.runSpec(spec.path);
      });

      item.querySelector('.btn-spec-heal').addEventListener('click', () => {
        this.healSpec(spec.path);
      });

      item.querySelector('.btn-spec-edit').addEventListener('click', () => {
        this.openSpecModal(spec);
      });

      item.querySelector('.btn-spec-del').addEventListener('click', () => {
        this.deleteSpec(spec.filename);
      });

      this.specsList.appendChild(item);
    });
  }

  openSpecModal(spec = null) {
    this.currentEditingSpec = spec;
    if (spec) {
      this.modalSpecTitle.textContent = `Edit Spec: ${spec.filename}`;
      this.modalSpecFilename.value = spec.filename;
      this.modalSpecFilename.disabled = true;
      this.modalSpecContent.value = spec.content || '';
    } else {
      this.modalSpecTitle.textContent = 'Create Plain-English Spec';
      this.modalSpecFilename.value = `custom_test_${Date.now().toString().slice(-4)}.md`;
      this.modalSpecFilename.disabled = false;
      this.modalSpecContent.value = `## Step 1: Verification\nAssert that the page loaded successfully.\n\n## Step 2: User Action\nClick the main action button.\nAssert the result is visible.\n`;
    }
    this.specModal.classList.add('active');
  }

  closeSpecModal() {
    this.specModal.classList.remove('active');
    this.currentEditingSpec = null;
  }

  async saveSpec(runAfterSave = false) {
    const filename = this.modalSpecFilename.value.trim();
    const content = this.modalSpecContent.value;
    if (!filename) return alert('Filename is required');

    try {
      if (this.currentEditingSpec) {
        await fetch(`/api/specs/${encodeURIComponent(filename)}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        });
      } else {
        await fetch('/api/specs/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename, content })
        });
      }
      this.closeSpecModal();
      await this.fetchSpecs();

      if (runAfterSave) {
        this.runSpec(`specs/${filename}`);
      }
    } catch (e) {
      alert('Error saving spec: ' + e.message);
    }
  }

  async deleteSpec(filename) {
    if (!confirm(`Delete spec "${filename}"?`)) return;
    try {
      await fetch(`/api/specs/${encodeURIComponent(filename)}`, { method: 'DELETE' });
      await this.fetchSpecs();
    } catch (e) {
      alert('Error deleting spec: ' + e.message);
    }
  }

  // AI Modal
  openAiModal() {
    this.aiModal.classList.add('active');
  }

  closeAiModal() {
    this.aiModal.classList.remove('active');
  }

  handleAiProviderChange(provider) {
    const isSemantic = provider === 'semantic';
    const isOllama = provider === 'ollama';
    const isCustom = provider === 'custom';
    const isDeepSeek = provider === 'deepseek';
    const isOpenRouter = provider === 'openrouter';

    this.aiKeyGroup.style.display = isSemantic || isOllama ? 'none' : 'block';
    this.aiModelGroup.style.display = isSemantic ? 'none' : 'block';
    this.aiBaseUrlGroup.style.display = isOllama || isCustom || isDeepSeek || isOpenRouter ? 'block' : 'none';

    // Set intelligent defaults for smooth UX
    if (isDeepSeek) {
      this.modalAiBaseUrl.value = 'https://api.deepseek.com/v1';
      if (!this.modalAiModel.value || this.modalAiModel.value === 'gemini-1.5-flash') this.modalAiModel.value = 'deepseek-chat';
    } else if (isOpenRouter) {
      this.modalAiBaseUrl.value = 'https://openrouter.ai/api/v1';
      if (!this.modalAiModel.value) this.modalAiModel.value = 'anthropic/claude-3.5-sonnet';
    } else if (isOllama) {
      this.modalAiBaseUrl.value = 'http://localhost:11434/v1';
      if (!this.modalAiModel.value) this.modalAiModel.value = 'llama3.2';
    } else if (provider === 'gemini') {
      if (!this.modalAiModel.value) this.modalAiModel.value = 'gemini-1.5-flash';
    } else if (provider === 'openai') {
      if (!this.modalAiModel.value) this.modalAiModel.value = 'gpt-4o';
    } else if (provider === 'anthropic') {
      if (!this.modalAiModel.value) this.modalAiModel.value = 'claude-3-5-sonnet-20241022';
    } else if (provider === 'groq') {
      if (!this.modalAiModel.value) this.modalAiModel.value = 'llama-3.3-70b-versatile';
    }
  }

  async saveAiSettings() {
    const provider = this.modalAiProvider.value;
    const apiKey = this.modalAiKey.value.trim();
    const model = this.modalAiModel.value.trim();
    const baseUrl = this.modalAiBaseUrl.value.trim();

    try {
      const res = await fetch('/api/ai-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, apiKey, model, baseUrl })
      });
      const data = await res.json();
      if (data.aiProvider) {
        this.updateAiProviderBadge(data.aiProvider);
      }
      this.closeAiModal();
      this.appendLog(`🧠 AI Engine updated: ${data.aiProvider.name}`, 'info');
    } catch (e) {
      alert('Error saving AI config: ' + e.message);
    }
  }

  updateAiProviderBadge(aiProvider) {
    if (this.aiEngineName && aiProvider) {
      this.aiEngineName.textContent = `AI: ${aiProvider.name}`;
    }
  }

  runSpec(specPath) {
    this.clearTimeline();
    this.updateStatus('RUNNING KANE CLI', 'running');
    this.switchTab('timeline');
    this.sendWsMessage({ type: 'TRIGGER_RUN', spec: specPath, url: this.currentTargetUrl });
  }

  healSpec(specPath) {
    this.clearTimeline();
    this.updateStatus('AUTO-HEALING LOOP', 'healing');
    this.switchTab('timeline');
    this.sendWsMessage({ type: 'TRIGGER_HEAL', spec: specPath, url: this.currentTargetUrl });
  }

  runObjective(promptText) {
    this.clearTimeline();
    this.updateStatus('RUNNING OBJECTIVE', 'running');
    this.switchTab('timeline');
    this.sendWsMessage({ type: 'TRIGGER_RUN', spec: promptText, url: this.currentTargetUrl });
  }

  async triggerDemoHeal() {
    this.clearTimeline();
    this.updateStatus('INJECTING BUG & STARTING HEAL', 'healing');
    this.switchTab('timeline');

    // 1. Inject Bug into TaskFlow Demo App
    await fetch('/api/inject-bug', { method: 'POST' });
    this.targetIframe.src = this.targetIframe.src;

    // 2. Trigger heal loop
    setTimeout(() => {
      this.sendWsMessage({ type: 'TRIGGER_HEAL', spec: 'specs/priority_filter_test.md', url: 'http://localhost:4101' });
    }, 400);
  }

  sendWsMessage(payload) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(payload));
    }
  }

  handleWsMessage(msg) {
    switch (msg.type) {
      case 'INIT_STATE':
        this.updateMetrics(msg.state.metrics);
        if (msg.state.targetUrl) {
          this.currentTargetUrl = msg.state.targetUrl;
          this.targetUrlInput.value = msg.state.targetUrl;
        }
        if (msg.state.aiProvider) {
          this.updateAiProviderBadge(msg.state.aiProvider);
        }
        break;

      case 'TARGET_URL_CHANGED':
        this.currentTargetUrl = msg.targetUrl;
        this.targetUrlInput.value = msg.targetUrl;
        this.targetIframe.src = msg.targetUrl;
        this.targetExternalLink.href = msg.targetUrl;
        break;

      case 'AI_PROVIDER_CHANGED':
        this.updateAiProviderBadge(msg.aiProvider);
        break;

      case 'RUN_START':
        this.appendLog(`[START] Running: ${msg.data.target}`, 'info');
        break;

      case 'RUN_STEP':
        this.appendLog(`[STEP] ${msg.step.title} (${msg.step.status})`, 'step');
        break;

      case 'RUN_LOG':
        this.appendLog(msg.log.message, msg.log.level === 'warn' ? 'warn' : 'info');
        break;

      case 'RUN_FINISH':
        this.updateStatus(msg.result.success ? 'VERIFIED GREEN' : 'TEST FAILED', msg.result.success ? 'ready' : 'error');
        this.appendLog(`[FINISH] Verdict: ${msg.result.verdict} in ${msg.result.durationMs}ms`, msg.result.success ? 'pass' : 'error');
        this.fetchState();
        break;

      case 'HEAL_TIMELINE':
        this.addTimelineCard(msg.event);
        break;

      case 'HEAL_FINISH':
        this.updateStatus(msg.loopResult.success ? 'LOOP CLOSED & GREEN' : 'HEAL FAILED', msg.loopResult.success ? 'ready' : 'error');
        if (msg.loopResult.diff) {
          this.renderDiff(msg.loopResult.diff, msg.loopResult.patchedFile);
        }
        // Refresh preview iframe
        setTimeout(() => {
          this.targetIframe.src = this.targetIframe.src;
        }, 500);
        this.fetchState();
        break;

      case 'BUG_INJECTED':
        this.appendLog('🐞 Regression bug injected into target application', 'warn');
        break;

      case 'CODE_RESET':
        this.appendLog('↺ Target application reset to clean state', 'info');
        break;
    }
  }

  async fetchState() {
    try {
      const res = await fetch('/api/state');
      const data = await res.json();
      this.updateMetrics(data.metrics);
      if (data.aiProvider) {
        this.updateAiProviderBadge(data.aiProvider);
      }
    } catch (e) {}
  }

  updateMetrics(metrics = {}) {
    if (this.metricTotal) this.metricTotal.textContent = metrics.totalRuns || 0;
    if (this.metricHealed) this.metricHealed.textContent = metrics.healedRuns || 0;
    if (this.metricPassed) this.metricPassed.textContent = metrics.passedRuns || 0;
  }

  updateStatus(text, mode = 'ready') {
    this.statusText.textContent = text;
    this.statusPill.className = `status-indicator-pill ${mode}`;
  }

  clearTimeline() {
    this.timelineContainer.innerHTML = '';
    this.logStreamBox.innerHTML = '';
  }

  addTimelineCard(event) {
    const card = document.createElement('div');
    card.className = `timeline-card ${event.type}`;

    let icon = '⚡';
    if (event.type === 'INITIAL_RUN' || event.type === 'REVERIFYING') icon = '🔍';
    else if (event.type === 'KANE_FAILED' || event.type === 'REVERIFY_FAILED') icon = '🔴';
    else if (event.type === 'DIAGNOSING') icon = '🧠';
    else if (event.type === 'APPLYING_PATCH') icon = '🛠️';
    else if (event.type === 'LOOP_CLOSED_GREEN' || event.type === 'ALREADY_GREEN') icon = '🟢';

    let metaHtml = '';
    if (event.data && event.data.diff) {
      metaHtml = `<div class="timeline-meta">Patch generated for ${this.escapeHtml(event.data.suggestedFile || 'codebase')}. Click "Code Diff Inspector" to view.</div>`;
    } else if (event.data && event.data.failedStep) {
      metaHtml = `<div class="timeline-meta">Failed at: ${this.escapeHtml(JSON.stringify(event.data.failedStep))}</div>`;
    }

    card.innerHTML = `
      <div class="timeline-icon">${icon}</div>
      <div class="timeline-details">
        <span class="timeline-type">${event.type}</span>
        <p class="timeline-message">${this.escapeHtml(event.message)}</p>
        ${metaHtml}
      </div>
    `;

    this.timelineContainer.appendChild(card);
    this.timelineContainer.scrollTop = this.timelineContainer.scrollHeight;
  }

  renderDiff(diffText, patchedFile = 'app.js') {
    if (!diffText) return;
    if (this.diffFilename) {
      this.diffFilename.textContent = patchedFile ? String(patchedFile).replace(/\\/g, '/') : 'Codebase Patch';
    }
    const lines = diffText.split('\n');
    let formattedHtml = '';

    lines.forEach(line => {
      if (line.startsWith('+') && !line.startsWith('+++')) {
        formattedHtml += `<span class="diff-line-add">${this.escapeHtml(line)}</span>`;
      } else if (line.startsWith('-') && !line.startsWith('---')) {
        formattedHtml += `<span class="diff-line-del">${this.escapeHtml(line)}</span>`;
      } else {
        formattedHtml += `<span>${this.escapeHtml(line)}</span>\n`;
      }
    });

    this.diffCode.innerHTML = `<code>${formattedHtml}</code>`;
  }

  appendLog(message, level = 'info') {
    const entry = document.createElement('div');
    entry.className = `log-entry log-${level}`;
    const time = new Date().toLocaleTimeString();
    entry.textContent = `[${time}] ${message}`;
    this.logStreamBox.appendChild(entry);
    this.logStreamBox.scrollTop = this.logStreamBox.scrollHeight;
  }

  escapeHtml(str) {
    if (!str) return '';
    return String(str).replace(/&/g, '&amp;')
                      .replace(/</g, '&lt;')
                      .replace(/>/g, '&gt;');
  }

  checkFirstTimeTour() {
    const seen = localStorage.getItem('kaneflow_studio_tour_completed');
    if (!seen) {
      this.startTour();
    }
  }

  startTour() {
    if (!window.driver || !window.driver.js) {
      console.warn('Driver.js is loading or unavailable');
      return;
    }

    const driver = window.driver.js.driver;
    const driverObj = driver({
      showProgress: true,
      animate: true,
      overlayColor: 'rgba(0, 0, 0, 0.85)',
      nextBtnText: 'Next →',
      prevBtnText: '← Back',
      doneBtnText: 'Got It! 🚀',
      onDestroyStarted: () => {
        localStorage.setItem('kaneflow_studio_tour_completed', 'true');
        driverObj.destroy();
      },
      steps: [
        {
          element: '#global-status-pill',
          popover: {
            title: '⚡ DevLoop Real-Time Telemetry',
            description: 'Monitors the autonomous closed loop state: IDLE, RUNNING (Kane browser tests), HEALING (agent code synthesis), and GREEN verification.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '#btn-open-ai-settings',
          popover: {
            title: '🤖 Multi-Model AI Engine',
            description: 'Configure your preferred AI reasoning engine: DeepSeek, OpenRouter, Google Gemini, Anthropic Claude, OpenAI GPT-4o, local Ollama, or built-in Semantic AST.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '.demo-card',
          popover: {
            title: '🎬 1-Click Live Showcase',
            description: 'Click "Break & Auto-Heal" to inject an intentional regression bug into the demo app and watch KaneFlow diagnose, patch, and re-verify green in seconds.',
            side: 'right',
            align: 'start'
          }
        },
        {
          element: '#specs-list',
          popover: {
            title: '📋 Plain-English Acceptance Specs',
            description: 'Run, auto-heal, or edit natural language test specs. Pre-loaded with demo suites and real-world public web applications (TodoMVC & HackerNews).',
            side: 'right',
            align: 'start'
          }
        },
        {
          element: '#btn-new-spec',
          popover: {
            title: '✍️ Create Custom Specs',
            description: 'Author your own Markdown test specs (.md) for any web application directly inside Studio with live validation.',
            side: 'bottom',
            align: 'start'
          }
        },
        {
          element: '.custom-prompt-box',
          popover: {
            title: '🎯 Ad-Hoc Objective Runner',
            description: 'Type any natural language command to execute quick on-demand browser verifications against the target app.',
            side: 'right',
            align: 'start'
          }
        },
        {
          element: '.tab-bar',
          popover: {
            title: '📊 Closed-Loop Telemetry & Diffs',
            description: 'Inspect the step-by-step healing timeline, live side-by-side git code diffs, and raw NDJSON stream logs from Kane CLI.',
            side: 'bottom',
            align: 'center'
          }
        },
        {
          element: '.target-url-bar',
          popover: {
            title: '🌐 Universal Target URL Switcher',
            description: 'Test any web application! Switch presets (TaskFlow Pro, TodoMVC, HackerNews) or enter your local dev server (e.g. http://localhost:3000).',
            side: 'left',
            align: 'start'
          }
        }
      ]
    });

    driverObj.drive();
  }
}

// Start Studio Client
window.addEventListener('DOMContentLoaded', () => {
  window.studio = new KaneStudioClient();
});
