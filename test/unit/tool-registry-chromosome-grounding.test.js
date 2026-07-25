/**
 * Registry-wide guard against placeholder chromosome names.
 *
 * An agent asked to "navigate to 2M" on E. coli answered with
 * `chromosome='chr1'` — copied straight out of a tool's own sample usage, since
 * `formatSampleUsages()` renders each tool's first example into the system
 * prompt. No real assembly is called "chr1" (E. coli K-12 is "U00096"), so every
 * such example is a trap.
 *
 * These tests scan both the YAML sources and the generated manifest that the
 * renderer actually loads, so a new tool with a placeholder example — or a YAML
 * edit without `npm run tool-registry:generate` — fails here instead of in a
 * user's session.
 */
import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

const require = createRequire(import.meta.url);
const REGISTRY_ROOT = path.join(process.cwd(), 'tools_registry');

// Names no loaded genome uses, but that models reach for when a tool example or
// parameter description shows one.
const PLACEHOLDERS = ['chr1', 'chr2', 'chrX', 'chromosome1', 'chromosome'];

function loadYamlTools() {
  const tools = [];
  for (const category of fs.readdirSync(REGISTRY_ROOT, { withFileTypes: true })) {
    if (!category.isDirectory() || category.name === 'generated') continue;
    const categoryDir = path.join(REGISTRY_ROOT, category.name);
    for (const file of fs.readdirSync(categoryDir)) {
      if (!file.endsWith('.yaml')) continue;
      const filePath = path.join(categoryDir, file);
      const parsed = yaml.load(fs.readFileSync(filePath, 'utf-8'));
      if (parsed && parsed.name) {
        tools.push({ tool: parsed, source: path.join('tools_registry', category.name, file) });
      }
    }
  }
  return tools;
}

/** `chromosome='chr1'` / "chromosome": "chr1" / chromosome=chr1 in any sample. */
function placeholderAssignments(toolCall) {
  const text = typeof toolCall === 'string' ? toolCall : JSON.stringify(toolCall ?? '');
  return PLACEHOLDERS.filter(name => new RegExp(`chromosome["']?\\s*[:=]\\s*["']?${name}(?![\\w.])`, 'i').test(text));
}

function chromosomeExamples(tool) {
  const properties = tool?.parameters?.properties || {};
  return Object.entries(properties)
    .filter(([name]) => /^chromosome/i.test(name))
    .flatMap(([, property]) => (Array.isArray(property.examples) ? property.examples : []));
}

describe('tool registry chromosome grounding (YAML sources)', () => {
  const tools = loadYamlTools();

  it('found the registry to scan', () => {
    expect(tools.length).toBeGreaterThan(100);
  });

  it('no sample usage assigns a placeholder chromosome name', () => {
    const offenders = [];
    for (const { tool, source } of tools) {
      for (const sample of Array.isArray(tool.sample_usages) ? tool.sample_usages : []) {
        const hits = placeholderAssignments(sample?.tool_call ?? sample);
        if (hits.length > 0) offenders.push(`${source} (${tool.name}): ${hits.join(', ')}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('no chromosome parameter offers a placeholder as an example value', () => {
    const offenders = [];
    for (const { tool, source } of tools) {
      const bad = chromosomeExamples(tool).filter(example =>
        PLACEHOLDERS.some(name => String(example).toLowerCase() === name.toLowerCase())
      );
      if (bad.length > 0) offenders.push(`${source} (${tool.name}): ${bad.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
});

describe('tool registry chromosome grounding (generated manifest)', () => {
  // The renderer loads this manifest, so a stale one silently reintroduces the
  // placeholders no matter how clean the YAML is.
  const manifest = require('../../tools_registry/generated/tool-registry-manifest.json');
  const tools = Array.isArray(manifest.tools) ? manifest.tools : [];

  it('is in sync with the YAML sources for navigate_to_position', () => {
    const yamlTool = loadYamlTools().find(entry => entry.tool.name === 'navigate_to_position').tool;
    const manifestTool = tools.find(tool => tool.name === 'navigate_to_position');

    expect(manifestTool).toBeDefined();
    expect(manifestTool.version).toBe(yamlTool.version);
    expect(manifestTool.parameters.properties.chromosome.description).toBe(
      yamlTool.parameters.properties.chromosome.description
    );
    // Required-chromosome is what forced the model to invent a name.
    expect(manifestTool.parameters.required || []).not.toContain('chromosome');
  });

  it('ships no placeholder chromosome names in samples or examples', () => {
    const offenders = [];
    for (const tool of tools) {
      for (const sample of Array.isArray(tool.sample_usages) ? tool.sample_usages : []) {
        const hits = placeholderAssignments(sample?.tool_call ?? sample);
        if (hits.length > 0) offenders.push(`${tool.name}: ${hits.join(', ')}`);
      }
      const badExamples = chromosomeExamples(tool).filter(example =>
        PLACEHOLDERS.some(name => String(example).toLowerCase() === name.toLowerCase())
      );
      if (badExamples.length > 0) offenders.push(`${tool.name} examples: ${badExamples.join(', ')}`);
    }
    expect(offenders).toEqual([]);
  });
});
