// @ts-check
/**
 * BlastConfigManager - Handles BLAST+ tools configuration
 * Provides auto-detection and manual configuration of BLAST+ installation
 */
class BlastConfigManager {
  constructor() {
    this.path = (typeof window !== 'undefined' && window.path) || {
      join: (...parts) => parts.filter(Boolean).join('/').replace(/\/+/g, '/'),
    };
    this.os = (typeof window !== 'undefined' && window.os) || {
      platform: () => 'unknown',
    };

    // Configuration storage
    this.configPath = this.getConfigPath();
    this.config = this.loadConfig();

    this.initializeUI();
    this.loadCurrentConfig();
  }

  /**
   * Get configuration file path
   */
  getConfigPath() {
    return 'blast-config';
  }

  /**
   * Load configuration from file
   */
  loadConfig() {
    try {
      const data = localStorage.getItem(this.configPath);
      if (data) {
        return JSON.parse(data);
      }
    } catch (error) {
      console.error('Failed to load BLAST config:', error);
    }

    // Return default config
    return {
      blastExecutablePath: null,
      blastVersion: null,
      detectedPaths: {},
      lastDetection: null,
    };
  }

  /**
   * Save configuration to file
   */
  saveConfig() {
    try {
      localStorage.setItem(this.configPath, JSON.stringify(this.config));
      return true;
    } catch (error) {
      console.error('Failed to save BLAST config:', error);
      this.showStatus('error', `Failed to save configuration: ${error.message}`, 'verifyStatus');
      return false;
    }
  }

  /**
   * Initialize UI event handlers
   */
  initializeUI() {
    // Auto detection button
    document.getElementById('detectBtn').addEventListener('click', () => {
      this.autoDetectBlast();
    });

    // Clear detection button
    document.getElementById('clearBtn').addEventListener('click', () => {
      this.clearDetection();
    });

    // Browse button
    document.getElementById('browseBtn').addEventListener('click', () => {
      this.browseForBlast();
    });

    // Verify button
    document.getElementById('verifyBtn').addEventListener('click', () => {
      this.verifyManualPath();
    });

    // Save button
    document.getElementById('saveBtn').addEventListener('click', () => {
      this.saveConfiguration();
    });

    // Close button
    document.getElementById('closeBtn').addEventListener('click', () => {
      window.close();
    });
  }

  /**
   * Auto-detect BLAST+ installation
   */
  async autoDetectBlast() {
    const detectBtn = document.getElementById('detectBtn');
    document.getElementById('detectionStatus');
    const resultsDiv = document.getElementById('detectionResults');

    // Disable button and show loading
    detectBtn.disabled = true;
    detectBtn.innerHTML = '<span class="spinner"></span><span>Detecting...</span>';

    this.showStatus('info', 'Searching for BLAST+ installation...', 'detectionStatus');
    resultsDiv.style.display = 'none';

    try {
      // Try to detect blastn in PATH first
      const pathDetection = await this.detectInPath();

      if (pathDetection.found) {
        await this.displayDetectionResults(pathDetection);
        this.showStatus('success', 'BLAST+ installation detected successfully!', 'detectionStatus');
      } else {
        // If not found in PATH, try common installation paths
        const commonPathDetection = await this.detectInCommonPaths();

        if (commonPathDetection.found) {
          await this.displayDetectionResults(commonPathDetection);
          this.showStatus('success', 'BLAST+ installation detected in common paths!', 'detectionStatus');
        } else {
          this.showStatus('warning', 'BLAST+ installation not found. Please configure manually.', 'detectionStatus');
        }
      }
    } catch (error) {
      console.error('Detection error:', error);
      this.showStatus('error', `Detection failed: ${error.message}`, 'detectionStatus');
    } finally {
      // Re-enable button
      detectBtn.disabled = false;
      detectBtn.innerHTML = '<span>Detect BLAST+ Tools</span>';
    }
  }

  /**
   * Detect BLAST in system PATH
   */
  async detectInPath() {
    if (window.electronAPI?.blast?.detectInstallation) {
      const result = await window.electronAPI.blast.detectInstallation();
      if (result?.found || result?.installed) {
        return {
          found: true,
          path: result.path,
          version: result.version,
          method: result.method || 'PATH',
        };
      }
      console.log('Not found in PATH:', result?.error || result?.message);
    }

    return { found: false };
  }

  /**
   * Detect BLAST in common installation paths
   */
  async detectInCommonPaths() {
    return { found: false };
  }

  /**
   * Display detection results
   */
  async displayDetectionResults(detection) {
    const resultsDiv = document.getElementById('detectionResults');

    // Get directory and other tools
    const blastExecutablePath = detection.path;
    const directory = this.path.dirname(blastExecutablePath);

    // Store the detected blastn path before probing companion tools so runCommand
    // can resolve makeblastdb/blastdbcmd from the same installation directory.
    this.config.blastExecutablePath = blastExecutablePath;
    this.config.blastVersion = detection.version;
    this.config.detectedPaths = {
      directory: directory,
      otherTools: [],
    };
    this.config.lastDetection = new Date().toISOString();
    document.getElementById('blastPathInput').value = blastExecutablePath;

    const otherTools = await this.detectOtherTools(directory, blastExecutablePath);

    // Update UI
    resultsDiv.innerHTML = `
            <div class="detection-item">
                <span class="detection-label">Detection Method:</span>
                <span class="detection-value">${detection.method}</span>
            </div>
            <div class="detection-item">
                <span class="detection-label">BLAST+ Version:</span>
                <span class="detection-value">v${detection.version}</span>
            </div>
            <div class="detection-item">
                <span class="detection-label">Executable Path:</span>
                <span class="detection-value">${blastExecutablePath}</span>
            </div>
            <div class="detection-item">
                <span class="detection-label">Directory:</span>
                <span class="detection-value">${directory}</span>
            </div>
            <div class="detection-item">
                <span class="detection-label">Other Tools Found:</span>
                <span class="detection-value">${otherTools.join(', ')}</span>
            </div>
        `;

    resultsDiv.style.display = 'block';

    // Save detection results
    this.config.detectedPaths = {
      directory: directory,
      otherTools: otherTools,
    };
  }

  /**
   * Detect other BLAST tools in the same directory
   */
  async detectOtherTools(directory, blastExecutablePath = null) {
    const tools = ['blastp', 'blastx', 'tblastn', 'tblastx', 'makeblastdb', 'blastdbcmd'];
    const found = [];
    const blastnPath =
      blastExecutablePath || document.getElementById('blastPathInput')?.value.trim() || this.config.blastExecutablePath;

    for (const tool of tools) {
      try {
        const result = await window.electronAPI?.blast?.runCommand?.({
          executable: tool,
          args: ['-version'],
          blastExecutablePath: blastnPath,
        });
        if (result?.success || result?.stdout || result?.stderr) {
          found.push(tool);
        }
      } catch (error) {
        // Missing companion tools are non-fatal for configuration display.
      }
    }

    if (found.length === 0 && directory) {
      for (const tool of tools) {
        const toolPath = this.path.join(directory, tool + (this.os.platform() === 'win32' ? '.exe' : ''));
        try {
          const result = await window.electronAPI?.blast?.verifyExecutable?.(toolPath);
          if (result?.success || result?.found) {
            found.push(tool);
          }
        } catch (error) {
          // Ignore tools that cannot be verified from this directory.
        }
      }
    }

    return found.length > 0 ? found : ['Not checked'];
  }

  async verifyExecutablePath(path) {
    const result = await window.electronAPI?.blast?.verifyExecutable?.(path);
    if (result?.success || result?.found) {
      return result;
    }

    throw new Error(result?.error || 'File does not appear to be a valid BLAST+ executable.');
  }

  /**
   * Clear detection results
   */
  clearDetection() {
    document.getElementById('detectionResults').style.display = 'none';
    document.getElementById('detectionStatus').style.display = 'none';
    document.getElementById('blastPathInput').value = '';
  }

  /**
   * Browse for BLAST executable
   */
  async browseForBlast() {
    const result = await window.electronAPI?.blast?.selectExecutable?.();

    if (result && !result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0];
      document.getElementById('blastPathInput').value = selectedPath;
    }
  }

  /**
   * Verify manually entered path
   */
  async verifyManualPath() {
    const pathInput = document.getElementById('blastPathInput');
    const path = pathInput.value.trim();

    if (!path) {
      this.showStatus('error', 'Please enter a path to verify.', 'verifyStatus');
      return;
    }

    const verifyBtn = document.getElementById('verifyBtn');
    verifyBtn.disabled = true;
    verifyBtn.innerHTML = '<span class="spinner"></span><span>Verifying...</span>';

    try {
      const result = await window.electronAPI?.blast?.verifyExecutable?.(path);
      if (result?.success || result?.found) {
        const version = result.version || 'Unknown';
        this.showStatus('success', `Valid BLAST+ executable found! Version: ${version}`, 'verifyStatus');

        // Update config
        this.config.blastExecutablePath = path;
        this.config.blastVersion = version;
        this.config.lastDetection = new Date().toISOString();
      } else {
        this.showStatus('error', result?.error || 'File does not appear to be a valid BLAST+ executable.', 'verifyStatus');
      }
    } catch (error) {
      this.showStatus('error', `Verification failed: ${error.message}`, 'verifyStatus');
    } finally {
      verifyBtn.disabled = false;
      verifyBtn.innerHTML = '<span>Verify Path</span>';
    }
  }

  /**
   * Save configuration
   */
  async saveConfiguration() {
    const path = document.getElementById('blastPathInput').value.trim();

    if (!path) {
      this.showStatus('error', 'Please specify a BLAST+ executable path first.', 'verifyStatus');
      return;
    }

    try {
      const result = await this.verifyExecutablePath(path);
      this.config.blastExecutablePath = result.path || path;
      this.config.blastVersion = result.version || this.config.blastVersion;

      if (this.saveConfig()) {
        this.showStatus('success', 'Configuration saved successfully!', 'verifyStatus');
        this.loadCurrentConfig();

        // Notify main window to reload BLAST configuration
        setTimeout(() => {
          this.showStatus('info', 'Please restart the application for changes to take effect.', 'verifyStatus');
        }, 1500);
      }
    } catch (error) {
      this.showStatus('error', `The specified path could not be verified: ${error.message}`, 'verifyStatus');
    }
  }

  /**
   * Load and display current configuration
   */
  loadCurrentConfig() {
    const configDiv = document.getElementById('currentConfig');
    const pathInput = document.getElementById('blastPathInput');

    if (this.config.blastExecutablePath) {
      // Update the Current Configuration display
      configDiv.innerHTML = `
                <div class="config-row"><strong>Executable Path:</strong> ${this.config.blastExecutablePath}</div>
                ${this.config.blastVersion ? `<div class="config-row"><strong>Version:</strong> v${this.config.blastVersion}</div>` : ''}
                ${this.config.lastDetection ? `<div class="config-row"><strong>Last Detection:</strong> ${new Date(this.config.lastDetection).toLocaleString()}</div>` : ''}
                ${this.config.detectedPaths?.directory ? `<div class="config-row"><strong>Installation Directory:</strong> ${this.config.detectedPaths.directory}</div>` : ''}
            `;

      // Populate the manual input field with saved path
      if (pathInput) {
        pathInput.value = this.config.blastExecutablePath;
      }
    } else {
      configDiv.innerHTML =
        '<div class="no-config">No BLAST+ configuration found. Please detect or configure manually.</div>';
      // Clear the input field if no config
      if (pathInput) {
        pathInput.value = '';
      }
    }
  }

  /**
   * Show status message
   */
  showStatus(type, message, elementId) {
    const statusDiv = document.getElementById(elementId);
    statusDiv.className = `status-box ${type}`;
    statusDiv.textContent = message;
    statusDiv.style.display = 'block';
  }
}

// Export for Node/test environments; in the renderer this class is loaded as a script-tag global.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BlastConfigManager;
}
