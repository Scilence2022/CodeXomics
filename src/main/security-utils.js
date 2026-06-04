'use strict';

const path = require('path');
const fs = require('fs');

const approvedFilePaths = new Set();

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
  if (typeof filePath === 'string' && filePath.trim()) {
    approvedFilePaths.add(path.resolve(filePath));
  }
}

function rememberApprovedDialogPaths(result) {
  if (!result || result.canceled) return result;
  rememberApprovedPath(result.filePath);
  if (Array.isArray(result.filePaths)) {
    result.filePaths.forEach(rememberApprovedPath);
  }
  return result;
}

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
  } = options;

  if (!targetPath || typeof targetPath !== 'string') {
    throw new Error(`File ${operation} requires a valid path`);
  }

  const resolvedPath = path.resolve(targetPath);

  if (mustExist && !fs.existsSync(resolvedPath)) {
    throw new Error(`File does not exist: ${resolvedPath}`);
  }

  if (allowApproved) {
    const approved = [...approvedFilePaths].some(approvedPath => isSubPath(approvedPath, resolvedPath));
    if (approved) {
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
  RENDERER_CONTENT_SECURITY_POLICY,
  registerRendererContentSecurityPolicy,
  createSecureWebPreferences,
  rememberApprovedPath,
  rememberApprovedDialogPaths,
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
