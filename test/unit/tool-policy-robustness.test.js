/**
 * Tool Policy Robustness Tests
 */
/* eslint-disable no-new-func, max-len */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function evaluateRendererGlobal(relativePath, globalName) {
  const filePath = path.join(process.cwd(), relativePath);
  const content = fs.readFileSync(filePath, 'utf-8');
  const fn = new Function(`${content}; return globalThis.${globalName};`);
  return fn();
}

function loadPolicySupport() {
  evaluateRendererGlobal('src/renderer/modules/chat/services/ToolCapabilityPolicy.js', 'ToolCapabilityPolicy');
  evaluateRendererGlobal('src/renderer/modules/chat/services/ToolExecutionPolicy.js', 'ToolExecutionPolicy');
}

// Helper to load LLMContextService in a node-compatible way
function loadLLMContextServiceClass() {
  loadPolicySupport();

  const servicePath = path.join(process.cwd(), 'src/renderer/modules/chat/services/LLMContextService.js');
  let content = fs.readFileSync(servicePath, 'utf-8');
  // Strip window assignment to avoid JSDOM/window requirements
  content = content.replace('window.LLMContextService = LLMContextService;', '');

  // Wrap in a function that returns the class
  const fn = new Function('global', `${content}; return LLMContextService;`);
  return fn({});
}

function loadToolExecutionServiceClass() {
  const servicePath = path.join(process.cwd(), 'src/renderer/modules/chat/services/ToolExecutionService.js');
  const content = fs.readFileSync(servicePath, 'utf-8');
  const fn = new Function('window', `${content}; return ToolExecutionService;`);
  return fn({});
}

// Helper to load ChatManager in a node-compatible way
function loadChatManagerClass() {
  const managerPath = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');
  const content = fs.readFileSync(managerPath, 'utf-8');

  // ChatManager has various browser/electron-specific dependencies at the top,
  // so we extract only the helper methods we want to test.

  // We can construct a mock class containing these methods
  const cloneToolParametersMatch = content.match(
    /cloneToolParameters\s*\(parameters\s*=\s*\{\}\)\s*\{[\s\S]*?\}\n\n\s*normalizeToolParams/
  );
  const normalizeToolParamsMatch = content.match(
    /normalizeToolParams\s*\(toolName,\s*parameters\s*=\s*\{\}\)\s*\{[\s\S]*?\}\n\n\s*getToolExecutionKey/
  );
  const getToolExecutionKeyMatch = content.match(
    /getToolExecutionKey\s*\(toolName,\s*parameters\s*=\s*\{\}\)\s*\{[\s\S]*?\}\n\n\s*getRequestedToolExecutionLimit/
  );
  const getRequestedToolExecutionLimitMatch = content.match(
    /\n\s{2}getRequestedToolExecutionLimit\s*\(originalMessage,\s*tool\)\s*\{[\s\S]*?\}\n\n\s{2}createToolExecutionState/
  );
  const toolExecutionStateMethodsMatch = content.match(
    /\n\s{2}createToolExecutionState\s*\(originalMessage\)\s*\{[\s\S]*?\}\n\n\s{2}createPendingToolExecutionQueue/
  );
  const createPendingToolExecutionQueueMatch = content.match(
    /\n\s{2}createPendingToolExecutionQueue\s*\([\s\S]*?\n\s{2}\}\n\n\s{2}filterExecutableToolInstances/
  );
  const filterExecutableToolInstancesMatch = content.match(
    /\n\s{2}filterExecutableToolInstances\s*\(toolsToExecute,\s*successfulToolExecutionCounts,\s*originalMessage\)\s*\{[\s\S]*?\}\n\n\s{2}async executePendingToolExecutionQueue/
  );
  const executePendingToolExecutionQueueMatch = content.match(
    /\n\s{2}async executePendingToolExecutionQueue\s*\(pendingToolExecutionQueue\)\s*\{[\s\S]*?\}\n\n\s{2}normalizeParams/
  );
  const normalizeParamsMatch = content.match(/normalizeParams\s*\(params\)\s*\{[\s\S]*?\}\n\n\s*areParametersEqual/);
  const areParametersEqualMatch = content.match(
    /areParametersEqual\s*\(params1,\s*params2\)\s*\{[\s\S]*?\}\n\n\s*\/\*\*/
  );
  const areToolParametersEqualMatch = content.match(
    /areToolParametersEqual\s*\(toolName,\s*params1,\s*params2\)\s*\{[\s\S]*?\}\n\n\s*\/\*\*/
  );
  const extractParametersMatch = content.match(
    /extractParametersFromExecutionMessage\s*\(content\)\s*\{[\s\S]*?\}\n\n\s*\/\*\*/
  );
  const wasToolExecutedSuccessfullyMatch = content.match(
    /wasToolExecutedSuccessfully\s*\(toolKey,\s*conversationHistory\)\s*\{[\s\S]*?\}\n\n\s*\/\*\*/
  );
  const getToolExecutionCountMatch = content.match(
    /getToolExecutionCount\s*\(toolKey,\s*conversationHistory\)\s*\{[\s\S]*?\}\n\n\s*\/\*\*/
  );
  const findExistingExecutionMatch = content.match(
    /findExistingExecution\s*\(toolKey,\s*conversationHistory\)\s*\{[\s\S]*?\}\n\n\s*\/\*\*/
  );

  const cloneToolParametersCode = cloneToolParametersMatch
    ? cloneToolParametersMatch[0].replace('normalizeToolParams', '')
    : '';
  const normalizeToolParamsCode = normalizeToolParamsMatch
    ? normalizeToolParamsMatch[0].replace('getToolExecutionKey', '')
    : '';
  const getToolExecutionKeyCode = getToolExecutionKeyMatch
    ? getToolExecutionKeyMatch[0].replace('getRequestedToolExecutionLimit', '')
    : '';
  const getRequestedToolExecutionLimitCode = getRequestedToolExecutionLimitMatch
    ? getRequestedToolExecutionLimitMatch[0].replace(/\n\n\s{2}createToolExecutionState$/, '')
    : '';
  const toolExecutionStateMethodsCode = toolExecutionStateMethodsMatch
    ? toolExecutionStateMethodsMatch[0].replace(/\n\n\s{2}createPendingToolExecutionQueue$/, '')
    : '';
  const createPendingToolExecutionQueueCode = createPendingToolExecutionQueueMatch
    ? createPendingToolExecutionQueueMatch[0].replace(/\n\n\s{2}filterExecutableToolInstances$/, '')
    : '';
  const filterExecutableToolInstancesCode = filterExecutableToolInstancesMatch
    ? filterExecutableToolInstancesMatch[0].replace(/\n\n\s{2}async executePendingToolExecutionQueue$/, '')
    : '';
  const executePendingToolExecutionQueueCode = executePendingToolExecutionQueueMatch
    ? executePendingToolExecutionQueueMatch[0].replace(/\n\n\s{2}normalizeParams$/, '')
    : '';
  const normalizeParamsCode = normalizeParamsMatch ? normalizeParamsMatch[0].replace('areParametersEqual', '') : '';
  const areParametersEqualCode = areParametersEqualMatch ? areParametersEqualMatch[0].replace('/**', '') : '';
  const areToolParametersEqualCode = areToolParametersEqualMatch
    ? areToolParametersEqualMatch[0].replace('/**', '')
    : '';
  const extractParametersCode = extractParametersMatch ? extractParametersMatch[0].replace('/**', '') : '';
  const wasToolExecutedSuccessfullyCode = wasToolExecutedSuccessfullyMatch
    ? wasToolExecutedSuccessfullyMatch[0].replace('/**', '')
    : '';
  const getToolExecutionCountCode = getToolExecutionCountMatch ? getToolExecutionCountMatch[0].replace('/**', '') : '';
  const findExistingExecutionCode = findExistingExecutionMatch ? findExistingExecutionMatch[0].replace('/**', '') : '';

  const mockClassCode = `
    class MockChatManager {
      ${cloneToolParametersCode}
      ${normalizeToolParamsCode}
      ${getToolExecutionKeyCode}
      ${getRequestedToolExecutionLimitCode}
      ${toolExecutionStateMethodsCode}
      ${createPendingToolExecutionQueueCode}
      ${filterExecutableToolInstancesCode}
      ${executePendingToolExecutionQueueCode}
      ${normalizeParamsCode}
      ${areParametersEqualCode}
      ${areToolParametersEqualCode}
      ${extractParametersCode}
      ${wasToolExecutedSuccessfullyCode}
      ${getToolExecutionCountCode}
      ${findExistingExecutionCode}
    }
    return MockChatManager;
  `;

  const fn = new Function(mockClassCode);
  return fn();
}

describe('Tool Policy - Parameter Normalization and Matching', () => {
  const LLMContextService = loadLLMContextServiceClass();
  const ToolExecutionService = loadToolExecutionServiceClass();
  const MockChatManager = loadChatManagerClass();

  it('should keep execution policies in dedicated hardcoded policy classes', () => {
    const contextSource = fs.readFileSync(
      path.join(process.cwd(), 'src/renderer/modules/chat/services/LLMContextService.js'),
      'utf8'
    );
    const capabilitySource = fs.readFileSync(
      path.join(process.cwd(), 'src/renderer/modules/chat/services/ToolCapabilityPolicy.js'),
      'utf8'
    );
    const executionSource = fs.readFileSync(
      path.join(process.cwd(), 'src/renderer/modules/chat/services/ToolExecutionPolicy.js'),
      'utf8'
    );

    expect(contextSource).toContain('getToolExecutionPolicy()');
    expect(contextSource).not.toContain('const toolPolicies = {');
    expect(capabilitySource).toContain('class ToolCapabilityPolicy');
    expect(executionSource).toContain('class ToolExecutionPolicy');
    expect(executionSource).not.toMatch(/\.ya?ml|\.json/);
  });

  it('should include benchmark tools in an explicit system utility policy', () => {
    const ToolCapabilityPolicy = globalThis.ToolCapabilityPolicy;
    const capabilityPolicy = new ToolCapabilityPolicy();

    expect(capabilityPolicy.getPolicyForTool('start_benchmark').name).toBe('system_utility');
    expect(capabilityPolicy.getPolicyForTool('export_benchmark_results').name).toBe('system_utility');
    expect(capabilityPolicy.getPolicyForTool('set_working_directory').name).toBe('system_utility');
  });

  it('should not apply global repetition limits to system utility tools', () => {
    const ToolExecutionPolicy = globalThis.ToolExecutionPolicy;
    const policy = new ToolExecutionPolicy({
      chatManager: {
        configManager: {
          get: (key, fallback) => {
            if (key === 'chatboxSettings') return {};
            return fallback;
          },
        },
        getToolExecutionKey: (toolName, parameters) => `${toolName}:${JSON.stringify(parameters)}`,
        getToolExecutionCount: () => 99,
        getToolExecutionCountByName: () => 99,
        wasToolExecutedSuccessfully: () => true,
      },
    });

    expect(policy.shouldAllowToolExecution({ tool_name: 'start_benchmark', parameters: { suite: 'quick' } }, [])).toBe(
      true
    );
  });

  it('should normalize parameters order-independently (LLMContextService)', () => {
    const service = new LLMContextService({}, {});
    const params1 = { sequence: 'GCAATAT', chromosome: 'chr1' };
    const params2 = { chromosome: 'chr1', sequence: 'GCAATAT' };

    const norm1 = service.normalizeParams(params1);
    const norm2 = service.normalizeParams(params2);

    expect(JSON.stringify(norm1)).toBe(JSON.stringify(norm2));
    expect(Object.keys(norm1)[0]).toBe('chromosome');
    expect(Object.keys(norm1)[1]).toBe('sequence');
  });

  it('should handle nested objects in parameter normalization (LLMContextService)', () => {
    const service = new LLMContextService({}, {});
    const params1 = { outer: { b: 2, a: 1 }, z: 100 };
    const params2 = { z: 100, outer: { a: 1, b: 2 } };

    const norm1 = service.normalizeParams(params1);
    const norm2 = service.normalizeParams(params2);

    expect(JSON.stringify(norm1)).toBe(JSON.stringify(norm2));
  });

  it('should canonicalize redundant primer sequence aliases', () => {
    const service = new LLMContextService({}, {});
    const manager = new MockChatManager();

    expect(service.normalizeParams({ primerSequence: 'GCAATAT' })).toEqual({ sequence: 'GCAATAT' });
    expect(
      manager.areParametersEqual({ sequence: 'GCAATAT' }, { sequence: 'GCAATAT', primerSequence: 'GCAATAT' })
    ).toBe(true);
  });

  it('should drop derived target sequences from design primer execution identity', () => {
    const service = new LLMContextService({}, {});
    const manager = new MockChatManager();
    const targetSequence = 'ATGTCTGAAATTGTTGTCTC';

    expect(service.normalizeToolParams('design_primers', { geneName: 'lysC', targetSequence })).toEqual({
      geneName: 'lysC',
    });
    expect(manager.getToolExecutionKey('design_primers', { geneName: 'lysC' })).toBe(
      manager.getToolExecutionKey('design_primers', { geneName: 'lysC', targetSequence })
    );
    expect(manager.getToolExecutionKey('design_primers', { targetSequence })).toContain(targetSequence);
  });

  it('should allow a fresh identical tool call from a later model round', () => {
    const manager = new MockChatManager();
    const tool = { tool_name: 'get_track_status', parameters: {} };
    const successfulCounts = new Map([[manager.getToolExecutionKey(tool.tool_name, tool.parameters), 1]]);

    const result = manager.filterExecutableToolInstances(
      [tool],
      successfulCounts,
      'check track status, show GC, hide variants, then check track status again'
    );

    expect(result.executableTools).toHaveLength(1);
    expect(result.suppressedTools).toHaveLength(0);
  });

  it('should leave cross-round primer repeats for execution policy when the LLM echoes resolved targetSequence', () => {
    const manager = new MockChatManager();
    const firstTool = { tool_name: 'design_primers', parameters: { geneName: 'lysC' } };
    const repeatedTool = {
      tool_name: 'design_primers',
      parameters: {
        geneName: 'lysC',
        targetSequence: 'ATGTCTGAAATTGTTGTCTC',
      },
    };
    const successfulCounts = new Map([[manager.getToolExecutionKey(firstTool.tool_name, firstTool.parameters), 1]]);

    const result = manager.filterExecutableToolInstances(
      [repeatedTool],
      successfulCounts,
      'please design primers to amplify lysC gene'
    );

    expect(result.executableTools).toHaveLength(1);
    expect(result.suppressedTools).toHaveLength(0);
  });

  it('should allow get_track_status to rerun after track visibility changes', () => {
    const ToolExecutionPolicy = globalThis.ToolExecutionPolicy;
    const ToolCapabilityPolicy = globalThis.ToolCapabilityPolicy;
    const manager = new MockChatManager();
    manager.configManager = {
      get: (key, fallback) => {
        if (key === 'chatboxSettings') return {};
        return fallback;
      },
    };

    const policy = new ToolExecutionPolicy({ chatManager: manager });
    const tool = { tool_name: 'get_track_status', parameters: {} };
    const unchangedHistory = [
      {
        role: 'system',
        content: 'Tool execution completed: get_track_status executed successfully with parameters: {}: {"gc":false}',
      },
    ];
    const changedHistory = [
      ...unchangedHistory,
      {
        role: 'system',
        content:
          'Tool execution completed: toggle_track executed successfully with parameters: {"track_name":"gc","visible":true}: {"visible":true}',
      },
      {
        role: 'system',
        content:
          'Tool execution completed: toggle_track executed successfully with parameters: {"track_name":"variants","visible":false}: {"visible":false}',
      },
    ];

    expect(new ToolCapabilityPolicy().getPolicyForTool('get_track_status').name).toBe('state');
    expect(policy.shouldAllowToolExecution(tool, unchangedHistory, 2, [])).toBe(false);
    expect(policy.shouldAllowToolExecution(tool, changedHistory, 2, [])).toBe(true);
  });

  it('should cap duplicate tool instances within a single model response unless the user asked for repeats', () => {
    const manager = new MockChatManager();
    const tool = { tool_name: 'pan_right', parameters: { amount: 500 } };

    const singleResult = manager.filterExecutableToolInstances([tool, tool], new Map(), 'pan right');
    expect(singleResult.executableTools).toHaveLength(1);
    expect(singleResult.suppressedTools).toHaveLength(1);

    const repeatedResult = manager.filterExecutableToolInstances([tool, tool], new Map(), 'pan right twice');
    expect(repeatedResult.executableTools).toHaveLength(2);
    expect(repeatedResult.suppressedTools).toHaveLength(0);
  });

  it('should build a pending execution queue from detected tool calls', () => {
    const manager = new MockChatManager();
    manager.showThinkingProcess = false;
    manager.updateThinkingMessage = () => {};
    manager.shouldAllowToolExecution = tool => tool.parameters.search_query !== 'blocked';
    const tools = [
      { tool_name: 'search_uniprot_database', parameters: { search_query: 'DNA polymerase I' } },
      { tool_name: 'search_uniprot_database', parameters: { search_query: 'blocked' } },
    ];

    const result = manager.createPendingToolExecutionQueue(tools, new Map(), 'search polymerases', [], 2);
    tools[0].parameters.search_query = 'mutated after queueing';

    expect(result.pendingTools).toHaveLength(1);
    expect(result.pendingTools[0].parameters.search_query).toBe('DNA polymerase I');
    expect(result.policyBlockedTools).toHaveLength(1);
    expect(result.suppressedTools).toHaveLength(0);
  });

  it('should retain structured execution state for queued, blocked, and same-response suppressed tool calls', () => {
    const manager = new MockChatManager();
    manager.showThinkingProcess = false;
    manager.updateThinkingMessage = () => {};
    manager.shouldAllowToolExecution = tool => tool.tool_name !== 'blocked_tool';

    const completedTool = { tool_name: 'get_coding_sequence', parameters: { gene_name: 'lacZ' } };
    const blockedTool = { tool_name: 'blocked_tool', parameters: { id: 1 } };
    const queuedTool = { tool_name: 'translate_dna', parameters: { dna: 'ATG', reading_frame: 1 } };
    const successfulCounts = new Map([
      [manager.getToolExecutionKey(completedTool.tool_name, completedTool.parameters), 1],
    ]);
    const state = manager.createToolExecutionState('retrieve lacZ, translate it, and calculate molecular weight');

    const result = manager.createPendingToolExecutionQueue(
      [completedTool, completedTool, blockedTool, queuedTool],
      successfulCounts,
      state.originalMessage,
      [],
      2,
      state
    );

    expect(result.pendingTools).toHaveLength(2);
    expect(result.pendingTools[0].executionId).toBeDefined();
    expect(state.records.map(record => record.status)).toEqual(['suppressed', 'queued', 'blocked', 'queued']);
    expect(state.records.map(record => record.tool)).toEqual([
      'get_coding_sequence',
      'get_coding_sequence',
      'blocked_tool',
      'translate_dna',
    ]);
  });

  it('should update execution state with success/failure results and inject it as a user-visible state message', () => {
    const manager = new MockChatManager();
    manager.showThinkingProcess = false;
    manager.updateThinkingMessage = () => {};
    manager.shouldAllowToolExecution = () => true;
    const state = manager.createToolExecutionState('retrieve lacZ, translate it, and calculate molecular weight');
    const tools = [
      { tool_name: 'get_coding_sequence', parameters: { gene_name: 'lacZ' } },
      { tool_name: 'calculate_molecular_weight', parameters: { sequence: 'BAD' } },
    ];

    const queued = manager.createPendingToolExecutionQueue(tools, new Map(), state.originalMessage, [], 1, state);
    manager.markToolExecutionResults(
      state,
      queued.pendingTools,
      [
        {
          tool: 'get_coding_sequence',
          parameters: { gene_name: 'lacZ' },
          success: true,
          result: { codingSequence: 'ATGAAATAG', length: 9 },
          error: null,
        },
        {
          tool: 'calculate_molecular_weight',
          parameters: { sequence: 'BAD' },
          success: false,
          result: null,
          error: 'invalid sequence',
        },
      ],
      1
    );

    expect(state.records[0].status).toBe('success');
    expect(state.records[0].resultSummary.codingSequence).toBe('ATGAAATAG');
    expect(state.records[1].status).toBe('failed');
    expect(state.records[1].error).toBe('invalid sequence');

    const history = [];
    expect(manager.appendToolExecutionStateMessage(history, state)).toBe(true);
    expect(history).toHaveLength(1);
    expect(history[0].role).toBe('user');
    expect(history[0].content).toContain('[Tool Execution State]');
    expect(history[0].content).toContain('"status": "success"');
    expect(history[0].content).toContain('"status": "failed"');
    expect(history[0].content).toContain('Do not call a tool with status "success" again');
  });

  it('should translate one-based reading_frame into zero-based MicrobeGenomics frame arguments', () => {
    const service = new ToolExecutionService({}, {});

    expect(service._extractMGFArgs('translate_dna', { dna: 'AAATTT', reading_frame: 1 })).toEqual(['AAATTT', 0]);
    expect(service._extractMGFArgs('translate_dna', { dna: 'AAATTT', reading_frame: 2 })).toEqual(['AAATTT', 1]);
    expect(service._extractMGFArgs('translate_dna', { dna: 'AAATTT', frame: 2 })).toEqual(['AAATTT', 2]);
  });

  it('should consume pending tool calls as each item is dispatched', async () => {
    const manager = new MockChatManager();
    const queue = [
      { tool_name: 'search_uniprot_database', parameters: { search_query: 'DNA polymerase I' } },
      { tool_name: 'search_uniprot_database', parameters: { search_query: 'fail' } },
    ];
    const queueLengthsDuringDispatch = [];
    manager.executeToolByName = async (toolName, parameters) => {
      queueLengthsDuringDispatch.push(queue.length);
      if (parameters.search_query === 'fail') {
        throw new Error('simulated failure');
      }
      return { ok: true, toolName };
    };

    const results = await manager.executePendingToolExecutionQueue(queue);

    expect(queue).toHaveLength(0);
    expect(queueLengthsDuringDispatch).toEqual([1, 0]);
    expect(results).toEqual([
      {
        tool: 'search_uniprot_database',
        parameters: { search_query: 'DNA polymerase I' },
        success: true,
        result: { ok: true, toolName: 'search_uniprot_database' },
        error: null,
      },
      {
        tool: 'search_uniprot_database',
        parameters: { search_query: 'fail' },
        success: false,
        result: null,
        error: 'simulated failure',
      },
    ]);
  });

  it('should allow external API follow-up calls with different parameters but block exact repeats', () => {
    const ToolExecutionPolicy = globalThis.ToolExecutionPolicy;
    const manager = new MockChatManager();
    manager.configManager = {
      get: (key, fallback) => {
        if (key === 'chatboxSettings') return {};
        return fallback;
      },
    };
    const policy = new ToolExecutionPolicy({ chatManager: manager });
    const history = [
      {
        role: 'system',
        content:
          'Tool execution completed: search_uniprot_database executed successfully with parameters: {"organism":"Escherichia coli","reviewed_only":true,"search_query":"polymerase"}: {"count":20}',
      },
    ];

    expect(
      policy.shouldAllowToolExecution(
        {
          tool_name: 'search_uniprot_database',
          parameters: { search_query: 'DNA polymerase I', organism: 'Escherichia coli', reviewed_only: true },
        },
        history,
        2,
        []
      )
    ).toBe(true);
    expect(
      policy.shouldAllowToolExecution(
        {
          tool_name: 'search_uniprot_database',
          parameters: { search_query: 'polymerase', organism: 'Escherichia coli', reviewed_only: true },
        },
        history,
        2,
        []
      )
    ).toBe(false);
  });

  it('should compare parameters correctly (ChatManager areParametersEqual)', () => {
    const manager = new MockChatManager();
    const params1 = { sequence: 'GCAATAT', chromosome: 'chr1' };
    const params2 = { chromosome: 'chr1', sequence: 'GCAATAT' };

    expect(manager.areParametersEqual(params1, params2)).toBe(true);
    expect(manager.areParametersEqual(params1, { sequence: 'GCAATAT' })).toBe(false);
  });

  it('should robustly parse and match parameters in wasToolExecutedSuccessfully', () => {
    const manager = new MockChatManager();
    const toolKey = 'find_primer_binding_sites:{"chromosome":"chr1","sequence":"GCAATAT"}';

    // Exact match in history
    const history1 = [
      {
        role: 'system',
        content:
          'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"chromosome":"chr1","sequence":"GCAATAT"}: found 1 sites',
      },
    ];
    expect(manager.wasToolExecutedSuccessfully(toolKey, history1)).toBe(true);

    // Permuted keys match in history
    const history2 = [
      {
        role: 'system',
        content:
          'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"sequence":"GCAATAT","chromosome":"chr1"}: found 1 sites',
      },
    ];
    expect(manager.wasToolExecutedSuccessfully(toolKey, history2)).toBe(true);

    // Mismatched parameters
    const history3 = [
      {
        role: 'system',
        content:
          'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"chromosome":"chr2","sequence":"GCAATAT"}: found 0 sites',
      },
    ];
    expect(manager.wasToolExecutedSuccessfully(toolKey, history3)).toBe(false);
  });

  it('should parse execution parameters when JSON results are appended', () => {
    const manager = new MockChatManager();
    const toolKey = 'find_primer_binding_sites:{"sequence":"GCAATATGTCTCTGTGTGGAT"}';
    const history = [
      {
        role: 'system',
        content:
          'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"sequence":"GCAATATGTCTCTGTGTGGAT","primerSequence":"GCAATATGTCTCTGTGTGGAT"}: {"queryLength":21,"sites":[{"start":24,"end":45,"strand":"+","mismatches":0,"sequence":"GCAATATGTCTCTGTGTGGAT"}]}',
      },
    ];

    expect(manager.wasToolExecutedSuccessfully(toolKey, history)).toBe(true);
    expect(manager.getToolExecutionCount(toolKey, history)).toBe(1);
    expect(manager.findExistingExecution(toolKey, history)?.success).toBe(true);
  });

  it('should robustly parse and match parameters in getToolExecutionCount', () => {
    const manager = new MockChatManager();
    const toolKey = 'find_primer_binding_sites:{"chromosome":"chr1","sequence":"GCAATAT"}';

    const history = [
      {
        role: 'system',
        content:
          'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"chromosome":"chr1","sequence":"GCAATAT"}: 1',
      },
      {
        role: 'system',
        content:
          'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"sequence":"GCAATAT","chromosome":"chr1"}: 2',
      },
      {
        role: 'system',
        content:
          'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"sequence":"DIFFERENT","chromosome":"chr1"}: 3',
      },
    ];

    expect(manager.getToolExecutionCount(toolKey, history)).toBe(2);
  });

  it('should detect view state changes in hasViewStateChangedSinceLastExecution', () => {
    const service = new LLMContextService({}, {});

    // Scenario 1: No previous successful execution of target tool
    const history1 = [
      {
        role: 'system',
        content: 'Tool execution completed: zoom_in executed successfully',
      },
    ];
    expect(service.hasViewStateChangedSinceLastExecution('find_primer_binding_sites', history1)).toBe(false);

    // Scenario 2: Target tool executed, then view changed
    const history2 = [
      {
        role: 'system',
        content:
          'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"sequence":"GCAATAT"}: 1',
      },
      {
        role: 'system',
        content: 'Tool execution completed: zoom_in executed successfully',
      },
    ];
    expect(service.hasViewStateChangedSinceLastExecution('find_primer_binding_sites', history2)).toBe(true);

    // Scenario 3: Target tool executed, but view changed BEFORE it, not after
    const history3 = [
      {
        role: 'system',
        content: 'Tool execution completed: zoom_in executed successfully',
      },
      {
        role: 'system',
        content:
          'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"sequence":"GCAATAT"}: 1',
      },
    ];
    expect(service.hasViewStateChangedSinceLastExecution('find_primer_binding_sites', history3)).toBe(false);
  });

  it('should terminate after successful primer binding site searches', () => {
    const service = new LLMContextService({}, {});

    const shouldTerminate = service.shouldTerminateAfterToolExecution(
      [{ tool_name: 'find_primer_binding_sites' }],
      [
        {
          tool: 'find_primer_binding_sites',
          result: {
            queryLength: 21,
            sites: [{ start: 24, end: 45, strand: '+', mismatches: 0 }],
          },
        },
      ],
      'Find binding sites for primer GCAATATGTCTCTGTGTGGAT on the current genome.'
    );

    expect(shouldTerminate).toBe(true);
  });

  it('should terminate after successful primer design requests', () => {
    const service = new LLMContextService({}, {});

    const shouldTerminate = service.shouldTerminateAfterToolExecution(
      [{ tool_name: 'design_primers', parameters: { geneName: 'lysC' } }],
      [
        {
          tool: 'design_primers',
          result: {
            forward: { sequence: 'ATGTCTGAAATTGTTGTCTC', tm: 62.1, gcContent: 35, length: 20 },
            reverse: { sequence: 'CAAATCATGCGAATGTTGAA', tm: 62.1, gcContent: 35, length: 20 },
            productSize: 1256,
          },
        },
      ],
      'please design primers to amplify lysC gene'
    );

    expect(shouldTerminate).toBe(true);
  });

  it('should terminate after successful simple pan requests', () => {
    const service = new LLMContextService({}, {});

    const shouldTerminate = service.shouldTerminateAfterToolExecution(
      [{ tool_name: 'pan_right' }],
      [
        {
          tool: 'pan_right',
          result: {
            success: true,
            message: 'Panned right',
            newRange: { chromosome: 'U00096', start: 10000, end: 20000 },
          },
        },
      ],
      'pan right'
    );

    expect(shouldTerminate).toBe(true);
  });

  it('should NOT terminate early when the message chains a follow-up action ("and then")', () => {
    const service = new LLMContextService({}, {});

    // Regression: "Navigate ... and then zoom in 10x" matches the loose
    // "navigate to" single-execution pattern, but the user clearly requested a
    // second step. Early termination after navigate would drop the zoom_in.
    const shouldTerminate = service.shouldTerminateAfterToolExecution(
      [{ tool_name: 'navigate_to_position', parameters: { start: 1230000, end: 1300000 } }],
      [
        {
          tool: 'navigate_to_position',
          result: {
            success: true,
            chromosome: 'U00096',
            start: 1230000,
            end: 1300000,
            message: 'Navigated to U00096:1230000-1300000',
          },
        },
      ],
      'Navigate to region 1230000 to 1300000 and then zoom in 10x to see the features.'
    );

    expect(shouldTerminate).toBe(false);
  });

  it('detects multi-step intent from common sequencing cues', () => {
    const service = new LLMContextService({}, {});

    expect(service.messageHasMultiStepIntent('navigate to gene lacZ and then zoom in')).toBe(true);
    expect(service.messageHasMultiStepIntent('go to position 5000, then pan right')).toBe(true);
    expect(service.messageHasMultiStepIntent('load genome; show genes')).toBe(true);
    expect(service.messageHasMultiStepIntent('navigate to position 1000. after that toggle gc')).toBe(true);

    // Single-action messages must stay eligible for early termination
    expect(service.messageHasMultiStepIntent('navigate to position 1230000-1300000')).toBe(false);
    expect(service.messageHasMultiStepIntent('pan right')).toBe(false);
  });

  it('detects multi-step intent from enumerated lists and multiple analysis verbs', () => {
    const service = new LLMContextService({}, {});

    // Comma + coordinating conjunction (Oxford-list) enumeration.
    expect(
      service.messageHasMultiStepIntent(
        'calculate sequence statistics for the current genome, perform a genome-wide ' +
          'codon usage analysis, and compute the overall genome gc content.'
      )
    ).toBe(true);
    // Two distinct analysis verbs without a list conjunction.
    expect(service.messageHasMultiStepIntent('calculate sequence statistics, perform codon analysis')).toBe(true);
    expect(service.messageHasMultiStepIntent('calculate the gc content and export the region features')).toBe(true);

    // Single analysis verb stays on the fast path even if it repeats.
    expect(service.messageHasMultiStepIntent('analyze codon usage for the genome')).toBe(false);
    expect(service.messageHasMultiStepIntent('calculate the gc content for the current region')).toBe(false);
  });

  it('should NOT terminate early on a compound analysis request that contains a single-execution keyword', () => {
    const service = new LLMContextService({}, {});

    // Regression: the message contains the substring "codon usage analysis"
    // (a single-execution pattern), but it is one of three enumerated steps.
    // Terminating after an exploratory get_genome_info call would drop the
    // remaining analyses and the final summary.
    const shouldTerminate = service.shouldTerminateAfterToolExecution(
      [{ tool_name: 'get_genome_info', parameters: {} }],
      [{ tool: 'get_genome_info', result: { success: true, genomeInfo: { length: 4641652 } } }],
      'Calculate sequence statistics for the current genome, perform a genome-wide ' +
        'codon usage analysis, and compute the overall genome GC content.'
    );

    expect(shouldTerminate).toBe(false);
  });

  it('renders get_genome_info as a readable summary instead of raw JSON', () => {
    const service = new LLMContextService({}, {});

    const response = service.generateSingleToolResponse(
      { tool_name: 'get_genome_info', parameters: {} },
      {
        result: {
          success: true,
          genomeInfo: {
            name: 'Unknown',
            length: 4641652,
            loadedFiles: [{ name: 'ECOLI.gbk', type: 'GenBank' }],
            chromosomes: ['U00096'],
            annotations: { hasData: false, totalFeatures: 0, featureCounts: {} },
            statistics: { chromosomeStats: { U00096: { length: 4641652, gcPercent: 50.79 } } },
          },
        },
      }
    );

    expect(response).toContain('Genome Information');
    expect(response).toContain('4,641,652 bp');
    expect(response).toContain('U00096');
    expect(response).toContain('50.79% GC');
    expect(response).toContain('ECOLI.gbk');
    // Must NOT be a raw JSON dump.
    expect(response).not.toContain('```json');
    expect(response).not.toContain('Full Results');
  });

  it('renders compute_gc as a readable summary instead of raw JSON', () => {
    const service = new LLMContextService({}, {});

    const response = service.generateSingleToolResponse(
      { tool_name: 'compute_gc', parameters: {} },
      { result: { gcContent: 50.79, chromosome: 'U00096', start: 1, end: 4641652, length: 4641652 } }
    );

    expect(response).toContain('GC Content');
    expect(response).toContain('50.79%');
    expect(response).toContain('AT content: 49.21%');
    expect(response).not.toContain('```json');
  });

  it('renders the Dynamic Tool registration listing as a categorized visualization', () => {
    const service = new LLMContextService({}, {});

    const html = service.renderAvailableToolsVisualization({
      success: true,
      tool: 'list_available_tools',
      total_tools: 3,
      categories: {
        navigation: {
          name: 'Navigation & State Management',
          count: 2,
          tools: [
            { name: 'navigate_to_position', description: 'Move the browser to a region' },
            { name: 'zoom_in', description: 'Zoom into the current view' },
          ],
        },
        sequence: {
          name: 'Sequence Analysis',
          count: 1,
          tools: [{ name: 'compute_gc', description: 'Compute GC content' }],
        },
      },
    });

    expect(html).toContain('Available Tools (3)');
    expect(html).toContain('Navigation &amp; State Management'); // HTML-escaped category name
    expect(html).toContain('navigate_to_position');
    expect(html).toContain('Compute GC content'); // descriptions surfaced
    // Readable visualization, not a raw dump.
    expect(html).not.toContain('```');
    expect(html).not.toContain('Object(');
  });

  it('renders the tools visualization from a flat tool list and handles the empty case', () => {
    const service = new LLMContextService({}, {});

    const flat = service.renderAvailableToolsVisualization({ tools: ['alpha_tool', 'beta_tool'] });
    expect(flat).toContain('All Tools');
    expect(flat).toContain('alpha_tool');
    expect(flat).toContain('beta_tool');

    const empty = service.renderAvailableToolsVisualization({ categories: {} });
    expect(empty).toContain('No tools available');
  });

  it('supports a custom title and collapsed categories for the pre-request thinking panel', () => {
    const service = new LLMContextService({}, {});

    const data = {
      total_tools: 1,
      categories: {
        navigation: {
          name: 'Navigation',
          count: 1,
          tools: [{ name: 'navigate_to_position', description: 'Move the browser to a region' }],
        },
      },
    };

    // Default: title is "Available Tools" and categories render expanded.
    const defaultHtml = service.renderAvailableToolsVisualization(data);
    expect(defaultHtml).toContain('Available Tools (1)');
    expect(defaultHtml).toContain('<details style="margin: 6px 0;" open>');

    // Options: custom heading and collapsed categories (no ` open` on the <details>).
    const collapsed = service.renderAvailableToolsVisualization(data, {
      title: 'Registered Tools',
      categoriesOpen: false,
    });
    expect(collapsed).toContain('Registered Tools (1)');
    expect(collapsed).toContain('<details style="margin: 6px 0;">');
    expect(collapsed).not.toContain('<details style="margin: 6px 0;" open>');
    // The tool itself is still listed even while collapsed.
    expect(collapsed).toContain('navigate_to_position');
  });

  it('should allow idempotent case-insensitive track requests through to the tool implementation', () => {
    const mockChatManager = {
      configManager: {
        get: (key, fallback) => {
          if (key === 'chatboxSettings') return {};
          return fallback;
        },
      },
      parseMultipleToolCalls: () => [],
      getToolExecutionKey: (toolName, parameters) => `${toolName}:${JSON.stringify(parameters)}`,
      getToolExecutionCount: () => 0,
    };
    const service = new LLMContextService({}, mockChatManager);

    const toolUpper = { tool_name: 'toggle_track', parameters: { trackName: 'BLAST', action: 'show' } };
    const toolLower = { tool_name: 'toggle_track', parameters: { trackName: 'blast', action: 'show' } };

    const originalGetElementById = global.document.getElementById;
    const checkedState = true;
    global.document.getElementById = id => {
      if (id === 'trackBlast') {
        return { checked: checkedState };
      }
      return null;
    };

    try {
      const allowedUpper = service.shouldAllowToolExecution(toolUpper, []);
      const allowedLower = service.shouldAllowToolExecution(toolLower, []);

      expect(allowedUpper).toBe(true);
      expect(allowedLower).toBe(true);
    } finally {
      global.document.getElementById = originalGetElementById;
    }
  });

  it('should allow explicit show and hide track requests even when tracks are already in that state', () => {
    const mockChatManager = {
      configManager: {
        get: (key, fallback) => {
          if (key === 'chatboxSettings') return {};
          return fallback;
        },
      },
      parseMultipleToolCalls: () => [],
      getToolExecutionKey: (toolName, parameters) => `${toolName}:${JSON.stringify(parameters)}`,
      getToolExecutionCount: () => 0,
    };
    const service = new LLMContextService({}, mockChatManager);

    const originalGetElementById = global.document.getElementById;
    global.document.getElementById = id => {
      if (id === 'trackGC') {
        return { checked: true };
      }
      if (id === 'trackVariants') {
        return { checked: false };
      }
      return null;
    };

    try {
      expect(
        service.shouldAllowToolExecution({ tool_name: 'toggle_track', parameters: { track_name: 'gc', visible: true } })
      ).toBe(true);
      expect(
        service.shouldAllowToolExecution({
          tool_name: 'toggle_track',
          parameters: { track_name: 'variants', visible: false },
        })
      ).toBe(true);
    } finally {
      global.document.getElementById = originalGetElementById;
    }
  });

  it('should support toggle action in LLMContextService policy validation', () => {
    const mockChatManager = {
      configManager: {
        get: (key, fallback) => {
          if (key === 'chatboxSettings') return {};
          return fallback;
        },
      },
      parseMultipleToolCalls: () => [],
      getToolExecutionKey: (toolName, parameters) => `${toolName}:${JSON.stringify(parameters)}`,
      getToolExecutionCount: () => 0,
    };
    const service = new LLMContextService({}, mockChatManager);

    const toolToggle = { tool_name: 'toggle_track', parameters: { trackName: 'genes', action: 'toggle' } };

    const originalGetElementById = global.document.getElementById;
    let checkedState = false;
    global.document.getElementById = id => {
      if (id === 'trackGenes') {
        return { checked: checkedState };
      }
      return null;
    };

    try {
      const allowed = service.shouldAllowToolExecution(toolToggle, []);
      expect(allowed).toBe(true);

      checkedState = true;
      const allowed2 = service.shouldAllowToolExecution(toolToggle, []);
      expect(allowed2).toBe(true);
    } finally {
      global.document.getElementById = originalGetElementById;
    }
  });
});
