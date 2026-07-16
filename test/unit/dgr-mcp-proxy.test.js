import { describe, expect, it, vi } from 'vitest';

const {
  MAX_RESPONSE_BYTES,
  proxyDgrMcpRequest,
  resolveDgrMcpEndpoint,
  validateProxyRequest,
} = require('../../src/main/dgr-mcp-proxy');

describe('DGR main-process MCP proxy', () => {
  it('allows loopback HTTP and requires HTTPS for remote endpoints', () => {
    expect(resolveDgrMcpEndpoint({ DGR_MCP_URL: 'http://127.0.0.1:3000/api/mcp' })).toContain('127.0.0.1:3000');
    expect(() => resolveDgrMcpEndpoint({ DGR_MCP_URL: 'http://research.example.org/api/mcp' })).toThrow(
      'must use HTTPS'
    );
    expect(resolveDgrMcpEndpoint({ DGR_MCP_URL: 'https://research.example.org/api/mcp' })).toBe(
      'https://research.example.org/api/mcp'
    );
  });

  it('rejects non-MCP methods and clamps the timeout', () => {
    expect(() => validateProxyRequest({ body: { jsonrpc: '2.0', method: 'filesystem/read', id: 1 } })).toThrow(
      'not allowed'
    );
    expect(
      validateProxyRequest({ body: { jsonrpc: '2.0', method: 'tools/list', id: 1 }, timeoutMs: 999999 }).timeoutMs
    ).toBe(120000);
  });

  it('limits proxied tool calls to the durable annotation workflow', () => {
    expect(
      validateProxyRequest({
        body: {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'get-task-status', arguments: { taskId: 'task-1' } },
          id: 1,
        },
      }).timeoutMs
    ).toBe(30000);
    expect(() =>
      validateProxyRequest({
        body: {
          jsonrpc: '2.0',
          method: 'tools/call',
          params: { name: 'write-research-plan', arguments: { query: 'secret-backed arbitrary request' } },
          id: 1,
        },
      })
    ).toThrow('not allowed through the annotation proxy');
  });

  it('adds the bearer token in main and returns a serializable response envelope', async () => {
    const fetchImpl = vi.fn(async (_url, options) => {
      expect(options.headers.Authorization).toBe('Bearer secret-token-1234');
      expect(JSON.parse(options.body).method).toBe('tools/list');
      return new Response(JSON.stringify({ jsonrpc: '2.0', result: { tools: [] }, id: 1 }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    });

    const result = await proxyDgrMcpRequest(
      { body: { jsonrpc: '2.0', method: 'tools/list', id: 1 }, timeoutMs: 5000 },
      {
        env: { DGR_MCP_URL: 'https://research.example.org/api/mcp', DGR_MCP_TOKEN: 'secret-token-1234' },
        fetchImpl,
      }
    );

    expect(result.ok).toBe(true);
    expect(result.headers['content-type']).toBe('application/json');
    expect(JSON.parse(result.body).result.tools).toEqual([]);
  });

  it('rejects weak configured DGR bearer tokens before making a request', async () => {
    await expect(
      proxyDgrMcpRequest(
        { body: { jsonrpc: '2.0', method: 'ping', id: 1 } },
        { env: { DGR_MCP_TOKEN: 'short' }, fetchImpl: vi.fn() }
      )
    ).rejects.toThrow('at least 16 characters');
  });

  it('allows bounded JSON-RPC escaping overhead above the final 16 MiB artifact cap', async () => {
    const escapedEnvelope = `{"result":{"content":[{"type":"text","text":"${'\\\\n'.repeat(9 * 1024 * 1024)}"}]}}`;
    expect(Buffer.byteLength(escapedEnvelope)).toBeGreaterThan(16 * 1024 * 1024);
    expect(Buffer.byteLength(escapedEnvelope)).toBeLessThan(MAX_RESPONSE_BYTES);
    const result = await proxyDgrMcpRequest(
      { body: { jsonrpc: '2.0', method: 'tools/list', id: 1 } },
      {
        env: { DGR_MCP_URL: 'http://127.0.0.1:3000/api/mcp' },
        fetchImpl: vi.fn(
          async () =>
            new Response(escapedEnvelope, {
              status: 200,
              headers: { 'content-type': 'application/json' },
            })
        ),
      }
    );
    expect(result.body).toHaveLength(escapedEnvelope.length);
  });
});
