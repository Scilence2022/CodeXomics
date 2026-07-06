import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const BlastManager = require('../../src/renderer/modules/BlastManager.js');
const BlastFunctionTools = require('../../src/renderer/modules/BlastFunctionTools.js');

function createBlastManager() {
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
  return manager;
}

function response(text, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? 'OK' : 'Error',
    text: vi.fn(async () => text),
  };
}

describe('NCBI online BLAST execution', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('submits URL API parameters and parses only explicit RID/RTOE fields', async () => {
    const manager = createBlastManager();
    let submittedBody = null;
    const fetchMock = vi.fn(async (_url, options) => {
      submittedBody = new URLSearchParams(options.body);
      return response('RID = RID123456789\nRTOE = 42\n');
    });
    vi.stubGlobal('fetch', fetchMock);

    const job = await manager.submitNCBIBlastJob({
      sequence: 'ATGCGTACGTAGCTAGCTAGCTA',
      blastType: 'blastn',
      database: 'nt',
      evalue: '0.01',
      maxTargets: 20,
    });

    expect(job).toEqual({ rid: 'RID123456789', rtoe: 42 });
    expect(submittedBody.get('CMD')).toBe('Put');
    expect(submittedBody.get('PROGRAM')).toBe('blastn');
    expect(submittedBody.get('DATABASE')).toBe('nt');
    expect(submittedBody.get('EXPECT')).toBe('0.01');
    expect(submittedBody.get('HITLIST_SIZE')).toBe('20');
    expect(submittedBody.get('TOOL')).toBe('CodeXomics');
    expect(submittedBody.has('SERVICE')).toBe(false);
    expect(submittedBody.has('MATRIX_NAME')).toBe(false);
  });

  it('does not treat arbitrary HTML tokens as a BLAST RID', () => {
    const manager = createBlastManager();
    const parsed = manager.parseNCBIBlastSubmission('<html><script>const token = "ABCDEFGHIJKL12345";</script></html>');

    expect(parsed).toEqual({ rid: null, rtoe: null });
  });

  it('polls by RID using RTOE and NCBI one-minute status intervals', async () => {
    const manager = createBlastManager();
    manager.waitForNCBIPollDelay = vi.fn(async () => {});
    manager.parseNCBIBlastXML = vi.fn(() => ({
      searchId: 'temporary-id',
      hits: [],
      statistics: {},
    }));

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(response('Status=WAITING\n'))
      .mockResolvedValueOnce(response('Status=READY\nThereAreHits=yes\n'))
      .mockResolvedValueOnce(response('<BlastOutput></BlastOutput>'))
      .mockResolvedValueOnce(response('BLAST text output'));
    vi.stubGlobal('fetch', fetchMock);

    const result = await manager.pollNCBIBlastResults(
      { rid: 'RID123456789', rtoe: 7 },
      {
        sequence: 'ATGCGTACGTAGCTAGCTAGCTA',
        maxTargets: 20,
      },
      3
    );

    expect(manager.waitForNCBIPollDelay).toHaveBeenNthCalledWith(1, 7000);
    expect(manager.waitForNCBIPollDelay).toHaveBeenNthCalledWith(2, 60000);
    expect(fetchMock).toHaveBeenCalledTimes(4);

    const firstStatusUrl = new URL(fetchMock.mock.calls[0][0]);
    expect(firstStatusUrl.searchParams.get('CMD')).toBe('Get');
    expect(firstStatusUrl.searchParams.get('FORMAT_OBJECT')).toBe('SearchInfo');
    expect(firstStatusUrl.searchParams.get('RID')).toBe('RID123456789');

    const resultUrl = new URL(fetchMock.mock.calls[2][0]);
    expect(resultUrl.searchParams.get('FORMAT_TYPE')).toBe('XML');
    expect(resultUrl.searchParams.get('DESCRIPTIONS')).toBe('20');
    expect(resultUrl.searchParams.get('ALIGNMENTS')).toBe('20');
    expect(result.jobId).toBe('RID123456789');
    expect(result.rawXML).toBe('<BlastOutput></BlastOutput>');
    expect(result.rawText).toBe('BLAST text output');
  });

  it('reports UNKNOWN status with the RID instead of continuing with stale results', async () => {
    const manager = createBlastManager();
    manager.waitForNCBIPollDelay = vi.fn(async () => {});
    vi.stubGlobal('fetch', vi.fn(async () => response('Status=UNKNOWN\n')));

    await expect(
      manager.pollNCBIBlastResults({ rid: 'RID123456789', rtoe: 0 }, { sequence: 'ATGCGTACGTAGCTAGCTAGCTA' }, 1)
    ).rejects.toThrow('BLAST job status UNKNOWN for RID RID123456789');
  });

  it('marks online BLAST tool calls as failed when BlastManager returns an error result', async () => {
    const tools = Object.create(BlastFunctionTools.prototype);
    tools.blastManager = {
      executeNCBIBlast: vi.fn(async () => ({
        isError: true,
        errorMessage: 'BLAST job status UNKNOWN for RID RID123456789',
      })),
    };

    const result = await tools.executeOnlineBlastSearch({
      sequence: 'ATGCGTACGTAGCTAGCTAGCTA',
      blastType: 'blastn',
      database: 'nt',
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('UNKNOWN');
  });
});
