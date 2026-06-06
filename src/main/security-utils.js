'use strict';

const path = require('path');
const fs = require('fs');

class ApprovedPathSet extends Set {
  constructor() {
    super();
    this.onClear = null;
  }

  clear() {
    super.clear();
    if (typeof this.onClear === 'function') {
      this.onClear();
    }
  }
}

const approvedFilePaths = new ApprovedPathSet();

const FILE_CAPABILITIES = Object.freeze({
  READ: 'read',
  WRITE: 'write',
  LIST: 'list',
  DELETE: 'delete',
  EXECUTE: 'execute',
});

const ALL_FILE_CAPABILITIES = Object.freeze(Object.values(FILE_CAPABILITIES));

const RENDERER_CONTENT_SECURITY_POLICY = [
  "default-src 'self' data: blob: file:",
  "script-src 'self' 'unsafe-inline' https://d3js.org https://cdn.jsdelivr.net data: blob:",
  "style-src 'self' 'unsafe-inline' https: http: data:",
  "img-src 'self' data: blob: https: http: file:",
  "font-src 'self' https: http: data:",
  "connect-src 'self' https: http: ws: wss: data: blob:",
  "object-src 'none'",
  "base-uri 'self'",
].join('; ');

function registerRendererContentSecurityPolicy(electronSession) {
  const targetSession = electronSession?.defaultSession || electronSession;
  if (!targetSession?.webRequest) {
    return;
  }

  targetSession.webRequest.onHeadersReceived((details, callback) => {
    const responseHeaders = { ...(details.responseHeaders || {}) };

    for (const headerName of Object.keys(responseHeaders)) {
      if (headerName.toLowerCase() === 'content-security-policy') {
        delete responseHeaders[headerName];
      }
    }

    responseHeaders['Content-Security-Policy'] = [RENDERER_CONTENT_SECURITY_POLICY];
    callback({ responseHeaders });
  });
}

function createSecureWebPreferences(overrides = {}) {
  const preferences = {
    nodeIntegration: false,
    contextIsolation: true,
    enableRemoteModule: false,
    webSecurity: true,
    allowRunningInsecureContent: false,
    sandbox: true,
    preload: path.join(__dirname, '..', 'preload.js'),
    ...overrides,
  };

  preferences.nodeIntegration = false;
  preferences.contextIsolation = true;
  preferences.enableRemoteModule = false;
  preferences.webSecurity = true;
  preferences.allowRunningInsecureContent = false;
  preferences.sandbox = true;

  return preferences;
}

function rememberApprovedPath(filePath) {
  return permissionBroker.grantPath(filePath, {
    source: 'legacy',
    reason: 'Legacy approved path',
    capabilities: ALL_FILE_CAPABILITIES,
  });
}

function rememberApprovedDialogPaths(result, options = {}) {
  if (!result || result.canceled) return result;
  permissionBroker.grantDialogPaths(result, options);
  return result;
}

function normalizeCapabilities(capabilities, fallback = [FILE_CAPABILITIES.READ]) {
  const rawCapabilities = Array.isArray(capabilities) ? capabilities : [capabilities];
  const normalized = rawCapabilities
    .filter(Boolean)
    .map(capability => String(capability).trim().toLowerCase())
    .filter(capability => capability === '*' || ALL_FILE_CAPABILITIES.includes(capability));

  return normalized.length > 0 ? [...new Set(normalized)] : [...fallback];
}

function inferCapabilityFromOperation(operation = 'access') {
  const lower = String(operation || '').toLowerCase();
  if (/\b(delete|remove|unlink|trash)\b/.test(lower)) return FILE_CAPABILITIES.DELETE;
  if (/\b(execute|run|command|binary)\b/.test(lower)) return FILE_CAPABILITIES.EXECUTE;
  if (/\b(write|save|export|download|create|copy|move|install|extract)\b/.test(lower)) {
    return FILE_CAPABILITIES.WRITE;
  }
  if (/\b(list|scan|directory)\b/.test(lower)) return FILE_CAPABILITIES.LIST;
  return FILE_CAPABILITIES.READ;
}

class PermissionBroker {
  constructor() {
    this.grants = new Map();
    this.nextGrantId = 1;
  }

  clear(options = {}) {
    this.grants.clear();
    this.nextGrantId = 1;
    if (!options.skipLegacySet) {
      approvedFilePaths.clear();
    }
  }

  grantPath(targetPath, options = {}) {
    if (typeof targetPath !== 'string' || !targetPath.trim()) {
      return null;
    }

    const resolvedPath = path.resolve(targetPath);
    const stats = this.getStatsIfAvailable(resolvedPath);
    const isDirectory = !!stats?.isDirectory?.();
    const recursive = options.recursive !== undefined ? !!options.recursive : isDirectory;
    const defaultCapabilities = isDirectory
      ? ALL_FILE_CAPABILITIES
      : [FILE_CAPABILITIES.READ, FILE_CAPABILITIES.WRITE];

    const grant = {
      id: `grant-${Date.now()}-${this.nextGrantId++}`,
      path: resolvedPath,
      source: options.source || 'unknown',
      reason: options.reason || '',
      capabilities: normalizeCapabilities(options.capabilities, defaultCapabilities),
      recursive,
      createdAt: Date.now(),
      expiresAt: Number.isFinite(options.expiresAt) ? Number(options.expiresAt) : null,
      windowId: options.windowId || null,
      operation: options.operation || null,
    };

    this.grants.set(grant.id, grant);
    approvedFilePaths.add(resolvedPath);
    return grant;
  }

  grantDialogPaths(result, options = {}) {
    if (!result || result.canceled) {
      return [];
    }

    const grants = [];

    if (result.filePath) {
      grants.push(
        this.grantPath(result.filePath, {
          source: options.source || 'user-save-dialog',
          reason: options.reason || 'User selected save path',
          capabilities: options.capabilities || [FILE_CAPABILITIES.READ, FILE_CAPABILITIES.WRITE],
          recursive: options.recursive === true,
          windowId: options.windowId,
          operation: options.operation || 'save dialog',
        })
      );
    }

    if (Array.isArray(result.filePaths)) {
      for (const selectedPath of result.filePaths) {
        const stats = this.getStatsIfAvailable(selectedPath);
        const isDirectory = !!stats?.isDirectory?.();
        grants.push(
          this.grantPath(selectedPath, {
            source: options.source || 'user-open-dialog',
            reason: options.reason || 'User selected open path',
            capabilities:
              options.capabilities ||
              (isDirectory ? ALL_FILE_CAPABILITIES : [FILE_CAPABILITIES.READ, FILE_CAPABILITIES.WRITE]),
            recursive: options.recursive !== undefined ? options.recursive : isDirectory,
            windowId: options.windowId,
            operation: options.operation || 'open dialog',
          })
        );
      }
    }

    return grants.filter(Boolean);
  }

  findGrant(targetPath, options = {}) {
    if (typeof targetPath !== 'string' || !targetPath.trim()) {
      return null;
    }

    const resolvedPath = path.resolve(targetPath);
    const capability = options.capability || FILE_CAPABILITIES.READ;
    const now = Date.now();

    for (const [grantId, grant] of this.grants.entries()) {
      if (grant.expiresAt && grant.expiresAt <= now) {
        this.grants.delete(grantId);
        continue;
      }

      const hasCapability = grant.capabilities.includes('*') || grant.capabilities.includes(capability);
      if (!hasCapability) {
        continue;
      }

      const pathMatches = grant.recursive ? isSubPath(grant.path, resolvedPath) : path.resolve(grant.path) === resolvedPath;
      if (pathMatches) {
        return grant;
      }
    }

    return null;
  }

  hasGrant(targetPath, options = {}) {
    return !!this.findGrant(targetPath, options);
  }

  listGrants() {
    return [...this.grants.values()].map(grant => ({ ...grant, capabilities: [...grant.capabilities] }));
  }

  getStatsIfAvailable(targetPath) {
    try {
      if (targetPath && fs.existsSync(targetPath)) {
        return fs.statSync(targetPath);
      }
    } catch (error) {
      // Ignore paths that cannot be inspected; the later access check will handle them.
    }
    return null;
  }
}

const permissionBroker = new PermissionBroker();
approvedFilePaths.onClear = () => permissionBroker.clear({ skipLegacySet: true });

function isSubPath(parentPath, targetPath) {
  const parent = path.resolve(parentPath);
  const target = path.resolve(targetPath);
  const relative = path.relative(parent, target);
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function assertInsideRoot(rootPath, targetPath, label = 'path') {
  if (!rootPath || !targetPath) {
    throw new Error(`Invalid ${label}`);
  }

  const root = path.resolve(rootPath);
  const target = path.resolve(targetPath);
  if (!isSubPath(root, target)) {
    throw new Error(`${label} escapes allowed root`);
  }
  return target;
}

function getDefaultWritableRoots(app) {
  const roots = new Set();
  const addPath = name => {
    try {
      const value = app.getPath(name);
      if (value) roots.add(path.resolve(value));
    } catch (error) {
      // Ignore unavailable Electron paths for the current platform.
    }
  };

  ['userData', 'temp', 'downloads', 'documents'].forEach(addPath);
  return [...roots];
}

function assertAllowedFileAccess(app, targetPath, options = {}) {
  const {
    operation = 'access',
    allowedRoots = getDefaultWritableRoots(app),
    allowApproved = true,
    mustExist = false,
    capability = inferCapabilityFromOperation(operation),
  } = options;

  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error(`File ${operation} requires a valid path`);
  }

  const resolvedPath = path.resolve(targetPath);

  if (mustExist && !fs.existsSync(resolvedPath)) {
    throw new Error(`File does not exist: ${resolvedPath}`);
  }

  if (allowApproved) {
    const grant = permissionBroker.findGrant(resolvedPath, { capability });
    if (grant) {
      return resolvedPath;
    }

  }

  const allowed = allowedRoots.some(root => isSubPath(root, resolvedPath));
  if (!allowed) {
    throw new Error(`Blocked ${operation} outside approved application directories: ${resolvedPath}`);
  }

  return resolvedPath;
}

function sanitizePluginId(pluginId) {
  if (typeof pluginId !== 'string' || !/^[A-Za-z0-9._-]+$/.test(pluginId)) {
    throw new Error('Invalid plugin id');
  }
  return pluginId;
}

function getUserPluginRoots(app) {
  const roots = new Set();
  roots.add(path.resolve(path.join(app.getPath('userData'), 'plugins')));
  roots.add(path.resolve(path.join(__dirname, '..', 'renderer', 'modules', 'Plugins', 'UserInstalled')));
  return [...roots];
}

function assertPluginPath(app, targetPath, label = 'plugin path') {
  const roots = getUserPluginRoots(app);
  const resolvedPath = path.resolve(targetPath);
  const allowed = roots.some(root => isSubPath(root, resolvedPath));
  if (!allowed) {
    throw new Error(`${label} escapes user plugin directory`);
  }
  return resolvedPath;
}

function assertSafeArchiveEntry(entryName) {
  if (!entryName || typeof entryName !== 'string') {
    throw new Error('Archive entry is missing a name');
  }

  const normalized = entryName.replace(/\\/g, '/');
  if (
    normalized.startsWith('/') ||
    normalized.includes('/../') ||
    normalized === '..' ||
    normalized.startsWith('../') ||
    path.isAbsolute(entryName)
  ) {
    throw new Error(`Unsafe archive entry path: ${entryName}`);
  }

  return normalized;
}

function safePluginJoin(app, rootPath, relativePath, label = 'plugin file') {
  assertSafeArchiveEntry(relativePath);
  const root = assertPluginPath(app, rootPath, 'plugin root');
  return assertInsideRoot(root, path.join(root, relativePath), label);
}

function safeExtractAdmZip(app, zip, installPath) {
  const root = assertPluginPath(app, installPath, 'plugin install path');
  const entries = zip.getEntries();

  for (const entry of entries) {
    const entryName = assertSafeArchiveEntry(entry.entryName);
    const targetPath = assertInsideRoot(root, path.join(root, entryName), 'archive entry');

    if (entry.isDirectory) {
      fs.mkdirSync(targetPath, { recursive: true });
      continue;
    }

    fs.mkdirSync(path.dirname(targetPath), { recursive: true });
    fs.writeFileSync(targetPath, entry.getData());
  }
}

module.exports = {
  approvedFilePaths,
  permissionBroker,
  FILE_CAPABILITIES,
  ALL_FILE_CAPABILITIES,
  RENDERER_CONTENT_SECURITY_POLICY,
  registerRendererContentSecurityPolicy,
  createSecureWebPreferences,
  rememberApprovedPath,
  rememberApprovedDialogPaths,
  inferCapabilityFromOperation,
  isSubPath,
  assertInsideRoot,
  getDefaultWritableRoots,
  assertAllowedFileAccess,
  sanitizePluginId,
  getUserPluginRoots,
  assertPluginPath,
  assertSafeArchiveEntry,
  safePluginJoin,
  safeExtractAdmZip,
};
