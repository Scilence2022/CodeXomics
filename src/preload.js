const { contextBridge, ipcRenderer, shell } = require('electron');

const allowedInvokeChannels = [
  'mcp-server-start',
  'mcp-server-stop',
  'mcp-server-status',
  'mcp-server-get-settings',
  'mcp-server-save-settings',
  'mcp-server-check-port',
  'dgr-mcp-request',
  'dgr-upload-research-document',
  'archive-dgr-task-result',
  'open-dgr-json-viewer',
  'broadcast-theme-to-pm',
  'request-current-theme',
  'screenshot:capture',
  'open-image-file',
  'show-save-dialog',
  'show-open-file-dialog',
  'write-file',
  'read-file',
  'read-file-stream',
  'get-file-info',
  'authorize-file-load',
  'getFileInfo',
  'get-app-paths',
  'checkFileExists',
  'check-file-exists',
  'check-gene-research-report',
  'save-gene-research-report',
  'read-gene-research-report',
  'open-gene-research-report',
  'load-sidecar-file',
  'save-sidecar-file',
  'check-sidecar-file',
  'copy-plugin-directory',
  'copy-plugin-file',
  'createNewMainWindow',
  'ensure-directory',
  'approve-working-directory',
  'extract-plugin-zip',
  'get-plugin-file-info',
  'open-markdown-viewer',
  'openFolderInExplorer',
  'download-internet-file',
  'read-plugin-file',
  'save-refined-annotation',
  'scan-plugin-directory',
  'select-plugin-file',
  'selectFastaFile',
  'selectMultipleFiles',
  'show-directory-dialog',
  'write-plugin-file',
  'tool-registry:get-snapshot',
  'tool-registry:get-metadata',
  'tool-registry:get-tool',
  'tool-registry:reload',
  'i18n:getCurrentLanguage',
  'i18n:changeLanguage',
  'get-locale-data',
  'get-locale-languages',
  'get-sanitizer-config',
  'config:load',
  'config:save',
  'bam-reader:initialize',
  'bam-reader:get-records-for-range',
  'bam-reader:destroy',
  'blast:detect-installation',
  'blast:run-command',
  'blast:select-executable',
  'blast:verify-executable',
  'get-window-id',
  'window-tabs:list',
  'window-tabs:switch',
  'window-tabs:detach',
  'window-tabs:detach-at',
  'window-tabs:reorder',
  'window-tabs:attach-to-window',
  'window-tabs:close',
  'window-tabs:toggle-fullscreen',
  'window-tabs:attach-all',
  'window-tabs:new-tab',
];

const allowedListenChannels = [
  'menu-new-project',
  'menu-open-project',
  'menu-save-project',
  'menu-save-project-as',
  'menu-export-xml',
  'menu-export-json',
  'menu-export-archive',
  'menu-import-files',
  'menu-import-project',
  'menu-close-project',
  'menu-undo',
  'menu-redo',
  'menu-cut',
  'menu-copy',
  'menu-paste',
  'menu-select-all',
  'menu-clear-selection',
  'menu-find-files',
  'menu-find-replace',
  'menu-refresh',
  'menu-view-mode',
  'menu-sort-by',
  'menu-toggle-hidden-files',
  'menu-toggle-file-extensions',
  'menu-toggle-sidebar',
  'menu-toggle-details-panel',
  'menu-project-properties',
  'menu-project-statistics',
  'menu-create-folder',
  'menu-auto-organize',
  'menu-group-by-date',
  'menu-clean-empty-folders',
  'menu-backup-project',
  'menu-restore-backup',
  'menu-archive-project',
  'menu-delete-project',
  'menu-validate-files',
  'menu-find-duplicates',
  'menu-check-integrity',
  'menu-convert-fasta-genbank',
  'menu-convert-gff-bed',
  'menu-custom-conversion',
  'menu-batch-rename',
  'menu-batch-move',
  'menu-batch-delete',
  'menu-open-genome-viewer',
  'menu-open-external-editor',
  'menu-open-file-explorer',
  'menu-preferences',
  'menu-help',
  'menu-keyboard-shortcuts',
  'menu-user-guide',
  'menu-file-formats',
  'menu-best-practices',
  'menu-report-issue',
  'menu-send-feedback',
  'menu-about',
  'request-current-project-for-download',
  'tool-menu-action',
  'mcp-server-manager-menu-action',
  'mcp-server-status-update',
  'mcp-server-status-changed',
  'mcp-server-log',
  'mcp-server-client-update',
  'sync-theme',
  'set-window-id',
  'file-opened',
  'show-search',
  'show-goto',
  'show-panel',
  'show-all-panels',
  'show-plugin-management',
  'show-plugin-marketplace',
  'show-smart-execution-demo',
  'open-resource-manager',
  'configure-llms',
  'configure-external-tools',
  'open-enzyme-browser',
  'open-dna-marker-browser',
  'configure-search',
  'mcp-settings',
  'multi-agent-settings',

  'general-settings',
  'chatbox-settings',
  'check-file-status',
  'load-file',
  'open-project-file',
  'save-current-project',
  'save-project-as',
  'export-project-xml',
  'open-recent-project',
  'clear-recent-projects',
  'menu-load-genome',
  'menu-load-annotation-merge',
  'menu-load-annotation-new',
  'menu-load-variant',
  'menu-load-reads',
  'menu-load-wig',
  'menu-load-operon',
  'menu-load-blast',
  'menu-load-any',
  'menu-export-fasta',
  'menu-export-genbank',
  'menu-export-cds',
  'menu-export-protein',
  'menu-export-gff',
  'menu-export-bed',
  'menu-export-current-view',
  'menu-export-configure',
  'menu-capture-full-screenshot',
  'menu-capture-tracks-screenshot',
  'action-copy-sequence',
  'action-copy-reverse-complement-sequence',
  'action-cut-sequence',
  'action-paste-sequence',
  'action-paste-sequence-reverse',
  'action-delete-sequence',
  'action-insert-sequence',
  'action-insert-sequence-reverse',
  'show-action-list',
  'execute-all-actions',
  'create-checkpoint',
  'rollback-checkpoint',
  'mcp-tool-call',
  'execute-tool-request',
  'show-notification',
  'request-theme-for-pm',
  'resource-update',
  'resource-removed',
  'resource-added',
  'create-new-project',
  'load-project-from-menu',
  'set-download-type',
  'set-active-project',
  'before-window-close',
  'load-markdown',
  'download-progress',
  'file-lines-chunk',
  'file-stream-complete',
  'file-read-progress',
  'tool-registry-updated',
  'window-tabs-updated',
];

const allowedSendChannels = [
  'close-resource-manager',
  'project-manager-current-project-response',
  'analyze-in-chatbox',
  'main-window-status-response',
  'mcp-tool-response',
  'internal-mcp-server-ready',
  'internal-mcp-server-stopped',
  'open-chopchop-window',
  'open-custom-external-tool',
  'open-deep-gene-research-window',
  'open-gene-annotation-refine',
  'open-progenfixer-window',
  'open-project-manager',
  'open-resource-manager',
  'request-llm-interpretation',
  'request-pending-data',
  'tool-response',
  'update-external-tools-menu',
  'update-window-genome-name',
  'window-ready',
];

const safeIpcRenderer = {
  invoke: (channel, ...args) => {
    if (allowedInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
    return Promise.reject(new Error(`Blocked IPC invoke for unapproved channel: ${channel}`));
  },
  on: (channel, listener) => {
    if (allowedListenChannels.includes(channel)) {
      ipcRenderer.on(channel, listener);
    } else {
      console.warn(`[preload] Blocked IPC listener for unapproved channel: ${channel}`);
    }
  },
  send: (channel, ...args) => {
    if (allowedSendChannels.includes(channel)) {
      ipcRenderer.send(channel, ...args);
    } else {
      console.warn(`[preload] Blocked IPC send for unapproved channel: ${channel}`);
    }
  },
  removeListener: (channel, listener) => {
    if (allowedListenChannels.includes(channel)) {
      ipcRenderer.removeListener(channel, listener);
    }
  },
  removeAllListeners: channel => {
    const allowedChannels = [...allowedListenChannels, ...allowedSendChannels, ...allowedInvokeChannels];
    if (allowedChannels.includes(channel)) {
      ipcRenderer.removeAllListeners(channel);
    } else {
      console.warn(`[preload] Blocked removeAllListeners for unapproved channel: ${channel}`);
    }
  },
};

const safePath = {
  basename: filePath =>
    String(filePath || '')
      .replace(/\\/g, '/')
      .split('/')
      .filter(Boolean)
      .pop() || '',
  dirname: filePath => {
    const normalized = String(filePath || '').replace(/\\/g, '/');
    const index = normalized.lastIndexOf('/');
    return index <= 0 ? (index === 0 ? '/' : '.') : normalized.slice(0, index);
  },
  extname: filePath => {
    const base = safePath.basename(filePath);
    const index = base.lastIndexOf('.');
    return index > 0 ? base.slice(index) : '';
  },
  join: (...parts) => {
    const joined = parts.filter(part => part !== undefined && part !== null && part !== '').join('/');
    return joined.replace(/\/+/g, '/').replace(/([^:])\/+$/g, '$1');
  },
  isAbsolute: filePath => /^(?:\/|[A-Za-z]:[\\/])/.test(String(filePath || '')),
  resolve: (...parts) => {
    const joined = safePath.join(...parts);
    if (!joined) return '.';
    const normalized = String(joined).replace(/\\/g, '/');
    if (/^(?:\/|[A-Za-z]:\/)/.test(normalized)) return normalized;
    return `/${normalized}`.replace(/\/+/g, '/');
  },
};

const safeOs = {
  arch: () => process.arch,
  homedir: () => '',
  platform: () => process.platform,
  release: () => {
    if (typeof process.getSystemVersion === 'function') {
      return process.getSystemVersion();
    }
    return '';
  },
  tmpdir: () => '',
};

const safeRequire = moduleName => {
  switch (moduleName) {
    case 'electron':
      return {
        ipcRenderer: safeIpcRenderer,
        shell: {
          openExternal: url => shell.openExternal(url),
        },
      };
    case 'path':
      return safePath;
    case 'os':
      return safeOs;
    default:
      throw new Error(`Blocked renderer require('${moduleName}') after security hardening`);
  }
};

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Resource management APIs
  getLoadedResources: () => ipcRenderer.invoke('get-loaded-resources'),
  refreshResources: () => ipcRenderer.invoke('refresh-resources'),
  removeResource: resourceId => ipcRenderer.invoke('remove-resource', resourceId),
  exportResource: (resourceId, options) => ipcRenderer.invoke('export-resource', resourceId, options),
  openResourceInBrowser: resourceId => ipcRenderer.invoke('open-resource-in-browser', resourceId),

  // File operations
  selectAndLoadFile: () => ipcRenderer.invoke('select-and-load-file'),
  showOpenFileDialog: options => ipcRenderer.invoke('show-open-file-dialog', options),
  getSelectedFileInfo: filePath => ipcRenderer.invoke('get-file-info', filePath),
  authorizeFileLoad: (filePath, toolName) => ipcRenderer.invoke('authorize-file-load', filePath, toolName),

  // Directory selection for benchmark
  showDirectoryDialog: options => ipcRenderer.invoke('show-directory-dialog', options),

  // File save dialog for exports
  showSaveDialog: options => ipcRenderer.invoke('show-save-dialog', options),
  writeFile: (filePath, content) => ipcRenderer.invoke('write-file', filePath, content),
  captureScreenshot: options => ipcRenderer.invoke('screenshot:capture', options),
  openImageFile: options => ipcRenderer.invoke('open-image-file', options),

  // Project Manager APIs
  selectProjectDirectory: () => ipcRenderer.invoke('selectProjectDirectory'),
  selectProjectFile: () => ipcRenderer.invoke('selectProjectFile'),
  selectMultipleFiles: () => ipcRenderer.invoke('selectMultipleFiles'),
  createProjectDirectory: (location, projectName) =>
    ipcRenderer.invoke('createProjectDirectory', location, projectName),
  loadProjectFile: filePath => ipcRenderer.invoke('loadProjectFile', filePath),
  openFileInMainWindow: filePath => ipcRenderer.invoke('openFileInMainWindow', filePath),
  openFolderInExplorer: folderPath => ipcRenderer.invoke('openFolderInExplorer', folderPath),
  moveFileInProject: (currentPath, projectName, targetFolderPath) =>
    ipcRenderer.invoke('moveFileInProject', currentPath, projectName, targetFolderPath),
  renameFileInProject: (currentPath, newFileName) =>
    ipcRenderer.invoke('renameFileInProject', currentPath, newFileName),
  scanProjectFolder: (projectPath, existingFileIds, existingFolderStructure) =>
    ipcRenderer.invoke('scanProjectFolder', projectPath, existingFileIds, existingFolderStructure),

  // Project file locking APIs
  lockProjectFile: filePath => ipcRenderer.invoke('lockProjectFile', filePath),
  unlockProjectFile: (filePath, lockId) => ipcRenderer.invoke('unlockProjectFile', filePath, lockId),

  // Path utilities
  getDocumentsPath: () => ipcRenderer.invoke('getDocumentsPath'),
  getProjectDirectoryName: () => ipcRenderer.invoke('getProjectDirectoryName'),
  createProjectFolder: (projectName, folderName) => ipcRenderer.invoke('createProjectFolder', projectName, folderName),
  saveProjectsData: projectsData => ipcRenderer.invoke('saveProjectsData', projectsData),
  loadProjectsData: () => ipcRenderer.invoke('loadProjectsData'),
  saveProjectSettings: settings => ipcRenderer.invoke('saveProjectSettings', settings),
  loadProjectSettings: () => ipcRenderer.invoke('loadProjectSettings'),

  // Enhanced File Opening APIs
  checkMainWindowStatus: () => ipcRenderer.invoke('checkMainWindowStatus'),
  createNewMainWindow: filePath => ipcRenderer.invoke('createNewMainWindow', filePath),

  // File Save APIs
  saveFile: (fileName, content) => ipcRenderer.invoke('saveFile', fileName, content),
  saveProjectFile: (fileName, content) => ipcRenderer.invoke('saveProjectFile', fileName, content),
  saveProjectFileDirect: (filePath, content) => ipcRenderer.invoke('saveProjectFileDirect', filePath, content),
  createTempFile: (fileName, content) => ipcRenderer.invoke('createTempFile', fileName, content),
  getFileInfo: filePath => ipcRenderer.invoke('getFileInfo', filePath),
  checkFileExists: filePath => ipcRenderer.invoke('checkFileExists', filePath),
  getAppPaths: () => ipcRenderer.invoke('get-app-paths'),
  getLocaleData: (language, namespace) => ipcRenderer.invoke('get-locale-data', language, namespace),
  getLocaleLanguages: () => ipcRenderer.invoke('get-locale-languages'),
  getCurrentLanguage: () => ipcRenderer.invoke('i18n:getCurrentLanguage'),
  changeLanguage: language => ipcRenderer.invoke('i18n:changeLanguage', language),
  getWindowId: () => ipcRenderer.invoke('get-window-id'),
  getWindowTabs: () => ipcRenderer.invoke('window-tabs:list'),
  switchWindowTab: windowId => ipcRenderer.invoke('window-tabs:switch', windowId),
  detachWindowTab: windowId => ipcRenderer.invoke('window-tabs:detach', windowId),
  detachWindowTabAt: (windowId, screenPoint) => ipcRenderer.invoke('window-tabs:detach-at', windowId, screenPoint),
  reorderWindowTab: (windowId, targetIndex) => ipcRenderer.invoke('window-tabs:reorder', windowId, targetIndex),
  attachWindowTabToCurrent: (windowId, targetIndex) =>
    ipcRenderer.invoke('window-tabs:attach-to-window', windowId, targetIndex),
  closeWindowTab: windowId => ipcRenderer.invoke('window-tabs:close', windowId),
  toggleWindowTabFullScreen: () => ipcRenderer.invoke('window-tabs:toggle-fullscreen'),
  attachAllGenomeWindows: () => ipcRenderer.invoke('window-tabs:attach-all'),
  createWindowLevelTab: () => ipcRenderer.invoke('window-tabs:new-tab'),
  onWindowTabsUpdated: listener => {
    ipcRenderer.on('window-tabs-updated', listener);
  },
  loadConfigData: () => ipcRenderer.invoke('config:load'),
  saveConfigData: config => ipcRenderer.invoke('config:save', config),
  checkGeneResearchReport: geneSymbol => ipcRenderer.invoke('check-gene-research-report', geneSymbol),
  saveGeneResearchReport: (geneSymbol, report) => ipcRenderer.invoke('save-gene-research-report', geneSymbol, report),
  readGeneResearchReport: geneSymbol => ipcRenderer.invoke('read-gene-research-report', geneSymbol),
  openGeneResearchReport: geneSymbol => ipcRenderer.invoke('open-gene-research-report', geneSymbol),
  loadSidecarFile: genomePath => ipcRenderer.invoke('load-sidecar-file', genomePath),
  saveSidecarFile: (genomePath, data) => ipcRenderer.invoke('save-sidecar-file', genomePath, data),
  checkSidecarFile: genomePath => ipcRenderer.invoke('check-sidecar-file', genomePath),
  deletePhysicalFile: filePath => ipcRenderer.invoke('deletePhysicalFile', filePath),
  updateRecentProjects: recentProjects => ipcRenderer.invoke('updateRecentProjects', recentProjects),

  // File copying APIs
  copyFileToProject: (sourcePath, projectName, folderPath) =>
    ipcRenderer.invoke('copyFileToProject', sourcePath, projectName, folderPath),

  // New project structure APIs
  createNewProjectStructure: (location, projectName) =>
    ipcRenderer.invoke('createNewProjectStructure', location, projectName),
  saveProjectToSpecificFile: (filePath, content) => ipcRenderer.invoke('saveProjectToSpecificFile', filePath, content),
  saveProjectAs: defaultProjectName => ipcRenderer.invoke('saveProjectAs', defaultProjectName),
  checkProjectExists: (directory, projectName) => ipcRenderer.invoke('checkProjectExists', directory, projectName),
  copyProject: (sourceProjectFile, sourceDataFolder, targetDirectory, projectName) =>
    ipcRenderer.invoke('copyProject', sourceProjectFile, sourceDataFolder, targetDirectory, projectName),

  // Communication with main window
  sendToMainWindow: (channel, data) => ipcRenderer.invoke('send-to-main-window', channel, data),

  // Debug Tools API
  openDebugTool: fileName => ipcRenderer.invoke('openDebugTool', fileName),

  // Window management
  closeWindow: () => ipcRenderer.send('close-resource-manager'),

  // Plugin management APIs
  scanPluginDirectory: () => ipcRenderer.invoke('scan-plugin-directory'),
  loadPluginMetadata: pluginPath => ipcRenderer.invoke('load-plugin-metadata', pluginPath),
  approveWorkingDirectory: (directoryPath, options) =>
    ipcRenderer.invoke('approve-working-directory', directoryPath, options),

  // Event listeners
  onResourceUpdate: callback => {
    ipcRenderer.on('resource-update', callback);
  },

  onResourceRemoved: callback => {
    ipcRenderer.on('resource-removed', callback);
  },

  onResourceAdded: callback => {
    ipcRenderer.on('resource-added', callback);
  },

  onMenuAction: callback => {
    if (typeof callback !== 'function') {
      return;
    }
    safeIpcRenderer.on('tool-menu-action', (event, action, data) => {
      callback(action, data);
    });
  },

  // Project Manager specific event listeners
  onCreateNewProject: callback => {
    ipcRenderer.on('create-new-project', callback);
  },

  onLoadProjectFromMenu: callback => {
    ipcRenderer.on('load-project-from-menu', callback);
  },

  // Remove listeners
  removeAllListeners: channel => {
    safeIpcRenderer.removeAllListeners(channel);
  },

  // Genomic Data Download APIs
  selectDirectory: () => ipcRenderer.invoke('selectDirectory'),
  downloadFile: (url, outputPath, projectInfo) => ipcRenderer.invoke('downloadFile', url, outputPath, projectInfo),
  getCurrentProject: () => ipcRenderer.invoke('getCurrentProject'),
  setActiveProject: projectInfo => ipcRenderer.invoke('setActiveProject', projectInfo),

  // Project opening options
  showProjectOpenDialog: projectName => ipcRenderer.invoke('show-project-open-dialog', projectName),
  openProjectInNewProcess: filePath => ipcRenderer.invoke('open-project-in-new-process', filePath),

  // Event listeners for genomic downloader
  onSetDownloadType: callback => {
    ipcRenderer.on('set-download-type', (event, downloadType) => {
      callback(downloadType);
    });
  },

  onSetActiveProject: callback => {
    ipcRenderer.on('set-active-project', (event, projectInfo) => {
      callback(projectInfo);
    });
  },

  // Window close handling
  onBeforeWindowClose: callback => {
    ipcRenderer.on('before-window-close', callback);
  },

  // File reading API for project manager
  readFile: filePath => ipcRenderer.invoke('read-file', filePath),

  // BAM reader APIs
  bamReader: {
    initialize: (filePath, options) => ipcRenderer.invoke('bam-reader:initialize', filePath, options),
    getRecordsForRange: (readerId, chromosome, start, end, settings) =>
      ipcRenderer.invoke('bam-reader:get-records-for-range', readerId, chromosome, start, end, settings),
    destroy: readerId => ipcRenderer.invoke('bam-reader:destroy', readerId),
  },

  // BLAST local runtime APIs
  blast: {
    detectInstallation: () => ipcRenderer.invoke('blast:detect-installation'),
    runCommand: options => ipcRenderer.invoke('blast:run-command', options),
    selectExecutable: () => ipcRenderer.invoke('blast:select-executable'),
    verifyExecutable: executablePath => ipcRenderer.invoke('blast:verify-executable', executablePath),
  },

  // Plugin path resolution APIs
  getPluginPaths: () => ipcRenderer.invoke('get-plugin-paths'),
  ensureDirectory: dirPath => ipcRenderer.invoke('ensure-directory', dirPath),
  listPlugins: pluginPath => ipcRenderer.invoke('list-plugins', pluginPath),

  // Plugin file loading APIs
  selectPluginFile: () => ipcRenderer.invoke('select-plugin-file'),
  getPluginFileInfo: filePath => ipcRenderer.invoke('get-plugin-file-info', filePath),
  readPluginFile: filePath => ipcRenderer.invoke('read-plugin-file', filePath),
  checkPluginFileExists: filePath => ipcRenderer.invoke('check-file-exists', filePath),
  extractPluginZip: zipPath => ipcRenderer.invoke('extract-plugin-zip', zipPath),
  copyPluginDirectory: (sourcePath, destPath) => ipcRenderer.invoke('copy-plugin-directory', sourcePath, destPath),
  copyPluginFile: (sourcePath, destPath) => ipcRenderer.invoke('copy-plugin-file', sourcePath, destPath),
  writePluginFile: (filePath, content) => ipcRenderer.invoke('write-plugin-file', filePath, content),

  // Plugin installation and persistence APIs
  writePluginFiles: options => ipcRenderer.invoke('write-plugin-files', options),
  loadPluginFromDisk: options => ipcRenderer.invoke('load-plugin-from-disk', options),
  deletePluginFiles: options => ipcRenderer.invoke('delete-plugin-files', options),

  // Utility Tools APIs
  downloadInternetFile: options => ipcRenderer.invoke('download-internet-file', options),
  openMarkdownViewer: options => ipcRenderer.invoke('open-markdown-viewer', options),

  // Dynamic tool registry APIs
  getToolRegistrySnapshot: () => ipcRenderer.invoke('tool-registry:get-snapshot'),
  getToolRegistryMetadata: () => ipcRenderer.invoke('tool-registry:get-metadata'),
  getToolDefinition: toolName => ipcRenderer.invoke('tool-registry:get-tool', toolName),
  reloadToolRegistry: () => ipcRenderer.invoke('tool-registry:reload'),
  onToolRegistryUpdated: callback => {
    if (typeof callback !== 'function') {
      return;
    }
    safeIpcRenderer.on('tool-registry-updated', (event, snapshot) => {
      callback(snapshot);
    });
  },

  // Gene Attachments APIs
  selectAttachmentFiles: options => ipcRenderer.invoke('select-attachment-files', options),
  copyAttachmentFile: (sourcePath, targetDir, filename) =>
    ipcRenderer.invoke('copy-attachment-file', sourcePath, targetDir, filename),
  deleteAttachmentFile: filePath => ipcRenderer.invoke('delete-attachment-file', filePath),
  openAttachmentFile: filePath => ipcRenderer.invoke('open-attachment-file', filePath),
  getAttachmentsStoragePath: () => ipcRenderer.invoke('get-attachments-storage-path'),

  // MCP Server APIs
  dgrMcpRequest: request => ipcRenderer.invoke('dgr-mcp-request', request),
  uploadDgrResearchDocument: options => ipcRenderer.invoke('dgr-upload-research-document', options),
  archiveDgrTaskResult: options => ipcRenderer.invoke('archive-dgr-task-result', options),
  openDgrJsonViewer: options => ipcRenderer.invoke('open-dgr-json-viewer', options),
  invoke: (channel, ...args) => {
    if (allowedInvokeChannels.includes(channel)) {
      return ipcRenderer.invoke(channel, ...args);
    }
  },
  on: (channel, callback) => {
    if (allowedListenChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },

  // Event listener for markdown viewer content loading
  onLoadMarkdown: callback => {
    ipcRenderer.on('load-markdown', (event, data) => callback(data));
  },

  // Event listener for download progress
  onDownloadProgress: callback => {
    ipcRenderer.on('download-progress', (event, data) => callback(data));
  },

  // Expose ipcRenderer for menu system event handling
  ipcRenderer: {
    on: (channel, listener) => {
      safeIpcRenderer.on(channel, listener);
    },
    send: (channel, ...args) => {
      safeIpcRenderer.send(channel, ...args);
    },
    invoke: (channel, ...args) => {
      return safeIpcRenderer.invoke(channel, ...args);
    },
    removeListener: (channel, listener) => {
      safeIpcRenderer.removeListener(channel, listener);
    },
    removeAllListeners: channel => {
      safeIpcRenderer.removeAllListeners(channel);
    },

    // ===========================================================================
    // Application Infrastructure APIs (P1 — contextIsolation migration)
    // ===========================================================================

    // Locale data loading (replaces fs-based loading in renderer)
    getLocaleData: (language, namespace) => ipcRenderer.invoke('get-locale-data', language, namespace),

    // List available locale languages
    getLocaleLanguages: () => ipcRenderer.invoke('get-locale-languages'),

    // Application paths (replaces __dirname usage in renderer)
    getAppPaths: () => ipcRenderer.invoke('get-app-paths'),

    // DOMPurify configuration (for sanitization in contextIsolation mode)
    getSanitizerConfig: () => ipcRenderer.invoke('get-sanitizer-config'),

    // Notification relay (for error reporting from main process)
    onAppNotification: callback => {
      const validTypes = ['error', 'warning', 'info', 'success'];
      ipcRenderer.on('app-notification', (event, data) => {
        if (validTypes.includes(data.type)) {
          callback(data);
        }
      });
    },
  },
});

// Provide access to node process information (for development)
contextBridge.exposeInMainWorld('nodeAPI', {
  platform: process.platform,
  version: process.version,
});

contextBridge.exposeInMainWorld('ipcRenderer', safeIpcRenderer);
contextBridge.exposeInMainWorld('require', safeRequire);
contextBridge.exposeInMainWorld('path', safePath);
contextBridge.exposeInMainWorld('os', safeOs);

console.log('Resource Manager preload script loaded');
