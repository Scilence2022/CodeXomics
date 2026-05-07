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

const { ipcMain, app, dialog, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

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
    pendingRegistrations,
    getUnifiedMCPServer,
    setUnifiedMCPServer,
    getUnifiedServerStatus,
    setUnifiedServerStatus,
    toolMenuTemplates,
    currentActiveWindow,
    fileOpenQueue,
    analyzerPendingData,
    getWindowRegistryStatus,
    syncWindowsWithMCPServer,
    registerGenomeWindow,
    unregisterGenomeWindow,
    getCurrentMainWindow,
    createMCPServerManagerWindow,
    createResourceManagerWindow,
    createDebugWindow,
    createCircosWindow,
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
    createBlastConfigWindow,
    createProGenFixerWindow,
    createDeepGeneResearchWindow,
    createChopchopWindow,
    createCustomExternalToolWindow,
    createMenu,
    createCircosPlotterMenu,
    updateMCPServerMenu,
    loadMCPServerSettings,
    saveMCPServerSettings,
    checkPortAvailable,
  } = deps;

  // =====================================================================
  // 1. Tool Execution IPC
  // =====================================================================

  // CRITICAL: IPC handler for MCP tool execution
  // This is the missing bridge between MCP server and renderer process
  ipcMain.on('tool-execution', async (event, data) => {
    console.log('[Main] Received tool execution request:', data);
    const { requestId, toolName, parameters, clientId } = data;

    try {
      if (!mainWindow || mainWindow.isDestroyed()) {
        throw new Error('Main window not available for tool execution');
      }

      // Forward the tool execution request to the renderer process
      console.log('[Main] Forwarding tool execution to renderer:', toolName);
      mainWindow.webContents.send('execute-tool-request', {
        requestId,
        toolName,
        parameters,
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
  // 2. Plugin Path Resolution IPC Handlers
  // =====================================================================

  /**
   * Get plugin paths for both built-in and user-installed plugins
   * Returns different paths based on whether app is packaged
   */
  ipcMain.handle('get-plugin-paths', async () => {
    const isDevelopment = !app.isPackaged;

    let builtinPluginsPath;
    let userPluginsPath;

    if (isDevelopment) {
      // Development: use source directory
      builtinPluginsPath = path.join(__dirname, 'renderer', 'modules', 'Plugins');
      userPluginsPath = path.join(__dirname, 'renderer', 'modules', 'Plugins', 'UserInstalled');
    } else {
      // Production: builtin plugins are in ASAR, user plugins in userData
      builtinPluginsPath = path.join(process.resourcesPath, 'app.asar', 'src', 'renderer', 'modules', 'Plugins');
      userPluginsPath = path.join(app.getPath('userData'), 'plugins');
    }

    return {
      isDevelopment,
      builtinPluginsPath,
      userPluginsPath,
    };
  });

  /**
   * Ensure a directory exists, creating it if necessary
   */
  ipcMain.handle('ensure-directory', async (event, dirPath) => {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        console.log('Created directory:', dirPath);
      }
      return { success: true, path: dirPath };
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
      if (!fs.existsSync(pluginPath)) {
        return { success: true, plugins: [] };
      }

      const items = fs.readdirSync(pluginPath, { withFileTypes: true });
      const plugins = items
        .filter(item => item.isDirectory())
        .map(item => ({
          id: item.name,
          path: path.join(pluginPath, item.name),
          hasManifest: fs.existsSync(path.join(pluginPath, item.name, 'plugin.json')),
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
    return result;
  });

  /**
   * Get plugin file information
   */
  ipcMain.handle('get-plugin-file-info', async (event, filePath) => {
    try {
      const stats = fs.statSync(filePath);
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
      return fs.readFileSync(filePath, 'utf8');
    } catch (error) {
      throw new Error(`Failed to read plugin file: ${error.message}`);
    }
  });

  /**
   * Check if file exists
   */
  ipcMain.handle('check-file-exists', async (event, filePath) => {
    return fs.existsSync(filePath);
  });

  /**
   * Scan plugin directory for all plugin files
   * Looks for both directories with plugin.json and standalone .js files
   */
  ipcMain.handle('scan-plugin-directory', async () => {
    try {
      const paths = await (async () => {
        const isDevelopment = !app.isPackaged;
        if (isDevelopment) {
          return {
            isDevelopment,
            builtinPluginsPath: path.join(__dirname, 'renderer', 'modules', 'Plugins'),
            userPluginsPath: path.join(__dirname, 'renderer', 'modules', 'Plugins', 'UserInstalled'),
          };
        } else {
          return {
            isDevelopment,
            builtinPluginsPath: path.join(process.resourcesPath, 'app.asar', 'src', 'renderer', 'modules', 'Plugins'),
            userPluginsPath: path.join(app.getPath('userData'), 'plugins'),
          };
        }
      })();

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
      const stats = fs.statSync(pluginPath);

      if (stats.isDirectory()) {
        // Try to load plugin.json
        const manifestPath = path.join(pluginPath, 'plugin.json');
        if (fs.existsSync(manifestPath)) {
          const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
          return { success: true, metadata: manifest };
        }

        // Try to load from package.json
        const packagePath = path.join(pluginPath, 'package.json');
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
      } else if (stats.isFile() && pluginPath.endsWith('.js')) {
        // Parse JavaScript file for metadata
        const content = fs.readFileSync(pluginPath, 'utf8');
        const lines = content.split('\n');

        const metadata = {
          id: path.basename(pluginPath, '.js'),
          name: path.basename(pluginPath, '.js'),
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
      // Create temp directory for extraction
      const tempDir = path.join(app.getPath('temp'), `plugin-${Date.now()}`);
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

      copyRecursive(sourcePath, destPath);
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
      const destDir = path.dirname(destPath);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }
      fs.copyFileSync(sourcePath, destPath);
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
      const dir = path.dirname(filePath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(filePath, content, 'utf8');
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
    const { pluginId, installPath, data, manifest } = options;

    console.log(`[Main] Writing plugin files for ${pluginId} to ${installPath}`);

    try {
      // Create plugin directory if it doesn't exist
      if (!fs.existsSync(installPath)) {
        fs.mkdirSync(installPath, { recursive: true });
        console.log(`[Main] Created plugin directory: ${installPath}`);
      }

      // Write manifest file (plugin.json)
      const manifestPath = path.join(installPath, 'plugin.json');
      fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      console.log(`[Main] Wrote manifest to: ${manifestPath}`);

      // Handle the plugin data
      if (data) {
        if (Array.isArray(data) && data.length > 0 && typeof data[0] === 'number') {
          // Binary data sent as byte array - could be a ZIP file
          const zipPath = path.join(installPath, `${pluginId}.zip`);
          const buffer = Buffer.from(data);
          fs.writeFileSync(zipPath, buffer);
          console.log(`[Main] Wrote ZIP file (${buffer.length} bytes): ${zipPath}`);

          // Try to extract the ZIP file using native zlib if it's a valid zip
          try {
            const AdmZip = require('adm-zip');
            const zip = new AdmZip(buffer);
            zip.extractAllTo(installPath, true);
            // Remove the zip file after extraction
            fs.unlinkSync(zipPath);
            console.log(`[Main] Extracted ZIP file to ${installPath}`);
          } catch (extractError) {
            // If adm-zip is not available or extraction fails, keep the ZIP for manual extraction
            console.log(`[Main] ZIP extraction not available, keeping ZIP file: ${extractError.message}`);
          }
        } else if (data instanceof ArrayBuffer || ArrayBuffer.isView(data)) {
          // Binary data (ArrayBuffer/TypedArray) - should not normally reach here after IPC
          const zipPath = path.join(installPath, `${pluginId}.zip`);
          const buffer = Buffer.from(data);
          fs.writeFileSync(zipPath, buffer);
          console.log(`[Main] Wrote binary data (${buffer.length} bytes): ${zipPath}`);
        } else if (typeof data === 'object' && !Array.isArray(data)) {
          // JSON package (mock package with files object)
          for (const [filename, content] of Object.entries(data)) {
            const filePath = path.join(installPath, filename);
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
      const indexPath = path.join(installPath, 'index.js');
      if (!fs.existsSync(indexPath)) {
        const defaultIndex = `// Plugin: ${pluginId}\n// Auto-generated entry point\nmodule.exports = ${JSON.stringify(manifest, null, 2)};\n`;
        fs.writeFileSync(indexPath, defaultIndex, 'utf8');
        console.log(`[Main] Created default index.js`);
      }

      console.log(`[Main] Plugin ${pluginId} installed successfully to ${installPath}`);

      return {
        success: true,
        installPath,
        files: fs.readdirSync(installPath),
      };
    } catch (error) {
      console.error(`[Main] Failed to write plugin files for ${pluginId}:`, error);
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

    console.log(`[Main] Loading plugin ${pluginId} from ${installPath}`);

    try {
      // Check if plugin directory exists
      if (!fs.existsSync(installPath)) {
        return {
          success: false,
          error: `Plugin directory not found: ${installPath}`,
        };
      }

      // Read manifest
      const manifestPath = path.join(installPath, 'plugin.json');
      if (!fs.existsSync(manifestPath)) {
        return {
          success: false,
          error: `Plugin manifest not found: ${manifestPath}`,
        };
      }

      const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

      // List all files in plugin directory
      const files = fs.readdirSync(installPath);

      // Read index.js if exists
      let indexContent = null;
      const indexPath = path.join(installPath, 'index.js');
      if (fs.existsSync(indexPath)) {
        indexContent = fs.readFileSync(indexPath, 'utf8');
      }

      console.log(`[Main] Loaded plugin ${pluginId} with ${files.length} files`);

      return {
        success: true,
        pluginId,
        manifest,
        files,
        indexContent,
        installPath,
      };
    } catch (error) {
      console.error(`[Main] Failed to load plugin ${pluginId}:`, error);
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

    console.log(`[Main] Deleting plugin ${pluginId} from ${installPath}`);

    try {
      // Check if plugin directory exists
      if (!fs.existsSync(installPath)) {
        console.log(`[Main] Plugin directory doesn't exist, nothing to delete: ${installPath}`);
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

      deleteRecursive(installPath);

      console.log(`[Main] Deleted plugin directory: ${installPath}`);

      return {
        success: true,
        pluginId,
        deletedPath: installPath,
      };
    } catch (error) {
      console.error(`[Main] Failed to delete plugin ${pluginId}:`, error);
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
      // Check file size first
      const stats = fs.statSync(filePath);
      const fileSizeMB = stats.size / (1024 * 1024);
      const extension = path.extname(filePath).toLowerCase();

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
        
        const compressedData = fs.readFileSync(filePath);
        const decompressedData = await gunzip(compressedData);
        const data = decompressedData.toString('utf8');
        return { success: true, data, isGzipped: true };
      } else {
        const data = fs.readFileSync(filePath, 'utf8');
        return { success: true, data };
      }
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Handle save dialog requests
  ipcMain.handle('show-save-dialog', async (event, options) => {
    try {
      const result = await dialog.showSaveDialog(mainWindow, options);
      return result;
    } catch (error) {
      console.error('Error showing save dialog:', error);
      return { canceled: true, error: error.message };
    }
  });

  // Handle direct file write requests
  ipcMain.handle('write-file', async (event, filePath, content) => {
    try {
      const path = require('path');

      // Ensure directory exists
      const directory = path.dirname(filePath);
      if (!fs.existsSync(directory)) {
        fs.mkdirSync(directory, { recursive: true });
      }

      // Write the file
      fs.writeFileSync(filePath, content, 'utf8');

      // Verify file was written
      if (fs.existsSync(filePath)) {
        const stats = fs.statSync(filePath);
        console.log(`File written successfully: ${filePath} (${stats.size} bytes)`);
        return {
          success: true,
          filePath: filePath,
          fileName: path.basename(filePath),
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

  // BAM file handling has been moved to renderer process using direct @gmod/bam API
  // This eliminates IPC overhead and provides better performance
  // The BamReader class in renderer/modules/BamReader.js now handles all BAM operations directly

  ipcMain.handle('read-file-stream', async (event, filePath, chunkSize = 1024 * 1024) => {
    try {
      const stats = fs.statSync(filePath);
      const fileSize = stats.size;
      let totalRead = 0;
      let buffer = '';
      let lineCount = 0;

      console.log(`Starting stream read of ${(fileSize / (1024 * 1024)).toFixed(1)} MB file: ${path.basename(filePath)}`);

      return new Promise((resolve, reject) => {
        const stream = fs.createReadStream(filePath, {
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
            reject({ success: false, error: `Error processing data chunk: ${chunkError.message}` });
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
            reject({ success: false, error: `Error finalizing stream: ${endError.message}` });
          }
        });

        stream.on('error', error => {
          console.error('Stream error:', error);
          reject({ success: false, error: `File read error: ${error.message}` });
        });
      });
    } catch (error) {
      console.error('Error setting up stream:', error);
      return { success: false, error: `Failed to set up file stream: ${error.message}` };
    }
  });

  ipcMain.handle('get-file-info', async (event, filePath) => {
    try {
      const stats = fs.statSync(filePath);
      return {
        success: true,
        info: {
          size: stats.size,
          modified: stats.mtime,
          name: path.basename(filePath),
          extension: path.extname(filePath),
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
      // Validate source file exists
      if (!fs.existsSync(sourcePath)) {
        return { success: false, error: 'Source file does not exist' };
      }

      // Ensure target directory exists
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      // Determine target path
      const targetFilename = filename || path.basename(sourcePath);
      const targetPath = path.join(targetDir, targetFilename);

      // Copy file
      fs.copyFileSync(sourcePath, targetPath);

      // Get file info
      const stats = fs.statSync(targetPath);

      console.log(`Attachment copied: ${sourcePath} -> ${targetPath}`);

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

      if (!fs.existsSync(filePath)) {
        console.log(`Attachment file does not exist, skipping deletion: ${filePath}`);
        return { success: true, message: 'File does not exist' };
      }

      fs.unlinkSync(filePath);
      console.log(`Attachment deleted: ${filePath}`);

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

      if (!fs.existsSync(filePath)) {
        return { success: false, error: 'File does not exist' };
      }

      const { shell } = require('electron');
      await shell.openPath(filePath);

      console.log(`Opened attachment: ${filePath}`);
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
      const protocol = urlObj.protocol === 'https:' ? require('https') : require('http');

      // Determine filename from URL if not provided
      const extractedFilename = filename || path.basename(urlObj.pathname) || 'downloaded_file';

      // Determine destination directory
      let destDir = destinationPath;
      if (!destDir) {
        // Default to Downloads folder in user's home directory
        destDir = path.join(app.getPath('downloads'));
      }

      // Ensure destination directory exists
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const fullPath = path.join(destDir, extractedFilename);

      return new Promise(resolve => {
        const file = fs.createWriteStream(fullPath);

        const request = protocol.get(url, response => {
          // Handle redirects
          if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            console.log(`[Download] Following redirect to: ${response.headers.location}`);
            file.close();
            fs.unlinkSync(fullPath);

            // Recursively follow redirect
            ipcMain.emit('download-internet-file', event, {
              url: response.headers.location,
              destinationPath,
              filename,
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
      console.log(`[Markdown Viewer] Opening: ${filePath}`);

      // Validate file path
      if (!filePath || typeof filePath !== 'string') {
        return { success: false, error: 'Invalid file path provided' };
      }

      // Check if file exists
      if (!fs.existsSync(filePath)) {
        return { success: false, error: `File not found: ${filePath}` };
      }

      // Check file extension
      const ext = path.extname(filePath).toLowerCase();
      if (ext !== '.md' && ext !== '.markdown') {
        console.warn(`[Markdown Viewer] File is not a markdown file: ${ext}`);
      }

      // Read the file content
      const content = fs.readFileSync(filePath, 'utf8');
      const fileName = path.basename(filePath);
      const windowTitle = title || `${fileName} - Markdown Viewer`;

      // Create viewer window
      const viewerWindow = new BrowserWindow({
        width: 900,
        height: 700,
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false,
          preload: path.join(__dirname, 'preload.js'),
        },
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
          filePath: filePath,
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
      --bg-color: #1e1e1e;
      --text-color: #d4d4d4;
      --heading-color: #569cd6;
      --link-color: #4ec9b0;
      --code-bg: #2d2d2d;
      --border-color: #3c3c3c;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      background-color: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
      padding: 40px;
      max-width: 900px;
      margin: 0 auto;
    }
    h1, h2, h3, h4, h5, h6 { color: var(--heading-color); margin: 1.5em 0 0.5em; }
    h1 { font-size: 2em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
    h2 { font-size: 1.5em; border-bottom: 1px solid var(--border-color); padding-bottom: 0.3em; }
    a { color: var(--link-color); text-decoration: none; }
    a:hover { text-decoration: underline; }
    code {
      background-color: var(--code-bg);
      padding: 0.2em 0.4em;
      border-radius: 3px;
      font-family: 'Fira Code', 'Consolas', monospace;
    }
    pre {
      background-color: var(--code-bg);
      padding: 16px;
      border-radius: 6px;
      overflow-x: auto;
      margin: 1em 0;
    }
    pre code { background: none; padding: 0; }
    blockquote {
      border-left: 4px solid var(--link-color);
      padding-left: 16px;
      margin: 1em 0;
      color: #999;
    }
    ul, ol { padding-left: 2em; margin: 1em 0; }
    table { border-collapse: collapse; width: 100%; margin: 1em 0; }
    th, td { border: 1px solid var(--border-color); padding: 8px 12px; text-align: left; }
    th { background-color: var(--code-bg); }
    img { max-width: 100%; height: auto; }
    hr { border: none; border-top: 1px solid var(--border-color); margin: 2em 0; }
    #content { padding-bottom: 40px; }
    .toolbar {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      background: var(--code-bg);
      padding: 8px 20px;
      border-bottom: 1px solid var(--border-color);
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 100;
    }
    .toolbar-title { font-weight: 500; color: var(--heading-color); }
    body { padding-top: 60px; }
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
  ipcMain.handle('mcp-server-start', async () => {
    try {
      const settings = loadMCPServerSettings();

      // Check if Unified MCP Server is already running
      if (getUnifiedServerStatus() === 'running') {
        return {
          success: true,
          message: 'Unified Claude MCP Server is already running',
          status: 'running',
          serverType: 'unified-claude-mcp',
          httpPort: settings.httpPort,
          wsPort: settings.wsPort,
        };
      }

      if (getUnifiedServerStatus() === 'starting') {
        return { success: false, message: 'Unified Claude MCP Server is already starting', status: 'starting' };
      }

      setUnifiedServerStatus('starting');

      // Pre-flight port check
      const httpCheck = await checkPortAvailable(settings.httpPort);
      const wsCheck = await checkPortAvailable(settings.wsPort);

      if (!httpCheck.available) {
        setUnifiedServerStatus('stopped');
        return {
          success: false,
          message: `HTTP port ${settings.httpPort} is already in use. Please change the port in Settings or free the port.`,
          status: 'stopped',
          conflictPort: settings.httpPort,
          conflictType: 'http',
        };
      }
      if (!wsCheck.available) {
        setUnifiedServerStatus('stopped');
        return {
          success: false,
          message: `WebSocket port ${settings.wsPort} is already in use. Please change the port in Settings or free the port.`,
          status: 'stopped',
          conflictPort: settings.wsPort,
          conflictType: 'ws',
        };
      }

      try {
        // Create Unified Claude MCP server with configurable ports
        const server = new (require('../mcp/UnifiedMCPServer'))(settings.httpPort, settings.wsPort, mainWindow);
        setUnifiedMCPServer(server);

        // Forward server log events to the Manager window
        server.on('log', logEntry => {
          if (mcpServerManagerWindow && !mcpServerManagerWindow.isDestroyed()) {
            mcpServerManagerWindow.webContents.send('mcp-server-log', logEntry);
          }
        });

        // Forward client connection events
        server.on('client-connected', data => {
          if (mcpServerManagerWindow && !mcpServerManagerWindow.isDestroyed()) {
            mcpServerManagerWindow.webContents.send('mcp-server-client-update', data);
          }
        });
        server.on('client-disconnected', data => {
          if (mcpServerManagerWindow && !mcpServerManagerWindow.isDestroyed()) {
            mcpServerManagerWindow.webContents.send('mcp-server-client-update', data);
          }
        });

        // Multi-window support: Link the authoritative windowRegistry so listWindows() always reads live data
        server.setMainWindowRegistry(windowRegistry);

        // Start the server
        await server.start();

        setUnifiedServerStatus('running');
        console.log(`Unified Claude MCP Server started successfully on ports ${settings.httpPort} (HTTP) and ${settings.wsPort} (WebSocket)`);

        // Multi-window support: Also populate the server's local IPC registry for routing
        for (const [windowId, info] of windowRegistry.entries()) {
          if (info.window && !info.window.isDestroyed()) {
            server.registerWindow(windowId, info.window);
            console.log(`[MCP Server] Registered existing window for IPC routing: ${windowId}`);
          }
        }

        return {
          success: true,
          message: 'Unified Claude MCP Server started successfully',
          status: 'running',
          serverType: 'unified-claude-mcp',
          httpPort: settings.httpPort,
          wsPort: settings.wsPort,
        };
      } catch (error) {
        setUnifiedServerStatus('stopped');
        // Clean up the server instance
        const currentServer = getUnifiedMCPServer();
        if (currentServer) {
          try { await currentServer.stop(); } catch (e) { /* ignore */ }
        }
        setUnifiedMCPServer(null);
        console.error('Failed to start Unified Claude MCP Server:', error);

        const msg = error.message || '';
        let conflictPort = null;
        let conflictType = null;
        if (msg.includes('HTTP port') && msg.includes('already in use')) {
          conflictPort = settings.httpPort;
          conflictType = 'http';
        } else if ((msg.includes('WebSocket port') || msg.includes('WS port')) && msg.includes('already in use')) {
          conflictPort = settings.wsPort;
          conflictType = 'ws';
        }

        return {
          success: false,
          message: msg || `Failed to start Unified Claude MCP Server: ${error.message}`,
          status: 'stopped',
          ...(conflictPort ? { conflictPort, conflictType } : {}),
        };
      }
    } catch (error) {
      setUnifiedServerStatus('stopped');
      return { success: false, message: error.message, status: 'stopped' };
    }
  });

  ipcMain.handle('mcp-server-stop', async () => {
    try {
      // Stop Unified MCP Server if running
      if (getUnifiedServerStatus() === 'running') {
        setUnifiedServerStatus('stopping');

        const currentServer = getUnifiedMCPServer();
        if (currentServer) {
          await currentServer.stop();
          setUnifiedMCPServer(null);
        }

        setUnifiedServerStatus('stopped');
        console.log('Unified Claude MCP Server stopped successfully');

        return {
          success: true,
          message: 'Unified Claude MCP Server stopped successfully',
          status: 'stopped',
          serverType: 'unified-claude-mcp',
        };
      }

      if (getUnifiedServerStatus() === 'stopped') {
        return { success: true, message: 'Unified Claude MCP Server is already stopped', status: 'stopped' };
      }

      if (getUnifiedServerStatus() === 'stopping') {
        return { success: false, message: 'Unified Claude MCP Server is already stopping', status: 'stopping' };
      }

      return { success: true, message: 'No MCP Server is running', status: 'stopped' };
    } catch (error) {
      setUnifiedServerStatus('stopped');
      return { success: false, message: error.message, status: 'stopped' };
    }
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
    console.log(`[IPC] Window registry status: ${status.valid} valid, ${status.destroyed} destroyed, ${status.pending} pending`);
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
    } else {
      console.warn(`[WindowRegistry] Window ${windowId} not found when updating genome name`);
    }
  });

  // Get the windowId for the sender window
  ipcMain.handle('get-window-id', async event => {
    const senderWindow = BrowserWindow.fromWebContents(event.sender);

    if (!senderWindow) {
      console.warn(`[IPC] get-window-id: sender window not found`);
      return null;
    }

    if (senderWindow.windowId) {
      return senderWindow.windowId;
    }

    // Fallback: find in registry by webContents
    for (const [windowId, info] of windowRegistry.entries()) {
      if (info.window && !info.window.isDestroyed() && info.window.webContents === event.sender) {
        console.log(`[IPC] get-window-id: found ${windowId} via registry fallback`);
        return windowId;
      }
    }

    // Last resort: try to find by window ID stored on webContents
    const allWindows = BrowserWindow.getAllWindows();
    for (const win of allWindows) {
      if (!win.isDestroyed() && win.webContents === event.sender && win.windowId) {
        console.log(`[IPC] get-window-id: found ${win.windowId} via BrowserWindow.getAllWindows()`);
        return win.windowId;
      }
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
        webPreferences: {
          nodeIntegration: false,
          contextIsolation: true,
          enableRemoteModule: false,
          preload: path.join(__dirname, 'preload.js'),
        },
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
      if (mainWindow) {
        mainWindow.webContents.send('collect-resource-info');
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
      if (mainWindow) {
        mainWindow.webContents.send('open-resource', resourceId);
      }
      return { success: true, message: 'Resource opened in browser' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('select-and-load-file', async () => {
    try {
      const { dialog } = require('electron');
      const result = await dialog.showOpenDialog(mainWindow, {
        properties: ['openFile'],
        filters: [
          {
            name: 'Genome Files',
            extensions: ['fasta', 'fa', 'gff', 'gff3', 'gtf', 'vcf', 'bam', 'sam', 'wig', 'bw', 'bigwig', 'fastq', 'fq'],
          },
          { name: 'All Files', extensions: ['*'] },
        ],
      });

      if (!result.canceled && result.filePaths.length > 0) {
        const filePath = result.filePaths[0];
        // Send to main window for loading
        mainWindow.webContents.send('load-file', filePath);
        return { success: true, filePath };
      }

      return { success: false, canceled: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('send-to-main-window', async (event, channel, data) => {
    try {
      if (mainWindow) {
        mainWindow.webContents.send(channel, data);
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
      if (mcpServerManagerWindow && !mcpServerManagerWindow.isDestroyed()) {
        mcpServerManagerWindow.webContents.send('sync-theme', themeData);
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

      return { success: sent };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  // Theme sync: PM window requests current theme on load
  ipcMain.handle('request-current-theme', async () => {
    try {
      // Forward the request to main window, which has ThemeManager
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('request-theme-for-pm');
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
        webPreferences: {
          nodeIntegration: true,
          contextIsolation: false,
          enableRemoteModule: true,
          webSecurity: false,

          allowRunningInsecureContent: true,
          // Explicitly disable sandbox to prevent /tmp access issues on Linux
          sandbox: false,
        },
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
      if (mainWindow && !mainWindow.isDestroyed()) {
        debugWindow.setParentWindow(mainWindow);
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
  ipcMain.handle('get-circos-genome-data', async event => {
    try {
      // Get the sender window (Circos window)
      const senderWindow = BrowserWindow.fromWebContents(event.sender);

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
                    annotations.forEach(annotation => {
                      // Skip source features as they cover the entire genome and obscure other genes
                      if (annotation.type === 'source') {
                        console.log('Skipping source feature:', annotation);
                        return;
                      }
                      
                      // Extract gene information from qualifiers
                      const geneName = annotation.qualifiers?.gene || annotation.qualifiers?.locus_tag || 'Unknown';
                      const locusTag = annotation.qualifiers?.locus_tag || annotation.qualifiers?.gene || \`feature_\${genes.length}\`;
                      const product = annotation.qualifiers?.product || annotation.qualifiers?.note || 'Unknown function';
                      
                      // Determine feature type - keep original types for better classification
                      let featureType = annotation.type || 'other';
                      
                      // Debug: Log original annotation type
                      if (genes.length < 20) { // Only log first 20 for debugging
                        console.log('Annotation type:', annotation.type, '-> Feature type:', featureType);
                      }
                      
                      // Only map general types, keep specific types like tRNA, rRNA as-is
                      if (featureType === 'gene' || featureType === 'CDS' || featureType === 'mRNA') {
                        featureType = 'protein_coding';
                      } else if (featureType === 'ncRNA') {
                        featureType = 'non_coding';
                      } else if (featureType === 'pseudogene') {
                        featureType = 'pseudogene';
                      } else if (featureType === 'regulatory' || featureType === 'promoter' || featureType === 'terminator') {
                        featureType = 'regulatory';
                      }
                      // Keep tRNA, rRNA, and other specific types as-is for proper classification
                      
                      // Convert strand from -1/1 to +/- format
                      const strand = annotation.strand === -1 ? '-' : '+';
                      
                      // Validate gene coordinates
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
                originalData: genomeData
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
                if (window.genomeBrowser.navigateToPosition) {
                  window.genomeBrowser.navigateToPosition(${geneData.start}, ${geneData.end});
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
      const senderWindow = BrowserWindow.fromWebContents(event.sender);

      if (senderWindow && senderWindow.mainWindow) {
        const result = await senderWindow.mainWindow.webContents.executeJavaScript(`
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
      const senderWindow = BrowserWindow.fromWebContents(event.sender);

      if (senderWindow && senderWindow.mainWindow) {
        const result = await senderWindow.mainWindow.webContents.executeJavaScript(`
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
      case 'toggle-fullscreen':
        const window = BrowserWindow.fromWebContents(webContents);
        if (window) {
          window.setFullScreen(!window.isFullScreen());
        }
        break;
      default:
        console.log('Unknown Deep Gene Research menu action:', action);
    }
  });

  // =====================================================================
  // 14. Settings & Evo2 IPC Handlers
  // =====================================================================

  // Helper functions for user notifications
  function showSettingsWarning(title, message) {
    const mainWindow = getCurrentMainWindow();
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('show-notification', {
        type: 'warning',
        title: title,
        message: message,
        duration: 5000,
      });
    }
  }

  function showSettingsError(title, message) {
    const mainWindow = getCurrentMainWindow();
    if (mainWindow && mainWindow.webContents) {
      mainWindow.webContents.send('show-notification', {
        type: 'error',
        title: title,
        message: message,
        duration: 8000,
      });
    }
  }

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

  // Evo2 configuration IPC handlers
  ipcMain.handle('evo2-get-config', async () => {
    try {
      // Get the main window to access ConfigManager
      const mainWindow = getCurrentMainWindow();
      if (mainWindow && mainWindow.webContents) {
        const config = await mainWindow.webContents.executeJavaScript(`
          if (window.genomeBrowser && window.genomeBrowser.configManager) {
            window.genomeBrowser.configManager.getEvo2Config();
          } else {
            Promise.resolve({});
          }
        `);
        return config;
      }
      return {};
    } catch (error) {
      console.error('Error getting Evo2 config:', error);
      return {};
    }
  });

  ipcMain.handle('evo2-set-config', async (event, config) => {
    try {
      const mainWindow = getCurrentMainWindow();
      if (mainWindow && mainWindow.webContents) {
        await mainWindow.webContents.executeJavaScript(`
          if (window.genomeBrowser && window.genomeBrowser.configManager) {
            window.genomeBrowser.configManager.setEvo2Config(${JSON.stringify(config)});
          }
        `);
        return { success: true };
      }
      return { success: false, error: 'Main window not available' };
    } catch (error) {
      console.error('Error setting Evo2 config:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('evo2-get-api-key', async () => {
    try {
      const mainWindow = getCurrentMainWindow();
      if (mainWindow && mainWindow.webContents) {
        const apiKey = await mainWindow.webContents.executeJavaScript(`
          if (window.genomeBrowser && window.genomeBrowser.configManager) {
            window.genomeBrowser.configManager.getEvo2ApiKey();
          } else {
            Promise.resolve('');
          }
        `);
        return apiKey;
      }
      return '';
    } catch (error) {
      console.error('Error getting Evo2 API key:', error);
      return '';
    }
  });

  ipcMain.handle('evo2-set-api-key', async (event, apiKey) => {
    try {
      const mainWindow = getCurrentMainWindow();
      if (mainWindow && mainWindow.webContents) {
        await mainWindow.webContents.executeJavaScript(`
          if (window.genomeBrowser && window.genomeBrowser.configManager) {
            window.genomeBrowser.configManager.setEvo2ApiKey('${apiKey}');
          }
        `);
        return { success: true };
      }
      return { success: false, error: 'Main window not available' };
    } catch (error) {
      console.error('Error setting Evo2 API key:', error);
      return { success: false, error: error.message };
    }
  });

  ipcMain.handle('evo2-get-analysis-history', async () => {
    try {
      const mainWindow = getCurrentMainWindow();
      if (mainWindow && mainWindow.webContents) {
        const history = await mainWindow.webContents.executeJavaScript(`
          if (window.genomeBrowser && window.genomeBrowser.configManager) {
            window.genomeBrowser.configManager.getEvo2AnalysisHistory();
          } else {
            Promise.resolve([]);
          }
        `);
        return history;
      }
      return [];
    } catch (error) {
      console.error('Error getting Evo2 analysis history:', error);
      return [];
    }
  });

  ipcMain.handle('evo2-set-analysis-history', async (event, history) => {
    try {
      const mainWindow = getCurrentMainWindow();
      if (mainWindow && mainWindow.webContents) {
        await mainWindow.webContents.executeJavaScript(`
          if (window.genomeBrowser && window.genomeBrowser.configManager) {
            window.genomeBrowser.configManager.setEvo2AnalysisHistory(${JSON.stringify(history)});
          }
        `);
        return { success: true };
      }
      return { success: false, error: 'Main window not available' };
    } catch (error) {
      console.error('Error setting Evo2 analysis history:', error);
      return { success: false, error: error.message };
    }
  });

  // =====================================================================
  // 15. System Checks IPC Handlers
  // =====================================================================

  // IPC handler for BLAST installation check
  ipcMain.on('check-blast-installation', event => {
    console.log('IPC: Checking BLAST installation...');
    const { exec } = require('child_process');
    const path = require('path');
    const fs = require('fs');
    const os = require('os');

    // Function to check BLAST+ at specific path
    function checkBlastAtPath(blastPath) {
      return new Promise(resolve => {
        const command = `"${blastPath}" -version`;
        console.log('Checking BLAST at:', command);

        exec(command, (error, stdout, stderr) => {
          if (error) {
            resolve({ found: false, error: error.message });
          } else {
            const versionMatch = stdout.match(/blastn: ([\d.]+)/);
            const version = versionMatch ? versionMatch[1] : 'Unknown version';
            resolve({
              found: true,
              version: version,
              path: blastPath,
              output: stdout,
            });
          }
        });
      });
    }

    // Function to find BLAST+ executable
    async function findBlastExecutable() {
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

      // First try direct command execution (for PATH-based installations)
      try {
        const result = await checkBlastAtPath('blastn');
        if (result.found) {
          return result;
        }
      } catch (error) {
        console.log('Direct blastn command failed, trying specific paths...');
      }

      // Try specific paths
      for (const blastPath of commonPaths) {
        try {
          if (fs.existsSync(blastPath)) {
            const result = await checkBlastAtPath(blastPath);
            if (result.found) {
              return result;
            }
          }
        } catch (error) {
          continue;
        }
      }

      return { found: false, error: 'BLAST+ not found in any common locations' };
    }

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
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.focus();
      mainWindow.show();
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
