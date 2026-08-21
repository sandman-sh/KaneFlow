#!/usr/bin/env node

const { Command } = require('commander');
const pc = require('picocolors');
const path = require('path');
const KaneStudioServer = require('../src/server/studio-server');
const TargetAppServer = require('../src/server/target-server');
const KaneRunner = require('../src/runner/kane-runner');
const KaneHealer = require('../src/agent/healer');

const program = new Command();

program
  .name('kaneflow')
  .description('Autonomous Spec-Driven DevLoop & Self-Healing Engine powered by Kane CLI')
  .version('1.0.0');

// 1. Studio Command
program
  .command('studio')
  .alias('ui')
  .alias('dev')
  .description('Launch the KaneFlow Live Studio & Dev Server')
  .option('-p, --port <number>', 'Studio web port', 4100)
  .option('-t, --target-port <number>', 'Target demo app port', 4101)
  .option('-u, --target-url <url>', 'Target application URL (e.g. http://localhost:3000 or https://example.com)')
  .option('-a, --app-dir <dir>', 'Target application source code directory')
  .action(async (options) => {
    console.log(pc.cyan(pc.bold('\n⚡ KaneFlow Studio — Autonomous DevLoop Engine')));
    console.log(pc.gray('──────────────────────────────────────────────────────'));
    
    const targetUrl = options.targetUrl || `http://localhost:${options.targetPort || 4101}`;
    const appDir = options.appDir ? path.resolve(process.cwd(), options.appDir) : path.resolve(__dirname, '../demo-app');

    const studio = new KaneStudioServer({
      port: parseInt(options.port, 10),
      targetPort: parseInt(options.targetPort, 10),
      targetUrl,
      appDir
    });

    await studio.start();
    console.log(pc.green(`\n✓ KaneFlow Studio is live!`));
    console.log(`  ${pc.bold('Studio UI:')}   ${pc.underline(pc.cyan(`http://localhost:${options.port}`))}`);
    console.log(`  ${pc.bold('Target App:')}  ${pc.underline(pc.cyan(targetUrl))}`);
    console.log(`  ${pc.bold('Codebase:')}    ${pc.gray(appDir)}`);
    console.log(pc.gray('\nPress Ctrl+C to stop.\n'));

    const cleanup = async () => {
      console.log(pc.yellow('\nStopping KaneFlow Studio...'));
      await studio.stop();
      process.exit(0);
    };

    process.on('SIGINT', cleanup);
    process.on('SIGTERM', cleanup);

    // Keep daemon process active
    await new Promise(() => {});
  });

// 2. Run Spec Command
program
  .command('run [specOrObjective]')
  .description('Run Kane CLI verification against any target application or URL')
  .option('-u, --url <url>', 'Target application URL (default: http://localhost:4101)', 'http://localhost:4101')
  .option('--headless', 'Run browser in headless mode', true)
  .option('--no-headless', 'Run browser in headed visual mode')
  .action(async (specOrObjective = 'specs/task_creation_test.md', options) => {
    console.log(pc.cyan(pc.bold('\n🔍 KaneFlow Verification Runner')));
    console.log(pc.gray(`Target Spec / Objective: ${specOrObjective}`));
    console.log(pc.gray(`Target URL: ${options.url}`));

    let targetServer = null;
    if (options.url.includes('localhost:4101') || options.url.includes('127.0.0.1:4101')) {
      targetServer = new TargetAppServer(4101);
      await targetServer.start();
    }

    const runner = new KaneRunner({
      cwd: path.resolve(__dirname, '..'),
      headless: options.headless
    });

    runner.on('step', (step) => {
      console.log(pc.blue(`  › ${step.title} `) + pc.gray(`[${step.status}]`));
    });

    runner.on('log', (log) => {
      if (log.level === 'warn') {
        console.log(pc.yellow(`    ! ${log.message}`));
      }
    });

    const result = await runner.run(specOrObjective, { url: options.url });
    if (targetServer) await targetServer.stop();

    console.log(pc.gray('──────────────────────────────────────────────────────'));
    if (result.success) {
      console.log(pc.green(pc.bold(`✓ PASS — Kane verified all assertions in ${result.durationMs}ms`)));
      process.exit(0);
    } else {
      console.log(pc.red(pc.bold(`✗ FAIL — Kane caught failure: ${result.error || 'Assertion failed'}`)));
      process.exit(1);
    }
  });

// 3. Autonomous Heal Command
program
  .command('heal [specOrObjective]')
  .description('Execute autonomous closed-loop healing (Test -> Fail -> Diagnose -> Patch -> Verify -> Green)')
  .option('-u, --url <url>', 'Target application URL (default: http://localhost:4101)', 'http://localhost:4101')
  .option('-a, --app-dir <dir>', 'Target application codebase directory', path.resolve(__dirname, '../demo-app'))
  .action(async (specOrObjective = 'specs/priority_filter_test.md', options) => {
    console.log(pc.magenta(pc.bold('\n🧬 KaneFlow Autonomous Self-Healing Engine')));
    console.log(pc.gray(`Target Spec / Objective: ${specOrObjective}`));
    console.log(pc.gray(`Target URL: ${options.url}`));
    console.log(pc.gray(`App Directory: ${options.appDir}`));
    console.log(pc.gray('──────────────────────────────────────────────────────'));

    let targetServer = null;
    if (options.url.includes('localhost:4101') || options.url.includes('127.0.0.1:4101')) {
      targetServer = new TargetAppServer(4101);
      await targetServer.start();
    }

    const appDir = path.isAbsolute(options.appDir) ? options.appDir : path.resolve(process.cwd(), options.appDir);
    const healer = new KaneHealer({
      appDir
    });

    healer.on('timeline', (event) => {
      const time = pc.gray(new Date(event.timestamp).toLocaleTimeString());
      if (event.type === 'INITIAL_RUN' || event.type === 'REVERIFYING') {
        console.log(`\n${time} ${pc.cyan(pc.bold('▶ ' + event.type))}: ${event.message}`);
      } else if (event.type === 'KANE_FAILED') {
        console.log(`${time} ${pc.red(pc.bold('🔴 ' + event.type))}: ${event.message}`);
      } else if (event.type === 'DIAGNOSING' || event.type === 'DIAGNOSIS_COMPLETE') {
        console.log(`${time} ${pc.yellow(pc.bold('🧠 ' + event.type))}: ${event.message}`);
      } else if (event.type === 'APPLYING_PATCH') {
        console.log(`${time} ${pc.magenta(pc.bold('🛠️ ' + event.type))}: ${event.message}`);
        if (event.data && event.data.diff) {
          console.log(pc.gray('\n--- Unified Diff ---'));
          console.log(event.data.diff);
          console.log(pc.gray('--------------------\n'));
        }
      } else if (event.type === 'LOOP_CLOSED_GREEN' || event.type === 'ALREADY_GREEN') {
        console.log(`${time} ${pc.green(pc.bold('🟢 ' + event.type))}: ${event.message}`);
      }
    });

    const result = await healer.heal(specOrObjective, { url: options.url, appDir });
    if (targetServer) await targetServer.stop();

    console.log(pc.gray('──────────────────────────────────────────────────────'));
    if (result.success) {
      console.log(pc.green(pc.bold(`\n🎉 CLOSED LOOP SEALED GREEN`)));
      console.log(pc.cyan(`Total Iterations: ${result.iterations}`));
      process.exit(0);
    } else {
      console.log(pc.red(pc.bold(`\n✗ Loop could not resolve all failures automatically.`)));
      process.exit(1);
    }
  });

// 4. Demo Command
program
  .command('demo')
  .description('Run full end-to-end demo showcase: Injects bug and executes autonomous heal')
  .action(async () => {
    console.log(pc.yellow(pc.bold('\n🎬 Starting KaneFlow Showcase Demo...')));
    const studioServer = new KaneStudioServer();
    // Inject bug into demo app
    const appJsPath = path.resolve(__dirname, '../demo-app/app.js');
    const fs = require('fs');
    let code = fs.readFileSync(appJsPath, 'utf8');
    code = code.replace(
      /matchesFilter\s*\(task\)\s*\{/g,
      `matchesFilter(task) {\n    // Injected Demo Bug: breaks priority filtering\n    if (this.currentFilter !== 'all') return false;`
    );
    fs.writeFileSync(appJsPath, code, 'utf8');
    console.log(pc.red('🐞 Injected regression bug into demo-app/app.js (Priority Filter Broken)'));

    // Now invoke heal
    const targetServer = new TargetAppServer(4101);
    await targetServer.start();

    const healer = new KaneHealer({ appDir: path.resolve(__dirname, '../demo-app') });
    healer.on('timeline', (ev) => {
      console.log(`${pc.gray(ev.type)}: ${ev.message}`);
    });

    const result = await healer.heal('specs/priority_filter_test.md');
    await targetServer.stop();

    if (result.success) {
      console.log(pc.green(pc.bold('\n✓ Demo finished successfully! Bug caught by Kane, repaired by Agent, and verified Green.')));
    }
  });

program.parse(process.argv);
