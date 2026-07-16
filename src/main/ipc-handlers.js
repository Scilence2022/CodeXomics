// @ts-check
/**
 * IPC Handlers Module for CodeXomics
 *
 * Contains all non-Project-Manager IPC handlers extracted from main.js.
 * This module exports a registerIpcHandlers(deps) function that registers
 * all handlers with the ipcMain object.
 *
 * @module ipc-handlers
 */

const { ipcMain, app, dialog, BrowserWindow, nativeImage, clipboard, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const VERSION_INFO = require('../version');
const { encryptSecretsInPlace, decryptSecretsInPlace } = require('./secret-store');
const workspaceHostManager = require('./workspace-host-manager');
const {
  createSecureWebPreferences,
  permissionBroker,
  ALL_FILE_CAPABILITIES,
  FILE_CAPABILITIES,

  rememberApprovedDialogPaths,
  getDefaultWritableRoots,
  getUserPluginRoots,
  assertAllowedFileAccess,
  grantReadOnlyFileLoadPath,
  assertPluginPath,
  safePluginJoin,
  safeExtractAdmZip,
  sanitizePluginId,
} = require('./security-utils');
const { ToolRegistryService } = require('./tool-registry-service');
const { proxyDgrMcpRequest } = require('./dgr-mcp-proxy');
const { archiveDgrTaskResult, readDgrArtifact } = require('./dgr-artifact-storage');
const {
  assertSidecarContentSize,
  assertSidecarValueSize,
  buildFallbackPaths,
  validateFallbackBinding,
  createMigratedSidecarData,
} = require('./sidecar-storage');

let BamReaderClass = null;
const BLAST_EXECUTABLES = new Set(['blastdbcmd', 'makeblastdb', 'blastn', 'blastp', 'blastx', 'tblastn', 'tblastx']);
const FILE_LOAD_TOOLS = new Set([
  'load_genome_file',
  'load_annotation_file',
  'load_variant_file',
  'load_reads_file',
  'load_wig_tracks',
  'load_operon_file',
]);
const LOCALE_NAMESPACES = new Set(['common', 'menu', 'dialogs', 'notifications', 'tracks']);
const LOCALE_CODE_PATTERN = /^[A-Za-z]{2}(?:-[A-Za-z0-9]+)?$/;
const CONFIG_FILES = Object.freeze({
  main: 'config.json',
  llm: 'llm-config.json',
  ui: 'ui-preferences.json',
  chat: 'chat-history.json',
  app: 'app-settings.json',
  generalSettings: 'general-settings.json',
  chatboxSettings: 'chatbox-settings.json',
  evolution: 'conversation-evolution-data.json',
  blast: 'blast-databases.json',
  marketplace: 'marketplace-settings.json',
});

function getBamReaderClass() {
  if (!BamReaderClass) {
    BamReaderClass = require('../renderer/modules/BamReader');
  }
  return BamReaderClass;
}

function parseCommandLine(command) {
  const args = [];
  let current = '';
  let quote = null;
  let escaped = false;

  for (const char of String(command || '')) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === '\\') {
      escaped = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = null;
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        args.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (escaped) current += '\\';
  if (current) args.push(current);
  return args;
}

function getBlastExecutableName(executablePath) {
  return path.basename(String(executablePath || ''), path.extname(String(executablePath || ''))).toLowerCase();
}

function findExecutableOnPath(executableName) {
  if (!executableName || /[\\/]/.test(executableName)) return null;

  const searchPaths = String(process.env.PATH || '')
    .split(path.delimiter)
    .filter(Boolean);
  const extensions =
    process.platform === 'win32'
      ? String(process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM')
          .split(';')
          .filter(Boolean)
      : [''];

  for (const searchPath of searchPaths) {
    for (const extension of extensions) {
      const candidateName = executableName.endsWith(extension.toLowerCase())
        ? executableName
        : executableName + extension;
      const candidate = path.join(searchPath, candidateName);
      try {
        fs.accessSync(candidate, fs.constants.X_OK);
        return path.resolve(candidate);
      } catch (_) {
        // Keep searching PATH entries.
      }
    }
  }

  return null;
}

function isTrustedBlastExecutablePath(executablePath) {
  if (!executablePath || typeof executablePath !== 'string') return false;
  const resolvedPath = path.resolve(executablePath);
  const trustedDirs = ['/usr/bin', '/usr/local/bin', '/opt/homebrew/bin', '/usr/local/blast+/bin', '/opt/blast+/bin'];
  return trustedDirs.some(dirPath => isSubPathSafe(dirPath, resolvedPath));
}

function isSubPathSafe(parentPath, targetPath) {
  const relative = path.relative(path.resolve(parentPath), path.resolve(targetPath));
  return relative === '' || (!!relative && !relative.startsWith('..') && !path.isAbsolute(relative));
}

function resolvePluginPaths() {
  const isDevelopment = !app.isPackaged;

  if (isDevelopment) {
    const builtinPluginsPath = path.join(__dirname, '..', 'renderer', 'modules', 'Plugins');
    return {
      isDevelopment,
      builtinPluginsPath,
      userPluginsPath: path.join(builtinPluginsPath, 'UserInstalled'),
    };
  }

  return {
    isDevelopment,
    builtinPluginsPath: path.join(process.resourcesPath, 'app.asar', 'src', 'renderer', 'modules', 'Plugins'),
    userPluginsPath: path.join(app.getPath('userData'), 'plugins'),
  };
}

function sanitizeOpenFileDialogOptions(options = {}) {
  const allowedProperties = new Set(['openFile', 'multiSelections', 'showHiddenFiles']);
  const properties = Array.isArray(options.properties)
    ? options.properties.filter(property => allowedProperties.has(property))
    : ['openFile'];

  if (!properties.includes('openFile')) {
    properties.unshift('openFile');
  }

  const filters = Array.isArray(options.filters)
    ? options.filters
        .map(filter => {
          const name =
            typeof filter.name === 'string' && filter.name.trim() ? filter.name.trim().slice(0, 80) : 'Files';
          const extensions = Array.isArray(filter.extensions)
            ? filter.extensions
                .map(extension =>
                  String(extension || '')
                    .trim()
                    .replace(/^\./, '')
                )
                .filter(extension => extension === '*' || /^[A-Za-z0-9]+$/.test(extension))
                .slice(0, 50)
            : [];
          return extensions.length > 0 ? { name, extensions } : null;
        })
        .filter(Boolean)
        .slice(0, 12)
    : [];

  return {
    title: typeof options.title === 'string' && options.title.trim() ? options.title.trim().slice(0, 120) : 'Open File',
    properties,
    filters: filters.length > 0 ? filters : [{ name: 'All Files', extensions: ['*'] }],
  };
}

function getLocalesRoot() {
  return path.join(__dirname, '..', 'locales');
}

function sanitizeLocaleCode(language) {
  const locale = String(language || '').trim();
  return LOCALE_CODE_PATTERN.test(locale) ? locale : 'en';
}

function sanitizeLocaleNamespace(namespace) {
  const safeNamespace = String(namespace || '').trim();
  if (!LOCALE_NAMESPACES.has(safeNamespace)) {
    throw new Error(`Unsupported locale namespace: ${safeNamespace}`);
  }
  return safeNamespace;
}

function readLocaleNamespace(language, namespace) {
  const localeRoot = getLocalesRoot();
  const safeLanguage = sanitizeLocaleCode(language);
  const safeNamespace = sanitizeLocaleNamespace(namespace);
  const candidatePath = path.join(localeRoot, safeLanguage, `${safeNamespace}.json`);
  const fallbackPath = path.join(localeRoot, 'en', `${safeNamespace}.json`);
  const selectedPath = fs.existsSync(candidatePath) ? candidatePath : fallbackPath;

  if (!fs.existsSync(selectedPath)) {
    return { language: safeLanguage, namespace: safeNamespace, data: {} };
  }

  return {
    language: path.basename(path.dirname(selectedPath)),
    namespace: safeNamespace,
    data: JSON.parse(fs.readFileSync(selectedPath, 'utf8')),
  };
}

function getConfigStorageDir() {
  return path.join(app.getPath('userData'), 'config');
}

function getConfigStoragePaths() {
  const dir = getConfigStorageDir();
  return Object.fromEntries(
    Object.entries(CONFIG_FILES).map(([section, filename]) => [section, path.join(dir, filename)])
  );
}

function readConfigFileIfPresent(filePath) {
  if (!fs.existsSync(filePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonFile(filePath, data) {
  const payload = JSON.stringify(data || {}, null, 2);
  const byteLength = Buffer.byteLength(payload, 'utf8');
  if (byteLength > 100 * 1024 * 1024) {
    throw new Error(
      `Configuration section is too large to persist safely: ${(byteLength / 1024 / 1024).toFixed(1)} MB`
    );
  }
  fs.writeFileSync(filePath, payload, 'utf8');
}

function readGeneralSettingsIfPresent() {
  try {
    return readConfigFileIfPresent(getConfigStoragePaths().generalSettings) || {};
  } catch (error) {
    return {};
  }
}

function areAiSecurityRestrictionsDisabled() {
  return readGeneralSettingsIfPresent().disableAiSecurityRestrictions === true;
}

function isAiInitiatedRequest(options = {}) {
  return options.aiInitiated === true || options.ai_initiated === true || options.source === 'ai';
}

function resolveIpcFileAccess(targetPath, options = {}) {
  if (isAiInitiatedRequest(options) && areAiSecurityRestrictionsDisabled()) {
    if (!targetPath || typeof targetPath !== 'string') {
      throw new Error(`File ${options.operation || 'access'} requires a valid path`);
    }

    const resolvedPath = path.resolve(targetPath);
    if (options.mustExist && !fs.existsSync(resolvedPath)) {
      throw new Error(`File does not exist: ${resolvedPath}`);
    }

    return resolvedPath;
  }

  return assertAllowedFileAccess(app, targetPath, options);
}

function getRequestedImagePath(options = {}) {
  if (typeof options === 'string') {
    return options;
  }

  return (
    options.filePath ||
    options.file_path ||
    options.path ||
    options.imagePath ||
    options.image_path ||
    options.filename ||
    options.fileName ||
    null
  );
}

function assertSupportedImagePath(filePath) {
  const extension = path.extname(String(filePath || '')).toLowerCase();
  const supportedExtensions = new Set(['.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tif', '.tiff']);
  if (!supportedExtensions.has(extension)) {
    throw new Error(`Unsupported image file type: ${extension || 'none'}`);
  }
}

function resolveBlastExecutable(appInstance, commandToken, configuredBlastPath) {
  const commandName = getBlastExecutableName(commandToken);
  if (!BLAST_EXECUTABLES.has(commandName)) {
    throw new Error(`Blocked non-BLAST command: ${commandName}`);
  }

  if (configuredBlastPath && typeof configuredBlastPath === 'string') {
    const trimmedConfiguredPath = configuredBlastPath.trim();
    if (!trimmedConfiguredPath || !/[\\/]/.test(trimmedConfiguredPath)) {
      return commandName;
    }

    let safeConfiguredPath = null;
    try {
      safeConfiguredPath = assertAllowedFileAccess(appInstance, trimmedConfiguredPath, {
        operation: 'execute configured BLAST binary',
        mustExist: true,
      });
    } catch (error) {
      if (isTrustedBlastExecutablePath(trimmedConfiguredPath) && fs.existsSync(trimmedConfiguredPath)) {
        safeConfiguredPath = path.resolve(trimmedConfiguredPath);
      } else {
        return commandName;
      }
    }

    const configuredName = getBlastExecutableName(trimmedConfiguredPath);
    if (configuredName === 'blastn') {
      const executable = path.join(
        path.dirname(safeConfiguredPath),
        `${commandName}${process.platform === 'win32' ? '.exe' : ''}`
      );
      if (fs.existsSync(executable)) {
        return executable;
      }
      return commandName;
    }
  }

  return commandName;
}

function runBlastVersionCheck(executablePath) {
  const { execFile } = require('child_process');
  return new Promise(resolve => {
    const commandName = getBlastExecutableName(executablePath);
    if (!BLAST_EXECUTABLES.has(commandName)) {
      resolve({ found: false, error: `Not a supported BLAST executable: ${executablePath}` });
      return;
    }

    execFile(executablePath, ['-version'], { timeout: 15000, maxBuffer: 1024 * 1024 }, (error, stdout, stderr) => {
      if (error) {
        resolve({ found: false, error: error.message, stderr });
        return;
      }

      const output = stdout || stderr || '';
      const versionMatch = output.match(/(?:blastn|blastp|blastx|tblastn|tblastx|makeblastdb|blastdbcmd):\s*([\d.]+)/i);
      resolve({
        found: true,
        version: versionMatch ? versionMatch[1] : 'Unknown',
        path: executablePath,
        output,
      });
    });
  });
}

async function findBlastExecutable() {
  const os = require('os');
  const homeDir = os.homedir();
  const commonPaths = [
    '/usr/local/bin/blastn',
    '/usr/bin/blastn',
    '/opt/homebrew/bin/blastn',
    '/usr/local/blast+/bin/blastn',
    path.join(homeDir, 'Applications', 'blast+', 'bin', 'blastn'),
    path.join(homeDir, '.local', 'blast+', 'bin', 'blastn'),
    path.join(homeDir, '.local', 'bin', 'blastn'),
    '/opt/blast+/bin/blastn',
  ];

  const pathBlastn = findExecutableOnPath('blastn');
  if (pathBlastn) {
    const result = await runBlastVersionCheck(pathBlastn);
    if (result.found) return { ...result, method: 'PATH' };
  }

  const pathResult = await runBlastVersionCheck('blastn');
  if (pathResult.found) return { ...pathResult, method: 'PATH' };

  for (const blastPath of commonPaths) {
    if (!fs.existsSync(blastPath)) continue;
    const result = await runBlastVersionCheck(blastPath);
    if (result.found) return { ...result, method: 'Common Path' };
  }

  return { found: false, error: 'BLAST+ not found in PATH or common installation locations' };
}

function toIpcSafeValue(value, seen = new WeakSet(), depth = 0) {
  if (value === null) return null;

  const valueType = typeof value;
  if (valueType === 'string' || valueType === 'boolean') return value;
  if (valueType === 'number') return Number.isFinite(value) ? value : null;
  if (valueType === 'bigint') return value.toString();
  if (valueType === 'undefined' || valueType === 'function' || valueType === 'symbol') return undefined;

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return value.toString('base64');
  }

  if (ArrayBuffer.isView(value)) {
    return Array.from(value);
  }

  if (value instanceof ArrayBuffer) {
    return Array.from(new Uint8Array(value));
  }

  if (depth > 8 || typeof value !== 'object') {
    return undefined;
  }

  if (seen.has(value)) {
    return undefined;
  }

  seen.add(value);

  if (Array.isArray(value)) {
    const safeArray = value.map(item => toIpcSafeValue(item, seen, depth + 1)).filter(item => item !== undefined);
    seen.delete(value);
    return safeArray;
  }

  const safeObject = {};
  Object.entries(value).forEach(([key, item]) => {
    const safeItem = toIpcSafeValue(item, seen, depth + 1);
    if (safeItem !== undefined) {
      safeObject[key] = safeItem;
    }
  });
  seen.delete(value);
  return safeObject;
}

function getBamReaderState(reader) {
  return toIpcSafeValue({
    filePath: reader.filePath,
    indexPath: reader.indexPath,
    isInitialized: reader.isInitialized,
    hasIndex: reader.hasIndex,
    indexType: reader.indexType,
    header: reader.header,
    references: reader.references,
    totalReads: reader.totalReads,
    fileSize: reader.fileSize,
    indexSize: reader.indexSize,
    performanceStats: { ...reader.performanceStats },
  });
}

/**
 * Register all non-Project-Manager IPC handlers.
 *
 * @param {Object} deps - Dependencies object containing shared state and functions
 * @param {BrowserWindow} deps.mainWindow - Main BrowserWindow instance
 * @param {Map} deps.windowRegistry - Window registry for multi-window support
 * @param {Map} deps.pendingRegistrations - Pending window registrations
 * @param {Function} deps.getUnifiedMCPServer - Getter for unified MCP server reference
 * @param {Function} deps.setUnifiedMCPServer - Setter for unified MCP server reference
 * @param {Function} deps.getUnifiedServerStatus - Getter for current MCP server status
 * @param {Function} deps.setUnifiedServerStatus - Setter for current MCP server status
 * @param {Map} deps.toolMenuTemplates - Tool menu templates
 * @param {BrowserWindow} deps.currentActiveWindow - Currently active window
 * @param {Array} deps.fileOpenQueue - Queue for file opening
 * @param {Map} deps.analyzerPendingData - Pending analyzer data storage
 * @param {Function} deps.getWindowRegistryStatus - Get window registry diagnostics
 * @param {Function} deps.syncWindowsWithMCPServer - Sync windows with MCP server
 * @param {Function} deps.registerGenomeWindow - Register a genome window
 * @param {Function} deps.unregisterGenomeWindow - Unregister a genome window
 * @param {Function} deps.getCurrentMainWindow - Get current main window reference
 * @param {Function} deps.createMCPServerManagerWindow - Create MCP server manager window
 * @param {Function} deps.createResourceManagerWindow - Create resource manager window
 * @param {Function} deps.createDebugWindow - Create debug window
 * @param {Function} deps.createCircosWindow - Create Circos plotter window
 * @param {Function} deps.createKEGGWindow - Create KEGG window
 * @param {Function} deps.createGOWindow - Create GO window
 * @param {Function} deps.createUniProtWindow - Create UniProt window
 * @param {Function} deps.createInterProWindow - Create InterPro window
 * @param {Function} deps.createNCBIWindow - Create NCBI window
 * @param {Function} deps.createSTRINGWindow - Create STRING window
 * @param {Function} deps.createDAVIDWindow - Create DAVID window
 * @param {Function} deps.createReactomeWindow - Create Reactome window
 * @param {Function} deps.createPDBWindow - Create PDB window
 * @param {Function} deps.createGeneAnnotationRefineWindow - Create gene annotation refine window
 * @param {Function} deps.createBlastDownloaderWindow - Create BLAST+ downloader window
 * @param {Function} deps.createBlastConfigWindow - Create BLAST config window
 * @param {Function} deps.createProGenFixerWindow - Create ProGenFixer window
 * @param {Function} deps.createDeepGeneResearchWindow - Create Deep Gene Research window
 * @param {Function} deps.createChopchopWindow - Create CHOPCHOP window
 * @param {Function} deps.createCustomExternalToolWindow - Create custom external tool window
 * @param {Function} deps.createMenu - Menu creation function
 * @param {Function} deps.createCircosPlotterMenu - Circos plotter menu creation function
 * @param {Function} deps.updateMCPServerMenu - Update MCP server menu
 * @param {Function} deps.loadMCPServerSettings - Load MCP server settings
 * @param {Function} deps.saveMCPServerSettings - Save MCP server settings
 * @param {Function} deps.checkPortAvailable - Check if port is available
 * @param {Object} deps.MCP_SETTINGS_DEFAULTS - MCP server settings defaults
 * @param {string} deps.PROJECT_DIRECTORY_NAME - Project directory name
 * @param {Object} deps.VERSION_INFO - Version info
 * @param {Object} deps.i18n - Internationalization
 */
function registerIpcHandlers(deps) {
  const {
    mainWindow,
    windowRegistry,

    getUnifiedMCPServer,
    getUnifiedServerStatus,

    analyzerPendingData,
    getWindowRegistryStatus,
    syncWindowsWithMCPServer,
    switchToWindowTab,
    notifyWindowGenomeNameChanged,

    getCurrentMainWindow,

    createKEGGWindow,
    createGOWindow,
    createUniProtWindow,
    createInterProWindow,
    createNCBIWindow,
    createSTRINGWindow,
    createDAVIDWindow,
    createReactomeWindow,
    createPDBWindow,
    createGeneAnnotationRefineWindow,
    createBlastDownloaderWindow,

    createProGenFixerWindow,
    createDeepGeneResearchWindow,
    createChopchopWindow,
    createCustomExternalToolWindow,
    createMenu,

    updateMCPServerMenu,
    startUnifiedMCPServer,
    stopUnifiedMCPServer,
    loadMCPServerSettings,
    saveMCPServerSettings,
    checkPortAvailable,
  } = deps;
  const bamReaders = new Map();
  const getMainGenomeTarget = () =>
    (typeof getCurrentMainWindow === 'function' && getCurrentMainWindow()) || mainWindow || null;
  const isRegisteredGenomeSender = event => {
    const sender = event?.sender;
    if (!sender || (typeof sender.isDestroyed === 'function' && sender.isDestroyed())) return false;
    const mainTarget = getMainGenomeTarget();
    if (mainTarget?.webContents === sender) return true;
    for (const [, entry] of windowRegistry.entries()) {
      const window = entry?.window || entry;
      if (window?.webContents === sender) return true;
    }
    for (const handle of workspaceHostManager.getAllViewHandles()) {
      if (handle?.webContents === sender) return true;
    }
    return false;
  };

  const getOwnedBamReader = (event, readerId) => {
    const entry = bamReaders.get(readerId);
    if (!entry || entry.ownerWebContentsId !== event.sender.id) {
      throw new Error('BAM reader is not available for this window');
    }
    return entry.reader;
  };

  const resolveGeneResearchReportPath = geneSymbol => {
    const safeSymbol = String(geneSymbol || 'Unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
    const fileName = `Gene_${safeSymbol}_Research_Report.md`;
    const reportsDir = path.resolve(process.cwd(), 'reports');
    const reportPath = path.resolve(reportsDir, fileName);

    if (path.dirname(reportPath) !== reportsDir) {
      throw new Error('Invalid gene research report path');
    }

    return { reportPath, fileName };
  };

  const resolveSidecarPaths = genomePath => {
    const authorizedGenomePath = assertAllowedFileAccess(app, genomePath, {
      operation: 'sidecar access',
      mustExist: true,
    });
    const safeGenomePath = fs.realpathSync.native
      ? fs.realpathSync.native(authorizedGenomePath)
      : fs.realpathSync(authorizedGenomePath);
    const parsed = path.parse(safeGenomePath);
    const sidecarPath = path.resolve(parsed.dir, `${parsed.name}.CodeXomics`);
    const fallbackDir = path.resolve(app.getPath('userData'), 'sidecar');
    const { sourcePathHash, fallbackPath, legacyFallbackPaths } = buildFallbackPaths(
      fallbackDir,
      authorizedGenomePath,
      safeGenomePath
    );

    if (
      path.dirname(sidecarPath) !== parsed.dir ||
      path.dirname(fallbackPath) !== fallbackDir ||
      legacyFallbackPaths.some(candidate => path.dirname(candidate) !== fallbackDir)
    ) {
      throw new Error('Invalid sidecar path');
    }

    return {
      authorizedGenomePath,
      safeGenomePath,
      sidecarPath,
      fallbackDir,
      fallbackPath,
      legacyFallbackPaths,
      sourcePathHash,
    };
  };

  const writeFileAtomically = async (destinationPath, content) => {
    const tempPath = `${destinationPath}.${process.pid}.${crypto.randomBytes(8).toString('hex')}.tmp`;
    let handle;
    try {
      handle = await fs.promises.open(tempPath, 'wx', 0o600);
      await handle.writeFile(content, 'utf8');
      await handle.sync();
      await handle.close();
      handle = null;
      await fs.promises.rename(tempPath, destinationPath);

      // The file contents and atomic rename are durable only after the parent
      // directory entry is flushed. Directory fsync is unavailable on some
      // platforms, so keep this final strengthening step best-effort.
      let directoryHandle;
      try {
        directoryHandle = await fs.promises.open(path.dirname(destinationPath), 'r');
        await directoryHandle.sync();
      } catch (syncError) {
        console.warn(`[Sidecar] Could not fsync ${path.dirname(destinationPath)}: ${syncError.message}`);
      } finally {
        await directoryHandle?.close().catch(() => undefined);
      }
    } catch (error) {
      if (handle) await handle.close().catch(() => undefined);
      await fs.promises.rm(tempPath, { force: true }).catch(() => undefined);
      throw error;
    }
  };

  const sidecarWriteLocks = new Map();
  const withSidecarWriteLock = async (genomePath, operation) => {
    const previous = sidecarWriteLocks.get(genomePath) || Promise.resolve();
    let release;
    const gate = new Promise(resolve => {
      release = resolve;
    });
    const tail = previous.catch(() => undefined).then(() => gate);
    sidecarWriteLocks.set(genomePath, tail);
    await previous.catch(() => undefined);
    try {
      return await operation();
    } finally {
      release();
      if (sidecarWriteLocks.get(genomePath) === tail) sidecarWriteLocks.delete(genomePath);
    }
  };

  const readNewestSidecarCandidate = async (paths, options = {}) => {
    const existingPaths = paths.filter(candidatePath => fs.existsSync(candidatePath));
    if (existingPaths.length === 0) return null;

    const validCandidates = [];
    const errors = [];
    for (const candidatePath of existingPaths) {
      try {
        const stats = await fs.promises.stat(candidatePath);
        assertSidecarContentSize(stats.size);
        const content = await fs.promises.readFile(candidatePath, 'utf8');
        assertSidecarContentSize(content);
        const data = JSON.parse(content);
        assertSidecarValueSize(data);
        if (!data || typeof data !== 'object' || Array.isArray(data)) {
          throw new Error('sidecar root must be a JSON object');
        }
        const isLegacy = options.legacyFallbackPaths?.has(candidatePath) || false;
        const isFallback = options.fallbackPaths?.has(candidatePath) || false;
        if (isFallback) {
          validateFallbackBinding(data, {
            ...options,
            isLegacy,
          });
        }
        const storageRevision =
          Number.isInteger(data._storageRevision) && data._storageRevision >= 0 ? data._storageRevision : 0;
        validCandidates.push({
          path: candidatePath,
          data,
          storageRevision,
          // File mtime is controlled by the storage layer. Never let a
          // caller-supplied future lastModified value win candidate selection.
          modifiedAt: stats.mtimeMs || 0,
          isLegacy,
        });
      } catch (error) {
        errors.push(`${candidatePath}: ${error.message}`);
      }
    }
    if (validCandidates.length === 0) {
      throw new Error(`All existing sidecar candidates are corrupt (${errors.join('; ')})`);
    }
    validCandidates.sort(
      (left, right) =>
        right.storageRevision - left.storageRevision ||
        right.modifiedAt - left.modifiedAt ||
        left.path.localeCompare(right.path)
    );
    return validCandidates[0];
  };

  const sanitizeScreenshotFormat = format => {
    const normalized = String(format || 'png')
      .trim()
      .toLowerCase();
    if (['jpg', 'jpeg'].includes(normalized)) return 'jpeg';
    return 'png';
  };

  const DEFAULT_SCREENSHOT_MAX_IMAGE_BYTES = 16 * 1024 * 1024;
  const ABSOLUTE_SCREENSHOT_MAX_IMAGE_BYTES = 64 * 1024 * 1024;

  const getScreenshotExtension = format => (format === 'jpeg' ? 'jpg' : 'png');
  const getScreenshotMimeType = format => (format === 'jpeg' ? 'image/jpeg' : 'image/png');

  const getDefaultScreenshotDirectory = () => {
    for (const appPathName of ['downloads', 'documents', 'userData', 'temp']) {
      try {
        const basePath = app.getPath(appPathName);
        if (basePath) {
          return path.join(basePath, 'CodeXomics Screenshots');
        }
      } catch (_) {
        // Try the next writable Electron app path.
      }
    }
    return path.resolve('CodeXomics Screenshots');
  };

  const hasScreenshotImageExtension = filePath => /\.(?:png|jpe?g)$/i.test(String(filePath || ''));

  const withScreenshotExtension = (filePath, format) => {
    if (path.parse(filePath).ext) {
      return filePath;
    }
    return `${filePath}.${getScreenshotExtension(format)}`;
  };

  const isAbsoluteFilePath = filePath => /^(?:\/|[A-Za-z]:[\\/])/.test(String(filePath || '').trim());

  const resolveRelativeScreenshotPath = requestedPath => {
    const defaultDirectory = getDefaultScreenshotDirectory();
    const normalizedRelativePath = String(requestedPath || '')
      .trim()
      .replace(/[\\/]+/g, path.sep);
    const resolvedPath = path.resolve(defaultDirectory, normalizedRelativePath);
    if (!isSubPathSafe(defaultDirectory, resolvedPath)) {
      throw new Error('Screenshot path must stay inside the default screenshots directory');
    }
    return resolvedPath;
  };

  const isRootLevelGeneratedScreenshotPath = requestedPath => {
    const trimmedPath = String(requestedPath || '').trim();
    if (!isAbsoluteFilePath(trimmedPath) || !hasScreenshotImageExtension(trimmedPath)) {
      return false;
    }
    const parsedPath = path.parse(path.resolve(trimmedPath));
    return parsedPath.dir === parsedPath.root && /^codexomics-/i.test(parsedPath.base);
  };

  const shouldRedirectGeneratedRootScreenshot = (requestedPath, options = {}) =>
    (options.auto_save || options.autoSave || isAiInitiatedRequest(options)) &&
    isRootLevelGeneratedScreenshotPath(requestedPath);

  const shouldReturnScreenshotImageData = options =>
    Boolean(
      options.returnImageData ||
      options.return_image_data ||
      options.includeImageData ||
      options.include_image_data ||
      options.embedImage ||
      options.embed_image
    );

  const normalizeScreenshotMaxImageBytes = options => {
    const requested =
      options.maxImageBytes ||
      options.max_image_bytes ||
      options.maxReturnedImageBytes ||
      options.max_returned_image_bytes;
    const numeric = Number(requested);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      return DEFAULT_SCREENSHOT_MAX_IMAGE_BYTES;
    }
    return Math.min(Math.trunc(numeric), ABSOLUTE_SCREENSHOT_MAX_IMAGE_BYTES);
  };

  const sanitizeScreenshotRect = rect => {
    if (!rect || typeof rect !== 'object') return undefined;

    const x = Math.max(0, Math.floor(Number(rect.x) || 0));
    const y = Math.max(0, Math.floor(Number(rect.y) || 0));
    const width = Math.max(1, Math.ceil(Number(rect.width) || 0));
    const height = Math.max(1, Math.ceil(Number(rect.height) || 0));

    if (!Number.isFinite(x) || !Number.isFinite(y) || !Number.isFinite(width) || !Number.isFinite(height)) {
      return undefined;
    }

    return { x, y, width, height };
  };

  const getScreenshotBuffer = (image, format, quality) => {
    if (!image || image.isEmpty()) {
      throw new Error('Captured screenshot image is empty');
    }

    if (format === 'jpeg') {
      const normalizedQuality = Number.isFinite(Number(quality))
        ? Math.max(1, Math.min(Math.trunc(Number(quality)), 100))
        : 92;
      return image.toJPEG(normalizedQuality);
    }

    return image.toPNG();
  };

  const getWorkspaceHandleForSender = event => {
    if (!event?.sender) return null;

    for (const handle of workspaceHostManager.getAllViewHandles()) {
      if (!handle || handle.isDestroyed() || handle.webContents !== event.sender) continue;
      return handle;
    }

    return null;
  };

  const resolveScreenshotHostWindow = event =>
    BrowserWindow.fromWebContents(event.sender) ||
    getWorkspaceHandleForSender(event)?.getNativeWindow() ||
    workspaceHostManager.getNativeWindow(getMainGenomeTarget());

  const resolveScreenshotSavePath = async (event, options, format) => {
    const explicitPath =
      options.filePath ||
      options.file_path ||
      options.outputPath ||
      options.output_path ||
      options.savePath ||
      options.save_path ||
      options.filename ||
      options.fileName ||
      null;

    if (explicitPath) {
      const requestedPath = String(explicitPath).trim();
      const candidatePath = isAbsoluteFilePath(requestedPath)
        ? shouldRedirectGeneratedRootScreenshot(requestedPath, options)
          ? path.join(getDefaultScreenshotDirectory(), path.basename(requestedPath))
          : requestedPath
        : resolveRelativeScreenshotPath(requestedPath);
      const safeFilePath = resolveIpcFileAccess(candidatePath, {
        operation: 'write screenshot',
        aiInitiated: options.aiInitiated,
        ai_initiated: options.ai_initiated,
        source: options.source,
      });
      return withScreenshotExtension(safeFilePath, format);
    }

    if (options.save === false || options.saveFile === false) {
      return null;
    }

    if (options.auto_save || options.autoSave) {
      const extension = getScreenshotExtension(format);
      const defaultFilename = String(options.defaultFilename || `codexomics-screenshot.${extension}`);
      return withScreenshotExtension(
        path.join(getDefaultScreenshotDirectory(), path.basename(defaultFilename)),
        format
      );
    }

    const parentWindow = resolveScreenshotHostWindow(event);
    const extension = getScreenshotExtension(format);
    const defaultFilename = String(options.defaultFilename || `codexomics-screenshot.${extension}`);
    const result = await dialog.showSaveDialog(parentWindow, {
      title: options.title || 'Save Screenshot',
      defaultPath: defaultFilename,
      filters: [
        format === 'jpeg'
          ? { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] }
          : { name: 'PNG Image', extensions: ['png'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });

    rememberApprovedDialogPaths(result, {
      source: 'user-save-dialog',
      capabilities: [FILE_CAPABILITIES.READ, FILE_CAPABILITIES.WRITE],
      operation: 'save-screenshot',
    });

    return result.canceled ? null : result.filePath;
  };

  const createScreenshotImage = async (event, options) => {
    if (options.imageDataUrl || options.imageDataURL) {
      const dataUrl = String(options.imageDataUrl || options.imageDataURL);
      if (!/^data:image\/(png|jpeg|jpg);base64,/i.test(dataUrl)) {
        throw new Error('Screenshot image data must be a PNG or JPEG data URL');
      }

      const image = nativeImage.createFromDataURL(dataUrl);
      if (image.isEmpty()) {
        throw new Error('Renderer-composited screenshot image is empty');
      }
      return image;
    }

    const rect = sanitizeScreenshotRect(options.rect);
    if (
      event.sender &&
      typeof event.sender.isDestroyed === 'function' &&
      !event.sender.isDestroyed() &&
      typeof event.sender.capturePage === 'function'
    ) {
      const image = await event.sender.capturePage(rect);
      if (!image || image.isEmpty()) {
        throw new Error('Captured screenshot image is empty');
      }
      return image;
    }

    const targetWindow = resolveScreenshotHostWindow(event);
    if (!targetWindow || targetWindow.isDestroyed()) {
      throw new Error('No active application window is available for screenshot capture');
    }

    return targetWindow.webContents.capturePage(rect);
  };

  const toolRegistryService = deps.toolRegistryService || new ToolRegistryService({ app });
  const broadcastToolRegistryUpdated = snapshot => {
    for (const [, entry] of windowRegistry.entries()) {
      const win = entry.window || entry;
      if (win && !win.isDestroyed()) {
        win.webContents.send('tool-registry-updated', snapshot);
      }
    }

    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send('tool-registry-updated', snapshot);
      }
    }
  };

  // =====================================================================
  // 1. Tool Execution IPC
  // =====================================================================

  // CRITICAL: IPC handler for MCP tool execution
  // This is the missing bridge between MCP server and renderer process
  ipcMain.on('tool-execution', async (event, data) => {
    console.log('[Main] Received tool execution request:', data);
    const { requestId, toolName, parameters, clientId } = data;

    try {
      const targetWindowId = parameters?.windowId || null;
      let forwardedParameters = parameters || {};
      let targetWindow = null;

      if (targetWindowId && windowRegistry.has(targetWindowId)) {
        const entry = windowRegistry.get(targetWindowId);
        targetWindow = entry.window || entry;
        forwardedParameters = { ...forwardedParameters };
        delete forwardedParameters.windowId;
      } else if (targetWindowId) {
        throw new Error(`Target genome window '${targetWindowId}' was not found`);
      }

      if (!targetWindow && typeof getCurrentMainWindow === 'function') {
        targetWindow = getCurrentMainWindow();
      }

      if (!targetWindow || targetWindow.isDestroyed()) {
        throw new Error('Main window not available for tool execution');
      }

      // Forward the tool execution request to the renderer process
      console.log('[Main] Forwarding tool execution to renderer:', toolName, targetWindow.windowId || 'active');
      targetWindow.webContents.send('execute-tool-request', {
        requestId,
        toolName,
        parameters: forwardedParameters,
        clientId,
      });
    } catch (error) {
      console.error('[Main] Tool execution forwarding failed:', error);
      // Send error response back to MCP server
      event.sender.send('tool-response', {
        requestId,
        success: false,
        error: error.message,
      });
    }
  });

  // IPC handler for tool execution responses from renderer
  ipcMain.on('tool-response', (event, response) => {
    console.log('[Main] Received tool response from renderer:', response);
    // Forward the response back to MCP server
    const _mcpServer = getUnifiedMCPServer();
    if (_mcpServer && _mcpServer.handleToolResponse) {
      _mcpServer.handleToolResponse(response);
    }
  });

  // =====================================================================
  // 1a. Dynamic Tool Registry IPC
  // =====================================================================

  ipcMain.handle('tool-registry:get-snapshot', async () => {
    return await toolRegistryService.getSnapshot();
  });

  ipcMain.handle('tool-registry:get-metadata', async () => {
    return await toolRegistryService.getMetadata();
  });

  ipcMain.handle('tool-registry:get-tool', async (event, toolName) => {
    return await toolRegistryService.getTool(toolName);
  });

  ipcMain.handle('tool-registry:reload', async () => {
    const snapshot = await toolRegistryService.reload();
    broadcastToolRegistryUpdated(snapshot);
    return snapshot;
  });

  // =====================================================================
  // 2. Plugin Path Resolution IPC Handlers
  // =====================================================================

  /**
   * Get plugin paths for both built-in and user-installed plugins
   * Returns different paths based on whether app is packaged
   */
  ipcMain.handle('get-plugin-paths', async () => {
    return resolvePluginPaths();
  });

  /**
   * Ensure a directory exists, creating it if necessary
   */
  ipcMain.handle('ensure-directory', async (event, dirPath) => {
    try {
      // Allow the default writable roots plus the user-installed plugin roots,
      // since this handler is used to set up the UserInstalled plugins directory
      // (which is otherwise only reachable through assertPluginPath).
      const safeDirPath = assertAllowedFileAccess(app, dirPath, {
        operation: 'create directory',
        allowedRoots: [...getDefaultWritableRoots(app), ...getUserPluginRoots(app)],
      });
      if (!fs.existsSync(safeDirPath)) {
        fs.mkdirSync(safeDirPath, { recursive: true });
        console.log('Created directory:', safeDirPath);
      }
      return { success: true, path: safeDirPath };
    } catch (error) {
      console.error('Failed to create directory:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * List all plugins in a given directory
   */
  ipcMain.handle('list-plugins', async (event, pluginPath) => {
    try {
      const safePluginPath = assertPluginPath(app, pluginPath);
      if (!fs.existsSync(safePluginPath)) {
        return { success: true, plugins: [] };
      }

      const items = fs.readdirSync(safePluginPath, { withFileTypes: true });
      const plugins = items
        .filter(item => item.isDirectory())
        .map(item => ({
          id: item.name,
          path: path.join(safePluginPath, item.name),
          hasManifest: fs.existsSync(path.join(safePluginPath, item.name, 'plugin.json')),
        }));

      return { success: true, plugins };
    } catch (error) {
      console.error('Failed to list plugins:', error);
      return { success: false, error: error.message, plugins: [] };
    }
  });

  /**
   * Select plugin file for manual installation
   */
  ipcMain.handle('select-plugin-file', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Select Plugin File or Directory',
      properties: ['openFile', 'openDirectory'],
      filters: [
        { name: 'Plugin Files', extensions: ['js', 'zip'] },
        { name: 'All Files', extensions: ['*'] },
      ],
    });
    return rememberApprovedDialogPaths(result, {
      source: 'user-plugin-file-dialog',
      operation: 'select-plugin-file',
    });
  });

  /**
   * Get plugin file information
   */
  ipcMain.handle('get-plugin-file-info', async (event, filePath) => {
    try {
      const safeFilePath = assertAllowedFileAccess(app, filePath, {
        operation: 'inspect plugin file',
        mustExist: true,
      });
      const stats = fs.statSync(safeFilePath);
      return {
        exists: true,
        isDirectory: stats.isDirectory(),
        isFile: stats.isFile(),
        size: stats.size,
        modified: stats.mtime,
      };
    } catch (error) {
      return {
        exists: false,
        error: error.message,
      };
    }
  });

  /**
   * Read plugin file content
   */
  ipcMain.handle('read-plugin-file', async (event, filePath) => {
    try {
      const safeFilePath = assertAllowedFileAccess(app, filePath, { operation: 'read plugin file', mustExist: true });
      return fs.readFileSync(safeFilePath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read plugin file: ${error.message}`);
    }
  });

  /**
   * Check if file exists
   */
  ipcMain.handle('check-file-exists', async (event, filePath) => {
    try {
      const safeFilePath = assertAllowedFileAccess(app, filePath, { operation: 'check file' });
      return fs.existsSync(safeFilePath);
    } catch (error) {
      return false;
    }
  });

  ipcMain.handle('check-gene-research-report', async (event, geneSymbol) => {
    try {
      const { reportPath, fileName } = resolveGeneResearchReportPath(geneSymbol);
      return {
        success: true,
        exists: fs.existsSync(reportPath),
        fileName,
      };
    } catch (error) {
      return { success: false, exists: false, error: error.message };
    }
  });

  ipcMain.handle('save-gene-research-report', async (event, geneSymbol, report) => {
    try {
      const { reportPath, fileName } = resolveGeneResearchReportPath(geneSymbol);
      const reportStr = typeof report === 'string' ? report : report ? JSON.stringify(report, null, 2) : '';

      if (!reportStr.trim()) {
        return { success: false, error: 'Report content is empty' };
      }

      fs.mkdirSync(path.dirname(reportPath), { recursive: true });
      fs.writeFileSync(reportPath, reportStr, 'utf8');

      return {
        success: true,
        fileName,
        reportPath,
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('read-gene-research-report', async (event, geneSymbol) => {
    try {
      const { reportPath, fileName } = resolveGeneResearchReportPath(geneSymbol);

      if (!fs.existsSync(reportPath)) {
        return { success: false, error: 'Gene research report does not exist' };
      }

      return {
        success: true,
        fileName,
        report: fs.readFileSync(reportPath, 'utf8'),
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-gene-research-report', async (event, geneSymbol) => {
    try {
      const { reportPath } = resolveGeneResearchReportPath(geneSymbol);

      if (!fs.existsSync(reportPath)) {
        return { success: false, error: 'Gene research report does not exist' };
      }

      const { shell } = require('electron');
      const openError = await shell.openPath(reportPath);
      if (openError) {
        return { success: false, error: openError };
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('load-sidecar-file', async (event, genomePath) => {
    try {
      const {
        authorizedGenomePath,
        safeGenomePath,
        sidecarPath,
        fallbackDir,
        fallbackPath,
        legacyFallbackPaths,
        sourcePathHash,
      } = resolveSidecarPaths(genomePath);
      return await withSidecarWriteLock(safeGenomePath, async () => {
        const candidateOptions = {
          authorizedGenomePath,
          safeGenomePath,
          sourcePathHash,
          legacyFallbackPaths: new Set(legacyFallbackPaths),
          fallbackPaths: new Set([fallbackPath, ...legacyFallbackPaths]),
        };
        let selected = await readNewestSidecarCandidate(
          [sidecarPath, fallbackPath, ...legacyFallbackPaths],
          candidateOptions
        );

        if (!selected) {
          return { success: true, exists: false, data: null };
        }

        if (selected.isLegacy) {
          const migratedData = createMigratedSidecarData(selected.data, safeGenomePath, sourcePathHash);
          await fs.promises.mkdir(fallbackDir, { recursive: true });
          assertSidecarValueSize(migratedData);
          const migratedContent = JSON.stringify(migratedData, null, 2);
          assertSidecarContentSize(migratedContent);
          await writeFileAtomically(fallbackPath, migratedContent);
          selected = {
            ...selected,
            path: fallbackPath,
            data: migratedData,
            isLegacy: false,
          };
        }

        return {
          success: true,
          exists: true,
          path: selected.path,
          data: selected.data,
          storageRevision: selected.storageRevision,
          sourceFile: path.basename(safeGenomePath),
        };
      });
    } catch (error) {
      return { success: false, exists: false, error: error.message };
    }
  });

  ipcMain.handle('save-sidecar-file', async (event, genomePath, data) => {
    try {
      if (data !== undefined && (!data || typeof data !== 'object' || Array.isArray(data))) {
        throw new Error('Sidecar data must be a JSON object');
      }
      assertSidecarValueSize(data || {});
      const {
        authorizedGenomePath,
        safeGenomePath,
        sidecarPath,
        fallbackDir,
        fallbackPath,
        legacyFallbackPaths,
        sourcePathHash,
      } = resolveSidecarPaths(genomePath);
      return await withSidecarWriteLock(safeGenomePath, async () => {
        const current = await readNewestSidecarCandidate([sidecarPath, fallbackPath, ...legacyFallbackPaths], {
          authorizedGenomePath,
          safeGenomePath,
          sourcePathHash,
          legacyFallbackPaths: new Set(legacyFallbackPaths),
          fallbackPaths: new Set([fallbackPath, ...legacyFallbackPaths]),
        });
        const expectedRevision =
          Number.isInteger(data?._storageRevision) && data._storageRevision >= 0 ? data._storageRevision : 0;
        const currentRevision = current?.storageRevision || 0;
        if (expectedRevision !== currentRevision) {
          return {
            success: false,
            conflict: true,
            code: 'SIDECAR_CONFLICT',
            currentRevision,
            error: `Sidecar changed in another window (expected revision ${expectedRevision}, current revision ${currentRevision}); reload before saving`,
          };
        }

        const storageRevision = currentRevision + 1;
        const storedData = {
          ...(data || {}),
          _storageRevision: storageRevision,
          _sourceGenomePathSha256: sourcePathHash,
          _originalPath: safeGenomePath,
          sourceFile: data?.sourceFile || path.basename(safeGenomePath),
          lastModified: data?.lastModified || new Date().toISOString(),
        };
        assertSidecarValueSize(storedData);
        const content = JSON.stringify(storedData, null, 2);
        assertSidecarContentSize(content);

        try {
          await writeFileAtomically(sidecarPath, content);
          return { success: true, path: sidecarPath, fallback: false, storageRevision };
        } catch (writeError) {
          if (!['EACCES', 'EROFS', 'EPERM', 'ENOENT'].includes(writeError.code)) {
            throw writeError;
          }

          await fs.promises.mkdir(fallbackDir, { recursive: true });
          await writeFileAtomically(fallbackPath, content);
          return { success: true, path: fallbackPath, fallback: true, storageRevision };
        }
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('check-sidecar-file', async (event, genomePath) => {
    try {
      const { authorizedGenomePath, safeGenomePath, sidecarPath, fallbackPath, legacyFallbackPaths, sourcePathHash } =
        resolveSidecarPaths(genomePath);
      const selected = await readNewestSidecarCandidate([sidecarPath, fallbackPath, ...legacyFallbackPaths], {
        authorizedGenomePath,
        safeGenomePath,
        sourcePathHash,
        legacyFallbackPaths: new Set(legacyFallbackPaths),
        fallbackPaths: new Set([fallbackPath, ...legacyFallbackPaths]),
      });
      return {
        success: true,
        exists: Boolean(selected),
      };
    } catch (error) {
      return { success: false, exists: false, error: error.message };
    }
  });

  /**
   * Scan plugin directory for all plugin files
   * Looks for both directories with plugin.json and standalone .js files
   */
  ipcMain.handle('scan-plugin-directory', async () => {
    try {
      const paths = resolvePluginPaths();

      const plugins = [];

      // Scan both plugin directories
      const dirsToScan = [
        { path: paths.builtinPluginsPath, type: 'builtin' },
        { path: paths.userPluginsPath, type: 'user' },
      ];

      for (const dirInfo of dirsToScan) {
        if (!fs.existsSync(dirInfo.path)) {
          continue;
        }

        const items = fs.readdirSync(dirInfo.path, { withFileTypes: true });

        for (const item of items) {
          const itemPath = path.join(dirInfo.path, item.name);

          // Check for plugin directories with plugin.json
          if (item.isDirectory()) {
            const manifestPath = path.join(itemPath, 'plugin.json');
            if (fs.existsSync(manifestPath)) {
              try {
                const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
                plugins.push({
                  id: manifest.id || item.name,
                  name: manifest.name || item.name,
                  description: manifest.description || 'No description available',
                  version: manifest.version || '1.0.0',
                  author: manifest.author || 'Unknown',
                  category: manifest.category || 'general',
                  type: dirInfo.type,
                  file: item.name,
                  path: itemPath,
                  hasManifest: true,
                  functions: manifest.functions || [],
                  main: manifest.main || 'index.js',
                });
              } catch (error) {
                console.error(`Failed to parse manifest for ${item.name}:`, error);
              }
            }
          }
          // Check for standalone .js files that might be plugins
          else if (item.isFile() && item.name.endsWith('.js') && item.name !== 'index.js') {
            try {
              // Read first few lines to check for plugin metadata
              const content = fs.readFileSync(itemPath, 'utf8');
              const lines = content.split('\n').slice(0, 50);

              // Look for plugin metadata in comments or class definition
              let pluginName = item.name.replace('.js', '');
              let pluginDescription = 'JavaScript plugin file';
              let pluginVersion = '1.0.0';
              let pluginAuthor = 'Unknown';

              // Try to extract metadata from comments
              for (const line of lines) {
                const nameMatch = line.match(/@name\s+(.+)/);
                const descMatch = line.match(/@description\s+(.+)/);
                const versionMatch = line.match(/@version\s+(.+)/);
                const authorMatch = line.match(/@author\s+(.+)/);

                if (nameMatch) pluginName = nameMatch[1].trim();
                if (descMatch) pluginDescription = descMatch[1].trim();
                if (versionMatch) pluginVersion = versionMatch[1].trim();
                if (authorMatch) pluginAuthor = authorMatch[1].trim();
              }

              plugins.push({
                id: item.name.replace('.js', ''),
                name: pluginName,
                description: pluginDescription,
                version: pluginVersion,
                author: pluginAuthor,
                category: 'general',
                type: dirInfo.type,
                file: item.name,
                path: itemPath,
                hasManifest: false,
                isStandalone: true,
              });
            } catch (error) {
              console.error(`Failed to read plugin file ${item.name}:`, error);
            }
          }
        }
      }

      return {
        success: true,
        plugins,
        paths: {
          builtinPluginsPath: paths.builtinPluginsPath,
          userPluginsPath: paths.userPluginsPath,
        },
      };
    } catch (error) {
      console.error('Failed to scan plugin directory:', error);
      return {
        success: false,
        error: error.message,
        plugins: [],
      };
    }
  });

  /**
   * Load detailed metadata for a specific plugin
   */
  ipcMain.handle('load-plugin-metadata', async (event, pluginPath) => {
    try {
      let safePluginPath;
      try {
        safePluginPath = assertPluginPath(app, pluginPath, 'plugin metadata path');
      } catch (pluginPathError) {
        safePluginPath = assertAllowedFileAccess(app, pluginPath, {
          operation: 'load plugin metadata',
          mustExist: true,
        });
      }
      const stats = fs.statSync(safePluginPath);

      if (stats.isDirectory()) {
        // Try to load plugin.json
        const manifestPath = path.join(safePluginPath, 'plugin.json');
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          return { success: true, metadata: manifest };
        }

        // Try to load from package.json
        const packagePath = path.join(safePluginPath, 'package.json');
        if (fs.existsSync(packagePath)) {
          const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
          return {
            success: true,
            metadata: {
              id: pkg.name,
              name: pkg.name,
              description: pkg.description || 'No description',
              version: pkg.version,
              author: pkg.author || 'Unknown',
              main: pkg.main || 'index.js',
            },
          };
        }
      } else if (stats.isFile() && safePluginPath.endsWith('.js')) {
        // Parse JavaScript file for metadata
        const content = fs.readFileSync(safePluginPath, 'utf8');
        const lines = content.split('\n');

        const metadata = {
          id: path.basename(safePluginPath, '.js'),
          name: path.basename(safePluginPath, '.js'),
          description: 'No description',
          version: '1.0.0',
          author: 'Unknown',
          functions: [],
        };

        // Extract metadata from JSDoc comments
        for (let i = 0; i < Math.min(100, lines.length); i++) {
          const line = lines[i];
          if (line.includes('@name')) metadata.name = line.split('@name')[1].trim();
          if (line.includes('@description')) metadata.description = line.split('@description')[1].trim();
          if (line.includes('@version')) metadata.version = line.split('@version')[1].trim();
          if (line.includes('@author')) metadata.author = line.split('@author')[1].trim();
        }

        // Try to extract function names
        const functionMatches = content.match(
          /(?:async\s+)?function\s+(\w+)|(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s+)?function|(?:async\s+)?(\w+)\s*\(/g
        );
        if (functionMatches) {
          metadata.functions = functionMatches.map(match => {
            const name = match.match(/\w+/g)[match.includes('function') ? 1 : 0];
            return { name };
          });
        }

        return { success: true, metadata };
      }

      return {
        success: false,
        error: 'Not a valid plugin file or directory',
      };
    } catch (error) {
      console.error('Failed to load plugin metadata:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Extract plugin zip file
   */
  ipcMain.handle('extract-plugin-zip', async (event, zipPath) => {
    try {
      assertAllowedFileAccess(app, zipPath, {
        operation: 'extract plugin zip',
        mustExist: true,
      });
      // Create temp directory for extraction
      const tempDir = assertAllowedFileAccess(app, path.join(app.getPath('temp'), `plugin-${Date.now()}`), {
        operation: 'create plugin extraction directory',
      });
      fs.mkdirSync(tempDir, { recursive: true });

      // Note: This is a placeholder - you'll need to add a zip extraction library
      // For now, return error indicating zip extraction not implemented
      return {
        success: false,
        error: 'ZIP extraction not yet implemented. Please extract manually and select the plugin directory.',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Copy plugin directory
   */
  ipcMain.handle('copy-plugin-directory', async (event, sourcePath, destPath) => {
    try {
      const safeSourcePath = assertAllowedFileAccess(app, sourcePath, {
        operation: 'copy plugin source',
        mustExist: true,
      });
      const safeDestPath = assertPluginPath(app, destPath, 'plugin destination');
      // Recursive directory copy
      const copyRecursive = (src, dest) => {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }

        const entries = fs.readdirSync(src, { withFileTypes: true });

        for (const entry of entries) {
          const srcPath = path.join(src, entry.name);
          const destPath = path.join(dest, entry.name);

          if (entry.isDirectory()) {
            copyRecursive(srcPath, destPath);
          } else {
            fs.copyFileSync(srcPath, destPath);
          }
        }
      };

      copyRecursive(safeSourcePath, safeDestPath);
      return { success: true };
    } catch (error) {
      console.error('Failed to copy plugin directory:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Copy single plugin file
   */
  ipcMain.handle('copy-plugin-file', async (event, sourcePath, destPath) => {
    try {
      const safeSourcePath = assertAllowedFileAccess(app, sourcePath, {
        operation: 'copy plugin file source',
        mustExist: true,
      });
      const safeDestPath = assertPluginPath(app, destPath, 'plugin destination file');
      const destDir = path.dirname(safeDestPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(safeSourcePath, safeDestPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Write plugin file (for creating manifests, etc.)
   */
  ipcMain.handle('write-plugin-file', async (event, filePath, content) => {
    try {
      const safeFilePath = assertPluginPath(app, filePath, 'plugin file');
      const dir = path.dirname(safeFilePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(safeFilePath, content, 'utf8');
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Write complete plugin package to disk
   * Handles both JSON (mock packages) and ZIP (real packages) data
   */
  ipcMain.handle('write-plugin-files', async (event, options) => {
    try {
      const { pluginId, installPath, data, manifest } = options || {};
      const safePluginId = sanitizePluginId(pluginId);
      const safeInstallPath = assertPluginPath(app, installPath, 'plugin install path');

      console.log(`[Main] Writing plugin files for ${safePluginId} to ${safeInstallPath}`);

      // Create plugin directory if it doesn't exist
      if (!fs.existsSync(safeInstallPath)) {
        fs.mkdirSync(safeInstallPath, { recursive: true });
        console.log(`[Main] Created plugin directory: ${safeInstallPath}`);
      }

      // Write manifest file (plugin.json)
      const manifestPath = safePluginJoin(app, safeInstallPath, 'plugin.json', 'plugin manifest');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      console.log(`[Main] Wrote manifest to: ${manifestPath}`);

      // Handle the plugin data
      if (data) {
        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'number') {
          // Binary data sent as byte array - could be a ZIP file
          const zipPath = safePluginJoin(app, safeInstallPath, `${safePluginId}.zip`, 'plugin zip');
          const buffer = Buffer.from(data);
          fs.writeFileSync(zipPath, buffer);
          console.log(`[Main] Wrote ZIP file (${buffer.length} bytes): ${zipPath}`);

          // Try to extract the ZIP file using native zlib if it's a valid zip
          try {
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(buffer);
            safeExtractAdmZip(app, zip, safeInstallPath);
            // Remove the zip file after extraction
            fs.unlinkSync(zipPath);
            console.log(`[Main] Extracted ZIP file to ${safeInstallPath}`);
          } catch (extractError) {
            // If adm-zip is not available or extraction fails, keep the ZIP for manual extraction
            console.log(`[Main] ZIP extraction not available, keeping ZIP file: ${extractError.message}`);
          }
        } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
          // Binary data (ArrayBuffer/TypedArray) - should not normally reach here after IPC
          const zipPath = safePluginJoin(app, safeInstallPath, `${safePluginId}.zip`, 'plugin zip');
          const buffer = Buffer.from(data);
          fs.writeFileSync(zipPath, buffer);
          console.log(`[Main] Wrote binary data (${buffer.length} bytes): ${zipPath}`);
        } else if (typeof data === 'object' && !Array.isArray(data)) {
          // JSON package (mock package with files object)
          for (const [filename, content] of Object.entries(data)) {
            const filePath = safePluginJoin(app, safeInstallPath, filename, 'plugin package file');
            const fileDir = path.dirname(filePath);

            if (!fs.existsSync(fileDir)) {
              fs.mkdirSync(fileDir, { recursive: true });
            }

            // Handle different content types
            if (typeof content === 'string') {
              fs.writeFileSync(filePath, content, 'utf8');
            } else if (typeof content === 'object') {
              fs.writeFileSync(filePath, JSON.stringify(content, null, 2), 'utf8');
            }

            console.log(`[Main] Wrote file: ${filePath}`);
          }
        }
      }

      // Create an index.js entry point if not provided
      const indexPath = safePluginJoin(app, safeInstallPath, 'index.js', 'plugin index');
      if (!fs.existsSync(indexPath)) {
        const defaultIndex = `// Plugin: ${safePluginId}\n// Auto-generated entry point\nmodule.exports = ${JSON.stringify(manifest, null, 2)};\n`;
        fs.writeFileSync(indexPath, defaultIndex, 'utf8');
        console.log(`[Main] Created default index.js`);
      }

      console.log(`[Main] Plugin ${safePluginId} installed successfully to ${safeInstallPath}`);

      return {
        success: true,
        installPath: safeInstallPath,
        files: fs.readdirSync(safeInstallPath),
      };
    } catch (error) {
      console.error('[Main] Failed to write plugin files:', error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Load plugin from disk for restoration
   */
  ipcMain.handle('load-plugin-from-disk', async (event, options) => {
    const { pluginId, installPath } = options;
    const safePluginId = sanitizePluginId(pluginId);
    const safeInstallPath = assertPluginPath(app, installPath, 'plugin install path');

    console.log(`[Main] Loading plugin ${safePluginId} from ${safeInstallPath}`);

    try {
      // Check if plugin directory exists
      if (!fs.existsSync(safeInstallPath)) {
        return {
          success: false,
          error: `Plugin directory not found: ${safeInstallPath}`,
        };
      }

      // Read manifest
      const manifestPath = safePluginJoin(app, safeInstallPath, 'plugin.json', 'plugin manifest');
      if (!fs.existsSync(manifestPath)) {
        return {
          success: false,
          error: `Plugin manifest not found: ${manifestPath}`,
        };
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      // List all files in plugin directory
      const files = fs.readdirSync(safeInstallPath);

      // Read index.js if exists
      let indexContent = null;
      const indexPath = safePluginJoin(app, safeInstallPath, 'index.js', 'plugin index');
      if (fs.existsSync(indexPath)) {
        indexContent = fs.readFileSync(indexPath, 'utf8');
      }

      console.log(`[Main] Loaded plugin ${safePluginId} with ${files.length} files`);

      return {
        success: true,
        pluginId: safePluginId,
        manifest,
        files,
        indexContent,
        installPath: safeInstallPath,
      };
    } catch (error) {
      console.error(`[Main] Failed to load plugin ${safePluginId}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  /**
   * Delete plugin files from disk (for uninstallation)
   */
  ipcMain.handle('delete-plugin-files', async (event, options) => {
    const { pluginId, installPath } = options;
    const safePluginId = sanitizePluginId(pluginId);
    const safeInstallPath = assertPluginPath(app, installPath, 'plugin install path');

    console.log(`[Main] Deleting plugin ${safePluginId} from ${safeInstallPath}`);

    try {
      // Check if plugin directory exists
      if (!fs.existsSync(safeInstallPath)) {
        console.log(`[Main] Plugin directory doesn't exist, nothing to delete: ${safeInstallPath}`);
        return {
          success: true,
          message: 'Plugin directory already deleted',
        };
      }

      // Recursively delete the plugin directory
      const deleteRecursive = dirPath => {
        if (fs.existsSync(dirPath)) {
          fs.readdirSync(dirPath).forEach(file => {
            const curPath = path.join(dirPath, file);
            if (fs.lstatSync(curPath).isDirectory()) {
              deleteRecursive(curPath);
            } else {
              fs.unlinkSync(curPath);
            }
          });
          fs.rmdirSync(dirPath);
        }
      };

      deleteRecursive(safeInstallPath);

      console.log(`[Main] Deleted plugin directory: ${safeInstallPath}`);

      return {
        success: true,
        pluginId: safePluginId,
        deletedPath: safeInstallPath,
      };
    } catch (error) {
      console.error(`[Main] Failed to delete plugin ${safePluginId}:`, error);
      return {
        success: false,
        error: error.message,
      };
    }
  });

  // =====================================================================
  // 3. File Read/Write IPC Handlers
  // =====================================================================

  // IPC handlers
  ipcMain.handle('read-file', async (event, filePath) => {
    try {
      const safeFilePath = assertAllowedFileAccess(app, filePath, {
        operation: 'read file',
        mustExist: true,
      });
      // Check file size first
      const stats = fs.statSync(safeFilePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      const extension = path.extname(safeFilePath).toLowerCase();

      // For BAM files, don't try to read as text
      if (extension === '.bam') {
        return {
          success: false,
          error: 'BAM files are binary format and should be handled by specialized BAM reader.',
          isBamFile: true,
          fileSize: stats.size,
        };
      }

      // For files larger than 500MB, refuse to read entirely into memory
      // JavaScript has a string length limit of ~512MB
      if (fileSizeMB > 500) {
        return {
          success: false,
          error: `File is too large (${fileSizeMB.toFixed(1)} MB) to read into memory. Use streaming mode instead.`,
          requiresStreaming: true,
          fileSize: stats.size,
        };
      }

      // For files larger than 100MB, warn but allow
      if (fileSizeMB > 100) {
        console.warn(`Reading large file into memory: ${fileSizeMB.toFixed(1)} MB`);
      }

      // Check if this is a gzip compressed file
      const isGzipped = extension === '.gz';

      if (isGzipped) {
        // For gzipped files, we need to decompress them
        // Use async decompression to avoid blocking the main process
        const zlib = require('zlib');
        const { promisify } = require('util');
        const gunzip = promisify(zlib.gunzip);

        const compressedData = fs.readFileSync(safeFilePath);
        const decompressedData = await gunzip(compressedData);
        const data = decompressedData.toString('utf8');
        return { success: true, data, isGzipped: true };
      } else {
        const data = fs.readFileSync(safeFilePath, 'utf8');
        return { success: true, data };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Handle save dialog requests
  ipcMain.handle('show-save-dialog', async (event, options) => {
    try {
      const parentWindow = workspaceHostManager.getNativeWindow(getMainGenomeTarget());
      const result = await dialog.showSaveDialog(parentWindow, options);
      return rememberApprovedDialogPaths(result, {
        source: 'user-save-dialog',
        capabilities: [FILE_CAPABILITIES.READ, FILE_CAPABILITIES.WRITE],
        operation: 'show-save-dialog',
      });
    } catch (error) {
      console.error('Error showing save dialog:', error);
      return { canceled: true, error: error.message };
    }
  });

  ipcMain.handle('show-open-file-dialog', async (event, options = {}) => {
    try {
      const ownerWindow =
        BrowserWindow.fromWebContents(event.sender) || workspaceHostManager.getNativeWindow(getMainGenomeTarget());
      const result = await dialog.showOpenDialog(ownerWindow, sanitizeOpenFileDialogOptions(options));

      if (result.canceled) {
        return { success: false, canceled: true, filePaths: [] };
      }

      rememberApprovedDialogPaths(result, {
        source: 'user-open-dialog',
        capabilities: [FILE_CAPABILITIES.READ, FILE_CAPABILITIES.WRITE],
        operation: 'show-open-file-dialog',
      });
      return {
        success: true,
        canceled: false,
        filePaths: result.filePaths,
      };
    } catch (error) {
      console.error('Error showing open file dialog:', error);
      return { success: false, canceled: false, filePaths: [], error: error.message };
    }
  });

  ipcMain.handle('screenshot:capture', async (event, options = {}) => {
    try {
      const format = sanitizeScreenshotFormat(options.format);
      const returnImageData = shouldReturnScreenshotImageData(options);
      const image = await createScreenshotImage(event, options);
      const buffer = getScreenshotBuffer(image, format, options.quality);
      const imageSize = image.getSize();
      const imageSizeBytes = buffer.length;
      const maxImageBytes = normalizeScreenshotMaxImageBytes(options);

      if (returnImageData && imageSizeBytes > maxImageBytes) {
        throw new Error(
          `Screenshot image is too large to return (${imageSizeBytes.toLocaleString()} bytes; maxImageBytes ${maxImageBytes.toLocaleString()}). ` +
            `Save to a file or increase maxImageBytes up to ${ABSOLUTE_SCREENSHOT_MAX_IMAGE_BYTES.toLocaleString()}.`
        );
      }

      let copiedToClipboard = false;
      if (options.copyToClipboard || options.copy_to_clipboard) {
        clipboard.writeImage(image);
        copiedToClipboard = true;
      }

      let filePath = null;
      let fileSize = 0;
      const savePath = await resolveScreenshotSavePath(event, options, format);
      if (savePath) {
        const safeFilePath = resolveIpcFileAccess(savePath, {
          operation: 'write screenshot',
          aiInitiated: options.aiInitiated,
          ai_initiated: options.ai_initiated,
          source: options.source,
        });
        const directory = path.dirname(safeFilePath);
        await fs.promises.mkdir(directory, { recursive: true });
        await fs.promises.writeFile(safeFilePath, buffer);
        const stats = await fs.promises.stat(safeFilePath);
        filePath = safeFilePath;
        fileSize = stats.size;
      }

      let opened = false;
      if (
        filePath &&
        (options.autoOpen || options.auto_open || options.openAfterCapture || options.open_after_capture)
      ) {
        const openError = await shell.openPath(filePath);
        if (openError) {
          throw new Error(openError);
        }
        opened = true;
      }

      if (!filePath && !copiedToClipboard && !returnImageData) {
        return { success: false, canceled: true, error: 'Screenshot capture was canceled' };
      }

      return {
        success: true,
        filePath,
        fileName: filePath ? path.basename(filePath) : null,
        fileSize,
        format,
        mimeType: getScreenshotMimeType(format),
        width: imageSize.width,
        height: imageSize.height,
        imageSizeBytes,
        imageData: returnImageData ? buffer.toString('base64') : undefined,
        imageDataEncoding: returnImageData ? 'base64' : undefined,
        maxImageBytes: returnImageData ? maxImageBytes : undefined,
        copiedToClipboard,
        opened,
        target: options.target || 'full_application',
        mode: options.mode || null,
      };
    } catch (error) {
      console.error('Error capturing screenshot:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-image-file', async (event, options = {}) => {
    try {
      const requestedPath = getRequestedImagePath(options);
      if (!requestedPath) {
        throw new Error('Image file path is required');
      }

      const safeFilePath = resolveIpcFileAccess(String(requestedPath), {
        operation: 'open image',
        mustExist: true,
        aiInitiated: options.aiInitiated,
        ai_initiated: options.ai_initiated,
        source: options.source,
      });
      assertSupportedImagePath(safeFilePath);

      const openError = await shell.openPath(safeFilePath);
      if (openError) {
        throw new Error(openError);
      }

      return {
        success: true,
        filePath: safeFilePath,
        fileName: path.basename(safeFilePath),
      };
    } catch (error) {
      console.error('Error opening image file:', error);
      return { success: false, error: error.message };
    }
  });

  // Handle direct file write requests
  ipcMain.handle('write-file', async (event, filePath, content) => {
    try {
      const path = require('path');
      const safeFilePath = assertAllowedFileAccess(app, filePath, { operation: 'write file' });

      // Ensure directory exists
      const directory = path.dirname(safeFilePath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      // Write the file
      fs.writeFileSync(safeFilePath, content, 'utf8');

      // Verify file was written
      if (fs.existsSync(safeFilePath)) {
        const stats = fs.statSync(safeFilePath);
        console.log(`File written successfully: ${safeFilePath} (${stats.size} bytes)`);
        return {
          success: true,
          filePath: safeFilePath,
          fileName: path.basename(safeFilePath),
          fileSize: stats.size,
        };
      } else {
        throw new Error('File was not created successfully');
      }
    } catch (error) {
      console.error('Error writing file:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('approve-working-directory', async (event, directoryPath, options = {}) => {
    try {
      if (!directoryPath || typeof directoryPath !== 'string') {
        throw new Error('Working directory approval requires a valid directory path');
      }

      const resolvedPath = path.resolve(directoryPath);
      const rootPath = path.parse(resolvedPath).root;
      if (resolvedPath === rootPath) {
        throw new Error('Refusing to approve filesystem root as a working directory');
      }

      let created = false;
      const existingGrant =
        permissionBroker.findGrant(resolvedPath, { capability: FILE_CAPABILITIES.WRITE }) ||
        permissionBroker.findGrant(resolvedPath, { capability: FILE_CAPABILITIES.READ });
      let insideDefaultRoot = false;
      try {
        assertAllowedFileAccess(app, resolvedPath, {
          operation: 'approve working directory',
          allowApproved: false,
        });
        insideDefaultRoot = true;
      } catch (error) {
        insideDefaultRoot = false;
      }

      if (!insideDefaultRoot && !existingGrant) {
        throw new Error(
          `Working directory outside approved application directories requires prior user selection: ${resolvedPath}`
        );
      }

      if (!fs.existsSync(resolvedPath)) {
        if (!options.createIfMissing) {
          throw new Error(`Directory does not exist: ${resolvedPath}`);
        }

        const allowedCreatePath = assertAllowedFileAccess(app, resolvedPath, {
          operation: 'create working directory',
          allowApproved: true,
        });
        fs.mkdirSync(allowedCreatePath, { recursive: true });
        created = true;
      }

      const stats = fs.statSync(resolvedPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${resolvedPath}`);
      }

      try {
        fs.accessSync(resolvedPath, fs.constants.R_OK | fs.constants.W_OK);
      } catch (error) {
        throw new Error(`Working directory is not readable and writable: ${resolvedPath}`);
      }

      permissionBroker.grantPath(resolvedPath, {
        source: existingGrant?.source || (insideDefaultRoot ? 'app-default-root' : 'prior-user-approval'),
        reason: 'Working directory approved after path validation',
        capabilities: ALL_FILE_CAPABILITIES,
        recursive: true,
        operation: 'approve-working-directory',
      });
      return {
        success: true,
        path: resolvedPath,
        created,
        permissions: {
          readable: true,
          writable: true,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  });

  ipcMain.handle('bam-reader:initialize', async (event, filePath, options = {}) => {
    try {
      const safeFilePath = assertAllowedFileAccess(app, filePath, {
        operation: 'open BAM file',
        mustExist: true,
      });
      const safeOptions = { ...(options || {}) };

      if (safeOptions.indexPath) {
        safeOptions.indexPath = assertAllowedFileAccess(app, safeOptions.indexPath, {
          operation: 'open BAM index file',
          mustExist: true,
        });
      }

      const BamReader = getBamReaderClass();
      const reader = new BamReader();
      const result = await reader.initialize(safeFilePath, safeOptions);
      const readerId = crypto.randomUUID();
      const ownerWebContentsId = event.sender.id;

      bamReaders.set(readerId, {
        reader,
        ownerWebContentsId,
      });

      event.sender.once('destroyed', () => {
        for (const [storedReaderId, entry] of bamReaders.entries()) {
          if (entry.ownerWebContentsId === ownerWebContentsId) {
            entry.reader.reset();
            bamReaders.delete(storedReaderId);
          }
        }
      });

      const state = getBamReaderState(reader);
      return toIpcSafeValue({
        success: !!result?.success,
        readerId,
        state,
        header: state.header,
        references: state.references,
        totalReads: state.totalReads,
        fileSize: state.fileSize,
        hasIndex: state.hasIndex,
        indexType: state.indexType,
        indexPath: state.indexPath,
        indexSize: state.indexSize,
      });
    } catch (error) {
      console.error('Failed to initialize BAM reader:', error);
      throw new Error(`Failed to initialize BAM reader: ${error.message}`);
    }
  });

  ipcMain.handle('bam-reader:get-records-for-range', async (event, readerId, chromosome, start, end, settings = {}) => {
    try {
      const reader = getOwnedBamReader(event, readerId);
      const reads = await reader.getRecordsForRange(chromosome, start, end, settings);
      return toIpcSafeValue({
        reads: toIpcSafeValue(reads),
        state: getBamReaderState(reader),
      });
    } catch (error) {
      console.error('Failed to query BAM reader:', error);
      throw new Error(`Failed to query BAM reader: ${error.message}`);
    }
  });

  ipcMain.handle('bam-reader:destroy', async (event, readerId) => {
    try {
      const reader = getOwnedBamReader(event, readerId);
      reader.reset();
      bamReaders.delete(readerId);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('read-file-stream', async (event, filePath, chunkSize = 1024 * 1024) => {
    try {
      const safeFilePath = assertAllowedFileAccess(app, filePath, {
        operation: 'stream file',
        mustExist: true,
      });
      const stats = fs.statSync(safeFilePath);
      const fileSize = stats.size;
      let totalRead = 0;
      let buffer = '';
      let lineCount = 0;

      console.log(
        `Starting stream read of ${(fileSize / (1024 * 1024)).toFixed(1)} MB file: ${path.basename(safeFilePath)}`
      );

      return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(safeFilePath, {
          encoding: 'utf8',
          highWaterMark: chunkSize,
        });

        stream.on('data', chunk => {
          try {
            totalRead += Buffer.byteLength(chunk, 'utf8');
            buffer += chunk;

            // Process complete lines
            const lines = buffer.split('\n');
            buffer = lines.pop(); // Keep incomplete line in buffer

            // Send lines to renderer for processing
            if (lines.length > 0) {
              lineCount += lines.length;
              event.sender.send('file-lines-chunk', { lines, lineCount });
            }

            // Send progress update
            const progress = Math.round((totalRead / fileSize) * 100);
            event.sender.send('file-read-progress', { progress, totalRead, fileSize });

            // Log progress for very large files
            if (totalRead % (50 * 1024 * 1024) === 0) {
              // Every 50MB
              console.log(
                `Stream progress: ${(totalRead / (1024 * 1024)).toFixed(1)} MB / ${(fileSize / (1024 * 1024)).toFixed(1)} MB`
              );
            }
          } catch (chunkError) {
            console.error('Error processing chunk:', chunkError);
            stream.destroy();
            resolve({ success: false, error: `Error processing data chunk: ${chunkError.message}` });
          }
        });

        stream.on('end', () => {
          try {
            // Process any remaining data in buffer
            if (buffer.trim()) {
              lineCount += 1;
              event.sender.send('file-lines-chunk', { lines: [buffer], lineCount });
            }

            console.log(`Stream complete: ${lineCount} lines, ${(totalRead / (1024 * 1024)).toFixed(1)} MB`);

            // Signal completion
            event.sender.send('file-stream-complete', { totalLines: lineCount, totalBytes: totalRead });
            resolve({ success: true, totalLines: lineCount, size: totalRead });
          } catch (endError) {
            console.error('Error finalizing stream:', endError);
            resolve({ success: false, error: `Error finalizing stream: ${endError.message}` });
          }
        });

        stream.on('error', error => {
          console.error('Stream error:', error);
          resolve({ success: false, error: `File read error: ${error.message}` });
        });
      });
    } catch (error) {
      console.error('Error setting up stream:', error);
      return { success: false, error: `Failed to set up file stream: ${error.message}` };
    }
  });

  ipcMain.handle('get-file-info', async (event, filePath) => {
    try {
      const safeFilePath = assertAllowedFileAccess(app, filePath, {
        operation: 'inspect file',
        mustExist: true,
      });
      const stats = fs.statSync(safeFilePath);
      return {
        success: true,
        info: {
          size: stats.size,
          modified: stats.mtime,
          name: path.basename(safeFilePath),
          extension: path.extname(safeFilePath),
          isDirectory: stats.isDirectory(),
          isFile: stats.isFile(),
          path: safeFilePath,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('authorize-file-load', async (event, filePath, toolName) => {
    try {
      if (!FILE_LOAD_TOOLS.has(toolName)) {
        throw new Error(`Unsupported file-loading tool: ${toolName || 'unknown'}`);
      }

      const safeFilePath = grantReadOnlyFileLoadPath(filePath, {
        source: 'ai-file-load-tool',
        reason: `Explicit read-only file load requested by ${toolName}`,
        operation: toolName,
      });

      return { success: true, filePath: safeFilePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('get-app-paths', async () => {
    const safeGetPath = name => {
      try {
        return app.getPath(name);
      } catch (error) {
        return '';
      }
    };

    return {
      success: true,
      paths: {
        appPath: app.getAppPath(),
        userData: safeGetPath('userData'),
        temp: safeGetPath('temp'),
        downloads: safeGetPath('downloads'),
        documents: safeGetPath('documents'),
      },
    };
  });

  ipcMain.handle('get-locale-data', async (event, language, namespace) => {
    try {
      return {
        success: true,
        ...readLocaleNamespace(language, namespace),
      };
    } catch (error) {
      return { success: false, error: error.message, language: sanitizeLocaleCode(language), namespace, data: {} };
    }
  });

  ipcMain.handle('get-locale-languages', async () => {
    try {
      const localeRoot = getLocalesRoot();
      const languages = fs
        .readdirSync(localeRoot, { withFileTypes: true })
        .filter(entry => entry.isDirectory() && LOCALE_CODE_PATTERN.test(entry.name))
        .map(entry => entry.name);
      return { success: true, languages };
    } catch (error) {
      return { success: false, error: error.message, languages: ['en'] };
    }
  });

  // i18n handlers are registered by i18n-main.js setupIPC() — do not duplicate here

  ipcMain.handle('get-sanitizer-config', async () => ({
    success: true,
    allowDataAttributes: true,
    allowAriaAttributes: true,
  }));

  ipcMain.handle('config:load', async () => {
    try {
      const dir = getConfigStorageDir();
      const paths = getConfigStoragePaths();
      const config = {};
      for (const [section, filePath] of Object.entries(paths)) {
        const data = readConfigFileIfPresent(filePath);
        if (data !== null) {
          // Decrypt any safeStorage-encrypted secret fields back to plaintext so
          // the renderer continues to work with plaintext keys in memory.
          config[section] = decryptSecretsInPlace(data);
        }
      }

      return {
        success: true,
        config,
        configPath: {
          dir,
          ...paths,
        },
      };
    } catch (error) {
      return { success: false, error: error.message, config: {} };
    }
  });

  ipcMain.handle('config:save', async (event, config = {}) => {
    try {
      const dir = getConfigStorageDir();
      const paths = getConfigStoragePaths();
      fs.mkdirSync(dir, { recursive: true });

      writeJsonFile(paths.main, {
        version: config.version || VERSION_INFO.fullVersion,
        lastModified: new Date().toISOString(),
      });

      for (const [section, filePath] of Object.entries(paths)) {
        if (section === 'main') continue;
        if (config[section] !== undefined) {
          // Encrypt secret fields (API keys) at rest via the OS keychain before
          // writing. The incoming config is an IPC structured-clone copy, so
          // mutating it here does not affect the renderer's in-memory state.
          writeJsonFile(filePath, encryptSecretsInPlace(config[section]));
        }
      }

      return {
        success: true,
        configPath: {
          dir,
          ...paths,
        },
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // =====================================================================
  // 4. Gene Attachments IPC Handlers
  // =====================================================================

  /**
   * Open file selection dialog for gene attachments
   */
  ipcMain.handle('select-attachment-files', async (event, options = {}) => {
    try {
      const { dialog } = require('electron');

      const result = await dialog.showOpenDialog(null, {
        title: options.title || 'Select Attachment Files',
        filters: options.filters || [
          {
            name: 'All Supported Files',
            extensions: [
              'pdf',
              'md',
              'txt',
              'png',
              'jpg',
              'jpeg',
              'gif',
              'svg',
              'doc',
              'docx',
              'xls',
              'xlsx',
              'csv',
              'json',
              'html',
            ],
          },
          { name: 'Documents', extensions: ['pdf', 'doc', 'docx', 'txt', 'md'] },
          { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'svg'] },
          { name: 'Data Files', extensions: ['csv', 'json', 'xls', 'xlsx'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: options.properties || ['openFile', 'multiSelections'],
      });

      if (result.canceled) {
        return { success: false, canceled: true };
      }
      rememberApprovedDialogPaths(result, {
        source: 'user-attachment-dialog',
        operation: 'select-attachment-files',
      });

      return {
        success: true,
        filePaths: result.filePaths,
        fileCount: result.filePaths.length,
      };
    } catch (error) {
      console.error('Error selecting attachment files:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Copy a file to the attachments storage location
   */
  ipcMain.handle('copy-attachment-file', async (event, sourcePath, targetDir, filename) => {
    try {
      const safeSourcePath = assertAllowedFileAccess(app, sourcePath, {
        operation: 'copy attachment source',
        mustExist: true,
      });
      const safeTargetDir = assertAllowedFileAccess(app, targetDir, { operation: 'copy attachment target' });
      // Validate source file exists
      if (!fs.existsSync(safeSourcePath)) {
        return { success: false, error: 'Source file does not exist' };
      }

      // Ensure target directory exists
      if (!fs.existsSync(safeTargetDir)) {
        fs.mkdirSync(safeTargetDir, { recursive: true });
      }

      // Determine target path
      const targetFilename = path.basename(filename || path.basename(safeSourcePath));
      const targetPath = assertAllowedFileAccess(app, path.join(safeTargetDir, targetFilename), {
        operation: 'copy attachment target file',
      });

      // Copy file
      fs.copyFileSync(safeSourcePath, targetPath);

      // Get file info
      const stats = fs.statSync(targetPath);

      console.log(`Attachment copied: ${safeSourcePath} -> ${targetPath}`);

      return {
        success: true,
        targetPath: targetPath,
        filename: targetFilename,
        size: stats.size,
      };
    } catch (error) {
      console.error('Error copying attachment file:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Delete an attachment file
   */
  ipcMain.handle('delete-attachment-file', async (event, filePath) => {
    try {
      if (!filePath) {
        return { success: false, error: 'File path is required' };
      }
      const safeFilePath = assertAllowedFileAccess(app, filePath, { operation: 'delete attachment' });

      if (!fs.existsSync(safeFilePath)) {
        console.log(`Attachment file does not exist, skipping deletion: ${safeFilePath}`);
        return { success: true, message: 'File does not exist' };
      }

      fs.unlinkSync(safeFilePath);
      console.log(`Attachment deleted: ${safeFilePath}`);

      return { success: true, message: 'Attachment deleted successfully' };
    } catch (error) {
      console.error('Error deleting attachment file:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Open an attachment file in the system's default application
   */
  ipcMain.handle('open-attachment-file', async (event, filePath) => {
    try {
      if (!filePath) {
        return { success: false, error: 'File path is required' };
      }
      const safeFilePath = assertAllowedFileAccess(app, filePath, {
        operation: 'open attachment',
        mustExist: true,
      });

      if (!fs.existsSync(safeFilePath)) {
        return { success: false, error: 'File does not exist' };
      }

      const { shell } = require('electron');
      await shell.openPath(safeFilePath);

      console.log(`Opened attachment: ${safeFilePath}`);
      return { success: true };
    } catch (error) {
      console.error('Error opening attachment file:', error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Get the base storage path for gene attachments
   */
  ipcMain.handle('get-attachments-storage-path', async event => {
    try {
      // Use app's user data directory for attachments storage
      const userDataPath = app.getPath('userData');
      const attachmentsPath = path.join(userDataPath, 'gene_attachments');

      // Ensure directory exists
      if (!fs.existsSync(attachmentsPath)) {
        fs.mkdirSync(attachmentsPath, { recursive: true });
      }

      return {
        success: true,
        path: attachmentsPath,
      };
    } catch (error) {
      console.error('Error getting attachments storage path:', error);
      return { success: false, error: error.message };
    }
  });

  // =====================================================================
  // 5. Utility Tools IPC Handlers
  // =====================================================================

  /**
   * Download a file from the internet to a local path
   */
  ipcMain.handle('download-internet-file', async (event, options) => {
    const { url, destinationPath, filename } = options;

    try {
      console.log(`[Download] Starting download from: ${url}`);

      // Validate URL
      if (!url || typeof url !== 'string') {
        return { success: false, error: 'Invalid URL provided' };
      }

      // Parse URL to get protocol and filename
      const urlObj = new URL(url);
      if (!['http:', 'https:'].includes(urlObj.protocol)) {
        return { success: false, error: 'Only HTTP and HTTPS downloads are allowed' };
      }
      const protocol = urlObj.protocol === 'https:' ? require('https') : require('http');

      // Determine filename from URL if not provided
      const extractedFilename = path.basename(filename || path.basename(urlObj.pathname) || 'downloaded_file');

      // Determine destination directory
      let destDir = destinationPath;
      if (!destDir) {
        // Default to Downloads folder in user's home directory
        destDir = path.join(app.getPath('downloads'));
      }

      const safeDestDir = assertAllowedFileAccess(app, destDir, { operation: 'download destination' });
      const fullPath = assertAllowedFileAccess(app, path.join(safeDestDir, extractedFilename), {
        operation: 'download target',
      });

      // Ensure destination directory exists after validation
      if (!fs.existsSync(safeDestDir)) {
        fs.mkdirSync(safeDestDir, { recursive: true });
      }

      return new Promise(resolve => {
        const file = fs.createWriteStream(fullPath);

        const request = protocol.get(url, response => {
          // Handle redirects
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            console.log(`[Download] Following redirect to: ${response.headers.location}`);
            file.close();
            fs.unlinkSync(fullPath);
            resolve({
              success: false,
              error: 'Redirected downloads must be retried with the final HTTPS URL',
              redirectUrl: response.headers.location,
            });
            return;
          }

          if (response.statusCode !== 200) {
            file.close();
            fs.unlinkSync(fullPath);
            resolve({
              success: false,
              error: `HTTP Error: ${response.statusCode} ${response.statusMessage}`,
            });
            return;
          }

          const contentLength = parseInt(response.headers['content-length'], 10);
          let downloadedBytes = 0;

          response.on('data', chunk => {
            downloadedBytes += chunk.length;
            if (contentLength) {
              const progress = Math.round((downloadedBytes / contentLength) * 100);
              // Send progress to renderer if needed
              event.sender.send('download-progress', {
                url,
                progress,
                downloadedBytes,
                totalBytes: contentLength,
              });
            }
          });

          response.pipe(file);

          file.on('finish', () => {
            file.close();
            const stats = fs.statSync(fullPath);
            console.log(`[Download] Completed: ${fullPath} (${stats.size} bytes)`);
            resolve({
              success: true,
              filePath: fullPath,
              filename: extractedFilename,
              fileSize: stats.size,
              url: url,
            });
          });
        });

        request.on('error', error => {
          file.close();
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
          console.error(`[Download] Error:`, error);
          resolve({ success: false, error: error.message });
        });

        request.setTimeout(60000, () => {
          request.destroy();
          file.close();
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
          resolve({ success: false, error: 'Download timeout (60 seconds)' });
        });
      });
    } catch (error) {
      console.error(`[Download] Error:`, error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Open a markdown file in a dedicated viewer window
   */
  ipcMain.handle('open-markdown-viewer', async (event, options) => {
    const { filePath, title } = options;

    try {
      const safeFilePath = assertAllowedFileAccess(app, filePath, {
        operation: 'open markdown viewer',
        mustExist: true,
        allowedRoots: [app.getAppPath(), ...getDefaultWritableRoots(app)],
      });
      console.log(`[Markdown Viewer] Opening: ${safeFilePath}`);

      // Validate file path
      if (!safeFilePath || typeof safeFilePath !== 'string') {
        return { success: false, error: 'Invalid file path provided' };
      }

      // Check if file exists
      if (!fs.existsSync(safeFilePath)) {
        return { success: false, error: `File not found: ${safeFilePath}` };
      }

      // Check file extension
      const ext = path.extname(safeFilePath).toLowerCase();
      if (ext !== '.md' && ext !== '.markdown') {
        console.warn(`[Markdown Viewer] File is not a markdown file: ${ext}`);
      }

      // Read the file content
      const content = fs.readFileSync(safeFilePath, 'utf8');
      const fileName = path.basename(safeFilePath);
      const windowTitle = title || `${fileName} - Markdown Viewer`;

      // Create viewer window
      const viewerWindow = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: createSecureWebPreferences(),
        title: windowTitle,
        icon: path.join(__dirname, '..', 'assets', 'icon.png'),
        resizable: true,
        minimizable: true,
        maximizable: true,
        show: false,
      });

      // Load markdown viewer HTML
      const viewerPath = path.join(__dirname, 'markdown-viewer.html');

      if (fs.existsSync(viewerPath)) {
        viewerWindow.loadFile(viewerPath);
      } else {
        // Create inline HTML if viewer file doesn't exist
        const inlineHTML = createMarkdownViewerHTML(content, windowTitle);
        viewerWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(inlineHTML)}`);
      }

      // Send markdown content once window is ready
      viewerWindow.webContents.on('did-finish-load', () => {
        viewerWindow.webContents.send('load-markdown', {
          content: content,
          filePath: safeFilePath,
          fileName: fileName,
          title: windowTitle,
        });
      });

      viewerWindow.once('ready-to-show', () => {
        viewerWindow.show();
      });

      console.log(`[Markdown Viewer] Window opened for: ${fileName}`);

      return {
        success: true,
        filePath: filePath,
        fileName: fileName,
        windowTitle: windowTitle,
      };
    } catch (error) {
      console.error(`[Markdown Viewer] Error:`, error);
      return { success: false, error: error.message };
    }
  });

  /**
   * Helper function to create inline markdown viewer HTML
   */
  function createMarkdownViewerHTML(content, title) {
    // Escape content for embedding in HTML
    const escapedContent = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    :root {
      --primary-color: #3b82f6;
      --primary-hover: #2563eb;
      --primary-rgb: 59, 130, 246;
      --bg-primary: #ffffff;
      --bg-secondary: #f8fafc;
      --bg-tertiary: #f1f5f9;
      --text-primary: #1f2937;
      --text-secondary: #6b7280;
      --text-muted: #9ca3af;
      --border-color: #e5e7eb;
      --border-hover: #d1d5db;
      --header-gradient: linear-gradient(135deg, #2c3e50 0%, #3498db 50%, #667eea 80%);
      --focus-ring: rgba(59, 130, 246, 0.3);
      --selection-bg: #3b82f6;
      --shadow-md: 0 8px 24px rgba(15, 23, 42, 0.08);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background-color: var(--bg-secondary);
      color: var(--text-primary);
      line-height: 1.6;
      padding: 68px 40px 40px;
      max-width: 900px;
      margin: 0 auto;
      min-height: 100vh;
      box-shadow: var(--shadow-md);
    }
    ::selection { background: var(--selection-bg); color: white; }
    h1, h2, h3, h4, h5, h6 { color: var(--text-primary); margin: 1.5em 0 0.5em; }
    h1 { font-size: 2em; border-bottom: 2px solid var(--primary-color); padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
    a { color: var(--primary-color); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      background-color: var(--bg-tertiary);
      padding: 0.2em 0.4em;
      border-radius: 4px;
      font-family: 'Fira Code', 'Consolas', monospace;
    }
    pre {
      background-color: var(--bg-secondary);
      padding: 16px;
      border: 1px solid var(--border-color);
      border-radius: 8px;
      overflow-x: auto;
      margin: 1em 0;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 4px solid var(--primary-color);
      padding-left: 16px;
      margin: 1em 0;
      color: var(--text-secondary);
      background: rgba(var(--primary-rgb), 0.08);
    }
    ul, ol { padding-left: 2em; margin: 1em 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid var(--border-color); padding: 8px 12px; text-align: left; }
    th { background-color: var(--bg-tertiary); }
    img { max-width: 100%; height: auto; }
    hr { border: none; border-top: 1px solid var(--border-color); margin: 2em 0; }
    #content { padding-bottom: 40px; }
    .toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: var(--header-gradient);
      padding: 12px 20px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.18);
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 100;
    }
    .toolbar-title { font-weight: 500; color: white; }
  </style>
</head>
<body>
  <div class="toolbar">
    <span class="toolbar-title">${title}</span>
  </div>
  <div id="content"></div>
  <script>
    const rawContent = "${escapedContent.replace(/\n/g, '\\n').replace(/\r/g, '')}";
    const decodedContent = rawContent
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&amp;/g, '&');
    
    if (typeof marked !== 'undefined') {
      document.getElementById('content').innerHTML = marked.parse(decodedContent);
    } else {
      document.getElementById('content').innerHTML = '<pre>' + decodedContent + '</pre>';
    }
  </script>
</body>
</html>`;
  }

  // Handle directory selection for benchmark default directory
  ipcMain.handle('show-directory-dialog', async (event, options = {}) => {
    try {
      const { dialog } = require('electron');
      const result = await dialog.showOpenDialog(null, {
        properties: ['openDirectory'],
        title: options.title || 'Select Directory',
        defaultPath: options.defaultPath || undefined,
      });

      if (!result.canceled && result.filePaths.length > 0) {
        rememberApprovedDialogPaths(result, {
          source: 'user-load-file-dialog',
          operation: 'select-and-load-file',
        });
        return {
          success: true,
          canceled: false,
          filePaths: result.filePaths,
        };
      }

      return {
        success: true,
        canceled: true,
        filePaths: [],
      };
    } catch (error) {
      console.error('Error in show-directory-dialog:', error);
      return {
        success: false,
        error: error.message,
        canceled: true,
        filePaths: [],
      };
    }
  });

  // =====================================================================
  // 6. MCP Server IPC Handlers
  // =====================================================================

  // Listen for MCP server status changes and update menu
  ipcMain.on('mcp-server-status-changed', () => {
    updateMCPServerMenu();
  });

  // Add Unified MCP Server IPC handlers
  ipcMain.handle('dgr-mcp-request', async (event, request) => {
    if (!isRegisteredGenomeSender(event)) {
      throw new Error('Deep Gene Research MCP requests are limited to registered genome windows');
    }
    return proxyDgrMcpRequest(request);
  });

  ipcMain.handle('archive-dgr-task-result', async (event, options = {}) => {
    if (!isRegisteredGenomeSender(event)) {
      throw new Error('DGR report archival is limited to registered genome windows');
    }
    const artifact = await archiveDgrTaskResult({
      userDataPath: app.getPath('userData'),
      taskId: options.taskId,
      target: options.target,
      correlationId: options.correlationId,
      currentAnnotation: options.currentAnnotation,
      requireCurrentAnnotation: options.requireCurrentAnnotation === true,
      proxyRequest: proxyDgrMcpRequest,
    });
    return { success: true, artifact };
  });

  ipcMain.handle('open-dgr-json-viewer', async (event, options = {}) => {
    if (!isRegisteredGenomeSender(event)) {
      throw new Error('The DGR JSON viewer is limited to registered genome windows');
    }
    const artifact = await readDgrArtifact({
      userDataPath: app.getPath('userData'),
      storedPath: options.storedPath,
      expectedSha256: options.expectedSha256,
    });
    const requestedTitle = typeof options.title === 'string' ? options.title.trim().slice(0, 256) : '';
    const viewerWindow = new BrowserWindow({
      width: 1100,
      height: 780,
      minWidth: 720,
      minHeight: 500,
      title: requestedTitle || `${artifact.fileName} - DGR JSON Viewer`,
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      resizable: true,
      minimizable: true,
      maximizable: true,
      show: false,
      webPreferences: createSecureWebPreferences({
        preload: path.join(__dirname, '..', 'json-viewer-preload.js'),
      }),
    });
    viewerWindow.setMenuBarVisibility(false);
    viewerWindow.webContents.once('did-finish-load', () => {
      if (!viewerWindow.isDestroyed()) {
        viewerWindow.webContents.send('json-viewer:data', {
          content: artifact.content,
          fileName: artifact.fileName,
          sha256: artifact.sha256,
          size: artifact.size,
          title: requestedTitle || artifact.fileName,
        });
        artifact.content = '';
      }
    });
    viewerWindow.once('ready-to-show', () => viewerWindow.show());
    await viewerWindow.loadFile(path.join(__dirname, '..', 'json-viewer.html'));
    return { success: true };
  });

  ipcMain.handle('mcp-server-start', async () => {
    const settings = loadMCPServerSettings();
    const result = await startUnifiedMCPServer();
    return {
      ...result,
      message:
        result.message ||
        (result.success ? 'Unified Claude MCP Server started successfully' : 'Failed to start MCP server'),
      serverType: result.success ? 'unified-claude-mcp' : undefined,
      httpPort: result.success ? settings.httpPort : undefined,
      wsPort: result.success ? settings.wsPort : undefined,
    };
  });

  ipcMain.handle('mcp-server-stop', async () => {
    const result = await stopUnifiedMCPServer();
    return {
      ...result,
      message:
        result.message ||
        (result.success ? 'Unified Claude MCP Server stopped successfully' : 'Failed to stop MCP server'),
      serverType: 'unified-claude-mcp',
    };
  });

  ipcMain.handle('mcp-server-status', async () => {
    const settings = loadMCPServerSettings();
    const status = getUnifiedServerStatus();
    const server = getUnifiedMCPServer();
    // Return Unified Claude MCP Server status
    return {
      status: status,
      isRunning: status === 'running',
      serverType: status === 'running' ? 'unified-claude-mcp' : 'none',
      httpPort: status === 'running' ? settings.httpPort : null,
      wsPort: status === 'running' ? settings.wsPort : null,
      connectedClients: server ? server.getConnectedClientsCount() : 0,
    };
  });

  // MCP Server Settings IPC handlers
  ipcMain.handle('mcp-server-get-settings', async () => {
    return loadMCPServerSettings();
  });

  ipcMain.handle('mcp-server-save-settings', async (event, settings) => {
    const httpPort = parseInt(settings.httpPort, 10);
    const wsPort = parseInt(settings.wsPort, 10);
    if (isNaN(httpPort) || httpPort < 1024 || httpPort > 65535) {
      return { success: false, error: 'HTTP port must be between 1024 and 65535' };
    }
    if (isNaN(wsPort) || wsPort < 1024 || wsPort > 65535) {
      return { success: false, error: 'WebSocket port must be between 1024 and 65535' };
    }
    if (httpPort === wsPort) {
      return { success: false, error: 'HTTP and WebSocket ports must be different' };
    }
    saveMCPServerSettings({ httpPort, wsPort });
    return { success: true };
  });

  ipcMain.handle('mcp-server-check-port', async (event, port) => {
    return checkPortAvailable(parseInt(port, 10));
  });

  // =====================================================================
  // 7. Multi-window Genome Support IPC Handlers
  // =====================================================================

  // Multi-window genome support: IPC handlers for window registry
  ipcMain.handle('list-genome-windows', async () => {
    // Filter out destroyed windows and map to result format
    const result = Array.from(windowRegistry.entries())
      .filter(([id, info]) => info.window && !info.window.isDestroyed())
      .map(([id, info]) => ({
        windowId: id,
        genomeName: info.genomeName || null,
        isFocused: info.window.isFocused(),
        isVisible: info.window.isVisible(),
        isDestroyed: false,
        status: info.status,
        createdAt: info.createdAt ? info.createdAt.toISOString() : null,
        lastUpdate: info.lastUpdate ? info.lastUpdate.toISOString() : null,
      }));

    // Only log in debug mode or when windows count changes significantly
    if (process.env.DEBUG_MCP || result.length !== windowRegistry.size) {
      console.log(`[IPC] list-genome-windows: ${result.length} active windows`);
    }

    return result;
  });

  // Get comprehensive window registry status for diagnostics
  ipcMain.handle('get-window-registry-status', async () => {
    const status = getWindowRegistryStatus();
    console.log(
      `[IPC] Window registry status: ${status.valid} valid, ${status.destroyed} destroyed, ${status.pending} pending`
    );
    return status;
  });

  // Sync all windows with MCP server
  ipcMain.handle('sync-mcp-windows', async () => {
    const result = syncWindowsWithMCPServer();
    return { success: true, ...result };
  });

  // Focus a specific genome window by windowId (used by ChatBox AI agent)
  ipcMain.handle('focus-genome-window', async (event, windowId) => {
    const entry = windowRegistry.get(windowId);
    if (!entry) {
      const available = Array.from(windowRegistry.keys());
      return {
        success: false,
        error: `Window '${windowId}' not found. Available windows: [${available.join(', ')}]`,
      };
    }

    const win = entry.window;
    if (!win || win.isDestroyed()) {
      return { success: false, error: `Window '${windowId}' is destroyed` };
    }

    if (typeof switchToWindowTab === 'function') {
      const result = switchToWindowTab(windowId);
      if (result?.success) {
        return {
          success: true,
          message: `Focused window '${windowId}'`,
          windowId,
          genomeName: entry.genomeName || null,
        };
      }
    }

    win.show();
    win.focus();
    return {
      success: true,
      message: `Focused window '${windowId}'`,
      windowId,
      genomeName: entry.genomeName || null,
    };
  });

  // Renderer calls this when a genome file is loaded to update the registry
  ipcMain.on('update-window-genome-name', (event, { windowId, genomeName }) => {
    const entry = windowRegistry.get(windowId);
    if (entry) {
      entry.genomeName = genomeName;
      entry.lastUpdate = new Date();
      entry.status = 'genome-loaded';
      console.log(`[WindowRegistry] Updated genome name for ${windowId}: ${genomeName} (status: ${entry.status})`);
      if (typeof notifyWindowGenomeNameChanged === 'function') {
        notifyWindowGenomeNameChanged(windowId);
      }
    } else {
      console.warn(`[WindowRegistry] Window ${windowId} not found when updating genome name`);
    }
  });

  // Get the windowId for the sender window
  ipcMain.handle('get-window-id', async event => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);

    // First resolve embedded genome WebContentsView instances by their own webContents.
    for (const [windowId, info] of windowRegistry.entries()) {
      if (info.window && !info.window.isDestroyed() && info.window.webContents === event.sender) {
        console.log(`[IPC] get-window-id: found ${windowId} via registry fallback`);
        return windowId;
      }
    }

    if (senderWindow?.windowId) {
      return senderWindow.windowId;
    }

    const activeViewId = senderWindow ? workspaceHostManager.getActiveWindowIdForHost(senderWindow) : null;
    if (activeViewId) {
      return activeViewId;
    }

    // Last resort: try to find by window ID stored on webContents
    const allWindows = BrowserWindow.getAllWindows();
    for (const win of allWindows) {
      if (!win.isDestroyed() && win.webContents === event.sender && win.windowId) {
        console.log(`[IPC] get-window-id: found ${win.windowId} via BrowserWindow.getAllWindows()`);
        return win.windowId;
      }
    }

    if (!senderWindow) {
      console.warn(`[IPC] get-window-id: sender window not found`);
      return null;
    }

    console.warn(`[IPC] get-window-id: window not found in registry (${windowRegistry.size} windows registered)`);
    return null;
  });

  // =====================================================================
  // 8. Resource Manager IPC Handlers
  // =====================================================================

  // Handle opening resource manager
  ipcMain.on('open-resource-manager', event => {
    try {
      // Create new window for the resource manager
      const resourceManagerWindow = new BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: createSecureWebPreferences(),
        title: 'Resource Manager - CodeXomics',
        icon: path.join(__dirname, '..', 'assets', 'icon.png'),
        resizable: true,
        minimizable: true,
        maximizable: true,
        show: false,
      });

      // Load the resource manager HTML
      const resourceManagerPath = path.join(__dirname, 'resource-manager.html');

      // Check if file exists, if not create a fallback
      if (fs.existsSync(resourceManagerPath)) {
        resourceManagerWindow.loadFile(resourceManagerPath);
      } else {
        console.log('Resource manager file not found, creating...');
        // We'll create the file below
        resourceManagerWindow.loadFile(resourceManagerPath);
      }

      // Show window when ready
      resourceManagerWindow.once('ready-to-show', () => {
        resourceManagerWindow.show();
      });

      // Handle window closed
      resourceManagerWindow.on('closed', () => {
        console.log('Resource Manager window closed');
      });
    } catch (error) {
      console.error('Failed to open Resource Manager:', error);
    }
  });

  // Resource Manager IPC handlers
  ipcMain.handle('get-loaded-resources', async () => {
    try {
      // In a real implementation, this would collect data from the main window
      // For now, return mock data that matches the expected format
      const mockResources = [
        {
          id: 'genome1',
          type: 'fasta',
          name: 'E.coli_K12.fasta',
          path: '/Users/example/data/E.coli_K12.fasta',
          size: 4641652,
          loadedAt: new Date().toISOString(),
          status: 'loaded',
          chromosomes: ['NC_000913.3'],
          sequences: 1,
          metadata: {
            organism: 'Escherichia coli K-12',
            version: 'RefSeq',
            source: 'NCBI',
          },
        },
      ];

      return { success: true, resources: mockResources };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('refresh-resources', async () => {
    try {
      // Send refresh request to main window and collect current state
      const targetWindow = getMainGenomeTarget();
      if (targetWindow) {
        targetWindow.webContents.send('collect-resource-info');
      }
      return { success: true, message: 'Resources refreshed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('remove-resource', async (event, resourceId) => {
    try {
      // In a real implementation, this would communicate with the main window
      // to remove the resource
      console.log('Removing resource:', resourceId);
      return { success: true, message: 'Resource removed' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('export-resource', async (event, resourceId, options) => {
    try {
      // Implementation would show save dialog and export the resource
      console.log('Exporting resource:', resourceId, options);
      return { success: true, message: 'Resource exported' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('open-resource-in-browser', async (event, resourceId) => {
    try {
      // Send message to main window to display the resource
      const targetWindow = getMainGenomeTarget();
      if (targetWindow) {
        targetWindow.webContents.send('open-resource', resourceId);
      }
      return { success: true, message: 'Resource opened in browser' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('select-and-load-file', async () => {
    try {
      const { dialog } = require('electron');
      const targetWindow = getMainGenomeTarget();
      const result = await dialog.showOpenDialog(workspaceHostManager.getNativeWindow(targetWindow), {
        properties: ['openFile'],
        filters: [
          {
            name: 'Genome Files',
            extensions: [
              'fasta',
              'fa',
              'fas',
              'fna',
              'gb',
              'gbk',
              'gbff',
              'genbank',
              'gff',
              'gff3',
              'gtf',
              'bed',
              'vcf',
              'bam',
              'sam',
              'wig',
              'bw',
              'bigwig',
              'fastq',
              'fq',
            ],
          },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        rememberApprovedDialogPaths(result);
        const filePath = result.filePaths[0];
        if (!targetWindow || targetWindow.isDestroyed()) {
          return { success: false, error: 'Main window not available' };
        }
        // Send to main window for loading
        targetWindow.webContents.send('load-file', filePath);
        return { success: true, filePath };
      }

      return { success: false, canceled: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('send-to-main-window', async (event, channel, data) => {
    try {
      const targetWindow = getMainGenomeTarget();
      if (targetWindow) {
        targetWindow.webContents.send(channel, data);
      }
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // =====================================================================
  // 9. Theme Sync IPC Handlers
  // =====================================================================

  // Theme sync: forward theme data from main renderer to Project Manager window
  ipcMain.handle('broadcast-theme-to-pm', async (event, themeData) => {
    try {
      let sent = false;

      // Forward to Project Manager window
      const pmWindow = BrowserWindow.getAllWindows().find(
        win => win.getTitle().includes('Project Manager') && !win.isDestroyed()
      );
      if (pmWindow) {
        pmWindow.webContents.send('sync-theme', themeData);
        sent = true;
      }

      // Also forward to MCP Server Manager window
      const mcpWindow = BrowserWindow.getAllWindows().find(
        win => win.getTitle().includes('MCP Server Manager') && !win.isDestroyed()
      );
      if (mcpWindow) {
        mcpWindow.webContents.send('sync-theme', themeData);
        sent = true;
      }

      // Also forward to Circos Genome Plotter window
      const circosWindow = BrowserWindow.getAllWindows().find(
        win => win.getTitle().includes('Circos Genome Plotter') && !win.isDestroyed()
      );
      if (circosWindow) {
        circosWindow.webContents.send('sync-theme', themeData);
        sent = true;
      }

      // Forward to BLAST+ Downloader window
      const blastDownloaderWindow = BrowserWindow.getAllWindows().find(
        win => win.getTitle().includes('BLAST+ Tools Downloader') && !win.isDestroyed()
      );
      if (blastDownloaderWindow) {
        blastDownloaderWindow.webContents.send('sync-theme', themeData);
        sent = true;
      }

      // Forward to BLAST Configuration window
      const blastConfigWindow = BrowserWindow.getAllWindows().find(
        win => win.getTitle().includes('Configure BLAST Tools') && !win.isDestroyed()
      );
      if (blastConfigWindow) {
        blastConfigWindow.webContents.send('sync-theme', themeData);
        sent = true;
      }

      // Forward to BLAST Installer window
      const blastInstallerWindow = BrowserWindow.getAllWindows().find(
        win => win.getTitle().includes('BLAST') && win.getTitle().includes('Installer') && !win.isDestroyed()
      );
      if (blastInstallerWindow) {
        blastInstallerWindow.webContents.send('sync-theme', themeData);
        sent = true;
      }

      // Forward to workspace host windows that render the window-level tab strip.
      for (const workspaceWindow of BrowserWindow.getAllWindows()) {
        if (workspaceWindow.__codexomicsWorkspaceId && !workspaceWindow.isDestroyed()) {
          workspaceWindow.webContents.send('sync-theme', themeData);
          sent = true;
        }
      }

      return { success: sent };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Theme sync: PM window requests current theme on load
  ipcMain.handle('request-current-theme', async () => {
    try {
      // Forward the request to main window, which has ThemeManager
      const targetWindow = getMainGenomeTarget();
      if (targetWindow && !targetWindow.isDestroyed()) {
        targetWindow.webContents.send('request-theme-for-pm');
        return { success: true };
      }
      return { success: false, error: 'Main window not found' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // =====================================================================
  // 10. Debug Tool IPC Handler
  // =====================================================================

  // Handle opening debug tools
  ipcMain.handle('openDebugTool', async (event, fileName) => {
    try {
      console.log('Opening debug tool:', fileName);

      // Create new window for debug tool
      const debugWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        minWidth: 800,
        minHeight: 600,
        webPreferences: createSecureWebPreferences(),
        title: `Debug Tool - ${fileName}`,
        icon: path.join(__dirname, '..', 'assets', 'icon.png'),
        show: false,
      });

      // Construct path to debug tool file
      const debugToolPath = path.join(__dirname, '..', fileName);

      // Check if file exists
      if (!fs.existsSync(debugToolPath)) {
        throw new Error(`Debug tool file not found: ${debugToolPath}`);
      }

      // Load the debug tool HTML
      debugWindow.loadFile(debugToolPath);

      // Show window when ready
      debugWindow.once('ready-to-show', () => {
        debugWindow.show();
        debugWindow.focus();
      });

      // Handle window closed
      debugWindow.on('closed', () => {
        console.log('Debug tool window closed:', fileName);
      });

      // Set parent window for proper window management
      const parentWindow = workspaceHostManager.getNativeWindow(getMainGenomeTarget());
      if (parentWindow && !parentWindow.isDestroyed()) {
        debugWindow.setParentWindow(parentWindow);
      }

      return { success: true, fileName };
    } catch (error) {
      console.error('Failed to open debug tool:', error);
      return { success: false, error: error.message };
    }
  });

  // =====================================================================
  // 11. Circos Plotter IPC Handlers
  // =====================================================================

  // Handle genome data requests from Circos Plotter
  ipcMain.handle('get-circos-genome-data', async () => {
    try {
      // Get main window data
      const mainWindow = getCurrentMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        const result = await mainWindow.webContents.executeJavaScript(`
          (function() {
            if (window.genomeBrowser) {
              const genomeData = {
                currentSequence: window.genomeBrowser.currentSequence || {},
                currentAnnotations: window.genomeBrowser.currentAnnotations || {},
                currentPosition: window.genomeBrowser.currentPosition || null,
                currentChromosome: window.genomeBrowser.currentChromosome || null,
                sequenceLength: window.genomeBrowser.sequenceLength || 0,
                loadedFiles: window.genomeBrowser.loadedFiles || [],
                visibleTracks: window.genomeBrowser.visibleTracks || [],
                operons: window.genomeBrowser.operons || []
              };
              
              // Convert sequence data to Circos format
              const chromosomes = [];
              const genes = [];
              const links = [];
              
              // Debug logging
              console.log('Circos data extraction - currentSequence keys:', Object.keys(genomeData.currentSequence));
              console.log('Circos data extraction - currentAnnotations keys:', Object.keys(genomeData.currentAnnotations));
              console.log('Circos data extraction - currentAnnotations sample:', genomeData.currentAnnotations[Object.keys(genomeData.currentAnnotations)[0]]?.slice(0, 3));
              
              // Process each chromosome/sequence
              Object.keys(genomeData.currentSequence).forEach((chrName, index) => {
                const sequence = genomeData.currentSequence[chrName];
                const length = sequence.length;
                
                // Add chromosome data
                chromosomes.push({
                  id: chrName,
                  name: chrName,  // Add explicit name for lookup consistency
                  label: chrName,
                  size: length,
                  length: length,  // Also add length for compatibility
                  start: 0,
                  end: length
                });
                
                // Process annotations for this chromosome
                if (genomeData.currentAnnotations[chrName]) {
                  const annotations = genomeData.currentAnnotations[chrName];
                  
                  // Process all annotations (genes and other features are mixed in the array)
                  if (Array.isArray(annotations)) {
                    // First pass: collect CDS/gene features and deduplicate
                    // GenBank files contain both 'gene' and 'CDS' features for the same
                    // locus — keeping both doubles the count. We prefer CDS (richer
                    // annotation: product, translation, etc.) and discard 'gene' when
                    // a CDS with the same locus_tag or overlapping coordinates exists.
                    const cdsByLocus = {};
                    const genesByLocus = {};
                    const otherFeatures = [];
                    
                    annotations.forEach(annotation => {
                      if (annotation.type === 'source') return;
                      
                      const locusTag = annotation.qualifiers?.locus_tag || annotation.qualifiers?.gene || null;
                      
                      if (annotation.type === 'CDS') {
                        const key = locusTag || \`cds_\${annotation.start}_\${annotation.end}\`;
                        cdsByLocus[key] = annotation;
                      } else if (annotation.type === 'gene') {
                        const key = locusTag || \`gene_\${annotation.start}_\${annotation.end}\`;
                        genesByLocus[key] = annotation;
                      } else {
                        otherFeatures.push(annotation);
                      }
                    });
                    
                    // Merge: prefer CDS, add gene only if no matching CDS exists
                    const mergedFeatures = [];
                    Object.keys(cdsByLocus).forEach(key => {
                      mergedFeatures.push(cdsByLocus[key]);
                    });
                    Object.keys(genesByLocus).forEach(key => {
                      if (!cdsByLocus[key]) {
                        mergedFeatures.push(genesByLocus[key]);
                      }
                    });
                    mergedFeatures.push(...otherFeatures);
                    
                    mergedFeatures.forEach(annotation => {
                      const geneName = annotation.qualifiers?.gene || annotation.qualifiers?.locus_tag || 'Unknown';
                      const locusTag = annotation.qualifiers?.locus_tag || annotation.qualifiers?.gene || \`feature_\${genes.length}\`;
                      const product = annotation.qualifiers?.product || annotation.qualifiers?.note || 'Unknown function';
                      
                      let featureType = annotation.type || 'other';
                      
                      if (featureType === 'gene' || featureType === 'CDS' || featureType === 'mRNA') {
                        featureType = 'protein_coding';
                      } else if (featureType === 'ncRNA') {
                        featureType = 'non_coding';
                      } else if (featureType === 'pseudogene') {
                        featureType = 'pseudogene';
                      } else if (featureType === 'regulatory' || featureType === 'promoter' || featureType === 'terminator') {
                        featureType = 'regulatory';
                      }
                      
                      const strand = annotation.strand === -1 ? '-' : '+';
                      
                      const start = parseInt(annotation.start) || 0;
                      const end = parseInt(annotation.end) || start + 1000;
                      
                      if (start >= 0 && end > start) {
                        genes.push({
                          id: locusTag,
                          name: geneName,
                          chromosome: chrName,
                          start: start,
                          end: end,
                          strand: strand,
                          type: featureType,
                          description: product,
                          qualifiers: annotation.qualifiers || {}
                        });
                      } else {
                        console.warn('Skipping gene with invalid coordinates:', {
                          name: geneName,
                          start: annotation.start,
                          end: annotation.end,
                          chromosome: chrName
                        });
                      }
                    });
                  }
                }
              });
              
              // If no genes found, generate some test genes for visualization
              if (genes.length === 0 && chromosomes.length > 0) {
                console.log('No genes found in annotations, generating test genes for visualization');
                chromosomes.forEach((chr, chrIndex) => {
                  const numTestGenes = Math.min(20, Math.floor(chr.size / 50000)); // 1 gene per 50kb
                  for (let i = 0; i < numTestGenes; i++) {
                    const start = Math.floor(Math.random() * (chr.size - 1000));
                    const end = start + Math.floor(Math.random() * 2000) + 500;
                    const geneTypes = ['protein_coding', 'non_coding', 'pseudogene', 'regulatory'];
                    const geneType = geneTypes[Math.floor(Math.random() * geneTypes.length)];
                    
                    // Validate test gene coordinates
                    if (start >= 0 && end > start && end <= chr.size) {
                      genes.push({
                        id: \`test_gene_\${chrIndex}_\${i}\`,
                        name: \`Test Gene \${i + 1}\`,
                        chromosome: chr.id,
                        start: start,
                        end: end,
                        strand: Math.random() > 0.5 ? '+' : '-',
                        type: geneType,
                        description: \`Test \${geneType} gene for visualization\`,
                        qualifiers: {}
                      });
                    }
                  }
                });
              }
              
              // Pre-compute GC content, GC skew, and WIG data from real sequences
              // This avoids transferring raw sequence strings (which can be 4.6M+ chars)
              // through IPC, which causes serialization issues and fallback to synthetic data
              const gcWindowSize = 10000;
              const preComputedTracks = {};
              
              chromosomes.forEach(chr => {
                const seq = genomeData.currentSequence[chr.name] || genomeData.currentSequence[chr.id] || '';
                if (!seq || seq.length === 0) return;
                
                const chrLength = seq.length;
                const numPoints = Math.floor(chrLength / gcWindowSize);
                const gcContentData = [];
                const gcSkewData = [];
                const wigData = [];
                const halfWindow = gcWindowSize / 2;
                const numWigPoints = Math.floor(chrLength / halfWindow);
                
                for (let i = 0; i < numPoints; i++) {
                  const start = i * gcWindowSize;
                  const end = Math.min(start + gcWindowSize, chrLength);
                  const position = start + gcWindowSize / 2;
                  const windowSeq = seq.substring(start, end);
                  
                  const gCount = (windowSeq.match(/G/g) || []).length;
                  const cCount = (windowSeq.match(/C/g) || []).length;
                  const aCount = (windowSeq.match(/A/g) || []).length;
                  const tCount = (windowSeq.match(/T/g) || []).length;
                  const gcCount = gCount + cCount;
                  
                  const gcContent = windowSeq.length > 0 ? (gcCount / windowSeq.length) * 100 : 0;
                  gcContentData.push({ position, value: gcContent });
                  
                  const gcSkew = gcCount > 0 ? (gCount - cCount) / gcCount : 0;
                  gcSkewData.push({ position, value: gcSkew });
                }
                
                for (let i = 0; i < numWigPoints; i++) {
                  const start = i * halfWindow;
                  const end = Math.min(start + halfWindow, chrLength);
                  const position = start + halfWindow / 4;
                  const windowSeq = seq.substring(start, end);
                  
                  const gCount = (windowSeq.match(/G/g) || []).length;
                  const cCount = (windowSeq.match(/C/g) || []).length;
                  const gcCount = gCount + cCount;
                  const gcContent = windowSeq.length > 0 ? (gcCount / windowSeq.length) * 100 : 0;
                  
                  let complexity = 0;
                  if (windowSeq.length >= 2) {
                    const diNucs = {};
                    for (let j = 0; j < windowSeq.length - 1; j++) {
                      const di = windowSeq.substring(j, j + 2).toUpperCase();
                      diNucs[di] = (diNucs[di] || 0) + 1;
                    }
                    const maxDi = 16;
                    const obsDi = Object.keys(diNucs).length;
                    complexity = obsDi / maxDi;
                  }
                  
                  const value = Math.max(0, gcContent * 0.5 + complexity * 20 + (100 - gcContent) * 0.3);
                  wigData.push({ position, value });
                }
                
                preComputedTracks[chr.name || chr.id] = {
                  gc_content: gcContentData,
                  gc_skew: gcSkewData,
                  wig: wigData
                };
              });
              
              return {
                success: true,
                data: {
                  chromosomes: chromosomes,
                  genes: genes,
                  links: links,
                  metadata: {
                    totalChromosomes: chromosomes.length,
                    totalGenes: genes.length,
                    totalLength: chromosomes.reduce((sum, chr) => sum + chr.size, 0),
                    source: 'GenomeExplorer',
                    timestamp: new Date().toISOString()
                  }
                },
                preComputedTracks: preComputedTracks
              };
            }
            return { success: false, error: 'No genome data loaded' };
          })()
        `);
        return result;
      }
      return { success: false, error: 'Main window not available' };
    } catch (error) {
      console.error('Error getting Circos genome data:', error);
      return { success: false, error: error.message };
    }
  });

  // Handle navigation requests from Circos Plotter
  ipcMain.handle('navigate-to-chromosome', async (event, chromosomeName) => {
    try {
      const mainWindow = getCurrentMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        await mainWindow.webContents.executeJavaScript(`
          (function() {
            if (window.genomeBrowser && document.getElementById('chromosomeSelect')) {
              const select = document.getElementById('chromosomeSelect');
              const option = Array.from(select.options).find(opt => 
                opt.value === '${chromosomeName}' || 
                opt.text.includes('${chromosomeName}')
              );
              if (option) {
                select.value = option.value;
                select.dispatchEvent(new Event('change'));
                return true;
              }
            }
            return false;
          })()
        `);
        return { success: true };
      }
      return { success: false, error: 'Main window not available' };
    } catch (error) {
      console.error('Error navigating to chromosome:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('navigate-to-gene', async (event, geneData) => {
    try {
      const mainWindow = getCurrentMainWindow();
      if (mainWindow && !mainWindow.isDestroyed()) {
        await mainWindow.webContents.executeJavaScript(`
          (function() {
            if (window.genomeBrowser) {
              // First navigate to the chromosome
              const select = document.getElementById('chromosomeSelect');
              if (select) {
                const option = Array.from(select.options).find(opt => 
                  opt.value === '${geneData.chromosome}' || 
                  opt.text.includes('${geneData.chromosome}')
                );
                if (option) {
                  select.value = option.value;
                  select.dispatchEvent(new Event('change'));
                }
              }
              
              // Then navigate to the gene position
              setTimeout(() => {
                const nm = window.genomeBrowser && window.genomeBrowser.navigationManager;
                if (nm && nm.navigateToPosition) {
                  nm.navigateToPosition('${geneData.chromosome}', ${geneData.start}, ${geneData.end});
                } else if (window.genomeBrowser.setPosition) {
                  window.genomeBrowser.setPosition(${geneData.start}, ${geneData.end});
                }
              }, 500);
              
              return true;
            }
            return false;
          })()
        `);
        return { success: true };
      }
      return { success: false, error: 'Main window not available' };
    } catch (error) {
      console.error('Error navigating to gene:', error);
      return { success: false, error: error.message };
    }
  });

  // Handle gene sequence requests
  ipcMain.handle('get-gene-sequence', async (event, geneName) => {
    try {
      const targetWindow = getMainGenomeTarget();

      if (targetWindow && targetWindow.webContents) {
        const result = await targetWindow.webContents.executeJavaScript(`
          (async function() {
            if (window.genomeBrowser && '${geneName}') {
              const annotations = window.genomeBrowser.currentAnnotations || {};
              const sequences = window.genomeBrowser.currentSequence || {};
              
              // Search for gene in annotations
              for (const [chromosome, chrAnnotations] of Object.entries(annotations)) {
                if (chrAnnotations && chrAnnotations.length) {
                  const gene = chrAnnotations.find(g => 
                    g.name === '${geneName}' || 
                    g.gene === '${geneName}' || 
                    g.locus_tag === '${geneName}' ||
                    (g.name && g.name.toLowerCase() === '${geneName}'.toLowerCase()) ||
                    (g.gene && g.gene.toLowerCase() === '${geneName}'.toLowerCase())
                  );
                  
                  if (gene && sequences[chromosome]) {
                    const sequence = sequences[chromosome].substring(gene.start - 1, gene.end);
                    return {
                      sequence: sequence,
                      chromosome: chromosome,
                      start: gene.start,
                      end: gene.end,
                      geneName: gene.name || gene.gene || '${geneName}',
                      strand: gene.strand || '+',
                      source: 'gene_annotation'
                    };
                  }
                }
              }
              
              return null;
            }
            return null;
          })()
        `);
        return result;
      }
      return null;
    } catch (error) {
      console.error('Error getting gene sequence:', error);
      return null;
    }
  });

  // Handle region sequence requests
  ipcMain.handle('get-region-sequence', async (event, chromosome, start, end) => {
    try {
      const targetWindow = getMainGenomeTarget();

      if (targetWindow && targetWindow.webContents) {
        const result = await targetWindow.webContents.executeJavaScript(`
          (function() {
            if (window.genomeBrowser) {
              const sequences = window.genomeBrowser.currentSequence || {};
              
              if (sequences['${chromosome}']) {
                const sequence = sequences['${chromosome}'].substring(${start} - 1, ${end});
                return {
                  sequence: sequence,
                  chromosome: '${chromosome}',
                  start: ${start},
                  end: ${end},
                  source: 'genomic_region'
                };
              }
            }
            return null;
          })()
        `);
        return result;
      }
      return null;
    } catch (error) {
      console.error('Error getting region sequence:', error);
      return null;
    }
  });

  // =====================================================================
  // 12. Tool Window Openers IPC Handlers
  // =====================================================================

  // IPC handlers for opening tool windows (for testing and external access)
  ipcMain.on('open-interpro-window', () => {
    console.log('IPC: Opening InterPro window...');
    createInterProWindow();
  });

  ipcMain.on('open-kegg-window', () => {
    console.log('IPC: Opening KEGG window...');
    createKEGGWindow();
  });

  ipcMain.on('open-go-window', () => {
    console.log('IPC: Opening GO window...');
    createGOWindow();
  });

  ipcMain.on('open-uniprot-window', () => {
    console.log('IPC: Opening UniProt window...');
    createUniProtWindow();
  });

  ipcMain.on('open-ncbi-window', () => {
    console.log('IPC: Opening NCBI window...');
    createNCBIWindow();
  });

  ipcMain.on('open-string-window', () => {
    console.log('IPC: Opening STRING window...');
    createSTRINGWindow();
  });

  ipcMain.on('open-david-window', () => {
    console.log('IPC: Opening DAVID window...');
    createDAVIDWindow();
  });

  ipcMain.on('open-reactome-window', () => {
    console.log('IPC: Opening Reactome window...');
    createReactomeWindow();
  });

  ipcMain.on('open-pdb-window', () => {
    console.log('IPC: Opening PDB window...');
    createPDBWindow();
  });

  ipcMain.on('open-blast-downloader-window', () => {
    console.log('IPC: Opening BLAST+ Downloader window...');
    createBlastDownloaderWindow();
  });

  ipcMain.on('open-gene-annotation-refine', (event, data) => {
    console.log('IPC: Opening Gene Annotation Refine window...', data);
    createGeneAnnotationRefineWindow();
  });

  ipcMain.on('open-deep-gene-research-window', async (event, params = {}) => {
    console.log('IPC: Opening Deep Gene Research window with params:', params);
    await createDeepGeneResearchWindow(params);
  });

  // =====================================================================
  // 13. ChatBox Integration IPC Handlers
  // =====================================================================

  // Handle analyzer window ready notification
  ipcMain.on('window-ready', (event, toolName) => {
    console.log(`[ChatBox Integration] ${toolName} window ready`);

    // Check if there's pending data for this tool
    if (analyzerPendingData.has(toolName)) {
      const data = analyzerPendingData.get(toolName);
      event.sender.send('load-analysis-data', data);
      analyzerPendingData.delete(toolName);
      console.log(`[ChatBox Integration] Sent pending data to ${toolName}`);
    }
  });

  // Handle request for pending data
  ipcMain.on('request-pending-data', (event, toolName) => {
    console.log(`[ChatBox Integration] ${toolName} requesting pending data`);

    if (analyzerPendingData.has(toolName)) {
      const data = analyzerPendingData.get(toolName);
      event.sender.send('load-analysis-data', data);
      analyzerPendingData.delete(toolName);
    }
  });

  // Handle analysis request from analyzer tools to ChatBox
  ipcMain.on('analyze-in-chatbox', (event, request) => {
    console.log('[ChatBox Integration] Received analysis request:', request);

    const mainWindow = getCurrentMainWindow();
    if (mainWindow && mainWindow.webContents) {
      // Send the query to ChatBox with metadata
      mainWindow.webContents.send('chatbox-analyze-request', {
        query: request.query,
        toolName: request.toolName,
        data: request.data,
        timestamp: request.timestamp,
      });

      console.log(`[ChatBox Integration] Forwarded request to ChatBox from ${request.toolName}`);
    } else {
      console.error('[ChatBox Integration] Main window not available');
    }
  });

  // Handle request for LLM interpretation
  ipcMain.on('request-llm-interpretation', (event, request) => {
    console.log('[ChatBox Integration] LLM interpretation requested:', request);

    const mainWindow = getCurrentMainWindow();
    if (mainWindow && mainWindow.webContents) {
      // Format the interpretation request
      const interpretQuery =
        `Please provide a detailed biological interpretation of the following ${request.toolName} results:\n\n` +
        `Analysis Type: ${request.context.analysisType}\n` +
        `Number of Results: ${request.context.resultCount}\n\n` +
        `Please explain the biological significance and functional implications of these findings.`;

      mainWindow.webContents.send('chatbox-interpret-request', {
        query: interpretQuery,
        data: request.data,
        context: request.context,
        toolName: request.toolName,
        responseTarget: event.sender,
      });

      console.log(`[ChatBox Integration] Sent interpretation request to ChatBox`);
    }
  });

  // Handle LLM interpretation response back to analyzer tool
  ipcMain.on('llm-interpretation-response', (event, response) => {
    console.log('[ChatBox Integration] LLM interpretation response received');

    if (response.targetWindow && response.targetWindow.send) {
      response.targetWindow.send('llm-interpretation-result', {
        interpretation: response.interpretation,
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Handle request to send analysis data from ChatBox to analyzer tool
  ipcMain.on('send-to-analyzer', (event, request) => {
    console.log('[ChatBox Integration] Sending data to analyzer:', request.toolName);

    // Store the data for when the window opens
    analyzerPendingData.set(request.toolName, {
      results: request.data,
      source: 'chatbox',
      originalQuery: request.originalQuery,
      timestamp: new Date().toISOString(),
    });

    // Open the appropriate analyzer window
    switch (request.toolName.toLowerCase()) {
      case 'kegg pathway analysis':
      case 'kegg-analyzer':
        createKEGGWindow();
        break;
      case 'gene ontology analysis':
      case 'go-analyzer':
        createGOWindow();
        break;
      case 'interpro domain analysis':
      case 'interpro-analyzer':
        createInterProWindow();
        break;
      default:
        console.warn(`[ChatBox Integration] Unknown analyzer tool: ${request.toolName}`);
    }
  });

  // IPC handler for Deep Gene Research window menu actions
  ipcMain.on('deep-gene-research-menu-action', (event, action) => {
    console.log('Deep Gene Research menu action:', action);

    const webContents = event.sender;

    switch (action) {
      case 'copy':
        webContents.copy();
        break;
      case 'paste':
        webContents.paste();
        break;
      case 'cut':
        webContents.cut();
        break;
      case 'select-all':
        webContents.selectAll();
        break;
      case 'find':
        webContents.findInPage('');
        break;
      case 'find-next':
        webContents.findInPage('', { forward: true });
        break;
      case 'reload':
        webContents.reload();
        break;
      case 'force-reload':
        webContents.reloadIgnoringCache();
        break;
      case 'toggle-dev-tools':
        webContents.toggleDevTools();
        break;
      case 'reset-zoom':
        webContents.setZoomLevel(0);
        break;
      case 'zoom-in':
        webContents.setZoomLevel(webContents.getZoomLevel() + 0.5);
        break;
      case 'zoom-out':
        webContents.setZoomLevel(webContents.getZoomLevel() - 0.5);
        break;
      case 'toggle-fullscreen': {
        const window = BrowserWindow.fromWebContents(webContents);
        if (window) {
          window.setFullScreen(!window.isFullScreen());
        }
        break;
      }
      default:
        console.log('Unknown Deep Gene Research menu action:', action);
    }
  });

  // =====================================================================
  // 14. Settings IPC Handlers
  // =====================================================================

  // Helper functions for user notifications

  // General Settings IPC handlers
  ipcMain.handle('get-general-settings', async () => {
    try {
      // Get the main window to access GeneralSettingsManager
      const mainWindow = getCurrentMainWindow();
      if (mainWindow && mainWindow.webContents) {
        const settings = await mainWindow.webContents.executeJavaScript(`
          if (window.genomeBrowser && window.genomeBrowser.generalSettingsManager) {
            window.genomeBrowser.generalSettingsManager.getSettings();
          } else {
            Promise.resolve({});
          }
        `);
        return settings;
      }
      return {};
    } catch (error) {
      console.error('Error getting general settings:', error);
      return {};
    }
  });

  // =====================================================================
  // 15. System Checks IPC Handlers
  // =====================================================================

  ipcMain.handle('blast:detect-installation', async () => {
    try {
      const result = await findBlastExecutable();
      return {
        success: true,
        installed: result.found,
        found: result.found,
        message: result.found
          ? `BLAST+ installed successfully (version ${result.version})`
          : 'BLAST+ not found or not installed',
        version: result.version || null,
        path: result.path || null,
        method: result.method || null,
        output: result.output || null,
        error: result.error || null,
      };
    } catch (error) {
      return { success: false, installed: false, found: false, error: error.message };
    }
  });

  ipcMain.handle('blast:select-executable', async () => {
    try {
      const result = await dialog.showOpenDialog(null, {
        title: 'Select BLAST+ Executable',
        properties: ['openFile'],
        filters: process.platform === 'win32' ? [{ name: 'Executable', extensions: ['exe'] }] : undefined,
      });
      rememberApprovedDialogPaths(result);
      return result;
    } catch (error) {
      return { canceled: true, error: error.message };
    }
  });

  ipcMain.handle('blast:verify-executable', async (event, executablePath) => {
    try {
      let safeExecutablePath = null;
      try {
        safeExecutablePath = assertAllowedFileAccess(app, executablePath, {
          operation: 'verify BLAST executable',
          mustExist: true,
        });
      } catch (error) {
        if (isTrustedBlastExecutablePath(executablePath) && fs.existsSync(executablePath)) {
          safeExecutablePath = path.resolve(executablePath);
        } else {
          throw error;
        }
      }
      const result = await runBlastVersionCheck(safeExecutablePath);
      return {
        success: result.found,
        found: result.found,
        version: result.version || null,
        path: safeExecutablePath,
        output: result.output || null,
        error: result.error || null,
      };
    } catch (error) {
      return { success: false, found: false, error: error.message };
    }
  });

  ipcMain.handle('blast:run-command', async (event, options = {}) => {
    try {
      const { execFile } = require('child_process');

      let executableToken = options.executable;
      let args = Array.isArray(options.args) ? options.args.map(arg => String(arg)) : null;
      if (!executableToken || !args) {
        const tokens = parseCommandLine(options.command || '');
        executableToken = tokens[0];
        args = tokens.slice(1);
      }

      if (!executableToken) {
        throw new Error('BLAST command is required');
      }

      const executable = resolveBlastExecutable(app, executableToken, options.blastExecutablePath);
      const execOptions = { maxBuffer: 10 * 1024 * 1024 };

      if (options.workingDirectory) {
        execOptions.cwd = assertAllowedFileAccess(app, options.workingDirectory, {
          operation: 'use BLAST working directory',
          mustExist: true,
        });
      }

      const isVersionCommand = args.includes('-version') || args.includes('--version');
      if (options.localDbPath && !isVersionCommand) {
        const localDbPath = assertAllowedFileAccess(app, options.localDbPath, {
          operation: 'use BLAST database directory',
        });
        if (!fs.existsSync(localDbPath)) {
          fs.mkdirSync(localDbPath, { recursive: true });
        }
        execOptions.env = { ...process.env, BLASTDB: localDbPath };
      }

      return await new Promise(resolve => {
        execFile(executable, args, execOptions, (error, stdout, stderr) => {
          if (error) {
            resolve({
              success: false,
              error: error.message,
              stdout,
              stderr,
              executable,
              args,
            });
            return;
          }

          resolve({
            success: true,
            stdout,
            stderr,
            executable,
            args,
          });
        });
      });
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // IPC handler for BLAST installation check
  ipcMain.on('check-blast-installation', event => {
    console.log('IPC: Checking BLAST installation...');

    // Execute the search
    findBlastExecutable()
      .then(result => {
        if (result.found) {
          event.sender.send('blast-check-result', {
            installed: true,
            message: `BLAST+ installed successfully (version ${result.version})`,
            version: result.version,
            path: result.path,
            output: result.output,
          });
        } else {
          event.sender.send('blast-check-result', {
            installed: false,
            message: 'BLAST+ not found or not installed',
            error: result.error,
          });
        }
      })
      .catch(error => {
        event.sender.send('blast-check-result', {
          installed: false,
          message: 'Error checking BLAST+ installation',
          error: error.message,
        });
      });
  });

  // IPC handler for system requirements check
  ipcMain.on('system-requirements-check', event => {
    console.log('IPC: Checking system requirements...');
    const os = require('os');
    const { exec } = require('child_process');

    const systemInfo = {
      platform: os.platform(),
      arch: os.arch(),
      release: os.release(),
      nodeVersion: process.version,
      totalMemory: (os.totalmem() / 1024 ** 3).toFixed(2) + ' GB',
      freeMemory: (os.freemem() / 1024 ** 3).toFixed(2) + ' GB',
      cpus: os.cpus().length,
    };

    // Check disk space
    exec('df -h /', (error, stdout, stderr) => {
      if (!error && stdout) {
        const lines = stdout.split('\n');
        if (lines.length > 1) {
          const diskInfo = lines[1].split(/\s+/);
          systemInfo.diskSpace = {
            total: diskInfo[1],
            used: diskInfo[2],
            available: diskInfo[3],
            usage: diskInfo[4],
          };
        }
      }

      event.sender.send('system-requirements-result', {
        systemInfo: systemInfo,
        requirements: {
          minimumMemory: '4 GB',
          recommendedMemory: '8 GB',
          minimumDiskSpace: '1 GB',
          supportedPlatforms: ['Windows', 'macOS', 'Linux'],
        },
        status: {
          memoryOk: parseFloat(systemInfo.totalMemory) >= 4,
          platformSupported: ['win32', 'darwin', 'linux'].includes(os.platform()),
        },
      });
    });
  });

  // IPC handler for focusing main window
  ipcMain.on('focus-main-window', () => {
    console.log('IPC: Focusing main window...');
    const targetWindow = getMainGenomeTarget();
    if (targetWindow && !targetWindow.isDestroyed()) {
      targetWindow.focus();
      targetWindow.show();
    }
  });

  // =====================================================================
  // 16. External Tools IPC Handlers
  // =====================================================================

  // External Tools Configuration IPC handlers
  ipcMain.on('update-external-tools-menu', (event, tools) => {
    console.log('[ExternalTools] Updating external tools menu:', tools);
    // Store the tools data for menu creation
    global.customExternalTools = tools;
    // Recreate the main menu to include new tools
    createMenu();
  });

  ipcMain.on('open-custom-external-tool', (event, toolData) => {
    console.log('[ExternalTools] Opening custom external tool:', toolData);
    createCustomExternalToolWindow(toolData);
  });

  // Built-in external tools IPC handlers
  ipcMain.on('open-deep-gene-research-window', async (event, params = {}) => {
    console.log('IPC: Opening Deep Gene Research window with params:', params);
    await createDeepGeneResearchWindow(params);
  });

  ipcMain.on('open-chopchop-window', () => {
    console.log('IPC: Opening CHOPCHOP window...');
    createChopchopWindow();
  });

  ipcMain.on('open-progenfixer-window', () => {
    console.log('IPC: Opening ProGenFixer window...');
    createProGenFixerWindow();
  });
}

module.exports = { registerIpcHandlers };
