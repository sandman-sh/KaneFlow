/**
 * KaneFlow Universal Failure Diagnostics Engine
 * Extracts semantic failure reasons, DOM selectors, and affected files from Kane NDJSON
 * Supports ANY real-world codebase (React, Next.js, Vue, Svelte, Node, Vanilla JS/HTML).
 */

const fs = require('fs');
const path = require('path');

const SOURCE_EXTENSIONS = ['.js', '.jsx', '.ts', '.tsx', '.vue', '.svelte', '.html', '.css', '.mjs', '.cjs'];
const IGNORED_DIRS = ['node_modules', '.git', 'dist', 'build', '.next', '.testmuai', 'coverage', '.cache'];

class KaneDiagnostics {
  constructor(appDir = path.resolve(__dirname, '../../demo-app')) {
    this.appDir = appDir;
  }

  /**
   * Recursively find all source files in the project directory
   */
  findSourceFiles(dir = this.appDir, fileList = []) {
    try {
      if (!fs.existsSync(dir)) return fileList;
      const entries = fs.readdirSync(dir, { withFileTypes: true });

      for (const entry of entries) {
        if (IGNORED_DIRS.includes(entry.name)) continue;

        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          this.findSourceFiles(fullPath, fileList);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (SOURCE_EXTENSIONS.includes(ext)) {
            fileList.push(fullPath);
          }
        }
      }
    } catch (e) {
      // Fallback
    }
    return fileList;
  }

  /**
   * Diagnose a Kane execution failure across any codebase
   * @param {Object} executionResult 
   */
  diagnose(executionResult) {
    const errorText = executionResult.error || '';
    const failedStep = executionResult.failedStep ? (executionResult.failedStep.title || executionResult.failedStep) : '';
    const logs = (executionResult.rawLogs || []).join('\n');
    const combinedErrorContext = `${failedStep} ${errorText} ${logs}`;

    const diagnosis = {
      category: 'GENERAL_ASSERTION_FAILURE',
      summary: 'Kane browser assertion did not match expected state',
      rootCause: errorText || 'Kane CLI assertion failed during step execution',
      suggestedFile: 'app.js',
      confidence: 0.85,
      context: {
        failedStep,
        errorText,
        matchedKeywords: []
      },
      sourceCode: '',
      targetFilePath: ''
    };

    // 1. Extract key semantic tokens (words > 3 chars, selectors, functions)
    const tokens = (combinedErrorContext.match(/[a-zA-Z0-9_-]{3,}/g) || [])
      .map(t => t.toLowerCase())
      .filter(t => !['step', 'assert', 'action', 'true', 'false', 'null', 'undefined', 'running', 'passed', 'click', 'info', 'warn'].includes(t));

    const uniqueTokens = Array.from(new Set(tokens));
    diagnosis.context.matchedKeywords = uniqueTokens.slice(0, 10);

    // 2. Discover all source files in the target application directory
    const sourceFiles = this.findSourceFiles(this.appDir);

    let bestMatchFile = null;
    let highestScore = -1;

    for (const filePath of sourceFiles) {
      try {
        const relativePath = path.relative(this.appDir, filePath);
        const fileContent = fs.readFileSync(filePath, 'utf8').toLowerCase();
        let score = 0;

        // Score based on token matches in code
        for (const token of uniqueTokens) {
          if (fileContent.includes(token)) {
            score += 2;
          }
          if (relativePath.toLowerCase().includes(token)) {
            score += 4;
          }
        }

        // Favor main logic files (app.js, index.js, App.jsx, main.js, etc.)
        if (/^(app|index|main|page)\.(js|jsx|ts|tsx)$/i.test(path.basename(filePath))) {
          score += 1;
        }

        if (score > highestScore) {
          highestScore = score;
          bestMatchFile = filePath;
        }
      } catch (err) {
        // Skip unreadable file
      }
    }

    if (bestMatchFile) {
      diagnosis.targetFilePath = bestMatchFile;
      diagnosis.suggestedFile = path.relative(this.appDir, bestMatchFile).replace(/\\/g, '/');
      try {
        diagnosis.sourceCode = fs.readFileSync(bestMatchFile, 'utf8');
      } catch (e) {}
    } else {
      // Default fallback
      const defaultAppJs = path.join(this.appDir, 'app.js');
      if (fs.existsSync(defaultAppJs)) {
        diagnosis.targetFilePath = defaultAppJs;
        diagnosis.suggestedFile = 'app.js';
        diagnosis.sourceCode = fs.readFileSync(defaultAppJs, 'utf8');
      }
    }

    // 3. Classify error category
    const lowerContext = combinedErrorContext.toLowerCase();
    if (lowerContext.includes('filter') || lowerContext.includes('priority') || lowerContext.includes('urgent')) {
      diagnosis.category = 'FILTER_LOGIC_ERROR';
      diagnosis.summary = 'Filter predicate incorrectly filtering items or DOM cards';
      diagnosis.rootCause = `Filtering logic in ${diagnosis.suggestedFile} failed expected visibility criteria.`;
      diagnosis.confidence = 0.95;
    } else if (lowerContext.includes('count') || lowerContext.includes('stat') || lowerContext.includes('badge')) {
      diagnosis.category = 'STATE_COUNTER_ERROR';
      diagnosis.summary = 'Component counter or column state mismatch';
      diagnosis.rootCause = `State or DOM counter calculation in ${diagnosis.suggestedFile} differs from spec.`;
      diagnosis.confidence = 0.92;
    } else if (lowerContext.includes('modal') || lowerContext.includes('form') || lowerContext.includes('submit') || lowerContext.includes('input')) {
      diagnosis.category = 'FORM_HANDLING_ERROR';
      diagnosis.summary = 'Form submission, input handling, or modal display failed';
      diagnosis.rootCause = `Form or event listener logic in ${diagnosis.suggestedFile} failed execution.`;
      diagnosis.confidence = 0.90;
    }

    return diagnosis;
  }
}

module.exports = KaneDiagnostics;

