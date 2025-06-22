const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const MCPGenomeBrowserServer = require('./mcp-server');

let mainWindow;
let mcpServer = null;
let mcpServerStatus = 'stopped'; // 'stopped', 'starting', 'running', 'stopping'

function createWindow() {
  // Create the browser window
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
      cache: false
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false
  });

  // Load the app
  mainWindow.loadFile(path.join(__dirname, 'renderer/index.html'));

  // Clear cache aggressively to ensure fresh file loading
  mainWindow.webContents.session.clearCache();
  mainWindow.webContents.session.clearStorageData();
  
  // Force reload after cache clear
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.webContents.reload();
  });

  // Show window when ready to prevent visual flash
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
  });

  // Open DevTools to debug UI issues (temporarily enabled for debugging)
  mainWindow.webContents.openDevTools();

  // Handle window closed
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

// Create menu
function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Open File',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'All Genome Files', extensions: ['fasta', 'fa', 'gb', 'gbk', 'genbank', 'gff', 'gtf', 'bed', 'vcf', 'bam', 'sam'] },
                { name: 'FASTA Files', extensions: ['fasta', 'fa'] },
                { name: 'GenBank Files', extensions: ['gb', 'gbk', 'genbank'] },
                { name: 'Annotation Files', extensions: ['gff', 'gtf', 'bed'] },
                { name: 'Variant Files', extensions: ['vcf'] },
                { name: 'Alignment Files', extensions: ['bam', 'sam'] },
                { name: 'All Files', extensions: ['*'] }
              ]
            });
            
            if (!result.canceled && result.filePaths.length > 0) {
              mainWindow.webContents.send('file-opened', result.filePaths[0]);
            }
          }
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => {
            mainWindow.webContents.send('menu-copy');
          }
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => {
            mainWindow.webContents.send('menu-paste');
          }
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            mainWindow.webContents.send('menu-select-all');
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Show File Information',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            mainWindow.webContents.send('show-panel', 'fileInfoSection');
          }
        },
        {
          label: 'Show Navigation',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            mainWindow.webContents.send('show-panel', 'navigationSection');
          }
        },
        {
          label: 'Show Statistics',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            mainWindow.webContents.send('show-panel', 'statisticsSection');
          }
        },
        {
          label: 'Show All Panels',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            mainWindow.webContents.send('show-all-panels');
          }
        },
        { type: 'separator' },
        {
          label: 'Show Tracks Panel',
          accelerator: 'CmdOrCtrl+4',
          click: () => {
            mainWindow.webContents.send('show-panel', 'tracksSection');
          }
        },
        {
          label: 'Show Features Panel',
          accelerator: 'CmdOrCtrl+5',
          click: () => {
            mainWindow.webContents.send('show-panel', 'featuresSection');
          }
        },
        { type: 'separator' },
        {
          label: 'Resource Manager',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            mainWindow.webContents.send('open-resource-manager');
          }
        }
      ]
    },
    {
      label: 'Tools',
      submenu: [
        {
          label: 'Search Sequence',
          accelerator: 'CmdOrCtrl+F',
          click: () => {
            mainWindow.webContents.send('show-search');
          }
        },
        {
          label: 'Go to Position',
          accelerator: 'CmdOrCtrl+G',
          click: () => {
            mainWindow.webContents.send('show-goto');
          }
        },
        { type: 'separator' },
        {
          label: 'Circos Genome Plotter',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            createCircosWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Conversation Evolution System',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            createEvolutionWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'CRISPR Guide RNA Design',
          accelerator: 'CmdOrCtrl+Shift+G',
          click: () => {
            createCrisprDesignerWindow();
          }
        },
        { type: 'separator' },
        {
          label: 'Visualization Tools',
          submenu: [
            {
              label: 'Network Graph Viewer',
              click: () => {
                mainWindow.webContents.send('open-visualization-tool', 'network-graph');
              }
            },
            {
              label: 'Protein Interaction Network',
              click: () => {
                mainWindow.webContents.send('open-visualization-tool', 'protein-interaction-network');
              }
            },
            {
              label: 'Gene Regulatory Network',
              click: () => {
                mainWindow.webContents.send('open-visualization-tool', 'gene-regulatory-network');
              }
            },
            {
              label: 'Phylogenetic Tree Viewer',
              click: () => {
                mainWindow.webContents.send('open-visualization-tool', 'phylogenetic-tree');
              }
            },
            {
              label: 'Sequence Alignment Viewer',
              click: () => {
                mainWindow.webContents.send('open-visualization-tool', 'sequence-alignment');
              }
            }
          ]
        }
      ]
    },
    {
      label: 'Options',
      submenu: [
        {
          label: 'Configure LLMs',
          click: () => {
            mainWindow.webContents.send('configure-llms');
          }
        },
        { type: 'separator' },
        {
          label: 'ChatBox Settings',
          click: () => {
            mainWindow.webContents.send('chatbox-settings');
          }
        },
        { type: 'separator' },
        {
          label: 'MCP Server Settings',
          click: () => {
            mainWindow.webContents.send('mcp-settings');
          }
        },
        { type: 'separator' },
        {
          label: 'General Settings',
          click: () => {
            mainWindow.webContents.send('general-settings');
          }
        }
      ]
    },
    {
      label: 'Plugins',
      submenu: [
        {
          label: 'Plugin Management',
          accelerator: 'CmdOrCtrl+Shift+P',
          click: () => {
            mainWindow.webContents.send('show-plugin-management');
          }
        },
        { type: 'separator' },
        {
          label: 'Smart Execution Demo',
          click: () => {
            mainWindow.webContents.send('show-smart-execution-demo');
          }
        },
        {
          label: 'Plugin Function Calling Test',
          click: () => {
            mainWindow.webContents.send('show-plugin-function-calling-test');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Genome AI Studio',
              message: 'Genome AI Studio v1.0 beta',
              detail: 'A modern AI-powered genome analysis studio built with Electron'
            });
          }
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

// App event listeners
app.whenReady().then(() => {
  createWindow();
  createMenu();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Clean up MCP server when app is quitting
app.on('before-quit', () => {
  if (mcpServer) {
    console.log('Shutting down MCP Server...');
    mcpServer.stop();
    mcpServer = null;
  }
});

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
        fileSize: stats.size
      };
    }
    
    // For files larger than 500MB, refuse to read entirely into memory
    // JavaScript has a string length limit of ~512MB
    if (fileSizeMB > 500) {
      return { 
        success: false, 
        error: `File is too large (${fileSizeMB.toFixed(1)} MB) to read into memory. Use streaming mode instead.`,
        requiresStreaming: true,
        fileSize: stats.size
      };
    }
    
    // For files larger than 100MB, warn but allow
    if (fileSizeMB > 100) {
      console.warn(`Reading large file into memory: ${fileSizeMB.toFixed(1)} MB`);
    }
    
    const data = fs.readFileSync(filePath, 'utf8');
    return { success: true, data };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// BAM file handlers
let bamFiles = new Map(); // Cache BAM file instances

ipcMain.handle('bam-initialize', async (event, filePath) => {
  try {
    console.log('Initializing BAM file:', filePath);
    
    // Import BAM libraries - use the newer bamPath approach to avoid buffer issues
    const { BamFile } = require('@gmod/bam');
    
    // Check if BAI index exists
    let baiPath = null;
    const standardBaiPath = filePath + '.bai';
    if (fs.existsSync(standardBaiPath)) {
      baiPath = standardBaiPath;
      console.log('Found BAI index:', baiPath);
    } else {
      const altBaiPath = filePath.replace('.bam', '.bai');
      if (fs.existsSync(altBaiPath)) {
        baiPath = altBaiPath;
        console.log('Found BAI index:', altBaiPath);
      } else {
        console.warn('No BAI index found. Performance may be slower for large files.');
      }
    }
    
    // Create BAM file instance using direct path (avoids buffer issues)
    // This approach uses the built-in LocalFile handling within @gmod/bam
    const bamFileConfig = {
      bamPath: filePath
    };
    
    // Add BAI path if available
    if (baiPath) {
      bamFileConfig.baiPath = baiPath;
    }
    
    // Optional: Add cache configuration
    bamFileConfig.cacheSize = 100;
    bamFileConfig.yieldThreadTime = 100;
    
    console.log('Creating BAM file instance with config:', bamFileConfig);
    const bamFile = new BamFile(bamFileConfig);
    
    // Get header first - this is required before any other operations
    console.log('Getting BAM header...');
    const header = await bamFile.getHeader();
    console.log('BAM header retrieved successfully');
    console.log('Header references:', header.references?.length || 0);
    
    // Get file size
    const stats = fs.statSync(filePath);
    
    // Try to estimate total reads more safely
    let totalReads = 0;
    if (baiPath && header.references && header.references.length > 0) {
      // Try to get counts for first few references only to avoid errors
      const maxRefsToCheck = Math.min(3, header.references.length);
      console.log(`Checking read counts for ${maxRefsToCheck} references...`);
      
      for (let i = 0; i < maxRefsToCheck; i++) {
        const ref = header.references[i];
        try {
          const count = await bamFile.lineCount(ref.name);
          if (count && count > 0) {
            totalReads += count;
            console.log(`Reference ${ref.name}: ${count} reads`);
          }
        } catch (error) {
          console.warn(`Error counting reads for ${ref.name}:`, error.message);
          // Continue with other references
        }
      }
      
      // If we got some counts but not all refs, estimate the rest
      if (totalReads > 0 && maxRefsToCheck < header.references.length) {
        const avgPerRef = totalReads / maxRefsToCheck;
        totalReads += avgPerRef * (header.references.length - maxRefsToCheck);
        console.log(`Estimated total reads: ${Math.floor(totalReads)}`);
      }
    }
    
    // If we couldn't get counts from index, estimate based on file size
    if (totalReads === 0) {
      totalReads = Math.floor(stats.size / 100); // Rough estimate: ~100 bytes per read
      console.log(`Estimated reads from file size: ${totalReads}`);
    }
    
    // Cache the BAM file instance
    bamFiles.set(filePath, bamFile);
    
    const result = {
      success: true,
      header: header,
      references: header.references || [],
      totalReads: Math.floor(totalReads),
      fileSize: stats.size
    };
    
    console.log('BAM initialization successful:', {
      references: result.references.length,
      totalReads: result.totalReads,
      fileSize: `${(result.fileSize / (1024 * 1024)).toFixed(2)} MB`
    });
    
    return result;
  } catch (error) {
    console.error('Error initializing BAM file:', error);
    console.error('Error stack:', error.stack);
    
    // Clean up any cached instance
    bamFiles.delete(filePath);
    return {
      success: false,
      error: `Failed to initialize BAM file: ${error.message}. Please ensure the BAM file is properly formatted and not corrupted.`
    };
  }
});

ipcMain.handle('bam-get-reads', async (event, params) => {
  try {
    const { filePath, chromosome, start, end } = params;
    
    console.log(`Getting BAM reads for ${chromosome}:${start}-${end}`);
    
    // Get cached BAM file instance
    const bamFile = bamFiles.get(filePath);
    if (!bamFile) {
      throw new Error('BAM file not initialized. Please reinitialize the BAM file.');
    }
    
    // Validate input parameters
    if (!chromosome || typeof chromosome !== 'string') {
      throw new Error('Invalid chromosome parameter');
    }
    
    if (typeof start !== 'number' || typeof end !== 'number' || start < 0 || end < start) {
      throw new Error('Invalid start/end coordinates');
    }
    
    // Limit the query range to prevent excessive memory usage
    const maxRangeSize = 10000000; // 10MB max range
    if (end - start > maxRangeSize) {
      throw new Error(`Query range too large. Maximum range size is ${maxRangeSize} bases.`);
    }
    
    // Get records from BAM file using the correct API
    // Note: @gmod/bam uses 0-based half-open coordinates
    console.log(`Fetching records for range ${chromosome}:${start}-${end}`);
    const records = await bamFile.getRecordsForRange(chromosome, start, end);
    
    console.log(`Retrieved ${records.length} raw records from BAM file`);
    
    // Convert records to our internal format with better error handling
    const reads = [];
    for (let i = 0; i < records.length; i++) {
      try {
        const record = records[i];
        
        const read = {
          id: record.name || record.qname || `read_${i}`,
          chromosome: record.refName || chromosome,
          start: record.start,
          end: record.end,
          strand: (record.strand === 1 || record.strand === '+') ? '+' : '-',
          mappingQuality: record.mq || record.mapq || 0,
          cigar: record.CIGAR || record.cigar || '',
          sequence: record.seq || '',
          quality: record.qual || '',
          flags: record.flags || 0,
          templateLength: record.template_length || record.tlen || 0,
          tags: record.tags || {}
        };
        
        reads.push(read);
      } catch (recordError) {
        console.warn(`Error processing record ${i}:`, recordError.message);
        // Continue processing other records
      }
    }
    
    console.log(`Successfully converted ${reads.length} BAM reads`);
    
    return {
      success: true,
      reads: reads
    };
  } catch (error) {
    console.error('Error getting BAM reads:', error);
    console.error('Error stack:', error.stack);
    return {
      success: false,
      error: `Failed to read BAM records: ${error.message}`
    };
  }
});

// Clean up BAM files when app is quitting
app.on('before-quit', () => {
  bamFiles.clear();
});

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
        highWaterMark: chunkSize 
      });
      
      stream.on('data', (chunk) => {
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
          if (totalRead % (50 * 1024 * 1024) === 0) { // Every 50MB
            console.log(`Stream progress: ${(totalRead / (1024 * 1024)).toFixed(1)} MB / ${(fileSize / (1024 * 1024)).toFixed(1)} MB`);
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
      
      stream.on('error', (error) => {
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
        extension: path.extname(filePath)
      }
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Add MCP Server IPC handlers
ipcMain.handle('mcp-server-start', async () => {
  try {
    if (mcpServerStatus === 'running') {
      return { 
        success: true, 
        message: 'MCP Server is already running', 
        status: 'running',
        httpPort: 3000,
        wsPort: 3001
      };
    }
    
    if (mcpServerStatus === 'starting') {
      return { success: false, message: 'MCP Server is already starting', status: 'starting' };
    }

    mcpServerStatus = 'starting';
    
    try {
      // Create MCP server
      mcpServer = new MCPGenomeBrowserServer(3000, 3001);
      
      // Start the server (now async)
      const startResult = await mcpServer.start();
      
      mcpServerStatus = 'running';
      console.log('MCP Server started successfully');
      
      return { 
        success: true, 
        message: startResult.message, 
        status: 'running',
        httpPort: startResult.httpPort,
        wsPort: startResult.wsPort
      };
    } catch (error) {
      mcpServerStatus = 'stopped';
      mcpServer = null; // Clear the server instance on failure
      console.error('Failed to start MCP Server:', error);
      
      return { 
        success: false, 
        message: `Failed to start MCP Server: ${error.message}`, 
        status: 'stopped' 
      };
    }
  } catch (error) {
    mcpServerStatus = 'stopped';
    return { success: false, message: error.message, status: 'stopped' };
  }
});

ipcMain.handle('mcp-server-stop', async () => {
  try {
    if (mcpServerStatus === 'stopped') {
      return { success: true, message: 'MCP Server is already stopped', status: 'stopped' };
    }
    
    if (mcpServerStatus === 'stopping') {
      return { success: false, message: 'MCP Server is already stopping', status: 'stopping' };
    }

    mcpServerStatus = 'stopping';
    
    if (mcpServer) {
      mcpServer.stop();
      mcpServer = null;
    }
    
    mcpServerStatus = 'stopped';
    console.log('MCP Server stopped successfully');
    
    return { 
      success: true, 
      message: 'MCP Server stopped successfully', 
      status: 'stopped' 
    };
  } catch (error) {
    mcpServerStatus = 'stopped';
    return { success: false, message: error.message, status: 'stopped' };
  }
});

ipcMain.handle('mcp-server-status', async () => {
  return { 
    status: mcpServerStatus,
    isRunning: mcpServerStatus === 'running',
    httpPort: mcpServerStatus === 'running' ? 3000 : null,
    wsPort: mcpServerStatus === 'running' ? 3001 : null
  };
});

// Handle opening smart execution demo
ipcMain.on('open-smart-execution-demo', (event) => {
  try {
    // Create a new window for the Smart Execution Demo
    const demoWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false
      },
      title: 'Smart Execution Demo - GenomeExplorer',
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      show: false // Don't show until ready
    });

    const demoPath = path.join(__dirname, '..', 'test', 'smart-execution-demo.html');
    
    // Check if file exists
    if (fs.existsSync(demoPath)) {
      demoWindow.loadFile(demoPath);
    } else {
      console.error('Smart execution demo file not found:', demoPath);
      // Try alternative path (for development)
      const altPath = path.join(__dirname, 'test', 'smart-execution-demo.html');
      if (fs.existsSync(altPath)) {
        demoWindow.loadFile(altPath);
      } else {
        console.error('Smart execution demo file not found at alternative path:', altPath);
        demoWindow.destroy();
        return;
      }
    }

    // Show window when ready
    demoWindow.once('ready-to-show', () => {
      demoWindow.show();
    });

    // Handle window closed
    demoWindow.on('closed', () => {
      console.log('Smart Execution Demo window closed');
    });

  } catch (error) {
    console.error('Failed to open smart execution demo:', error);
  }
});

// Handle opening resource manager
ipcMain.on('open-resource-manager', (event) => {
  try {
    // Create new window for the resource manager
    const resourceManagerWindow = new BrowserWindow({
      width: 1000,
      height: 700,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false,
        preload: path.join(__dirname, 'preload.js')
      },
      title: 'Resource Manager - GenomeExplorer',
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      resizable: true,
      minimizable: true,
      maximizable: true,
      show: false
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
          source: 'NCBI'
        }
      }
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
        { name: 'Genome Files', extensions: ['fasta', 'fa', 'gff', 'gff3', 'gtf', 'vcf', 'bam', 'sam', 'wig', 'bigwig', 'fastq', 'fq'] },
        { name: 'All Files', extensions: ['*'] }
      ]
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

// Create Circos Window Function
function createCircosWindow() {
  try {
    // Create new window for the Circos genome plotter
    const circosWindow = new BrowserWindow({
      width: 1400,
      height: 900,
      minWidth: 1000,
      minHeight: 700,
      webPreferences: {
        nodeIntegration: true,
        contextIsolation: false,
        enableRemoteModule: true,
        webSecurity: false
      },
      title: 'Circos Genome Plotter - GenomeExplorer',
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      show: false
    });

    const circosPath = path.join(__dirname, 'circos-plotter.html');
    
    // Load the Circos plotter HTML
    circosWindow.loadFile(circosPath);

    // Show window when ready
    circosWindow.once('ready-to-show', () => {
      circosWindow.show();
    });

    // Open DevTools for debugging
    circosWindow.webContents.openDevTools();

    // Handle window closed
    circosWindow.on('closed', () => {
      console.log('Circos Genome Plotter window closed');
    });

  } catch (error) {
    console.error('Failed to open Circos Genome Plotter:', error);
  }
}

// Create CRISPR Designer window
function createCrisprDesignerWindow() {
  const crisprWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      webSecurity: false
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false
  });

  crisprWindow.loadFile(path.join(__dirname, 'crispr-designer.html'));

  crisprWindow.once('ready-to-show', () => {
    crisprWindow.show();
  });

  // Open DevTools for debugging
  crisprWindow.webContents.openDevTools();

  crisprWindow.on('closed', () => {
    // Dereference the window object
  });
}

// Create Conversation Evolution System window
function createEvolutionWindow() {
  const evolutionWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
      enableRemoteModule: true,
      webSecurity: false,
      cache: false
    },
    icon: path.join(__dirname, '../assets/icon.png'),
    show: false,
    title: 'Conversation Evolution System'
  });

  // Load the evolution system HTML
  evolutionWindow.loadFile(path.join(__dirname, 'conversation-evolution.html'));

  // Clear cache aggressively to ensure fresh file loading
  evolutionWindow.webContents.session.clearCache();
  evolutionWindow.webContents.session.clearStorageData();
  
  // Force reload after cache clear
  evolutionWindow.webContents.once('did-finish-load', () => {
    evolutionWindow.webContents.reload();
  });

  // Show window when ready to prevent visual flash
  evolutionWindow.once('ready-to-show', () => {
    evolutionWindow.show();
  });

  // Open DevTools for debugging
  evolutionWindow.webContents.openDevTools();

  // Create evolution-specific menu
  const evolutionMenuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Export Evolution Data',
          accelerator: 'CmdOrCtrl+E',
          click: () => {
            evolutionWindow.webContents.send('export-evolution-data');
          }
        },
        {
          label: 'Import Evolution Data',
          accelerator: 'CmdOrCtrl+I',
          click: () => {
            evolutionWindow.webContents.send('import-evolution-data');
          }
        },
        { type: 'separator' },
        {
          label: 'Close Window',
          accelerator: 'CmdOrCtrl+W',
          click: () => {
            evolutionWindow.close();
          }
        }
      ]
    },
    {
      label: 'Evolution',
      submenu: [
        {
          label: 'Start Evolution Process',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => {
            evolutionWindow.webContents.send('start-evolution');
          }
        },
        {
          label: 'Stop Evolution Process',
          accelerator: 'CmdOrCtrl+Shift+T',
          click: () => {
            evolutionWindow.webContents.send('stop-evolution');
          }
        },
        { type: 'separator' },
        {
          label: 'Refresh Data',
          accelerator: 'CmdOrCtrl+R',
          click: () => {
            evolutionWindow.webContents.send('refresh-evolution-data');
          }
        },
        {
          label: 'Clear All Data',
          accelerator: 'CmdOrCtrl+Shift+C',
          click: () => {
            evolutionWindow.webContents.send('clear-evolution-data');
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' },
        { type: 'separator' },
        {
          label: 'Conversation History',
          accelerator: 'CmdOrCtrl+1',
          click: () => {
            evolutionWindow.webContents.send('switch-tab', 'conversations');
          }
        },
        {
          label: 'Missing Features',
          accelerator: 'CmdOrCtrl+2',
          click: () => {
            evolutionWindow.webContents.send('switch-tab', 'missing');
          }
        },
        {
          label: 'Generated Plugins',
          accelerator: 'CmdOrCtrl+3',
          click: () => {
            evolutionWindow.webContents.send('switch-tab', 'plugins');
          }
        },
        {
          label: 'Evolution Process',
          accelerator: 'CmdOrCtrl+4',
          click: () => {
            evolutionWindow.webContents.send('switch-tab', 'evolution');
          }
        },
        {
          label: 'Evolution Reports',
          accelerator: 'CmdOrCtrl+5',
          click: () => {
            evolutionWindow.webContents.send('switch-tab', 'reports');
          }
        }
      ]
    },
    {
      label: 'Plugins',
      submenu: [
        {
          label: 'Generate Plugin for Selected',
          accelerator: 'CmdOrCtrl+G',
          click: () => {
            evolutionWindow.webContents.send('generate-plugins-for-selected');
          }
        },
        {
          label: 'Test Selected Plugins',
          accelerator: 'CmdOrCtrl+T',
          click: () => {
            evolutionWindow.webContents.send('test-selected-plugins');
          }
        },
        {
          label: 'Install Selected Plugins',
          accelerator: 'CmdOrCtrl+Shift+I',
          click: () => {
            evolutionWindow.webContents.send('install-selected-plugins');
          }
        },
        { type: 'separator' },
        {
          label: 'Export Selected Plugins',
          accelerator: 'CmdOrCtrl+Shift+E',
          click: () => {
            evolutionWindow.webContents.send('export-selected-plugins');
          }
        }
      ]
    },
    {
      label: 'Analysis',
      submenu: [
        {
          label: 'Analyze Selected Conversations',
          accelerator: 'CmdOrCtrl+A',
          click: () => {
            evolutionWindow.webContents.send('analyze-selected-conversations');
          }
        },
        {
          label: 'Generate Evolution Report',
          accelerator: 'CmdOrCtrl+Shift+R',
          click: () => {
            evolutionWindow.webContents.send('generate-evolution-report');
          }
        },
        { type: 'separator' },
        {
          label: 'Mark as Resolved',
          accelerator: 'CmdOrCtrl+M',
          click: () => {
            evolutionWindow.webContents.send('mark-as-resolved');
          }
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'Evolution System Guide',
          click: () => {
            evolutionWindow.webContents.send('show-evolution-guide');
          }
        },
        {
          label: 'About Evolution System',
          click: () => {
            dialog.showMessageBox(evolutionWindow, {
              type: 'info',
              title: 'About Conversation Evolution System',
              message: 'Conversation Evolution System v1.0',
              detail: 'AI-powered conversation analysis and plugin generation system for Genome AI Studio'
            });
          }
        }
      ]
    }
  ];

  // Set the evolution-specific menu for this window
  const evolutionMenu = Menu.buildFromTemplate(evolutionMenuTemplate);
  evolutionWindow.setMenu(evolutionMenu);

  evolutionWindow.on('closed', () => {
    // Dereference the window object
  });
}

// Handle opening plugin function calling test
ipcMain.on('open-plugin-function-calling-test', (event) => {
  try {
    // Create new window for the plugin function calling test
    const testWindow = new BrowserWindow({
      width: 1200,
      height: 800,
      webPreferences: {
        nodeIntegration: false,
        contextIsolation: true,
        enableRemoteModule: false
      },
      title: 'Plugin Function Calling Test - GenomeExplorer',
      icon: path.join(__dirname, '..', 'assets', 'icon.png'),
      show: false
    });

    const testPath = path.join(__dirname, '..', 'test', 'plugin-function-calling-test.html');
    
    // Check if file exists
    if (fs.existsSync(testPath)) {
      testWindow.loadFile(testPath);
    } else {
      console.error('Plugin function calling test file not found:', testPath);
      // Try alternative path (for development)
      const altPath = path.join(__dirname, 'test', 'plugin-function-calling-test.html');
      if (fs.existsSync(altPath)) {
        testWindow.loadFile(altPath);
      } else {
        console.error('Plugin function calling test file not found at alternative path:', altPath);
        testWindow.destroy();
        return;
      }
    }

    // Show window when ready
    testWindow.once('ready-to-show', () => {
      testWindow.show();
    });

    // Handle window closed
    testWindow.on('closed', () => {
      console.log('Plugin Function Calling Test window closed');
    });

  } catch (error) {
    console.error('Failed to open plugin function calling test:', error);
  }
});

// Handle genome data requests from CRISPR Designer
ipcMain.handle('get-genome-data', async (event) => {
  try {
    // Get the sender window (CRISPR window)
    const senderWindow = BrowserWindow.fromWebContents(event.sender);
    
    // Get main window data
    if (senderWindow && senderWindow.mainWindow) {
      const result = await senderWindow.mainWindow.webContents.executeJavaScript(`
        (function() {
          if (window.genomeBrowser) {
            return {
              currentSequence: window.genomeBrowser.currentSequence || null,
              currentAnnotations: window.genomeBrowser.currentAnnotations || {},
              currentPosition: window.genomeBrowser.currentPosition || null,
              currentChromosome: document.getElementById('chromosomeSelect')?.value || null
            };
          }
          return null;
        })()
      `);
      return result;
    }
    return null;
  } catch (error) {
    console.error('Error getting genome data:', error);
    return null;
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