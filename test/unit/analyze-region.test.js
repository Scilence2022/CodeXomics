/**
 * analyze_region tool contract tests
 */
/* eslint-disable no-new-func */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

function loadAnalyzeRegionHarness() {
  const managerPath = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');
  const content = fs.readFileSync(managerPath, 'utf-8');
  const match = content.match(
    /\n\s{2}async analyzeRegion\s*\(params\s*=\s*\{\}\)\s*\{[\s\S]*?\n\s{2}\}\n\n\s{2}async exportData/
  );

  expect(match, 'analyzeRegion method should be extractable').toBeTruthy();

  const methodSource = match[0].replace(/\n\s{2}async exportData[\s\S]*$/, '');
  const Harness = new Function(`return class AnalyzeRegionHarness {${methodSource}\n}`)();
  return new Harness();
}

describe('analyze_region tool', () => {
  it('falls back to the current browser region when coordinates are omitted', async () => {
    const manager = loadAnalyzeRegionHarness();
    let requestedRegion = null;

    manager.app = {
      currentChromosome: 'chr1',
      currentPosition: { start: 2, end: 5 },
      currentAnnotations: [
        { chromosome: 'chr1', start: 2, end: 4, name: 'inside' },
        { chromosome: 'chr1', start: 1, end: 4, name: 'overlap-left' },
        { chromosome: 'chr2', start: 2, end: 4, name: 'wrong-chromosome' },
      ],
      getSequenceForRegion: async (chromosome, start, end) => {
        requestedRegion = { chromosome, start, end };
        return 'ATGC';
      },
    };

    const result = await manager.analyzeRegion({ includeFeatures: true, includeGC: true });

    expect(requestedRegion).toEqual({ chromosome: 'chr1', start: 2, end: 5 });
    expect(result).toMatchObject({
      chromosome: 'chr1',
      start: 2,
      end: 5,
      length: 4,
      sequence: 'ATGC',
      gcContent: '50.00',
    });
    expect(result.features).toHaveLength(1);
    expect(result.features[0].name).toBe('inside');
  });

  it('fails early with a clear error when neither parameters nor current region exist', async () => {
    const manager = loadAnalyzeRegionHarness();
    manager.app = {
      getSequenceForRegion: async () => {
        throw new Error('should not be called');
      },
    };

    await expect(manager.analyzeRegion({})).rejects.toThrow(
      'analyze_region requires chromosome, start, and end, or an active current region in the genome browser'
    );
  });

  it('documents the required genomic interval parameters in the YAML registry', () => {
    const yamlPath = path.join(process.cwd(), 'tools_registry/data_management/analyze_region.yaml');
    const definition = yaml.load(fs.readFileSync(yamlPath, 'utf-8'));

    expect(definition.execution.requires_data).toBe(true);
    expect(definition.parameters.required).toEqual(['chromosome', 'start', 'end']);
    expect(Object.keys(definition.parameters.properties)).toEqual(
      expect.arrayContaining(['chromosome', 'start', 'end', 'includeFeatures', 'includeGC', 'clientId'])
    );
  });
});
