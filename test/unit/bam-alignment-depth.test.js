import { describe, expect, it, vi } from 'vitest';
import BamReader from '../../src/renderer/modules/BamReader.js';

function createReader() {
  const reader = new BamReader();
  reader.isInitialized = true;
  reader.bamFile = {
    // prettier-ignore
    async* streamRecordsForRange() {
      yield [
        { start: 0, CIGAR: '2S3M2D2M3N2M1I1M', flags: 0, mq: 60 },
        { start: 2, CIGAR: '5M', flags: 0, mq: 5 },
        { start: 3, CIGAR: '2=1X2M', flags: 16, mq: 60 },
      ];
      yield [
        { start: 6, CIGAR: '3M', flags: 256, mq: 60 },
        { start: 9, CIGAR: '4M', flags: 2048, mq: 60 },
        { start: 14, CIGAR: '3M', flags: 4, mq: 60 },
      ];
    },
    getRecordsForRange: vi.fn(),
  };
  return reader;
}

const settings = { minMappingQuality: 20, showSecondary: false, showSupplementary: false };

describe('BAM alignment depth', () => {
  it('uses aligned CIGAR bases, the mapping filters, and no read-display sampling', async () => {
    const reader = createReader();
    const viewport = { start: 0, end: 16 };
    const depth = await reader.getDepthForRange('chr1', 0, 16, viewport, settings);
    expect(depth).toEqual({
      binSize: 1,
      alignedBases: [1, 1, 1, 1, 1, 2, 2, 1, 0, 0, 1, 1, 1, 0, 0, 0],
    });
    const sampled = await reader.getDepthForRange('chr1', 0, 16, viewport, {
      ...settings,
      enableSampling: true,
      samplingRate: 0.1,
    });
    expect(sampled).toEqual(depth);
    expect(reader.bamFile.getRecordsForRange).not.toHaveBeenCalled();
  });

  it('clips the query segment and places its depths at the offset in a shared viewport', async () => {
    const reader = createReader();
    const depth = await reader.getDepthForRange('chr1', 3, 7, { start: 8, end: 15, offset: 7 }, settings);
    expect(depth).toEqual({ binSize: 1, alignedBases: [0, 0, 1, 1, 2, 2, 0] });
  });

  it('counts full interior bins and clips the final partial bin', async () => {
    const reader = createReader();
    reader.bamFile.streamRecordsForRange = async function* () {
      yield [{ start: 1, CIGAR: '2500M', flags: 0, mq: 60 }];
    };
    const depth = await reader.getDepthForRange('chr1', 0, 2501, { start: 0, end: 2501 }, settings);
    expect(depth.binSize).toBe(3);
    expect(depth.alignedBases).toEqual([2, ...new Array(832).fill(3), 2]);
  });
});
