<div align="center">
  <img src="banner.svg" alt="KaneFlow Banner" width="100%" />

  <br/><br/>

  [![Verified with Kane CLI](https://img.shields.io/badge/Verified%20with-Kane%20CLI-38bdf8?style=for-the-badge&logo=googlechrome)](https://github.com/LambdaTest/kane-cli)
  [![AI Multi-Model](https://img.shields.io/badge/AI%20Healer-Gemini%20%7C%20Claude%20%7C%20GPT--4o%20%7C%20DeepSeek%20%7C%20AST-a855f7?style=for-the-badge)](https://github.com)
  [![Node](https://img.shields.io/badge/Node.js-18%2B-339933?style=for-the-badge&logo=node.js)](https://nodejs.org)
  [![Status](https://img.shields.io/badge/Closed--Loop-Self--Healing-10b981?style=for-the-badge)](https://github.com)
  [![License](https://img.shields.io/badge/License-MIT-blue?style=for-the-badge)](LICENSE)

  <p align="center">
    <strong>Autonomous Spec-Driven DevLoop & Self-Healing Engine powered by Kane CLI</strong><br/>
    <em>Plain-English Specs $\rightarrow$ Browser Automation $\rightarrow$ Real-Time Telemetry $\rightarrow$ Agent Code Repair $\rightarrow$ Green Verification Run</em>
  </p>
</div>

---

## 🎯 Pitch & Problem Statement

AI coding agents have revolutionized software creation: features ship from prompts and bugs are patched in seconds. **However, one critical gap remained open**: after an agent writes or edits code, a human developer still has to open a browser, click through UI elements, and manually verify if it actually works.

**KaneFlow closes this loop completely.**

KaneFlow pairs **Kane CLI**'s plain-English browser automation with an **Autonomous Self-Healing Agent Engine** and a **Real-Time Visual Dev Studio**. When you write or update code, KaneFlow spins up a real headless Chromium browser, executes your plain-English acceptance criteria, streams NDJSON step events, and if any assertion fails, the agent parses the failure trace, diagnoses the root cause, synthesizes a code patch, and re-runs Kane CLI until the suite is 100% green.

---

## 🚀 30-Second Quickstart (Zero-Config)

You can run and test KaneFlow locally in 30 seconds with zero setup:

```bash
# 1. Clone repository and install dependencies
git clone https://github.com/sandman-sh/KaneFlow.git
cd KaneFlow
npm install

# 2. Launch KaneFlow Studio & Dev Server
npm start
```

* **⚡ KaneFlow Studio (Live Control Plane & Closed-Loop Visualizer):** [`http://localhost:4100`](http://localhost:4100)
* **📋 Target Demo App (TaskFlow Pro):** [`http://localhost:4101`](http://localhost:4101)

---

## 🎬 How the Closed-Loop Works

```
┌────────────────────────────────────────────────────────┐
│             Plain-English Spec (.md)                   │
│   e.g. "Assert urgent priority filter displays only    │
│         urgent tasks and hides non-urgent cards"       │
└───────────────────────────┬────────────────────────────┘
                            │
                            ▼
┌────────────────────────────────────────────────────────┐
│               Kane CLI Browser Runner                  │
│   Opens real Chromium, executes actions & checkpoints  │
│   Streams line-by-line NDJSON events                   │
└───────────────────────────┬────────────────────────────┘
                            │
                    ┌───────┴───────┐
                    ▼               ▼
                 [PASS]          [FAIL] ──► Captured: Error assertion, failing step, DOM context
                    │               │
                    │               ▼
                    │    ┌───────────────────────────────────┐
                    │    │      Failure Diagnostics Engine   │ ──► Multi-file project AST scanner
                    │    └──────────────────┬────────────────┘
                    │                       │
                    │                       ▼
                    │    ┌───────────────────────────────────┐
                    │    │   Multi-Model AI Code Synthesizer │ ──► Gemini / Claude / GPT-4o / DeepSeek / AST
                    │    └──────────────────┬────────────────┘
                    │                       │
                    │                       ▼
                    │    ┌───────────────────────────────────┐
                    │    │       Unified Diff Applier        │ ──► Patches target codebase (.js, .jsx, .ts, .vue)
                    │    └──────────────────┬────────────────┘
                    │                       │
                    │                       ▼
                    │    ┌───────────────────────────────────┐
                    │    │      Kane CLI Re-Verification     │ ──► Automatic re-run against patched app
                    │    └──────────────────┬────────────────┘
                    │                       │
                    └───────────────────────┴───────────────────► 🟢 SEALED GREEN (PASS)
```

---

## 🌐 Universal Testing: Any Real-World App & Codebase

KaneFlow isn't limited to a built-in demo. It is engineered to test and heal **any external web application and any project repository**:

### 1. Test Any Live URL from CLI
```bash
# Test public real-world applications (TodoMVC, HackerNews, etc.)
node bin/kaneflow.js run specs/real_world_todomvc.md --url https://todomvc.com/examples/vanillajs/

# Test local Next.js / React / Vite development servers
node bin/kaneflow.js run specs/my_feature_test.md --url http://localhost:3000
```

### 2. Autonomous Healing for Any External Codebase
```bash
# Point the healer to any directory (React, Vue, Svelte, Node, etc.)
node bin/kaneflow.js heal specs/my_feature_test.md --url http://localhost:3000 --app-dir ./my-react-app
```

### 3. Launch Studio with Custom Target
```bash
node bin/kaneflow.js studio --target-url http://localhost:3000 --app-dir ./my-react-app
```

---

## 🧠 Custom AI Model & Multi-Provider Support

KaneFlow features a **Hybrid Dual-Engine** architecture that allows users to pick their own preferred AI reasoning model or use the zero-config fallback:

| Provider | Supported Models | Configuration |
| :--- | :--- | :--- |
| **Google Gemini** | `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0` | `GEMINI_API_KEY` or Studio UI |
| **OpenAI** | `gpt-4o`, `gpt-4o-mini`, `o1`, `o3-mini` | `OPENAI_API_KEY` or Studio UI |
| **Anthropic** | `claude-3-5-sonnet`, `claude-3-haiku` | `ANTHROPIC_API_KEY` or Studio UI |
| **DeepSeek AI** | `deepseek-chat`, `deepseek-coder`, `deepseek-r1` | Set `OPENAI_BASE_URL=https://api.deepseek.com/v1` or Studio UI |
| **OpenRouter** | Any multi-provider model (`deepseek/deepseek-chat`, etc.) | Set `OPENAI_BASE_URL=https://openrouter.ai/api/v1` or Studio UI |
| **Groq Cloud** | `llama-3.3-70b-versatile`, `mixtral-8x7b` | `GROQ_API_KEY` or Studio UI |
| **Local Ollama / LM Studio** | `llama3.2`, `mistral`, `deepseek-r1:8b` | `http://localhost:11434/v1` or Studio UI |
| **Semantic AST Engine** | Built-in Deterministic Engine | **Zero-Config Default** (No API keys required) |

> [!TIP]
> You can switch AI providers on the fly directly in **KaneFlow Studio** by clicking the **"⚙ AI Engine"** badge in the header.

---

## 🖥️ Studio Features Overview

* **🌐 Universal Target URL Bar:** Switch between preset test apps or enter any custom URL with embedded live preview synchronization.
* **✍️ Live Spec Creator & Editor:** Create, edit, and save plain-English acceptance criteria (`.md`) directly in the Studio interface.
* **Closed-Loop Timeline:** Step-by-step visual cards tracking every stage (`INITIAL_RUN` $\rightarrow$ `KANE_FAILED` $\rightarrow$ `DIAGNOSING` $\rightarrow$ `APPLYING_PATCH` $\rightarrow$ `VERIFIED_GREEN`).
* **Code Diff Inspector:** Unified git-style visual diff viewer showing exact additions and removals generated by the AI healer.
* **NDJSON Telemetry Stream:** Real-time line-by-line streaming of Kane CLI actions, browser interactions, and checkpoint assertions.
* **1-Click Live Showcase:** Click **"Break & Auto-Heal"** to inject an intentional regression bug and watch the closed loop diagnose, patch, and seal green in seconds.

---

## 📋 Included Spec Suites (`specs/`)

* [`specs/priority_filter_test.md`](specs/priority_filter_test.md) — Priority tag filtering and predicate assertion.
* [`specs/task_creation_test.md`](specs/task_creation_test.md) — Modal opening, form filling, and task card creation.
* [`specs/workflow_status_test.md`](specs/workflow_status_test.md) — Column status drag/transitions and live counter updates.
* [`specs/real_world_todomvc.md`](specs/real_world_todomvc.md) — Real-world test on VanillaJS TodoMVC application.
* [`specs/real_world_hackernews.md`](specs/real_world_hackernews.md) — Real-world test on live HackerNews story rankings.

---

## 🛠️ CLI Reference

```bash
# Launch Studio UI
node bin/kaneflow.js studio [-p 4100] [-u http://localhost:3000] [-a ./my-app]

# Run a test spec with Kane CLI
node bin/kaneflow.js run [spec.md] [-u http://localhost:4101] [--headless]

# Execute autonomous self-healing loop
node bin/kaneflow.js heal [spec.md] [-u http://localhost:4101] [-a ./demo-app]

# Run 1-click showcase demo
node bin/kaneflow.js demo
```

---

## ⚖️ Core Engineering Standards & Architecture

* **Ships**: 100% working application and CLI. Zero simulations or mocks. Run `npm start` to test locally in 30 seconds.
* **Verified**: Real browser automation powered directly by `@testmuai/kane-cli` with NDJSON telemetry and DOM reasoning.
* **Closed Loop**: Complete autonomous loop: Red test failure $\rightarrow$ AST diagnosis $\rightarrow$ AI code patch $\rightarrow$ Kane re-verification $\rightarrow$ Green proof.
* **Craft**: Cyberpunk/Geist dark mode design, real-time WebSockets, live git diffs, custom AI model selector, and universal URL bar.

---

## 📄 License
MIT © 2026 KaneFlow Team • Powered by Kane CLI

