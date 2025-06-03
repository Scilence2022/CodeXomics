const { ipcRenderer } = require('electron');

// Force reload - timestamp: 2025-05-31 15:01
/**
 * Main GenomeBrowser class - now modular and organized
 */
class GenomeBrowser {
    constructor() {
        // Initialize ConfigManager first
        this.configManager = new ConfigManager();
        
        this.fileManager = new FileManager(this);
        this.trackRenderer = new TrackRenderer(this);
        this.navigationManager = new NavigationManager(this);
        this.genomeNavigationBar = new GenomeNavigationBar(this);
        this.uiManager = new UIManager(this);
        this.sequenceUtils = new SequenceUtils(this);
        this.exportManager = new ExportManager(this);
        this.readsManager = new ReadsManager(this); // Initialize reads manager
        this.trackStateManager = new TrackStateManager(this);  // Add track state manager
        
        // State
        this.currentChromosome = null;
        this.currentSequence = {};
        this.currentAnnotations = {};
        this.currentVariants = {};
        this.currentReads = {}; // Keep for backward compatibility, but will be managed by ReadsManager
        this.currentPosition = { start: 0, end: 1000 };
        this.loadedFiles = [];
        this.sequenceLength = 0;
        this.operons = [];
        this.selectedGene = null;
        this.userDefinedFeatures = {};
        this.nextFeatureId = 1;
        this.sequenceSelection = { start: null, end: null, active: false };

        // Track visibility state
        this.trackVisibility = {
            genes: true,
            gc: true,
            variants: false,
            reads: false,
            proteins: false,
            sequence: true  // Add sequence as a regular track
        };

        // Feature type visibility
        this.featureVisibility = {
            genes: false,
            CDS: true,
            mRNA: true,
            tRNA: true,
            rRNA: true,
            promoter: true,
            terminator: true,
            regulatory: true,
            other: true
        };

        this.currentFile = null;
        this.searchResults = [];
        this.currentSearchIndex = 0;
        
        // Visual settings
        this.viewMode = 'overview'; // 'overview' or 'detail'
        this.basePairsPerPixel = 10;
        this.minBasePairsPerPixel = 0.1;
        this.maxBasePairsPerPixel = 1000;
        this.ZOOM_SENSITIVITY = 0.1;
        
        this._cachedCharWidth = null; // Cache for character width measurement
        
        // Operon color assignment
        this.operonColors = [
            '#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6',
            '#e67e22', '#1abc9c', '#34495e', '#f1c40f', '#e91e63'
        ];
        this.operonColorIndex = 0;
        this.operonColorMap = new Map(); // Map operon names to colors
        
        // User-defined features storage
        this.currentSequenceSelection = null; // Track current sequence selection
        
        // Initialize track visibility
        this.visibleTracks = new Set(['genes', 'gc', 'sequence']); // Default visible tracks
        
        // Initialize gene filters (corresponds to featureVisibility)
        this.geneFilters = {
            genes: false,
            CDS: true,
            mRNA: true,
            tRNA: true,
            rRNA: true,
            promoter: true,
            terminator: true,
            regulatory: true,
            other: true
        };
        
        this.init();
    }

    init() {
        // Force reload timestamp: 2025-05-31-15:05
        console.log('🚀 GenomeBrowser initialization starting...');
        
        // Step 1: Setup basic event listeners
        console.log('📝 Setting up event listeners...');
        this.setupEventListeners();
        
        // Step 2: Setup feature filters
        console.log('🔧 Setting up feature filter listeners...');
        this.setupFeatureFilterListeners();
        
        // Step 3: Initialize user features
        console.log('👤 Initializing user features...');
        this.initializeUserFeatures();
        
        // Step 4: Initialize LLM configuration
        console.log('🤖 About to initialize LLMConfigManager...');
        try {
            this.llmConfigManager = new LLMConfigManager(this.configManager);
            console.log('✅ LLMConfigManager initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing LLMConfigManager:', error);
        }
        
        // Step 5: Initialize ChatManager
        console.log('💬 About to initialize ChatManager...');
        try {
            this.chatManager = new ChatManager(this, this.configManager);
            console.log('✅ ChatManager initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing ChatManager:', error);
        }

        // Step 6: Setup IPC communication
        console.log('📡 Setting up IPC communication...');
        this.setupIPC();
        this.updateStatus('Ready');
        
        // Step 7: Make globally available
        console.log('🌐 Making instance globally available...');
        window.genomeBrowser = this;
        window.genomeApp = this; // For compatibility with ChatManager
        
        // Step 8: Initialize UI components
        console.log('🎨 Initializing UI components...');
        this.uiManager.initializeSplitter();
        this.uiManager.initializeHorizontalSplitter();
        
        // Step 9: Add resize listener
        console.log('📏 Adding window resize listener...');
        window.addEventListener('resize', () => {
            this.uiManager.handleWindowResize();
        });
        
        // Step 10: Debug Options button after delay
        console.log('⏱️ Setting up Options button debug...');
        setTimeout(() => {
            const optionsBtn = document.getElementById('optionsBtn');
            console.log('🔍 Debug: Options button found:', !!optionsBtn);
            if (optionsBtn) {
                console.log('🎯 Adding fallback click listener to Options button');
                optionsBtn.addEventListener('click', (e) => {
                    console.log('🖱️ DEBUG: Fallback Options button clicked!');
                    e.stopPropagation();
                    const dropdown = document.getElementById('optionsDropdownMenu');
                    if (dropdown) {
                        dropdown.classList.toggle('show');
                        console.log('📋 DEBUG: Toggled dropdown, classes:', dropdown.className);
                    } else {
                        console.error('❌ DEBUG: Dropdown menu not found');
                    }
                });
            } else {
                console.error('❌ DEBUG: Options button not found in DOM');
            }
        }, 1000);
        
        console.log('🎉 Genome AI Studio initialized successfully!');
    }

    setupEventListeners() {
        // File operations - dropdown menu
        document.getElementById('openFileBtn').addEventListener('click', () => this.uiManager.toggleFileDropdown());
        document.getElementById('openGenomeBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('genome'));
        document.getElementById('openAnnotationBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('annotation'));
        document.getElementById('openVariantBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('variant'));
        document.getElementById('openReadsBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('reads'));
        document.getElementById('openWIGBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('tracks'));
        document.getElementById('openAnyBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('any'));

        // Export operations - dropdown menu
        document.getElementById('exportFileBtn').addEventListener('click', () => this.uiManager.toggleExportDropdown());
        document.getElementById('exportFastaBtn').addEventListener('click', () => this.exportManager.exportAsFasta());
        document.getElementById('exportGenbankBtn').addEventListener('click', () => this.exportManager.exportAsGenBank());
        document.getElementById('exportCDSFastaBtn').addEventListener('click', () => this.exportManager.exportCDSAsFasta());
        document.getElementById('exportProteinFastaBtn').addEventListener('click', () => this.exportManager.exportProteinAsFasta());
        document.getElementById('exportGFFBtn').addEventListener('click', () => this.exportManager.exportAsGFF());
        document.getElementById('exportBEDBtn').addEventListener('click', () => this.exportManager.exportAsBED());
        document.getElementById('exportCurrentViewBtn').addEventListener('click', () => this.exportManager.exportCurrentViewAsFasta());

        // Welcome screen buttons
        document.getElementById('welcomeOpenGenomeBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('genome'));
        document.getElementById('welcomeOpenAnnotationBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('annotation'));
        document.getElementById('welcomeOpenVariantBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('variant'));
        document.getElementById('welcomeOpenReadsBtn').addEventListener('click', () => this.fileManager.openSpecificFileType('reads'));

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.file-menu-container')) {
                this.uiManager.closeFileDropdown();
                this.uiManager.closeExportDropdown();
            }
            
            // Auto-hide toggle panels when clicking outside
            if (!e.target.closest('#toggleTracks') && !e.target.closest('#trackCheckboxes')) {
                this.uiManager.hideTracksPanel();
            }
            
            if (!e.target.closest('#toggleFeatureFilters') && !e.target.closest('#featureFilterCheckboxes')) {
                this.uiManager.hideFeatureFiltersPanel();
            }
        });

        // Search functionality
        document.getElementById('searchBtn').addEventListener('click', () => this.navigationManager.showSearchModal());
        document.getElementById('searchInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.navigationManager.quickSearch();
        });

        // Position navigation
        document.getElementById('goToBtn').addEventListener('click', () => this.navigationManager.goToPosition());
        document.getElementById('positionInput').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') this.navigationManager.goToPosition();
        });

        // Navigation controls (sidebar)
        document.getElementById('prevBtn').addEventListener('click', () => this.navigationManager.navigatePrevious());
        document.getElementById('nextBtn').addEventListener('click', () => this.navigationManager.navigateNext());

        // Navigation controls (genome view)
        document.getElementById('prevBtnGenome').addEventListener('click', () => this.navigationManager.navigatePrevious());
        document.getElementById('nextBtnGenome').addEventListener('click', () => this.navigationManager.navigateNext());

        // Zoom controls
        document.getElementById('zoomInBtn').addEventListener('click', () => this.navigationManager.zoomIn());
        document.getElementById('zoomOutBtn').addEventListener('click', () => this.navigationManager.zoomOut());
        document.getElementById('resetZoomBtn').addEventListener('click', () => this.navigationManager.resetZoom());

        // Sequence controls
        document.getElementById('copySequenceBtn').addEventListener('click', () => this.sequenceUtils.copySequence());
        document.getElementById('exportBtn').addEventListener('click', () => this.sequenceUtils.exportSequence());

        // Sequence panel toggle
        document.getElementById('toggleSequencePanel').addEventListener('click', () => this.uiManager.toggleSequencePanel());

        // Modal controls
        this.uiManager.setupModalControls();

        // Chromosome selection
        document.getElementById('chromosomeSelect').addEventListener('change', (e) => {
            this.sequenceUtils.selectChromosome(e.target.value);
        });

        // Track selection (toolbar checkboxes)
        document.getElementById('trackGenes').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackGC').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackVariants').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackReads').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackWIG').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackProteins').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackSequence').addEventListener('change', () => this.updateVisibleTracks());

        // Sidebar track controls
        document.getElementById('sidebarTrackGenes').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackGC').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackVariants').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackReads').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackWIG').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackProteins').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackSequence').addEventListener('change', () => this.updateVisibleTracksFromSidebar());

        // Panel close buttons
        document.querySelectorAll('.close-panel-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const panelId = e.target.closest('.close-panel-btn').dataset.panel;
                this.uiManager.closePanel(panelId);
            });
        });

        // Feature filter toggle button
        document.getElementById('toggleFeatureFilters').addEventListener('click', () => {
            this.uiManager.toggleFeatureFilters();
        });

        // Setup feature filter event listeners
        this.setupFeatureFilterListeners();

        // Toggle buttons for toolbar sections
        document.getElementById('toggleTracks').addEventListener('click', () => {
            this.uiManager.toggleTracks();
        });
        
        // Sidebar toggle button
        document.getElementById('toggleSidebar').addEventListener('click', () => {
            this.uiManager.toggleSidebar();
        });
        
        // Splitter toggle button
        document.getElementById('splitterToggleBtn').addEventListener('click', () => {
            this.uiManager.toggleSidebarFromSplitter();
        });
        
        // MCP Settings modal
        document.getElementById('mcpSettingsBtn')?.addEventListener('click', () => this.showMCPSettingsModal());
    }

    showMCPSettingsModal() {
        const modal = document.getElementById('mcpSettingsModal');
        if (modal) {
            // Load current settings with proper fallback
            const defaultSettings = {
                autoConnect: false,
                serverUrl: 'ws://localhost:3001',
                reconnectDelay: 5
            };
            
            const mcpSettings = this.configManager ? 
                this.configManager.get('mcpSettings', defaultSettings) : 
                defaultSettings;
            
            // Populate modal fields
            document.getElementById('mcpAutoConnect').checked = mcpSettings.autoConnect;
            document.getElementById('mcpServerUrl').value = mcpSettings.serverUrl;
            document.getElementById('mcpReconnectDelay').value = mcpSettings.reconnectDelay;
            
            // Populate new server management interface
            this.populateMCPServersList();
            this.populateMCPToolsList();
            
            // Update connection status
            this.updateMCPConnectionStatus();
            
            // Setup modal event listeners if not already done
            this.setupMCPModalListeners();
            
            // Show modal
            modal.classList.add('show');
        }
    }

    setupMCPModalListeners() {
        const modal = document.getElementById('mcpSettingsModal');
        if (!modal || modal.hasAttribute('data-listeners-setup')) return;
        
        modal.setAttribute('data-listeners-setup', 'true');
        
        // Save settings button
        document.getElementById('saveMCPSettingsBtn')?.addEventListener('click', () => {
            this.saveMCPSettings();
        });
        
        // Add Server button - NEW
        document.getElementById('addMcpServerBtn')?.addEventListener('click', () => {
            this.showAddServerModal();
        });
        
        // Legacy connect/disconnect buttons
        document.getElementById('mcpConnectBtn')?.addEventListener('click', () => {
            if (this.chatManager) {
                this.chatManager.setupMCPConnection();
            }
        });
        
        document.getElementById('mcpDisconnectBtn')?.addEventListener('click', () => {
            if (this.chatManager) {
                this.chatManager.disconnectMCP();
            }
        });

        // New server management buttons
        document.getElementById('mcpConnectAllBtn')?.addEventListener('click', () => {
            this.connectAllMCPServers();
        });
        
        document.getElementById('mcpDisconnectAllBtn')?.addEventListener('click', () => {
            this.disconnectAllMCPServers();
        });

        document.getElementById('mcpRefreshServersBtn')?.addEventListener('click', () => {
            this.populateMCPServersList();
            this.updateMCPConnectionStatus();
            this.populateMCPToolsList();
        });

        // Add Server modal event listeners
        const addServerModal = document.getElementById('mcpServerEditModal');
        if (addServerModal) {
            // Save server button - add event listener
            document.getElementById('saveServerBtn')?.addEventListener('click', (e) => {
                e.preventDefault();
                const editingServerId = document.getElementById('editingServerId').value;
                this.saveServer(editingServerId || null);
            });

            // Test connection button
            document.getElementById('testServerConnectionBtn')?.addEventListener('click', () => {
                this.testMCPServerConnectionFromForm();
            });
            
            // Close modal handlers for add server modal
            addServerModal.querySelectorAll('.modal-close').forEach(btn => {
                btn.addEventListener('click', () => {
                    addServerModal.classList.remove('show');
                });
            });
            
            // Close modal when clicking outside
            addServerModal.addEventListener('click', (e) => {
                if (e.target === addServerModal) {
                    addServerModal.classList.remove('show');
                }
            });
        }
        
        // Close modal handlers for main MCP settings modal
        modal.querySelectorAll('.modal-close').forEach(btn => {
            btn.addEventListener('click', () => {
                modal.classList.remove('show');
            });
        });
        
        // Close modal when clicking outside
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });

        // Listen for server status changes to update UI
        if (this.chatManager?.mcpServerManager) {
            this.chatManager.mcpServerManager.on('serverConnected', () => {
                this.populateMCPServersList();
                this.updateMCPConnectionStatus();
                this.populateMCPToolsList();
            });

            this.chatManager.mcpServerManager.on('serverDisconnected', () => {
                this.populateMCPServersList();
                this.updateMCPConnectionStatus();
                this.populateMCPToolsList();
            });

            this.chatManager.mcpServerManager.on('serverAdded', () => {
                this.populateMCPServersList();
                this.updateMCPConnectionStatus();
            });

            this.chatManager.mcpServerManager.on('serverRemoved', () => {
                this.populateMCPServersList();
                this.updateMCPConnectionStatus();
                this.populateMCPToolsList();
            });

            this.chatManager.mcpServerManager.on('toolsDiscovered', () => {
                this.populateMCPToolsList();
            });
        }
    }

    saveMCPSettings() {
        const mcpSettings = {
            autoConnect: document.getElementById('mcpAutoConnect').checked,
            serverUrl: document.getElementById('mcpServerUrl').value.trim(),
            reconnectDelay: parseInt(document.getElementById('mcpReconnectDelay').value) || 5
        };
        
        // Validate settings
        if (!mcpSettings.serverUrl) {
            alert('Please enter a valid MCP server URL');
            return;
        }
        
        if (mcpSettings.reconnectDelay < 1 || mcpSettings.reconnectDelay > 60) {
            alert('Reconnection delay must be between 1 and 60 seconds');
            return;
        }
        
        // Save settings if configManager is available
        if (this.configManager) {
            this.configManager.set('mcpSettings', mcpSettings);
        } else {
            console.warn('ConfigManager not available, settings not saved');
        }
        
        // Close modal
        document.getElementById('mcpSettingsModal').classList.remove('show');
        
        // Show confirmation
        this.updateStatus('MCP settings saved successfully');
        
        // If auto-connect is now enabled and not currently connected, try to connect
        if (mcpSettings.autoConnect && this.chatManager && !this.chatManager.isConnected) {
            this.chatManager.setupMCPConnection();
        }
        
        // If auto-connect is disabled and currently connected, disconnect
        if (!mcpSettings.autoConnect && this.chatManager && this.chatManager.isConnected) {
            this.chatManager.disconnectMCP();
        }
    }

    // MCP Server Management Methods
    populateMCPServersList() {
        const serversList = document.getElementById('mcpServersList');
        if (!serversList) return;

        // Get servers from MCPServerManager
        const mcpManager = this.chatManager?.mcpServerManager;
        if (!mcpManager) {
            serversList.innerHTML = '<div class="empty-state">MCPServerManager not available</div>';
            return;
        }

        const servers = mcpManager.getServerStatus(); // Use getServerStatus instead of getServers
        
        if (servers.length === 0) {
            serversList.innerHTML = '<div class="empty-state">No MCP servers configured</div>';
            return;
        }

        serversList.innerHTML = '';
        
        servers.forEach(server => {
            const serverItem = document.createElement('div');
            serverItem.className = 'server-item';
            serverItem.innerHTML = `
                <div class="server-info">
                    <div class="server-header">
                        <span class="server-name">${this.escapeHtml(server.name)}</span>
                        <div class="server-status ${server.connected ? 'connected' : 'disconnected'}">
                            ${server.connected ? '●' : '○'}
                        </div>
                    </div>
                    <div class="server-details">
                        <span class="server-url">${this.escapeHtml(server.url)}</span>
                        <span class="server-category">${this.escapeHtml(server.category || 'general')}</span>
                        ${server.connected ? `<span class="tool-count">${server.toolCount} tools</span>` : ''}
                    </div>
                </div>
                <div class="server-actions">
                    <button class="btn-small ${server.enabled ? 'btn-secondary' : 'btn-primary'}" 
                            onclick="genomeBrowser.toggleMCPServer('${server.id}')">
                        ${server.enabled ? 'Disable' : 'Enable'}
                    </button>
                    <button class="btn-small btn-secondary" 
                            onclick="genomeBrowser.editMCPServer('${server.id}')">
                        Edit
                    </button>
                    ${!server.isBuiltin ? `<button class="btn-small btn-danger" 
                            onclick="genomeBrowser.removeMCPServer('${server.id}')">
                        Remove
                    </button>` : ''}
                </div>
            `;
            serversList.appendChild(serverItem);
        });

        // Add "Add Server" button
        const addButton = document.createElement('button');
        addButton.className = 'btn btn-primary add-server-btn';
        addButton.textContent = '+ Add Server';
        addButton.onclick = () => this.showAddServerModal();
        serversList.appendChild(addButton);
    }

    populateMCPToolsList() {
        const toolsList = document.getElementById('mcpToolsList');
        if (!toolsList) return;

        const mcpManager = this.chatManager?.mcpServerManager;
        if (!mcpManager) {
            toolsList.innerHTML = '<div class="empty-state">MCPServerManager not available</div>';
            return;
        }

        const allTools = mcpManager.getAllAvailableTools(); // Use getAllAvailableTools instead of getAllTools
        
        if (allTools.length === 0) {
            toolsList.innerHTML = '<div class="empty-state">No tools available from connected servers</div>';
            return;
        }

        // Group tools by category
        const toolsByCategory = {};
        allTools.forEach(tool => {
            const category = tool.category || 'general';
            if (!toolsByCategory[category]) {
                toolsByCategory[category] = [];
            }
            toolsByCategory[category].push(tool);
        });

        toolsList.innerHTML = '';

        Object.entries(toolsByCategory).forEach(([category, tools]) => {
            const categorySection = document.createElement('div');
            categorySection.className = 'tools-category';
            categorySection.innerHTML = `
                <h4 class="category-title">${this.escapeHtml(category)}</h4>
                <div class="tools-list">
                    ${tools.map(tool => `
                        <div class="tool-item">
                            <div class="tool-info">
                                <span class="tool-name">${this.escapeHtml(tool.name)}</span>
                                <span class="tool-server">(${this.escapeHtml(tool.serverName)})</span>
                            </div>
                            <div class="tool-description">${this.escapeHtml(tool.description || 'No description')}</div>
                        </div>
                    `).join('')}
                </div>
            `;
            toolsList.appendChild(categorySection);
        });
    }

    updateMCPConnectionStatus() {
        const statusTextElement = document.getElementById('mcpStatusText');
        const statusIconElement = document.getElementById('mcpStatusIcon');
        
        if (!statusTextElement || !statusIconElement) return;

        let statusText, statusClass;

        const mcpManager = this.chatManager?.mcpServerManager;
        if (!mcpManager) {
            statusText = 'MCPServerManager not available';
            statusClass = 'fas fa-circle status-none';
        } else {
            const servers = mcpManager.getServerStatus(); // Use getServerStatus instead of getServers
            const connectedCount = servers.filter(s => s.connected).length;
            const totalCount = servers.length;

            if (totalCount === 0) {
                statusText = 'No servers configured';
                statusClass = 'fas fa-circle status-none';
            } else if (connectedCount === 0) {
                statusText = `0/${totalCount} servers connected`;
                statusClass = 'fas fa-circle status-disconnected';
            } else if (connectedCount === totalCount) {
                statusText = `All ${totalCount} servers connected`;
                statusClass = 'fas fa-circle status-connected';
            } else {
                statusText = `${connectedCount}/${totalCount} servers connected`;
                statusClass = 'fas fa-circle status-partial';
            }
        }

        statusTextElement.textContent = statusText;
        statusIconElement.className = statusClass;
    }

    showAddServerModal() {
        const modal = document.getElementById('mcpServerEditModal');
        if (!modal) return;

        // Clear form
        document.getElementById('serverName').value = '';
        document.getElementById('serverDescription').value = '';
        document.getElementById('serverUrl').value = '';
        document.getElementById('serverCategory').value = 'general';
        document.getElementById('serverEnabled').checked = true;
        document.getElementById('serverAutoConnect').checked = false;
        document.getElementById('serverApiKey').value = '';
        document.getElementById('serverReconnectDelay').value = '5';
        document.getElementById('serverCapabilities').value = '';
        document.getElementById('editingServerId').value = '';

        // Set modal title
        document.getElementById('mcpServerEditTitle').textContent = 'Add MCP Server';

        modal.classList.add('show');
    }

    editMCPServer(serverId) {
        const mcpManager = this.chatManager?.mcpServerManager;
        if (!mcpManager) return;

        const server = mcpManager.getServer(serverId);
        if (!server) return;

        const modal = document.getElementById('mcpServerEditModal');
        if (!modal) return;

        // Populate form with server data
        document.getElementById('serverName').value = server.name;
        document.getElementById('serverDescription').value = server.description || '';
        document.getElementById('serverUrl').value = server.url;
        document.getElementById('serverCategory').value = server.category || 'general';
        document.getElementById('serverEnabled').checked = server.enabled;
        document.getElementById('serverAutoConnect').checked = server.autoConnect;
        document.getElementById('serverApiKey').value = server.apiKey || '';
        document.getElementById('serverReconnectDelay').value = server.reconnectDelay || 5;
        document.getElementById('serverCapabilities').value = server.capabilities ? server.capabilities.join(', ') : '';
        document.getElementById('editingServerId').value = serverId;

        // Set modal title
        document.getElementById('mcpServerEditTitle').textContent = 'Edit MCP Server';

        modal.classList.add('show');
    }

    saveServer(serverId = null) {
        const serverData = {
            name: document.getElementById('serverName').value.trim(),
            description: document.getElementById('serverDescription').value.trim(),
            url: document.getElementById('serverUrl').value.trim(),
            category: document.getElementById('serverCategory').value,
            enabled: document.getElementById('serverEnabled').checked,
            autoConnect: document.getElementById('serverAutoConnect').checked,
            apiKey: document.getElementById('serverApiKey').value.trim() || null,
            reconnectDelay: parseInt(document.getElementById('serverReconnectDelay').value) || 5,
            capabilities: document.getElementById('serverCapabilities').value.trim().split(',').map(c => c.trim()).filter(c => c)
        };

        // Validate
        if (!serverData.name) {
            alert('Please enter a server name');
            return;
        }
        if (!serverData.url) {
            alert('Please enter a server URL');
            return;
        }

        const mcpManager = this.chatManager?.mcpServerManager;
        if (!mcpManager) {
            alert('MCPServerManager not available');
            return;
        }

        try {
            if (serverId) {
                // Update existing server
                mcpManager.updateServer(serverId, serverData);
            } else {
                // Add new server
                mcpManager.addServer(serverData);
            }

            // Close modal
            document.getElementById('mcpServerEditModal').classList.remove('show');

            // Refresh server list
            this.populateMCPServersList();
            this.updateMCPConnectionStatus();

            this.updateStatus(serverId ? 'Server updated successfully' : 'Server added successfully');
        } catch (error) {
            alert(`Error saving server: ${error.message}`);
        }
    }

    toggleMCPServer(serverId) {
        const mcpManager = this.chatManager?.mcpServerManager;
        if (!mcpManager) return;

        const server = mcpManager.getServer(serverId);
        if (!server) return;

        try {
            mcpManager.updateServer(serverId, { enabled: !server.enabled });
            this.populateMCPServersList();
            this.updateMCPConnectionStatus();
            this.updateStatus(`Server ${server.enabled ? 'disabled' : 'enabled'}`);
        } catch (error) {
            alert(`Error toggling server: ${error.message}`);
        }
    }

    removeMCPServer(serverId) {
        const mcpManager = this.chatManager?.mcpServerManager;
        if (!mcpManager) return;

        const server = mcpManager.getServer(serverId);
        if (!server) return;

        if (confirm(`Are you sure you want to remove server "${server.name}"?`)) {
            try {
                mcpManager.removeServer(serverId);
                this.populateMCPServersList();
                this.updateMCPConnectionStatus();
                this.updateStatus('Server removed successfully');
            } catch (error) {
                alert(`Error removing server: ${error.message}`);
            }
        }
    }

    connectAllMCPServers() {
        const mcpManager = this.chatManager?.mcpServerManager;
        if (!mcpManager) return;

        mcpManager.connectAll();
        this.updateStatus('Connecting to all servers...');
        
        // Update UI after a short delay
        setTimeout(() => {
            this.populateMCPServersList();
            this.updateMCPConnectionStatus();
        }, 1000);
    }

    disconnectAllMCPServers() {
        const mcpManager = this.chatManager?.mcpServerManager;
        if (!mcpManager) return;

        mcpManager.disconnectAll();
        this.updateStatus('Disconnecting from all servers...');
        
        // Update UI immediately
        this.populateMCPServersList();
        this.updateMCPConnectionStatus();
    }

    testMCPServerConnection(serverId) {
        const mcpManager = this.chatManager?.mcpServerManager;
        if (!mcpManager) return;

        this.updateStatus('Testing connection...');
        mcpManager.testConnection(serverId)
            .then(result => {
                this.updateStatus(result.success ? 'Connection test successful' : `Connection test failed: ${result.error}`);
            })
            .catch(error => {
                this.updateStatus(`Connection test error: ${error.message}`);
            });
    }

    testMCPServerConnectionFromForm() {
        const testStatus = document.getElementById('testConnectionStatus');
        
        // Get form data
        const serverConfig = {
            name: document.getElementById('serverName').value.trim(),
            url: document.getElementById('serverUrl').value.trim(),
            apiKey: document.getElementById('serverApiKey').value.trim()
        };

        if (!serverConfig.url) {
            if (testStatus) testStatus.textContent = 'Please enter a server URL';
            return;
        }

        if (testStatus) {
            testStatus.textContent = 'Testing connection...';
            testStatus.className = 'test-status testing';
        }

        const mcpManager = this.chatManager?.mcpServerManager;
        if (!mcpManager) {
            if (testStatus) {
                testStatus.textContent = 'MCPServerManager not available';
                testStatus.className = 'test-status error';
            }
            return;
        }

        mcpManager.testServerConnection(serverConfig)
            .then(result => {
                if (testStatus) {
                    testStatus.textContent = 'Connection successful!';
                    testStatus.className = 'test-status success';
                }
                this.updateStatus('Connection test successful');
            })
            .catch(error => {
                if (testStatus) {
                    testStatus.textContent = `Connection failed: ${error.message}`;
                    testStatus.className = 'test-status error';
                }
                this.updateStatus(`Connection test failed: ${error.message}`);
            });
    }

    // Helper method to escape HTML
    escapeHtml(text) {
        if (typeof text !== 'string') return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    setupFeatureFilterListeners() {
        // Toolbar feature filter controls
        const toolbarFilters = [
            'showGenes', 'showCDS', 'showMRNA', 'showTRNA', 'showRRNA',
            'showPromoter', 'showTerminator', 'showRegulatory', 'showOther'
        ];
        
        const sidebarFilters = [
            'sidebarShowGenes', 'sidebarShowCDS', 'sidebarShowMRNA', 'sidebarShowTRNA', 'sidebarShowRRNA',
            'sidebarShowPromoter', 'sidebarShowTerminator', 'sidebarShowRegulatory', 'sidebarShowOther'
        ];

        // Map filter IDs to gene filter keys
        const filterMap = {
            'showGenes': 'genes', 'showCDS': 'CDS', 'showMRNA': 'mRNA', 'showTRNA': 'tRNA', 'showRRNA': 'rRNA',
            'showPromoter': 'promoter', 'showTerminator': 'terminator', 'showRegulatory': 'regulatory', 'showOther': 'other'
        };

        // Setup toolbar listeners
        toolbarFilters.forEach(filterId => {
            document.getElementById(filterId).addEventListener('change', (e) => {
                const filterKey = filterMap[filterId.replace('sidebar', '')];
                this.geneFilters[filterKey] = e.target.checked;
                this.syncSidebarFeatureFilter(filterId.replace('show', 'sidebarShow'), e.target.checked);
                this.updateGeneDisplay();
            });
        });

        // Setup sidebar listeners
        sidebarFilters.forEach(filterId => {
            document.getElementById(filterId).addEventListener('change', (e) => {
                const filterKey = filterMap[filterId.replace('sidebar', '').replace('Show', 'show')];
                this.geneFilters[filterKey] = e.target.checked;
                this.syncToolbarFeatureFilter(filterId.replace('sidebar', ''), e.target.checked);
                this.updateGeneDisplay();
            });
        });
    }

    setupIPC() {
        // Handle file opened from main process
        ipcRenderer.on('file-opened', (event, filePath) => {
            this.fileManager.loadFile(filePath);
        });

        // Handle menu actions
        ipcRenderer.on('show-search', () => {
            this.navigationManager.showSearchModal();
        });

        ipcRenderer.on('show-goto', () => {
            this.navigationManager.showGotoModal();
        });

        // Handle panel management
        ipcRenderer.on('show-panel', (event, panelId) => {
            this.uiManager.showPanel(panelId);
        });

        ipcRenderer.on('show-all-panels', () => {
            this.uiManager.showAllPanels();
        });
    }

    // Core genome display method
    async displayGenomeView(chromosome, sequence) {
        // Prevent multiple simultaneous rendering operations that could cause track duplication
        if (this._isRenderingView) {
            console.log('[displayGenomeView] Already rendering, skipping duplicate call');
            return;
        }
        
        this._isRenderingView = true;

        try {
            // Create EcoCyc-like studio view
            const container = document.getElementById('genomeViewer');
            
            // Show and update the navigation bar
            this.genomeNavigationBar.show(chromosome, sequence.length);
            
            // PRESERVE TRACK HEIGHTS before clearing container
            const preservedHeights = new Map();
            const trackTypeMapping = {
                'gene': 'genes',
                'gc': 'gc',
                'variant': 'variants',
                'reads': 'reads',
                'proteins': 'proteins',
                'wig': 'wigTracks'  // Add WIG tracks to preservation mapping
                // Remove 'sequence' since it's now handled as bottom panel, not a regular track
            };

            const existingTracks = container.querySelectorAll('[class*="-track"]');
            console.log('[displayGenomeView] Existing tracks found for height preservation:', existingTracks.length);
            existingTracks.forEach(track => {
                const trackContent = track.querySelector('.track-content');
                if (trackContent && trackContent.style.height && trackContent.style.height !== '') {
                    let baseType = null;
                    for (const cls of track.classList) {
                        if (cls.endsWith('-track') && !cls.startsWith('track-splitter')) { // Ensure it's a main track div
                            baseType = cls.replace('-track', '');
                            break;
                        }
                    }
                    if (baseType) {
                        const mappedType = trackTypeMapping[baseType];
                        if (mappedType) {
                            preservedHeights.set(mappedType, trackContent.style.height);
                            console.log(`[displayGenomeView] Preserving height for ${mappedType} (from class ${baseType}-track): ${trackContent.style.height}`);
                        } else {
                            console.warn(`[displayGenomeView] No mapping found for base track type: ${baseType} from classList:`, track.classList);
                        }
                    } else {
                        // console.log('[displayGenomeView] Could not determine baseType for track:', track.className);
                    }
                } else if (trackContent) {
                    // console.log('[displayGenomeView] No style.height to preserve for track (or height is empty string):', track.className, 'Height:', trackContent.style.height);
                }
            });
            console.log('[displayGenomeView] Preserved heights map:', preservedHeights);
            
            container.innerHTML = '';
            
            // Show navigation controls
            document.getElementById('genomeNavigation').style.display = 'block';
            
            // Create Genome AI Studio container
            const browserContainer = document.createElement('div');
            browserContainer.className = 'genome-browser-container';
            
            // Collect all tracks to be displayed
            const tracksToShow = [];
            
            // 1. Gene track (only if genes track is selected and annotations exist)
            if (this.visibleTracks.has('genes') && this.currentAnnotations && this.currentAnnotations[chromosome]) {
                const geneTrack = this.trackRenderer.createGeneTrack(chromosome);
                tracksToShow.push({ element: geneTrack, type: 'genes' });
            }
            
            // 2. GC Content track (only if GC track is selected)
            if (this.visibleTracks.has('gc')) {
                const gcTrack = this.trackRenderer.createGCTrack(chromosome, sequence);
                tracksToShow.push({ element: gcTrack, type: 'gc' });
            }
            
            // 3. Variants track (show if selected, even without data)
            if (this.visibleTracks.has('variants')) {
                const variantTrack = this.trackRenderer.createVariantTrack(chromosome);
                tracksToShow.push({ element: variantTrack, type: 'variants' });
            }
            
            // 4. Aligned reads track (show if selected, even without data) - Now async
            if (this.visibleTracks.has('reads')) {
                const readsTrack = await this.trackRenderer.createReadsTrack(chromosome);
                tracksToShow.push({ element: readsTrack, type: 'reads' });
            }
            
            // 5. WIG tracks (show if selected, even without data)
            if (this.visibleTracks.has('wigTracks')) {
                const wigTrack = this.trackRenderer.createWIGTrack(chromosome);
                tracksToShow.push({ element: wigTrack, type: 'wigTracks' });
            }

            // 6. Protein track (only if proteins track is selected and we have CDS annotations)
            if (this.visibleTracks.has('proteins') && this.currentAnnotations && this.currentAnnotations[chromosome]) {
                const proteinTrack = this.trackRenderer.createProteinTrack(chromosome);
                tracksToShow.push({ element: proteinTrack, type: 'proteins' });
            }
            
            // Add tracks without splitters, but make them draggable and resizable
            tracksToShow.forEach((track, index) => {
                // Add the track
                browserContainer.appendChild(track.element);
                
                // RESTORE PRESERVED HEIGHT if it exists (current session)
                const trackContent = track.element.querySelector('.track-content');
                const typeToRestore = track.type;
                if (trackContent && preservedHeights.has(typeToRestore)) {
                    const heightToRestore = preservedHeights.get(typeToRestore);
                    trackContent.style.height = heightToRestore;
                    console.log(`[displayGenomeView] Restored height for ${typeToRestore}: ${heightToRestore}`);
                } else if (trackContent) {
                     console.log(`[displayGenomeView] No preserved height found for ${typeToRestore}. Current height: ${trackContent.style.height}`);
                }
                
                // Make tracks draggable for reordering and add resize handle
                this.makeTrackDraggable(track.element, track.type);
                this.addTrackResizeHandle(track.element, track.type);
            });
            
            container.appendChild(browserContainer);
            
            // Apply saved track state (sizes and order) from previous sessions
            this.trackStateManager.applyTrackSizes(browserContainer);
            this.trackStateManager.applyTrackOrder(browserContainer);
            
            // Handle bottom sequence panel separately (always docked to bottom)
            this.handleBottomSequencePanel(chromosome, sequence);
            
            // Notify reads manager of navigation change for cache management
            if (this.readsManager) {
                this.readsManager.onNavigationChange(chromosome, this.currentPosition.start, this.currentPosition.end);
            }
        } finally {
            // Always clear the rendering flag
            this._isRenderingView = false;
        }
    }
    
    // Setup the existing toggle button to work with new bottom sequence panel
    setupToggleButtonListener() {
        const toggleButton = document.getElementById('toggleSequencePanel');
        if (toggleButton && !toggleButton.hasAttribute('data-updated-listener')) {
            toggleButton.setAttribute('data-updated-listener', 'true');
            
            // Remove old event listeners
            toggleButton.removeEventListener('click', this.toggleSequencePanel);
            
            // Add new event listener
            toggleButton.addEventListener('click', () => {
                this.toggleBottomSequencePanel();
            });
        }
    }

    // Create a resizable splitter between tracks
    createTrackSplitter(topTrackType, bottomTrackType) {
        const splitter = document.createElement('div');
        splitter.className = 'track-splitter';
        splitter.setAttribute('data-top-track', topTrackType);
        splitter.setAttribute('data-bottom-track', bottomTrackType);
        
        // Add visual indicator
        const handle = document.createElement('div');
        handle.className = 'track-splitter-handle';
        handle.innerHTML = '⋯';
        splitter.appendChild(handle);
        
        // Add resize functionality
        this.makeTrackSplitterResizable(splitter);
        
        return splitter;
    }

    // Make track splitter resizable
    makeTrackSplitterResizable(splitter) {
        let isResizing = false;
        let startY = 0;
        let startTopHeight = 0;
        let startBottomHeight = 0;
        let topTrack = null;
        let bottomTrack = null;
        
        const startResize = (e) => {
            isResizing = true;
            startY = e.clientY || e.touches[0].clientY;
            
            // Set a global flag to prevent track content dragging during splitter resize
            document.body.setAttribute('data-splitter-resizing', 'true');
            
            // Find the tracks above and below this splitter
            topTrack = splitter.previousElementSibling;
            bottomTrack = splitter.nextElementSibling;
            
            if (topTrack && bottomTrack) {
                const topContent = topTrack.querySelector('.track-content');
                const bottomContent = bottomTrack.querySelector('.track-content');
                
                if (topContent && bottomContent) {
                    startTopHeight = topContent.offsetHeight;
                    startBottomHeight = bottomContent.offsetHeight;
                }
            }
            
            splitter.classList.add('resizing');
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
            
            e.preventDefault();
        };
        
        const doResize = (e) => {
            if (!isResizing || !topTrack || !bottomTrack) return;
            
            const currentY = e.clientY || e.touches[0].clientY;
            const deltaY = currentY - startY;
            
            const topContent = topTrack.querySelector('.track-content');
            const bottomContent = bottomTrack.querySelector('.track-content');
            
            if (topContent && bottomContent) {
                // Calculate new heights
                const newTopHeight = startTopHeight + deltaY;
                const newBottomHeight = startBottomHeight - deltaY;
                
                // Set minimum heights
                const minHeight = 40;
                
                if (newTopHeight >= minHeight && newBottomHeight >= minHeight) {
                    topContent.style.height = `${newTopHeight}px`;
                    bottomContent.style.height = `${newBottomHeight}px`;
                }
            }
            
            e.preventDefault();
        };
        
        const stopResize = () => {
            if (!isResizing) return;
            
            isResizing = false;
            splitter.classList.remove('resizing');
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            
            // Remove the global flag to allow track content dragging again
            document.body.removeAttribute('data-splitter-resizing');
            
            topTrack = null;
            bottomTrack = null;
        };
        
        // Auto-adjust height calculation - triggered on double-click
        const autoAdjustHeight = () => {
            const topTrack = splitter.previousElementSibling;
            const bottomTrack = splitter.nextElementSibling;
            
            if (topTrack && bottomTrack) {
                const topContent = topTrack.querySelector('.track-content');
                const bottomContent = bottomTrack.querySelector('.track-content');
                
                if (topContent && bottomContent) {
                    // Add visual feedback
                    splitter.classList.add('auto-adjusting');
                    
                    // Calculate optimal height for top track based on its content
                    let optimalHeight = 80;
                    
                    // Get track type from data attributes
                    const topTrackType = splitter.getAttribute('data-top-track');
                    
                    switch (topTrackType) {
                        case 'genes':
                            const geneElements = topContent.querySelectorAll('.gene-element');
                            if (geneElements.length > 0) {
                                let maxRow = 0;
                                let elementHeight = 23;
                                geneElements.forEach(gene => {
                                    const top = parseInt(gene.style.top) || 0;
                                    const height = parseInt(gene.style.height) || elementHeight;
                                    maxRow = Math.max(maxRow, top + height);
                                });
                                optimalHeight = Math.max(100, maxRow + 60);
                            } else {
                                optimalHeight = 100;
                            }
                            break;
                        case 'reads':
                            const readElements = topContent.querySelectorAll('.read-element');
                            if (readElements.length > 0) {
                                let maxRow = 0;
                                let elementHeight = 12;
                                readElements.forEach(read => {
                                    const top = parseInt(read.style.top) || 0;
                                    const height = parseInt(read.style.height) || elementHeight;
                                    maxRow = Math.max(maxRow, top + height);
                                });
                                optimalHeight = Math.max(80, maxRow + 40);
                            } else {
                                optimalHeight = 80;
                            }
                            break;
                        case 'gc':
                            optimalHeight = 120; // Updated for enhanced GC Content & Skew track
                            break;
                        case 'variants':
                            const variantElements = topContent.querySelectorAll('.variant-element');
                            if (variantElements.length > 0) {
                                optimalHeight = 80;
                            } else {
                                optimalHeight = 60;
                            }
                            break;
                        case 'proteins':
                            optimalHeight = 90;
                            break;
                        case 'wigTracks':
                            // For WIG tracks, use a default optimal height
                            optimalHeight = 120;
                            break;
                        default:
                            optimalHeight = 80;
                    }
                    
                    // Apply the optimal height with smooth transition
                    topContent.style.transition = 'height 0.3s ease';
                    topContent.style.height = `${optimalHeight}px`;
                    
                    // Remove transition and animation classes after animation completes
                    setTimeout(() => {
                        topContent.style.transition = '';
                        splitter.classList.remove('auto-adjusting');
                    }, 300);
                }
            }
        };
        
        // Mouse events
        splitter.addEventListener('mousedown', startResize);
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
        
        // Touch events for mobile
        splitter.addEventListener('touchstart', startResize, { passive: false });
        document.addEventListener('touchmove', doResize, { passive: false });
        document.addEventListener('touchend', stopResize);
        
        // Double-click for auto-adjust
        splitter.addEventListener('dblclick', autoAdjustHeight);
        
        // Make splitter focusable for keyboard navigation
        splitter.setAttribute('tabindex', '0');
        splitter.addEventListener('keydown', (e) => {
            const step = 10; // pixels to move per keypress
            let deltaY = 0;
            
            switch(e.key) {
                case 'ArrowUp':
                    deltaY = -step;
                    break;
                case 'ArrowDown':
                    deltaY = step;
                    break;
                case 'Home':
                    autoAdjustHeight();
                    e.preventDefault();
                    return;
                default:
                    return;
            }
            
            e.preventDefault();
            
            // Apply keyboard movement
            const topTrack = splitter.previousElementSibling;
            const bottomTrack = splitter.nextElementSibling;
            
            if (topTrack && bottomTrack) {
                const topContent = topTrack.querySelector('.track-content');
                const bottomContent = bottomTrack.querySelector('.track-content');
                
                if (topContent && bottomContent) {
                    const currentTopHeight = topContent.offsetHeight;
                    const currentBottomHeight = bottomContent.offsetHeight;
                    
                    const newTopHeight = currentTopHeight + deltaY;
                    const newBottomHeight = currentBottomHeight - deltaY;
                    
                    const minHeight = 40;
                    
                    if (newTopHeight >= minHeight && newBottomHeight >= minHeight) {
                        topContent.style.height = `${newTopHeight}px`;
                        bottomContent.style.height = `${newBottomHeight}px`;
                    }
                }
            }
        });
    }

    // Make individual tracks draggable for reordering
    makeTrackDraggable(trackElement, trackType) {
        // Add drag handle to track header
        const trackHeader = trackElement.querySelector('.track-header');
        if (trackHeader) {
            trackHeader.style.cursor = 'move';
            trackHeader.setAttribute('draggable', true);
            trackHeader.setAttribute('data-track-type', trackType);
            
            // Add drag handle icon
            const dragHandle = document.createElement('div');
            dragHandle.className = 'track-drag-handle';
            dragHandle.innerHTML = '<i class="fas fa-grip-vertical"></i>';
            dragHandle.style.cssText = `
                position: absolute;
                left: 8px;
                top: 50%;
                transform: translateY(-50%);
                color: #6c757d;
                cursor: grab;
                font-size: 12px;
                z-index: 10;
            `;
            trackHeader.style.position = 'relative';
            trackHeader.style.paddingLeft = '30px';
            trackHeader.insertBefore(dragHandle, trackHeader.firstChild);
            
            // Drag event handlers
            trackHeader.addEventListener('dragstart', (e) => {
                e.dataTransfer.setData('text/plain', trackType);
                e.dataTransfer.effectAllowed = 'move';
                trackElement.classList.add('dragging');
                dragHandle.style.cursor = 'grabbing';
            });
            
            trackHeader.addEventListener('dragend', (e) => {
                trackElement.classList.remove('dragging');
                dragHandle.style.cursor = 'grab';
                
                // Remove all drop indicators
                document.querySelectorAll('.track-drop-indicator').forEach(indicator => {
                    indicator.remove();
                });
            });
        }
        
        // Make track a drop target
        trackElement.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            
            const draggingElement = document.querySelector('.dragging');
            if (draggingElement && draggingElement !== trackElement) {
                this.showDropIndicator(trackElement, e.clientY);
            }
        });
        
        trackElement.addEventListener('dragleave', (e) => {
            if (!trackElement.contains(e.relatedTarget)) {
                this.hideDropIndicator(trackElement);
            }
        });
        
        trackElement.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedTrackType = e.dataTransfer.getData('text/plain');
            const draggedElement = document.querySelector('.dragging');
            
            if (draggedElement && draggedElement !== trackElement) {
                this.reorderTracks(draggedElement, trackElement, e.clientY);
            }
            
            this.hideDropIndicator(trackElement);
        });
    }
    
    // Add resize handle to track
    addTrackResizeHandle(trackElement, trackType) {
        const resizeHandle = document.createElement('div');
        resizeHandle.className = 'track-resize-handle';
        resizeHandle.innerHTML = '<i class="fas fa-grip-horizontal"></i>';
        resizeHandle.style.cssText = `
            position: absolute;
            bottom: -4px;
            left: 50%;
            transform: translateX(-50%);
            width: 40px;
            height: 8px;
            background: linear-gradient(to bottom, #e9ecef, #dee2e6, #e9ecef);
            border: 1px solid #ced4da;
            border-radius: 4px;
            cursor: row-resize;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #6c757d;
            font-size: 8px;
            opacity: 0.7;
            transition: all 0.2s ease;
            z-index: 10;
        `;
        
        trackElement.style.position = 'relative';
        trackElement.appendChild(resizeHandle);
        
        // Hover effects
        resizeHandle.addEventListener('mouseenter', () => {
            resizeHandle.style.opacity = '1';
            resizeHandle.style.height = '10px';
            resizeHandle.style.bottom = '-5px';
        });
        
        resizeHandle.addEventListener('mouseleave', () => {
            resizeHandle.style.opacity = '0.7';
            resizeHandle.style.height = '8px';
            resizeHandle.style.bottom = '-4px';
        });
        
        // Resize functionality
        this.makeResizeHandleResizable(resizeHandle, trackElement, trackType);
    }
    
    // Make resize handle functional
    makeResizeHandleResizable(resizeHandle, trackElement, trackType) {
        let isResizing = false;
        let startY = 0;
        let startHeight = 0;
        
        const startResize = (e) => {
            isResizing = true;
            startY = e.clientY || e.touches[0].clientY;
            
            const trackContent = trackElement.querySelector('.track-content');
            if (trackContent) {
                startHeight = trackContent.offsetHeight;
            }
            
            document.body.style.cursor = 'row-resize';
            document.body.style.userSelect = 'none';
            resizeHandle.style.background = 'linear-gradient(to bottom, #ced4da, #adb5bd, #ced4da)';
            
            e.preventDefault();
            e.stopPropagation();
        };
        
        const doResize = (e) => {
            if (!isResizing) return;
            
            const currentY = e.clientY || e.touches[0].clientY;
            const deltaY = currentY - startY;
            
            const trackContent = trackElement.querySelector('.track-content');
            if (trackContent) {
                const newHeight = Math.max(50, startHeight + deltaY);
                trackContent.style.height = `${newHeight}px`;
                
                // Save the new size to track state manager
                this.trackStateManager.saveTrackSize(trackType, `${newHeight}px`);
            }
            
            e.preventDefault();
        };
        
        const stopResize = () => {
            if (!isResizing) return;
            
            isResizing = false;
            document.body.style.cursor = '';
            document.body.style.userSelect = '';
            resizeHandle.style.background = 'linear-gradient(to bottom, #e9ecef, #dee2e6, #e9ecef)';
        };
        
        // Mouse events
        resizeHandle.addEventListener('mousedown', startResize);
        document.addEventListener('mousemove', doResize);
        document.addEventListener('mouseup', stopResize);
        
        // Touch events
        resizeHandle.addEventListener('touchstart', startResize, { passive: false });
        document.addEventListener('touchmove', doResize, { passive: false });
        document.addEventListener('touchend', stopResize);
        
        // Double-click to auto-adjust height
        resizeHandle.addEventListener('dblclick', () => {
            const trackContent = trackElement.querySelector('.track-content');
            if (trackContent) {
                let optimalHeight = 80;
                
                switch (trackType) {
                    case 'genes':
                        const geneElements = trackContent.querySelectorAll('.gene-element');
                        if (geneElements.length > 0) {
                            let maxRow = 0;
                            geneElements.forEach(gene => {
                                const top = parseInt(gene.style.top) || 0;
                                const height = parseInt(gene.style.height) || 23;
                                maxRow = Math.max(maxRow, top + height);
                            });
                            optimalHeight = Math.max(100, maxRow + 60);
                        }
                        break;
                    case 'reads':
                        const readElements = trackContent.querySelectorAll('.read-element');
                        if (readElements.length > 0) {
                            let maxRow = 0;
                            readElements.forEach(read => {
                                const top = parseInt(read.style.top) || 0;
                                const height = parseInt(read.style.height) || 12;
                                maxRow = Math.max(maxRow, top + height);
                            });
                            optimalHeight = Math.max(80, maxRow + 40);
                        }
                        break;
                    case 'gc':
                        optimalHeight = 120; // Updated for enhanced GC Content & Skew track
                        break;
                    case 'variants':
                        optimalHeight = 80;
                        break;
                    case 'proteins':
                        optimalHeight = 90;
                        break;
                    case 'wigTracks':
                        // For WIG tracks, use a default optimal height
                        optimalHeight = 120;
                        break;
                    default:
                        optimalHeight = 80;
                }
                
                trackContent.style.height = `${optimalHeight}px`;
                
                // Save the new size to track state manager
                this.trackStateManager.saveTrackSize(trackType, `${optimalHeight}px`);
                
                // Visual feedback
                resizeHandle.style.background = 'linear-gradient(to bottom, #28a745, #20c997, #28a745)';
                setTimeout(() => {
                    resizeHandle.style.background = 'linear-gradient(to bottom, #e9ecef, #dee2e6, #e9ecef)';
                }, 300);
            }
        });
    }
    
    // Show drop indicator when dragging tracks
    showDropIndicator(targetElement, mouseY) {
        this.hideDropIndicator(targetElement);
        
        const rect = targetElement.getBoundingClientRect();
        const midPoint = rect.top + rect.height / 2;
        const isAbove = mouseY < midPoint;
        
        const indicator = document.createElement('div');
        indicator.className = 'track-drop-indicator';
        indicator.style.cssText = `
            position: absolute;
            left: 0;
            right: 0;
            height: 3px;
            background: #007bff;
            z-index: 1000;
            box-shadow: 0 0 4px rgba(0, 123, 255, 0.5);
            ${isAbove ? 'top: -2px;' : 'bottom: -2px;'}
        `;
        
        targetElement.style.position = 'relative';
        targetElement.appendChild(indicator);
    }
    
    // Hide drop indicator
    hideDropIndicator(targetElement) {
        const indicator = targetElement.querySelector('.track-drop-indicator');
        if (indicator) {
            indicator.remove();
        }
    }
    
    // Reorder tracks based on drop position
    reorderTracks(draggedElement, targetElement, mouseY) {
        const container = targetElement.parentElement;
        const rect = targetElement.getBoundingClientRect();
        const midPoint = rect.top + rect.height / 2;
        const insertBefore = mouseY < midPoint;
        
        if (insertBefore) {
            container.insertBefore(draggedElement, targetElement);
        } else {
            container.insertBefore(draggedElement, targetElement.nextSibling);
        }
        
        // Update track visibility state based on new order
        this.updateTrackOrder();
    }
    
    // Update internal track order state
    updateTrackOrder() {
        const container = document.querySelector('.genome-browser-container');
        if (!container) return;
        
        const trackElements = Array.from(container.querySelectorAll('[class*="-track"]'));
        const newOrder = [];
        
        trackElements.forEach(element => {
            const classList = Array.from(element.classList);
            const trackClass = classList.find(cls => cls.endsWith('-track'));
            if (trackClass) {
                const trackType = trackClass.replace('-track', '');
                const typeMapping = {
                    'gene': 'genes',
                    'gc': 'gc',
                    'variant': 'variants',
                    'reads': 'reads',
                    'proteins': 'proteins',
                    'wig': 'wigTracks'  // Add WIG tracks to order mapping
                    // Remove 'sequence' since it's now handled as bottom panel, not a regular track
                };
                const mappedType = typeMapping[trackType] || trackType;
                newOrder.push(mappedType);
            }
        });
        
        console.log('New track order:', newOrder);
        
        // Save the new order to track state manager
        this.trackStateManager.saveTrackOrder(newOrder);
        
        // Store the order preference if needed
        if (this.configManager) {
            this.configManager.set('trackOrder', newOrder);
        }
    }

    // Track management methods
    updateVisibleTracks() {
        // Clear any existing timeout to debounce rapid calls
        if (this._updateTracksTimeout) {
            clearTimeout(this._updateTracksTimeout);
        }
        
        this._updateTracksTimeout = setTimeout(() => {
            this._doUpdateVisibleTracks();
        }, 50); // 50ms debounce
    }
    
    _doUpdateVisibleTracks() {
        // Get selected tracks from toolbar checkboxes
        const tracks = new Set();
        const trackGenes = document.getElementById('trackGenes');
        const trackGC = document.getElementById('trackGC');
        const trackVariants = document.getElementById('trackVariants');
        const trackReads = document.getElementById('trackReads');
        const trackWIG = document.getElementById('trackWIG');
        const trackProteins = document.getElementById('trackProteins');
        const trackSequence = document.getElementById('trackSequence');
        
        if (trackGenes && trackGenes.checked) tracks.add('genes');
        if (trackGC && trackGC.checked) tracks.add('gc');
        if (trackVariants && trackVariants.checked) tracks.add('variants');
        if (trackReads && trackReads.checked) tracks.add('reads');
        if (trackWIG && trackWIG.checked) tracks.add('wigTracks');
        if (trackProteins && trackProteins.checked) tracks.add('proteins');
        if (trackSequence && trackSequence.checked) tracks.add('sequence');
        
        this.visibleTracks = tracks;
        
        // Sync with sidebar
        const sidebarTrackGenes = document.getElementById('sidebarTrackGenes');
        const sidebarTrackGC = document.getElementById('sidebarTrackGC');
        const sidebarTrackVariants = document.getElementById('sidebarTrackVariants');
        const sidebarTrackReads = document.getElementById('sidebarTrackReads');
        const sidebarTrackWIG = document.getElementById('sidebarTrackWIG');
        const sidebarTrackProteins = document.getElementById('sidebarTrackProteins');
        const sidebarTrackSequence = document.getElementById('sidebarTrackSequence');
        
        if (sidebarTrackGenes) sidebarTrackGenes.checked = tracks.has('genes');
        if (sidebarTrackGC) sidebarTrackGC.checked = tracks.has('gc');
        if (sidebarTrackVariants) sidebarTrackVariants.checked = tracks.has('variants');
        if (sidebarTrackReads) sidebarTrackReads.checked = tracks.has('reads');
        if (sidebarTrackWIG) sidebarTrackWIG.checked = tracks.has('wigTracks');
        if (sidebarTrackProteins) sidebarTrackProteins.checked = tracks.has('proteins');
        if (sidebarTrackSequence) sidebarTrackSequence.checked = tracks.has('sequence');
        
        // Refresh the genome view if a file is loaded
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
        }
    }

    updateVisibleTracksFromSidebar() {
        // Clear any existing timeout to debounce rapid calls
        if (this._updateTracksFromSidebarTimeout) {
            clearTimeout(this._updateTracksFromSidebarTimeout);
        }
        
        this._updateTracksFromSidebarTimeout = setTimeout(() => {
            this._doUpdateVisibleTracksFromSidebar();
        }, 50); // 50ms debounce
    }
    
    _doUpdateVisibleTracksFromSidebar() {
        // Get selected tracks from sidebar checkboxes
        const tracks = new Set();
        const sidebarTrackGenes = document.getElementById('sidebarTrackGenes');
        const sidebarTrackGC = document.getElementById('sidebarTrackGC');
        const sidebarTrackVariants = document.getElementById('sidebarTrackVariants');
        const sidebarTrackReads = document.getElementById('sidebarTrackReads');
        const sidebarTrackWIG = document.getElementById('sidebarTrackWIG');
        const sidebarTrackProteins = document.getElementById('sidebarTrackProteins');
        const sidebarTrackSequence = document.getElementById('sidebarTrackSequence');
        
        if (sidebarTrackGenes && sidebarTrackGenes.checked) tracks.add('genes');
        if (sidebarTrackGC && sidebarTrackGC.checked) tracks.add('gc');
        if (sidebarTrackVariants && sidebarTrackVariants.checked) tracks.add('variants');
        if (sidebarTrackReads && sidebarTrackReads.checked) tracks.add('reads');
        if (sidebarTrackWIG && sidebarTrackWIG.checked) tracks.add('wigTracks');
        if (sidebarTrackProteins && sidebarTrackProteins.checked) tracks.add('proteins');
        if (sidebarTrackSequence && sidebarTrackSequence.checked) tracks.add('sequence');
        
        this.visibleTracks = tracks;
        
        // Sync with toolbar
        const trackGenes = document.getElementById('trackGenes');
        const trackGC = document.getElementById('trackGC');
        const trackVariants = document.getElementById('trackVariants');
        const trackReads = document.getElementById('trackReads');
        const trackWIG = document.getElementById('trackWIG');
        const trackProteins = document.getElementById('trackProteins');
        const trackSequence = document.getElementById('trackSequence');
        
        if (trackGenes) trackGenes.checked = tracks.has('genes');
        if (trackGC) trackGC.checked = tracks.has('gc');
        if (trackVariants) trackVariants.checked = tracks.has('variants');
        if (trackReads) trackReads.checked = tracks.has('reads');
        if (trackWIG) trackWIG.checked = tracks.has('wigTracks');
        if (trackProteins) trackProteins.checked = tracks.has('proteins');
        if (trackSequence) trackSequence.checked = tracks.has('sequence');
        
        // Refresh the genome view if a file is loaded
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
        }
    }

    // Gene filter methods
    shouldShowGeneType(type) {
        const typeMap = {
            'gene': 'genes',
            'CDS': 'CDS',
            'mRNA': 'mRNA',
            'tRNA': 'tRNA',
            'rRNA': 'rRNA',
            'promoter': 'promoter',
            'terminator': 'terminator',
            'regulatory': 'regulatory',
            'other': 'other',
            'misc_feature': 'other',
            'repeat_region': 'other'
        };
        
        const filterKey = typeMap[type] || 'other';
        return this.geneFilters[filterKey];
    }

    // Operon detection and color assignment methods
    detectOperons(annotations) {
        // Simple operon detection based on gene proximity and strand
        const operons = [];
        const genes = annotations.filter(feature => 
            ['CDS', 'mRNA', 'tRNA', 'rRNA'].includes(feature.type)
        ).sort((a, b) => a.start - b.start);

        if (genes.length === 0) return operons;

        let currentOperon = [genes[0]];
        const maxGap = 500; // Maximum gap between genes in an operon (bp)

        for (let i = 1; i < genes.length; i++) {
            const prevGene = genes[i - 1];
            const currentGene = genes[i];
            
            // Check if genes are close enough and on the same strand to be in the same operon
            const gap = currentGene.start - prevGene.end;
            const sameStrand = prevGene.strand === currentGene.strand;
            
            if (gap <= maxGap && sameStrand && gap >= 0) {
                currentOperon.push(currentGene);
            } else {
                // Finalize current operon if it has multiple genes
                if (currentOperon.length > 1) {
                    operons.push({
                        genes: [...currentOperon],
                        start: currentOperon[0].start,
                        end: currentOperon[currentOperon.length - 1].end,
                        strand: currentOperon[0].strand,
                        name: this.generateOperonName(currentOperon)
                    });
                }
                currentOperon = [currentGene];
            }
        }

        // Don't forget the last operon
        if (currentOperon.length > 1) {
            operons.push({
                genes: [...currentOperon],
                start: currentOperon[0].start,
                end: currentOperon[currentOperon.length - 1].end,
                strand: currentOperon[0].strand,
                name: this.generateOperonName(currentOperon)
            });
        }

        return operons;
    }

    generateOperonName(genes) {
        // Generate operon name based on first gene or common prefix
        const firstGene = genes[0];
        const geneName = firstGene.qualifiers.gene || firstGene.qualifiers.locus_tag || 'unknown';
        
        // Try to find common prefix among gene names
        const geneNames = genes.map(g => g.qualifiers.gene || g.qualifiers.locus_tag || '').filter(n => n);
        if (geneNames.length > 1) {
            const commonPrefix = this.findCommonPrefix(geneNames);
            if (commonPrefix.length > 2) {
                return `${commonPrefix}_operon`;
            }
        }
        
        return `${geneName}_operon`;
    }

    findCommonPrefix(strings) {
        if (strings.length === 0) return '';
        
        let prefix = strings[0];
        for (let i = 1; i < strings.length; i++) {
            while (strings[i].indexOf(prefix) !== 0) {
                prefix = prefix.substring(0, prefix.length - 1);
                if (prefix === '') return '';
            }
        }
        return prefix;
    }

    assignOperonColor(operonName) {
        if (!this.operonColorMap.has(operonName)) {
            const color = this.operonColors[this.operonColorIndex];
            this.operonColorMap.set(operonName, color);
            this.operonColorIndex = (this.operonColorIndex + 1) % this.operonColors.length;
        }
        return this.operonColorMap.get(operonName);
    }

    // Override getGeneOperonInfo to handle user-defined features
    getGeneOperonInfo(gene, operons) {
        // If it's a user-defined feature, return a special color
        if (gene.userDefined) {
            return {
                isInOperon: false,
                operonName: null,
                color: '#10b981', // Success green for user-defined features
                name: null
            };
        }
        
        // Original operon detection logic for loaded features
        // Find which operon this gene belongs to
        for (const operon of operons) {
            if (operon.genes.some(g => g.start === gene.start && g.end === gene.end)) {
                return {
                    operonName: operon.name,
                    color: this.assignOperonColor(operon.name),
                    isInOperon: true
                };
            }
        }
        
        // Gene is not in an operon, assign individual color
        const geneName = gene.qualifiers.gene || gene.qualifiers.locus_tag || `${gene.type}_${gene.start}`;
        return {
            operonName: geneName,
            color: this.assignOperonColor(geneName),
            isInOperon: false
        };
    }

    updateGeneDisplay() {
        // Refresh the genome view if a file is loaded
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
        }
    }

    syncSidebarFeatureFilter(sidebarId, checked) {
        const sidebarElement = document.getElementById(sidebarId);
        if (sidebarElement) {
            sidebarElement.checked = checked;
        }
    }

    syncToolbarFeatureFilter(toolbarId, checked) {
        const toolbarElement = document.getElementById(toolbarId);
        if (toolbarElement) {
            toolbarElement.checked = checked;
        }
    }

    // Delegate methods to modules
    updateFileInfo() {
        this.fileManager.updateFileInfo();
    }

    hideWelcomeScreen() {
        this.uiManager.hideWelcomeScreen();
    }

    updateStatus(message) {
        this.uiManager.updateStatus(message);
    }

    showLoading(show) {
        this.uiManager.showLoading(show);
    }

    populateChromosomeSelect() {
        this.sequenceUtils.populateChromosomeSelect();
    }

    selectChromosome(chromosome) {
        this.sequenceUtils.selectChromosome(chromosome);
    }

    updateStatistics(chromosome, sequence) {
        this.sequenceUtils.updateStatistics(chromosome, sequence);
    }

    displayEnhancedSequence(chromosome, sequence) {
        this.sequenceUtils.displayEnhancedSequence(chromosome, sequence);
    }

    translateDNA(dnaSequence, strand) {
        return this.sequenceUtils.translateDNA(dnaSequence, strand);
    }

    makeDraggable(element, chromosome) {
        this.navigationManager.makeDraggable(element, chromosome);
    }

    // Gene Selection Methods
    selectGene(gene, operonInfo = null) {
        // Remove selection from previously selected gene
        if (this.selectedGene) {
            const prevSelectedElements = document.querySelectorAll('.gene-element.selected');
            prevSelectedElements.forEach(el => el.classList.remove('selected'));
        }
        
        // Set new selected gene
        this.selectedGene = { gene, operonInfo };
        
        // Add selection styling to the clicked gene element
        const geneElements = document.querySelectorAll('.gene-element');
        geneElements.forEach(el => {
            // Check if this element represents the selected gene by comparing positions
            const elementTitle = el.title || '';
            const genePosition = `${gene.start}-${gene.end}`;
            if (elementTitle.includes(genePosition)) {
                el.classList.add('selected');
            }
        });
        
        console.log('Selected gene:', gene.qualifiers?.gene || gene.qualifiers?.locus_tag || gene.type);
    }

    showGeneDetailsPanel() {
        const geneDetailsSection = document.getElementById('geneDetailsSection');
        if (geneDetailsSection) {
            geneDetailsSection.style.display = 'block';
            this.uiManager.showSidebarIfHidden();
        }
    }

    populateGeneDetails(gene, operonInfo = null) {
        const geneDetailsContent = document.getElementById('geneDetailsContent');
        if (!geneDetailsContent) return;
        
        // Get basic gene information
        const geneName = gene.qualifiers?.gene || gene.qualifiers?.locus_tag || gene.qualifiers?.product || 'Unknown Gene';
        const geneType = gene.type;
        const position = `${gene.start.toLocaleString()}-${gene.end.toLocaleString()}`;
        const length = (gene.end - gene.start + 1).toLocaleString();
        const strand = gene.strand === -1 ? 'Reverse (-)' : 'Forward (+)';
        
        // Create the gene details HTML
        let html = `
            <div class="gene-details-info">
                <div class="gene-basic-info">
                    <div class="gene-name">${geneName}</div>
                    <div class="gene-type-badge">${geneType}</div>
                    <div class="gene-position">Position: ${position}</div>
                    <div class="gene-strand">Strand: ${strand} | Length: ${length} bp</div>
                </div>
        `;
        
        // Add operon information if available
        if (operonInfo) {
            html += `
                <div class="gene-operon-info">
                    <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 8px;">
                        <div style="width: 16px; height: 16px; background: ${operonInfo.color}; border-radius: 3px; border: 2px solid rgba(0,0,0,0.3);"></div>
                        <span style="font-weight: 600;">Operon: ${operonInfo.operonName || operonInfo.name}</span>
                    </div>
                </div>
            `;
        }
        
        // Add gene attributes if available
        if (gene.qualifiers && Object.keys(gene.qualifiers).length > 0) {
            html += `
                <div class="gene-attributes">
                    <h4>Attributes</h4>
            `;
            
            Object.entries(gene.qualifiers).forEach(([key, value]) => {
                // Convert value to string and check if it's meaningful
                const stringValue = value != null ? String(value) : '';
                if (stringValue && stringValue !== 'Unknown' && stringValue.trim() !== '') {
                    html += `
                        <div class="gene-attribute">
                            <div class="gene-attribute-label">${key.replace(/_/g, ' ')}</div>
                            <div class="gene-attribute-value">${stringValue}</div>
                        </div>
                    `;
                }
            });
            
            html += `</div>`;
        }
        
        // Add action buttons
        html += `
            <div class="gene-actions">
                <button class="btn gene-zoom-btn gene-action-btn" onclick="window.genomeBrowser.zoomToGene()">
                    <i class="fas fa-search-plus"></i> Zoom to Gene
                </button>
                <button class="btn gene-copy-btn gene-action-btn" onclick="window.genomeBrowser.copyGeneSequence()">
                    <i class="fas fa-copy"></i> Copy Sequence
                </button>
            </div>
        `;
        
        html += `</div>`;
        
        geneDetailsContent.innerHTML = html;
    }

    highlightGeneSequence(gene) {
        // Clear previous highlights
        this.clearSequenceHighlights();
        
        // Only highlight if the gene is within the current view
        const currentStart = this.currentPosition.start;
        const currentEnd = this.currentPosition.end;
        
        if (gene.end < currentStart || gene.start > currentEnd) {
            console.log('Gene is outside current view, skipping sequence highlight');
            return;
        }
        
        // Find sequence bases within the gene range
        const sequenceBases = document.querySelectorAll('.sequence-bases span');
        sequenceBases.forEach(baseElement => {
            const parentLine = baseElement.closest('.sequence-line');
            if (!parentLine) return;
            
            const positionElement = parentLine.querySelector('.sequence-position');
            if (!positionElement) return;
            
            const lineStartPos = parseInt(positionElement.textContent.replace(/,/g, '')) - 1; // Convert to 0-based
            const baseIndex = Array.from(parentLine.querySelectorAll('.sequence-bases span')).indexOf(baseElement);
            const absolutePos = lineStartPos + baseIndex + 1; // Convert back to 1-based for comparison
            
            // Check if this base is within the gene range
            if (absolutePos >= gene.start && absolutePos <= gene.end) {
                baseElement.classList.add('sequence-highlight');
            }
        });
        
        console.log(`Highlighted sequence for gene ${gene.qualifiers?.gene || gene.type} (${gene.start}-${gene.end})`);
    }

    clearSequenceHighlights() {
        const highlightedBases = document.querySelectorAll('.sequence-highlight');
        highlightedBases.forEach(el => el.classList.remove('sequence-highlight'));
    }

    // Action methods for gene details buttons
    zoomToGene() {
        if (!this.selectedGene) return;
        
        const gene = this.selectedGene.gene;
        const geneLength = gene.end - gene.start;
        const padding = Math.max(500, Math.floor(geneLength * 0.2)); // 20% padding or 500bp minimum
        
        const newStart = Math.max(0, gene.start - padding);
        const newEnd = gene.end + padding;
        
        this.currentPosition = { start: newStart, end: newEnd };
        
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.updateStatistics(currentChr, this.currentSequence[currentChr]);
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
        }
    }

    copyGeneSequence() {
        if (!this.selectedGene) return;
        
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.currentSequence || !this.currentSequence[currentChr]) {
            alert('No sequence available to copy');
            return;
        }
        
        const gene = this.selectedGene.gene;
        const sequence = this.currentSequence[currentChr];
        const geneSequence = sequence.substring(gene.start - 1, gene.end); // Convert to 0-based indexing
        
        const geneName = gene.qualifiers?.gene || gene.qualifiers?.locus_tag || gene.type;
        const fastaHeader = `>${geneName} ${currentChr}:${gene.start}-${gene.end} (${gene.strand === -1 ? '-' : '+'} strand)`;
        const fastaContent = `${fastaHeader}\n${geneSequence}`;
        
        navigator.clipboard.writeText(fastaContent).then(() => {
            alert(`Copied ${geneName} sequence (${geneSequence.length} bp) to clipboard`);
        }).catch(err => {
            console.error('Failed to copy: ', err);
            alert('Failed to copy to clipboard');
        });
    }

    clearGeneSelection() {
        // Clear selected gene
        this.selectedGene = null;
        
        // Remove selection styling from all gene elements
        const selectedElements = document.querySelectorAll('.gene-element.selected');
        selectedElements.forEach(el => el.classList.remove('selected'));
        
        // Clear sequence highlights
        this.clearSequenceHighlights();
        
        console.log('Cleared gene selection');
    }

    // User-defined features functionality
    initializeUserFeatures() {
        // Add features dropdown toggle
        document.getElementById('addFeaturesBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleAddFeaturesDropdown();
        });
        
        // Dropdown feature buttons
        document.querySelectorAll('.dropdown-feature-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const featureType = btn.getAttribute('data-type');
                this.showAddFeatureModal(featureType);
                this.hideAddFeaturesDropdown();
            });
        });
        
        // Add feature modal
        document.getElementById('addFeatureBtn')?.addEventListener('click', () => this.addUserFeature());
        
        // Close dropdown when clicking outside
        document.addEventListener('click', () => this.hideAddFeaturesDropdown());
        
        // Enable sequence selection in bottom panel
        this.initializeSequenceSelection();
    }

    toggleAddFeaturesDropdown() {
        const dropdown = document.getElementById('addFeaturesDropdown');
        const button = document.getElementById('addFeaturesBtn');
        
        if (dropdown && button) {
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
            button.classList.toggle('active', !isVisible);
        }
    }

    hideAddFeaturesDropdown() {
        const dropdown = document.getElementById('addFeaturesDropdown');
        const button = document.getElementById('addFeaturesBtn');
        
        if (dropdown && button) {
            dropdown.style.display = 'none';
            button.classList.remove('active');
        }
    }

    showAddFeatureModal(featureType = 'gene') {
        const modal = document.getElementById('addFeatureModal');
        const titleElement = document.getElementById('addFeatureModalTitle');
        const typeSelect = document.getElementById('featureType');
        const chromosomeSelect = document.getElementById('featureChromosome');
        const selectionInfo = document.getElementById('sequenceSelectionInfo');
        
        if (!modal) return;
        
        // Set modal title and feature type
        titleElement.textContent = `Add ${featureType.charAt(0).toUpperCase() + featureType.slice(1)}`;
        typeSelect.value = featureType;
        
        // Populate chromosome dropdown
        this.populateChromosomeSelectForFeature(chromosomeSelect);
        
        // Handle sequence selection
        if (this.currentSequenceSelection) {
            const { chromosome, start, end } = this.currentSequenceSelection;
            document.getElementById('featureChromosome').value = chromosome;
            document.getElementById('featureStart').value = start;
            document.getElementById('featureEnd').value = end;
            document.getElementById('selectionText').textContent = 
                `Using selected region: ${chromosome}:${start}-${end} (${end - start + 1} bp)`;
            selectionInfo.style.display = 'block';
        } else {
            // Use current view if no selection
            const currentChr = document.getElementById('chromosomeSelect')?.value;
            if (currentChr) {
                document.getElementById('featureChromosome').value = currentChr;
                document.getElementById('featureStart').value = this.currentPosition.start + 1;
                document.getElementById('featureEnd').value = this.currentPosition.end;
            }
            selectionInfo.style.display = 'none';
        }
        
        // Clear previous values
        document.getElementById('featureName').value = '';
        document.getElementById('featureDescription').value = '';
        
        // Show modal
        modal.classList.add('show');
    }

    populateChromosomeSelectForFeature(selectElement) {
        if (!selectElement) return;
        
        selectElement.innerHTML = '';
        
        // Add chromosomes from current sequence data
        if (this.currentSequence) {
            Object.keys(this.currentSequence).forEach(chr => {
                const option = document.createElement('option');
                option.value = chr;
                option.textContent = chr;
                selectElement.appendChild(option);
            });
        }
    }

    addUserFeature() {
        const featureType = document.getElementById('featureType').value;
        const featureName = document.getElementById('featureName').value.trim();
        const chromosome = document.getElementById('featureChromosome').value;
        const start = parseInt(document.getElementById('featureStart').value);
        const end = parseInt(document.getElementById('featureEnd').value);
        const strand = parseInt(document.getElementById('featureStrand').value);
        const description = document.getElementById('featureDescription').value.trim();
        
        // Validation
        if (!featureName) {
            alert('Please enter a feature name');
            return;
        }
        
        if (!chromosome) {
            alert('Please select a chromosome');
            return;
        }
        
        if (isNaN(start) || isNaN(end) || start < 1 || end < 1) {
            alert('Please enter valid start and end positions');
            return;
        }
        
        if (start > end) {
            alert('Start position must be less than or equal to end position');
            return;
        }
        
        // Check if position is within sequence bounds
        if (this.currentSequence[chromosome]) {
            const seqLength = this.currentSequence[chromosome].length;
            if (end > seqLength) {
                alert(`End position (${end}) exceeds sequence length (${seqLength})`);
                return;
            }
        }
        
        // Create the feature object
        const feature = {
            type: featureType,
            start: start,
            end: end,
            strand: strand,
            qualifiers: {
                gene: featureName,
                product: description || featureName,
                note: description,
                user_defined: true
            },
            userDefined: true,
            id: `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };
        
        // Store the feature
        if (!this.userDefinedFeatures[chromosome]) {
            this.userDefinedFeatures[chromosome] = [];
        }
        this.userDefinedFeatures[chromosome].push(feature);
        
        // Add to current annotations for immediate display
        if (!this.currentAnnotations[chromosome]) {
            this.currentAnnotations[chromosome] = [];
        }
        this.currentAnnotations[chromosome].push(feature);
        
        // Close modal
        document.getElementById('addFeatureModal').classList.remove('show');
        
        // Clear selection
        this.clearSequenceSelection();
        
        // Refresh the view
        if (chromosome === document.getElementById('chromosomeSelect')?.value) {
            this.displayGenomeView(chromosome, this.currentSequence[chromosome]);
            this.sequenceUtils.displayEnhancedSequence(chromosome, this.currentSequence[chromosome]);
        }
        
        alert(`Added ${featureType} "${featureName}" to ${chromosome}:${start}-${end}`);
    }

    initializeSequenceSelection() {
        // Add selection capability to sequence content in bottom panel
        const sequenceContent = document.getElementById('sequenceContent');
        if (!sequenceContent) return;
        
        let isSelecting = false;
        let selectionStart = null;
        let selectionEnd = null;
        
        sequenceContent.addEventListener('mousedown', (e) => {
            if (e.target.matches('.sequence-bases span')) {
                isSelecting = true;
                selectionStart = this.getSequencePosition(e.target);
                this.clearSequenceSelection();
                e.preventDefault();
            }
        });
        
        sequenceContent.addEventListener('mousemove', (e) => {
            if (isSelecting && e.target.matches('.sequence-bases span')) {
                selectionEnd = this.getSequencePosition(e.target);
                this.updateSequenceSelection(selectionStart, selectionEnd);
            }
        });
        
        sequenceContent.addEventListener('mouseup', () => {
            if (isSelecting && selectionStart && selectionEnd) {
                this.finalizeSequenceSelection(selectionStart, selectionEnd);
            }
            isSelecting = false;
        });
        
        document.addEventListener('mouseup', () => {
            isSelecting = false;
        });
    }

    getSequencePosition(baseElement) {
        const parentLine = baseElement.closest('.sequence-line');
        if (!parentLine) return null;
        
        const positionElement = parentLine.querySelector('.sequence-position');
        if (!positionElement) return null;
        
        const lineStartPos = parseInt(positionElement.textContent.replace(/,/g, ''));
        const baseIndex = Array.from(parentLine.querySelectorAll('.sequence-bases span')).indexOf(baseElement);
        
        return {
            chromosome: document.getElementById('chromosomeSelect')?.value,
            position: lineStartPos + baseIndex,
            element: baseElement
        };
    }

    updateSequenceSelection(start, end) {
        if (!start || !end) return;
        
        this.clearSequenceSelection();
        
        const startPos = Math.min(start.position, end.position);
        const endPos = Math.max(start.position, end.position);
        
        // Highlight selected bases
        const sequenceBases = document.querySelectorAll('.sequence-bases span');
        sequenceBases.forEach(baseElement => {
            const pos = this.getSequencePosition(baseElement);
            if (pos && pos.position >= startPos && pos.position <= endPos) {
                baseElement.classList.add('sequence-selection');
            }
        });
    }

    finalizeSequenceSelection(start, end) {
        if (!start || !end) return;
        
        const startPos = Math.min(start.position, end.position);
        const endPos = Math.max(start.position, end.position);
        
        this.currentSequenceSelection = {
            chromosome: start.chromosome,
            start: startPos,
            end: endPos
        };
        
        console.log(`Selected sequence: ${start.chromosome}:${startPos}-${endPos} (${endPos - startPos + 1} bp)`);
    }

    clearSequenceSelection() {
        this.currentSequenceSelection = null;
        
        // Remove visual selection
        const selectedElements = document.querySelectorAll('.sequence-selection');
        selectedElements.forEach(element => {
            element.classList.remove('sequence-selection');
        });
        
        // Hide selection info in modal
        document.getElementById('sequenceSelectionInfo').style.display = 'none';
    }

    // Helper methods for ChatManager
    async search(query, caseSensitive = false) {
        return this.navigationManager.search(query, caseSensitive);
    }

    async getSequenceForRegion(chromosome, start, end) {
        const sequence = this.currentSequence[chromosome];
        if (!sequence) {
            throw new Error(`Chromosome ${chromosome} not loaded`);
        }
        
        return sequence.substring(start - 1, end);
    }

    async addUserDefinedFeature(feature) {
        const featureId = 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
        
        if (!this.userDefinedFeatures[feature.chromosome]) {
            this.userDefinedFeatures[feature.chromosome] = [];
        }
        
        const featureWithId = { ...feature, id: featureId, userDefined: true };
        this.userDefinedFeatures[feature.chromosome].push(featureWithId);
        
        // Refresh the display
        this.updateGeneDisplay();
        
        return featureId;
    }

    // MCP Integration helpers
    sendStateUpdate() {
        if (this.chatManager && this.chatManager.isConnected) {
            this.chatManager.sendStateUpdate({
                currentChromosome: this.currentChromosome,
                currentPosition: this.currentPosition,
                visibleTracks: Array.from(this.visibleTracks),
                sequenceLength: this.currentSequence[this.currentChromosome]?.length || 0
            });
        }
    }

    sendNavigationUpdate() {
        if (this.chatManager && this.chatManager.isConnected) {
            this.chatManager.sendNavigationUpdate(this.currentChromosome, this.currentPosition);
        }
    }

    sendSearchResultsUpdate(results) {
        if (this.chatManager) {
            this.chatManager.sendSearchResults(results);
        }
    }

    // Handle bottom sequence panel (always docked to bottom when enabled)
    handleBottomSequencePanel(chromosome, sequence) {
        const sequenceDisplaySection = document.getElementById('sequenceDisplaySection');
        const splitter = document.getElementById('splitter');
        const genomeViewerSection = document.getElementById('genomeViewerSection');
        
        if (this.visibleTracks.has('sequence')) {
            // Show bottom sequence panel
            if (sequenceDisplaySection) {
                sequenceDisplaySection.style.display = 'flex';
                // Set proper initial height (not too big on first load)
                if (!sequenceDisplaySection.style.height || sequenceDisplaySection.style.height === 'auto') {
                    sequenceDisplaySection.style.height = '250px'; // Default height
                }
                // Ensure it's positioned at the bottom
                sequenceDisplaySection.style.position = 'relative';
                sequenceDisplaySection.style.bottom = '0';
                sequenceDisplaySection.style.flex = 'none'; // Don't grow automatically
            }
            
            if (splitter) {
                splitter.style.display = 'flex';
            }
            
            // Adjust genome viewer to make room for bottom panel
            if (genomeViewerSection) {
                // Use flex to fill remaining space, but set a minimum height
                genomeViewerSection.style.flex = '1';
                genomeViewerSection.style.minHeight = '200px'; // Ensure minimum space for tracks
                // Remove any fixed height if set to allow flexible sizing
                if (genomeViewerSection.style.height === 'auto' || !genomeViewerSection.style.height) {
                    genomeViewerSection.style.flexBasis = 'auto';
                }
            }
            
            // Display the sequence content
            this.sequenceUtils.displayEnhancedSequence(chromosome, sequence);
            
            // Set up collapse/expand functionality for sequence header
            this.setupSequenceHeaderToggle();
        } else {
            // Hide bottom sequence panel
            if (sequenceDisplaySection) {
                sequenceDisplaySection.style.display = 'none';
            }
            
            if (splitter) {
                splitter.style.display = 'none';
            }
            
            // Let genome viewer take full space
            if (genomeViewerSection) {
                genomeViewerSection.style.flex = '1';
                genomeViewerSection.style.flexBasis = '100%';
                genomeViewerSection.style.minHeight = 'auto';
            }
        }
    }

    // Set up collapse/expand functionality for sequence header
    setupSequenceHeaderToggle() {
        const sequenceHeader = document.querySelector('.sequence-header');
        const sequenceContent = document.getElementById('sequenceContent');
        const sequenceDisplaySection = document.getElementById('sequenceDisplaySection');
        const splitter = document.getElementById('splitter');
        
        if (sequenceHeader && !sequenceHeader.hasAttribute('data-toggle-setup')) {
            sequenceHeader.setAttribute('data-toggle-setup', 'true');
            sequenceHeader.style.cursor = 'pointer';
            
            // Add visual indicator that it's clickable
            sequenceHeader.style.userSelect = 'none';
            sequenceHeader.addEventListener('mouseenter', () => {
                sequenceHeader.style.backgroundColor = '#e9ecef';
            });
            sequenceHeader.addEventListener('mouseleave', () => {
                sequenceHeader.style.backgroundColor = '';
            });
            
            sequenceHeader.addEventListener('click', () => {
                this.toggleBottomSequencePanel();
            });
        }
    }

    // Toggle collapse/expand of bottom sequence panel
    toggleBottomSequencePanel() {
        const sequenceContent = document.getElementById('sequenceContent');
        const sequenceDisplaySection = document.getElementById('sequenceDisplaySection');
        const splitter = document.getElementById('splitter');
        const genomeViewerSection = document.getElementById('genomeViewerSection');
        const toggleButton = document.getElementById('toggleSequencePanel');
        
        if (sequenceContent && sequenceDisplaySection) {
            const isCollapsed = sequenceContent.style.display === 'none' || 
                              sequenceDisplaySection.classList.contains('collapsed');
            
            if (isCollapsed) {
                // Expand - show sequence content
                sequenceContent.style.display = 'flex';
                sequenceDisplaySection.classList.remove('collapsed');
                // Remove any height restrictions when expanding
                sequenceDisplaySection.style.minHeight = '';
                sequenceDisplaySection.style.maxHeight = '';
                
                if (splitter) {
                    splitter.style.display = 'flex';
                }
                
                if (toggleButton) {
                    toggleButton.innerHTML = '<i class="fas fa-chevron-down"></i>';
                    toggleButton.title = 'Hide Sequence Panel';
                }
            } else {
                // Collapse - hide only sequence content, keep header visible
                sequenceContent.style.display = 'none';
                sequenceDisplaySection.classList.add('collapsed');
                // Set collapsed height to just show the header (approximately 50px)
                sequenceDisplaySection.style.minHeight = '50px';
                sequenceDisplaySection.style.maxHeight = '50px';
                
                if (splitter) {
                    splitter.style.display = 'none';
                }
                
                if (toggleButton) {
                    toggleButton.innerHTML = '<i class="fas fa-chevron-up"></i>';
                    toggleButton.title = 'Show Sequence Panel';
                }
                
                // Let genome viewer expand to fill space
                if (genomeViewerSection) {
                    genomeViewerSection.style.flexGrow = '1';
                }
            }
            
            // Trigger resize event for layout adjustment
            window.dispatchEvent(new Event('resize'));
        }
    }
}

// Initialize the Genome AI Studio when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.genomeBrowser = new GenomeBrowser();
}); 

/**
 * TrackStateManager - Manages track sizes and order persistence
 */
class TrackStateManager {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this.trackSizes = new Map();
        this.trackOrder = [];
        this.loadState();
    }

    // Save track size
    saveTrackSize(trackType, height) {
        console.log(`[TrackStateManager] Saving track size: ${trackType} = ${height}`);
        this.trackSizes.set(trackType, height);
        this.saveState();
        console.log(`Saved track size: ${trackType} = ${height}`);
    }

    // Get saved track size
    getTrackSize(trackType) {
        return this.trackSizes.get(trackType) || null;
    }

    // Save track order
    saveTrackOrder(order) {
        this.trackOrder = [...order];
        this.saveState();
        console.log('Saved track order:', this.trackOrder);
    }

    // Get saved track order
    getTrackOrder() {
        return [...this.trackOrder];
    }

    // Apply saved track sizes to newly created tracks
    applyTrackSizes(container) {
        const trackElements = container.querySelectorAll('[class*="-track"]');
        const trackTypeMapping = {
            'gene': 'genes',
            'gc': 'gc',
            'variant': 'variants',
            'reads': 'reads',
            'proteins': 'proteins',
            'wig': 'wigTracks'
        };

        trackElements.forEach(element => {
            const classList = Array.from(element.classList);
            const trackClass = classList.find(cls => cls.endsWith('-track'));
            if (trackClass) {
                const trackType = trackClass.replace('-track', '');
                const mappedType = trackTypeMapping[trackType] || trackType;
                const savedSize = this.getTrackSize(mappedType);
                
                console.log(`[TrackStateManager] Processing track: class="${trackClass}", type="${trackType}", mapped="${mappedType}", savedSize="${savedSize}"`);
                
                if (savedSize) {
                    const trackContent = element.querySelector('.track-content');
                    if (trackContent) {
                        trackContent.style.height = savedSize;
                        console.log(`Applied saved size to ${mappedType}: ${savedSize}`);
                    }
                }
            }
        });
    }

    // Apply saved track order
    applyTrackOrder(container) {
        if (this.trackOrder.length === 0) return;

        const trackElements = Array.from(container.querySelectorAll('[class*="-track"]'));
        const trackTypeMapping = {
            'gene': 'genes',
            'gc': 'gc',
            'variant': 'variants',
            'reads': 'reads',
            'proteins': 'proteins',
            'wig': 'wigTracks'
        };

        // Create a map of current tracks by type
        const tracksByType = new Map();
        trackElements.forEach(element => {
            const classList = Array.from(element.classList);
            const trackClass = classList.find(cls => cls.endsWith('-track'));
            if (trackClass) {
                const trackType = trackClass.replace('-track', '');
                const mappedType = trackTypeMapping[trackType] || trackType;
                tracksByType.set(mappedType, element);
            }
        });

        // Reorder tracks according to saved order
        this.trackOrder.forEach((trackType, index) => {
            const trackElement = tracksByType.get(trackType);
            if (trackElement) {
                container.appendChild(trackElement); // This moves it to the end
                console.log(`Reordered track ${trackType} to position ${index}`);
            }
        });
    }

    // Save state to localStorage
    saveState() {
        try {
            const state = {
                trackSizes: Object.fromEntries(this.trackSizes),
                trackOrder: this.trackOrder
            };
            localStorage.setItem('genomeViewer_trackState', JSON.stringify(state));
        } catch (error) {
            console.error('Error saving track state:', error);
        }
    }

    // Load state from localStorage
    loadState() {
        try {
            const saved = localStorage.getItem('genomeViewer_trackState');
            if (saved) {
                const state = JSON.parse(saved);
                this.trackSizes = new Map(Object.entries(state.trackSizes || {}));
                this.trackOrder = state.trackOrder || [];
                console.log('Loaded track state:', { sizes: state.trackSizes, order: state.trackOrder });
            }
        } catch (error) {
            console.error('Error loading track state:', error);
            this.trackSizes = new Map();
            this.trackOrder = [];
        }
    }

    // Clear all saved state
    clearState() {
        this.trackSizes.clear();
        this.trackOrder = [];
        localStorage.removeItem('genomeViewer_trackState');
        console.log('Cleared track state');
    }
} 

// Load MicrobeGenomicsFunctions for chat integration
document.addEventListener('DOMContentLoaded', function() {
    // Dynamically load MicrobeGenomicsFunctions if not already loaded
    if (!window.MicrobeFns) {
        const script = document.createElement('script');
        script.src = './modules/MicrobeGenomicsFunctions.js';
        script.onload = function() {
            console.log('MicrobeGenomicsFunctions loaded successfully');
            // Trigger re-initialization of ChatManager if it exists
            if (window.chatManager && window.chatManager.initializeMicrobeGenomicsFunctions) {
                window.chatManager.initializeMicrobeGenomicsFunctions();
            }
        };
        script.onerror = function() {
            console.error('Failed to load MicrobeGenomicsFunctions');
        };
        document.head.appendChild(script);
    } else {
        console.log('MicrobeGenomicsFunctions already available');
    }
}); 