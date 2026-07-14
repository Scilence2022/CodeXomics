'use strict';
// @ts-check

const SCOPED_MCP_PERMISSIONS = new Set([
  'annotation:read',
  'annotation:propose',
  'annotation:research',
  'annotation:approve',
  'annotation:commit',
  'annotation:structural',
]);

function parseConfiguredApiKeys(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return [];

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new Error('CODEXOMICS_MCP_API_KEYS_JSON must contain valid JSON');
  }

  const entries = Array.isArray(parsed)
    ? parsed.map(value => [value?.keyId || value?.id, value])
    : parsed && typeof parsed === 'object'
      ? Object.entries(parsed)
      : null;
  if (!entries) throw new Error('CODEXOMICS_MCP_API_KEYS_JSON must be an object or array');

  const seen = new Set();
  const seenSecrets = new Set();
  return entries.map(([configuredId, value]) => {
    const keyId = String(configuredId || '').trim();
    const apiKey = String(value?.apiKey || value?.key || value?.token || '').trim();
    const permissions = Array.isArray(value?.permissions)
      ? Array.from(new Set(value.permissions.map(permission => String(permission).trim()).filter(Boolean)))
      : [];
    if (!/^[A-Za-z0-9._-]{1,64}$/.test(keyId)) {
      throw new Error('Every configured MCP API key requires a safe keyId (1-64 characters)');
    }
    if (seen.has(keyId)) throw new Error(`Duplicate MCP API keyId: ${keyId}`);
    if (seenSecrets.has(apiKey)) throw new Error(`MCP API key "${keyId}" duplicates another configured secret`);
    if (apiKey.length < 16) throw new Error(`MCP API key "${keyId}" must be at least 16 characters`);
    if (permissions.length === 0 && value?.isAdmin !== true) {
      throw new Error(`MCP API key "${keyId}" requires at least one permission`);
    }
    if (value?.isAdmin !== true) {
      const unknownPermission = permissions.find(permission => !SCOPED_MCP_PERMISSIONS.has(permission));
      if (unknownPermission) {
        throw new Error(`MCP API key "${keyId}" uses unsupported scoped permission "${unknownPermission}"`);
      }
    }
    seen.add(keyId);
    seenSecrets.add(apiKey);
    return {
      keyId,
      apiKey,
      name: String(value?.name || keyId),
      permissions,
      isAdmin: value?.isAdmin === true,
    };
  });
}

/** Keep every UI/menu lifecycle path on the same fail-closed MCP policy. */
function getMcpAuthConfig(env = process.env) {
  const masterKey = String(env.CODEXOMICS_MCP_MASTER_KEY || env.MCP_MASTER_KEY || '').trim();
  if (masterKey && masterKey.length < 16) {
    throw new Error('CODEXOMICS_MCP_MASTER_KEY must be at least 16 characters');
  }
  const apiKeys = parseConfiguredApiKeys(env.CODEXOMICS_MCP_API_KEYS_JSON);
  if (masterKey && apiKeys.some(entry => entry.apiKey === masterKey)) {
    throw new Error('CODEXOMICS_MCP_MASTER_KEY must not duplicate a scoped API key secret');
  }
  return {
    requireAuth: true,
    enableLocalBypass: env.CODEXOMICS_MCP_ENABLE_LOCAL_BYPASS === 'true',
    masterKey: masterKey || null,
    apiKeys,
  };
}

module.exports = { getMcpAuthConfig, parseConfiguredApiKeys, SCOPED_MCP_PERMISSIONS };
