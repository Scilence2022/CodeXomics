import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

function loadLoopSupportClass() {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/renderer/modules/ChatManager.js'), 'utf8');
  const match = source.match(
    /\n\s{2}isInstructionalRequest\(message\) \{[\s\S]*?\n\s{2}createToolExecutionState\(originalMessage\) \{[\s\S]*?\n\s{2}\}\n\n\s{2}recordToolExecutionState/
  );
  if (!match) throw new Error('Unable to extract ChatManager loop support methods');
  const methods = match[0].replace(/^\n/, '').replace(/\n\n\s{2}recordToolExecutionState$/, '');
  // eslint-disable-next-line no-new-func -- loads the real source methods into an isolated class
  return new Function(`return class LoopSupport {\n${methods}\n}`)();
}

describe('ChatManager bounded model-turn recovery', () => {
  it('retries planning-only action prose instead of treating it as final', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const state = manager.createToolExecutionState('select lysC gene');
    const analysis = {
      text: "I'll start by searching for the lysC gene.",
      toolCalls: [],
      invalidToolCalls: [],
      isEmpty: false,
    };

    const decision = manager.getModelTurnRecoveryDecision(analysis, state, 1, 10);

    expect(decision.action).toBe('retry');
    expect(decision.reason).toContain('announced an action');
    expect(state.protocolRecoveryAttempts).toBe(1);
  });

  it('allows a genuine conversational answer to terminate', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const state = manager.createToolExecutionState('What is lysC?');

    const decision = manager.getModelTurnRecoveryDecision(
      {
        text: 'lysC encodes aspartokinase III.',
        toolCalls: [],
        invalidToolCalls: [],
        isEmpty: false,
      },
      state,
      1,
      10
    );

    expect(decision.action).toBe('complete');
    expect(state.protocolRecoveryAttempts).toBe(0);
  });

  it('does not repair-loop an action phrase inside a conversational explanation', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const state = manager.createToolExecutionState('How do I use BLAST?');

    const decision = manager.getModelTurnRecoveryDecision(
      {
        text: "I'll explain how to use BLAST in CodeXomics.",
        toolCalls: [],
        invalidToolCalls: [],
        isEmpty: false,
      },
      state,
      1,
      10
    );

    expect(decision.action).toBe('complete');
  });

  it('does not classify generic knowledge prompts as app actions', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();

    expect(manager.requestRequiresToolExecution('calculate 2+2')).toBe(false);
    expect(manager.requestRequiresToolExecution('Could you calculate 2+2?')).toBe(false);
    expect(manager.requestRequiresToolExecution('show me how DNA replication works')).toBe(false);
    expect(manager.requestRequiresToolExecution('analyze why lysC matters')).toBe(false);
    expect(manager.requestRequiresToolExecution('Analyze why the lysC gene is essential')).toBe(false);
    expect(manager.requestRequiresToolExecution('calculate GC content for this gene')).toBe(true);
    expect(manager.requestRequiresToolExecution('analyze protein domains in the current lysC gene')).toBe(true);
    expect(manager.requestRequiresToolExecution('find the capital of France')).toBe(false);
    expect(manager.requestRequiresToolExecution('search for the best sorting algorithm')).toBe(false);
    expect(manager.requestRequiresToolExecution('open the discussion with a summary')).toBe(false);
    expect(manager.requestRequiresToolExecution('set the active gene to lysC')).toBe(true);
    expect(manager.requestRequiresToolExecution("I'd like you to select lysC gene")).toBe(true);
    expect(manager.requestRequiresToolExecution('I want to select lysC gene')).toBe(true);
    expect(manager.requestRequiresToolExecution('I need to open a new tab')).toBe(true);
  });

  it('treats imperative retrieval prompts as app actions', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();

    expect(manager.requestRequiresToolExecution('Get the current track display settings.')).toBe(true);
    expect(manager.requestRequiresToolExecution('Get the current content of the sequence clipboard.')).toBe(true);
    expect(manager.requestRequiresToolExecution('Get features near position 500000 within a 5000bp range.')).toBe(true);
    expect(manager.requestRequiresToolExecution('List all chromosomes (contigs) in the loaded genome.')).toBe(true);
    expect(manager.requestRequiresToolExecution('Perform genome-wide codon usage analysis.')).toBe(true);

    // Conceptual questions must stay informational.
    expect(manager.requestRequiresToolExecution('What is a codon?')).toBe(false);
    expect(manager.requestRequiresToolExecution('How do I get the sequence of a gene?')).toBe(false);
  });

  it('does not suppress retrieval-only tools on informational requests', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();

    // No capability policy wired up: name alone must be enough.
    for (const tool of [
      'get_chromosome_list',
      'get_clipboard_content',
      'get_action_list',
      'get_nearby_features',
      'get_all_track_settings',
      'genome_codon_usage_analysis',
    ]) {
      expect(manager.isReadOnlyToolForInformationalRequest(tool)).toBe(true);
    }

    for (const tool of ['load_genome_file', 'delete_annotation', 'set_track_settings', 'show_action_list']) {
      expect(manager.isReadOnlyToolForInformationalRequest(tool)).toBe(false);
    }
  });

  it('disables text-derived calls for instructional prompts and rejects unadvertised tools', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    let receivedOptions;
    manager.services = {
      intent: {
        analyzeResponse: (_response, options) => {
          receivedOptions = options;
          return {
            displayText: 'Example call.',
            toolCalls: [{ tool_name: 'delete_primers', parameters: {}, source: 'internal' }],
            invalidToolCalls: [],
            isEmpty: false,
          };
        },
      },
    };
    manager.lastSystemPromptMetadata = { selectedTools: [{ name: 'select_gene' }] };

    const analysis = manager.analyzeLLMResponse('response', 'How do I use delete_primers?');
    const instructionalOptions = receivedOptions;
    const unadvertised = manager.analyzeLLMResponse('response', 'select lysC gene');

    expect(instructionalOptions.allowTextToolCalls).toBe(false);
    expect(analysis.toolCalls).toEqual([]);
    expect(analysis.suppressedToolCalls[0].reason).toContain('informational request');
    expect(unadvertised.invalidToolCalls[0].reason).toContain('not advertised');
  });

  it('recognizes the same action verbs in polite requests', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    manager.services = {
      intent: {
        analyzeResponse: () => ({
          displayText: '',
          toolCalls: [{ tool_name: 'zoom_in', parameters: {}, source: 'internal' }],
          invalidToolCalls: [],
          isEmpty: false,
        }),
      },
    };
    manager.lastSystemPromptMetadata = { selectedTools: [{ name: 'zoom_in' }] };

    expect(manager.analyzeLLMResponse('response', 'Could you zoom in?').toolCalls).toHaveLength(1);

    manager.services.intent.analyzeResponse = () => ({
      displayText: '',
      toolCalls: [{ tool_name: 'highlight_region', parameters: {}, source: 'internal' }],
      invalidToolCalls: [],
      isEmpty: false,
    });
    manager.lastSystemPromptMetadata = { selectedTools: [{ name: 'highlight_region' }] };
    expect(manager.analyzeLLMResponse('response', 'Would you highlight this region?').toolCalls).toHaveLength(1);
  });

  it('allows read-only lookup calls but suppresses state changes for informational requests', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    manager.services = {
      intent: {
        analyzeResponse: () => ({
          displayText: 'Checking.',
          toolCalls: [
            { tool_name: 'find_gene_by_name', parameters: { name: 'lysC' }, source: 'internal' },
            { tool_name: 'select_gene', parameters: { geneName: 'lysC' }, source: 'internal' },
          ],
          invalidToolCalls: [],
          isEmpty: false,
        }),
      },
    };

    const analysis = manager.analyzeLLMResponse('response', 'What is lysC?');

    expect(analysis.toolCalls.map(call => call.tool_name)).toEqual(['find_gene_by_name']);
    expect(analysis.suppressedToolCalls.map(call => call.tool_name)).toEqual(['select_gene']);
  });

  it('rejects a select_gene call whose target contradicts the request', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    manager.services = {
      intent: {
        analyzeResponse: () => ({
          displayText: '',
          toolCalls: [{ tool_name: 'select_gene', parameters: { geneName: 'lacZ' }, source: 'internal' }],
          invalidToolCalls: [],
          isEmpty: false,
        }),
      },
    };
    manager.lastSystemPromptMetadata = { selectedTools: [{ name: 'select_gene' }] };

    const analysis = manager.analyzeLLMResponse('response', 'select lysC gene');

    expect(analysis.toolCalls).toEqual([]);
    expect(analysis.invalidToolCalls[0].reason).toContain('does not match the requested gene lysC');
  });

  it('keeps a valid informational answer after suppressing an unauthorized state change', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    manager.services = {
      intent: {
        analyzeResponse: () => ({
          displayText: 'lysC encodes aspartokinase III.',
          toolCalls: [{ tool_name: 'select_gene', parameters: { geneName: 'lysC' }, source: 'internal' }],
          invalidToolCalls: [],
          isEmpty: false,
        }),
      },
    };
    const analysis = manager.analyzeLLMResponse('response', 'What is lysC?');
    const decision = manager.getModelTurnRecoveryDecision(
      analysis,
      manager.createToolExecutionState('What is lysC?'),
      1,
      10
    );

    expect(analysis.toolCalls).toEqual([]);
    expect(analysis.suppressedToolCalls).toHaveLength(1);
    expect(decision.action).toBe('complete');
  });

  it('repairs mixed or incomplete protocol responses before any tool executes', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();

    expect(
      manager.shouldRecoverBeforeToolExecution({
        toolCalls: [{ tool_name: 'select_gene' }],
        invalidToolCalls: [{ reason: 'bad arguments' }],
      })
    ).toBe(true);
    expect(
      manager.shouldRecoverBeforeToolExecution({
        toolCalls: [{ tool_name: 'select_gene' }],
        invalidToolCalls: [],
        stopReason: 'max_tokens',
      })
    ).toBe(true);
    expect(
      manager.shouldRecoverBeforeToolExecution({
        toolCalls: [{ tool_name: 'select_gene' }],
        invalidToolCalls: [],
        stopReason: 'tool_calls',
      })
    ).toBe(false);
    expect(
      manager.shouldRecoverBeforeToolExecution({
        toolCalls: [{ tool_name: 'select_gene' }],
        invalidToolCalls: [],
        stopReason: 'MALFORMED_FUNCTION_CALL',
      })
    ).toBe(true);
    expect(
      manager.shouldRecoverBeforeToolExecution({
        toolCalls: [{ tool_name: 'select_gene' }],
        invalidToolCalls: [],
        stopReason: 'UNEXPECTED_TOOL_CALL',
      })
    ).toBe(true);
  });

  it('does not accept an unverified success claim for an actionable request', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const state = manager.createToolExecutionState('select lysC gene');

    const decision = manager.getModelTurnRecoveryDecision(
      {
        text: 'The lysC gene has been selected.',
        toolCalls: [],
        invalidToolCalls: [],
        isEmpty: false,
      },
      state,
      1,
      10
    );
    const clarification = manager.getModelTurnRecoveryDecision(
      {
        text: 'Which chromosome should I use?',
        toolCalls: [],
        invalidToolCalls: [],
        isEmpty: false,
      },
      manager.createToolExecutionState('select the gene'),
      1,
      10
    );

    expect(decision.action).toBe('retry');
    expect(decision.reason).toContain('without a verified successful tool execution');
    expect(clarification.action).toBe('complete');
  });

  it('does not let a successful search satisfy a gene-selection request', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const searchState = manager.createToolExecutionState('select lysC gene');
    searchState.records.push({ tool: 'find_gene_by_name', status: 'success' });
    const selectionState = manager.createToolExecutionState('select lysC gene');
    selectionState.records.push({ tool: 'select_gene', parameters: { geneName: 'lysC' }, status: 'success' });

    const searchDecision = manager.getModelTurnRecoveryDecision(
      { text: 'Found lysC in the current genome.', toolCalls: [], invalidToolCalls: [], isEmpty: false },
      searchState,
      2,
      10
    );
    const selectionDecision = manager.getModelTurnRecoveryDecision(
      { text: 'lysC is selected.', toolCalls: [], invalidToolCalls: [], isEmpty: false },
      selectionState,
      2,
      10
    );

    expect(searchDecision.action).toBe('retry');
    expect(selectionDecision.action).toBe('complete');

    const shorthandState = manager.createToolExecutionState('select lysC');
    shorthandState.records.push({ tool: 'find_gene_by_name', status: 'success' });
    expect(manager.hasSuccessfulExecutionForRequest(shorthandState)).toBe(false);

    shorthandState.records.push({ tool: 'select_gene', parameters: { geneName: 'lysC' }, status: 'success' });
    expect(manager.hasSuccessfulExecutionForRequest(shorthandState)).toBe(true);

    const wrongTargetState = manager.createToolExecutionState('select lysC');
    wrongTargetState.records.push({
      tool: 'select_gene',
      parameters: { geneName: 'lacZ' },
      status: 'success',
    });
    expect(manager.hasSuccessfulExecutionForRequest(wrongTargetState)).toBe(false);
  });

  it('does not mistake other short selection targets for genes', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const primerState = manager.createToolExecutionState('select all primers');
    primerState.records.push({ tool: 'select_sequence_region', status: 'success' });
    const modeState = manager.createToolExecutionState('select dark mode');
    modeState.records.push({ tool: 'switch_ui_style', status: 'success' });
    const colorState = manager.createToolExecutionState('select blue color');
    colorState.records.push({ tool: 'switch_ui_style', status: 'success' });

    expect(manager.isGeneSelectionRequest('select all primers', ['list_primers'])).toBe(false);
    expect(manager.isGeneSelectionRequest('select dark mode', ['switch_ui_style'])).toBe(false);
    expect(manager.isGeneSelectionRequest('select blue color', ['switch_ui_style'])).toBe(false);
    expect(manager.getRequestedGeneSelection('select a model for this gene')).toBeNull();
    expect(manager.getRequestedGeneSelection('select all genes')).toBeNull();
    expect(manager.hasSuccessfulExecutionForRequest(primerState)).toBe(true);
    expect(manager.hasSuccessfulExecutionForRequest(modeState)).toBe(true);
    expect(manager.hasSuccessfulExecutionForRequest(colorState)).toBe(true);
  });

  it('requires every recognized effect in a multi-step request', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const partialState = manager.createToolExecutionState('select lysC gene, then export its sequence');
    partialState.records.push({ tool: 'select_gene', parameters: { geneName: 'lysC' }, status: 'success' });
    const completeState = manager.createToolExecutionState('select lysC gene, then export its sequence');
    completeState.records.push(
      { tool: 'select_gene', parameters: { geneName: 'lysC' }, status: 'success' },
      { tool: 'export_fasta_sequence', status: 'success' }
    );

    const partial = manager.getModelTurnRecoveryDecision(
      { text: 'lysC is selected.', toolCalls: [], invalidToolCalls: [], isEmpty: false },
      partialState,
      2,
      10
    );
    const complete = manager.getModelTurnRecoveryDecision(
      { text: 'lysC was selected and exported.', toolCalls: [], invalidToolCalls: [], isEmpty: false },
      completeState,
      3,
      10
    );

    expect(partial.action).toBe('retry');
    expect(complete.action).toBe('complete');
  });

  it('does not finalize partial work from the last successful tool result', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    manager.shouldTerminateAfterToolExecution = () => true;
    const state = manager.createToolExecutionState('select lysC gene, then export its sequence');
    state.records.push({
      tool: 'select_gene',
      parameters: { geneName: 'lysC' },
      status: 'success',
    });

    expect(
      manager.canFinalizeFromSuccessfulToolResults(
        state,
        [{ tool: 'select_gene', success: true }],
        [{ tool_name: 'select_gene', parameters: { geneName: 'lysC' } }],
        state.originalMessage
      )
    ).toBe(false);
  });

  it('matches every actionable clause to a distinct successful tool result', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const partial = manager.createToolExecutionState(
      'create an annotation, edit its name, then export the annotations'
    );
    partial.records.push(
      { tool: 'create_annotation', status: 'success' },
      { tool: 'edit_annotation', status: 'success' }
    );
    const complete = manager.createToolExecutionState(
      'create an annotation, edit its name, then export the annotations'
    );
    complete.records.push(
      { tool: 'create_annotation', status: 'success' },
      { tool: 'edit_annotation', status: 'success' },
      { tool: 'export_gff_annotations', status: 'success' }
    );
    const informationalFollowUp = manager.createToolExecutionState('select lysC gene, then tell me what it does');
    informationalFollowUp.records.push({
      tool: 'select_gene',
      parameters: { geneName: 'lysC' },
      status: 'success',
    });

    expect(manager.hasSuccessfulExecutionForRequest(partial)).toBe(false);
    expect(manager.hasSuccessfulExecutionForRequest(complete)).toBe(true);
    expect(manager.hasSuccessfulExecutionForRequest(informationalFollowUp)).toBe(true);
  });

  it('requires the exact mutation, direction, and inherited-object effects', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();

    const deletion = manager.createToolExecutionState('delete the annotation');
    deletion.records.push({ tool: 'find_gene_by_name', status: 'success' });
    expect(manager.hasSuccessfulExecutionForRequest(deletion)).toBe(false);
    deletion.records.push({ tool: 'delete_annotation', status: 'success' });
    expect(manager.hasSuccessfulExecutionForRequest(deletion)).toBe(true);

    const zoom = manager.createToolExecutionState('zoom in, then zoom out');
    zoom.records.push({ tool: 'zoom_in', status: 'success' }, { tool: 'zoom_in', status: 'success' });
    expect(manager.hasSuccessfulExecutionForRequest(zoom)).toBe(false);
    zoom.records.push({ tool: 'zoom_out', status: 'success' });
    expect(manager.hasSuccessfulExecutionForRequest(zoom)).toBe(true);

    const details = manager.createToolExecutionState('select lysC gene and show its details');
    details.records.push({
      tool: 'select_gene',
      parameters: { geneName: 'lysC' },
      status: 'success',
    });
    expect(manager.hasSuccessfulExecutionForRequest(details)).toBe(false);
    details.records.push({ tool: 'get_gene_details', status: 'success' });
    expect(manager.hasSuccessfulExecutionForRequest(details)).toBe(true);

    const analysis = manager.createToolExecutionState('calculate GC and export the sequence');
    analysis.records.push({ tool: 'compute_gc', status: 'success' });
    expect(manager.hasSuccessfulExecutionForRequest(analysis)).toBe(false);
    analysis.records.push({ tool: 'export_fasta_sequence', status: 'success' });
    expect(manager.hasSuccessfulExecutionForRequest(analysis)).toBe(true);
  });

  it('requires the requested bounded repeat count before completion', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const partial = manager.createToolExecutionState('open three new tabs');
    partial.records.push({ tool: 'open_new_tab', status: 'success' });
    const complete = manager.createToolExecutionState('open three new tabs');
    complete.records.push(
      { tool: 'open_new_tab', status: 'success' },
      { tool: 'open_new_tab', status: 'success' },
      { tool: 'open_new_tab', status: 'success' }
    );

    expect(manager.hasSuccessfulExecutionForRequest(partial)).toBe(false);
    expect(manager.hasSuccessfulExecutionForRequest(complete)).toBe(true);

    const mixed = manager.createToolExecutionState('open a tab, then zoom in 3 times');
    mixed.records.push(
      { tool: 'open_new_tab', status: 'success' },
      { tool: 'zoom_in', status: 'success' },
      { tool: 'zoom_in', status: 'success' },
      { tool: 'zoom_in', status: 'success' }
    );
    expect(manager.hasSuccessfulExecutionForRequest(mixed)).toBe(true);

    const partialMixed = manager.createToolExecutionState('open a tab, then zoom in 3 times');
    partialMixed.records.push({ tool: 'open_new_tab', status: 'success' }, { tool: 'zoom_in', status: 'success' });
    expect(manager.hasSuccessfulExecutionForRequest(partialMixed)).toBe(false);

    const partialPan = manager.createToolExecutionState('pan right 3x');
    partialPan.records.push({ tool: 'pan_right', status: 'success' });
    expect(manager.hasSuccessfulExecutionForRequest(partialPan)).toBe(false);
  });

  it('allows a truthful terminal explanation after a tool failure', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const state = manager.createToolExecutionState('select missing gene');
    state.records.push({ tool: 'select_gene', status: 'failed' });

    const decision = manager.getModelTurnRecoveryDecision(
      {
        text: 'The gene could not be selected because it was not found.',
        toolCalls: [],
        invalidToolCalls: [],
        isEmpty: false,
      },
      state,
      2,
      10
    );

    expect(decision.action).toBe('complete');
  });

  it('retries read-like failures but not potentially duplicating mutations', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();

    expect(manager.canAutomaticallyRetryToolFailures([{ tool: 'select_gene' }])).toBe(true);
    expect(manager.canAutomaticallyRetryToolFailures([{ tool: 'delete_sequence' }])).toBe(false);
    expect(manager.canAutomaticallyRetryToolFailures([{ tool: 'unknown_plugin_tool' }])).toBe(false);
  });

  it('bounds repeated malformed-call recovery', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const state = manager.createToolExecutionState('select lysC gene');
    const malformed = {
      text: '{"name":"select_gene","arguments":"{bad"}',
      toolCalls: [],
      invalidToolCalls: [{ reason: 'invalid JSON arguments' }],
      hasToolCallIntent: true,
      isEmpty: false,
    };

    expect(manager.getModelTurnRecoveryDecision(malformed, state, 1, 10).action).toBe('retry');
    expect(manager.getModelTurnRecoveryDecision(malformed, state, 2, 10).action).toBe('retry');
    const finalDecision = manager.getModelTurnRecoveryDecision(malformed, state, 3, 10);

    expect(finalDecision.action).toBe('fail');
    expect(finalDecision.finalResponse).toContain('repeatedly returned');
    expect(state.protocolRecoveryAttempts).toBe(2);
  });

  it('does not retry provider refusal and does retry truncation', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();

    const refusal = manager.getModelTurnRecoveryDecision(
      { text: '', toolCalls: [], invalidToolCalls: [], isEmpty: true, stopReason: 'refusal' },
      manager.createToolExecutionState('do something'),
      1,
      10
    );
    const truncation = manager.getModelTurnRecoveryDecision(
      { text: '{"tool_name":', toolCalls: [], invalidToolCalls: [], stopReason: 'max_tokens' },
      manager.createToolExecutionState('select lysC gene'),
      1,
      10
    );

    expect(refusal.action).toBe('fail');
    expect(truncation.action).toBe('retry');
    expect(truncation.reason).toContain('truncated');
  });

  it('returns an explicit incomplete result at the round limit', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    manager.generateCompletionResponseFromToolResults = () => 'Selected lysC.';

    expect(manager.buildRoundLimitResponse(20)).toContain('may be incomplete');
    expect(
      manager.buildRoundLimitResponse(20, [{ tool: 'select_gene', success: true }], [{ tool_name: 'select_gene' }])
    ).toContain('Last successful tool result:\nSelected lysC.');
  });
});
