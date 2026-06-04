// @ts-check
/**
 * BlastConfigManager - Handles BLAST+ tools configuration
 * Provides auto-detection and manual configuration of BLAST+ installation
 */
class BlastConfigManager {
  constructor() {
    this.path = (typeof window !== 'undefined' && window.require ? window.require('path') : null) || {
      join: (...parts) => parts.filter(Boolean).join('/').replace(/\/+/g, '/'),
    };
    this.os = (typeof window !== 'undefined' && window.require ? window.require('os') : null) || {
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
    const statusDiv = document.getElementById('detectionStatus');
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
    const directory = this.path.dirname(detection.path);
    const otherTools = await this.detectOtherTools(directory);

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
                <span class="detection-value">${detection.path}</span>
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

    // Update manual input field
    document.getElementById('blastPathInput').value = detection.path;

    // Save detection results
    this.config.blastExecutablePath = detection.path;
    this.config.blastVersion = detection.version;
    this.config.detectedPaths = {
      directory: directory,
      otherTools: otherTools,
    };
    this.config.lastDetection = new Date().toISOString();
  }

  /**
   * Detect other BLAST tools in the same directory
   */
  async detectOtherTools(directory) {
    const tools = ['blastp', 'blastx', 'tblastn', 'tblastx', 'makeblastdb', 'blastdbcmd'];
    const found = [];

    for (const tool of tools) {
      const toolPath = this.path.join(directory, tool + (this.os.platform() === 'win32' ? '.exe' : ''));

      if (this.fs.existsSync(toolPath)) {
        found.push(tool);
      }
    }

    return found;
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
  saveConfiguration() {
    const path = document.getElementById('blastPathInput').value.trim();

    if (!path) {
      this.showStatus('error', 'Please specify a BLAST+ executable path first.', 'verifyStatus');
      return;
    }

    if (!this.fs.existsSync(path)) {
      this.showStatus('error', 'The specified path does not exist. Please verify it first.', 'verifyStatus');
      return;
    }

    this.config.blastExecutablePath = path;

    if (this.saveConfig()) {
      this.showStatus('success', 'Configuration saved successfully!', 'verifyStatus');
      this.loadCurrentConfig();

      // Notify main window to reload BLAST configuration
      setTimeout(() => {
        this.showStatus('info', 'Please restart the application for changes to take effect.', 'verifyStatus');
      }, 1500);
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
                <div style="margin-bottom: 8px;"><strong>Executable Path:</strong> ${this.config.blastExecutablePath}</div>
                ${this.config.blastVersion ? `<div style="margin-bottom: 8px;"><strong>Version:</strong> v${this.config.blastVersion}</div>` : ''}
                ${this.config.lastDetection ? `<div style="margin-bottom: 8px;"><strong>Last Detection:</strong> ${new Date(this.config.lastDetection).toLocaleString()}</div>` : ''}
                ${this.config.detectedPaths?.directory ? `<div><strong>Installation Directory:</strong> ${this.config.detectedPaths.directory}</div>` : ''}
            `;

      // Populate the manual input field with saved path
      if (pathInput) {
        pathInput.value = this.config.blastExecutablePath;
      }
    } else {
      configDiv.innerHTML =
        '<div style="color: #666;">No BLAST+ configuration found. Please detect or configure manually.</div>';
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
