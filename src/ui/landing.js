/**
 * KaneFlow Landing Homepage Interactive Scripts
 * Particle Canvas, Closed-Loop Simulator, Code Tabs & Accordions
 */

document.addEventListener('DOMContentLoaded', () => {
  initParticleCanvas();
  initLoopSimulator();
  initSpecTabs();
  initFaqAccordions();
  initCopyCommand();
});

// 1. Cyber Particle Matrix Canvas
function initParticleCanvas() {
  const canvas = document.getElementById('particle-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  let width = (canvas.width = window.innerWidth);
  let height = (canvas.height = window.innerHeight);

  window.addEventListener('resize', () => {
    width = canvas.width = window.innerWidth;
    height = canvas.height = window.innerHeight;
  });

  const particles = [];
  const count = Math.floor(width / 22);

  for (let i = 0; i < count; i++) {
    particles.push({
      x: Math.random() * width,
      y: Math.random() * height,
      vx: (Math.random() - 0.5) * 0.4,
      vy: (Math.random() - 0.5) * 0.4,
      radius: Math.random() * 1.8 + 0.8,
      alpha: Math.random() * 0.5 + 0.2
    });
  }

  function animate() {
    ctx.clearRect(0, 0, width, height);

    // Draw connecting lines
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < 110) {
          ctx.strokeStyle = `rgba(168, 85, 247, ${0.15 * (1 - dist / 110)})`;
          ctx.lineWidth = 0.8;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw particles
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;

      if (p.x < 0) p.x = width;
      if (p.x > width) p.x = 0;
      if (p.y < 0) p.y = height;
      if (p.y > height) p.y = 0;

      ctx.fillStyle = `rgba(192, 132, 252, ${p.alpha})`;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(animate);
  }

  animate();
}

// 2. Interactive Closed-Loop Simulator
const SIM_DATA = {
  spec: {
    title: "Step 1: Ingest Plain-English Spec",
    status: "SPEC PARSED",
    statusClass: "status-amber",
    code: `// specs/priority_filter_test.md
## Step 1: Filter by Urgent Priority
Click the "Urgent" filter button in the top navigation bar.
Assert that the active filter banner displays "Urgent".
Assert that only urgent task cards remain visible on the sprint board.`
  },
  red: {
    title: "Step 2: Kane CLI Browser Execution (Red Fail)",
    status: "ASSERTION FAILED",
    statusClass: "status-red",
    code: `> npx @testmuai/kane-cli testmd run priority_filter_test.md --agent
{"type":"step","index":1,"title":"Filter by Urgent Priority","status":"running"}
{"type":"action","step":1,"action":"click","selector":"#filter-urgent"}
{"type":"checkpoint","name":"cp_urgent","status":"FAILED","assertion":"Urgent tasks visible"}
{"type":"run_end","status":"failed","error":"AssertionError: Expected urgent priority cards, but 0 found."}`
  },
  diagnose: {
    title: "Step 3: AST Failure Extraction & Diagnosis",
    status: "DIAGNOSED",
    statusClass: "status-amber",
    code: `[KaneDiagnostics] Analyzing failure payload...
Category: FILTER_LOGIC_ERROR
Target File: demo-app/app.js
Root Cause: matchesFilter(task) returned false for all filtered items due to broken predicate override.
Confidence: 0.98`
  },
  diff: {
    title: "Step 4: AI Code Synthesizer & Unified Patch",
    status: "PATCH SYNTHESIZED",
    statusClass: "status-green",
    code: `--- demo-app/app.js (original)
+++ demo-app/app.js (healed)
@@ -251,4 +251,4 @@
   matchesFilter(task) {
<span class="diff-del">-    if (this.currentFilter !== 'all') return false; // Broken bug</span>
<span class="diff-add">+    if (this.currentFilter === 'all') return true;</span>
<span class="diff-add">+    return task.priority.toLowerCase() === this.currentFilter.toLowerCase();</span>
   }`
  },
  green: {
    title: "Step 5: Kane Re-Verification (Sealed Green)",
    status: "VERIFIED GREEN (PASS)",
    statusClass: "status-green",
    code: `> npx @testmuai/kane-cli testmd run priority_filter_test.md --agent
{"type":"step","index":1,"title":"Filter by Urgent Priority","status":"running"}
{"type":"checkpoint","name":"cp_urgent","status":"PASSED","assertion":"Urgent tasks visible"}
{"type":"run_end","status":"passed","summary":"All 3 assertions verified in real browser."}
{"type":"verdict","verdict":"pass","duration":11200}
✓ VERIFIED GREEN — Loop closed autonomously in 1 iteration.`
  }
};

function initLoopSimulator() {
  const cards = document.querySelectorAll('.sim-step-card');
  const titleEl = document.getElementById('sim-display-title');
  const statusEl = document.getElementById('sim-display-status');
  const codeEl = document.getElementById('sim-display-code');

  if (!cards.length || !codeEl) return;

  cards.forEach(card => {
    card.addEventListener('click', () => {
      const stepKey = card.getAttribute('data-step');
      const data = SIM_DATA[stepKey];
      if (!data) return;

      cards.forEach(c => c.classList.remove('active'));
      card.classList.add('active');

      titleEl.textContent = data.title;
      statusEl.textContent = data.status;
      statusEl.className = `sim-display-status ${data.statusClass}`;
      codeEl.innerHTML = `<code>${data.code}</code>`;
    });
  });
}

// 3. Spec Tabs Switcher
function initSpecTabs() {
  const tabBtns = document.querySelectorAll('.spec-tab-btn');
  const tabContents = document.querySelectorAll('.spec-tab-content');

  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const tab = btn.getAttribute('data-tab');

      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const target = document.getElementById(`spec-tab-${tab}`);
      if (target) target.classList.add('active');
    });
  });
}

// 4. FAQ Accordion
function initFaqAccordions() {
  const items = document.querySelectorAll('.faq-item');
  items.forEach(item => {
    const q = item.querySelector('.faq-q');
    if (!q) return;
    q.addEventListener('click', () => {
      const isOpen = item.classList.contains('open');
      items.forEach(i => i.classList.remove('open'));
      if (!isOpen) item.classList.add('open');
    });
  });
}

// 5. Copy Command Box
function initCopyCommand() {
  const copyBox = document.getElementById('btn-copy-cmd');
  const toast = document.getElementById('copy-toast');
  if (!copyBox) return;

  copyBox.addEventListener('click', () => {
    navigator.clipboard.writeText('npm start').then(() => {
      if (toast) {
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 2500);
      }
    });
  });
}
