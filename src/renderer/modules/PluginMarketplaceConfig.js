/**
 * PluginMarketplaceConfig - Configuration manager for Plugin Marketplace
 * Handles server settings, source management, and configuration UI
 */
class PluginMarketplaceConfig {
    constructor(configManager) {
        this.configManager = configManager;
        this.defaultConfig = {
            sources: [
                {
                    id: 'localhost',
                    name: 'Local Development Server',
                    url: 'http://localhost:3001/api/v1',
                    priority: 0,
                    trusted: true,
                    enabled: true,
                    description: 'Local development server for testing'
                },
                {
                    id: 'official',
                    name: 'GenomeExplorer Official Repository',
                    url: 'https://plugins.genomeexplorer.org/api/v1',
                    priority: 1,
                    trusted: true,
                    enabled: false,
                    description: 'Official plugin repository'
                }
            ],
            settings: {
                autoUpdate: true,
                checkInterval: 3600000,
                maxConcurrentDownloads: 3,
                enableSecurityValidation: true,
                cacheTimeout: 3600000,
                defaultPort: 3001,
                mcpServerPort: 3000
            },
            submission: {
                enabled: true,
                maxFileSize: '50MB',
                allowedFileTypes: ['.zip', '.tar.gz', '.json', '.js', '.md'],
                requiredFields: ['name', 'description', 'version', 'author', 'category', 'type']
            }
        };
        
        this.currentConfig = null;
        this.initialize();
    }

    initialize() {
        this.currentConfig = this.loadConfig();
        console.log('🔧 PluginMarketplaceConfig initialized');
    }

    loadConfig() {
        try {
            const stored = this.configManager?.get('marketplace') || {};
            return this.mergeConfig(this.defaultConfig, stored);
        } catch (error) {
            console.error('❌ Failed to load marketplace config:', error);
            return { ...this.defaultConfig };
        }
    }

    saveConfig() {
        try {
            this.configManager?.set('marketplace', this.currentConfig);
            console.log('✅ Marketplace configuration saved');
            return true;
        } catch (error) {
            console.error('❌ Failed to save marketplace config:', error);
            return false;
        }
    }

    mergeConfig(defaultConfig, storedConfig) {
        const merged = JSON.parse(JSON.stringify(defaultConfig));
        
        if (storedConfig.sources) {
            merged.sources = merged.sources.map(defaultSource => {
                const storedSource = storedConfig.sources.find(s => s.id === defaultSource.id);
                return storedSource ? { ...defaultSource, ...storedSource } : defaultSource;
            });
        }
        
        if (storedConfig.settings) {
            merged.settings = { ...merged.settings, ...storedConfig.settings };
        }
        
        if (storedConfig.submission) {
            merged.submission = { ...merged.submission, ...storedConfig.submission };
        }
        
        return merged;
    }

    getSources() {
        return this.currentConfig.sources || [];
    }

    getEnabledSources() {
        return this.getSources().filter(source => source.enabled);
    }

    getSettings() {
        return this.currentConfig.settings || {};
    }

    updateSettings(newSettings) {
        this.currentConfig.settings = { ...this.currentConfig.settings, ...newSettings };
        return this.saveConfig();
    }

    getSubmissionConfig() {
        return this.currentConfig.submission || {};
    }

    async testSource(source) {
        try {
            console.log(`🔍 Testing connection to ${source.name}...`);
            
            const startTime = Date.now();
            const response = await fetch(`${source.url}/health`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'GenomeExplorer/2.0.0'
                },
                signal: AbortSignal.timeout(10000)
            });
            
            const responseTime = Date.now() - startTime;
            
            if (response.ok) {
                return {
                    success: true,
                    message: `Connection successful (${responseTime}ms)`,
                    responseTime
                };
            } else {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
        } catch (error) {
            console.error(`❌ Connection test failed for ${source.name}:`, error);
            return {
                success: false,
                message: error.message
            };
        }
    }

    showConfiguration() {
        const modal = this.createConfigurationModal();
        document.body.appendChild(modal);
        return modal;
    }

    createConfigurationModal() {
        const modal = document.createElement('div');
        modal.className = 'marketplace-config-modal';
        modal.innerHTML = `
            <div class="marketplace-config-overlay">
                <div class="marketplace-config-dialog">
                    <div class="marketplace-config-header">
                        <h2>⚙️ Marketplace Configuration</h2>
                        <button class="marketplace-config-close">&times;</button>
                    </div>
                    
                    <div class="marketplace-config-content">
                        <div class="config-section">
                            <h3>🌐 Server Sources</h3>
                            <div id="sources-list"></div>
                        </div>
                        
                        <div class="config-section">
                            <h3>🔧 Port Settings</h3>
                            <div class="config-form">
                                <label>
                                    MCP Server Port: 
                                    <input type="number" id="mcp-port" min="1000" max="65535">
                                </label>
                                <label>
                                    Marketplace Port: 
                                    <input type="number" id="marketplace-port" min="1000" max="65535">
                                </label>
                                <small>Marketplace port = MCP port + 1</small>
                            </div>
                        </div>
                        
                        <div class="config-section">
                            <h3>📤 Submission Settings</h3>
                            <div class="config-form">
                                <label>
                                    <input type="checkbox" id="submission-enabled"> Enable plugin submission
                                </label>
                                <label>
                                    Max file size: 
                                    <select id="max-file-size">
                                        <option value="10MB">10MB</option>
                                        <option value="50MB">50MB</option>
                                        <option value="100MB">100MB</option>
                                    </select>
                                </label>
                            </div>
                        </div>
                    </div>
                    
                    <div class="marketplace-config-footer">
                        <button id="save-config-btn" class="config-btn primary">Save</button>
                        <button id="test-connection-btn" class="config-btn">Test Connection</button>
                        <button id="cancel-config-btn" class="config-btn">Cancel</button>
                    </div>
                </div>
            </div>
        `;

        this.addConfigStyles();
        this.attachConfigHandlers(modal);
        this.populateConfigUI(modal);
        
        return modal;
    }

    addConfigStyles() {
        if (document.getElementById('marketplace-config-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'marketplace-config-styles';
        styles.textContent = `
            .marketplace-config-modal {
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                z-index: 10000; font-family: 'Segoe UI', sans-serif;
            }
            .marketplace-config-overlay {
                background: rgba(0,0,0,0.7); width: 100%; height: 100%;
                display: flex; align-items: center; justify-content: center;
            }
            .marketplace-config-dialog {
                background: white; border-radius: 12px; width: 90%; max-width: 700px;
                max-height: 80vh; display: flex; flex-direction: column;
                box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            }
            .marketplace-config-header {
                padding: 20px; border-bottom: 1px solid #e0e0e0;
                display: flex; justify-content: space-between; align-items: center;
                background: linear-gradient(135deg, #4a90e2, #357abd); color: white;
                border-radius: 12px 12px 0 0;
            }
            .marketplace-config-header h2 { margin: 0; }
            .marketplace-config-close {
                background: none; border: none; color: white; font-size: 24px;
                cursor: pointer; padding: 5px; border-radius: 50%; width: 35px; height: 35px;
            }
            .marketplace-config-close:hover { background: rgba(255,255,255,0.2); }
            .marketplace-config-content { flex: 1; overflow-y: auto; padding: 20px; }
            .config-section { margin-bottom: 25px; }
            .config-section h3 { 
                color: #333; margin-bottom: 15px; border-bottom: 2px solid #4a90e2; 
                padding-bottom: 8px; 
            }
            .config-form { display: flex; flex-direction: column; gap: 15px; }
            .config-form label { display: flex; align-items: center; gap: 10px; font-weight: 500; }
            .config-form input, .config-form select {
                padding: 8px 12px; border: 1px solid #ddd; border-radius: 6px; font-size: 14px;
            }
            .config-form input[type="checkbox"] { width: auto; }
            .config-form small { color: #666; font-style: italic; margin-top: 5px; }
            .source-item {
                border: 1px solid #e0e0e0; border-radius: 8px; padding: 15px; margin-bottom: 10px;
                background: #f9f9f9; display: flex; justify-content: space-between; align-items: center;
            }
            .source-info { flex: 1; }
            .source-name { font-weight: bold; color: #333; margin-bottom: 5px; }
            .source-url { color: #666; font-size: 14px; }
            .source-status { padding: 3px 8px; border-radius: 12px; font-size: 12px; font-weight: bold; }
            .source-status.enabled { background: #d4edda; color: #155724; }
            .source-status.disabled { background: #f8d7da; color: #721c24; }
            .marketplace-config-footer {
                padding: 20px; border-top: 1px solid #e0e0e0; display: flex; gap: 10px; justify-content: flex-end;
            }
            .config-btn {
                padding: 10px 20px; border: 1px solid #ddd; border-radius: 6px; background: white;
                cursor: pointer; font-size: 14px; transition: all 0.2s;
            }
            .config-btn.primary { background: #4a90e2; color: white; border-color: #4a90e2; }
            .config-btn:hover { transform: translateY(-1px); box-shadow: 0 2px 5px rgba(0,0,0,0.2); }
        `;
        document.head.appendChild(styles);
    }

    attachConfigHandlers(modal) {
        modal.querySelector('.marketplace-config-close').addEventListener('click', () => modal.remove());
        modal.querySelector('#cancel-config-btn').addEventListener('click', () => modal.remove());
        
        modal.querySelector('#save-config-btn').addEventListener('click', () => {
            this.saveConfigFromUI(modal);
            modal.remove();
        });

        const mcpPortInput = modal.querySelector('#mcp-port');
        const marketplacePortInput = modal.querySelector('#marketplace-port');
        
        mcpPortInput.addEventListener('input', () => {
            const mcpPort = parseInt(mcpPortInput.value);
            if (!isNaN(mcpPort)) {
                marketplacePortInput.value = mcpPort + 1;
            }
        });

        modal.querySelector('#test-connection-btn').addEventListener('click', async () => {
            const sources = this.getEnabledSources();
            const btn = modal.querySelector('#test-connection-btn');
            btn.disabled = true;
            btn.textContent = 'Testing...';
            
            for (const source of sources) {
                const result = await this.testSource(source);
                console.log(`Test result for ${source.name}:`, result);
            }
            
            btn.disabled = false;
            btn.textContent = 'Test Connection';
            alert('Connection tests completed. Check console for details.');
        });
    }

    populateConfigUI(modal) {
        const settings = this.getSettings();
        const submissionConfig = this.getSubmissionConfig();
        
        modal.querySelector('#mcp-port').value = settings.mcpServerPort;
        modal.querySelector('#marketplace-port').value = settings.defaultPort;
        modal.querySelector('#submission-enabled').checked = submissionConfig.enabled;
        modal.querySelector('#max-file-size').value = submissionConfig.maxFileSize;
        
        this.populateSourcesList(modal);
    }

    populateSourcesList(modal) {
        const sourcesList = modal.querySelector('#sources-list');
        const sources = this.getSources();
        
        sourcesList.innerHTML = sources.map(source => `
            <div class="source-item">
                <div class="source-info">
                    <div class="source-name">${source.name}</div>
                    <div class="source-url">${source.url}</div>
                </div>
                <div class="source-status ${source.enabled ? 'enabled' : 'disabled'}">
                    ${source.enabled ? 'Enabled' : 'Disabled'}
                </div>
            </div>
        `).join('');
    }

    saveConfigFromUI(modal) {
        const newSettings = {
            mcpServerPort: parseInt(modal.querySelector('#mcp-port').value),
            defaultPort: parseInt(modal.querySelector('#marketplace-port').value)
        };
        
        const newSubmissionConfig = {
            enabled: modal.querySelector('#submission-enabled').checked,
            maxFileSize: modal.querySelector('#max-file-size').value
        };
        
        this.updateSettings(newSettings);
        this.updateSubmissionConfig(newSubmissionConfig);
        
        console.log('✅ Configuration saved');
    }
}

if (typeof window !== 'undefined') {
    window.PluginMarketplaceConfig = PluginMarketplaceConfig;
} 