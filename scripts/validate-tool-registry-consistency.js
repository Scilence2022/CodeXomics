#!/usr/bin/env node
'use strict';

/* eslint-disable no-console */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const { ToolRegistryService } = require('../src/main/tool-registry-service');
const FunctionCallsOrganizer = require('../src/renderer/modules/FunctionCallsOrganizer');
const ToolsIntegrator = require('../src/mcp-tools/ToolsIntegrator');
const ToolExecutionService = require('../src/renderer/modules/chat/services/ToolExecutionService');

const ROOT = path.resolve(__dirname, '..');

const KNOWN_EXCEPTIONS = {
  builtInToolsMapMissingRegistry: [
    'advanced_blast_search',
    'batch_blast_search',
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
    'calculate_gc_content',
    'calculate_melting_temp',
    'check_genomics_environment',
    'compare_regions',
    'export_region_features',
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
    'calculate_gc_content',
    'calculate_melting_temp',
    'compare_regions',
    'export_region_features',
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
  // Existing external research names and compatibility/UI aliases have policy entries
  // but are not advertised YAML tools. Keep this explicit so new drift still fails.
  llmPolicyMissingRegistry: [
    'cancel-research-run',
    'deep-gene-research',
    'delete_feature',
    'focus_on_gene',
    'generate-SERP-query',
    'get-task-status',
    'get_current_region',
    'get_file_info',
    'get_visible_tracks',
    'jump_to_feature',
    'refresh_view',
    'scroll_left',
    'scroll_right',
    'search-task',
    'set_view_mode',
    'show_hide_features',
    'switch_tab',
    'toggle_annotation_track',
    'utility_set_chatbox_layout',
    'utility_set_chatbox_minimized',
    'utility_toggle_chatbox',
    'utility_toggle_settings_modal',
    'utility_toggle_sidebar',
    'utility_toggle_sidebar_panel',
    'utility_toggle_top_banner',
    'write-final-report',
    'write-research-plan',
  ],
  mcpMissingRegistry: [
    'codexomics_chat',
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

function validateToolAliases(tools, runtimeAliases) {
  const registryNames = new Set(tools.map(tool => tool.name));
  const aliases = new Map();
  const errors = [];
  const register = (alias, target, source) => {
    let message;
    if (typeof alias !== 'string' || !/^[a-z][a-z0-9_]*$/.test(alias) || Object.hasOwn(Object.prototype, alias)) {
      message = 'Invalid tool alias';
    } else if (registryNames.has(alias)) {
      message = 'Tool alias shadows a canonical registry name';
    } else if (!registryNames.has(target)) {
      message = 'Tool alias target is missing from the registry';
    } else if (aliases.has(alias) && aliases.get(alias) !== target) {
      message = 'Tool alias resolves to conflicting registry targets';
    }
    if (message) {
      errors.push({ source, message, alias, target, existingTarget: aliases.get(alias) });
    } else {
      aliases.set(alias, target);
    }
  };

  for (const tool of tools) {
    const declared = tool.aliases || tool.legacy_aliases || [];
    if (Array.isArray(declared)) {
      for (const alias of declared) register(alias, tool.name, tool.sourceFile || tool.name);
    }
  }
  for (const [alias, target] of Object.entries(runtimeAliases)) {
    register(alias, target, 'ToolExecutionService.legacyAliases');
  }
  return { aliases, errors };
}

function collectLlmPolicyNames() {
  const ToolCapabilityPolicy = require('../src/renderer/modules/chat/services/ToolCapabilityPolicy');
  const policies = new ToolCapabilityPolicy().policies;
  const names = unique(Object.values(policies).flatMap(policy => policy.tools || []));
  if (!names.length) throw new Error('No LLM capability policies found; refusing an empty validation');
  return names;
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
    report.errors.push({
      source: label,
      message: 'Remove obsolete registry consistency exceptions',
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
  const { aliases, errors: aliasErrors } = validateToolAliases(snapshot.tools, ToolExecutionService.legacyAliases);
  const validNames = new Set([...registryNames, ...aliases.keys()]);
  const routedNames = surface => {
    const allowed = new Set(registryNames);
    for (const [alias, target] of aliases) {
      if (ToolExecutionService.legacyAliases[alias] === target && surface.includes(target)) allowed.add(alias);
    }
    return allowed;
  };

  const report = {
    success: true,
    counts: {
      registryTools: snapshot.tools.length,
      uniqueRegistryTools: registryNames.size,
      builtInTools: builtInNames.length,
      aliases: aliases.size,
      registryDiagnostics: snapshot.diagnostics.length,
    },
    comparisons: {},
    warnings: [],
    errors: aliasErrors,
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

  pushComparison(report, 'builtInToolsMap', builtInNames, routedNames(builtInNames), 'builtInToolsMapMissingRegistry');
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
  const mcpNames = collectMcpToolNames();
  pushComparison(report, 'src/mcp-tools schemas', mcpNames, routedNames(mcpNames), 'mcpMissingRegistry');

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
  collectLlmPolicyNames,
  validateToolAliases,
  validateToolRegistryConsistency,
};
