/**
 * Tool Policy Robustness Tests
 */
/* eslint-disable no-new-func, max-len */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

// Helper to load LLMContextService in a node-compatible way
function loadLLMContextServiceClass() {
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
  const getToolExecutionKeyMatch = content.match(/getToolExecutionKey\s*\(toolName,\s*parameters\s*=\s*\{\}\)\s*\{[\s\S]*?\}\n\n\s*getRequestedToolExecutionLimit/);
  const getRequestedToolExecutionLimitMatch = content.match(/getRequestedToolExecutionLimit\s*\(originalMessage,\s*tool\)\s*\{[\s\S]*?\}\n\n\s*filterExecutableToolInstances/);
  const filterExecutableToolInstancesMatch = content.match(/filterExecutableToolInstances\s*\(toolsToExecute,\s*successfulToolExecutionCounts,\s*originalMessage\)\s*\{[\s\S]*?\}\n\n\s*normalizeParams/);
  const normalizeParamsMatch = content.match(/normalizeParams\s*\(params\)\s*\{[\s\S]*?\}\n\n\s*areParametersEqual/);
  const areParametersEqualMatch = content.match(/areParametersEqual\s*\(params1,\s*params2\)\s*\{[\s\S]*?\}\n\n\s*\/\*\*/);
  const extractParametersMatch = content.match(/extractParametersFromExecutionMessage\s*\(content\)\s*\{[\s\S]*?\}\n\n\s*\/\*\*/);
  const wasToolExecutedSuccessfullyMatch = content.match(/wasToolExecutedSuccessfully\s*\(toolKey,\s*conversationHistory\)\s*\{[\s\S]*?\}\n\n\s*\/\*\*/);
  const getToolExecutionCountMatch = content.match(/getToolExecutionCount\s*\(toolKey,\s*conversationHistory\)\s*\{[\s\S]*?\}\n\n\s*\/\*\*/);
  const findExistingExecutionMatch = content.match(/findExistingExecution\s*\(toolKey,\s*conversationHistory\)\s*\{[\s\S]*?\}\n\n\s*\/\*\*/);

  const getToolExecutionKeyCode = getToolExecutionKeyMatch ? getToolExecutionKeyMatch[0].replace('getRequestedToolExecutionLimit', '') : '';
  const getRequestedToolExecutionLimitCode = getRequestedToolExecutionLimitMatch ? getRequestedToolExecutionLimitMatch[0].replace('filterExecutableToolInstances', '') : '';
  const filterExecutableToolInstancesCode = filterExecutableToolInstancesMatch ? filterExecutableToolInstancesMatch[0].replace('normalizeParams', '') : '';
  const normalizeParamsCode = normalizeParamsMatch ? normalizeParamsMatch[0].replace('areParametersEqual', '') : '';
  const areParametersEqualCode = areParametersEqualMatch ? areParametersEqualMatch[0].replace('/**', '') : '';
  const extractParametersCode = extractParametersMatch ? extractParametersMatch[0].replace('/**', '') : '';
  const wasToolExecutedSuccessfullyCode = wasToolExecutedSuccessfullyMatch ? wasToolExecutedSuccessfullyMatch[0].replace('/**', '') : '';
  const getToolExecutionCountCode = getToolExecutionCountMatch ? getToolExecutionCountMatch[0].replace('/**', '') : '';
  const findExistingExecutionCode = findExistingExecutionMatch ? findExistingExecutionMatch[0].replace('/**', '') : '';

  const mockClassCode = `
    class MockChatManager {
      ${getToolExecutionKeyCode}
      ${getRequestedToolExecutionLimitCode}
      ${filterExecutableToolInstancesCode}
      ${normalizeParamsCode}
      ${areParametersEqualCode}
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
    expect(manager.areParametersEqual(
      { sequence: 'GCAATAT' },
      { sequence: 'GCAATAT', primerSequence: 'GCAATAT' },
    )).toBe(true);
  });

  it('should suppress duplicate tool instances after successful execution in the same request', () => {
    const manager = new MockChatManager();
    const tool = { tool_name: 'pan_right', parameters: { amount: 500 } };
    const successfulCounts = new Map([[manager.getToolExecutionKey(tool.tool_name, tool.parameters), 1]]);

    const result = manager.filterExecutableToolInstances([tool], successfulCounts, 'pan right');

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
        content: 'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"chromosome":"chr1","sequence":"GCAATAT"}: found 1 sites'
      }
    ];
    expect(manager.wasToolExecutedSuccessfully(toolKey, history1)).toBe(true);

    // Permuted keys match in history
    const history2 = [
      {
        role: 'system',
        content: 'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"sequence":"GCAATAT","chromosome":"chr1"}: found 1 sites'
      }
    ];
    expect(manager.wasToolExecutedSuccessfully(toolKey, history2)).toBe(true);

    // Mismatched parameters
    const history3 = [
      {
        role: 'system',
        content: 'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"chromosome":"chr2","sequence":"GCAATAT"}: found 0 sites'
      }
    ];
    expect(manager.wasToolExecutedSuccessfully(toolKey, history3)).toBe(false);
  });

  it('should parse execution parameters when JSON results are appended', () => {
    const manager = new MockChatManager();
    const toolKey = 'find_primer_binding_sites:{"sequence":"GCAATATGTCTCTGTGTGGAT"}';
    const history = [
      {
        role: 'system',
        content: 'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"sequence":"GCAATATGTCTCTGTGTGGAT","primerSequence":"GCAATATGTCTCTGTGTGGAT"}: {"queryLength":21,"sites":[{"start":24,"end":45,"strand":"+","mismatches":0,"sequence":"GCAATATGTCTCTGTGTGGAT"}]}'
      }
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
        content: 'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"chromosome":"chr1","sequence":"GCAATAT"}: 1'
      },
      {
        role: 'system',
        content: 'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"sequence":"GCAATAT","chromosome":"chr1"}: 2'
      },
      {
        role: 'system',
        content: 'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"sequence":"DIFFERENT","chromosome":"chr1"}: 3'
      }
    ];

    expect(manager.getToolExecutionCount(toolKey, history)).toBe(2);
  });

  it('should detect view state changes in hasViewStateChangedSinceLastExecution', () => {
    const service = new LLMContextService({}, {});
    
    // Scenario 1: No previous successful execution of target tool
    const history1 = [
      {
        role: 'system',
        content: 'Tool execution completed: zoom_in executed successfully'
      }
    ];
    expect(service.hasViewStateChangedSinceLastExecution('find_primer_binding_sites', history1)).toBe(false);

    // Scenario 2: Target tool executed, then view changed
    const history2 = [
      {
        role: 'system',
        content: 'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"sequence":"GCAATAT"}: 1'
      },
      {
        role: 'system',
        content: 'Tool execution completed: zoom_in executed successfully'
      }
    ];
    expect(service.hasViewStateChangedSinceLastExecution('find_primer_binding_sites', history2)).toBe(true);

    // Scenario 3: Target tool executed, but view changed BEFORE it, not after
    const history3 = [
      {
        role: 'system',
        content: 'Tool execution completed: zoom_in executed successfully'
      },
      {
        role: 'system',
        content: 'Tool execution completed: find_primer_binding_sites executed successfully with parameters: {"sequence":"GCAATAT"}: 1'
      }
    ];
    expect(service.hasViewStateChangedSinceLastExecution('find_primer_binding_sites', history3)).toBe(false);
  });

  it('should terminate after successful primer binding site searches', () => {
    const service = new LLMContextService({}, {});

    const shouldTerminate = service.shouldTerminateAfterToolExecution(
      [{ tool_name: 'find_primer_binding_sites' }],
      [{
        tool: 'find_primer_binding_sites',
        result: {
          queryLength: 21,
          sites: [{ start: 24, end: 45, strand: '+', mismatches: 0 }],
        },
      }],
      'Find binding sites for primer GCAATATGTCTCTGTGTGGAT on the current genome.',
    );

    expect(shouldTerminate).toBe(true);
  });

  it('should terminate after successful simple pan requests', () => {
    const service = new LLMContextService({}, {});

    const shouldTerminate = service.shouldTerminateAfterToolExecution(
      [{ tool_name: 'pan_right' }],
      [{
        tool: 'pan_right',
        result: {
          success: true,
          message: 'Panned right',
          newRange: { chromosome: 'U00096', start: 10000, end: 20000 },
        },
      }],
      'pan right',
    );

    expect(shouldTerminate).toBe(true);
  });
});
