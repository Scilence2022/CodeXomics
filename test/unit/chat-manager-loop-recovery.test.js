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
  // The extracted methods reference module-level constants. Lift them from the
  // same source rather than restating them, so the sandbox cannot drift.
  const constants = (source.match(/^const [A-Z_]+ = .*;$/gm) || []).join('\n');
  // eslint-disable-next-line no-new-func -- loads the real source methods into an isolated class
  return new Function(`${constants}\nreturn class LoopSupport {\n${methods}\n}`)();
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

  it('treats imperative UI and settings prompts as app actions', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();

    // Plural nouns: "settings" must match the app-context vocabulary, not just "setting".
    expect(manager.requestRequiresToolExecution('Open the settings modal.')).toBe(true);
    expect(manager.requestRequiresToolExecution('Open or configure export settings for the current workspace.')).toBe(
      true
    );
    expect(manager.requestRequiresToolExecution('Change the application appearance to the midnight style.')).toBe(true);
    expect(manager.requestRequiresToolExecution('Expand the main genome browser Sidebar.')).toBe(true);
    expect(manager.requestRequiresToolExecution('Expand the top banner area.')).toBe(true);
    expect(manager.requestRequiresToolExecution('View the /tmp/test_data/README.md file in the markdown viewer.')).toBe(
      true
    );
    expect(manager.requestRequiresToolExecution('Check if BLAST is installed and available on the system.')).toBe(true);

    // Off-topic imperatives must stay conversational.
    expect(manager.requestRequiresToolExecution('open the discussion with a summary')).toBe(false);
    expect(manager.requestRequiresToolExecution('find the capital of France')).toBe(false);
  });

  it('recognizes provider-namespaced retrieval tools as read-only', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();

    for (const tool of [
      'blast_get_installation_status',
      'blast_list_databases',
      'uniprot_get_protein',
      'alphafold_get_structure',
      'get_track_status',
    ]) {
      expect(manager.isReadOnlyToolForInformationalRequest(tool)).toBe(true);
    }

    for (const tool of ['blast_create_database', 'blast_delete_database', 'uninstall_plugin']) {
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

  const ANNOTATION_CRUD =
    "Create a new custom regulatory annotation named 'regulatory_region_A' on chromosome 'U00096' spanning " +
    'start position 150000 to end position 150500, then update its note description to ' +
    "'Highly conserved regulatory region', and list all annotations in that region to verify.";
  const BLAST_WORKFLOW =
    'Detect the type of sequence ATGAAAGCGCTGAAAGCGCTG, run blast_search against nt with blastn and max 5 ' +
    'targets, filter the BLAST results to hits with at least 90 percent identity and at most 5 hits, then ' +
    'export the BLAST results as CSV to /tmp/exported_files/benchmark_blast_results.csv. Always run the ' +
    'filter and export steps on the search results, including when the search returns zero hits - an empty ' +
    'filtered set and a header-only CSV are the expected outcome in that case.';

  function stateFor(manager, message, tools) {
    const state = manager.createToolExecutionState(message);
    for (const tool of tools) state.records.push({ tool, status: 'success' });
    return state;
  }

  it('completes a workflow whose closing step only lists or gets data', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();

    // A "list ... to verify" tail used to be actionable but unclassifiable, which
    // made the request permanently unsatisfiable no matter what the model did.
    expect(
      manager.hasSuccessfulExecutionForRequest(
        stateFor(manager, ANNOTATION_CRUD, ['create_annotation', 'update_annotation', 'list_annotations'])
      )
    ).toBe(true);
    expect(
      manager.hasSuccessfulExecutionForRequest(
        stateFor(manager, ANNOTATION_CRUD, ['create_annotation', 'update_annotation'])
      )
    ).toBe(false);
    expect(
      manager.hasSuccessfulExecutionForRequest(
        stateFor(
          manager,
          'Create a temporary CDS annotation named X at 160000-160900, bulk update that annotation to set its ' +
            'description to Y, get its annotation history, and then list annotations in that region.',
          ['create_annotation', 'bulk_update_annotations', 'get_annotation_history', 'list_annotations']
        )
      )
    ).toBe(true);
  });

  it('treats a workflow led by an unlisted verb as an action request', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();

    // Whether the leading verb is known decides whether every state-changing call
    // in the request is allowed to execute at all.
    expect(manager.requestRequiresToolExecutionAnywhere(BLAST_WORKFLOW)).toBe(true);
    expect(manager.requestRequiresToolExecutionAnywhere('What does the lysC gene do?')).toBe(false);
    expect(manager.requestRequiresToolExecutionAnywhere('How do I use BLAST?')).toBe(false);
  });

  it('recognizes provider-namespaced tools as the steps a workflow asked for', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const complete = stateFor(manager, BLAST_WORKFLOW, [
      'blast_detect_sequence_type',
      'blast_search',
      'blast_filter_results',
      'blast_export_results',
    ]);
    const stoppedAfterSearch = stateFor(manager, BLAST_WORKFLOW, ['blast_detect_sequence_type', 'blast_search']);

    expect(manager.hasSuccessfulExecutionForRequest(complete)).toBe(true);
    expect(manager.hasSuccessfulExecutionForRequest(stoppedAfterSearch)).toBe(false);
    expect(manager.getOutstandingRequestSteps(stoppedAfterSearch).map(step => step.capability)).toEqual([
      'filter',
      'export',
    ]);
  });

  it('does not multiply a requirement because the splitter fragmented a sentence', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const { requirements } = manager.getSequentialActionRequirements(BLAST_WORKFLOW);
    const exportRequirements = requirements.filter(requirement => requirement.capability === 'export');

    expect(exportRequirements).toHaveLength(1);
    expect(exportRequirements[0].count).toBe(1);
    // An explicit repeat count is still honoured.
    expect(
      manager
        .getSequentialActionRequirements('open three new tabs')
        .requirements.find(requirement => requirement.capability === 'open_tab').count
    ).toBe(3);
  });

  it('names the outstanding step in the repair prompt', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const state = stateFor(manager, ANNOTATION_CRUD, ['create_annotation', 'list_annotations']);
    const decision = manager.getModelTurnRecoveryDecision(
      { text: 'The annotation has been created and verified.', toolCalls: [], invalidToolCalls: [], isEmpty: false },
      state,
      3,
      20
    );

    expect(decision.action).toBe('retry');
    expect(decision.outstandingSteps.map(step => step.capability)).toEqual(['edit_annotation']);

    const repair = manager.buildToolProtocolRecoveryMessage(decision.reason, decision.outstandingSteps);
    // The user's own wording, not a tool name: update_annotation and edit_annotation
    // both satisfy this step, so the prompt must not pick one for the model.
    expect(repair).toContain("- update its note description to 'Highly conserved regulatory region'");
    expect(repair).toContain('has to be performed separately');
    expect(repair).not.toContain('e.g. edit_annotation');
  });

  it('recognizes namespaced tools across the whole effect table', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const workflows = [
      [
        "Create a new nucleotide BLAST database of currently loaded E. coli genome using name 'ecoli_nucl', then " +
          'list the available BLAST databases to verify, and run a local blastn search against the database for ' +
          "the query sequence 'TTAGTTGGC'.",
        ['blast_create_db_from_genome', 'blast_list_databases', 'blast_search_local'],
      ],
      [
        'Export the current visible genomic region to /tmp/benchmark_blast_input.fasta, create a nucleotide BLAST ' +
          'database named benchmark_view_nucl from that FASTA file, validate the database, list databases, and ' +
          'then delete benchmark_view_nucl with confirmation.',
        [
          'export_current_view_fasta',
          'blast_create_database',
          'blast_validate_database',
          'blast_list_databases',
          'blast_delete_database',
        ],
      ],
    ];

    for (const [message, tools] of workflows) {
      expect(manager.hasSuccessfulExecutionForRequest(stateFor(manager, message, tools))).toBe(true);
    }
    // The verb identifying a tool is not always its first segment.
    expect(manager.verbToolMatcher('export')('blast_export_results')).toBe(true);
    expect(manager.verbToolMatcher('search')('blast_search_local')).toBe(true);
    expect(manager.verbToolMatcher('get')('uniprot_get_annotation')).toBe(true);
    expect(manager.verbToolMatcher('export')('exported_helper')).toBe(false);
  });

  it('reads a zoom multiplier as magnification rather than repetition', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();

    expect(
      manager.hasSuccessfulExecutionForRequest(
        stateFor(manager, 'Navigate to region 1230000 to 1300000 and then zoom in 10x to see the features.', [
          'navigate_to_position',
          'zoom_in',
        ])
      )
    ).toBe(true);
    // Spelled-out repetition is still a repeat count, for zoom and everything else.
    expect(manager.getRequestedExecutionCountFallback('zoom in 3 times', 'zoom_in')).toBe(3);
    expect(manager.getRequestedExecutionCountFallback('pan right 3x', 'pan_right')).toBe(3);
  });

  it('reports the steps that were never carried out when the repair budget runs out', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const state = stateFor(manager, ANNOTATION_CRUD, ['create_annotation', 'list_annotations']);
    state.protocolRecoveryAttempts = 2;
    const decision = manager.getModelTurnRecoveryDecision(
      { text: 'The annotation has been created and verified.', toolCalls: [], invalidToolCalls: [], isEmpty: false },
      state,
      5,
      20
    );

    expect(decision.action).toBe('fail');
    expect(decision.finalResponse).toContain('never carried out: edit_annotation');
  });
});

describe('ChatManager requirements read the action, not the goal', () => {
  function stateFor(manager, message, tools) {
    const state = manager.createToolExecutionState(message);
    for (const tool of tools) state.records.push({ tool, status: 'success' });
    return state;
  }

  // Verbatim instruction from the benchmark run that never finished.
  const PROTEIN_WORKFLOW =
    'Search the UniProt database for the E.coli protein DapA and verify whether the UniProt ID P0A6L2 is present. ' +
    'Also search the PDB database to find structurally resolved DapA structures; this PDB lookup may be done during ' +
    'the initial discovery step because it does not depend on InterPro results. Then retrieve the representative ' +
    'sequence using that UniProt ID and perform an InterPro domain analysis to identify key domains.';

  const EXECUTED = [
    'search_uniprot_database',
    'search_pdb_structures',
    'get_uniprot_entry',
    'analyze_interpro_domains',
  ];

  it('scores "perform an analysis to identify X" as an analysis, not a detection', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();

    const { requirements } = manager.getSequentialActionRequirements(PROTEIN_WORKFLOW);
    const capabilities = requirements.map(requirement => requirement.capability);

    expect(capabilities).toContain('analysis');
    // 'detect' only matches detect_/identify_ tools, so requiring it here left the
    // request unsatisfiable however many times the analysis actually ran.
    expect(capabilities).not.toContain('detect');
  });

  it('treats the protein workflow as complete once its four tools have run', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const state = stateFor(manager, PROTEIN_WORKFLOW, EXECUTED);

    expect(manager.hasSuccessfulExecutionForRequest(state)).toBe(true);
    expect(manager.getOutstandingRequestSteps(state)).toEqual([]);

    const decision = manager.getModelTurnRecoveryDecision(
      {
        text: 'DapA is P0A6L2. InterPro reports the DHDPS N-terminal and TIM-barrel domains; 6 PDB entries were found.',
        toolCalls: [],
        invalidToolCalls: [],
        isEmpty: false,
      },
      state,
      4,
      20
    );

    expect(decision.action).toBe('complete');
  });

  it('keeps reading the action when "to" introduces the target rather than a goal', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();

    expect(manager.stripClausePurposePhrase('jump to gene lacZ')).toBe('jump to gene lacZ');
    expect(manager.stripClausePurposePhrase('navigate to position 1000')).toBe('navigate to position 1000');
    expect(manager.stripClausePurposePhrase('switch to tab 2')).toBe('switch to tab 2');
    expect(manager.stripClausePurposePhrase('perform a domain analysis to identify key domains')).toBe(
      'perform a domain analysis'
    );
    expect(manager.stripClausePurposePhrase('export the results in order to share them')).toBe('export the results');
  });

  it('recognises the noun form of an analysis step', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const state = stateFor(manager, 'run a codon usage analysis on lysC', ['codon_usage_analysis']);

    expect(manager.hasSuccessfulExecutionForRequest(state)).toBe(true);
  });
});

describe('ChatManager repair budget survives a tool that keeps re-running', () => {
  // The loop that burned the whole turn: repair prompt, model re-runs a tool it
  // already ran, the success clears the consecutive streak, repair prompt again.
  // Neither budget ever ran out, so only the round cap or the clock stopped it.
  const UNSATISFIABLE = 'identify the promoter regions';

  const answer = {
    text: 'The promoter regions have been identified.',
    toolCalls: [],
    invalidToolCalls: [],
    isEmpty: false,
  };

  it('gives up instead of alternating repair and re-execution forever', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const state = manager.createToolExecutionState(UNSATISFIABLE);
    state.records.push({ tool: 'search_features', status: 'success' });

    expect(manager.hasSuccessfulExecutionForRequest(state)).toBe(false);

    const actions = [];
    for (let round = 1; round <= 12; round++) {
      const decision = manager.getModelTurnRecoveryDecision(answer, state, round, 20);
      actions.push(decision.action);
      if (decision.action !== 'retry') break;
      // The model answers the repair prompt by re-running a tool that succeeds,
      // which is what used to reset the budget.
      state.protocolRecoveryAttempts = 0;
    }

    expect(actions.at(-1)).toBe('fail');
    expect(actions.length).toBeLessThanOrEqual(5);
  });

  it('still allows the normal two consecutive repairs', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    const state = manager.createToolExecutionState(UNSATISFIABLE);
    state.records.push({ tool: 'search_features', status: 'success' });

    expect(manager.getModelTurnRecoveryDecision(answer, state, 1, 20).action).toBe('retry');
    expect(manager.getModelTurnRecoveryDecision(answer, state, 2, 20).action).toBe('retry');
    expect(manager.getModelTurnRecoveryDecision(answer, state, 3, 20).action).toBe('fail');
  });
});

describe('ChatManager requirements match the tools that carry them out', () => {
  const REGISTRY = [
    'get_uniprot_entry',
    'fetch_alphafold_structure',
    'open_protein_viewer',
    'search_uniprot_database',
    'analyze_interpro_domains',
    'export_data',
    'select_gene',
    'create_annotation',
    'list_annotations',
  ];

  function managerWithRegistry() {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    manager.builtInToolsMap = new Map(REGISTRY.map(name => [name, {}]));
    return manager;
  }

  function stateFor(manager, message, tools) {
    const state = manager.createToolExecutionState(message);
    for (const tool of tools) state.records.push({ tool, status: 'success' });
    return state;
  }

  // Verbatim instruction from the benchmark run that kept re-downloading.
  const ALPHAFOLD_WORKFLOW =
    "Retrieve the UniProt entry details for human protein p53 using accession ID 'P04637', download its " +
    'AlphaFold 3D structure, and then open the returned AlphaFold structure in the interactive 3D protein ' +
    'viewer using cartoon representation.';

  const EXECUTED = ['get_uniprot_entry', 'fetch_alphafold_structure', 'open_protein_viewer'];

  it('counts a fetch_ tool as the download the request asked for', () => {
    const manager = managerWithRegistry();
    const state = stateFor(manager, ALPHAFOLD_WORKFLOW, EXECUTED);

    expect(manager.hasSuccessfulExecutionForRequest(state)).toBe(true);
    expect(manager.getOutstandingRequestSteps(state)).toEqual([]);
  });

  it('does not depend on the order the model ran the tools', () => {
    const manager = managerWithRegistry();
    // "retrieve" and "download" both match fetch_alphafold_structure. Claiming the
    // first match left whichever step lost the race looking unfinished.
    const reordered = ['fetch_alphafold_structure', 'get_uniprot_entry', 'open_protein_viewer'];

    expect(manager.hasSuccessfulExecutionForRequest(stateFor(manager, ALPHAFOLD_WORKFLOW, reordered))).toBe(true);
    expect(manager.getOutstandingRequestSteps(stateFor(manager, ALPHAFOLD_WORKFLOW, reordered))).toEqual([]);
  });

  it('finishes the turn instead of asking for a download that already happened', () => {
    const manager = managerWithRegistry();
    const decision = manager.getModelTurnRecoveryDecision(
      {
        text: 'Retrieved P04637, downloaded its AlphaFold model and opened it in cartoon representation.',
        toolCalls: [],
        invalidToolCalls: [],
        isEmpty: false,
      },
      stateFor(manager, ALPHAFOLD_WORKFLOW, EXECUTED),
      3,
      20
    );

    expect(decision.action).toBe('complete');
  });

  it('still reports a download step that genuinely never ran', () => {
    const manager = managerWithRegistry();
    const state = stateFor(manager, ALPHAFOLD_WORKFLOW, ['get_uniprot_entry', 'open_protein_viewer']);

    expect(manager.getOutstandingRequestSteps(state).map(step => step.capability)).toEqual(['export']);
    expect(manager.hasSuccessfulExecutionForRequest(state)).toBe(false);
  });

  it('drops a requirement no registered tool could ever satisfy', () => {
    const manager = managerWithRegistry();
    // Nothing in the registry is named detect_/identify_, so requiring it would
    // send every finished answer into a repair it can never pass.
    const { requirements } = manager.getSequentialActionRequirements('identify the promoter regions');

    expect(requirements).toEqual([]);
    expect(
      manager.hasSuccessfulExecutionForRequest(
        stateFor(manager, 'identify the promoter regions', ['search_uniprot_database'])
      )
    ).toBe(true);
  });

  it('keeps every requirement when the registry has not loaded yet', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();
    manager.builtInToolsMap = null;

    const { requirements } = manager.getSequentialActionRequirements('identify the promoter regions');

    expect(requirements.map(requirement => requirement.capability)).toEqual(['detect']);
  });

  it('keeps a requirement whose matcher constrains parameters rather than availability', () => {
    const manager = managerWithRegistry();
    // The gene_selection matcher reads the execution record, so probing it with a
    // bare tool name says nothing about whether the tool exists.
    const { requirements } = manager.getSequentialActionRequirements('select the lysC gene');

    expect(requirements.map(requirement => requirement.capability)).toContain('gene_selection');
  });

  describe('turn termination signals', () => {
    const LoopSupport = loadLoopSupportClass();
    const manager = new LoopSupport();

    it('treats a missing stop reason as a clean completion', () => {
      expect(manager.isCleanCompletionStop({})).toBe(true);
      expect(manager.isCleanCompletionStop({ stopReason: null })).toBe(true);
      expect(manager.isCleanCompletionStop({ stopReason: '' })).toBe(true);
    });

    it('treats provider clean stops as completions', () => {
      for (const stopReason of ['stop', 'end_turn', 'end-turn', 'stop_sequence', 'eos', 'complete']) {
        expect(manager.isCleanCompletionStop({ stopReason })).toBe(true);
      }
    });

    it('rejects abnormal stop reasons as completions', () => {
      for (const stopReason of ['length', 'max_tokens', 'tool_calls', 'content_filter', 'unknown']) {
        expect(manager.isCleanCompletionStop({ stopReason })).toBe(false);
      }
    });

    it('builds a deterministic empty-response message naming the rounds', () => {
      const message = manager.buildEmptyResponseMessage(4, 10);

      expect(message).toContain('empty response');
      expect(message).toContain('rounds 3–4 of 10');
    });
  });
});
