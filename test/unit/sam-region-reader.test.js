import { describe, expect, it } from 'vitest';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { readSamRegion } from '../../src/main/sam-region-reader.js';
import ReadsManager from '../../src/renderer/modules/ReadsManager.js';

const makeLine = (name, flags, start, cigar, sequence, quality = '*') =>
  [name, flags, 'chr1', start, 60, cigar, '*', 0, 0, sequence, quality].join('\t');

async function withSamFile(text, test) {
  const directory = await mkdtemp(join(tmpdir(), 'codexomics-sam-'));
  try {
    const file = join(directory, 'fixture.sam');
    await writeFile(file, text);
    await test(file);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe('SAM region scanning', () => {
  it('keeps spliced alignments that reach a region beyond their sequence length', async () => {
    const primary = makeLine('spliced', 0, 1, '3M8N3M', 'AAATTT');
    const secondary = makeLine('secondary', 256, 11, '4M', 'AAAA');
    const data = '@SQ\tSN:chr1\tLN:100\r\n' + primary + '\r\n' + secondary;
    const settings = {
      viewportCoordinates: true,
      showSecondary: false,
      depthViewport: { start: 10, end: 16 },
    };

    await withSamFile(data, async file => {
      const result = await readSamRegion(file, 'chr1', 10, 16, settings);
      expect(result.reads).toMatchObject([{ id: 'spliced', start: 1, end: 14 }]);
      expect(result.depth).toEqual({ binSize: 1, alignedBases: [0, 1, 1, 1, 0, 0] });

      const manager = new ReadsManager({});
      await manager.initializeWithSAMData(data, file);
      const reads = await manager.getReadsForRegion('chr1', 10, 16, settings);
      expect(Array.from(reads)).toEqual(result.reads);
      expect(reads._alignmentDepth).toEqual(result.depth);

      const all = await manager.getReadsForRegion('chr1', 10, 16, { ...settings, showSecondary: true });
      expect(all.map(read => read.id)).toEqual(['spliced', 'secondary']);
      expect(all._alignmentDepth.alignedBases).toEqual([1, 2, 2, 2, 0, 0]);
    });
  });

  it('discards a streamed query that completes after the active source changes', async () => {
    const manager = new ReadsManager({});
    await manager.initializeWithStreamingSAM('/old.sam');
    let finish;
    manager.loadReadsForRegionStream = () =>
      new Promise(resolve => {
        finish = resolve;
      });
    const oldQuery = manager.getReadsForRegion('chr1', 0, 1);
    await manager.initializeWithSAMData(makeLine('new', 0, 1, '1M', 'A'), '/new.sam');
    finish([{ id: 'old' }]);

    await expect(oldQuery).resolves.toEqual([]);
    expect(manager.cache.size).toBe(0);
    expect((await manager.getReadsForRegion('chr1', 0, 1)).map(read => read.id)).toEqual(['new']);
  });

  it('counts every qualifying alignment when the display payload reaches its limit', async () => {
    const data = makeLine('dense', 0, 1, '1M', 'A').concat('\n').repeat(51_000);
    await withSamFile(data, async file => {
      const result = await readSamRegion(file, 'chr1', 0, 1, { depthViewport: { start: 0, end: 1 } });
      expect(result.reads).toHaveLength(50_000);
      expect(result.depth.alignedBases).toEqual([51_000]);
      expect(result.sourceSamplingInfo).toEqual({ totalRecords: 51_000, sampledRecords: 50_000, truncated: true });
    });
  });
});
