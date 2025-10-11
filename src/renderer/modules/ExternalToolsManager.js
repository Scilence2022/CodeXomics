/**
 * ExternalToolsManager - Manages external tools configuration and integration
 * Handles both built-in external tools (Deep Gene Research, CHOPCHOP) and custom tools
 */
class ExternalToolsManager {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this.isInitialized = false;
        this.customTools = [];
        this.builtinTools = {
            deepGeneResearch: {
                name: 'Deep Gene Research',
                url: 'http://localhost:3000/',
                icon: 'fas fa-dna',
                accelerator: 'CmdOrCtrl+Shift+W'
            },
            chopchop: {
                name: 'CHOPCHOP CRISPR Toolbox', 
                url: 'https://chopchop.cbu.uib.no/',
                icon: 'fas fa-cut',
                accelerator: 'CmdOrCtrl+Shift+C'
            },
            progenfixer: {
                name: 'ProGenFixer',
                url: 'https://progenfixer.biodesign.ac.cn',
                icon: 'fas fa-wrench',
                accelerator: 'CmdOrCtrl+Shift+P'
            }
        };
        
        console.log('✅ ExternalToolsManager created');
    }

    /**
     * Initialize the external tools manager
     */
    async init() {
        if (this.isInitialized) return;

        try {
            // Load settings from storage
            await this.loadSettings();
            
            // Update main menu with loaded tools (including custom tools)
            this.updateMainMenu();
            
            // Setup event handlers
            this.setupEventHandlers();
            
            this.isInitialized = true;
            console.log('✅ [ExternalTools] ExternalToolsManager initialized');
            console.log('📊 [ExternalTools] Loaded custom tools:', this.customTools.length);
        } catch (error) {
            console.error('❌ [ExternalTools] Failed to initialize ExternalToolsManager:', error);
            this.isInitialized = true; // Mark as initialized to prevent retry loops
        }
    }

    /**
     * Setup event handlers for external tools modal
     */
    setupEventHandlers() {
        // Add custom tool button
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'addCustomToolBtn') {
                e.preventDefault();
                this.addCustomTool();
            }
        });

        // Save external tools button
        document.addEventListener('click', (e) => {
            if (e.target && e.target.id === 'saveExternalTools') {
                e.preventDefault();
                this.saveAllSettings();
            }
        });

        // Remove custom tool buttons (event delegation)
        document.addEventListener('click', (e) => {
            if (e.target && e.target.classList.contains('tool-remove-btn')) {
                e.preventDefault();
                const toolId = e.target.dataset.toolId;
                this.removeCustomTool(toolId);
            }
        });

        // Modal close handlers
        const modal = document.getElementById('externalToolsModal');
        if (modal) {
            // Initialize draggable and resizable using centralized managers
            if (window.modalDragManager) {
                window.modalDragManager.makeDraggable('#externalToolsModal');
            }
            if (window.resizableModalManager) {
                window.resizableModalManager.makeResizable('#externalToolsModal');
            }

            // Modal close handlers
            modal.querySelectorAll('.modal-close').forEach(btn => {
                btn.addEventListener('click', () => {
                    modal.classList.remove('show');
                });
            });

            // Close only on close button click, not background
            modal.addEventListener('click', (e) => {
                if (e.target.classList.contains('modal-close')) {
                    modal.classList.remove('show');
                }
            });

            // Reset position button
            const resetPositionBtn = modal.querySelector('.reset-position-btn');
            if (resetPositionBtn) {
                resetPositionBtn.addEventListener('click', () => {
                    const modalContent = modal.querySelector('.modal-content');
                    if (modalContent) {
                        modalContent.style.position = 'fixed';
                        modalContent.style.transform = 'translate(-50%, -50%)';
                        modalContent.style.top = '50%';
                        modalContent.style.left = '50%';
                        modalContent.style.margin = '0';
                    }
                });
            }

            // Reset defaults button
            const resetDefaultsBtn = modal.querySelector('.reset-defaults-btn');
            if (resetDefaultsBtn) {
                resetDefaultsBtn.addEventListener('click', () => {
                    this.resetToDefaults();
                });
            }
        }
    }

    /**
     * Show external tools configuration modal
     */
    showConfigurationModal() {
        const modal = document.getElementById('externalToolsModal');
        if (modal) {
            // Load current settings into the form
            this.populateModal();
            
            // Show modal
            modal.classList.add('show');
            console.log('✅ [ExternalTools] Configuration modal shown');
        } else {
            console.error('❌ [ExternalTools] External tools modal not found');
        }
    }

    /**
     * Populate modal with current settings
     */
    populateModal() {
        // Populate built-in tools
        const deepGeneUrlInput = document.getElementById('extToolDeepGeneUrl');
        if (deepGeneUrlInput) {
            deepGeneUrlInput.value = this.builtinTools.deepGeneResearch.url;
        }

        const chopchopUrlInput = document.getElementById('extToolChopchopUrl');
        if (chopchopUrlInput) {
            chopchopUrlInput.value = this.builtinTools.chopchop.url;
        }

        const progenFixerUrlInput = document.getElementById('extToolProGenFixerUrl');
        if (progenFixerUrlInput) {
            progenFixerUrlInput.value = this.builtinTools.progenfixer.url;
        }

        // Populate custom tools
        this.renderCustomTools();
    }

    /**
     * Render custom tools list
     */
    renderCustomTools() {
        const customToolsList = document.getElementById('customToolsList');
        if (!customToolsList) return;

        customToolsList.innerHTML = '';

        this.customTools.forEach((tool, index) => {
            const toolElement = this.createCustomToolElement(tool, index);
            customToolsList.appendChild(toolElement);
        });
    }

    /**
     * Create custom tool form element
     */
    createCustomToolElement(tool, index) {
        const toolDiv = document.createElement('div');
        toolDiv.className = 'custom-tool-item';
        toolDiv.innerHTML = `
            <button class="tool-remove-btn" data-tool-id="${index}" title="Remove Tool">
                <i class="fas fa-times"></i>
            </button>
            <div class="form-group">
                <label for="customToolName${index}">Tool Name:</label>
                <input type="text" id="customToolName${index}" class="input-full" 
                       value="${this.escapeHtml(tool.name)}" placeholder="e.g., My Custom Tool">
                <small class="help-text">Name that will appear in the Tools menu</small>
            </div>
            <div class="form-group">
                <label for="customToolUrl${index}">Tool URL:</label>
                <input type="url" id="customToolUrl${index}" class="input-full" 
                       value="${this.escapeHtml(tool.url)}" placeholder="https://example.com/tool">
                <small class="help-text">URL to the external tool web interface</small>
            </div>
        `;
        return toolDiv;
    }

    /**
     * Add a new custom tool
     */
    addCustomTool() {
        const newTool = {
            name: '',
            url: '',
            id: Date.now().toString() // Simple unique ID
        };
        
        this.customTools.push(newTool);
        this.renderCustomTools();
        
        // Focus on the new tool's name input
        const newIndex = this.customTools.length - 1;
        const nameInput = document.getElementById(`customToolName${newIndex}`);
        if (nameInput) {
            nameInput.focus();
        }
    }

    /**
     * Remove a custom tool
     */
    removeCustomTool(toolId) {
        const index = parseInt(toolId);
        if (index >= 0 && index < this.customTools.length) {
            this.customTools.splice(index, 1);
            this.renderCustomTools();
        }
    }

    /**
     * Collect current form data
     */
    collectFormData() {
        // Collect built-in tools data
        const deepGeneUrlInput = document.getElementById('extToolDeepGeneUrl');
        const chopchopUrlInput = document.getElementById('extToolChopchopUrl');
        const progenFixerUrlInput = document.getElementById('extToolProGenFixerUrl');
        
        if (deepGeneUrlInput) {
            this.builtinTools.deepGeneResearch.url = deepGeneUrlInput.value.trim();
        }
        
        if (chopchopUrlInput) {
            this.builtinTools.chopchop.url = chopchopUrlInput.value.trim();
        }

        if (progenFixerUrlInput) {
            this.builtinTools.progenfixer.url = progenFixerUrlInput.value.trim();
        }

        // Collect custom tools data
        const updatedCustomTools = [];
        this.customTools.forEach((tool, index) => {
            const nameInput = document.getElementById(`customToolName${index}`);
            const urlInput = document.getElementById(`customToolUrl${index}`);
            
            if (nameInput && urlInput) {
                const name = nameInput.value.trim();
                const url = urlInput.value.trim();
                
                // Only include tools with both name and URL
                if (name && url) {
                    updatedCustomTools.push({
                        id: tool.id,
                        name: name,
                        url: url
                    });
                }
            }
        });
        
        this.customTools = updatedCustomTools;
    }

    /**
     * Save all external tools settings
     */
    async saveAllSettings() {
        try {
            // Collect current form data
            this.collectFormData();
            
            console.log('💾 [ExternalTools] Saving', this.customTools.length, 'custom tools to storage...');
            this.customTools.forEach((tool, index) => {
                console.log(`   ${index + 1}. ${tool.name} - ${tool.url}`);
            });
            
            // Save to config manager
            if (this.genomeBrowser.configManager) {
                // Save custom tools
                await this.genomeBrowser.configManager.set('externalTools.customTools', this.customTools);
                
                // Update GeneralSettingsManager with built-in tools URLs
                await this.genomeBrowser.configManager.set('generalSettings.deepGeneResearchUrl', this.builtinTools.deepGeneResearch.url);
                await this.genomeBrowser.configManager.set('generalSettings.chopchopUrl', this.builtinTools.chopchop.url);
                await this.genomeBrowser.configManager.set('generalSettings.progenFixerUrl', this.builtinTools.progenfixer.url);
                
                await this.genomeBrowser.configManager.saveConfig();
                
                // Update the GeneralSettingsManager instance if available
                if (this.genomeBrowser.generalSettingsManager) {
                    this.genomeBrowser.generalSettingsManager.updateSetting('deepGeneResearchUrl', this.builtinTools.deepGeneResearch.url);
                    this.genomeBrowser.generalSettingsManager.updateSetting('chopchopUrl', this.builtinTools.chopchop.url);
                    this.genomeBrowser.generalSettingsManager.updateSetting('progenFixerUrl', this.builtinTools.progenfixer.url);
                }
            }

            // Update main menu with new tools
            this.updateMainMenu();

            // Close modal
            const modal = document.getElementById('externalToolsModal');
            if (modal) {
                modal.classList.remove('show');
            }

            // Show success notification
            this.showNotification('External tools settings saved successfully!', 'success');
            
            console.log('✅ [ExternalTools] Settings saved successfully to local configuration');
        } catch (error) {
            console.error('❌ [ExternalTools] Failed to save settings:', error);
            this.showNotification('Failed to save external tools settings. Please try again.', 'error');
        }
    }

    /**
     * Load settings from storage
     */
    async loadSettings() {
        try {
            if (this.genomeBrowser.configManager) {
                // Load built-in tools settings from GeneralSettingsManager
                const generalSettings = await this.genomeBrowser.configManager.get('generalSettings', {});
                if (generalSettings.deepGeneResearchUrl) {
                    this.builtinTools.deepGeneResearch.url = generalSettings.deepGeneResearchUrl;
                }
                if (generalSettings.chopchopUrl) {
                    this.builtinTools.chopchop.url = generalSettings.chopchopUrl;
                }
                if (generalSettings.progenFixerUrl) {
                    this.builtinTools.progenfixer.url = generalSettings.progenFixerUrl;
                }
                
                // Load custom tools settings
                const savedCustomTools = await this.genomeBrowser.configManager.get('externalTools.customTools');
                if (savedCustomTools && Array.isArray(savedCustomTools)) {
                    this.customTools = savedCustomTools;
                    console.log('✅ [ExternalTools] Loaded', savedCustomTools.length, 'custom tools from storage');
                    savedCustomTools.forEach((tool, index) => {
                        console.log(`   ${index + 1}. ${tool.name} - ${tool.url}`);
                    });
                } else {
                    console.log('📊 [ExternalTools] No saved custom tools found');
                }
            }
            
            console.log('✅ [ExternalTools] Settings loaded successfully');
        } catch (error) {
            console.error('❌ [ExternalTools] Failed to load settings:', error);
        }
    }

    /**
     * Reset to default settings
     */
    resetToDefaults() {
        this.builtinTools = {
            deepGeneResearch: {
                name: 'Deep Gene Research',
                url: 'http://localhost:3000/',
                icon: 'fas fa-dna',
                accelerator: 'CmdOrCtrl+Shift+W'
            },
            chopchop: {
                name: 'CHOPCHOP CRISPR Toolbox',
                url: 'https://chopchop.cbu.uib.no/',
                icon: 'fas fa-cut',
                accelerator: 'CmdOrCtrl+Shift+C'
            },
            progenfixer: {
                name: 'ProGenFixer',
                url: 'https://progenfixer.biodesign.ac.cn',
                icon: 'fas fa-wrench',
                accelerator: 'CmdOrCtrl+Shift+P'
            }
        };
        
        this.customTools = [];
        
        // Update modal
        this.populateModal();
        
        this.showNotification('External tools settings reset to defaults', 'info');
    }

    /**
     * Get all tools (built-in + custom) for menu integration
     */
    getAllTools() {
        const allTools = [];
        
        // Add built-in tools
        Object.entries(this.builtinTools).forEach(([key, tool]) => {
            allTools.push({
                type: 'builtin',
                key: key,
                name: tool.name,
                url: tool.url,
                accelerator: tool.accelerator
            });
        });
        
        // Add custom tools
        this.customTools.forEach(tool => {
            allTools.push({
                type: 'custom',
                id: tool.id,
                name: tool.name,
                url: tool.url
            });
        });
        
        return allTools;
    }

    /**
     * Update main menu to reflect current tools
     */
    updateMainMenu() {
        // Send IPC message to main process to update menu
        if (typeof require !== 'undefined') {
            const { ipcRenderer } = require('electron');
            ipcRenderer.send('update-external-tools-menu', this.getAllTools());
        }
    }

    /**
     * Open an external tool
     */
    openTool(toolData) {
        if (typeof require !== 'undefined') {
            const { ipcRenderer } = require('electron');
            
            if (toolData.type === 'builtin') {
                // Handle built-in tools with existing functions
                if (toolData.key === 'deepGeneResearch') {
                    ipcRenderer.send('open-deep-gene-research-window');
                } else if (toolData.key === 'chopchop') {
                    ipcRenderer.send('open-chopchop-window');
                } else if (toolData.key === 'progenfixer') {
                    ipcRenderer.send('open-progenfixer-window');
                }
            } else if (toolData.type === 'custom') {
                // Handle custom tools
                ipcRenderer.send('open-custom-external-tool', toolData);
            }
        }
    }

    /**
     * Utility function to escape HTML
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    /**
     * Show notification
     */
    showNotification(message, type = 'info') {
        if (this.genomeBrowser && this.genomeBrowser.showNotification) {
            this.genomeBrowser.showNotification(message, type);
        } else {
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.ExternalToolsManager = ExternalToolsManager;
}