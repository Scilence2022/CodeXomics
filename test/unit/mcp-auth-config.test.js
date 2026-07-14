import { describe, expect, it } from 'vitest';

const { getMcpAuthConfig, parseConfiguredApiKeys } = require('../../src/main/mcp-auth-config');

describe('MCP lifecycle authentication config', () => {
  it('fails closed and only enables local bypass explicitly', () => {
    expect(getMcpAuthConfig({})).toEqual({
      requireAuth: true,
      enableLocalBypass: false,
      masterKey: null,
      apiKeys: [],
    });
    expect(
      getMcpAuthConfig({
        CODEXOMICS_MCP_ENABLE_LOCAL_BYPASS: 'true',
        CODEXOMICS_MCP_MASTER_KEY: 'development-key-1234',
      })
    ).toEqual({ requireAuth: true, enableLocalBypass: true, masterKey: 'development-key-1234', apiKeys: [] });
    expect(() => getMcpAuthConfig({ CODEXOMICS_MCP_MASTER_KEY: 'short' })).toThrow('at least 16 characters');
  });

  it('loads distinct scoped proposer and curator credentials without exposing them to the renderer', () => {
    const apiKeys = parseConfiguredApiKeys(
      JSON.stringify({
        agent: { key: 'agent-secret-key-1234', permissions: ['annotation:read', 'annotation:propose'] },
        curator: {
          token: 'curator-secret-key-1234',
          permissions: ['annotation:read', 'annotation:approve', 'annotation:commit'],
        },
      })
    );

    expect(apiKeys.map(key => key.keyId)).toEqual(['agent', 'curator']);
    expect(apiKeys[0].permissions).toContain('annotation:propose');
    expect(
      parseConfiguredApiKeys(
        JSON.stringify([{ id: 'reader', apiKey: 'reader-secret-key-1234', permissions: ['annotation:read'] }])
      )[0].keyId
    ).toBe('reader');
    expect(() => parseConfiguredApiKeys('{bad-json')).toThrow('valid JSON');
    expect(() =>
      parseConfiguredApiKeys(JSON.stringify({ unsafe: { key: 'unsafe-secret-key-1234', permissions: ['file:write'] } }))
    ).toThrow('unsupported scoped permission');
    expect(() =>
      parseConfiguredApiKeys(
        JSON.stringify({
          first: { key: 'duplicated-secret-1234', permissions: ['annotation:read'] },
          second: { key: 'duplicated-secret-1234', permissions: ['annotation:propose'] },
        })
      )
    ).toThrow('duplicates another configured secret');
  });

  it('rejects a scoped secret that would also authenticate as the master credential', () => {
    expect(() =>
      getMcpAuthConfig({
        CODEXOMICS_MCP_MASTER_KEY: 'shared-secret-key-1234',
        CODEXOMICS_MCP_API_KEYS_JSON: JSON.stringify({
          reader: { key: 'shared-secret-key-1234', permissions: ['annotation:read'] },
        }),
      })
    ).toThrow('must not duplicate a scoped API key secret');
  });
});
