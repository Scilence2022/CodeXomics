import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

function loadMethod(relativePath, signatures) {
  const source = fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
  const bodies = [].concat(signatures).map(signature => {
    const start = source.indexOf(`\n  ${signature} {`);
    if (start === -1) throw new Error(`Unable to locate ${signature} in ${relativePath}`);
    const end = source.indexOf('\n  }\n', start);
    if (end === -1) throw new Error(`Unable to bound ${signature} in ${relativePath}`);
    return source.slice(start + 1, end + 4);
  });
  // eslint-disable-next-line no-new-func -- loads the real source method into an isolated class
  return new Function(`return class Extracted {\n${bodies.join('\n')}\n}`)();
}

const TIMEOUT_METHODS = [
  'findEarlyReturnSubmission(test, error)',
  'abortTimedOutConversation(test, error)',
  'isTestTimeoutError(error)',
];

function makeFramework(executions) {
  const Framework = loadMethod('src/renderer/modules/LLMBenchmarkFramework.js', TIMEOUT_METHODS);
  const framework = new Framework();
  framework.chatManager = {
    toolExecutionTracker: {
      getTestExecutions: () => executions,
    },
  };
  return framework;
}

const timeout = new Error('Test timeout after 180000ms');

describe('earlyReturn tests that outlive their timeout', () => {
  const blastTest = {
    id: 'blast_auto_05',
    earlyReturn: true,
    expectedResult: { tool_name: 'blast_sequence_from_region' },
  };

  it('scores a still-running expected tool as submitted', () => {
    const framework = makeFramework([{ toolName: 'blast_sequence_from_region', status: 'running' }]);

    const submitted = framework.findEarlyReturnSubmission(blastTest, timeout);

    expect(submitted).toMatchObject({ toolName: 'blast_sequence_from_region' });
  });

  it('accepts a completed execution too', () => {
    const framework = makeFramework([{ toolName: 'blast_sequence_from_region', status: 'completed' }]);

    expect(framework.findEarlyReturnSubmission(blastTest, timeout)).not.toBeNull();
  });

  it('does not rescue a timeout when the expected tool was never submitted', () => {
    const framework = makeFramework([{ toolName: 'get_current_state', status: 'running' }]);

    expect(framework.findEarlyReturnSubmission(blastTest, timeout)).toBeNull();
  });

  it('does not rescue a failed execution', () => {
    const framework = makeFramework([{ toolName: 'blast_sequence_from_region', status: 'failed' }]);

    expect(framework.findEarlyReturnSubmission(blastTest, timeout)).toBeNull();
  });

  it('leaves non-earlyReturn timeouts failing', () => {
    const framework = makeFramework([{ toolName: 'blast_sequence_from_region', status: 'running' }]);
    const strictTest = { ...blastTest, earlyReturn: false };

    expect(framework.findEarlyReturnSubmission(strictTest, timeout)).toBeNull();
  });

  it('leaves genuine (non-timeout) errors failing', () => {
    const framework = makeFramework([{ toolName: 'blast_sequence_from_region', status: 'running' }]);

    expect(framework.findEarlyReturnSubmission(blastTest, new Error('BLAST binary not found'))).toBeNull();
  });

  it('supports workflow tests declared with a tool_sequence', () => {
    const framework = makeFramework([{ toolName: 'blast_create_quick_db_for_current_genome', status: 'running' }]);
    const workflowTest = {
      id: 'blast_auto_03',
      earlyReturn: true,
      expectedResult: { tool_sequence: ['blast_create_quick_db_for_current_genome', 'blast_search_local'] },
    };

    expect(framework.findEarlyReturnSubmission(workflowTest, timeout)).not.toBeNull();
  });

  it('is inert when no tracker is available', () => {
    const Framework = loadMethod('src/renderer/modules/LLMBenchmarkFramework.js', TIMEOUT_METHODS);
    const framework = new Framework();
    framework.chatManager = null;

    expect(framework.findEarlyReturnSubmission(blastTest, timeout)).toBeNull();
  });
});

describe('cancelling the conversation a timed-out test left running', () => {
  // Promise.race abandons the losing promise, it does not stop it. A model still
  // looping over tool calls keeps executing them into the tests that follow.
  const makeChatManager = () => {
    const chatManager = {
      conversationState: { isProcessing: true, abortController: { abort: () => {} } },
      aborted: 0,
      abortCurrentConversation() {
        this.aborted++;
        this.conversationState.isProcessing = false;
      },
    };
    return chatManager;
  };

  const makeFrameworkFor = chatManager => {
    const Framework = loadMethod('src/renderer/modules/LLMBenchmarkFramework.js', TIMEOUT_METHODS);
    const framework = new Framework();
    framework.chatManager = chatManager;
    return framework;
  };

  const test = { id: 'protein_auto_complex_02' };

  it('aborts a conversation still processing after the timeout', () => {
    const chatManager = makeChatManager();

    makeFrameworkFor(chatManager).abortTimedOutConversation(test, timeout);

    expect(chatManager.aborted).toBe(1);
    expect(chatManager.conversationState.isProcessing).toBe(false);
  });

  it('leaves a finished conversation alone', () => {
    const chatManager = makeChatManager();
    chatManager.conversationState.isProcessing = false;

    makeFrameworkFor(chatManager).abortTimedOutConversation(test, timeout);

    expect(chatManager.aborted).toBe(0);
  });

  it('does not abort on a genuine (non-timeout) error', () => {
    const chatManager = makeChatManager();

    makeFrameworkFor(chatManager).abortTimedOutConversation(test, new Error('BLAST binary not found'));

    expect(chatManager.aborted).toBe(0);
  });

  it('falls back to the abort controller when no abort method exists', () => {
    let aborted = 0;
    const chatManager = {
      conversationState: { isProcessing: true, abortController: { abort: () => aborted++ } },
    };

    makeFrameworkFor(chatManager).abortTimedOutConversation(test, timeout);

    expect(aborted).toBe(1);
  });

  it('is inert without a chat manager', () => {
    expect(() => makeFrameworkFor(null).abortTimedOutConversation(test, timeout)).not.toThrow();
  });
});

describe('advanced_uniprot_search parameter normalization', () => {
  const load = () =>
    new (loadMethod(
      'src/renderer/modules/chat/services/ProteinService.js',
      'normalizeAdvancedUniprotParameters(parameters)'
    ))();

  it('flattens the nested snake_case shape models actually emit', () => {
    // Verbatim payload from the failing benchmark run.
    const normalized = load().normalizeAdvancedUniprotParameters({
      query_fields: { protein_name: 'beta-galactosidase', organism: 'Escherichia coli' },
      boolean_operator: 'AND',
      filters: { reviewed_only: true },
      max_results: 10,
    });

    expect(normalized).toMatchObject({
      proteinName: 'beta-galactosidase',
      organism: 'Escherichia coli',
      reviewedOnly: true,
      limit: 10,
    });
  });

  it('still accepts the declared camelCase schema', () => {
    const normalized = load().normalizeAdvancedUniprotParameters({
      proteinName: 'beta-galactosidase',
      geneName: 'lacZ',
      reviewedOnly: true,
      limit: 5,
    });

    expect(normalized).toMatchObject({
      proteinName: 'beta-galactosidase',
      geneName: 'lacZ',
      reviewedOnly: true,
      limit: 5,
    });
  });

  it('joins array keywords and defaults the limit', () => {
    const normalized = load().normalizeAdvancedUniprotParameters({ keywords: ['hydrolase', 'glycosidase'] });

    expect(normalized.keywords).toBe('hydrolase glycosidase');
    expect(normalized.limit).toBe(20);
  });

  it('yields no query fields for an empty call so the caller still errors', () => {
    const normalized = load().normalizeAdvancedUniprotParameters({});

    expect(normalized.proteinName).toBeUndefined();
    expect(normalized.geneName).toBeUndefined();
    expect(normalized.organism).toBeUndefined();
  });
});
