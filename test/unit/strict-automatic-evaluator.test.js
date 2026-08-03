import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const StrictAutomaticEvaluator = require('../../src/renderer/modules/benchmark-suites/StrictAutomaticEvaluator.js');

function createEvaluator(assessmentMode = 'execution') {
  return new StrictAutomaticEvaluator({
    assessmentMode,
    validateToolCall: (name, parameters) => ({
      valid: name === 'compute_gc' ? typeof parameters.sequence === 'string' : true,
      errors: typeof parameters.sequence === 'string' ? [] : ['$.sequence is required'],
    }),
  });
}

function simpleTest(parameters = { sequence: 'ATGC' }) {
  return {
    id: 'strict_simple',
    type: 'function_call',
    complexity: 'simple',
    evaluation: 'automatic',
    maxScore: 5,
    expectedResult: { tool_name: 'compute_gc', parameters },
  };
}

describe('StrictAutomaticEvaluator', () => {
  it('rejects prose and inferred tool mentions as scoring evidence', () => {
    const evaluation = createEvaluator().evaluate(simpleTest(), {
      actualResult: {
        content: 'compute_gc completed successfully',
        functionCalls: [{ tool_name: 'compute_gc', parameters: { sequence: 'ATGC' }, executed: false }],
      },
    });

    expect(evaluation.success).toBe(false);
    expect(evaluation.score).toBe(0);
    expect(evaluation.errors).toContain('No authoritative tool calls were captured for this test');
  });

  it('requires exact expected arguments and schema-valid execution', () => {
    const evaluator = createEvaluator();
    const wrong = evaluator.evaluate(simpleTest(), {
      actualResult: {
        executedFunctionCalls: [
          { tool_name: 'compute_gc', parameters: { sequence: 'AAAA' }, success: true, executed: true },
        ],
      },
    });
    const correct = evaluator.evaluate(simpleTest(), {
      actualResult: {
        executedFunctionCalls: [
          { tool_name: 'compute_gc', parameters: { sequence: 'ATGC' }, success: true, executed: true },
        ],
      },
    });

    expect(wrong.success).toBe(false);
    expect(wrong.score).toBeLessThan(5);
    expect(wrong.details.exactSequence).toBe(true);
    expect(wrong.details.schemasExact).toBe(true);
    expect(wrong.details.executionExact).toBe(true);
    expect(wrong.errors).toHaveLength(1);
    expect(wrong.errors[0]).toContain('Argument mismatch');
    expect(correct.success).toBe(true);
    expect(correct.score).toBe(5);
  });

  it('canonically matches toggle aliases without weakening schema or execution evidence', () => {
    const evaluator = new StrictAutomaticEvaluator({
      validateToolCall: () => ({ valid: true, errors: [] }),
    });
    const test = {
      ...simpleTest(),
      expectedResult: {
        tool_name: 'toggle-track',
        parameters: { trackName: 'gc_content', visible: false },
      },
    };
    const evaluation = evaluator.evaluate(test, {
      actualResult: {
        executedFunctionCalls: [
          { tool_name: 'toggle_track', parameters: { track_name: 'GC Content', action: 'hide' }, success: true },
        ],
      },
    });

    expect(evaluation.success).toBe(true);
    expect(evaluation.details.exactSequence).toBe(true);
    expect(evaluation.details.argumentsExact).toBe(true);
    expect(evaluation.details.calls[0]).toMatchObject({
      call_observed: true,
      schema_valid: true,
      execution_observed: true,
      execution_success: true,
    });
    expect(evaluation.details.matches[0].argumentDiagnostics.aliasMatches).toContainEqual({
      expected: 'visible',
      actual: 'action',
    });
  });

  it('supports export path aliases, key casing, and explicitly marked default omission in contract mode', () => {
    const evaluator = new StrictAutomaticEvaluator({
      assessmentMode: 'contract',
      validateToolCall: () => ({ valid: true, errors: [] }),
    });
    const test = {
      ...simpleTest(),
      expectedResult: {
        tool_name: 'export_fasta_sequence',
        parameters: {
          filePath: '/tmp/result.fasta',
          includeDescription: { benchmarkDefaultValue: true },
          autoSave: { benchmarkDefaultValue: false },
        },
      },
    };
    const evaluation = evaluator.evaluate(test, {
      llmInteractionData: {
        response: {
          functionCalls: [{ tool_name: 'export-fasta-sequence', parameters: { filename: '/tmp/result.fasta' } }],
        },
      },
    });

    expect(evaluation.success).toBe(true);
    expect(evaluation.details.assessmentMode).toBe('contract');
    expect(evaluation.details.assessmentTier).toBe('native-function-contract');
    expect(evaluation.details.executionExact).toBe(false);
    expect(evaluation.details.metrics.execution_observed.observed_count).toBe(0);
    expect(evaluation.details.matches[0].argumentDiagnostics.defaultOmissions).toEqual([
      'includeDescription',
      'autoSave',
    ]);
    expect(evaluation.details.matches[0].argumentDiagnostics.aliasMatches).toContainEqual({
      expected: 'filePath',
      actual: 'filename',
    });
  });

  it('resolves concrete context values but rejects unresolved placeholder literals', () => {
    const evaluator = new StrictAutomaticEvaluator({
      assessmentMode: 'contract',
      validateToolCall: () => ({ valid: true, errors: [] }),
    });
    const test = {
      ...simpleTest(),
      expectedResult: {
        tool_name: 'navigate_to_position',
        parameters: { chromosome: '<current_chromosome>', start: 100, end: 200 },
      },
    };
    const resultFor = chromosome => ({
      llmInteractionData: {
        response: {
          functionCalls: [{ tool_name: 'navigate_to_position', parameters: { chromosome, start: 100, end: 200 } }],
        },
      },
    });

    expect(evaluator.evaluate(test, resultFor('U00096')).success).toBe(true);
    const unresolved = evaluator.evaluate(test, resultFor('<current_chromosome>'));
    expect(unresolved.success).toBe(false);
    expect(unresolved.details.exactSequence).toBe(true);
    expect(unresolved.details.schemasExact).toBe(true);
    expect(unresolved.errors).toHaveLength(1);
    expect(unresolved.errors[0]).toContain('Argument mismatch');
  });

  it('requires the full workflow in order and rejects extra calls', () => {
    const evaluator = new StrictAutomaticEvaluator({ validateToolCall: () => ({ valid: true, errors: [] }) });
    const test = {
      type: 'workflow',
      complexity: 'complex',
      evaluation: 'automatic',
      maxScore: 10,
      expectedResult: {
        tool_sequence: ['get_current_state', 'get_chromosome_list'],
        parameters: [{}, {}],
      },
    };
    const calls = [
      { tool_name: 'get_current_state', parameters: {}, success: true, executed: true },
      { tool_name: 'get_chromosome_list', parameters: {}, success: true, executed: true },
    ];

    expect(evaluator.evaluate(test, { actualResult: { executedFunctionCalls: calls } }).success).toBe(true);
    const extraCall = evaluator.evaluate(test, {
      actualResult: {
        executedFunctionCalls: [...calls, { tool_name: 'compute_gc', parameters: {}, success: true, executed: true }],
      },
    });

    expect(extraCall.success).toBe(false);
    expect(extraCall.details.argumentsExact).toBe(true);
    expect(extraCall.details.schemasExact).toBe(true);
    expect(extraCall.details.executionExact).toBe(true);
    expect(extraCall.details.unexpectedCalls).toEqual(['compute_gc']);
    expect(extraCall.errors).toEqual(["Tool sequence mismatch: unexpected observed call 3 'compute_gc'"]);
  });

  it('reports schema-invalid calls independently from tool, argument, and execution matching', () => {
    const evaluator = new StrictAutomaticEvaluator({
      validateToolCall: () => ({ valid: false, errors: ['$.forbidden is not allowed'] }),
    });
    const test = simpleTest({ sequence: 'ATGC', forbidden: true });
    const evaluation = evaluator.evaluate(test, {
      actualResult: {
        executedFunctionCalls: [
          {
            tool_name: 'compute_gc',
            parameters: { sequence: 'ATGC', forbidden: true },
            success: true,
            executed: true,
          },
        ],
      },
    });

    expect(evaluation.success).toBe(false);
    expect(evaluation.details.exactSequence).toBe(true);
    expect(evaluation.details.argumentsExact).toBe(true);
    expect(evaluation.details.schemasExact).toBe(false);
    expect(evaluation.details.executionExact).toBe(true);
    expect(evaluation.errors).toEqual(["Schema invalid for observed call 1 'compute_gc': $.forbidden is not allowed"]);
  });

  it('keeps native call observation separate from unknown execution and supports explicit contract assessment', () => {
    const result = {
      llmInteractionData: {
        response: {
          functionCalls: [{ tool_name: 'compute_gc', parameters: { sequence: 'ATGC' } }],
        },
      },
    };
    const executionEvaluation = createEvaluator('execution').evaluate(simpleTest(), result);
    const contractEvaluation = createEvaluator('contract').evaluate(simpleTest(), result);

    expect(executionEvaluation.success).toBe(false);
    expect(executionEvaluation.details.exactSequence).toBe(true);
    expect(executionEvaluation.details.argumentsExact).toBe(true);
    expect(executionEvaluation.details.schemasExact).toBe(true);
    expect(executionEvaluation.details.executionExact).toBe(false);
    expect(executionEvaluation.details.calls[0]).toMatchObject({
      call_observed: true,
      schema_valid: true,
      execution_observed: false,
      execution_success: null,
    });
    expect(executionEvaluation.errors).toEqual([
      "Execution not observed for expected call 1 'compute_gc' (observed call 1)",
    ]);

    expect(contractEvaluation.success).toBe(true);
    expect(contractEvaluation.details.contractSatisfied).toBe(true);
    expect(contractEvaluation.details.executionSatisfied).toBe(false);
    expect(contractEvaluation.details.assessmentTier).toBe('native-function-contract');
    expect(contractEvaluation.warnings).toContain(
      'Contract tier evaluates native call structure only; tool execution was not assessed'
    );
  });

  it('uses a separately captured tool result as real execution evidence', () => {
    const evaluation = createEvaluator('execution').evaluate(simpleTest(), {
      llmInteractionData: {
        response: {
          functionCalls: [{ id: 'call-1', tool_name: 'compute_gc', parameters: { sequence: 'ATGC' } }],
          toolExecutions: [{ tool_call_id: 'call-1', tool_name: 'compute_gc', success: true, status: 'completed' }],
        },
      },
    });

    expect(evaluation.success).toBe(true);
    expect(evaluation.details.calls[0]).toMatchObject({
      call_observed: true,
      schema_valid: true,
      execution_observed: true,
      execution_success: true,
    });
  });

  it('expands repeated-call contracts such as opening five tabs', () => {
    const evaluator = createEvaluator('contract');
    const test = {
      id: 'repeat-call',
      expectedResult: {
        tool_name: 'open_new_tab',
        parameters: {},
        expectedTabsIncrease: 5,
      },
    };
    const calls = Array.from({ length: 5 }, () => ({ tool_name: 'open_new_tab', parameters: {} }));

    const evaluation = evaluator.evaluate(test, {
      actualResult: { nativeFunctionCalls: calls },
    });

    expect(evaluation.success).toBe(true);
    expect(evaluation.details.expectedTools).toEqual(Array(5).fill('open_new_tab'));
    expect(evaluation.details.exactSequence).toBe(true);
  });

  it('resolves nested benchmarkAnyOf parameter alternatives', () => {
    const evaluator = createEvaluator('contract');
    const test = {
      id: 'nested-anyof',
      complexity: 'complex',
      maxScore: 15,
      expectedResult: {
        tool_sequence: ['bulk_update_annotations'],
        parameters: [
          {
            updates: [
              {
                identifier: 'benchmark_bulk_gene',
                updates: { benchmarkAnyOf: [{ description: 'Bulk benchmark annotation' }, { note: 'other' }] },
              },
            ],
          },
        ],
      },
    };

    const evaluation = evaluator.evaluate(test, {
      actualResult: {
        nativeFunctionCalls: [
          {
            tool_name: 'bulk_update_annotations',
            parameters: {
              updates: [{ identifier: 'benchmark_bulk_gene', updates: { description: 'Bulk benchmark annotation' } }],
            },
          },
        ],
      },
    });

    expect(evaluation.success).toBe(true);
  });

  describe('completion mode', () => {
    const schemaValidator = (name, parameters) => {
      if (name === 'switch_to_tab') {
        const valid = ['tab_id', 'tab_name', 'tab_index'].some(
          key => parameters[key] !== undefined && parameters[key] !== ''
        );
        return { valid, errors: valid ? [] : ['$.at least one selector required'] };
      }
      if (name === 'toggle_track') {
        const valid = [
          'genes',
          'gc_content',
          'sequence',
          'variants',
          'reads',
          'proteins',
          'primers',
          'actions',
          'wigTracks',
          'blast',
        ].includes(parameters.track_name);
        return { valid, errors: valid ? [] : ['$.track_name must be one of the track enums'] };
      }
      if (name === 'blast_create_quick_db_for_current_genome') {
        return { valid: typeof parameters.genomeName === 'string', errors: [] };
      }
      if (name === 'create_annotation') {
        const valid = typeof parameters.chromosome === 'string';
        return { valid, errors: valid ? [] : ['$.chromosome is required'] };
      }
      return { valid: true, errors: [] };
    };
    const completionEvaluator = () =>
      new StrictAutomaticEvaluator({ assessmentMode: 'completion', validateToolCall: schemaValidator });

    it('ignores extra read-only calls', () => {
      const test = {
        id: 'completion-extra-readonly',
        complexity: 'simple',
        maxScore: 5,
        expectedResult: { tool_name: 'select_gene', parameters: { geneName: 'lacZ' } },
      };
      const evaluation = completionEvaluator().evaluate(test, {
        actualResult: {
          nativeFunctionCalls: [
            { tool_name: 'select_gene', parameters: { geneName: 'lacZ' } },
            { tool_name: 'get_gene_details', parameters: { geneName: 'lacZ' } },
          ],
        },
      });

      expect(evaluation.success).toBe(true);
    });

    it('rejects extra state-changing calls', () => {
      const test = {
        id: 'completion-extra-stateful',
        complexity: 'simple',
        maxScore: 5,
        expectedResult: { tool_name: 'compute_gc', parameters: { sequence: 'ATGC' } },
      };
      const evaluation = completionEvaluator().evaluate(test, {
        actualResult: {
          nativeFunctionCalls: [
            { tool_name: 'compute_gc', parameters: { sequence: 'ATGC' } },
            { tool_name: 'delete_annotation', parameters: { identifier: 'lacZ' } },
          ],
        },
      });

      expect(evaluation.success).toBe(false);
    });

    it('tolerates execute_actions as the documented follow-up of a queued edit tool', () => {
      const test = {
        id: 'completion-paste-execute-workflow',
        complexity: 'simple',
        maxScore: 5,
        expectedResult: { tool_name: 'paste_sequence', parameters: { position: 600000 } },
      };
      const evaluation = completionEvaluator().evaluate(test, {
        actualResult: {
          nativeFunctionCalls: [
            { tool_name: 'get_clipboard_content', parameters: {} },
            { tool_name: 'paste_sequence', parameters: { position: 600000 } },
            { tool_name: 'execute_actions', parameters: { auto_save: true } },
          ],
        },
      });

      expect(evaluation.success).toBe(true);
    });

    it('tolerates export_genbank_format that repeats the execute_actions export file', () => {
      const test = {
        id: 'completion-execute-export-duplicate',
        complexity: 'simple',
        maxScore: 5,
        expectedResult: {
          tool_name: 'execute_actions',
          parameters: { filename: '/tmp/edited.gbk', auto_save: true },
        },
      };
      const evaluation = completionEvaluator().evaluate(test, {
        actualResult: {
          nativeFunctionCalls: [
            { tool_name: 'execute_actions', parameters: { filename: '/tmp/edited.gbk', auto_save: true } },
            {
              tool_name: 'export_genbank_format',
              parameters: { filename: '/tmp/edited.gbk', auto_save: true, include_features: true },
            },
          ],
        },
      });

      expect(evaluation.success).toBe(true);
    });

    it('tolerates highlight_region labelled with the selected gene', () => {
      const test = {
        id: 'completion-select-highlight-duplicate',
        complexity: 'simple',
        maxScore: 5,
        expectedResult: { tool_name: 'select_gene', parameters: { geneName: 'lacZ' } },
      };
      const evaluation = completionEvaluator().evaluate(test, {
        actualResult: {
          nativeFunctionCalls: [
            { tool_name: 'select_gene', parameters: { geneName: 'lacZ' } },
            { tool_name: 'get_gene_details', parameters: { geneName: 'lacZ' } },
            { tool_name: 'highlight_region', parameters: { start: 363231, end: 366305, label: 'lacZ' } },
          ],
        },
      });

      expect(evaluation.success).toBe(true);
    });

    it('ignores a read-only changeset query after a successful annotation update', () => {
      const test = {
        id: 'completion-annotation-changeset-query',
        complexity: 'simple',
        maxScore: 5,
        expectedResult: {
          tool_name: 'update_annotation',
          parameters: { identifier: 'fakG', updates: { description: 'Updated fakG gene annotation' } },
        },
      };
      const evaluation = completionEvaluator().evaluate(test, {
        actualResult: {
          nativeFunctionCalls: [
            {
              tool_name: 'update_annotation',
              parameters: { identifier: 'fakG', updates: { description: 'Updated fakG gene annotation' } },
            },
            { tool_name: 'get_annotation_changeset', parameters: { changeSetId: 'cs_1' } },
          ],
        },
      });

      expect(evaluation.success).toBe(true);
    });

    it('ignores read-only per-track settings queries after get_all_track_settings', () => {
      const test = {
        id: 'completion-track-settings-queries',
        complexity: 'simple',
        maxScore: 5,
        expectedResult: { tool_name: 'get_all_track_settings', parameters: {} },
      };
      const evaluation = completionEvaluator().evaluate(test, {
        actualResult: {
          nativeFunctionCalls: [
            { tool_name: 'get_all_track_settings', parameters: {} },
            { tool_name: 'get_track_settings', parameters: { track_type: 'genes' } },
            { tool_name: 'get_track_settings', parameters: { track_type: 'gc' } },
            { tool_name: 'get_track_settings', parameters: { track_type: 'reads' } },
          ],
        },
      });

      expect(evaluation.success).toBe(true);
    });

    it('accepts a schema-valid start-only navigation for a grouped alternative oracle', () => {
      const test = {
        id: 'completion-grouped-navigation-alternative',
        complexity: 'complex',
        maxScore: 15,
        expectedResult: {
          tool_sequence: ['design_primers', ['jump_to_gene', 'zoom_to_gene', 'navigate_to_position'], 'toggle_track'],
          parameters: [
            { geneName: 'lysC', upstreamBp: 50 },
            {
              benchmarkAnyOf: [
                { geneName: 'lysC' },
                {
                  chromosome: '<current_chromosome>',
                  start: '{design_primers.target.start}',
                  end: '{design_primers.target.end}',
                },
              ],
            },
            { track_name: 'primers', visible: true },
          ],
        },
      };
      const evaluation = completionEvaluator().evaluate(test, {
        actualResult: {
          nativeFunctionCalls: [
            { tool_name: 'design_primers', parameters: { geneName: 'lysC', upstreamBp: 50 } },
            { tool_name: 'navigate_to_position', parameters: { start: 4232600 } },
            { tool_name: 'toggle_track', parameters: { track_name: 'primers', visible: true } },
          ],
        },
      });

      expect(evaluation.success).toBe(true);
    });

    it('ignores an extra verification screenshot after the required calls', () => {
      const test = {
        id: 'completion-extra-screenshot',
        complexity: 'complex',
        maxScore: 15,
        expectedResult: {
          tool_sequence: ['design_primers', 'toggle_track'],
          parameters: [
            { geneName: 'lysC', upstreamBp: 50 },
            { track_name: 'primers', visible: true },
          ],
        },
      };
      const evaluation = completionEvaluator().evaluate(test, {
        actualResult: {
          nativeFunctionCalls: [
            { tool_name: 'design_primers', parameters: { geneName: 'lysC', upstreamBp: 50 } },
            { tool_name: 'toggle_track', parameters: { track_name: 'primers', visible: true } },
            { tool_name: 'capture_screenshot', parameters: { auto_save: true, target: 'tracks' } },
          ],
        },
      });

      expect(evaluation.success).toBe(true);
    });

    it('accepts an equivalent blast database-creation tool with an alternative name key', () => {
      const test = {
        id: 'completion-blast-equivalent',
        complexity: 'complex',
        maxScore: 15,
        expectedResult: {
          tool_sequence: ['blast_create_db_from_genome', 'blast_list_databases', 'blast_search_local'],
          parameters: [{ chromosome: '<current_chromosome>', dbName: 'ecoli_nucl' }, {}, {}],
        },
      };
      const evaluation = completionEvaluator().evaluate(test, {
        actualResult: {
          nativeFunctionCalls: [
            {
              tool_name: 'blast_create_quick_db_for_current_genome',
              parameters: { createNucleotide: true, genomeName: 'ecoli_nucl' },
            },
            { tool_name: 'blast_list_databases', parameters: {} },
            { tool_name: 'blast_search_local', parameters: {} },
          ],
        },
      });

      expect(evaluation.success).toBe(true);
    });

    it('accepts a schema-valid alternative selector for switch_to_tab', () => {
      const test = {
        id: 'completion-tab-index',
        complexity: 'complex',
        maxScore: 10,
        expectedResult: {
          tool_sequence: ['open_new_tab', 'switch_to_tab', 'close_tab'],
          parameters: [{}, { tab_id: '{open_new_tab.tab_id}' }, {}],
        },
      };
      const evaluation = completionEvaluator().evaluate(test, {
        actualResult: {
          nativeFunctionCalls: [
            { tool_name: 'open_new_tab', parameters: {} },
            { tool_name: 'switch_to_tab', parameters: { tab_index: 1 } },
            { tool_name: 'close_tab', parameters: {} },
          ],
        },
      });

      expect(evaluation.success).toBe(true);
    });

    it('accepts the schema-documented start-only spelling for navigate_to_position', () => {
      const test = {
        id: 'completion-nav-position-alias',
        complexity: 'simple',
        maxScore: 5,
        expectedResult: { tool_name: 'navigate_to_position', parameters: { position: 3500000 } },
      };
      const evaluation = completionEvaluator().evaluate(test, {
        actualResult: {
          nativeFunctionCalls: [
            {
              tool_name: 'navigate_to_position',
              parameters: { start: 3500000 },
              executed: true,
              executionSuccess: true,
            },
          ],
        },
      });

      expect(evaluation.success).toBe(true);
    });

    it('normalizes track-name aliases before schema validation', () => {
      const test = {
        id: 'completion-track-alias',
        complexity: 'simple',
        maxScore: 5,
        expectedResult: { tool_name: 'toggle_track', parameters: { track_name: 'gc_content', visible: true } },
      };
      const evaluation = completionEvaluator().evaluate(test, {
        actualResult: {
          nativeFunctionCalls: [{ tool_name: 'toggle_track', parameters: { track_name: 'gc', visible: true } }],
        },
      });

      expect(evaluation.success).toBe(true);
    });

    it('still fails when a required parameter is absent and schema-invalid', () => {
      const test = {
        id: 'completion-missing-required',
        complexity: 'simple',
        maxScore: 5,
        expectedResult: {
          tool_name: 'create_annotation',
          parameters: { chromosome: '<current_chromosome>', name: 'fakG' },
        },
      };
      const evaluation = completionEvaluator().evaluate(test, {
        actualResult: {
          nativeFunctionCalls: [
            { tool_name: 'create_annotation', parameters: { type: 'gene', name: 'fakG', start: 500000, end: 501500 } },
          ],
        },
      });

      expect(evaluation.success).toBe(false);
      expect(evaluation.errors.some(error => error.includes('Schema invalid'))).toBe(true);
    });

    it('requires real execution success for expected calls when configured', () => {
      const evaluator = new StrictAutomaticEvaluator({
        assessmentMode: 'completion',
        requireExecutionForCompletion: true,
        validateToolCall: schemaValidator,
      });
      const test = {
        id: 'completion-execution',
        complexity: 'simple',
        maxScore: 5,
        expectedResult: { tool_name: 'select_gene', parameters: { geneName: 'lacZ' } },
      };
      const success = evaluator.evaluate(test, {
        actualResult: {
          nativeFunctionCalls: [
            { tool_name: 'select_gene', parameters: { geneName: 'lacZ' }, executed: true, executionSuccess: true },
            { tool_name: 'get_gene_details', parameters: { geneName: 'lacZ' }, executed: true, executionSuccess: true },
          ],
        },
      });
      const executionFailure = evaluator.evaluate(test, {
        actualResult: {
          nativeFunctionCalls: [
            { tool_name: 'select_gene', parameters: { geneName: 'lacZ' }, executed: true, executionSuccess: false },
          ],
        },
      });
      const noExecutionEvidence = evaluator.evaluate(test, {
        actualResult: {
          nativeFunctionCalls: [{ tool_name: 'select_gene', parameters: { geneName: 'lacZ' } }],
        },
      });

      expect(success.success).toBe(true);
      expect(executionFailure.success).toBe(false);
      expect(noExecutionEvidence.success).toBe(false);
      expect(success.details.assessmentTier).toBe('task-completion-execution');
    });
  });
});
