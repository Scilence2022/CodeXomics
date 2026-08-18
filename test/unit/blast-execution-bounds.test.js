import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';

function readSource(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function loadMethods(relativePath, signatures) {
  const source = readSource(relativePath);
  const bodies = signatures.map(signature => {
    const start = source.indexOf(`\n  ${signature} {`);
    if (start === -1) throw new Error(`Unable to locate ${signature} in ${relativePath}`);
    const end = source.indexOf('\n  }\n', start);
    if (end === -1) throw new Error(`Unable to bound ${signature} in ${relativePath}`);
    return source.slice(start + 1, end + 4);
  });
  // eslint-disable-next-line no-new-func -- loads real source methods into an isolated class
  return new Function(`return class Extracted {\n${bodies.join('\n')}\n}`)();
}

describe('local BLAST subprocess is time-bounded', () => {
  const source = readSource('src/main/ipc-handlers.js');

  it('passes a timeout and kill signal to execFile', () => {
    // The bug: execOptions carried only maxBuffer, so a stalled makeblastdb/blastn
    // never settled its promise and hung the caller indefinitely.
    expect(source).toMatch(/const execOptions = \{ maxBuffer: [^}]*timeout, killSignal: 'SIGKILL' \}/);
  });

  it('defines finite default and maximum command timeouts', () => {
    expect(source).toMatch(/BLAST_COMMAND_DEFAULT_TIMEOUT_MS = 10 \* 60 \* 1000/);
    expect(source).toMatch(/BLAST_COMMAND_MAX_TIMEOUT_MS = 60 \* 60 \* 1000/);
  });

  it('reports a killed process as a timeout rather than a generic crash', () => {
    expect(source).toMatch(/const timedOut = error\.killed === true \|\| error\.signal === 'SIGKILL'/);
    expect(source).toMatch(/timed out after \$\{timeout\} ms and was terminated/);
  });
});

describe('unattended mode blocks modal prompts', () => {
  const BlastManagerMethods = loadMethods('src/renderer/modules/BlastManager.js', [
    'static isUnattended()',
    'static setUnattended(enabled)',
  ]);

  afterEach(() => {
    delete globalThis.window;
  });

  beforeEach(() => {
    globalThis.window = {};
  });

  it('is off by default', () => {
    expect(BlastManagerMethods.isUnattended()).toBe(false);
  });

  it('reports unattended once enabled and restores the previous value', () => {
    const restore = BlastManagerMethods.setUnattended(true);
    expect(BlastManagerMethods.isUnattended()).toBe(true);

    restore();
    expect(BlastManagerMethods.isUnattended()).toBe(false);
  });

  it('nests without leaking state', () => {
    const outer = BlastManagerMethods.setUnattended(true);
    const inner = BlastManagerMethods.setUnattended(false);
    expect(BlastManagerMethods.isUnattended()).toBe(false);

    inner();
    expect(BlastManagerMethods.isUnattended()).toBe(true);

    outer();
    expect(BlastManagerMethods.isUnattended()).toBe(false);
  });

  it('denies the directory prompt instead of opening a blocking dialog', () => {
    const source = readSource('src/renderer/modules/BlastManager.js');
    // The dialog has no timeout, so in an unattended run it must never be reached.
    expect(source).toMatch(/if \(promptIfNeeded && BlastManager\.isUnattended\(\)\) \{/);
    expect(source).toMatch(/return \{ approved: false, path: null, unattended: true \}/);
    // The guard must precede the showDirectoryDialog call.
    expect(source.indexOf('BlastManager.isUnattended()')).toBeLessThan(source.indexOf('api.showDirectoryDialog('));
  });
});

describe('online BLAST honours one overall deadline', () => {
  const source = readSource('src/renderer/modules/BlastManager.js');

  it('anchors an absolute deadline instead of a per-attempt budget', () => {
    expect(source).toMatch(/async executeNCBIBlast\(params, retryCount = 0, deadline = null, existingJob = null\)/);
    expect(source).toMatch(
      /const effectiveDeadline = deadline \?\? Date\.now\(\) \+ Number\(this\.config\?\.maxWaitTime/
    );
  });

  it('refuses to retry past the deadline', () => {
    expect(source).toMatch(/if \(Date\.now\(\) \+ delay < effectiveDeadline\) \{/);
    // The retry carries the submitted job forward so a poll failure resumes the
    // existing RID rather than resubmitting; the deadline argument is unchanged.
    expect(source).toMatch(/return this\.executeNCBIBlast\(params, retryCount \+ 1, effectiveDeadline, submittedJob\)/);
  });

  it('makes the nested submission retry loop deadline-aware', () => {
    // submitNCBIBlastJobWithRetry retries twice inside executeNCBIBlast's own three
    // retries. Without a deadline check a network outage multiplies out to ~9 submit
    // attempts and overruns the overall budget.
    expect(source).toMatch(/async submitNCBIBlastJobWithRetry\(params, retryCount = 0, deadline = null\)/);
    expect(source).toMatch(/if \(!deadline \|\| Date\.now\(\) \+ delay < deadline\)/);
    expect(source).toMatch(/submitNCBIBlastJobWithRetry\(params, retryCount \+ 1, deadline\)/);
    expect(source).toMatch(/async submitNCBIBlastJob\(params, deadline = null\)/);
    // The overall deadline must reach the submit path from executeNCBIBlast.
    expect(source).toMatch(/submitNCBIBlastJobWithRetry\(params, retryCount, effectiveDeadline\)/);
  });

  it('stops polling once the deadline passes', () => {
    expect(source).toMatch(/if \(Date\.now\(\) >= effectiveDeadline\) \{/);
    expect(source).toMatch(/NCBI BLAST timed out after \$\{maxWaitTime\} ms waiting for RID/);
  });

  it('clamps the NCBI RTOE hint so it cannot outlast the deadline', () => {
    expect(source).toMatch(/Math\.min\(initialDelayMs, effectiveDeadline - Date\.now\(\)\)/);
  });

  it('routes every NCBI request through an abortable fetch', () => {
    expect(source).toMatch(/async fetchWithDeadline\(url, options = \{\}, deadline = null\)/);
    expect(source).toMatch(/controller\.abort\(\)/);
    // Exactly one bare fetch() may remain: the one inside fetchWithDeadline itself,
    // which is the call carrying the abort signal. Every other call site must go
    // through the helper.
    const bareFetches = source.match(/(?<!\.)\bawait fetch\(/g) || [];
    expect(bareFetches).toHaveLength(1);
    expect(source).toMatch(/return await fetch\(url, \{ \.\.\.options, signal: controller\.signal \}\)/);
  });
});

describe('call-only benchmark mode', () => {
  const source = readSource('src/renderer/modules/chat/services/ToolExecutionService.js');

  it('short-circuits before dispatch for tools in the call-only set', () => {
    expect(source).toMatch(/if \(this\.chatManager\?\.callOnlyTools\?\.has\(toolName\)\) \{/);
    expect(source).toMatch(/callOnly: true/);
    expect(source).toMatch(/executed: false/);
    // Must be decided before the tool is dispatched.
    expect(source.indexOf('callOnlyTools?.has(toolName)')).toBeLessThan(source.indexOf('async _dispatch('));
  });

  it('records in-flight executions so a running status exists at all', () => {
    // recordExecutionStart previously had no callers, which made every 'running'-based
    // check (benchmark earlyReturn) permanently unmatchable.
    expect(source).toMatch(/recordExecutionStart\?\.\(toolName, parameters\)/);
    expect(source).toMatch(/recordExecutionSuccess\?\.\(executionId, result\)/);
    expect(source).toMatch(/recordExecutionFailure\?\.\(executionId, error\)/);
  });

  it('only tracks while a session is open, so ordinary chat does not grow the record map', () => {
    expect(source).toMatch(/toolExecutionTracker\?\.currentSessionId/);
  });

  it('treats a returned { success: false } as a failure, not a completion', () => {
    expect(source).toMatch(/result\.success === false/);
    expect(source).toMatch(/recordExecutionFailure\?\.\(executionId, new Error\(result\.error/);
  });
});

describe('the two BLAST benchmark tests assert on the call', () => {
  const source = readSource('src/renderer/modules/benchmark-suites/AutomaticSimpleSuite.js');

  it('marks both long-running BLAST tests call-only', () => {
    const quickDb = source.slice(source.indexOf("id: 'blast_auto_03'"), source.indexOf("id: 'blast_auto_04'"));
    const currentRegion = source.slice(source.indexOf("id: 'blast_auto_05'"));

    expect(quickDb).toMatch(/assertCallOnly: true/);
    expect(currentRegion.slice(0, 1200)).toMatch(/assertCallOnly: true/);
  });

  it('names the expected tool in the ambiguous quick-db instruction', () => {
    const quickDb = source.slice(source.indexOf("id: 'blast_auto_03'"), source.indexOf("id: 'blast_auto_04'"));
    expect(quickDb).toMatch(/using blast_create_quick_db_for_current_genome/);
  });
});

describe('framework wiring for call-only and unattended mode', () => {
  const source = readSource('src/renderer/modules/LLMBenchmarkFramework.js');

  it('applies and restores both modes around each test', () => {
    expect(source).toMatch(/const restoreCallOnly = this\.applyCallOnlyMode\(test\)/);
    expect(source).toMatch(/window\.BlastManager\.setUnattended\(true\)/);
    expect(source).toMatch(/restoreCallOnly\(\);\n\s*restoreUnattended\(\);/);
  });

  it('is a no-op for tests that did not opt in', () => {
    const Framework = loadMethods('src/renderer/modules/LLMBenchmarkFramework.js', ['applyCallOnlyMode(test)']);
    const framework = new Framework();
    framework.chatManager = {};

    framework.applyCallOnlyMode({ id: 't', expectedResult: { tool_name: 'x' } })();

    expect(framework.chatManager.callOnlyTools).toBeUndefined();
  });

  it('registers the expected tool and restores the previous set', () => {
    const Framework = loadMethods('src/renderer/modules/LLMBenchmarkFramework.js', ['applyCallOnlyMode(test)']);
    const framework = new Framework();
    framework.chatManager = {};

    const restore = framework.applyCallOnlyMode({
      id: 'blast_auto_05',
      assertCallOnly: true,
      expectedResult: { tool_name: 'blast_sequence_from_region' },
    });

    expect(framework.chatManager.callOnlyTools.has('blast_sequence_from_region')).toBe(true);

    restore();
    expect(framework.chatManager.callOnlyTools).toBeUndefined();
  });

  it('supports tool_sequence tests', () => {
    const Framework = loadMethods('src/renderer/modules/LLMBenchmarkFramework.js', ['applyCallOnlyMode(test)']);
    const framework = new Framework();
    framework.chatManager = {};

    framework.applyCallOnlyMode({
      id: 'wf',
      assertCallOnly: true,
      expectedResult: { tool_sequence: ['a_tool', 'b_tool'] },
    });

    expect([...framework.chatManager.callOnlyTools]).toEqual(['a_tool', 'b_tool']);
  });
});
