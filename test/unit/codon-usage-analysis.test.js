/* eslint-disable no-new-func */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const GeneticCodes = require('../../src/renderer/modules/GeneticCodes');
const Processing = require('../../src/renderer/modules/UnifiedSequenceProcessing');

function loadGenomeAnalysisServiceClass() {
  const servicePath = path.join(process.cwd(), 'src/renderer/modules/chat/services/GenomeAnalysisService.js');
  const content = fs
    .readFileSync(servicePath, 'utf-8')
    .replace('window.GenomeAnalysisService = GenomeAnalysisService;', '');
  return new Function(`${content}; return GenomeAnalysisService;`)();
}

// Forward gene geneA at 1-12 (ATG TGA AAA TAA) and reverse gene geneB at 16-27,
// whose coding strand reads ATG GCC GCC TAA.
const CHROMOSOME = 'ATGTGAAAATAA' + 'CCC' + 'TTAGGCGGCCAT';

function makeApp(table) {
  const qualifiers = extra => ({ ...(table ? { transl_table: [String(table)] } : {}), ...extra });
  return {
    currentChromosome: 'chr1',
    currentSequence: { chr1: CHROMOSOME },
    currentAnnotations: {
      chr1: [
        { type: 'gene', name: 'geneA', start: 1, end: 12, strand: 1, qualifiers: { gene: 'geneA' } },
        {
          type: 'CDS',
          name: 'geneA',
          start: 1,
          end: 12,
          strand: 1,
          qualifiers: qualifiers({ gene: 'geneA', locus_tag: 'T_0001' }),
        },
        {
          type: 'CDS',
          name: 'geneB',
          start: 16,
          end: 27,
          strand: -1,
          qualifiers: qualifiers({ gene: ['geneB'], locus_tag: 'T_0002' }),
        },
        { type: 'CDS', name: 'geneAB', start: 1, end: 12, strand: 1, qualifiers: qualifiers({ gene: 'geneAB' }) },
      ],
    },
    getSequenceForRegion: async (chr, start, end) => CHROMOSOME.substring(start - 1, end),
  };
}

describe('codon usage analysis', () => {
  const GenomeAnalysisService = loadGenomeAnalysisServiceClass();
  const previous = {};

  beforeAll(() => {
    previous.codes = window.GeneticCodes;
    previous.processing = window.UnifiedSequenceProcessing;
    window.GeneticCodes = GeneticCodes;
    window.UnifiedSequenceProcessing = Processing;
  });
  afterAll(() => {
    window.GeneticCodes = previous.codes;
    window.UnifiedSequenceProcessing = previous.processing;
  });

  it('analyses a sequence given directly', async () => {
    const service = new GenomeAnalysisService({}, {});
    const result = await service.codonUsageAnalysis({ sequence: 'atg gct gct gcc taa' });

    expect(result.analysisType).toBe('sequence');
    expect(result.totalCodons).toBe(5);
    expect(result.sequenceLength).toBe(15);
    expect(result.geneticCode).toEqual({ id: 1, name: 'Standard' });
    expect(result.aminoAcidComposition).toEqual({ M: 1, A: 3, '*': 1 });
    expect(result.mostFrequentCodons[0]).toMatchObject({ codon: 'GCT', aminoAcid: 'A', count: 2, frequency: 40 });
    const alanine = result.codonPreferences.A;
    expect(alanine.mostPreferred).toBe('GCT');
    expect(alanine.codons.find(entry => entry.codon === 'GCT')).toMatchObject({ percentage: 66.67, rscu: 2.667 });
  });

  it('finds a gene by exact name and reads a reverse-strand gene on its coding strand', async () => {
    const service = new GenomeAnalysisService(makeApp(11), {});

    const forward = await service.codonUsageAnalysis({ geneName: 'geneA' });
    expect(forward.gene).toMatchObject({ name: 'geneA', type: 'CDS', start: 1, end: 12, strand: '+' });
    expect(forward.geneticCode.id).toBe(11);

    const reverse = await service.codonUsageAnalysis({ locusTag: 'T_0002' });
    expect(reverse.gene).toMatchObject({ name: 'geneB', strand: '-', locusTag: 'T_0002' });
    expect(reverse.analysisType).toBe('locusTag');
    expect(reverse.aminoAcidComposition).toEqual({ M: 1, A: 2, '*': 1 });
  });

  it('uses the genetic code the gene is annotated with unless one is requested', async () => {
    const mycoplasma = new GenomeAnalysisService(makeApp(4), {});
    const annotated = await mycoplasma.codonUsageAnalysis({ geneName: 'geneA' });
    expect(annotated.geneticCode.id).toBe(4);
    expect(annotated.aminoAcidComposition).toEqual({ M: 1, W: 1, K: 1, '*': 1 });

    const overridden = await mycoplasma.codonUsageAnalysis({ geneName: 'geneA', genetic_code: 'standard' });
    expect(overridden.geneticCode.id).toBe(1);
    expect(overridden.aminoAcidComposition).toEqual({ M: 1, K: 1, '*': 2 });

    await expect(mycoplasma.codonUsageAnalysis({ geneName: 'geneA', genetic_code: 'klingon' })).rejects.toThrow(
      /Unknown genetic code/
    );
  });

  it('reports what it cannot analyse', async () => {
    const service = new GenomeAnalysisService(makeApp(11), {});
    await expect(service.codonUsageAnalysis({})).rejects.toThrow(/sequence, geneName, or locusTag/);
    await expect(service.codonUsageAnalysis({ geneName: 'nope' })).rejects.toThrow(/"nope" not found/);
    await expect(service.codonUsageAnalysis({ sequence: 'ATGXYZ' })).rejects.toThrow(/nucleotide codes/);
  });

  it('counts reverse-strand genes on their coding strand in the genome-wide analysis', async () => {
    const service = new GenomeAnalysisService(makeApp(4), {});
    const result = await service.genomeCodonUsageAnalysis({ chromosome: 'chr1', minLength: 1 });

    expect(result.totalGenes).toBe(3);
    expect(result.geneticCode.id).toBe(4);
    // geneA and geneAB: M W K *; geneB (reverse strand): M A A *
    expect(result.aminoAcidComposition).toEqual({ M: 3, W: 2, K: 2, A: 2, '*': 3 });
  });
});
