'use strict';
// @ts-check

/**
 * Main-process-only transport for Deep Gene Research MCP.
 *
 * The renderer must not receive the DGR bearer token. Keeping the endpoint and
 * credential here also avoids depending on browser CORS for a localhost or
 * remote MCP service.
 */

const DEFAULT_DGR_MCP_URL = 'http://127.0.0.1:3000/api/mcp';
const MAX_REQUEST_BYTES = 1024 * 1024;
const MAX_RESPONSE_BYTES = 16 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 30000;
const MAX_TIMEOUT_MS = 120000;
const ALLOWED_JSON_RPC_METHODS = new Set([
  'initialize',
  'notifications/initialized',
  'ping',
  'tools/list',
  'tools/call',
  'prompts/list',
  'prompts/get',
]);
const ALLOWED_DGR_TOOL_NAMES = new Set(['deep-gene-research', 'get-task-status', 'cancel-research-run']);

function isLoopbackHostname(hostname) {
  const normalized = String(hostname || '')
    .trim()
    .toLowerCase()
    .replace(/^\[/, '')
    .replace(/\]$/, '');
  return normalized === 'localhost' || normalized === '::1' || /^127(?:\.\d{1,3}){3}$/.test(normalized);
}

function resolveDgrMcpEndpoint(env = process.env) {
  const rawUrl = env.DGR_MCP_URL || env.DEEP_GENE_RESEARCH_MCP_URL || env.DGR_MCP_ENDPOINT || DEFAULT_DGR_MCP_URL;
  let endpoint;
  try {
    endpoint = new URL(rawUrl);
  } catch {
    throw new Error('DGR_MCP_URL must be a valid absolute URL');
  }

  if (!['http:', 'https:'].includes(endpoint.protocol)) {
    throw new Error('DGR MCP endpoint must use HTTP or HTTPS');
  }
  if (endpoint.username || endpoint.password || endpoint.hash) {
    throw new Error('DGR MCP endpoint cannot contain credentials or a URL fragment');
  }
  if (endpoint.protocol === 'http:' && !isLoopbackHostname(endpoint.hostname)) {
    throw new Error('Remote DGR MCP endpoints must use HTTPS');
  }
  return endpoint.toString();
}

function validateProxyRequest(request) {
  if (!request || typeof request !== 'object' || Array.isArray(request)) {
    throw new Error('DGR MCP proxy request must be an object');
  }
  const body = request.body;
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new Error('DGR MCP proxy body must be a JSON-RPC object');
  }
  if (body.jsonrpc !== '2.0' || typeof body.method !== 'string' || !ALLOWED_JSON_RPC_METHODS.has(body.method)) {
    throw new Error(`DGR MCP JSON-RPC method is not allowed: ${String(body.method || 'missing')}`);
  }
  if (body.method === 'tools/call') {
    const params = body.params;
    if (!params || typeof params !== 'object' || Array.isArray(params)) {
      throw new Error('DGR MCP tools/call params must be an object');
    }
    if (typeof params.name !== 'string' || !ALLOWED_DGR_TOOL_NAMES.has(params.name)) {
      throw new Error(`DGR MCP tool is not allowed through the annotation proxy: ${String(params.name || 'missing')}`);
    }
    if (
      params.arguments !== undefined &&
      (!params.arguments || typeof params.arguments !== 'object' || Array.isArray(params.arguments))
    ) {
      throw new Error('DGR MCP tool arguments must be an object');
    }
  }

  const serializedBody = JSON.stringify(body);
  if (Buffer.byteLength(serializedBody, 'utf8') > MAX_REQUEST_BYTES) {
    throw new Error(`DGR MCP request exceeds the ${MAX_REQUEST_BYTES}-byte limit`);
  }

  const requestedTimeout = Number(request.timeoutMs);
  const timeoutMs = Number.isFinite(requestedTimeout)
    ? Math.max(1000, Math.min(Math.trunc(requestedTimeout), MAX_TIMEOUT_MS))
    : DEFAULT_TIMEOUT_MS;
  return { serializedBody, timeoutMs };
}

async function readBoundedResponse(response) {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_RESPONSE_BYTES) {
    throw new Error(`DGR MCP response exceeds the ${MAX_RESPONSE_BYTES}-byte limit`);
  }

  if (!response.body || typeof response.body.getReader !== 'function') {
    const body = await response.text();
    if (Buffer.byteLength(body, 'utf8') > MAX_RESPONSE_BYTES) {
      throw new Error(`DGR MCP response exceeds the ${MAX_RESPONSE_BYTES}-byte limit`);
    }
    return body;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8');
  const chunks = [];
  let bytesRead = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytesRead += value.byteLength;
      if (bytesRead > MAX_RESPONSE_BYTES) {
        await reader.cancel('response-too-large').catch(() => undefined);
        throw new Error(`DGR MCP response exceeds the ${MAX_RESPONSE_BYTES}-byte limit`);
      }
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
    return chunks.join('');
  } finally {
    reader.releaseLock();
  }
}

async function proxyDgrMcpRequest(request, options = {}) {
  const env = options.env || process.env;
  const fetchImpl = options.fetchImpl || globalThis.fetch;
  if (typeof fetchImpl !== 'function') throw new Error('Main-process fetch is unavailable');

  const endpoint = resolveDgrMcpEndpoint(env);
  const { serializedBody, timeoutMs } = validateProxyRequest(request);
  const token = String(env.DGR_MCP_TOKEN || env.DEEP_GENE_RESEARCH_MCP_TOKEN || '').trim();
  if (token && token.length < 16) {
    throw new Error('DGR_MCP_TOKEN must be at least 16 characters');
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetchImpl(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: serializedBody,
      redirect: 'error',
      signal: controller.signal,
    });
    const body = await readBoundedResponse(response);
    return {
      ok: response.ok,
      status: response.status,
      statusText: response.statusText,
      headers: { 'content-type': response.headers.get('content-type') || '' },
      body,
    };
  } catch (error) {
    if (error?.name === 'AbortError') {
      throw new Error(`DGR MCP request timed out after ${timeoutMs} ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

module.exports = {
  ALLOWED_DGR_TOOL_NAMES,
  ALLOWED_JSON_RPC_METHODS,
  DEFAULT_DGR_MCP_URL,
  MAX_REQUEST_BYTES,
  MAX_RESPONSE_BYTES,
  isLoopbackHostname,
  proxyDgrMcpRequest,
  resolveDgrMcpEndpoint,
  validateProxyRequest,
};
