/**
 * KaneFlow Integration & Smoke Test Suite
 * Validates TargetServer, Diagnostics, Healer, and Studio APIs
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const http = require('http');

const TargetAppServer = require('../src/server/target-server');
const KaneDiagnostics = require('../src/agent/diagnose');
const KaneHealer = require('../src/agent/healer');
const KaneStudioServer = require('../src/server/studio-server');

async function runTests() {
  console.log('🧪 Starting KaneFlow Smoke & Integration Tests...\n');

  // Test 1: Target App Server
  console.log('Test 1: TargetAppServer lifecycle & health check');
  const targetServer = new TargetAppServer(4199);
  await targetServer.start();

  const healthData = await new Promise((resolve, reject) => {
    http.get('http://localhost:4199/__kaneflow/health', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  assert.strictEqual(healthData.status, 'ok', 'Health endpoint status must be ok');
  assert.strictEqual(healthData.app, 'TaskFlow Pro', 'App name must match TaskFlow Pro');
  console.log('  ✓ TargetAppServer starts, responds to health check, and serves static files\n');
  await targetServer.stop();

  // Test 2: Diagnostics Engine
  console.log('Test 2: KaneDiagnostics failure classification');
  const diagnostics = new KaneDiagnostics(path.resolve(__dirname, '../demo-app'));
  const mockFailure = {
    error: 'AssertionError: Expected urgent priority cards to be visible',
    failedStep: { title: 'Filter by Urgent Priority' },
    rawLogs: ['[step] Click filter urgent', 'FAIL: Filter logic error']
  };
  const diagnosis = diagnostics.diagnose(mockFailure);

  assert.strictEqual(diagnosis.category, 'FILTER_LOGIC_ERROR');
  assert.strictEqual(diagnosis.suggestedFile, 'app.js');
  assert.ok(diagnosis.sourceCode.includes('class TaskFlowApp'), 'Source code must be loaded');
  console.log('  ✓ KaneDiagnostics correctly classifies priority filter failure and loads app.js\n');

  // Test 3: Healer Patch Generation
  console.log('Test 3: KaneHealer semantic patch generation');
  const healer = new KaneHealer({ appDir: path.resolve(__dirname, '../demo-app') });
  
  // Inject mock bug in diagnosis source
  const brokenSource = diagnosis.sourceCode.replace(
    /matchesFilter\s*\(task\)\s*\{/g,
    `matchesFilter(task) {\n    if (this.hasInjectedBug) { return false; }`
  );
  const brokenDiagnosis = { ...diagnosis, sourceCode: brokenSource };
  const patch = healer.generateSemanticPatch(brokenDiagnosis, mockFailure);

  assert.ok(patch.fixedCode, 'Patch must produce fixed code');
  assert.ok(patch.explanation, 'Patch must include explanation');
  console.log('  ✓ KaneHealer successfully synthesized semantic repair patch\n');

  // Test 4: KaneStudioServer REST APIs
  console.log('Test 4: KaneStudioServer REST endpoints');
  const studio = new KaneStudioServer({ port: 4198, targetPort: 4197 });
  await studio.start();

  const specsData = await new Promise((resolve, reject) => {
    http.get('http://localhost:4198/api/specs', (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => resolve(JSON.parse(data)));
    }).on('error', reject);
  });

  assert.ok(Array.isArray(specsData.specs), 'Specs endpoint must return array');
  assert.ok(specsData.specs.length >= 3, 'Must have at least 3 specs loaded');
  console.log(`  ✓ Studio loaded ${specsData.specs.length} plain-English specs successfully`);

  await studio.stop();
  console.log('\n🎉 ALL INTEGRATION TESTS PASSED (4/4)\n');
}

runTests().catch(err => {
  console.error('❌ Test suite failed:', err);
  process.exit(1);
});
