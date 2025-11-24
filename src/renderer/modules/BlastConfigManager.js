/**
 * BlastConfigManager - Handles BLAST+ tools configuration
 * Provides auto-detection and manual configuration of BLAST+ installation
 */
class BlastConfigManager {
    constructor() {
        this.fs = require('fs');
        this.path = require('path');
        this.os = require('os');
        const { exec } = require('child_process');
        const { promisify } = require('util');
        this.exec = exec;
        this.execAsync = promisify(exec);
        
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
        const homeDir = this.os.homedir();
        const platform = this.os.platform();
        
        let configDir;
        if (platform === 'win32') {
            const appData = process.env.LOCALAPPDATA || this.path.join(homeDir, 'AppData', 'Local');
            configDir = this.path.join(appData, 'GenomeAIStudio');
        } else if (platform === 'darwin') {
            configDir = this.path.join(homeDir, 'Library', 'Application Support', 'GenomeAIStudio');
        } else {
            configDir = this.path.join(homeDir, '.config', 'GenomeAIStudio');
        }
        
        // Create directory if it doesn't exist
        if (!this.fs.existsSync(configDir)) {
            this.fs.mkdirSync(configDir, { recursive: true });
        }
        
        return this.path.join(configDir, 'blast-config.json');
    }

    /**
     * Load configuration from file
     */
    loadConfig() {
        try {
            if (this.fs.existsSync(this.configPath)) {
                const data = this.fs.readFileSync(this.configPath, 'utf8');
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
            lastDetection: null
        };
    }

    /**
     * Save configuration to file
     */
    saveConfig() {
        try {
            this.fs.writeFileSync(
                this.configPath, 
                JSON.stringify(this.config, null, 2),
                'utf8'
            );
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
        try {
            const command = this.os.platform() === 'win32' ? 'blastn.exe -version' : 'blastn -version';
            const { stdout } = await this.execAsync(command);
            
            const versionMatch = stdout.match(/blastn: ([\d.]+)/);
            if (versionMatch) {
                const version = versionMatch[1];
                
                // Try to get the full path
                const whichCommand = this.os.platform() === 'win32' ? 'where blastn.exe' : 'which blastn';
                const { stdout: pathOutput } = await this.execAsync(whichCommand);
                const executablePath = pathOutput.trim().split('\n')[0]; // Get first path if multiple
                
                return {
                    found: true,
                    path: executablePath,
                    version: version,
                    method: 'PATH'
                };
            }
        } catch (error) {
            console.log('Not found in PATH:', error.message);
        }
        
        return { found: false };
    }

    /**
     * Detect BLAST in common installation paths
     */
    async detectInCommonPaths() {
        const homeDir = this.os.homedir();
        const platform = this.os.platform();
        
        const commonPaths = [
            '/usr/local/bin/blastn',
            '/usr/bin/blastn',
            '/opt/homebrew/bin/blastn',
            '/usr/local/blast+/bin/blastn',
            '/opt/blast+/bin/blastn',
            this.path.join(homeDir, 'Applications', 'blast+', 'bin', 'blastn'),
            this.path.join(homeDir, '.local', 'blast+', 'bin', 'blastn'),
            this.path.join(homeDir, '.local', 'bin', 'blastn'),
            'C:\\Program Files\\NCBI\\blast+\\bin\\blastn.exe',
            'C:\\blast+\\bin\\blastn.exe',
            'C:\\ncbi-blast\\bin\\blastn.exe'
        ];
        
        for (const blastPath of commonPaths) {
            try {
                // Check if file exists
                if (!this.fs.existsSync(blastPath)) {
                    continue;
                }
                
                // Try to execute version command
                const { stdout } = await this.execAsync(`"${blastPath}" -version`);
                const versionMatch = stdout.match(/blastn: ([\d.]+)/);
                
                if (versionMatch) {
                    return {
                        found: true,
                        path: blastPath,
                        version: versionMatch[1],
                        method: 'Common Path'
                    };
                }
            } catch (error) {
                continue;
            }
        }
        
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
            otherTools: otherTools
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
            const toolPath = this.path.join(
                directory, 
                tool + (this.os.platform() === 'win32' ? '.exe' : '')
            );
            
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
        const { dialog } = require('@electron/remote');
        
        const result = await dialog.showOpenDialog({
            title: 'Select BLAST+ Executable',
            properties: ['openFile'],
            filters: [
                { name: 'Executable', extensions: this.os.platform() === 'win32' ? ['exe'] : ['*'] }
            ]
        });
        
        if (!result.canceled && result.filePaths.length > 0) {
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
            // Check if file exists
            if (!this.fs.existsSync(path)) {
                this.showStatus('error', 'File does not exist at the specified path.', 'verifyStatus');
                return;
            }
            
            // Try to execute version command
            const { stdout } = await this.execAsync(`"${path}" -version`);
            const versionMatch = stdout.match(/blastn: ([\d.]+)/);
            
            if (versionMatch) {
                const version = versionMatch[1];
                this.showStatus('success', `Valid BLAST+ executable found! Version: ${version}`, 'verifyStatus');
                
                // Update config
                this.config.blastExecutablePath = path;
                this.config.blastVersion = version;
                this.config.lastDetection = new Date().toISOString();
            } else {
                this.showStatus('error', 'File exists but does not appear to be a valid BLAST+ executable.', 'verifyStatus');
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
        
        if (this.config.blastExecutablePath) {
            configDiv.innerHTML = `
                <div style="margin-bottom: 8px;"><strong>Executable Path:</strong> ${this.config.blastExecutablePath}</div>
                ${this.config.blastVersion ? `<div style="margin-bottom: 8px;"><strong>Version:</strong> v${this.config.blastVersion}</div>` : ''}
                ${this.config.lastDetection ? `<div style="margin-bottom: 8px;"><strong>Last Detection:</strong> ${new Date(this.config.lastDetection).toLocaleString()}</div>` : ''}
                ${this.config.detectedPaths?.directory ? `<div><strong>Installation Directory:</strong> ${this.config.detectedPaths.directory}</div>` : ''}
            `;
        } else {
            configDiv.innerHTML = '<div style="color: #666;">No BLAST+ configuration found. Please detect or configure manually.</div>';
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
