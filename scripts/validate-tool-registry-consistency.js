#!/usr/bin/env node
'use strict';

/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { ToolRegistryService } = require('../src/main/tool-registry-service');
const FunctionCallsOrganizer = require('../src/renderer/modules/FunctionCallsOrganizer');
const ToolsIntegrator = require('../src/mcp-tools/ToolsIntegrator');

const ROOT = path.resolve(__dirname, '..');

const KNOWN_EXCEPTIONS = {
  builtInToolsMapMissingRegistry: [
    'advanced_blast_search',
    'batch_blast_search',
    'find_gene',
    'find_intergenic_regions',
    'get_blast_databases',
    'list_genome_windows',
    'switch_active_window',
    'toggle_annotation_track',
  ],
  toolNamesMissingRegistry: [
    'add_annotation',
    'add_track',
    'add_variant',
    'advanced_blast_search',
    'amino_acid_composition',
    'analyze_codon_usage',
    'batch_blast_search',
    'batch_create_annotations',
    'calculate_gc_content',
    'calculate_melting_temp',
    'check_genomics_environment',
    'compare_regions',
    'edit_annotation',
    'export_region_features',
    'find_intergenic_regions',
    'find_orfs',
    'find_similar_sequences',
    'get_blast_databases',
    'get_current_region',
    'get_current_region_details',
    'get_file_info',
    'get_multiple_coding_sequences',
    'get_pdb_details',
    'get_selected_gene',
    'get_sequence_selection',
    'get_upstream_region',
    'get_downstream_region',
    'merge_annotations',
    'navigate_to',
    'predict_rbs',
    'predict_terminator',
    'render_protein_structure_results',
    'scroll_left',
    'scroll_right',
    'search_by_position',
    'search_intergenic_regions',
    'search_motif',
    'toggle_annotation_track',
  ],
  functionOrganizerMissingRegistry: [
    'add_annotation',
    'add_track',
    'add_variant',
    'advanced_blast_search',
    'amino_acid_composition',
    'analyze_codon_usage',
    'batch_blast_search',
    'batch_create_annotations',
    'calculate_gc_content',
    'calculate_melting_temp',
    'compare_regions',
    'edit_annotation',
    'export_region_features',
    'find_intergenic_regions',
    'find_similar_sequences',
    'get_blast_databases',
    'get_current_region',
    'get_file_info',
    'get_pdb_details',
    'merge_annotations',
    'navigate_to',
    'predict_rbs',
    'predict_terminator',
    'scroll_left',
    'scroll_right',
    'search_by_position',
    'search_intergenic_regions',
    'search_motif',
  ],
  llmPolicyMissingRegistry: [],
  mcpMissingRegistry: [
    'codexomics_chat',
    'find_gene',
    'list_genome_windows',
    'render_protein_structure_results',
    'run_on_windows',
    'search_alphafold_by_sequence',
    'switch_active_window',
  ],
};

function read(relativePath) {
  return fs.readFileSync(path.join(ROOT, relativePath), 'utf8');
}

function unique(values) {
  return [...new Set(values)].sort();
}

function nestedStringValues(value, output = []) {
  if (!value || typeof value !== 'object') return output;
  for (const child of Object.values(value)) {
    if (typeof child === 'string') {
      output.push(child);
    } else if (child && typeof child === 'object') {
      nestedStringValues(child, output);
    }
  }
  return output;
}

function collectToolNamesConstants() {
  const sandbox = {};
  vm.createContext(sandbox);
  const source = read('src/renderer/modules/chat/constants/ToolNames.js');
  vm.runInContext(`${source}\nthis.TOOL_NAMES = TOOL_NAMES;`, sandbox);
  return unique(nestedStringValues(sandbox.TOOL_NAMES));
}

function collectFunctionOrganizerNames() {
  const organizer = new FunctionCallsOrganizer({ app: {} });
  return unique(Object.values(organizer.functionCategories).flatMap(category => category.functions || []));
}

function collectToolExecutionAliases(snapshot) {
  const aliases = new Set(Object.keys(snapshot.aliases || {}));
  const source = read('src/renderer/modules/chat/services/ToolExecutionService.js');
  const start = source.indexOf('const legacyAliases =');
  const end = source.indexOf('if (legacyAliases', start);
  const aliasBlock = start >= 0 && end > start ? source.slice(start, end) : '';
  for (const match of aliasBlock.matchAll(/([a-z][a-z0-9_]+):\s*'([a-z][a-z0-9_]+)'/g)) {
    aliases.add(match[1]);
  }
  return aliases;
}

function collectLlmPolicyNames() {
  const source = read('src/renderer/modules/chat/services/LLMContextService.js');
  const start = source.indexOf('const toolPolicies =');
  const end = source.indexOf('// Find applicable policy', start);
  const policyBlock = start >= 0 && end > start ? source.slice(start, end) : '';
  const names = [];
  for (const match of policyBlock.matchAll(/tools:\s*\[([\s\S]*?)\]\s*,\s*policy:/g)) {
    for (const stringMatch of match[1].matchAll(/'([a-z][a-z0-9_]+)'/g)) {
      names.push(stringMatch[1]);
    }
  }
  return unique(names);
}

function collectMcpToolNames() {
  const integrator = new ToolsIntegrator({});
  return unique(Object.keys(integrator.allTools || {}));
}

function diffWithExceptions(values, validNames, allowedExceptions) {
  const allowed = new Set(allowedExceptions);
  const invalid = values.filter(name => !validNames.has(name));
  return {
    unexpected: invalid.filter(name => !allowed.has(name)),
    staleExceptions: allowedExceptions.filter(name => !invalid.includes(name)),
    totalInvalid: invalid.length,
  };
}

function pushComparison(report, label, values, validNames, exceptionKey) {
  const comparison = diffWithExceptions(values, validNames, KNOWN_EXCEPTIONS[exceptionKey] || []);
  report.comparisons[label] = {
    checked: values.length,
    totalInvalid: comparison.totalInvalid,
    allowedExceptions: KNOWN_EXCEPTIONS[exceptionKey] || [],
    unexpected: comparison.unexpected,
    staleExceptions: comparison.staleExceptions,
  };

  if (comparison.unexpected.length > 0) {
    report.errors.push({
      source: label,
      message: 'Unexpected tool names are not represented by the registry or approved aliases',
      tools: comparison.unexpected,
    });
  }

  if (comparison.staleExceptions.length > 0) {
    report.warnings.push({
      source: label,
      message: 'Known registry consistency exceptions can now be removed',
      tools: comparison.staleExceptions,
    });
  }
}

async function validateToolRegistryConsistency() {
  const service = new ToolRegistryService({
    registryRoot: path.join(ROOT, 'tools_registry'),
    userRegistryRoot: null,
    cacheTtlMs: 1,
  });
  const snapshot = await service.getSnapshot({ force: true });
  const registryNames = new Set(snapshot.tools.map(tool => tool.name));
  const builtInNames = unique(snapshot.builtInTools.map(tool => tool.name));
  const registryBuiltInNames = unique(snapshot.tools.filter(tool => tool.isBuiltIn).map(tool => tool.name));
  const aliases = collectToolExecutionAliases(snapshot);
  const validNames = new Set([...registryNames, ...aliases]);

  const report = {
    success: true,
    counts: {
      registryTools: snapshot.tools.length,
      uniqueRegistryTools: registryNames.size,
      builtInTools: builtInNames.length,
      registryDiagnostics: snapshot.diagnostics.length,
    },
    comparisons: {},
    warnings: [],
    errors: [],
  };

  if (!snapshot.success) {
    report.errors.push({
      source: 'tool_registry_service',
      message: 'Registry snapshot reported failure',
      diagnostics: snapshot.diagnostics,
    });
  }

  const registryBuiltInsMissingMap = registryBuiltInNames.filter(name => !builtInNames.includes(name));
  if (registryBuiltInsMissingMap.length > 0) {
    report.errors.push({
      source: 'builtInToolsMap',
      message: 'Registry marks tools as built-in but builtInToolsMap does not define them',
      tools: registryBuiltInsMissingMap,
    });
  }

  pushComparison(report, 'builtInToolsMap', builtInNames, registryNames, 'builtInToolsMapMissingRegistry');
  pushComparison(report, 'ToolNames.js', collectToolNamesConstants(), validNames, 'toolNamesMissingRegistry');
  pushComparison(
    report,
    'FunctionCallsOrganizer.js',
    collectFunctionOrganizerNames().filter(name => !name.includes('.')),
    validNames,
    'functionOrganizerMissingRegistry'
  );
  pushComparison(
    report,
    'LLMContextService.shouldAllowToolExecution',
    collectLlmPolicyNames(),
    validNames,
    'llmPolicyMissingRegistry'
  );
  pushComparison(report, 'src/mcp-tools schemas', collectMcpToolNames(), registryNames, 'mcpMissingRegistry');

  report.success = report.errors.length === 0;
  return report;
}

async function main() {
  const report = await validateToolRegistryConsistency();
  console.log(JSON.stringify(report, null, 2));
  if (!report.success) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}

module.exports = {
  KNOWN_EXCEPTIONS,
  validateToolRegistryConsistency,
};
