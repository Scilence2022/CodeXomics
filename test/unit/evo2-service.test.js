// @vitest-environment node
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs/promises';
import os from 'os';
import path from 'path';
const require = createRequire(import.meta.url);
const { Evo2Service, buildRequest, ENDPOINT, registerEvo2Ipc } = require('../../src/main/evo2-service');

const secretStore = {
  isEncryptionAvailable: () => true,
  encryptSecret: value => `encrypted:${Buffer.from(value).toString('base64')}`,
  isEncryptedValue: value => value.startsWith('encrypted:'),
  decryptSecret: value => Buffer.from(value.slice(10), 'base64').toString(),
};
const key = 'nvapi-test-fixture';
const response = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json', ...headers },
  });
let storageDir;
let service;
beforeEach(async () => {
  storageDir = await fs.mkdtemp(path.join(os.tmpdir(), 'evo2-test-'));
  service = new Evo2Service({
    storageDir,
    secretStore,
    pollMs: 1,
    fetchImpl: vi.fn().mockResolvedValue(response({ sequence: 'ACTG', elapsed_ms: 12 })),
  });
});
afterEach(async () => {
  for (const job of service.jobs.values()) service.releaseOwner(job.ownerId);
  await fs.rm(storageDir, { recursive: true, force: true });
});
async function run(input = { sequence: 'ACTG', num_tokens: 4 }) {
  await service.saveSettings({ apiKey: key });
  const job = await service.generate(1, input);
  await service.getJob(1, job.job_id).completion;
  return service.getResult(1, job);
}

describe('Evo 2 request contract', () => {
  it('normalizes one FASTA record and preserves explicit zero and false values', () => {
    expect(
      buildRequest({ sequence: '>test\nac gt\nn', top_k: 0, top_p: 0, random_seed: 0, enable_sampled_probs: false })
    ).toEqual({
      sequence: 'ACGTN',
      num_tokens: 100,
      temperature: 0.7,
      top_k: 0,
      top_p: 0,
      random_seed: 0,
      enable_logits: false,
      enable_sampled_probs: false,
      enable_elapsed_ms_per_token: false,
    });
  });
  it.each([
    { sequence: '' },
    { sequence: '>one\nACTG\n>two\nACTG' },
    { sequence: 'ACGU' },
    { temperature: 0 },
    { temperature: 1.31 },
    { top_k: 7 },
    { top_k: 0.5 },
    { top_p: -1 },
    { num_tokens: 0 },
    { num_tokens: 1201 },
    { random_seed: 0.1 },
    { random_seed: Infinity },
    { enable_logits: 'false' },
    { sequence: 'A'.repeat(100001) },
    { taxonomy: 'invalid' },
  ])('rejects invalid input without a provider call: %j', input => {
    expect(() => buildRequest({ sequence: 'ACTG', ...input })).toThrow();
  });
  it('preserves taxonomy spelling and only sends documented fields', () => {
    const taxonomy = '|k__Bacteria;p__P;c__C;o__O;g__G;s__Species|';
    const body = buildRequest({
      sequence: 'actg',
      taxonomy,
      apiKey: 'ignored',
      endpoint: 'ignored',
      job_id: 'ignored',
    });
    expect(body.sequence).toBe(`${taxonomy}ACTG`);
    expect(body.apiKey).toBeUndefined();
    expect(body.endpoint).toBeUndefined();
  });
});

describe('Evo 2 credentials and jobs', () => {
  it('stores only encrypted credentials, does not expose them, and supports removal', async () => {
    expect(await service.getSettings()).toMatchObject({ configured: false });
    const saved = await service.saveSettings({ apiKey: key });
    expect(saved).toMatchObject({ configured: true });
    expect(JSON.stringify(saved)).not.toContain(key);
    expect(await fs.readFile(service.configPath, 'utf8')).not.toContain(key);
    expect(await service.readKey()).toBe(key);
    expect((await service.saveSettings({ removeKey: true })).configured).toBe(false);
  });
  it('never falls back to plaintext when encryption is unavailable or fails', async () => {
    service.secrets = { ...secretStore, isEncryptionAvailable: () => false };
    await expect(service.saveSettings({ apiKey: key })).rejects.toThrow('not saved');
    service.secrets = { ...secretStore, encryptSecret: value => value };
    await expect(service.saveSettings({ apiKey: key })).rejects.toThrow('not saved');
    await expect(fs.readFile(service.configPath)).rejects.toMatchObject({ code: 'ENOENT' });
  });
  it('requires credentials before sending DNA', async () => {
    await expect(service.generate(1, { sequence: 'ACTG' })).rejects.toThrow('Configure');
    expect(service.fetch).not.toHaveBeenCalled();
  });
  it('returns a job immediately and preserves documented response fields', async () => {
    service.fetch.mockResolvedValue(
      response({
        sequence: 'ACTG',
        elapsed_ms: 12,
        sampled_probs: [0.1, 0.2, 0.3, 0.4],
        logits: [
          [1, 2],
          [3, 4],
        ],
        elapsed_ms_per_token: [3, 3, 3, 3],
      })
    );
    const job = await run();
    expect(job).toMatchObject({
      success: true,
      status: 'completed',
      result: { sequence: 'ACTG', logits_shape: [2, 2] },
    });
    expect(job.result.logits).toBeUndefined();
    expect(service.getResult(1, { job_id: job.job_id, include_logits: true }).result.logits).toHaveLength(2);
    expect(JSON.stringify(job)).not.toContain(key);
    expect(service.fetch).toHaveBeenCalledWith(
      ENDPOINT,
      expect.objectContaining({
        method: 'POST',
        redirect: 'error',
        headers: expect.objectContaining({ Authorization: `Bearer ${key}` }),
      })
    );
    expect(service.getResult(1, job).elapsed_ms).toBe(job.elapsed_ms);
  });
  it('polls accepted requests without resubmitting generation', async () => {
    service.fetch
      .mockResolvedValueOnce(response({}, 202, { 'nvcf-reqid': 'request-1' }))
      .mockResolvedValueOnce(response({ reqId: 'request-1' }, 202))
      .mockResolvedValueOnce(response({ sequence: 'ACTG', elapsed_ms: 15 }));
    expect((await run()).status).toBe('completed');
    expect(service.fetch.mock.calls.filter(([, options]) => options.method === 'POST')).toHaveLength(1);
    expect(service.fetch.mock.calls[1][0]).toBe('https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/request-1');
  });
  it.each([401, 403, 422, 429, 500])(
    'reports HTTP %i without reflecting credentials or provider content',
    async status => {
      service.fetch.mockResolvedValue(response({ error: key }, status));
      const job = await run();
      expect(job).toMatchObject({ status: 'failed', success: false });
      expect(job.error).toContain(`HTTP ${status}`);
      expect(job.error).not.toContain(key);
      expect(service.fetch).toHaveBeenCalledTimes(1);
    }
  );
  it('rejects malformed result data and missing polling IDs', async () => {
    service.fetch.mockResolvedValueOnce(response({ sequence: 'ignored' })).mockResolvedValueOnce(response({}, 202));
    expect((await run()).error).toContain('invalid generation result');
    expect((await run()).error).toContain('request ID');
  });
  it('handles binary responses without treating them as DNA', async () => {
    service.fetch.mockResolvedValue(new Response('zip', { headers: { 'content-type': 'application/zip' } }));
    expect((await run()).error).toContain('non-JSON');
  });
  it('isolates jobs by window, bounds active requests, and keeps cancellation sticky', async () => {
    let resolveFetch;
    service.fetch.mockImplementation(
      () =>
        new Promise(resolve => {
          resolveFetch = resolve;
        })
    );
    await service.saveSettings({ apiKey: key });
    const job = await service.generate(1, { sequence: 'ACTG' });
    expect(job.status).toBe('running');
    await expect(service.generate(1, { sequence: 'ACTG' })).rejects.toThrow('already running');
    expect(() => service.getResult(2, job)).toThrow('not found');
    expect(() => service.cancel(2, job)).toThrow('not found');
    service.cancel(1, job);
    resolveFetch(response({ sequence: 'AAAA', elapsed_ms: 2 }));
    await service.getJob(1, job.job_id).completion;
    expect(service.getResult(1, job).status).toBe('cancelled');
    expect(service.cancel(1, job).status).toBe('cancelled');
    service.releaseOwner(1);
    expect(() => service.getResult(1, job)).toThrow('not found');
  });
  it('reports timeout independently from user cancellation', async () => {
    service.timeoutMs = 10;
    service.fetch.mockImplementation(
      (_url, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
        })
    );
    const job = await run();
    expect(job.status).toBe('failed');
    expect(job.error).toContain('timed out');
  });
  it('limits retained completed jobs', async () => {
    service.fetch.mockImplementation(() => Promise.resolve(response({ sequence: 'ACTG', elapsed_ms: 1 })));
    for (let i = 0; i < 12; i++) await run();
    expect(service.jobs.size).toBe(10);
  });
  it('rejects unregistered IPC senders before reading configuration or sending DNA', async () => {
    const handlers = {};
    registerEvo2Ipc({
      ipcMain: {
        handle: (name, handler) => {
          handlers[name] = handler;
        },
      },
      app: { getPath: () => storageDir },
      isRegisteredGenomeSender: () => false,
    });
    for (const handler of Object.values(handlers)) {
      expect(await handler({ sender: { id: 1 } }, { sequence: 'ACTG' })).toMatchObject({
        success: false,
        error: expect.stringContaining('genome browser'),
      });
    }
  });
});
