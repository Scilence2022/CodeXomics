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

// Helper to load ChatManager in a node-compatible way
function loadChatManagerClass() {
  const managerPath = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');
  let content = fs.readFileSync(managerPath, 'utf-8');

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
    /getRequestedToolExecutionLimit\s*\(originalMessage,\s*tool\)\s*\{[\s\S]*?\}\n\n\s*filterExecutableToolInstances/
  );
  const filterExecutableToolInstancesMatch = content.match(
    /filterExecutableToolInstances\s*\(toolsToExecute,\s*successfulToolExecutionCounts,\s*originalMessage\)\s*\{[\s\S]*?\}\n\n\s*normalizeParams/
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
    ? getRequestedToolExecutionLimitMatch[0].replace('filterExecutableToolInstances', '')
    : '';
  const filterExecutableToolInstancesCode = filterExecutableToolInstancesMatch
    ? filterExecutableToolInstancesMatch[0].replace('normalizeParams', '')
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
      ${filterExecutableToolInstancesCode}
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

  it('should suppress duplicate tool instances after successful execution in the same request', () => {
    const manager = new MockChatManager();
    const tool = { tool_name: 'pan_right', parameters: { amount: 500 } };
    const successfulCounts = new Map([[manager.getToolExecutionKey(tool.tool_name, tool.parameters), 1]]);

    const result = manager.filterExecutableToolInstances([tool], successfulCounts, 'pan right');

    expect(result.executableTools).toHaveLength(0);
    expect(result.suppressedTools).toHaveLength(1);
  });

  it('should suppress repeated design primer calls when the LLM echoes resolved targetSequence', () => {
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

    expect(result.executableTools).toHaveLength(0);
    expect(result.suppressedTools).toHaveLength(1);
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

  it('should support case-insensitive track names in LLMContextService policy validation', () => {
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
    let checkedState = true;
    global.document.getElementById = id => {
      if (id === 'trackBlast') {
        return { checked: checkedState };
      }
      return null;
    };

    try {
      const allowedUpper = service.shouldAllowToolExecution(toolUpper, []);
      const allowedLower = service.shouldAllowToolExecution(toolLower, []);

      expect(allowedUpper).toBe(false);
      expect(allowedLower).toBe(false);
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
