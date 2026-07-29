/**
 * Reliability of the two BLAST search entry points.
 *
 * These cover the failure chain seen in practice: a transient fault during
 * polling resubmitted the whole job, the resubmission tripped NCBI's 10s
 * submission spacing (every retry backoff is shorter than it), and the
 * resulting "Please wait N seconds" matched none of isRetryableError's
 * patterns — so a blip became a hard failure that discarded a job already
 * running at NCBI.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const BlastManager = require('../../src/renderer/modules/BlastManager.js');

function createBlastManager(overrides = {}) {
  const manager = Object.create(BlastManager.prototype);
  manager.lastBlastSubmission = 0;
  manager.submissionCount = 0;
  manager.rateLimitWindow = 24 * 60 * 60 * 1000;
  manager.maxSubmissionsPerDay = 100;
  manager.minSubmissionInterval = 10000;
  manager.minNCBIPollInterval = 60000;
  manager.config = {
    ncbiBaseUrl: 'https://blast.ncbi.nlm.nih.gov/blast/Blast.cgi',
    ncbiPollInterval: 60000,
    ncbiTool: 'CodeXomics',
    ncbiEmail: null,
    maxWaitTime: 300000,
  };
  manager.updateSearchProgress = vi.fn();
  manager.showNotification = vi.fn();
  manager.refreshBlastTrack = vi.fn();
  return Object.assign(manager, overrides);
}

describe('blast_search backend routing', () => {
  it('defaults to the online backend when service is omitted', async () => {
    // The LLM never sends `service`; this path used to throw
    // 'Unsupported BLAST service' while BlastFunctionTools defaulted to online.
    const manager = createBlastManager({
      executeNCBIBlast: vi.fn(async () => ({ hits: [] })),
      executeLocalBlast: vi.fn(),
    });

    await manager.executeBlastSearch({ sequence: 'ATGC', blastType: 'blastn', database: 'nt' });

    expect(manager.executeNCBIBlast).toHaveBeenCalledTimes(1);
    expect(manager.executeLocalBlast).not.toHaveBeenCalled();
  });

  it.each(['online', 'ncbi', 'remote'])('routes service=%s to NCBI', async service => {
    const manager = createBlastManager({
      executeNCBIBlast: vi.fn(async () => ({ hits: [] })),
      executeLocalBlast: vi.fn(),
    });

    await manager.executeBlastSearch({ sequence: 'ATGC', blastType: 'blastn', database: 'nt', service });

    expect(manager.executeNCBIBlast).toHaveBeenCalledTimes(1);
  });

  it.each(['local', 'blast+'])('routes service=%s to local BLAST+', async service => {
    const manager = createBlastManager({
      executeNCBIBlast: vi.fn(),
      executeLocalBlast: vi.fn(async () => ({ hits: [] })),
    });

    await manager.executeBlastSearch({ sequence: 'ATGC', blastType: 'blastn', database: 'db', service });

    expect(manager.executeLocalBlast).toHaveBeenCalledTimes(1);
    expect(manager.executeNCBIBlast).not.toHaveBeenCalled();
  });

  it('accepts the searchType alias used by BlastFunctionTools', async () => {
    const manager = createBlastManager({
      executeNCBIBlast: vi.fn(),
      executeLocalBlast: vi.fn(async () => ({ hits: [] })),
    });

    await manager.executeBlastSearch({ sequence: 'ATGC', blastType: 'blastn', searchType: 'local' });

    expect(manager.executeLocalBlast).toHaveBeenCalledTimes(1);
  });

  it('names the offending value when the service is genuinely unknown', async () => {
    const manager = createBlastManager();

    await expect(manager.executeBlastSearch({ sequence: 'ATGC', service: 'carrier-pigeon' })).rejects.toThrow(
      /Unsupported BLAST service 'carrier-pigeon'/
    );
  });
});

describe('NCBI submission spacing', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('waits out the interval instead of failing the search', async () => {
    vi.useFakeTimers();
    const manager = createBlastManager();
    manager.lastBlastSubmission = Date.now() - 3000; // 7s still to wait

    let settled = false;
    const pending = manager.awaitSubmissionSlot(Date.now() + 300000).then(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(6000);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1500);
    await pending;

    expect(settled).toBe(true);
  });

  it('returns immediately when the interval has already elapsed', async () => {
    const manager = createBlastManager();
    manager.lastBlastSubmission = Date.now() - 60000;

    await expect(manager.awaitSubmissionSlot(Date.now() + 300000)).resolves.toBeUndefined();
  });

  it('fails fast when the required wait would exceed the search budget', async () => {
    const manager = createBlastManager();
    manager.lastBlastSubmission = Date.now();

    await expect(manager.awaitSubmissionSlot(Date.now() + 2000)).rejects.toThrow(/exceeds the remaining time budget/);
  });

  it('still treats the daily cap as fatal', async () => {
    const manager = createBlastManager();
    manager.submissionCount = 100;
    manager.lastBlastSubmission = Date.now() - 1000;

    await expect(manager.awaitSubmissionSlot()).rejects.toThrow(/Daily submission limit reached/);
  });

  it('resets the daily counter once the window has passed', async () => {
    const manager = createBlastManager();
    manager.submissionCount = 100;
    manager.lastBlastSubmission = Date.now() - (24 * 60 * 60 * 1000 + 1000);

    await expect(manager.awaitSubmissionSlot()).resolves.toBeUndefined();
    expect(manager.submissionCount).toBe(0);
  });
});

describe('retrying an online search', () => {
  it('resumes the existing RID instead of resubmitting after a poll failure', async () => {
    vi.useFakeTimers();
    try {
      const manager = createBlastManager();
      const submit = vi.fn(async () => ({ rid: 'RID_ORIGINAL', rtoe: 0 }));
      const poll = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockResolvedValueOnce({ hits: [{ accession: 'X1' }] });
      manager.submitNCBIBlastJobWithRetry = submit;
      manager.pollNCBIBlastResults = poll;

      const pending = manager.executeNCBIBlast({ sequence: 'ATGC', blastType: 'blastn', database: 'nt' });
      await vi.runAllTimersAsync();
      const results = await pending;

      // The decisive check: one submission, two polls. Resubmitting would have
      // abandoned a job already running at NCBI and burned a rate-limit slot.
      expect(submit).toHaveBeenCalledTimes(1);
      expect(poll).toHaveBeenCalledTimes(2);
      expect(poll.mock.calls[1][0]).toEqual({ rid: 'RID_ORIGINAL', rtoe: 0 });
      expect(results.searchId).toBe('RID_ORIGINAL');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does resubmit when the failure happened before a RID existed', async () => {
    vi.useFakeTimers();
    try {
      const manager = createBlastManager();
      const submit = vi
        .fn()
        .mockRejectedValueOnce(new Error('Failed to fetch'))
        .mockResolvedValueOnce({ rid: 'RID_SECOND', rtoe: 0 });
      manager.submitNCBIBlastJobWithRetry = submit;
      manager.pollNCBIBlastResults = vi.fn(async () => ({ hits: [] }));

      const pending = manager.executeNCBIBlast({ sequence: 'ATGC', blastType: 'blastn', database: 'nt' });
      await vi.runAllTimersAsync();
      const results = await pending;

      expect(submit).toHaveBeenCalledTimes(2);
      expect(results.searchId).toBe('RID_SECOND');
    } finally {
      vi.useRealTimers();
    }
  });

  it('does not retry a non-retryable failure such as an expired RID', async () => {
    const manager = createBlastManager();
    manager.submitNCBIBlastJobWithRetry = vi.fn(async () => ({ rid: 'RID_STALE', rtoe: 0 }));
    manager.pollNCBIBlastResults = vi.fn(async () => {
      throw new Error('BLAST job status UNKNOWN for RID RID_STALE. The RID may be invalid, expired, or rejected.');
    });

    const result = await manager.executeNCBIBlast({ sequence: 'ATGC', blastType: 'blastn', database: 'nt' });

    expect(manager.pollNCBIBlastResults).toHaveBeenCalledTimes(1);
    expect(result.isError).toBe(true);
    expect(result.retryable).toBe(false);
  });

  it('reports whether a failure was retryable and which RID is still running', async () => {
    // Every poll fails here, so the run walks the full 2s/4s/8s backoff before
    // giving up; fake timers keep that from costing 14s of wall clock.
    vi.useFakeTimers();
    try {
      const manager = createBlastManager();
      manager.submitNCBIBlastJobWithRetry = vi.fn(async () => ({ rid: 'RID_LIVE', rtoe: 0 }));
      manager.pollNCBIBlastResults = vi.fn(async () => {
        throw new Error('Failed to fetch');
      });

      const pending = manager.executeNCBIBlast({ sequence: 'ATGC', blastType: 'blastn', database: 'nt' });
      await vi.runAllTimersAsync();
      const result = await pending;

      expect(manager.submitNCBIBlastJobWithRetry).toHaveBeenCalledTimes(1);
      expect(result.isError).toBe(true);
      expect(result.retryable).toBe(true);
      expect(result.rid).toBe('RID_LIVE');
    } finally {
      vi.useRealTimers();
    }
  });
});
