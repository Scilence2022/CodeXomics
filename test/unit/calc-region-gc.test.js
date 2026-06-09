/**
 * calc_region_gc tool contract tests
 */
/* eslint-disable no-new-func */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';

function loadGenomeAnalysisServiceClass() {
  const servicePath = path.join(process.cwd(), 'src/renderer/modules/chat/services/GenomeAnalysisService.js');
  const content = fs
    .readFileSync(servicePath, 'utf-8')
    .replace('window.GenomeAnalysisService = GenomeAnalysisService;', '');
  return new Function(`${content}; return GenomeAnalysisService;`)();
}

function createService() {
  const GenomeAnalysisService = loadGenomeAnalysisServiceClass();
  const app = {
    currentChromosome: 'chr1',
    currentPosition: { start: 2, end: 5 },
    currentSequence: {
      chr1: 'ATGCGCNN',
      chr2: 'AAAA',
    },
    getSequenceForRegion: async (chromosome, start, end) => app.currentSequence[chromosome].substring(start - 1, end),
  };
  return new GenomeAnalysisService(app, {});
}

describe('calc_region_gc tool', () => {
  it('calculates GC content from explicit genomic coordinates', async () => {
    const service = createService();

    const result = await service.calcRegionGc({ chromosome: 'chr1', start: 2, end: 5 });

    expect(result).toMatchObject({
      success: true,
      chromosome: 'chr1',
      start: 2,
      end: 5,
      region: 'chr1:2-5',
      length: 4,
      gcContent: 75,
      atContent: 25,
      gcCount: 3,
      atCount: 1,
      sequence: 'TGCG',
    });
  });

  it('uses current chromosome and current visible region when parameters are omitted', async () => {
    const service = createService();

    const result = await service.calcRegionGc({});

    expect(result.region).toBe('chr1:2-5');
    expect(result.gcContent).toBe(75);
  });

  it('fails early for coordinates outside the loaded chromosome', async () => {
    const service = createService();

    await expect(service.calcRegionGc({ chromosome: 'chr2', start: 1, end: 10 })).rejects.toThrow(
      'outside chromosome bounds'
    );
  });

  it('is registered as a region-specific GC tool distinct from compute_gc', () => {
    const yamlPath = path.join(process.cwd(), 'tools_registry/sequence/calc_region_gc.yaml');
    const definition = yaml.load(fs.readFileSync(yamlPath, 'utf-8'));
    const builtInSource = fs.readFileSync(
      path.join(process.cwd(), 'tools_registry/builtin_tools_integration.js'),
      'utf-8'
    );

    expect(definition.name).toBe('calc_region_gc');
    expect(definition.execution.requires_data).toBe(true);
    expect(definition.description).toContain('use compute_gc only when the DNA sequence string is already provided');
    expect(builtInSource).toContain("this.builtInToolsMap.set('calc_region_gc'");
  });
});
