#!/usr/bin/env node
'use strict';

/**
 * v3 MLX training-data builder: multi-turn tool-calling trajectories.
 *
 * The v2 pipeline only promoted records whose strong-model replay passed, and
 * every multi-step replay failed (DeepSeek 0/14), so the trained model had
 * never seen a "call -> result -> next call" trajectory. This builder adds:
 *
 *   1. Single-call records that already pass the v2 eligibility gates
 *      (identical to the v2 conversion, kept so single-step accuracy holds).
 *   2. Fixture-executable multi-call release records (oracle gold + real
 *      deterministic fixture outputs), expanded one supervised turn per
 *      assistant tool-call message.
 *   3. Synthetic chained trajectories generated from the deterministic
 *      fixture corpus, where dependent parameters use the app's cross-round
 *      reference syntax ({tool_name.path}) exactly like the automatic-complex
 *      benchmark oracles. Every chain is executed against the fixture so the
 *      embedded tool results are real and every reference path is validated.
 *
 * Synthetic prompts are leakage-checked against the 172 automatic benchmark
 * prompts (exact hash, token similarity, ngram similarity, workflow graph).
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  cleanMessage,
  compactNativeTool,
  expandRecord,
  getTrainingEligibility,
  selectToolNames,
} = require('./prepare-mlx-tool-data.js');
const {
  CORE_FIXTURE_ID,
  FIXTURES,
  UNIPROT_FIXTURE_ID,
  executeTool,
} = require('./lib/deterministic-fixture-corpus.js');
const { checkLeakage, loadAutomaticBenchmarks } = require('./tool-calling-dataset.js');

const REPO_ROOT = path.resolve(__dirname, '..');
const RELEASE_DIR = path.join(REPO_ROOT, 'datasets', 'tool-calling-v1', 'release');
const OUTPUT_DIR = path.join(REPO_ROOT, 'finetuning', 'qwen3.5-4b', 'data-v3');
const MAX_TOOLS = 6;
const SYSTEM_PROMPT =
  'Use only the supplied CodeXomics tools. Ground every argument in the request or tool results. ' +
  'Ask for missing required information instead of inventing it.';

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function readJsonl(filePath) {
  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean)
    .map(line => JSON.parse(line));
}

function writeJsonl(filePath, records) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(
    filePath,
    records.map(record => JSON.stringify(record)).join('\n') + (records.length > 0 ? '\n' : '')
  );
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

function sha256Text(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function seededBucket(seedText, percent) {
  return parseInt(sha256Text(seedText).slice(0, 8), 16) % 100 < percent;
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function getPathValue(result, expression) {
  const parts = String(expression).split(/[.\[\]]+/).filter(Boolean);
  let current = result;
  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== 'object') return undefined;
    const key = /^\d+$/.test(part) ? Number(part) : part;
    current = current[key];
  }
  return current;
}

const REFERENCE_PATTERN = /\{([A-Za-z_][A-Za-z0-9_]*)((?:\.[A-Za-z_$][\w$-]*(?:\[[^\]]+\])?)+)\}/g;
const NUMERIC_PARAM_KEYS = new Set([
  'start',
  'end',
  'position',
  'distance',
  'offset',
  'limit',
  'max_results',
  'max_results',
  'reading_frame',
  'frame',
  'max_mismatches',
  'max3PrimeMismatches',
  'minBindingTm',
  'naConcentration',
  'primerConcentration',
  'length',
]);

function collectReferences(params, references = []) {
  if (typeof params === 'string') {
    for (const match of params.matchAll(REFERENCE_PATTERN)) {
      references.push(`${match[1]}${match[2]}`);
    }
  } else if (Array.isArray(params)) {
    for (const child of params) collectReferences(child, references);
  } else if (params && typeof params === 'object') {
    for (const child of Object.values(params)) collectReferences(child, references);
  }
  return references;
}

/**
 * Resolve `{tool_name.path}` references against already-executed tool results.
 * A whole-string scalar reference keeps its type when the target is numeric;
 * otherwise values become strings (the app resolves references as text).
 */
function resolveParams(params, resultsByName, parameterKey = null) {
  if (typeof params === 'string') {
    let output = params;
    let singleRefValue = null;
    let singleRef = null;
    for (const match of params.matchAll(REFERENCE_PATTERN)) {
      const toolName = match[1];
      const expression = match[2].replace(/^\./, '');
      const result = resultsByName.get(toolName);
      const resolved = result === undefined ? undefined : getPathValue(result, expression);
      if (resolved === undefined) return { resolved: false, missing: `${match[0]}` };
      if (params.trim() === match[0]) {
        singleRef = match[0];
        singleRefValue = resolved;
      }
      output = output.split(match[0]).join(typeof resolved === 'string' ? resolved : JSON.stringify(resolved));
    }
    if (singleRef !== null && NUMERIC_PARAM_KEYS.has(parameterKey) && typeof singleRefValue === 'number') {
      return { resolved: true, value: singleRefValue };
    }
    return { resolved: true, value: output };
  }
  if (Array.isArray(params)) {
    const resolved = [];
    for (const child of params) {
      const step = resolveParams(child, resultsByName);
      if (!step.resolved) return step;
      resolved.push(step.value);
    }
    return { resolved: true, value: resolved };
  }
  if (params && typeof params === 'object') {
    const resolved = {};
    for (const [key, child] of Object.entries(params)) {
      const step = resolveParams(child, resultsByName, key);
      if (!step.resolved) return step;
      resolved[key] = step.value;
    }
    return { resolved: true, value: resolved };
  }
  return { resolved: true, value: params };
}

/** Keep results small while preserving every referenced path. */
function trimResult(result, references, rootName) {
  // Only references that target this result matter for trimming/validation.
  // A reference found inside call N's parameters points at an EARLIER result;
  // forward references (later calls) determine what this result must keep.
  const own = references.filter(reference => reference === rootName || reference.startsWith(`${rootName}.`));
  const trimmed = clone(result);
  const walk = (node, nodePath) => {
    if (Array.isArray(node)) {
      const kept = node.slice(0, 1);
      for (let index = 0; index < kept.length; index += 1) {
        const childPath = `${nodePath}[${index}]`;
        if (own.some(reference => reference.startsWith(childPath))) walk(kept[index], childPath);
      }
      return kept;
    }
    if (node && typeof node === 'object') {
      for (const [key, child] of Object.entries(node)) {
        const childPath = nodePath ? `${nodePath}.${key}` : key;
        if (typeof child === 'string' && child.length > 180) {
          node[key] = `${child.slice(0, 180)}…`;
        } else if (Array.isArray(child) || (child && typeof child === 'object')) {
          node[key] = walk(child, childPath);
        }
      }
    }
    return node;
  };
  const output = walk(trimmed, rootName);
  for (const reference of own) {
    const expression = reference.slice(rootName.length + 1);
    if (getPathValue(output, expression) === undefined) return null;
  }
  return output;
}

function buildTrajectoryMessages(userPrompt, calls, results) {
  const messages = [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: userPrompt }];
  calls.forEach((call, index) => {
    const callId = `call_${index + 1}`;
    messages.push({
      role: 'assistant',
      content: null,
      tool_calls: [
        {
          id: callId,
          type: 'function',
          function: { name: call.tool_name, arguments: call.parameters },
        },
      ],
    });
    messages.push({
      role: 'tool',
      tool_call_id: callId,
      name: call.tool_name,
      content: JSON.stringify(results[index]),
    });
  });
  return messages;
}

function buildExample(messages, tools, metadata) {
  return {
    messages,
    tools,
    metadata: { ...metadata, supervised_target: 'tool_call' },
  };
}

function selectedToolsForRecord(record, toolMap) {
  const selectedNames = selectToolNames(record);
  return selectedNames.map(name => {
    const tool = toolMap.get(name);
    if (!tool) throw new Error(`Unknown tool ${name}`);
    return compactNativeTool(tool);
  });
}

function catalogForSynthetic(goldNames, catalogNames, seedText) {
  const gold = [...new Set(goldNames)];
  const prefix = name => String(name).split('_')[0];
  const tokenSet = name => new Set(String(name).split(/[_\s-]+/));
  const score = name => {
    let value = 0;
    for (const candidate of gold) {
      if (prefix(candidate) === prefix(name)) value += 4;
      const tokens = tokenSet(candidate);
      for (const token of tokenSet(name)) {
        if (tokens.has(token)) value += 2;
      }
    }
    return value;
  };
  const pool = catalogNames.filter(name => !gold.includes(name));
  const need = Math.max(0, MAX_TOOLS - gold.length);
  const ranked = pool
    .map(name => ({ name, score: score(name), order: sha256Text(`${seedText}:${name}`) }))
    .sort((left, right) => right.score - left.score || (left.order < right.order ? -1 : 1));
  return [...gold, ...ranked.slice(0, need).map(entry => entry.name)];
}

function syntheticTrajectory(template, variantIndex, toolMap, catalogNames, benchmarks) {
  const seedText = `${template.id}:${variantIndex}`;
  const built = template.build(variantIndex);
  const userPrompt = built.prompt;
  const calls = built.calls;
  const exampleId = `v3-syn-${sha256Text(seedText).slice(0, 16)}`;
  const leakage = checkLeakage(
    {
      user_query: userPrompt,
      calls: calls.map(call => ({ tool_name: call.tool_name })),
    },
    benchmarks
  );
  if (!leakage.passed) return null;

  // Execute the chain with resolved parameters to obtain real fixture outputs.
  const resultsByName = new Map();
  const executed = [];
  for (const call of calls) {
    const step = resolveParams(call.parameters, resultsByName);
    if (!step.resolved) return null;
    let result;
    try {
      result = executeTool(template.fixtureId, { tool_name: call.tool_name, parameters: step.value });
    } catch (error) {
      return null;
    }
    resultsByName.set(call.tool_name, result);
    executed.push({ call, result });
  }

  // Validate every reference against the real results.
  const references = collectReferences(calls.map(call => call.parameters));
  for (const reference of references) {
    const toolName = reference.split('.')[0];
    const expression = reference.slice(toolName.length + 1);
    if (getPathValue(resultsByName.get(toolName), expression) === undefined) return null;
  }

  const trimmedResults = executed.map(({ call, result }, callIndex) => {
    const laterCallReferences = collectReferences(calls.slice(callIndex + 1).map(later => later.parameters));
    return trimResult(result, laterCallReferences, call.tool_name);
  });
  if (trimmedResults.some(result => result === null)) return null;

  const allMessages = buildTrajectoryMessages(userPrompt, calls, trimmedResults);
  const candidateNames = catalogForSynthetic(
    calls.map(call => call.tool_name),
    catalogNames,
    seedText
  );
  const tools = candidateNames.map(name => {
    const tool = toolMap.get(name);
    if (!tool) throw new Error(`Unknown tool ${name}`);
    return compactNativeTool(tool);
  });
  const examples = [];
  allMessages.forEach((message, index) => {
    if (message.role !== 'assistant' || !Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
      return;
    }
    examples.push(
      buildExample(allMessages.slice(0, index + 1), tools, {
        source_example_id: exampleId,
        scenario_family_id: `synthetic:${template.id}`,
        trajectory: true,
        synthetic: true,
        turn_index: index,
      })
    );
  });
  return { exampleId, examples };
}

function releaseMultiCallExamples(records, toolMap) {
  const examples = [];
  for (const record of records) {
    const calls = record.oracle?.acceptable_calls || [];
    if (calls.length <= 1) continue;
    if (record.oracle?.decision !== 'call') continue;
    if (record.verification?.fixture_executable !== true) continue;
    const outputs = record.verification?.fixture_replay?.fixture_outputs || [];
    if (outputs.length < calls.length || outputs.some(output => output.result === undefined)) continue;
    const messages = (record.messages || []).map(cleanMessage);
    const tools = selectedToolsForRecord(record, toolMap);
    messages.forEach((message, index) => {
      if (message.role !== 'assistant' || !Array.isArray(message.tool_calls) || message.tool_calls.length === 0) {
        return;
      }
      examples.push(
        buildExample(messages.slice(0, index + 1), tools, {
          source_example_id: record.example_id,
          scenario_family_id: record.scenario_family_id,
          trajectory: true,
          synthetic: false,
          turn_index: index,
        })
      );
    });
  }
  return examples;
}

function templatePrompt(language, templateId, details) {
  if (language === 'zh') {
    const zh = {
      find: `在只读夹具 PX-01 中，精确查找基因 ${details.gene}（不要跳转视图），然后取出其返回区间的序列。`,
      find_details: `在只读夹具 PX-01 中，精确查找基因 ${details.gene}（不要跳转视图），再获取该基因的详细信息，然后取出其返回区间的序列。`,
      seq_gc: `在只读夹具 PX-01 中，取出 ${details.chromosome}:${details.start}-${details.end} ${details.strand} 链的序列，并计算该序列的 GC 含量。`,
      seq_entropy: `在只读夹具 PX-01 中，取出 ${details.chromosome}:${details.start}-${details.end} ${details.strand} 链的序列，并计算该序列的熵。`,
      seq_revcomp: `在只读夹具 PX-01 中，取出 ${details.chromosome}:${details.start}-${details.end} ${details.strand} 链的序列，并返回它的反向互补序列。`,
      seq_translate: `在只读夹具 PX-01 中，取出 ${details.chromosome}:${details.start}-${details.end} ${details.strand} 链的序列，并按阅读框 ${details.frame} 翻译成氨基酸。`,
      seq_mw: `在只读夹具 PX-01 中，取出 ${details.chromosome}:${details.start}-${details.end} ${details.strand} 链的序列，并计算其分子量。`,
      seq_digest: `在只读夹具 PX-01 中，取出 ${details.chromosome}:${details.start}-${details.end} ${details.strand} 链的序列，查找 ${details.enzyme} 酶切位点，然后对整段序列做虚拟酶切。`,
      ann_list: `在只读夹具 PX-01 中，列出 ${details.chromosome} 上的注释，并取出第一条注释的完整信息。`,
      ann_nearby: `在只读夹具 PX-01 中，查看 ${details.chromosome}:${details.position} 附近 ${details.distance}bp 内的特征，并取出第一个特征的完整注释。`,
      uniprot: `在只读夹具的 UniProt 语料中搜索 "pinned catalytic"，并取出第一条结果条目的完整信息。`,
      find_seq_gc: `在只读夹具 PX-01 中，精确查找基因 ${details.gene}（不要跳转视图），取出其返回区间的序列，并计算该序列的 GC 含量。`,
      seq_translate_mw: `在只读夹具 PX-01 中，取出 ${details.chromosome}:${details.start}-${details.end} ${details.strand} 链的序列，按阅读框 ${details.frame} 翻译，并计算所得蛋白的分子量。`,
    };
    return zh[templateId];
  }
  const en = {
    find: `In pinned synthetic sample PX-01, find gene ${details.gene} exactly (do not navigate the view), then retrieve the sequence of exactly the returned interval.`,
    find_details: `In pinned synthetic sample PX-01, find gene ${details.gene} exactly (do not navigate the view), fetch its gene details, then retrieve the sequence of exactly the returned interval.`,
    seq_gc: `In pinned synthetic sample PX-01, retrieve the ${details.strand} strand of ${details.chromosome}:${details.start}-${details.end}, then compute the GC content of that retrieved sequence.`,
    seq_entropy: `In pinned synthetic sample PX-01, retrieve the ${details.strand} strand of ${details.chromosome}:${details.start}-${details.end}, then compute the entropy of that retrieved sequence.`,
    seq_revcomp: `In pinned synthetic sample PX-01, retrieve the ${details.strand} strand of ${details.chromosome}:${details.start}-${details.end}, then return the reverse complement of that retrieved sequence.`,
    seq_translate: `In pinned synthetic sample PX-01, retrieve the ${details.strand} strand of ${details.chromosome}:${details.start}-${details.end}, then translate that retrieved DNA in reading frame ${details.frame}.`,
    seq_mw: `In pinned synthetic sample PX-01, retrieve the ${details.strand} strand of ${details.chromosome}:${details.start}-${details.end}, then calculate the molecular weight of that retrieved sequence.`,
    seq_digest: `In pinned synthetic sample PX-01, retrieve the ${details.strand} strand of ${details.chromosome}:${details.start}-${details.end}, find ${details.enzyme} restriction sites in that retrieved sequence, then run a virtual digest of the full sequence.`,
    ann_list: `In pinned synthetic sample PX-01, list the annotations on ${details.chromosome}, then fetch the full details of the first listed annotation.`,
    ann_nearby: `In pinned synthetic sample PX-01, find features near ${details.chromosome}:${details.position} within ${details.distance} bp, then fetch the full annotation of the first feature.`,
    uniprot: `In the pinned UniProt fixture corpus, search for "pinned catalytic", then fetch the full entry of the first search result.`,
    find_seq_gc: `In pinned synthetic sample PX-01, find gene ${details.gene} exactly (do not navigate the view), retrieve the sequence of exactly the returned interval, then compute the GC content of that sequence.`,
    seq_translate_mw: `In pinned synthetic sample PX-01, retrieve the ${details.strand} strand of ${details.chromosome}:${details.start}-${details.end}, translate it in reading frame ${details.frame}, then calculate the molecular weight of the resulting protein.`,
  };
  return en[templateId];
}

function buildTemplates() {
  const core = FIXTURES[CORE_FIXTURE_ID];
  const uniprot = FIXTURES[UNIPROT_FIXTURE_ID];
  const templates = [];

  const coreWindow = variantIndex => {
    const gene = core.genes[variantIndex % core.genes.length];
    const offset = (variantIndex * 7) % 400 + 1;
    const start = Math.max(1, Math.min(gene.start - 50 + offset, 500));
    const end = start + 36 + (variantIndex % 3) * 6;
    return { gene, chromosome: gene.chromosome, start, end };
  };

  const commonDetails = (templateId, variantIndex, strand = '+', frame = 1, enzyme = 'EcoRI', position = null, distance = 5000) => {
    const window = coreWindow(variantIndex);
    return {
      gene: window.gene.name,
      chromosome: window.chromosome,
      start: window.start,
      end: window.end,
      strand,
      frame,
      enzyme,
      position: position === null ? window.start + 25 : position,
      distance,
    };
  };

  const register = (id, fixtureId, callBuilder, detailBuilder) => {
    templates.push({
      id,
      fixtureId,
      build: variantIndex => {
        const language = variantIndex % 2 === 0 ? 'en' : 'zh';
        const details = detailBuilder(variantIndex);
        return {
          prompt: templatePrompt(language, id, details),
          calls: callBuilder(variantIndex, details),
        };
      },
    });
  };

  register(
    'find',
    CORE_FIXTURE_ID,
    (variantIndex, details) => [
      { tool_name: 'find_gene_by_name', parameters: { name: details.gene, exact_match: true, navigate_to_gene: false } },
      {
        tool_name: 'get_sequence',
        parameters: {
          chromosome: '{find_gene_by_name.genes[0].chromosome}',
          start: '{find_gene_by_name.genes[0].start}',
          end: '{find_gene_by_name.genes[0].end}',
          strand: details.strand,
        },
      },
    ],
    variantIndex => {
      const window = coreWindow(variantIndex);
      const strand = variantIndex % 2 === 0 ? '+' : '-';
      return { gene: window.gene.name, chromosome: window.chromosome, start: window.start, end: window.end, strand };
    }
  );

  register(
    'find_details',
    CORE_FIXTURE_ID,
    (variantIndex, details) => [
      { tool_name: 'find_gene_by_name', parameters: { name: details.gene, exact_match: true, navigate_to_gene: false } },
      { tool_name: 'get_gene_details', parameters: { geneName: details.gene } },
      {
        tool_name: 'get_sequence',
        parameters: {
          chromosome: '{find_gene_by_name.genes[0].chromosome}',
          start: '{find_gene_by_name.genes[0].start}',
          end: '{find_gene_by_name.genes[0].end}',
          strand: details.strand,
        },
      },
    ],
    variantIndex => {
      const window = coreWindow(variantIndex);
      const strand = variantIndex % 2 === 0 ? '+' : '-';
      return { gene: window.gene.name, chromosome: window.chromosome, start: window.start, end: window.end, strand };
    }
  );

  const sequenceFirst = (toolName, extraParams, variantIndex, details) => [
    {
      tool_name: 'get_sequence',
      parameters: { chromosome: details.chromosome, start: details.start, end: details.end, strand: details.strand },
    },
    { tool_name: toolName, parameters: { ...extraParams, sequence: '{get_sequence.sequence}' } },
  ];

  register(
    'seq_gc',
    CORE_FIXTURE_ID,
    (variantIndex, details) => sequenceFirst('compute_gc', {}, variantIndex, details),
    variantIndex => commonDetails('seq_gc', variantIndex, variantIndex % 2 === 0 ? '+' : '-')
  );
  register(
    'seq_entropy',
    CORE_FIXTURE_ID,
    (variantIndex, details) => sequenceFirst('calculate_entropy', {}, variantIndex, details),
    variantIndex => commonDetails('seq_entropy', variantIndex, variantIndex % 2 === 0 ? '+' : '-')
  );
  register(
    'seq_revcomp',
    CORE_FIXTURE_ID,
    (variantIndex, details) => sequenceFirst('reverse_complement', {}, variantIndex, details),
    variantIndex => commonDetails('seq_revcomp', variantIndex, variantIndex % 2 === 0 ? '+' : '-')
  );
  register(
    'seq_translate',
    CORE_FIXTURE_ID,
    (variantIndex, details) =>
      sequenceFirst('translate_dna', { reading_frame: details.frame, include_stop_codons: true }, variantIndex, details),
    variantIndex => commonDetails('seq_translate', variantIndex, variantIndex % 2 === 0 ? '+' : '-', (variantIndex % 3) + 1)
  );
  register(
    'seq_mw',
    CORE_FIXTURE_ID,
    (variantIndex, details) => sequenceFirst('calculate_molecular_weight', {}, variantIndex, details),
    variantIndex => commonDetails('seq_mw', variantIndex, variantIndex % 2 === 0 ? '+' : '-')
  );
  register(
    'seq_digest',
    CORE_FIXTURE_ID,
    (variantIndex, details) => [
      {
        tool_name: 'get_sequence',
        parameters: { chromosome: details.chromosome, start: details.start, end: details.end, strand: details.strand },
      },
      {
        tool_name: 'find_restriction_sites',
        parameters: { sequence: '{get_sequence.sequence}', enzyme: details.enzyme },
      },
      {
        tool_name: 'virtual_digest',
        parameters: { sequence: '{get_sequence.sequence}', enzymes: [details.enzyme] },
      },
    ],
    variantIndex => commonDetails('seq_digest', variantIndex, variantIndex % 2 === 0 ? '+' : '-', 1, variantIndex % 2 === 0 ? 'EcoRI' : 'BamHI')
  );
  register(
    'ann_list',
    CORE_FIXTURE_ID,
    (variantIndex, details) => [
      { tool_name: 'list_annotations', parameters: { chromosome: details.chromosome } },
      { tool_name: 'get_annotation', parameters: { identifier: '{list_annotations.annotations[0].id}' } },
    ],
    variantIndex => commonDetails('ann_list', variantIndex)
  );
  register(
    'ann_nearby',
    CORE_FIXTURE_ID,
    (variantIndex, details) => [
      {
        tool_name: 'get_nearby_features',
        parameters: { chromosome: details.chromosome, position: details.position, distance: details.distance },
      },
      { tool_name: 'get_annotation', parameters: { identifier: '{get_nearby_features.features[0].id}' } },
    ],
    variantIndex => commonDetails('ann_nearby', variantIndex, '+', 1, 'EcoRI', null, 5000)
  );
  register(
    'uniprot',
    UNIPROT_FIXTURE_ID,
    (variantIndex, details) => [
      { tool_name: 'search_uniprot_database', parameters: { search_query: 'pinned catalytic', max_results: 5 } },
      {
        tool_name: 'get_uniprot_entry',
        parameters: { uniprot_id: '{search_uniprot_database.entries[0].accession}' },
      },
    ],
    variantIndex => commonDetails('uniprot', variantIndex)
  );
  register(
    'find_seq_gc',
    CORE_FIXTURE_ID,
    (variantIndex, details) => [
      { tool_name: 'find_gene_by_name', parameters: { name: details.gene, exact_match: true, navigate_to_gene: false } },
      {
        tool_name: 'get_sequence',
        parameters: {
          chromosome: '{find_gene_by_name.genes[0].chromosome}',
          start: '{find_gene_by_name.genes[0].start}',
          end: '{find_gene_by_name.genes[0].end}',
          strand: details.strand,
        },
      },
      { tool_name: 'compute_gc', parameters: { sequence: '{get_sequence.sequence}' } },
    ],
    variantIndex => {
      const window = coreWindow(variantIndex);
      const strand = variantIndex % 2 === 0 ? '+' : '-';
      return { gene: window.gene.name, chromosome: window.chromosome, start: window.start, end: window.end, strand };
    }
  );
  register(
    'seq_translate_mw',
    CORE_FIXTURE_ID,
    (variantIndex, details) => [
      {
        tool_name: 'get_sequence',
        parameters: { chromosome: details.chromosome, start: details.start, end: details.end, strand: details.strand },
      },
      {
        tool_name: 'translate_dna',
        parameters: { dna: '{get_sequence.sequence}', reading_frame: details.frame, include_stop_codons: true },
      },
      {
        tool_name: 'calculate_molecular_weight',
        parameters: { sequence: '{translate_dna.amino_acid_sequence}' },
      },
    ],
    variantIndex => commonDetails('seq_translate_mw', variantIndex, variantIndex % 2 === 0 ? '+' : '-', (variantIndex % 3) + 1)
  );
  return templates;
}

function main() {
  const releaseManifest = readJson(path.join(RELEASE_DIR, 'manifest.json'));
  if (releaseManifest.benchmark_scope?.automatic_simple !== 143 || releaseManifest.benchmark_scope?.automatic_complex !== 29) {
    throw new Error('Release must scope exactly 143 automatic-simple and 29 automatic-complex tests');
  }
  if (releaseManifest.benchmark_scope?.manual_tests_included !== 0) {
    throw new Error('Manual benchmark data must not be included');
  }
  const benchmarks = loadAutomaticBenchmarks();
  const catalog = readJson(path.join(RELEASE_DIR, 'tool-catalog.json'));
  const toolMap = new Map(catalog.tools.map(tool => [tool.function.name, tool]));
  const catalogNames = catalog.tools.map(tool => tool.function.name);

  const splitFiles = [
    ['train', 'train.jsonl'],
    ['dev', 'valid.jsonl'],
    ['holdout', 'test.jsonl'],
  ];
  const outputStats = {};
  const splitExamples = {};
  const syntheticCounts = {};

  for (const [sourceSplit, outputFilename] of splitFiles) {
    const sourceRecords = readJsonl(path.join(RELEASE_DIR, `${sourceSplit}.jsonl`));
    const eligible = sourceRecords.filter(record => getTrainingEligibility(record).eligible);
    const baseExamples = eligible.flatMap(record => expandRecord(record, toolMap));
    const multiCallExamples = releaseMultiCallExamples(sourceRecords, toolMap);

    const syntheticExamples = [];
    if (sourceSplit !== 'holdout') {
      const templates = buildTemplates();
      const target = sourceSplit === 'train' ? 260 : 45;
      let variantIndex = 0;
      let attempts = 0;
      while (syntheticExamples.length < target && attempts < target * 8) {
        const template = templates[variantIndex % templates.length];
        const trajectory = syntheticTrajectory(template, variantIndex, toolMap, catalogNames, benchmarks);
        attempts += 1;
        variantIndex += 1;
        if (!trajectory) continue;
        const bucket = seededBucket(trajectory.exampleId, 85);
        const belongsHere = sourceSplit === 'train' ? bucket : !bucket;
        if (!belongsHere) continue;
        syntheticExamples.push(...trajectory.examples);
        syntheticCounts[sourceSplit] = (syntheticCounts[sourceSplit] || 0) + trajectory.examples.length;
      }
    }

    const examples = [...baseExamples, ...multiCallExamples, ...syntheticExamples];
    splitExamples[sourceSplit] = examples;
    const outputPath = path.join(OUTPUT_DIR, outputFilename);
    writeJsonl(outputPath, examples);
    outputStats[sourceSplit] = {
      source_records: sourceRecords.length,
      eligible_source_records: eligible.length,
      single_call_examples: baseExamples.length,
      multi_call_examples: multiCallExamples.length,
      synthetic_examples: syntheticExamples.length,
      supervised_examples: examples.length,
      tool_call_targets: examples.filter(example => example.metadata.supervised_target === 'tool_call').length,
      sha256: sha256File(outputPath),
    };
  }

  const manifest = {
    schema_version: '3.0',
    format: 'mlx-lm-tools-jsonl',
    source_release_manifest_sha256: sha256File(path.join(RELEASE_DIR, 'manifest.json')),
    source_registry_hash: releaseManifest.registry_hash,
    benchmark_scope: {
      automatic_simple: 143,
      automatic_complex: 29,
      manual_tests_included: 0,
      use: 'leakage-gate-only',
    },
    max_candidate_tools: MAX_TOOLS,
    tool_schema_profile: {
      function_descriptions_preserved: 'truncated_160',
      property_descriptions_included: false,
      defaults_preserved: true,
      examples_preserved: false,
      source_semantics_preserved: true,
      structural_constraints_preserved: true,
      candidate_order_preserved: true,
      deterministic_random_gold_position: true,
      semantically_hard_distractors: true,
      all_gold_tools_always_included: true,
      compact_training_schema: 'compact-v1',
    },
    trajectory_profile: {
      multi_turn_tool_results: true,
      cross_round_reference_syntax: '{tool_name.path}',
      synthetic_chains_generated: true,
      synthetic_leakage_checked_against_172_tests: true,
      synthetic_split_buckets: { train: 85, dev: 15, holdout: 0 },
      release_multi_call_gate_relaxed: 'strong replay no longer required when oracle gold + full fixture outputs exist',
    },
    training_eligibility: {
      strong_model_semantic_replay_required: true,
      fixture_execution_required_for_tool_calls: true,
      state_verification_required_for_stateful_records: true,
      literal_provider_json_is_not_an_oracle: true,
      release_multi_call_trajectories_use_oracle_gold_plus_fixture_outputs: true,
    },
    prompt_masking_required: true,
    splits: outputStats,
    synthetic_counts_by_split: syntheticCounts,
  };
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUTPUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(JSON.stringify(manifest, null, 2));
}

if (require.main === module) main();

module.exports = {
  buildTrajectoryMessages,
  buildTemplates,
  catalogForSynthetic,
  collectReferences,
  releaseMultiCallExamples,
  resolveParams,
  syntheticTrajectory,
  trimResult,
};
