/**
 * Tool Policy Robustness Tests
 */
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
  // we will extract only the helper methods we want to test: normalizeParams, areParametersEqual,
  // wasToolExecutedSuccessfully, getToolExecutionCount, and findExistingExecution.
  
  // We can construct a mock class containing these methods
  const normalizeParamsMatch = content.match(/normalizeParams\s*\(params\)\s*\{[\s\S]*?\}\n\n\s*areParametersEqual/);
  const areParametersEqualMatch = content.match(/areParametersEqual\s*\(params1,\s*params2\)\s*\{[\s\S]*?\}\n\n\s*\/\*\*/);
  const extractParametersMatch = content.match(/extractParametersFromExecutionMessage\s*\(content\)\s*\{[\s\S]*?\}\n\n\s*\/\*\*/);
  const wasToolExecutedSuccessfullyMatch = content.match(/wasToolExecutedSuccessfully\s*\(toolKey,\s*conversationHistory\)\s*\{[\s\S]*?\}\n\n\s*\/\*\*/);
  const getToolExecutionCountMatch = content.match(/getToolExecutionCount\s*\(toolKey,\s*conversationHistory\)\s*\{[\s\S]*?\}\n\n\s*\/\*\*/);
  const findExistingExecutionMatch = content.match(/findExistingExecution\s*\(toolKey,\s*conversationHistory\)\s*\{[\s\S]*?\}\n\n\s*\/\*\*/);

  const normalizeParamsCode = normalizeParamsMatch ? normalizeParamsMatch[0].replace('areParametersEqual', '') : '';
  const areParametersEqualCode = areParametersEqualMatch ? areParametersEqualMatch[0].replace('/**', '') : '';
  const extractParametersCode = extractParametersMatch ? extractParametersMatch[0].replace('/**', '') : '';
  const wasToolExecutedSuccessfullyCode = wasToolExecutedSuccessfullyMatch ? wasToolExecutedSuccessfullyMatch[0].replace('/**', '') : '';
  const getToolExecutionCountCode = getToolExecutionCountMatch ? getToolExecutionCountMatch[0].replace('/**', '') : '';
  const findExistingExecutionCode = findExistingExecutionMatch ? findExistingExecutionMatch[0].replace('/**', '') : '';

  const mockClassCode = `
    class MockChatManager {
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
});
