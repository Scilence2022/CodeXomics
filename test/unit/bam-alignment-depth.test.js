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

  it('aborts a BAM depth scan when its reader is reset without returning partial bins', async () => {
    const reader = createReader();
    let entered;
    const streamPending = new Promise(resolve => {
      entered = resolve;
    });
    reader.bamFile.streamRecordsForRange = async function* (_reference, _start, _end, { signal }) {
      yield [{ start: 1, CIGAR: '5M', flags: 0, mq: 60 }];
      await new Promise((_, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason), { once: true });
        entered();
      });
    };
    const pending = reader.getDepthForRange('chr1', 0, 16, { start: 0, end: 16 }, settings);
    await streamPending;
    reader.reset();
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
    expect(reader.isInitialized).toBe(false);
  });

  it('aborts one BAM scan without resetting the reader or cancelling another range', async () => {
    const reader = createReader();
    const superseded = new AbortController();
    const viewport = { start: 0, end: 16 };
    const originalStream = reader.bamFile.streamRecordsForRange;
    let entered;
    const scanStarted = new Promise(resolve => {
      entered = resolve;
    });
    reader.bamFile.streamRecordsForRange = async function* (reference, start, end, options) {
      if (start === 0) {
        await new Promise((_, reject) => {
          options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
          entered();
        });
      }
      yield* originalStream(reference, start, end, options);
    };
    const previous = reader.getDepthForRange('chr1', 0, 16, viewport, settings, superseded.signal);
    await scanStarted;
    const current = reader.getDepthForRange('chr1', 1, 16, viewport, settings);
    superseded.abort();
    await expect(previous).rejects.toMatchObject({ name: 'AbortError' });
    await expect(current).resolves.toEqual({
      binSize: 1,
      alignedBases: [0, 1, 1, 1, 1, 2, 2, 1, 0, 0, 1, 1, 1, 0, 0, 0],
    });
    expect(reader.isInitialized).toBe(true);
  });

  it('releases a remote BAM initialization that completed after reset', async () => {
    const reader = new BamReader();
    let finish;
    const destroy = vi.fn(async () => ({ success: true }));
    vi.stubGlobal('electronAPI', {
      bamReader: {
        initialize: () =>
          new Promise(resolve => {
            finish = resolve;
          }),
        destroy,
      },
    });
    try {
      const pending = reader.initializeViaIpc('/first.bam');
      reader.reset();
      finish({ readerId: 'old-reader', state: { isInitialized: true } });
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      expect(destroy).toHaveBeenCalledWith('old-reader');
      expect(reader.backendId).toBeNull();
      expect(reader.isInitialized).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('does not apply a late IPC query response to a reset reader', async () => {
    const reader = new BamReader();
    reader.usesIpcBackend = true;
    reader.backendId = 'old-reader';
    reader.isInitialized = true;
    let finish;
    const destroy = vi.fn(async () => ({ success: true }));
    vi.stubGlobal('electronAPI', {
      bamReader: {
        initialize: vi.fn(),
        destroy,
        getRecordsForRange: () =>
          new Promise(resolve => {
            finish = resolve;
          }),
      },
    });
    try {
      const pending = reader.getRecordsForRange('chr1', 0, 16);
      reader.reset();
      finish({ reads: [{ id: 'obsolete-read' }], state: { isInitialized: true } });
      await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
      expect(destroy).toHaveBeenCalledWith('old-reader');
      expect(reader.isInitialized).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe('BAM display collection', () => {
  it('preserves ordinary records in input order with no sampling metadata', async () => {
    const reader = createReader();
    reader.bamFile.streamRecordsForRange = async function* () {
      yield [{ id: 'first', start: 1 }];
      yield [{ id: 'second', start: 2 }];
    };
    reader.convertRecordsToReads = records => records;
    const reads = await reader.getRecordsForRange('chr1', 0, 16);
    expect(reads.map(read => read.id)).toEqual(['first', 'second']);
    expect(reads._sourceSamplingInfo).toBeUndefined();
    expect(reader.bamFile.getRecordsForRange).not.toHaveBeenCalled();
  });

  it('queries large ranges in windows and returns a spanning alignment only once', async () => {
    const reader = createReader();
    const spanning = { id: 'spanning', start: 999990 };
    reader.bamFile.streamRecordsForRange = vi.fn(async function* (_reference, start) {
      yield start === 0 ? [spanning] : [spanning, { id: 'next', start: 1000000 }];
    });
    reader.convertRecordsToReads = records => records;
    const reads = await reader.getRecordsForRange('chr1', 0, 1000010);
    expect(reads.map(read => read.id)).toEqual(['spanning', 'next']);
    expect(reader.bamFile.streamRecordsForRange.mock.calls.map(call => call.slice(0, 3))).toEqual([
      ['chr1', 0, 1000000],
      ['chr1', 1000000, 1000010],
    ]);
  });

  it('clips display windows to the known reference length and rejects unbounded coordinates', async () => {
    const reader = createReader();
    reader.references = [{ name: 'chr1', length: 16 }];
    reader.bamFile.streamRecordsForRange = vi.fn(async function* () {
      yield [];
    });
    await expect(reader.getRecordsForRange('chr1', 0, 9000000)).resolves.toEqual([]);
    expect(reader.bamFile.streamRecordsForRange.mock.calls.map(call => call.slice(0, 3))).toEqual([['chr1', 0, 16]]);
    await expect(reader.getRecordsForRange('chr1', 0, Infinity)).rejects.toThrow('safe integers');
  });

  it('counts the complete stream and fills the sample while retaining a sparse distant position', async () => {
    const reader = createReader();
    const totalRecords = 200123;
    reader.bamFile.streamRecordsForRange = async function* () {
      for (let offset = 0; offset < totalRecords; offset += 5000) {
        yield Array.from({ length: Math.min(5000, totalRecords - offset) }, (_, index) => {
          const id = offset + index;
          return { id, start: id === totalRecords - 1 ? 9990 : 10 + (id % 17) };
        });
      }
    };
    reader.convertRecordsToReads = records => records;
    const reads = await reader.getRecordsForRange('chr1', 0, 10000);
    expect(reads).toHaveLength(100000);
    expect(reads._sourceSamplingInfo).toEqual({ totalRecords, sampledRecords: 100000 });
    expect(reads.some(read => read.start === 9990)).toBe(true);
    expect(new Set(reads.map(read => read.id)).size).toBe(100000);
    expect(reader.bamFile.getRecordsForRange).not.toHaveBeenCalled();
  });
});
