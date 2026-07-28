import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

function readSource(relativePath) {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf8');
}

function loadMethods(relativePath, signatures) {
  const source = readSource(relativePath);
  const bodies = signatures.map(signature => {
    const start = source.indexOf(`\n  ${signature} {`);
    if (start === -1) throw new Error(`Unable to locate ${signature} in ${relativePath}`);
    const end = source.indexOf('\n  }\n', start);
    if (end === -1) throw new Error(`Unable to bound ${signature} in ${relativePath}`);
    return source.slice(start + 1, end + 4);
  });
  // eslint-disable-next-line no-new-func -- loads real source methods into an isolated class
  return new Function(`return class Extracted {\n${bodies.join('\n')}\n}`)();
}

const BlastManagerMethods = loadMethods('src/renderer/modules/BlastManager.js', [
  'getPathModule()',
  'getCurrentFileDirectory()',
  'isGenomeSequenceFilePath(filePath)',
  'getCurrentGenomeFilePath()',
  'stripGenomeFileExtension(fileName)',
  'getQuickDatabaseBaseName(genomeName, dbType)',
  "sanitizeFileNamePart(value, fallback = 'blast')",
]);

const BlastFunctionToolsMethods = loadMethods('src/renderer/modules/BlastFunctionTools.js', ['getCurrentGenomeId()']);

/**
 * FileManager.currentFile is overwritten by every loaded file, so a genome plus a
 * coverage track leaves it pointing at the track.
 */
function managerWith(app) {
  const manager = new BlastManagerMethods();
  manager.app = app;
  return manager;
}

function genomeThenTrack() {
  return {
    loadedGenomePath: '/data/genomes/ECOLI.gbk',
    currentChromosome: 'U00096.3',
    fileManager: {
      currentFile: {
        path: '/data/tracks/another_sample.wig',
        info: { path: '/data/tracks/another_sample.wig', extension: '.wig' },
      },
    },
  };
}

describe('quick BLAST database naming follows the genome, not the last loaded file', () => {
  it('names the database after the genome when a WIG track was loaded afterwards', () => {
    // The bug: the success message read "Successfully created nucleotide
    // database: another_sample.wig" because the name came from the WIG track.
    const manager = managerWith(genomeThenTrack());

    expect(manager.getQuickDatabaseBaseName('U00096.3', 'nucl')).toBe('ECOLI');
    expect(manager.getQuickDatabaseBaseName('U00096.3', 'prot')).toBe('ECOLI_protein');
  });

  it('writes the database beside the genome rather than beside the track', () => {
    const manager = managerWith(genomeThenTrack());

    expect(manager.getCurrentGenomeFilePath()).toBe('/data/genomes/ECOLI.gbk');
    expect(manager.getCurrentFileDirectory()).toBe('/data/genomes');
  });

  it('ignores non-sequence files when no genome source has been recorded', () => {
    const manager = managerWith({
      currentChromosome: 'chr1',
      fileManager: { currentFile: { path: '/data/tracks/another_sample.wig' } },
    });

    expect(manager.getCurrentGenomeFilePath()).toBeNull();
    expect(manager.getCurrentFileDirectory()).toBeNull();
    // Falls back to the genome/chromosome name instead of inventing a track name.
    expect(manager.getQuickDatabaseBaseName('chr1', 'nucl')).toBe('chr1');
  });

  it('still accepts a sequence file reached through the currentFile fallbacks', () => {
    const fromPath = managerWith({ fileManager: { currentFile: { path: '/data/ECOLI.fasta' } } });
    expect(fromPath.getQuickDatabaseBaseName('genome', 'nucl')).toBe('ECOLI');

    const fromInfo = managerWith({ fileManager: { currentFile: { info: { path: '/data/ECOLI.fna' } } } });
    expect(fromInfo.getQuickDatabaseBaseName('genome', 'nucl')).toBe('ECOLI');
  });

  it('recognises every sequence format the genome open dialog offers', () => {
    const manager = managerWith({});

    for (const name of ['g.fasta', 'g.fa', 'g.fas', 'g.fna', 'g.gb', 'g.gbk', 'g.gbff', 'g.genbank', 'g.gbk.gz']) {
      expect(manager.isGenomeSequenceFilePath(`/data/${name}`), name).toBe(true);
    }

    for (const name of ['t.wig', 't.bw', 't.bigwig', 't.bed', 't.gff', 't.gtf', 't.vcf', 't.sam', 't.bam']) {
      expect(manager.isGenomeSequenceFilePath(`/data/${name}`), name).toBe(false);
    }
  });

  it('strips gzip and GenBank suffixes so database files are not named ECOLI.gbk.gz', () => {
    const manager = managerWith({ loadedGenomePath: '/data/ECOLI.gbk.gz' });

    expect(manager.stripGenomeFileExtension('ECOLI.gbk.gz')).toBe('ECOLI');
    expect(manager.stripGenomeFileExtension('ECOLI.gbff')).toBe('ECOLI');
    expect(manager.getQuickDatabaseBaseName('U00096.3', 'nucl')).toBe('ECOLI');
  });

  it('keeps dots that belong to the accession itself', () => {
    const manager = managerWith({ loadedGenomePath: '/data/NC_000913.3.fasta' });

    expect(manager.getQuickDatabaseBaseName('genome', 'nucl')).toBe('NC_000913.3');
  });
});

describe('genome-to-database associations key on the genome source', () => {
  function toolsWith(app) {
    const tools = new BlastFunctionToolsMethods();
    tools.blastManager = managerWith(app);
    return tools;
  }

  it('does not re-key the association when a track is loaded after the genome', () => {
    expect(toolsWith(genomeThenTrack()).getCurrentGenomeId()).toBe('ECOLI');
  });

  it('falls back to the current chromosome when no genome file is known', () => {
    const tools = toolsWith({
      currentChromosome: 'chr1',
      fileManager: { currentFile: { path: '/data/tracks/another_sample.wig' } },
    });

    expect(tools.getCurrentGenomeId()).toBe('chr1');
  });

  it('falls back to the first loaded sequence when nothing else identifies the genome', () => {
    expect(toolsWith({ currentSequence: { contig_1: 'ACGT' } }).getCurrentGenomeId()).toBe('contig_1');
  });
});
