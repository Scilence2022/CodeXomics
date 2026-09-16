'use strict';

const fs = require('fs').promises;
const path = require('path');
const { randomUUID } = require('crypto');
const { setTimeout: delay } = require('timers/promises');
const secrets = require('./secret-store');

const ENDPOINT = 'https://health.api.nvidia.com/v1/biology/arc/evo2-40b/generate';
// Application limits keep hosted requests and retained logits bounded.
const MAX_SEQUENCE = 100000;
const MAX_TOKENS = 1200;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;

function buildRequest(input = {}) {
  if (typeof input.sequence !== 'string') throw new Error('A DNA sequence is required.');
  const raw = input.sequence.trim();
  if ((raw.match(/^>/gm) || []).length > 1) throw new Error('Provide only one FASTA record.');
  const sequence = raw
    .replace(/^>[^\r\n]*(?:\r?\n|$)/, '')
    .replace(/\s/g, '')
    .toUpperCase();
  if (!/^[ACGTN]+$/.test(sequence)) throw new Error('DNA must contain only A, C, G, T or N (or one FASTA record).');
  if (sequence.length > MAX_SEQUENCE) {
    throw new Error(`CodeXomics supports up to ${MAX_SEQUENCE} input bases per request.`);
  }
  const body = { sequence };
  // Taxonomy remains separate from DNA normalization so names/case are preserved.
  if (input.taxonomy !== undefined && input.taxonomy !== '') {
    if (
      typeof input.taxonomy !== 'string' ||
      input.taxonomy.length > 1000 ||
      !/^\|k__[^|;\r\n]+;p__[^|;\r\n]+;c__[^|;\r\n]+;o__[^|;\r\n]+;g__[^|;\r\n]+;s__[^|;\r\n]+\|$/.test(input.taxonomy)
    ) {
      throw new Error('Taxonomy must use |k__...;p__...;c__...;o__...;g__...;s__...|.');
    }
    body.sequence = input.taxonomy + sequence;
  }
  const numbers = {
    num_tokens: [100, 1, MAX_TOKENS, true],
    temperature: [0.7, Number.MIN_VALUE, 1.3, false],
    top_k: [3, 0, 6, true],
    top_p: [1, 0, 1, false],
    random_seed: [undefined, Number.MIN_SAFE_INTEGER, Number.MAX_SAFE_INTEGER, true],
  };
  for (const [key, [fallback, min, max, integer]] of Object.entries(numbers)) {
    const value = input[key] ?? fallback;
    if (value === undefined) continue;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < min ||
      value > max ||
      (integer && !Number.isSafeInteger(value))
    ) {
      throw new Error(`Invalid ${key}: expected ${integer ? 'an integer' : 'a number'} between ${min} and ${max}.`);
    }
    body[key] = value;
  }
  for (const key of ['enable_logits', 'enable_sampled_probs', 'enable_elapsed_ms_per_token']) {
    if (input[key] !== undefined && typeof input[key] !== 'boolean') throw new Error(`${key} must be boolean.`);
    body[key] = input[key] ?? false;
  }
  return body;
}

class Evo2Service {
  constructor({ storageDir, fetchImpl = globalThis.fetch, secretStore = secrets, timeoutMs = 600000, pollMs = 1000 }) {
    this.configPath = path.join(storageDir, 'evo2.json');
    this.fetch = fetchImpl;
    this.secrets = secretStore;
    this.timeoutMs = timeoutMs;
    this.pollMs = pollMs;
    this.jobs = new Map();
  }

  async readKey() {
    try {
      const config = JSON.parse(await fs.readFile(this.configPath, 'utf8'));
      return this.secrets.decryptSecret(config.apiKey || '');
    } catch (error) {
      if (error.code === 'ENOENT') return '';
      throw new Error('Unable to read Evo 2 credentials. Save the API key again.');
    }
  }

  async getSettings() {
    return {
      success: true,
      configured: Boolean(await this.readKey()),
      model: 'arc/evo2-40b',
      endpoint: ENDPOINT,
      maxInputBases: MAX_SEQUENCE,
      maxTokens: MAX_TOKENS,
    };
  }

  async saveSettings({ apiKey, removeKey = false } = {}) {
    if (removeKey) {
      await fs.unlink(this.configPath).catch(error => {
        if (error.code !== 'ENOENT') throw error;
      });
    } else {
      if (typeof apiKey !== 'string' || !/^nvapi-[A-Za-z0-9_-]+$/.test(apiKey.trim())) {
        throw new Error('Enter a valid NVIDIA API key starting with nvapi-.');
      }
      if (!this.secrets.isEncryptionAvailable()) {
        throw new Error('OS credential encryption is unavailable; the key was not saved.');
      }
      const encrypted = this.secrets.encryptSecret(apiKey.trim());
      if (!this.secrets.isEncryptedValue(encrypted)) {
        throw new Error('Unable to encrypt the API key; the key was not saved.');
      }
      await fs.mkdir(path.dirname(this.configPath), { recursive: true });
      const tempPath = `${this.configPath}.${randomUUID()}.tmp`;
      try {
        await fs.writeFile(tempPath, JSON.stringify({ apiKey: encrypted }), { mode: 0o600 });
        await fs.rename(tempPath, this.configPath);
      } finally {
        await fs.unlink(tempPath).catch(() => {});
      }
    }
    return this.getSettings();
  }

  async generate(ownerId, input) {
    const body = buildRequest(input);
    const key = await this.readKey();
    if (!key) throw new Error('Configure the NVIDIA API key in Options → Evo 2 DNA Generation.');
    for (const [id, job] of this.jobs) {
      if (job.status !== 'running' && Date.now() - job.startedAt > 3600000) this.jobs.delete(id);
    }
    if ([...this.jobs.values()].some(job => job.ownerId === ownerId && job.status === 'running')) {
      throw new Error('An Evo 2 request is already running in this window. Wait for it or cancel it first.');
    }
    if (this.jobs.size >= 10) {
      const oldest = [...this.jobs.values()].find(job => job.status !== 'running');
      if (!oldest) throw new Error('Too many Evo 2 requests are running.');
      this.jobs.delete(oldest.id);
    }
    const job = {
      id: randomUUID(),
      ownerId,
      status: 'running',
      startedAt: Date.now(),
      controller: new AbortController(),
      inputBases: body.sequence.replace(/^\|[^|]*\|/, '').length,
      numTokens: body.num_tokens,
    };
    this.jobs.set(job.id, job);
    // The IPC returns immediately; both MCP and GUI poll the same job.
    job.completion = this.run(job, body, key);
    return this.snapshot(job);
  }

  getJob(ownerId, jobId) {
    const job = this.jobs.get(jobId);
    if (!job || job.ownerId !== ownerId) {
      throw new Error('Evo 2 job not found in this window (jobs expire after one hour or app restart).');
    }
    return job;
  }

  snapshot(job, includeLogits = false) {
    const result = job.result ? { ...job.result } : undefined;
    if (result?.logits && !includeLogits) {
      result.logits_shape = [result.logits.length, result.logits[0]?.length || 0];
      delete result.logits;
    }
    return {
      success: !['failed', 'cancelled'].includes(job.status),
      job_id: job.id,
      status: job.status,
      model: 'arc/evo2-40b',
      input_bases: job.inputBases,
      num_tokens: job.numTokens,
      elapsed_ms: (job.finishedAt || Date.now()) - job.startedAt,
      result,
      error: job.error,
      ...(job.status === 'running' ? { next_poll_ms: 2000, next_tool: 'evo2_get_result' } : {}),
    };
  }

  getResult(ownerId, { job_id: jobId, include_logits: includeLogits = false } = {}) {
    return this.snapshot(this.getJob(ownerId, jobId), includeLogits === true);
  }

  cancel(ownerId, { job_id: jobId } = {}) {
    const job = this.getJob(ownerId, jobId);
    if (job.status === 'running') {
      job.status = 'cancelled';
      job.finishedAt = Date.now();
      job.error = 'Stopped waiting locally. NVIDIA may continue processing the submitted request.';
      job.controller.abort();
    }
    return this.snapshot(job);
  }

  releaseOwner(ownerId) {
    for (const [id, job] of this.jobs) {
      if (job.ownerId === ownerId) {
        job.controller.abort();
        this.jobs.delete(id);
      }
    }
  }

  async readResponse(response) {
    let size = 0;
    const chunks = [];
    for await (const chunk of response.body) {
      size += chunk.length;
      if (size > MAX_RESPONSE_BYTES) {
        throw new Error('Evo 2 response exceeds 16 MB. Reduce generated tokens or disable logits.');
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks).toString('utf8');
  }

  async run(job, body, key) {
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      job.controller.abort();
    }, this.timeoutMs);
    try {
      const headers = {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'NVCF-POLL-SECONDS': '20',
      };
      const options = { headers, signal: job.controller.signal, redirect: 'error' };
      let response = await this.fetch(ENDPOINT, { ...options, method: 'POST', body: JSON.stringify(body) });
      while (response.status === 202) {
        const pending = await this.readResponse(response);
        let requestId = response.headers.get('nvcf-reqid');
        if (!requestId) {
          try {
            requestId = JSON.parse(pending).reqId;
          } catch (_) {
            /* checked below */
          }
        }
        if (typeof requestId !== 'string' || !/^[a-zA-Z0-9-]{1,128}$/.test(requestId)) {
          throw new Error('NVIDIA accepted the request without a valid request ID.');
        }
        await delay(this.pollMs, undefined, { signal: job.controller.signal });
        response = await this.fetch(`https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/${requestId}`, options);
      }
      const text = await this.readResponse(response);
      if (!response.ok) {
        const advice = {
          401: 'Check the NVIDIA API key.',
          403: 'Check model access for this key.',
          429: 'Rate limited; wait before submitting another request.',
          422: 'Check the sequence and generation parameters.',
        };
        // Do not reflect untrusted server bodies, which can echo prompts or credentials.
        throw new Error(
          `NVIDIA HTTP ${response.status}. ${advice[response.status] || 'The generation request failed; try again later.'}`
        );
      }
      if (!(response.headers.get('content-type') || '').includes('application/json')) {
        throw new Error('NVIDIA returned a non-JSON result. Reduce generated tokens or disable logits.');
      }
      let result;
      try {
        result = JSON.parse(text);
      } catch (_) {
        throw new Error('NVIDIA returned invalid JSON.');
      }
      if (
        typeof result?.sequence !== 'string' ||
        !/^[ACGTN]+$/i.test(result.sequence) ||
        !Number.isFinite(result.elapsed_ms)
      ) {
        throw new Error('NVIDIA returned an invalid generation result.');
      }
      if (job.controller.signal.aborted) throw new Error('Request stopped.');
      job.result = { sequence: result.sequence, elapsed_ms: result.elapsed_ms };
      for (const field of ['logits', 'sampled_probs', 'elapsed_ms_per_token']) {
        if (Array.isArray(result[field])) job.result[field] = result[field];
      }
      job.status = 'completed';
    } catch (error) {
      if (job.status !== 'cancelled') {
        job.status = 'failed';
        job.error = timedOut
          ? 'Evo 2 timed out after 10 minutes. NVIDIA may still be processing the request.'
          : String(error.message || 'Evo 2 request failed.')
              .split(key)
              .join('[redacted]')
              .replace(/nvapi-[A-Za-z0-9_-]+/g, '[redacted]');
      }
    } finally {
      job.finishedAt = job.finishedAt || Date.now();
      clearTimeout(timeout);
    }
  }
}

function registerEvo2Ipc({ ipcMain, app, isRegisteredGenomeSender }) {
  const service = new Evo2Service({ storageDir: path.join(app.getPath('userData'), 'config') });
  const owners = new Set();
  const handlers = {
    'evo2:settings': () => service.getSettings(),
    'evo2:save-settings': (_owner, params) => service.saveSettings(params),
    'evo2:generate': (owner, params) => service.generate(owner, params),
    'evo2:result': (owner, params) => service.getResult(owner, params),
    'evo2:cancel': (owner, params) => service.cancel(owner, params),
  };
  for (const [channel, handler] of Object.entries(handlers)) {
    ipcMain.handle(channel, async (event, params) => {
      try {
        if (!isRegisteredGenomeSender(event)) throw new Error('Evo 2 is only available in genome browser windows.');
        const owner = event.sender.id;
        if (!owners.has(owner)) {
          owners.add(owner);
          event.sender.once('destroyed', () => {
            service.releaseOwner(owner);
            owners.delete(owner);
          });
        }
        return await handler(owner, params);
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  }
  return service;
}

module.exports = { Evo2Service, buildRequest, registerEvo2Ipc, ENDPOINT, MAX_SEQUENCE, MAX_TOKENS };
