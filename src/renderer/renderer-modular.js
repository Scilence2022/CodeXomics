console.log('Executing src/renderer/renderer-modular.js');
const { ipcRenderer } = require('electron');
const path = require('path');

// Force reload - timestamp: 2025-05-31 15:01

// Load Smart Execution System modules early
if (typeof window !== 'undefined') {
    // Load FunctionCallsOrganizer
    const loadFunctionCallsOrganizer = () => {
        return new Promise((resolve, reject) => {
            if (typeof FunctionCallsOrganizer !== 'undefined') {
                resolve();
                return;
            }
            // Check if script is already loading
            const existingScript = document.querySelector('script[src="modules/FunctionCallsOrganizer.js"]');
            if (existingScript) {
                existingScript.onload = resolve;
                return;
            }
            const script = document.createElement('script');
            script.src = 'modules/FunctionCallsOrganizer.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // Load SmartExecutor
    const loadSmartExecutor = () => {
        return new Promise((resolve, reject) => {
            if (typeof SmartExecutor !== 'undefined') {
                resolve();
                return;
            }
            // Check if script is already loading
            const existingScript = document.querySelector('script[src="modules/SmartExecutor.js"]');
            if (existingScript) {
                existingScript.onload = resolve;
                return;
            }
            const script = document.createElement('script');
            script.src = 'modules/SmartExecutor.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // Load ModalDragManager
    const loadModalDragManager = () => {
        return new Promise((resolve, reject) => {
            if (typeof ModalDragManager !== 'undefined') {
                resolve();
                return;
            }
            // Check if script is already loading
            const existingScript = document.querySelector('script[src="modules/ModalDragManager.js"]');
            if (existingScript) {
                existingScript.onload = resolve;
                return;
            }
            const script = document.createElement('script');
            script.src = 'modules/ModalDragManager.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // Load Plugin Function Calls Integrator
    const loadPluginFunctionCallsIntegrator = () => {
        return new Promise((resolve, reject) => {
            if (typeof PluginFunctionCallsIntegrator !== 'undefined') {
                resolve();
                return;
            }
            // Check if script is already loading
            const existingScript = document.querySelector('script[src="modules/PluginFunctionCallsIntegrator.js"]');
            if (existingScript) {
                existingScript.onload = resolve;
                return;
            }
            const script = document.createElement('script');
            script.src = 'modules/PluginFunctionCallsIntegrator.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // Load GenomeStudioRPCHandler
    const loadGenomeStudioRPCHandler = () => {
        return new Promise((resolve, reject) => {
            if (typeof GenomeStudioRPCHandler !== 'undefined') {
                resolve();
                return;
            }
            // Check if script is already loading
            const existingScript = document.querySelector('script[src="modules/GenomeStudioRPCHandler.js"]');
            if (existingScript) {
                existingScript.onload = resolve;
                return;
            }
            const script = document.createElement('script');
            script.src = 'modules/GenomeStudioRPCHandler.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // Load InternalMCPServer
    const loadInternalMCPServer = () => {
        return new Promise((resolve, reject) => {
            if (typeof InternalMCPServer !== 'undefined') {
                resolve();
                return;
            }
            // Check if script is already loading
            const existingScript = document.querySelector('script[src="modules/InternalMCPServer.js"]');
            if (existingScript) {
                existingScript.onload = resolve;
                return;
            }
            const script = document.createElement('script');
            script.src = 'modules/InternalMCPServer.js';
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    };

    // Load modules in sequence
    loadFunctionCallsOrganizer()
        .then(() => loadPluginFunctionCallsIntegrator())
        .then(() => loadSmartExecutor())
        .then(() => loadModalDragManager())
        .then(() => loadGenomeStudioRPCHandler())
        .then(() => loadInternalMCPServer())
        .then(() => {
            console.log('✅ Smart Execution System modules loaded successfully');
            // Initialize ModalDragManager
            if (typeof ModalDragManager !== 'undefined') {
                window.modalDragManager = new ModalDragManager();
                // Auto-initialize management modals after DOM is ready
                setTimeout(() => {
                    window.modalDragManager.initializeAllModals();
                }, 500);
            }
        })
        .catch(error => {
            console.warn('⚠️ Failed to load Smart Execution System modules:', error);
        });
}
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
        this.blastManager = new BlastManager(this); // Initialize BLAST manager
        this.multiFileManager = new MultiFileManager(this); // Initialize multi-file manager
        
        // Initialize Tab Management System (for multi-genome analysis) - delayed to ensure DOM is ready
        this.initializeTabManager();
        
        // Initialize Internal MCP Server for direct communication with main process MCP server
        this.initializeInternalMCPServer();
        
        // Initialize Action Management System
        this.initializeActionSystem();
        
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
            sequence: true,  // Bottom sequence panel
            sequenceLine: false, // Single-line sequence track
            actions: false   // Add actions track
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
            source: false,  // Default: don't show source features
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
        this.visibleTracks = new Set(['genes', 'gc', 'sequence']); // Default visible tracks (sequence = bottom panel, sequenceLine = single-line track)
        
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
            other: true,
            source: false  // Default: don't show source features
        };
        
        this.init();
    }

    init() {
        // Force reload timestamp: 2025-05-31-15:05
        console.log('🚀 GenomeBrowser initialization starting...');
        
        // Step 0: Initialize version information
        console.log('📋 Initializing version information...');
        this.initializeVersionInfo();
        
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
        
        // Step 5.1: Initialize MultiAgentSettingsManager
        console.log('🤖 About to initialize MultiAgentSettingsManager...');
        try {
            this.multiAgentSettingsManager = new MultiAgentSettingsManager(this.configManager);
            window.multiAgentSettingsManager = this.multiAgentSettingsManager;
            console.log('✅ MultiAgentSettingsManager initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing MultiAgentSettingsManager:', error);
        }

        // Step 5.5: Initialize Plugin Management UI
        console.log('🧩 About to initialize PluginManagementUI...');
        this.initializePluginManagementUI();

        // Step 5.6: Initialize General Settings Manager
        console.log('⚙️ About to initialize GeneralSettingsManager...');
        try {
            this.generalSettingsManager = new GeneralSettingsManager(this.configManager);
            // Initialize asynchronously and then apply global dragging setting
            this.generalSettingsManager.init().then(() => {
                console.log('✅ GeneralSettingsManager initialized successfully');
                
                // Initialize global dragging setting after settings are loaded
                this.globalDraggingEnabled = this.generalSettingsManager.getSettings().enableGlobalDragging || false;
                
                // Apply the setting immediately
                this.setGlobalDragging(this.globalDraggingEnabled);
            }).catch((error) => {
                console.error('❌ Error initializing GeneralSettingsManager:', error);
                this.globalDraggingEnabled = false;
            });
            
            window.generalSettingsManager = this.generalSettingsManager; // Make globally available
        } catch (error) {
            console.error('❌ Error initializing GeneralSettingsManager:', error);
            this.globalDraggingEnabled = false;
        }
        
        // Step 5.7: Initialize Visualization Tools Manager
        try {
            this.initializeVisualizationToolsManager();
            console.log('✅ VisualizationToolsManager initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing VisualizationToolsManager:', error);
        }
        
        // Step 5.8: Initialize Conversation Evolution System
        console.log('🧬 About to initialize ConversationEvolutionManager...');
        try {
            this.conversationEvolutionManager = new ConversationEvolutionManager(this, this.configManager, this.chatManager);
            this.evolutionInterfaceManager = new EvolutionInterfaceManager(this.conversationEvolutionManager, this.configManager);
            
            window.conversationEvolutionManager = this.conversationEvolutionManager; // Make globally available
            window.evolutionInterfaceManager = this.evolutionInterfaceManager; // Make globally available
            console.log('✅ ConversationEvolutionManager initialized successfully');
        } catch (error) {
            console.error('❌ Error initializing ConversationEvolutionManager:', error);
        }
        
        // Add global tool validation function for debugging
        window.validateAllTools = () => {
            if (this.chatManager && this.chatManager.validateAllTools) {
                return this.chatManager.validateAllTools();
            } else {
                console.warn('ChatManager or validateAllTools method not available');
                return null;
            }
        };

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
        
        // Initialize MCP server status check
        this.initializeMCPServerStatus();
        
        // Initialize Action Management System
        this.initializeActionSystem();
    }
    
    /**
     * Initialize version information display
     */
    initializeVersionInfo() {
        try {
            // Update version tag in header
            const versionTag = document.getElementById('version-tag');
            if (versionTag && typeof VERSION_INFO !== 'undefined') {
                versionTag.textContent = VERSION_INFO.displayVersion;
            }
            
            // Update version in about dialog
            const aboutVersion = document.getElementById('about-version');
            if (aboutVersion && typeof VERSION_INFO !== 'undefined') {
                aboutVersion.textContent = `Version ${VERSION_INFO.fullVersion}`;
            }
            
            // Update document title
            if (typeof VERSION_INFO !== 'undefined') {
                document.title = VERSION_INFO.appTitle;
            }
            
            // Make version info globally available
            if (typeof VERSION_INFO !== 'undefined') {
                window.appVersion = VERSION_INFO;
                console.log(`✅ Version information initialized: ${VERSION_INFO.appTitle}`);
            } else {
                console.warn('⚠️ VERSION_INFO not available');
            }
            
        } catch (error) {
            console.error('❌ Error initializing version information:', error);
        }
    }
    
    /**
     * Initialize Action Management System
     */
    initializeInternalMCPServer() {
        // Initialize Internal MCP Server for direct communication with main process MCP server
        setTimeout(() => {
            try {
                if (typeof InternalMCPServer !== 'undefined') {
                    this.internalMCPServer = new InternalMCPServer();
                    
                    // Initialize with this Genome Studio instance
                    this.internalMCPServer.initialize(this);
                    
                    // Start the internal server
                    this.internalMCPServer.start();
                    
                    window.internalMCPServer = this.internalMCPServer; // Keep for debugging
                    console.log('✅ Internal MCP Server initialized and started');
                } else {
                    console.warn('⚠️ InternalMCPServer class not available');
                }
            } catch (error) {
                console.error('❌ Failed to initialize Internal MCP Server:', error);
            }
        }, 200); // Small delay to ensure modules are ready
    }
    
    /**
     * Initialize Tab Management System with DOM ready check
     */
    initializeTabManager() {
        // Use a timeout to ensure DOM is fully ready
        setTimeout(() => {
            try {
                // Check if DOM elements exist before initializing
                const tabContainer = document.getElementById('tabContainer');
                const newTabButton = document.getElementById('newTabButton');
                const tabSettingsButton = document.getElementById('tabSettingsButton');
                
                if (!tabContainer || !newTabButton || !tabSettingsButton) {
                    console.warn('⚠️ Tab UI elements not found, retrying TabManager initialization...');
                    // Retry after another delay
                    setTimeout(() => this.initializeTabManager(), 500);
                    return;
                }
                
                // Initialize TabManager
                this.tabManager = new TabManager(this);
                console.log('✅ TabManager initialized successfully');
                
            } catch (error) {
                console.error('❌ Failed to initialize TabManager:', error);
                // Retry once more
                setTimeout(() => this.initializeTabManager(), 1000);
            }
        }, 100); // Initial delay to ensure DOM is ready
    }

    initializeActionSystem() {
        // Initialize Action Manager and Checkpoint Manager after DOM is ready
        setTimeout(() => {
            try {
                if (typeof ActionManager !== 'undefined') {
                    this.actionManager = new ActionManager(this);
                    window.actionManager = this.actionManager; // Keep for backward compatibility
                    console.log('✅ ActionManager initialized');
                } else {
                    console.warn('⚠️ ActionManager class not available');
                }
                
                if (typeof CheckpointManager !== 'undefined') {
                    this.checkpointManager = new CheckpointManager(this);
                    window.checkpointManager = this.checkpointManager; // Keep for backward compatibility
                    console.log('✅ CheckpointManager initialized');
                } else {
                    console.warn('⚠️ CheckpointManager class not available');
                }
                
                // Action system initialized - menu items handled by main menu
                
            } catch (error) {
                console.error('❌ Error initializing Action Management System:', error);
            }
        }, 500);
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
        
        // MCP Server control
        document.getElementById('mcpServerBtn').addEventListener('click', () => this.toggleMCPServer());
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
        document.getElementById('copySequenceBtn').addEventListener('click', (e) => {
            // Prevent ActionManager from also handling this event
            e.stopImmediatePropagation();
            this.sequenceUtils.copySequence();
        });
        document.getElementById('exportBtn').addEventListener('click', () => this.sequenceUtils.exportSequence());
        document.getElementById('sequenceSettingsBtn').addEventListener('click', () => {
            if (this.trackRenderer) {
                this.trackRenderer.openTrackSettings('sequence');
            }
        });
        
        // Add click event for selected sequences (both gene and manual)
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('gene-sequence-selected')) {
                // Provide visual feedback that the sequence is ready to copy
                if (this.sequenceSelection && this.sequenceSelection.active && this.sequenceSelection.source === 'gene') {
                    this.showSelectionFeedback();
                } else {
                    // Manual selection feedback
                    this.showNotification('Sequence is selected. Click "Copy" button to copy.', 'info');
                }
            }
        });
        
        // Update copy button state when text selection changes
        document.addEventListener('selectionchange', () => {
            // Debounce to avoid too frequent updates
            clearTimeout(this.selectionChangeTimeout);
            this.selectionChangeTimeout = setTimeout(() => {
                this.updateCopyButtonState();
            }, 100);
        });

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
        document.getElementById('trackSequenceLine').addEventListener('change', () => this.updateVisibleTracks());
        document.getElementById('trackActions').addEventListener('change', () => this.updateVisibleTracks());

        // Sidebar track controls
        document.getElementById('sidebarTrackGenes').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackGC').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackVariants').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackReads').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackWIG').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackProteins').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackSequence').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackSequenceLine').addEventListener('change', () => this.updateVisibleTracksFromSidebar());
        document.getElementById('sidebarTrackActions').addEventListener('change', () => this.updateVisibleTracksFromSidebar());

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
        
        // General Settings modal
        document.getElementById('settingsBtn')?.addEventListener('click', () => this.showGeneralSettingsModal());
        
        // Debug Tools modal
        document.getElementById('debugToolsBtn')?.addEventListener('click', () => this.showDebugToolsModal());
        
        // Smart Execution Demo button
        document.getElementById('smartExecutionDemoBtn')?.addEventListener('click', () => this.showSmartExecutionDemo());
    }

    showMCPSettingsModal() {
        const modal = document.getElementById('mcpSettingsModal');
        if (modal) {
            // Load current settings with proper fallback
            const defaultSettings = {
                allowAutoActivation: false, // NEW: Default to false (disabled)
                autoConnect: false,
                serverUrl: 'ws://localhost:3001',
                reconnectDelay: 5
            };
            
            const mcpSettings = this.configManager ? 
                this.configManager.get('mcpSettings', defaultSettings) : 
                defaultSettings;
            
            // Populate modal fields
            document.getElementById('mcpAllowAutoActivation').checked = mcpSettings.allowAutoActivation;
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

    showGeneralSettingsModal() {
        const modal = document.getElementById('generalSettingsModal');
        if (modal) {
            // Initialize GeneralSettingsManager if not already done
            if (this.generalSettingsManager && this.generalSettingsManager.isInitialized) {
                // Load current settings
                this.generalSettingsManager.loadSettings();
            } else {
                console.warn('GeneralSettingsManager not initialized');
            }
            
            // Show modal
            modal.classList.add('show');
        } else {
            console.error('General Settings modal not found');
        }
    }

    showDebugToolsModal() {
        // Create debug tools modal if it doesn't exist
        let modal = document.getElementById('debugToolsModal');
        if (!modal) {
            modal = this.createDebugToolsModal();
            document.body.appendChild(modal);
        }
        
        // Show modal
        modal.classList.add('show');
    }

    createDebugToolsModal() {
        const modal = document.createElement('div');
        modal.id = 'debugToolsModal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content debug-tools-modal">
                <div class="modal-header">
                    <h2><i class="fas fa-bug"></i> Debug Tools</h2>
                    <button class="modal-close">&times;</button>
                </div>
                <div class="modal-body">
                    <div class="debug-tools-grid">
                        <div class="debug-tool-card">
                            <div class="debug-tool-icon">
                                <i class="fas fa-search"></i>
                            </div>
                            <h3>BAM Query Debugging</h3>
                            <p>Debug BAM file queries and coordinate system issues</p>
                            <button class="btn btn-primary" onclick="window.genomeBrowser.openDebugTool('bam-query')">
                                Open Tool
                            </button>
                        </div>
                        
                        <div class="debug-tool-card">
                            <div class="debug-tool-icon">
                                <i class="fas fa-cog"></i>
                            </div>
                            <h3>BAM Coordinate Fix</h3>
                            <p>Validate BAM coordinate conversion fixes</p>
                            <button class="btn btn-primary" onclick="window.genomeBrowser.openDebugTool('bam-coordinate-fix')">
                                Open Tool
                            </button>
                        </div>
                        
                        <div class="debug-tool-card">
                            <div class="debug-tool-icon">
                                <i class="fas fa-chart-line"></i>
                            </div>
                            <h3>Performance Monitor</h3>
                            <p>Monitor system performance and memory usage</p>
                            <button class="btn btn-primary" onclick="window.genomeBrowser.openDebugTool('performance')">
                                Open Tool
                            </button>
                        </div>
                        
                        <div class="debug-tool-card">
                            <div class="debug-tool-icon">
                                <i class="fas fa-list"></i>
                            </div>
                            <h3>Console Logger</h3>
                            <p>Enhanced console logging and error tracking</p>
                            <button class="btn btn-primary" onclick="window.genomeBrowser.openDebugTool('console')">
                                Open Tool
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .debug-tools-modal {
                max-width: 800px;
                width: 90%;
            }
            
            .debug-tools-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin-top: 20px;
            }
            
            .debug-tool-card {
                border: 1px solid #ddd;
                border-radius: 8px;
                padding: 20px;
                text-align: center;
                background: #f8f9fa;
                transition: transform 0.2s, box-shadow 0.2s;
            }
            
            .debug-tool-card:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.1);
            }
            
            .debug-tool-icon {
                font-size: 48px;
                color: #007bff;
                margin-bottom: 15px;
            }
            
            .debug-tool-card h3 {
                margin: 10px 0;
                color: #333;
            }
            
            .debug-tool-card p {
                color: #666;
                margin-bottom: 15px;
                font-size: 14px;
            }
            
            .debug-tool-card .btn {
                width: 100%;
            }
        `;
        document.head.appendChild(style);

        // Add event listeners
        modal.querySelector('.modal-close').addEventListener('click', () => {
            modal.classList.remove('show');
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.classList.remove('show');
            }
        });

        return modal;
    }

    async openDebugTool(toolType) {
        // Close the debug tools modal
        const modal = document.getElementById('debugToolsModal');
        if (modal) {
            modal.classList.remove('show');
        }

        // Handle built-in tools
        if (toolType === 'performance') {
            this.openPerformanceMonitor();
            return;
        }
        if (toolType === 'console') {
            this.openConsoleLogger();
            return;
        }

        // For file-based tools, use IPC to open them
        let fileName;
        switch (toolType) {
            case 'bam-query':
                fileName = 'test-bam-query-debugging.html';
                break;
            case 'bam-coordinate-fix':
                fileName = 'test-bam-coordinate-fix-validation.html';
                break;
            default:
                console.error('Unknown debug tool:', toolType);
                return;
        }

        try {
            // Use IPC to open debug tool in new window
            if (window.electronAPI && window.electronAPI.openDebugTool) {
                await window.electronAPI.openDebugTool(fileName);
            } else {
                // Fallback: try direct file access
                const toolPath = `../../${fileName}`;
                const debugWindow = window.open(toolPath, 'debugTool', 'width=1200,height=800,scrollbars=yes,resizable=yes');
                if (debugWindow) {
                    debugWindow.focus();
                } else {
                    // Final fallback: open in iframe modal
                    this.openDebugToolInModal(toolPath, toolType);
                }
            }
        } catch (error) {
            console.error('Failed to open debug tool:', error);
            // Show error message to user
            alert(`Failed to open debug tool: ${error.message}\n\nPlease check the console for more details.`);
        }
    }

    openDebugToolInModal(toolPath, toolType) {
        // Create iframe modal for debug tool
        let modal = document.getElementById('debugToolIframeModal');
        if (!modal) {
            modal = document.createElement('div');
            modal.id = 'debugToolIframeModal';
            modal.className = 'modal';
            modal.innerHTML = `
                <div class="modal-content debug-tool-iframe-modal">
                    <div class="modal-header">
                        <h2><i class="fas fa-bug"></i> Debug Tool</h2>
                        <button class="modal-close">&times;</button>
                    </div>
                    <div class="modal-body">
                        <iframe id="debugToolIframe" style="width: 100%; height: 600px; border: none;"></iframe>
                    </div>
                </div>
            `;

            // Add styles
            const style = document.createElement('style');
            style.textContent = `
                .debug-tool-iframe-modal {
                    max-width: 95%;
                    width: 1200px;
                    max-height: 90%;
                }
                
                .debug-tool-iframe-modal .modal-body {
                    padding: 0;
                }
            `;
            document.head.appendChild(style);

            // Add event listeners
            modal.querySelector('.modal-close').addEventListener('click', () => {
                modal.classList.remove('show');
            });

            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('show');
                }
            });

            document.body.appendChild(modal);
        }

        // Load the debug tool
        const iframe = modal.querySelector('#debugToolIframe');
        iframe.src = toolPath;
        
        // Show modal
        modal.classList.add('show');
    }

    openPerformanceMonitor() {
        // Create a simple performance monitor
        console.log('🔧 Performance Monitor');
        console.log('Memory Usage:', performance.memory ? {
            used: Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB',
            total: Math.round(performance.memory.totalJSHeapSize / 1024 / 1024) + ' MB',
            limit: Math.round(performance.memory.jsHeapSizeLimit / 1024 / 1024) + ' MB'
        } : 'Not available');
        
        // Show alert with basic performance info
        alert(`Performance Monitor\n\nMemory Usage: ${performance.memory ? 
            Math.round(performance.memory.usedJSHeapSize / 1024 / 1024) + ' MB' : 
            'Not available'}\n\nCheck console for detailed information.`);
    }

    openConsoleLogger() {
        // Enhanced console logging
        console.log('🔧 Enhanced Console Logger Activated');
        console.log('Current time:', new Date().toISOString());
        console.log('User agent:', navigator.userAgent);
        console.log('GenomeExplorer state:', {
            currentChromosome: this.currentChromosome,
            currentSequence: this.currentSequence ? 'Loaded' : 'Not loaded',
            trackRenderer: !!this.trackRenderer,
            readsManager: !!this.readsManager
        });
        
        alert('Console Logger activated!\n\nCheck the browser console for detailed logging information.');
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
            allowAutoActivation: document.getElementById('mcpAllowAutoActivation').checked,
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
        
        // If auto-connect is now enabled and not currently connected, try to connect (only if auto-activation is allowed)
        if (mcpSettings.allowAutoActivation && mcpSettings.autoConnect && this.chatManager && !this.chatManager.isConnected) {
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

    // Set global dragging behavior for all tracks
    setGlobalDragging(enabled) {
        this.globalDraggingEnabled = enabled;
        console.log(`🎯 Global track dragging ${enabled ? 'enabled' : 'disabled'}`);
        
        // Notify NavigationManager about the setting change
        if (this.navigationManager) {
            this.navigationManager.setGlobalDragging(enabled);
        }
    }

    setupFeatureFilterListeners() {
        // Toolbar feature filter controls
        const toolbarFilters = [
            'showGenes', 'showCDS', 'showMRNA', 'showTRNA', 'showRRNA',
            'showPromoter', 'showTerminator', 'showRegulatory', 'showSource', 'showOther'
        ];
        
        const sidebarFilters = [
            'sidebarShowGenes', 'sidebarShowCDS', 'sidebarShowMRNA', 'sidebarShowTRNA', 'sidebarShowRRNA',
            'sidebarShowPromoter', 'sidebarShowTerminator', 'sidebarShowRegulatory', 'sidebarShowSource', 'sidebarShowOther'
        ];

        // Map filter IDs to gene filter keys
        const filterMap = {
            'showGenes': 'genes', 'showCDS': 'CDS', 'showMRNA': 'mRNA', 'showTRNA': 'tRNA', 'showRRNA': 'rRNA',
            'showPromoter': 'promoter', 'showTerminator': 'terminator', 'showRegulatory': 'regulatory', 'showSource': 'source', 'showOther': 'other'
        };

        // Setup toolbar listeners
        toolbarFilters.forEach(filterId => {
            document.getElementById(filterId).addEventListener('change', (e) => {
                const filterKey = filterMap[filterId.replace('sidebar', '')];
                this.geneFilters[filterKey] = e.target.checked;
                this.featureVisibility[filterKey] = e.target.checked; // Keep in sync
                this.syncSidebarFeatureFilter(filterId.replace('show', 'sidebarShow'), e.target.checked);
                this.updateGeneDisplay();
                // Notify TabManager of filter change
                if (this.tabManager) {
                    this.tabManager.onTrackSettingsChanged();
                }
            });
        });

        // Setup sidebar listeners
        sidebarFilters.forEach(filterId => {
            document.getElementById(filterId).addEventListener('change', (e) => {
                const filterKey = filterMap[filterId.replace('sidebar', '').replace('Show', 'show')];
                this.geneFilters[filterKey] = e.target.checked;
                this.featureVisibility[filterKey] = e.target.checked; // Keep in sync
                this.syncToolbarFeatureFilter(filterId.replace('sidebar', ''), e.target.checked);
                this.updateGeneDisplay();
                // Notify TabManager of filter change
                if (this.tabManager) {
                    this.tabManager.onTrackSettingsChanged();
                }
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

        // Handle plugin menu actions
        ipcRenderer.on('show-plugin-management', () => {
            console.log('🧩 Plugin Management requested from main menu');
            
            // Try to show the modal directly if PluginManagementUI is available
            if (window.pluginManagementUI) {
                console.log('✅ PluginManagementUI found globally, showing modal directly...');
                window.pluginManagementUI.showPluginModal();
            } else if (this.pluginManagementUI) {
                console.log('✅ PluginManagementUI found on instance, showing modal directly...');
                this.pluginManagementUI.showPluginModal();
            } else {
                console.warn('⚠️ PluginManagementUI not yet initialized, retrying in 500ms...');
                setTimeout(() => {
                    if (window.pluginManagementUI) {
                        console.log('🔄 Retry: Using global PluginManagementUI...');
                        window.pluginManagementUI.showPluginModal();
                    } else {
                        console.error('❌ Plugin Management system not available after retry');
                        // Fallback: show a simple notification
                        if (window.genomeBrowser && window.genomeBrowser.showNotification) {
                            window.genomeBrowser.showNotification('Plugin Management system is still initializing. Please try again in a moment.', 'warning');
                        }
                    }
                }, 500);
            }
        });

        ipcRenderer.on('show-plugin-marketplace', () => {
            console.log('🛒 Plugin Marketplace requested from main menu');
            
            // Try multiple approaches to open plugin marketplace
            const pluginMarketplaceBtn = document.getElementById('pluginMarketplaceBtn');
            
            if (pluginMarketplaceBtn) {
                console.log('✅ Plugin Marketplace button found, clicking...');
                pluginMarketplaceBtn.click();
            } else {
                console.warn('⚠️ Plugin Marketplace button not found, trying direct approach...');
                
                // Try to show the marketplace directly if PluginManagementUI is available
                if (window.pluginManagementUI) {
                    console.log('✅ PluginManagementUI found globally, opening marketplace directly...');
                    window.pluginManagementUI.openPluginMarketplace();
                } else if (this.pluginManagementUI) {
                    console.log('✅ PluginManagementUI found on instance, opening marketplace directly...');
                    this.pluginManagementUI.openPluginMarketplace();
                } else {
                    console.warn('⚠️ PluginManagementUI not yet initialized, retrying in 500ms...');
                    setTimeout(() => {
                        const retryBtn = document.getElementById('pluginMarketplaceBtn');
                        if (retryBtn) {
                            console.log('🔄 Retry: Plugin Marketplace button found, clicking...');
                            retryBtn.click();
                        } else if (window.pluginManagementUI) {
                            console.log('🔄 Retry: Opening marketplace directly...');
                            window.pluginManagementUI.openPluginMarketplace();
                        } else {
                            // Fallback: show a simple notification
                            if (window.genomeBrowser && window.genomeBrowser.showNotification) {
                                window.genomeBrowser.showNotification('Plugin Marketplace system is still initializing. Please try again in a moment.', 'warning');
                            }
                        }
                    }, 500);
                }
            }
        });

        ipcRenderer.on('show-smart-execution-demo', () => {
            this.showSmartExecutionDemo();
        });

        // Handle Plugin Function Calling Test
        ipcRenderer.on('show-plugin-function-calling-test', () => {
            console.log('🧪 Plugin Function Calling Test requested from main menu');
            
            try {
                // Check if test file exists and open it
                const testPath = path.join(__dirname, '..', 'test', 'plugin-function-calling-test.html');
                const { shell } = require('electron');
                
                // For now, we'll use IPC to request the main process to open it
                ipcRenderer.send('open-plugin-function-calling-test');
                
                this.showNotification('Plugin Function Calling Test window is opening...', 'info');
            } catch (error) {
                console.error('Failed to open Plugin Function Calling Test:', error);
                this.showNotification('Unable to open Plugin Function Calling Test window', 'error');
            }
        });

        // Handle Resource Manager
        ipcRenderer.on('open-resource-manager', () => {
            this.openResourceManager();
        });

        // Handle visualization tools from Tools menu
        ipcRenderer.on('open-visualization-tool', (event, pluginId) => {
            console.log(`🎨 Opening visualization tool: ${pluginId}`);
            
            try {
                // 使用新的可视化工具管理器
                if (this.visualizationToolsManager) {
                    this.visualizationToolsManager.openVisualizationTool(pluginId);
                } else if (window.visualizationToolsManager) {
                    window.visualizationToolsManager.openVisualizationTool(pluginId);
                } else {
                    console.warn('VisualizationToolsManager not available, initializing...');
                    this.initializeVisualizationToolsManager(pluginId);
                }
            } catch (error) {
                console.error(`Failed to open visualization tool ${pluginId}:`, error);
                this.showNotification(`Unable to open ${pluginId} visualization tool`, 'error');
            }
        });

        // Handle options menu actions from main menu
        ipcRenderer.on('configure-llms', () => {
            const configureLLMBtn = document.getElementById('configureLLMBtn');
            if (configureLLMBtn) {
                configureLLMBtn.click();
            }
        });

        ipcRenderer.on('mcp-settings', () => {
            const mcpSettingsBtn = document.getElementById('mcpSettingsBtn');
            if (mcpSettingsBtn) {
                mcpSettingsBtn.click();
            }
        });

        ipcRenderer.on('multi-agent-settings', () => {
            console.log('🤖 Multi-Agent Settings requested from main menu');
            
            // Try multiple approaches to open multi-agent settings
            const multiAgentSettingsBtn = document.getElementById('multiAgentSettingsBtn');
            
            if (multiAgentSettingsBtn) {
                console.log('✅ Multi-Agent Settings button found, clicking...');
                multiAgentSettingsBtn.click();
            } else {
                console.warn('⚠️ Multi-Agent Settings button not found, trying direct approach...');
                
                // Try to show the modal directly if MultiAgentSettingsManager is available
                if (window.multiAgentSettingsManager) {
                    console.log('✅ MultiAgentSettingsManager found globally, showing modal directly...');
                    window.multiAgentSettingsManager.showModal();
                } else if (this.multiAgentSettingsManager) {
                    console.log('✅ MultiAgentSettingsManager found on instance, showing modal directly...');
                    this.multiAgentSettingsManager.showModal();
                } else {
                    console.warn('⚠️ MultiAgentSettingsManager not yet initialized, retrying in 500ms...');
                    setTimeout(() => {
                        const retryBtn = document.getElementById('multiAgentSettingsBtn');
                        if (retryBtn) {
                            console.log('🔄 Retry: Multi-Agent Settings button found, clicking...');
                            retryBtn.click();
                        } else if (window.multiAgentSettingsManager) {
                            console.log('🔄 Retry: Showing modal directly...');
                            window.multiAgentSettingsManager.showModal();
                        } else {
                            // Fallback: show a simple notification
                            if (window.genomeBrowser && window.genomeBrowser.showNotification) {
                                window.genomeBrowser.showNotification('Multi-Agent Settings system is still initializing. Please try again in a moment.', 'warning');
                            }
                        }
                    }, 500);
                }
            }
        });

        ipcRenderer.on('general-settings', () => {
            const settingsBtn = document.getElementById('settingsBtn');
            if (settingsBtn) {
                settingsBtn.click();
            }
        });

        // Handle ChatBox settings
        ipcRenderer.on('chatbox-settings', () => {
            console.log('📱 ChatBox Settings requested from main menu');
            // Dispatch event to trigger settings modal
            window.dispatchEvent(new CustomEvent('chatbox-settings'));
        });

        // Evolution interface is now handled as a separate window
        // No IPC handler needed - menu action creates new window directly



        // Handle Edit menu actions
        ipcRenderer.on('menu-copy', () => {
            this.handleMenuCopy();
        });

        ipcRenderer.on('menu-paste', () => {
            this.handleMenuPaste();
        });

        ipcRenderer.on('menu-select-all', () => {
            this.handleMenuSelectAll();
        });

        // Handle Action menu items
        ipcRenderer.on('action-copy-sequence', () => {
            if (window.actionManager) {
                window.actionManager.handleCopySequence();
            } else {
                this.showNotification('Action system not initialized', 'error');
            }
        });

        ipcRenderer.on('action-cut-sequence', () => {
            if (window.actionManager) {
                window.actionManager.handleCutSequence();
            } else {
                this.showNotification('Action system not initialized', 'error');
            }
        });

        ipcRenderer.on('action-paste-sequence', () => {
            if (window.actionManager) {
                window.actionManager.handlePasteSequence();
            } else {
                this.showNotification('Action system not initialized', 'error');
            }
        });

        ipcRenderer.on('action-delete-sequence', () => {
            if (window.actionManager) {
                window.actionManager.handleDeleteSequence();
            } else {
                this.showNotification('Action system not initialized', 'error');
            }
        });

        ipcRenderer.on('action-insert-sequence', () => {
            if (window.actionManager) {
                window.actionManager.handleInsertSequence();
            } else {
                this.showNotification('Action system not initialized', 'error');
            }
        });

        ipcRenderer.on('show-action-list', () => {
            if (window.actionManager) {
                window.actionManager.showActionList();
            } else {
                this.showNotification('Action system not initialized', 'error');
            }
        });

        ipcRenderer.on('execute-all-actions', () => {
            if (window.actionManager) {
                window.actionManager.executeAllActions();
            } else {
                this.showNotification('Action system not initialized', 'error');
            }
        });

        ipcRenderer.on('create-checkpoint', () => {
            if (window.checkpointManager) {
                window.checkpointManager.createManualCheckpoint();
            } else {
                this.showNotification('Checkpoint system not initialized', 'error');
            }
        });

        ipcRenderer.on('rollback-checkpoint', () => {
            if (window.checkpointManager) {
                window.checkpointManager.showCheckpointList();
            } else {
                this.showNotification('Checkpoint system not initialized', 'error');
            }
        });

        // Handle file status check from Project Manager
        ipcRenderer.on('check-file-status', () => {
            const hasOpenFile = this.currentFile !== null || this.loadedFiles.length > 0;
            ipcRenderer.send('main-window-status-response', hasOpenFile);
        });

        // Handle file loading from Project Manager
        ipcRenderer.on('load-file', (event, filePath) => {
            console.log('🎯 Main window received load-file event with path:', filePath);
            if (this.fileManager) {
                console.log('📂 Calling fileManager.loadFile with path:', filePath);
                this.fileManager.loadFile(filePath);
            } else {
                console.error('❌ FileManager not available in main window');
            }
        });

        // Handle project management from main menu
        ipcRenderer.on('open-project-file', (event, filePath) => {
            console.log('📂 Opening project file from main menu:', filePath);
            this.showNotification(`Opening project: ${filePath}`, 'info');
            // TODO: 实现项目文件打开逻辑
            // 这里可以调用 ProjectManager 的方法来加载项目
        });

        ipcRenderer.on('save-current-project', async () => {
            console.log('💾 Save current project requested');
            try {
                // 打开项目管理器并触发保存当前项目的操作
                const projectManagerWindow = await this.openProjectManagerWindow();
                if (projectManagerWindow && projectManagerWindow.projectManagerWindow) {
                    await projectManagerWindow.projectManagerWindow.saveCurrentProjectAsXML();
                } else {
                    this.showNotification('Please open Project Manager to save current project', 'warning');
                }
            } catch (error) {
                console.error('Error saving current project:', error);
                this.showNotification('Failed to save current project', 'error');
            }
        });

        ipcRenderer.on('save-project-as', async () => {
            console.log('💾 Save project as requested');
            try {
                // 打开项目管理器并触发另存为操作
                const projectManagerWindow = await this.openProjectManagerWindow();
                if (projectManagerWindow && projectManagerWindow.projectManagerWindow) {
                    await projectManagerWindow.projectManagerWindow.saveCurrentProjectAsXML();
                } else {
                    this.showNotification('Please open Project Manager to save project', 'warning');
                }
            } catch (error) {
                console.error('Error saving project as:', error);
                this.showNotification('Failed to save project', 'error');
            }
        });

        ipcRenderer.on('export-project-xml', async () => {
            console.log('📤 Export project as XML requested');
            try {
                // 打开项目管理器并触发XML导出操作
                const projectManagerWindow = await this.openProjectManagerWindow();
                if (projectManagerWindow && projectManagerWindow.projectManagerWindow) {
                    await projectManagerWindow.projectManagerWindow.saveCurrentProjectAsXML();
                } else {
                    this.showNotification('Please open Project Manager to export project as XML', 'warning');
                }
            } catch (error) {
                console.error('Error exporting project as XML:', error);
                this.showNotification('Failed to export project as XML', 'error');
            }
        });

        ipcRenderer.on('open-recent-project', (event, project) => {
            console.log('📂 Opening recent project:', project);
            this.showNotification(`Opening recent project: ${project.name}`, 'info');
            // TODO: 实现最近项目打开逻辑
        });

        ipcRenderer.on('clear-recent-projects', () => {
            console.log('🗑️ Clear recent projects requested');
            this.showNotification('Recent projects cleared', 'info');
            // TODO: 实现清除最近项目逻辑
        });

        // Handle MCP tool calls for action functions
        ipcRenderer.on('mcp-tool-call', async (event, data) => {
            console.log('🔧 MCP tool call received:', data);
            
            try {
                const { requestId, method, parameters } = data;
                
                // Check if this is an action function call
                if (method && method.startsWith('action_')) {
                    const actionFunctionName = method.substring(7); // Remove 'action_' prefix
                    
                    if (this.actionManager) {
                        const result = await this.actionManager.executeActionFunction(actionFunctionName, parameters);
                        
                        // Send success response
                        ipcRenderer.send('mcp-tool-response', {
                            requestId,
                            success: true,
                            result
                        });
                    } else {
                        // Send error response
                        ipcRenderer.send('mcp-tool-response', {
                            requestId,
                            success: false,
                            error: 'ActionManager not available'
                        });
                    }
                } else {
                    // Not an action function, send error
                    ipcRenderer.send('mcp-tool-response', {
                        requestId,
                        success: false,
                        error: `Unknown MCP tool method: ${method}`
                    });
                }
            } catch (error) {
                console.error('Error handling MCP tool call:', error);
                
                // Send error response
                ipcRenderer.send('mcp-tool-response', {
                    requestId: data.requestId,
                    success: false,
                    error: error.message
                });
            }
        });
    }

    // Refresh the current view (used by TabManager for state restoration)
    refreshCurrentView() {
        if (this.currentChromosome && this.currentSequence && this.currentSequence[this.currentChromosome]) {
            console.log(`Refreshing view for chromosome: ${this.currentChromosome}`);
            this.displayGenomeView(this.currentChromosome, this.currentSequence[this.currentChromosome]);
        } else {
            console.log('No current chromosome/sequence to refresh');
        }
    }

    // Helper method to create tracks by type
    async createTrackByType(trackType, chromosome, sequence, tracksToShow) {
        // Skip if track is not visible
        const visibleTrackName = trackType === 'wigTracks' ? 'wigTracks' : trackType;
        if (!this.visibleTracks.has(visibleTrackName)) {
            return;
        }
        
        let trackElement = null;
        
        switch (trackType) {
            case 'genes':
                // Gene track (only if annotations exist)
                if (this.currentAnnotations && this.currentAnnotations[chromosome]) {
                    trackElement = this.trackRenderer.createGeneTrack(chromosome);
                }
                break;
                
            case 'gc':
                // GC Content track
                trackElement = this.trackRenderer.createGCTrack(chromosome, sequence);
                break;
                
            case 'variants':
                // Variants track (show even without data)
                trackElement = this.trackRenderer.createVariantTrack(chromosome);
                break;
                
            case 'reads':
                // Aligned reads track (async)
                trackElement = await this.trackRenderer.createReadsTrack(chromosome);
                break;
                
            case 'wigTracks':
                // WIG tracks (show even without data)
                trackElement = this.trackRenderer.createWIGTrack(chromosome);
                break;
                
            case 'proteins':
                // Protein track (only if we have CDS annotations)
                if (this.currentAnnotations && this.currentAnnotations[chromosome]) {
                    trackElement = this.trackRenderer.createProteinTrack(chromosome);
                }
                break;
                
            case 'actions':
                // Actions track (show even without data)
                trackElement = this.trackRenderer.createActionsTrack(chromosome);
                break;
                
            case 'sequenceLine':
                // Single-line sequence track
                trackElement = this.trackRenderer.createSequenceLineTrack(chromosome, sequence);
                break;
                
            default:
                console.warn(`Unknown track type: ${trackType}`);
                return;
        }
        
        if (trackElement) {
            tracksToShow.push({ element: trackElement, type: trackType });
        }
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
            
            // PRESERVE TRACK HEIGHTS AND HEADER STATES before clearing container
            this.trackRenderer.saveHeaderStates();
            
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
            
            // Collect all tracks to be displayed in tab-specific order
            const tracksToShow = [];
            
            // Get current tab's track order from TabManager
            const currentTabState = this.tabManager && this.tabManager.getCurrentTabState();
            let currentTabOrder;
            
            if (currentTabState && currentTabState.trackOrder && Array.isArray(currentTabState.trackOrder) && currentTabState.trackOrder.length > 0) {
                currentTabOrder = currentTabState.trackOrder;
                console.log('[displayGenomeView] Using saved tab track order:', currentTabOrder);
            } else {
                // If no saved order, try to get current DOM order first
                const domOrder = this.tabManager ? this.tabManager.getTrackOrder() : [];
                if (domOrder && domOrder.length > 0) {
                    currentTabOrder = domOrder;
                    console.log('[displayGenomeView] Using current DOM track order:', currentTabOrder);
                } else {
                    currentTabOrder = ['genes', 'gc', 'variants', 'reads', 'wigTracks', 'proteins', 'sequenceLine', 'actions'];
                    console.log('[displayGenomeView] Using default track order:', currentTabOrder);
                }
            }
            
            console.log('[displayGenomeView] Current tab state available:', !!currentTabState);
            
            // Create tracks according to the tab's specific order
            for (const trackType of currentTabOrder) {
                await this.createTrackByType(trackType, chromosome, sequence, tracksToShow);
            }
            
            // Also create any visible tracks that aren't in the saved order (for backward compatibility)
            const defaultOrder = ['genes', 'gc', 'variants', 'reads', 'wigTracks', 'proteins', 'sequenceLine', 'actions'];
            for (const trackType of defaultOrder) {
                if (!currentTabOrder.includes(trackType)) {
                    await this.createTrackByType(trackType, chromosome, sequence, tracksToShow);
                }
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
            
            // Apply saved track state (sizes) from previous sessions
            // Note: Track order is already applied during track creation
            this.trackStateManager.applyTrackSizes(browserContainer);
            
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
        // Toggle button has been removed - no longer needed
        return;
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
            document.body.setAttribute('data-splitter-resizing', 'true');
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
                const newTopHeight = startTopHeight + deltaY;
                const newBottomHeight = startBottomHeight - deltaY;
                const minHeight = 40;
                if (newTopHeight >= minHeight && newBottomHeight >= minHeight) {
                    topContent.style.height = `${newTopHeight}px`;
                    bottomContent.style.height = `${newBottomHeight}px`;
                    // --- Dynamic adjustment for sequence track window ---
                    if (bottomTrack.classList.contains('sequence-track') || bottomTrack.id === 'sequenceDisplaySection') {
                        const parent = bottomTrack.parentElement;
                        const parentHeight = parent ? parent.offsetHeight : window.innerHeight;
                        // If剩余空间小于10px，恢复flex自适应
                        if (parentHeight - (topTrack.offsetHeight + splitter.offsetHeight + newBottomHeight) < 10 || newBottomHeight > parentHeight * 0.75) {
                            bottomTrack.style.flex = '1 0 auto';
                            bottomTrack.style.height = '';
                        } else {
                            bottomTrack.style.flex = 'none';
                            bottomTrack.style.height = `${newBottomHeight}px`;
                        }
                    }
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
            
            // Trigger sequence track window re-render if it was affected
            if (bottomTrack && (bottomTrack.classList.contains('sequence-track') || bottomTrack.id === 'sequenceDisplaySection')) {
                const currentChr = document.getElementById('chromosomeSelect')?.value;
                if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
                    console.log('🔄 Triggering sequence track window re-render after splitter adjustment');
                    // Use a small delay to ensure DOM updates are complete
                    setTimeout(() => {
                        this.displayEnhancedSequence(currentChr, this.currentSequence[currentChr]);
                    }, 50);
                }
            }
            
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
        
        // Notify TabManager of track order change IMMEDIATELY
        // to ensure track state is synchronized before any re-rendering
        if (this.tabManager) {
            this.tabManager.onTrackOrderChanged(newOrder);
            console.log('Track order change notified to TabManager:', newOrder);
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
        const trackSequenceLine = document.getElementById('trackSequenceLine');
        const trackActions = document.getElementById('trackActions');
        
        if (trackGenes && trackGenes.checked) tracks.add('genes');
        if (trackGC && trackGC.checked) tracks.add('gc');
        if (trackVariants && trackVariants.checked) tracks.add('variants');
        if (trackReads && trackReads.checked) tracks.add('reads');
        if (trackWIG && trackWIG.checked) tracks.add('wigTracks');
        if (trackProteins && trackProteins.checked) tracks.add('proteins');
        if (trackSequence && trackSequence.checked) tracks.add('sequence');
        if (trackSequenceLine && trackSequenceLine.checked) tracks.add('sequenceLine');
        if (trackActions && trackActions.checked) tracks.add('actions');
        
        this.visibleTracks = tracks;
        
        // Sync with sidebar
        const sidebarTrackGenes = document.getElementById('sidebarTrackGenes');
        const sidebarTrackGC = document.getElementById('sidebarTrackGC');
        const sidebarTrackVariants = document.getElementById('sidebarTrackVariants');
        const sidebarTrackReads = document.getElementById('sidebarTrackReads');
        const sidebarTrackWIG = document.getElementById('sidebarTrackWIG');
        const sidebarTrackProteins = document.getElementById('sidebarTrackProteins');
        const sidebarTrackSequence = document.getElementById('sidebarTrackSequence');
        const sidebarTrackSequenceLine = document.getElementById('sidebarTrackSequenceLine');
        const sidebarTrackActions = document.getElementById('sidebarTrackActions');
        
        if (sidebarTrackGenes) sidebarTrackGenes.checked = tracks.has('genes');
        if (sidebarTrackGC) sidebarTrackGC.checked = tracks.has('gc');
        if (sidebarTrackVariants) sidebarTrackVariants.checked = tracks.has('variants');
        if (sidebarTrackReads) sidebarTrackReads.checked = tracks.has('reads');
        if (sidebarTrackWIG) sidebarTrackWIG.checked = tracks.has('wigTracks');
        if (sidebarTrackProteins) sidebarTrackProteins.checked = tracks.has('proteins');
        if (sidebarTrackSequence) sidebarTrackSequence.checked = tracks.has('sequence');
        if (sidebarTrackSequenceLine) sidebarTrackSequenceLine.checked = tracks.has('sequenceLine');
        if (sidebarTrackActions) sidebarTrackActions.checked = tracks.has('actions');
        
        // Update trackVisibility object to match visibleTracks
        this.trackVisibility.genes = tracks.has('genes');
        this.trackVisibility.gc = tracks.has('gc');
        this.trackVisibility.variants = tracks.has('variants');
        this.trackVisibility.reads = tracks.has('reads');
        this.trackVisibility.proteins = tracks.has('proteins');
        this.trackVisibility.sequence = tracks.has('sequence');
        this.trackVisibility.sequenceLine = tracks.has('sequenceLine');
        this.trackVisibility.actions = tracks.has('actions');
        
        // Notify TabManager of track visibility change
        if (this.tabManager) {
            this.tabManager.onTrackVisibilityChanged();
        }
        
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
        const sidebarTrackSequenceLine = document.getElementById('sidebarTrackSequenceLine');
        const sidebarTrackActions = document.getElementById('sidebarTrackActions');
        
        if (sidebarTrackGenes && sidebarTrackGenes.checked) tracks.add('genes');
        if (sidebarTrackGC && sidebarTrackGC.checked) tracks.add('gc');
        if (sidebarTrackVariants && sidebarTrackVariants.checked) tracks.add('variants');
        if (sidebarTrackReads && sidebarTrackReads.checked) tracks.add('reads');
        if (sidebarTrackWIG && sidebarTrackWIG.checked) tracks.add('wigTracks');
        if (sidebarTrackProteins && sidebarTrackProteins.checked) tracks.add('proteins');
        if (sidebarTrackSequence && sidebarTrackSequence.checked) tracks.add('sequence');
        if (sidebarTrackSequenceLine && sidebarTrackSequenceLine.checked) tracks.add('sequenceLine');
        if (sidebarTrackActions && sidebarTrackActions.checked) tracks.add('actions');
        
        this.visibleTracks = tracks;
        
        // Sync with toolbar
        const trackGenes = document.getElementById('trackGenes');
        const trackGC = document.getElementById('trackGC');
        const trackVariants = document.getElementById('trackVariants');
        const trackReads = document.getElementById('trackReads');
        const trackWIG = document.getElementById('trackWIG');
        const trackProteins = document.getElementById('trackProteins');
        const trackSequence = document.getElementById('trackSequence');
        const trackSequenceLine = document.getElementById('trackSequenceLine');
        const trackActions = document.getElementById('trackActions');
        
        if (trackGenes) trackGenes.checked = tracks.has('genes');
        if (trackGC) trackGC.checked = tracks.has('gc');
        if (trackVariants) trackVariants.checked = tracks.has('variants');
        if (trackReads) trackReads.checked = tracks.has('reads');
        if (trackWIG) trackWIG.checked = tracks.has('wigTracks');
        if (trackProteins) trackProteins.checked = tracks.has('proteins');
        if (trackSequence) trackSequence.checked = tracks.has('sequence');
        if (trackSequenceLine) trackSequenceLine.checked = tracks.has('sequenceLine');
        if (trackActions) trackActions.checked = tracks.has('actions');
        
        // Update trackVisibility object to match visibleTracks
        this.trackVisibility.genes = tracks.has('genes');
        this.trackVisibility.gc = tracks.has('gc');
        this.trackVisibility.variants = tracks.has('variants');
        this.trackVisibility.reads = tracks.has('reads');
        this.trackVisibility.proteins = tracks.has('proteins');
        this.trackVisibility.sequence = tracks.has('sequence');
        this.trackVisibility.sequenceLine = tracks.has('sequenceLine');
        this.trackVisibility.actions = tracks.has('actions');
        
        // Notify TabManager of track visibility change
        if (this.tabManager) {
            this.tabManager.onTrackVisibilityChanged();
        }
        
        // Refresh the genome view if a file is loaded
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
        }
    }

    // Helper method to programmatically enable Actions track
    enableActionsTrack() {
        // Add to visible tracks
        this.visibleTracks.add('actions');
        
        // Update checkboxes to reflect the change
        const trackActions = document.getElementById('trackActions');
        const sidebarTrackActions = document.getElementById('sidebarTrackActions');
        
        if (trackActions) trackActions.checked = true;
        if (sidebarTrackActions) sidebarTrackActions.checked = true;
        
        // Refresh the display to show the track
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
        }
        
        console.log('✅ Actions track enabled and displayed');
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
            'source': 'source',  // Handle source features specially
            'comment': 'other',
            'note': 'other',
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

    updateStatus(message, options = {}) {
        this.uiManager.updateStatus(message, options);
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
        // Use unified translation implementation
        if (window.UnifiedDNATranslation) {
            const result = window.UnifiedDNATranslation.strandBasedTranslateDNA(dnaSequence, strand);
            return result;
        }
        
        // Fallback to sequenceUtils implementation
        return this.sequenceUtils.translateDNA(dnaSequence, strand);
    }

    makeDraggable(element, chromosome) {
        this.navigationManager.makeDraggable(element, chromosome);
    }

    // Gene Selection Methods
    selectGene(gene, operonInfo = null) {
        // Remove selection from previously selected gene
        this.clearGeneSelection();
        
        // Set new selected gene
        this.selectedGene = { gene, operonInfo };
        
        // Add selection styling to gene elements using multiple identification methods
        this.highlightSelectedGene(gene);
        
        console.log('Selected gene:', gene.qualifiers?.gene || gene.qualifiers?.locus_tag || gene.type);
        
        // Show visual feedback that a gene was selected
        this.showGeneSelectionFeedback(gene);
    }

    /**
     * Show visual feedback when a gene is selected
     */
    showGeneSelectionFeedback(gene) {
        const geneName = gene.qualifiers?.gene || gene.qualifiers?.locus_tag || gene.type;
        const message = `Selected gene: ${geneName}`;
        
        // Show notification if available
        if (typeof this.showNotification === 'function') {
            this.showNotification(message, 'info');
        }
        
        // Update status bar if available
        const statusBar = document.querySelector('.status-bar');
        if (statusBar) {
            const statusMessage = statusBar.querySelector('.status-message') || statusBar;
            const originalText = statusMessage.textContent;
            statusMessage.textContent = message;
            statusMessage.style.color = '#3b82f6';
            statusMessage.style.fontWeight = 'bold';
            
            // Reset after 3 seconds
            setTimeout(() => {
                statusMessage.textContent = originalText;
                statusMessage.style.color = '';
                statusMessage.style.fontWeight = '';
            }, 3000);
        }
    }

    /**
     * Highlight the selected gene in the track
     * Uses multiple methods to identify and highlight the correct gene element
     */
    highlightSelectedGene(gene) {
        // Method 1: Find gene elements by data attributes (most reliable)
        const geneElementsByData = document.querySelectorAll(`[data-gene-start="${gene.start}"][data-gene-end="${gene.end}"]`);
        geneElementsByData.forEach(el => {
            el.classList.add('selected');
        });

        // Method 2: Find SVG gene elements
        const svgGeneElements = document.querySelectorAll('g.svg-gene-element, rect.svg-gene-element, path.svg-gene-element');
        svgGeneElements.forEach(el => {
            // Check if the element has the correct gene position data
            const geneStart = el.getAttribute('data-gene-start') || el.getAttribute('data-start');
            const geneEnd = el.getAttribute('data-gene-end') || el.getAttribute('data-end');
            
            if ((geneStart && parseInt(geneStart) === gene.start) && 
                (geneEnd && parseInt(geneEnd) === gene.end)) {
                el.classList.add('selected');
            }
        });

        // Method 3: Find regular gene elements by position matching (fallback)
        const allGeneElements = document.querySelectorAll('.gene-element');
        allGeneElements.forEach(el => {
            // Check title for position information
            const elementTitle = el.title || '';
            const genePosition = `${gene.start}-${gene.end}`;
            
            // Check if title contains the gene position
            if (elementTitle.includes(genePosition)) {
                el.classList.add('selected');
                return;
            }

            // Check data attributes as fallback
            const dataStart = el.getAttribute('data-start') || el.getAttribute('data-gene-start');
            const dataEnd = el.getAttribute('data-end') || el.getAttribute('data-gene-end');
            
            if (dataStart && dataEnd && 
                parseInt(dataStart) === gene.start && 
                parseInt(dataEnd) === gene.end) {
                el.classList.add('selected');
            }
        });

        // Method 4: Check if we successfully highlighted any elements
        const highlightedElements = document.querySelectorAll('.gene-element.selected, .svg-gene-element.selected');
        
        if (highlightedElements.length === 0) {
            console.warn('No gene elements found to highlight for gene:', gene);
            // Force refresh of the gene track to ensure elements are present
            this.refreshGeneTrackIfNeeded();
        } else {
            console.log(`Highlighted ${highlightedElements.length} gene element(s) for gene:`, gene.qualifiers?.gene || gene.qualifiers?.locus_tag || gene.type);
        }
    }

    /**
     * Refresh gene track if no elements were found for highlighting
     */
    refreshGeneTrackIfNeeded() {
        const currentChr = document.getElementById('chromosomeSelect')?.value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            console.log('Refreshing gene track to ensure elements are present...');
            // Small delay to ensure the refresh happens after current execution
            setTimeout(() => {
                this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
            }, 100);
        }
    }

    showGeneDetailsPanel() {
        const geneDetailsSection = document.getElementById('geneDetailsSection');
        if (geneDetailsSection) {
            geneDetailsSection.style.display = 'block';
            this.uiManager.showSidebarIfHidden();
            
            // Update tab manager about sidebar panel state change
            if (this.tabManager) {
                this.tabManager.updateCurrentTabSidebarPanel('geneDetailsSection', true, geneDetailsSection.innerHTML);
            }
        }
    }

    showReadDetailsPanel() {
        const readDetailsSection = document.getElementById('readDetailsSection');
        if (readDetailsSection) {
            readDetailsSection.style.display = 'block';
            this.uiManager.showSidebarIfHidden();
            
            // Update tab manager about sidebar panel state change
            if (this.tabManager) {
                this.tabManager.updateCurrentTabSidebarPanel('readDetailsSection', true, readDetailsSection.innerHTML);
            }
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
        
        // Get current chromosome and sequence for sequence extraction
        const currentChr = document.getElementById('chromosomeSelect').value;
        const fullSequence = this.currentSequence ? this.currentSequence[currentChr] : null;
        
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
        
        // Add sequences section if we have sequence data
        if (fullSequence) {
            html += this.createSequencesSection(gene, fullSequence, geneName, currentChr);
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
                            <div class="gene-attribute-value">${this.enhanceGeneAttributeWithLinks(stringValue)}</div>
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
                    <i class="fas fa-copy"></i> Copy DNA Sequence
                </button>
        `;
        
        // Add copy translation button if it's a CDS or has translation
        if (geneType === 'CDS' || (gene.qualifiers && gene.qualifiers.translation)) {
            html += `
                <button class="btn gene-copy-translation-btn gene-action-btn" onclick="window.genomeBrowser.copyGeneTranslation()">
                    <i class="fas fa-copy"></i> Copy Translation
                </button>
            `;
        }
        
        // Add search structure buttons for proteins/genes
        if (geneType === 'CDS' || geneType === 'gene') {
            html += `
                <button class="btn gene-search-pdb-btn gene-action-btn" onclick="window.genomeBrowser.searchPDBStructures('${geneName}')" title="Search experimental structures in PDB">
                    <i class="fas fa-microscope"></i> Search PDB
                </button>
                <button class="btn gene-search-alphafold-btn gene-action-btn" onclick="window.genomeBrowser.searchAlphaFoldStructures('${geneName}')" title="Search AI-predicted structures in AlphaFold">
                    <i class="fas fa-brain"></i> Search AlphaFold
                </button>
            `;
        }
        
        // Add edit button
        html += `
                <button class="btn gene-edit-btn gene-action-btn" onclick="window.genomeBrowser.editGeneAnnotation()">
                    <i class="fas fa-edit"></i> Edit Annotation
                </button>
        `;
        
        html += `</div></div>`;
        
        geneDetailsContent.innerHTML = html;
        
        // Add event listeners for expandable sections
        this.setupExpandableSequences();
        
        // Update tab manager about gene details content change
        if (this.tabManager) {
            const geneDetailsSection = document.getElementById('geneDetailsSection');
            if (geneDetailsSection && geneDetailsSection.style.display !== 'none') {
                this.tabManager.updateCurrentTabSidebarPanel('geneDetailsSection', true, geneDetailsSection.innerHTML);
            }
        }
    }

    populateReadDetails(read, fileInfo = null) {
        const readDetailsContent = document.getElementById('readDetailsContent');
        if (!readDetailsContent) return;
        
        // Get basic read information
        const readName = read.id || read.qname || 'Unknown Read';
        const position = `${read.start.toLocaleString()}-${read.end.toLocaleString()}`;
        const length = (read.end - read.start + 1).toLocaleString();
        const strand = read.strand === '+' || read.strand === 1 ? 'Forward (+)' : 'Reverse (-)';
        
        // Get current chromosome for context
        const currentChr = document.getElementById('chromosomeSelect').value;
        
        // Create the read details HTML
        let html = `
            <div class="read-details-info">
                <div class="read-basic-info">
                    <div class="read-name">${readName}</div>
                    <div class="read-type-badge">Aligned Read</div>
                    <div class="read-position">Position: ${position}</div>
                    <div class="read-strand">Strand: ${strand} | Length: ${length} bp</div>
        `;
        
        // Add file information if available
        if (fileInfo) {
            html += `
                    <div class="read-file-info" style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-color);">
                        <div style="font-size: 12px; color: var(--text-secondary);">
                            <strong>File:</strong> ${fileInfo.name || 'Unknown File'}
                        </div>
                    </div>
            `;
        }
        
        html += `</div>`;
        
        // Add sequences section if we have sequence data
        if (read.sequence || read.quality) {
            html += this.createReadSequencesSection(read, readName, currentChr);
        }
        
        // Add read attributes if available
        const attributes = this.getReadAttributes(read);
        if (Object.keys(attributes).length > 0) {
            html += `
                <div class="read-attributes">
                    <h4>Read Properties</h4>
            `;
            
            Object.entries(attributes).forEach(([key, value]) => {
                if (value != null && String(value).trim() !== '') {
                    html += `
                        <div class="read-attribute">
                            <div class="read-attribute-label">${key.replace(/_/g, ' ')}</div>
                            <div class="read-attribute-value">${this.formatReadAttributeValue(key, value)}</div>
                        </div>
                    `;
                }
            });
            
            html += `</div>`;
        }
        
        // Add action buttons
        html += `
            <div class="read-actions">
                <button class="btn read-zoom-btn read-action-btn" onclick="window.genomeBrowser.zoomToRead()">
                    <i class="fas fa-search-plus"></i> Zoom to Read
                </button>
                <button class="btn read-copy-btn read-action-btn" onclick="window.genomeBrowser.copyReadSequence()">
                    <i class="fas fa-copy"></i> Copy Sequence
                </button>
        `;
        
        // Add copy quality button if quality data is available
        if (read.quality && read.quality.length > 0) {
            html += `
                <button class="btn read-copy-quality-btn read-action-btn" onclick="window.genomeBrowser.copyReadQuality()">
                    <i class="fas fa-copy"></i> Copy Quality
                </button>
            `;
        }
        
        html += `</div></div>`;
        
        readDetailsContent.innerHTML = html;
        
        // Add event listeners for expandable sequences
        this.setupExpandableReadSequences();
    }

    createReadSequencesSection(read, readName, chromosome) {
        let html = `
            <div class="read-sequences">
                <h4>Sequences</h4>
        `;
        
        // Add DNA sequence if available
        if (read.sequence && read.sequence.length > 0) {
            const sequencePreview = this.formatSequencePreview(read.sequence, 60);
            const sequenceFormatted = this.formatSequenceWithLineNumbers(read.sequence, 1);
            
            html += `
                <div class="read-sequence-section">
                    <div class="read-sequence-header">
                        <span>DNA Sequence (${read.sequence.length} bp)</span>
                        <div class="read-sequence-actions">
                            <button class="toggle-read-sequence-btn" onclick="window.genomeBrowser.toggleReadSequence('dna-${readName}')">
                                <i class="fas fa-expand-alt"></i> Show Full
                            </button>
                            <button class="copy-read-sequence-btn" onclick="window.genomeBrowser.copySpecificReadSequence('dna', '${readName}')">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                    </div>
                    <div class="read-sequence-content">
                        <div class="read-sequence-preview" id="dna-${readName}-preview">
                            ${this.colorizeSequenceBases(sequencePreview)}
                        </div>
                        <div class="read-sequence-full" id="dna-${readName}-full">
                            <div class="read-sequence-formatted">
                                ${this.colorizeSequenceBases(sequenceFormatted)}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Add quality scores if available
        if (read.quality && read.quality.length > 0) {
            const qualityPreview = this.formatQualityPreview(read.quality, 60);
            const qualityFormatted = this.formatQualityWithLineNumbers(read.quality, 1);
            
            html += `
                <div class="read-sequence-section">
                    <div class="read-sequence-header">
                        <span>Quality Scores (${read.quality.length} values)</span>
                        <div class="read-sequence-actions">
                            <button class="toggle-read-sequence-btn" onclick="window.genomeBrowser.toggleReadSequence('quality-${readName}')">
                                <i class="fas fa-expand-alt"></i> Show Full
                            </button>
                            <button class="copy-read-sequence-btn" onclick="window.genomeBrowser.copySpecificReadSequence('quality', '${readName}')">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                    </div>
                    <div class="read-sequence-content">
                        <div class="read-sequence-preview" id="quality-${readName}-preview">
                            ${qualityPreview}
                        </div>
                        <div class="read-sequence-full" id="quality-${readName}-full">
                            <div class="read-sequence-formatted">
                                ${qualityFormatted}
                            </div>
                        </div>
                    </div>
                </div>
            `;
        }
        
        // Add CIGAR string if available
        if (read.cigar && read.cigar.length > 0) {
            html += `
                <div class="read-sequence-section">
                    <div class="read-sequence-header">
                        <span>CIGAR String</span>
                        <div class="read-sequence-actions">
                            <button class="copy-read-sequence-btn" onclick="window.genomeBrowser.copySpecificReadSequence('cigar', '${readName}')">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                    </div>
                    <div class="read-sequence-content">
                        <div class="read-sequence-preview">
                            <code style="font-family: 'Courier New', monospace; font-size: 12px; word-break: break-all;">${read.cigar}</code>
                        </div>
                    </div>
                </div>
            `;
        }
        
        html += `</div>`;
        return html;
    }

    getReadAttributes(read) {
        const attributes = {};
        
        // Basic read properties
        if (read.mappingQuality != null) {
            attributes['Mapping Quality'] = read.mappingQuality;
        }
        
        if (read.flags != null) {
            attributes['SAM Flags'] = `${read.flags} (${this.interpretSamFlags(read.flags)})`;
        }
        
        if (read.templateLength != null && read.templateLength !== 0) {
            attributes['Template Length'] = read.templateLength;
        }
        
        if (read.chromosome) {
            attributes['Reference'] = read.chromosome;
        }
        
        // Add mutations if available
        if (read.mutations && read.mutations.length > 0) {
            attributes['Mutations'] = `${read.mutations.length} variants detected`;
        }
        
        // Add tags if available
        if (read.tags && Object.keys(read.tags).length > 0) {
            Object.entries(read.tags).forEach(([tag, value]) => {
                attributes[`Tag ${tag}`] = value;
            });
        }
        
        return attributes;
    }

    formatReadAttributeValue(key, value) {
        // Special formatting for certain attributes
        if (key.toLowerCase().includes('quality')) {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
                let qualityClass = 'quality-low';
                if (numValue >= 30) qualityClass = 'quality-high';
                else if (numValue >= 20) qualityClass = 'quality-medium';
                
                return `<span class="${qualityClass}" style="font-weight: 600;">${value}</span>`;
            }
        }
        
        if (key.toLowerCase().includes('flags')) {
            return `<code style="font-family: 'Courier New', monospace; font-size: 11px;">${value}</code>`;
        }
        
        return value;
    }

    interpretSamFlags(flags) {
        const flagMeanings = [];
        if (flags & 0x1) flagMeanings.push('paired');
        if (flags & 0x2) flagMeanings.push('proper_pair');
        if (flags & 0x4) flagMeanings.push('unmapped');
        if (flags & 0x8) flagMeanings.push('mate_unmapped');
        if (flags & 0x10) flagMeanings.push('reverse');
        if (flags & 0x20) flagMeanings.push('mate_reverse');
        if (flags & 0x40) flagMeanings.push('read1');
        if (flags & 0x80) flagMeanings.push('read2');
        if (flags & 0x100) flagMeanings.push('secondary');
        if (flags & 0x200) flagMeanings.push('qcfail');
        if (flags & 0x400) flagMeanings.push('duplicate');
        if (flags & 0x800) flagMeanings.push('supplementary');
        
        return flagMeanings.length > 0 ? flagMeanings.join(', ') : 'none';
    }

    formatQualityPreview(quality, maxLength = 60) {
        if (!quality || quality.length === 0) return 'No quality data';
        
        const qualityStr = typeof quality === 'string' ? quality : 
                          Array.isArray(quality) ? quality.join(' ') : String(quality);
        
        if (qualityStr.length <= maxLength) {
            return qualityStr;
        }
        
        return qualityStr.substring(0, maxLength) + '...';
    }

    formatQualityWithLineNumbers(quality, startPosition = 1) {
        if (!quality || quality.length === 0) return 'No quality data';
        
        const qualityStr = typeof quality === 'string' ? quality : 
                          Array.isArray(quality) ? quality.join(' ') : String(quality);
        
        const lines = [];
        const charsPerLine = 60;
        
        for (let i = 0; i < qualityStr.length; i += charsPerLine) {
            const lineNumber = Math.floor(i / charsPerLine) * charsPerLine + startPosition;
            const line = qualityStr.substring(i, i + charsPerLine);
            lines.push(`<span class="sequence-position">${lineNumber.toString().padStart(8, ' ')}</span>${line}`);
        }
        
        return lines.join('<br>');
    }

    setupExpandableReadSequences() {
        // This will be called after the HTML is inserted to set up event listeners
        // for expandable sequence sections in read details
    }

    /**
     * Enhance gene attribute values with clickable links for GO terms, PMIDs, and other database references
     */
    enhanceGeneAttributeWithLinks(attributeValue) {
        if (!attributeValue || typeof attributeValue !== 'string') {
            return attributeValue;
        }
        
        let enhancedValue = attributeValue;
        
        // Pattern for GO terms: GO:XXXXXXX or goid XXXXXXX
        const goTermPattern = /\b(GO:\d{7}|goid\s+(\d{7}))\b/gi;
        enhancedValue = enhancedValue.replace(goTermPattern, (match, fullMatch, goidNumber) => {
            const goId = goidNumber ? `GO:${goidNumber}` : fullMatch;
            return `<a href="https://amigo.geneontology.org/amigo/term/${goId}" target="_blank" class="go-term-link" title="View in Gene Ontology database">${goId}</a>`;
        });
        
        // Pattern for PubMed IDs: PMID:XXXXXXX or PMID XXXXXXX
        const pmidPattern = /\b(PMID:?\s*(\d+))\b/gi;
        enhancedValue = enhancedValue.replace(pmidPattern, (match, fullMatch, pmidNumber) => {
            return `<a href="https://pubmed.ncbi.nlm.nih.gov/${pmidNumber}/" target="_blank" class="pmid-link" title="View in PubMed">PMID:${pmidNumber}</a>`;
        });
        
        // Pattern for evidence codes in brackets: [evidence XXX]
        const evidencePattern = /\[evidence\s+([A-Z]{2,4})\]/gi;
        enhancedValue = enhancedValue.replace(evidencePattern, (match, evidenceCode) => {
            return `<span class="evidence-tag" title="Evidence code: ${evidenceCode}">${evidenceCode}</span>`;
        });
        
        // Pattern for database cross-references - expanded to include many more databases
        const dbXrefPattern = /\b(UniProt|SwissProt|TrEMBL|InterPro|Pfam|KEGG|COG|KO|PROSITE|SMART|SUPERFAMILY|PRINTS|PANTHER|TIGRFAM|HAMAP|PIR|PDB|RefSeq|GenBank|EMBL|DDBJ|CDD|OrthoDB|EggNOG|STRING|Reactome|BioCyc|MetaCyc|ENZYME|BRENDA|ExPASy|NCBI|ENSEMBL|FlyBase|WormBase|SGD|MGI|RGD|ZFIN|TAIR|MaizeGDB|Gramene|PlantGDB|Phytozome|JGI|DOI|PubChem|ChEBI|ChEMBL|DrugBank)[:=]\s*([A-Za-z0-9_\.-]+)\b/gi;
        enhancedValue = enhancedValue.replace(dbXrefPattern, (match, database, id) => {
            let url = '';
            let title = '';
            
            switch (database.toLowerCase()) {
                case 'uniprot':
                case 'swissprot':
                case 'trembl':
                    url = `https://www.uniprot.org/uniprot/${id}`;
                    title = 'View in UniProt';
                    break;
                case 'interpro':
                    url = `https://www.ebi.ac.uk/interpro/entry/${id}`;
                    title = 'View in InterPro';
                    break;
                case 'pfam':
                    url = `https://pfam.xfam.org/family/${id}`;
                    title = 'View in Pfam';
                    break;
                case 'kegg':
                    url = `https://www.genome.jp/kegg-bin/show_pathway?${id}`;
                    title = 'View in KEGG';
                    break;
                case 'cog':
                    url = `https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=${id}`;
                    title = 'View in COG database';
                    break;
                case 'ko':
                    url = `https://www.genome.jp/kegg-bin/show_pathway?ko${id}`;
                    title = 'View in KEGG Orthology';
                    break;
                case 'prosite':
                    url = `https://prosite.expasy.org/PS${id}`;
                    title = 'View in PROSITE';
                    break;
                case 'smart':
                    url = `http://smart.embl-heidelberg.de/smart/do_annotation.pl?DOMAIN=${id}`;
                    title = 'View in SMART';
                    break;
                case 'superfamily':
                    url = `https://supfam.org/SUPERFAMILY/cgi-bin/scop.cgi?ipid=${id}`;
                    title = 'View in SUPERFAMILY';
                    break;
                case 'prints':
                    url = `http://www.bioinf.manchester.ac.uk/cgi-bin/dbbrowser/sprint/searchprintss.cgi?prints_accn=${id}`;
                    title = 'View in PRINTS';
                    break;
                case 'panther':
                    url = `http://www.pantherdb.org/panther/family.do?clsAccession=${id}`;
                    title = 'View in PANTHER';
                    break;
                case 'tigrfam':
                    url = `https://www.jcvi.org/cgi-bin/tigrfams/HmmReportPage.cgi?acc=${id}`;
                    title = 'View in TIGRFAMs';
                    break;
                case 'hamap':
                    url = `https://hamap.expasy.org/signature/${id}`;
                    title = 'View in HAMAP';
                    break;
                case 'pir':
                    url = `https://pir.georgetown.edu/cgi-bin/ipcEntry?id=${id}`;
                    title = 'View in PIR';
                    break;
                case 'pdb':
                    url = `https://www.rcsb.org/structure/${id}`;
                    title = 'View in Protein Data Bank';
                    break;
                case 'refseq':
                    url = `https://www.ncbi.nlm.nih.gov/protein/${id}`;
                    title = 'View in RefSeq';
                    break;
                case 'genbank':
                case 'embl':
                case 'ddbj':
                    url = `https://www.ncbi.nlm.nih.gov/nuccore/${id}`;
                    title = 'View in GenBank/EMBL/DDBJ';
                    break;
                case 'cdd':
                    url = `https://www.ncbi.nlm.nih.gov/Structure/cdd/cddsrv.cgi?uid=${id}`;
                    title = 'View in Conserved Domain Database';
                    break;
                case 'orthodb':
                    url = `https://www.orthodb.org/?query=${id}`;
                    title = 'View in OrthoDB';
                    break;
                case 'eggnog':
                    url = `http://eggnog5.embl.de/#/app/results?target_nogs=${id}`;
                    title = 'View in eggNOG';
                    break;
                case 'string':
                    url = `https://string-db.org/network/${id}`;
                    title = 'View in STRING';
                    break;
                case 'reactome':
                    url = `https://reactome.org/content/detail/${id}`;
                    title = 'View in Reactome';
                    break;
                case 'biocyc':
                case 'metacyc':
                    url = `https://biocyc.org/gene?orgid=META&id=${id}`;
                    title = 'View in BioCyc/MetaCyc';
                    break;
                case 'enzyme':
                    url = `https://enzyme.expasy.org/EC/${id}`;
                    title = 'View in ENZYME';
                    break;
                case 'brenda':
                    url = `https://www.brenda-enzymes.org/enzyme.php?ecno=${id}`;
                    title = 'View in BRENDA';
                    break;
                case 'expasy':
                    url = `https://enzyme.expasy.org/EC/${id}`;
                    title = 'View in ExPASy';
                    break;
                case 'ncbi':
                    url = `https://www.ncbi.nlm.nih.gov/gene/${id}`;
                    title = 'View in NCBI Gene';
                    break;
                case 'ensembl':
                    url = `https://www.ensembl.org/id/${id}`;
                    title = 'View in Ensembl';
                    break;
                case 'flybase':
                    url = `https://flybase.org/reports/${id}`;
                    title = 'View in FlyBase';
                    break;
                case 'wormbase':
                    url = `https://wormbase.org/species/c_elegans/gene/${id}`;
                    title = 'View in WormBase';
                    break;
                case 'sgd':
                    url = `https://www.yeastgenome.org/locus/${id}`;
                    title = 'View in SGD (Yeast)';
                    break;
                case 'mgi':
                    url = `http://www.informatics.jax.org/marker/${id}`;
                    title = 'View in MGI (Mouse)';
                    break;
                case 'rgd':
                    url = `https://rgd.mcw.edu/rgdweb/report/gene/main.html?id=${id}`;
                    title = 'View in RGD (Rat)';
                    break;
                case 'zfin':
                    url = `https://zfin.org/${id}`;
                    title = 'View in ZFIN (Zebrafish)';
                    break;
                case 'tair':
                    url = `https://www.arabidopsis.org/servlets/TairObject?type=locus&name=${id}`;
                    title = 'View in TAIR (Arabidopsis)';
                    break;
                case 'maizegdb':
                    url = `https://www.maizegdb.org/gene_center/gene/${id}`;
                    title = 'View in MaizeGDB';
                    break;
                case 'gramene':
                    url = `http://www.gramene.org/genes/${id}`;
                    title = 'View in Gramene';
                    break;
                case 'plantgdb':
                    url = `http://www.plantgdb.org/cgi-bin/searchdb.cgi?input=${id}`;
                    title = 'View in PlantGDB';
                    break;
                case 'phytozome':
                    url = `https://phytozome.jgi.doe.gov/pz/portal.html#!gene?search=0&detail=0&method=5450&searchText=${id}`;
                    title = 'View in Phytozome';
                    break;
                case 'jgi':
                    url = `https://genome.jgi.doe.gov/portal/pages/dynamicOrganismDownload.jsf?organism=${id}`;
                    title = 'View in JGI';
                    break;
                case 'doi':
                    url = `https://doi.org/${id}`;
                    title = 'View DOI publication';
                    break;
                case 'pubchem':
                    url = `https://pubchem.ncbi.nlm.nih.gov/compound/${id}`;
                    title = 'View in PubChem';
                    break;
                case 'chebi':
                    url = `https://www.ebi.ac.uk/chebi/searchId.do?chebiId=${id}`;
                    title = 'View in ChEBI';
                    break;
                case 'chembl':
                    url = `https://www.ebi.ac.uk/chembl/compound_report_card/${id}`;
                    title = 'View in ChEMBL';
                    break;
                case 'drugbank':
                    url = `https://go.drugbank.com/drugs/${id}`;
                    title = 'View in DrugBank';
                    break;
            }
            
            if (url) {
                return `<a href="${url}" target="_blank" class="db-xref-link" title="${title}">${database}:${id}</a>`;
            }
            return match;
        });
        
        // Pattern for EC numbers: EC:X.X.X.X or EC X.X.X.X
        const ecPattern = /\b(EC:?\s*([\d\.-]+))\b/gi;
        enhancedValue = enhancedValue.replace(ecPattern, (match, fullMatch, ecNumber) => {
            return `<a href="https://enzyme.expasy.org/EC/${ecNumber}" target="_blank" class="db-xref-link" title="View in ENZYME database">EC:${ecNumber}</a>`;
        });

        // Pattern for standalone EC numbers: X.X.X.X (without EC: prefix)
        const standaloneEcPattern = /\b(\d{1,2}\.\d{1,3}\.\d{1,3}\.\d{1,3})\b/gi;
        enhancedValue = enhancedValue.replace(standaloneEcPattern, (match) => {
            // Don't replace if it's already part of an EC: link or other context
            if (enhancedValue.includes(`EC:${match}`) || enhancedValue.includes(`>${match}<`)) {
                return match;
            }
            return `<a href="https://enzyme.expasy.org/EC/${match}" target="_blank" class="db-xref-link" title="View in ENZYME database">${match}</a>`;
        });

        // Pattern for CITS format: [PMID1 PMID2][PMID3] -> superscript numbered links
        const citsPattern = /CITS:\s*(\[[\d\s]+\])+/gi;
        enhancedValue = enhancedValue.replace(citsPattern, (match) => {
            // Extract all PMID numbers from the brackets
            const pmidMatches = match.match(/\[[\d\s]+\]/g);
            if (!pmidMatches) return match;
            
            // Collect all unique PMIDs and sort them
            const allPmids = [];
            pmidMatches.forEach(bracket => {
                const pmids = bracket.replace(/[\[\]]/g, '').split(/\s+/).filter(p => p.trim());
                allPmids.push(...pmids);
            });
            
            // Create unique sorted list
            const uniquePmids = [...new Set(allPmids)].sort((a, b) => parseInt(a) - parseInt(b));
            
            // Create numbered superscript links
            let result = 'CITS: ';
            uniquePmids.forEach((pmid, index) => {
                if (index > 0) result += ', ';
                result += `<a href="https://pubmed.ncbi.nlm.nih.gov/${pmid}" target="_blank" class="pmid-link" title="View PubMed article ${pmid}"><sup>${index + 1}</sup></a>`;
            });
            
            return result;
        });

        // Pattern for GenBank/RefSeq accessions: Various formats
        const accessionPattern = /\b([A-Z]{1,2}_?[0-9]{6,9}(\.[0-9]+)?|[A-Z]{2}[0-9]{6}(\.[0-9]+)?|[A-Z]{4}[0-9]{8}(\.[0-9]+)?|NC_[0-9]{6}(\.[0-9]+)?|NP_[0-9]{6}(\.[0-9]+)?|XP_[0-9]{6}(\.[0-9]+)?|YP_[0-9]{6}(\.[0-9]+)?|WP_[0-9]{6}(\.[0-9]+)?)\b/gi;
        enhancedValue = enhancedValue.replace(accessionPattern, (match) => {
            let url = '';
            let title = '';
            
            if (match.match(/^(NC_|NP_|XP_|YP_|WP_|[A-Z]{1,2}_)/)) {
                // RefSeq accessions
                if (match.startsWith('NP_') || match.startsWith('XP_') || match.startsWith('YP_') || match.startsWith('WP_')) {
                    url = `https://www.ncbi.nlm.nih.gov/protein/${match}`;
                    title = 'View protein in NCBI';
                } else {
                    url = `https://www.ncbi.nlm.nih.gov/nuccore/${match}`;
                    title = 'View nucleotide in NCBI';
                }
            } else {
                // GenBank accessions
                url = `https://www.ncbi.nlm.nih.gov/nuccore/${match}`;
                title = 'View in GenBank';
            }
            
            return `<a href="${url}" target="_blank" class="db-xref-link" title="${title}">${match}</a>`;
        });

        // Pattern for Taxonomy IDs: taxon:12345 or NCBI:txid12345
        const taxonPattern = /\b(taxon:(\d+)|NCBI:txid(\d+))\b/gi;
        enhancedValue = enhancedValue.replace(taxonPattern, (match, fullMatch, taxonId1, taxonId2) => {
            const taxId = taxonId1 || taxonId2;
            return `<a href="https://www.ncbi.nlm.nih.gov/Taxonomy/Browser/wwwtax.cgi?id=${taxId}" target="_blank" class="db-xref-link" title="View in NCBI Taxonomy">${match}</a>`;
        });

        // Pattern for Gene IDs: GeneID:12345
        const geneIdPattern = /\bGeneID:(\d+)\b/gi;
        enhancedValue = enhancedValue.replace(geneIdPattern, (match, geneId) => {
            return `<a href="https://www.ncbi.nlm.nih.gov/gene/${geneId}" target="_blank" class="db-xref-link" title="View in NCBI Gene">GeneID:${geneId}</a>`;
        });

        // Pattern for OMIM IDs: OMIM:123456
        const omimPattern = /\bOMIM:(\d+)\b/gi;
        enhancedValue = enhancedValue.replace(omimPattern, (match, omimId) => {
            return `<a href="https://omim.org/entry/${omimId}" target="_blank" class="db-xref-link" title="View in OMIM">${match}</a>`;
        });

        // Pattern for dbSNP IDs: rs123456789
        const dbsnpPattern = /\brs(\d+)\b/gi;
        enhancedValue = enhancedValue.replace(dbsnpPattern, (match, snpId) => {
            return `<a href="https://www.ncbi.nlm.nih.gov/snp/rs${snpId}" target="_blank" class="db-xref-link" title="View in dbSNP">${match}</a>`;
        });

        // Pattern for Protein IDs: protein_id="XXX"
        const proteinIdPattern = /protein_id="([A-Z]{2,3}[0-9]{5,9}(\.[0-9]+)?)"/gi;
        enhancedValue = enhancedValue.replace(proteinIdPattern, (match, proteinId) => {
            return `protein_id="<a href="https://www.ncbi.nlm.nih.gov/protein/${proteinId}" target="_blank" class="db-xref-link" title="View protein in NCBI">${proteinId}</a>"`;
        });

        // Pattern for locus_tag: locus_tag="XXX"
        const locusTagPattern = /locus_tag="([^"]+)"/gi;
        enhancedValue = enhancedValue.replace(locusTagPattern, (match, locusTag) => {
            return `locus_tag="<a href="https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(locusTag)}" target="_blank" class="db-xref-link" title="Search locus tag in NCBI">${locusTag}</a>"`;
        });

        // Pattern for Gene Symbols: gene="XXX"
        const geneSymbolPattern = /gene="([^"]+)"/gi;
        enhancedValue = enhancedValue.replace(geneSymbolPattern, (match, geneSymbol) => {
            return `gene="<a href="https://www.ncbi.nlm.nih.gov/gene/?term=${encodeURIComponent(geneSymbol)}" target="_blank" class="db-xref-link" title="Search gene symbol in NCBI">${geneSymbol}</a>"`;
        });

        // Pattern for ORCID IDs: 0000-0000-0000-0000
        const orcidPattern = /\b(\d{4}-\d{4}-\d{4}-\d{3}[0-9X])\b/gi;
        enhancedValue = enhancedValue.replace(orcidPattern, (match) => {
            return `<a href="https://orcid.org/${match}" target="_blank" class="db-xref-link" title="View ORCID profile">${match}</a>`;
        });

        // Pattern for ArXiv IDs: arXiv:1234.5678
        const arxivPattern = /\barXiv:(\d{4}\.\d{4,5}(v\d+)?)\b/gi;
        enhancedValue = enhancedValue.replace(arxivPattern, (match, arxivId) => {
            return `<a href="https://arxiv.org/abs/${arxivId}" target="_blank" class="pmid-link" title="View on ArXiv">${match}</a>`;
        });

        // Pattern for bioRxiv DOIs: bioRxiv preprint
        const biorxivPattern = /\bbioRxiv[:\s]+(\d{4}\.\d{2}\.\d{2}\.\d+)\b/gi;
        enhancedValue = enhancedValue.replace(biorxivPattern, (match, biorxivId) => {
            return `<a href="https://www.biorxiv.org/content/10.1101/${biorxivId}" target="_blank" class="pmid-link" title="View bioRxiv preprint">bioRxiv:${biorxivId}</a>`;
        });

        // Pattern for ISBN: ISBN-13 or ISBN-10
        const isbnPattern = /\bISBN[:\s-]*(97[89][\d\s-]{10,17}|\d[\d\s-]{8,13}[0-9X])\b/gi;
        enhancedValue = enhancedValue.replace(isbnPattern, (match) => {
            const cleanIsbn = match.replace(/[^\d]/g, '');
            return `<a href="https://www.worldcat.org/isbn/${cleanIsbn}" target="_blank" class="pmid-link" title="Search book in WorldCat">${match}</a>`;
        });

        // Pattern for generic numeric PMID references in brackets: [1234567]
        const genericPmidPattern = /\[(\d{7,8})\]/g;
        enhancedValue = enhancedValue.replace(genericPmidPattern, (match, pmidId) => {
            // Skip if it's already part of a CITS: pattern or other enhanced content
            if (enhancedValue.includes(`href="https://pubmed.ncbi.nlm.nih.gov/${pmidId}"`)) {
                return match;
            }
            return `<a href="https://pubmed.ncbi.nlm.nih.gov/${pmidId}" target="_blank" class="pmid-link" title="View PubMed article ${pmidId}">[${pmidId}]</a>`;
        });

        // Pattern for DOI references: doi:10.xxxx/xxxx or DOI:10.xxxx/xxxx
        const doiPattern = /\b(DOI|doi):\s*(10\.\d{4,}\/[^\s]+)/gi;
        enhancedValue = enhancedValue.replace(doiPattern, (match, prefix, doiId) => {
            return `<a href="https://doi.org/${doiId}" target="_blank" class="pmid-link" title="View DOI publication">${prefix}:${doiId}</a>`;
        });

        // Pattern for enzyme class numbers: EC N.N.N.-
        const ecClassPattern = /\bEC\s+(\d{1,2}\.\d{1,3}\.\d{1,3}\.-)(?!\d)/gi;
        enhancedValue = enhancedValue.replace(ecClassPattern, (match, ecClass) => {
            return `<a href="https://enzyme.expasy.org/EC/${ecClass}" target="_blank" class="db-xref-link" title="View EC class in ENZYME database">EC ${ecClass}</a>`;
        });

        // Pattern for literature references with "et al." format: Author et al. (YYYY)
        const authorYearPattern = /\b([A-Z][a-z]+(?: [A-Z][a-z]+)?)\s+et\s+al\.\s*\((\d{4})\)/gi;
        enhancedValue = enhancedValue.replace(authorYearPattern, (match, author, year) => {
            const searchQuery = encodeURIComponent(`${author} ${year}`);
            return `<a href="https://pubmed.ncbi.nlm.nih.gov/?term=${searchQuery}" target="_blank" class="pmid-link" title="Search in PubMed">${match}</a>`;
        });

        return enhancedValue;
    }
    
    /**
     * Create sequences section with CDS and translation
     */
    createSequencesSection(gene, fullSequence, geneName, chromosome) {
       // let html = `<div class="gene-sequences">`;
       let html = '';
        
        // Get DNA sequence
      //  const dnaSequence = fullSequence.substring(gene.start - 1, gene.end);
       // const dnaLength = dnaSequence.length;
        
        // DNA Sequence section
      
        /*
        
        // CDS and Translation sections if applicable
        if (gene.type === 'CDS' || (gene.qualifiers && gene.qualifiers.translation)) {
            // For CDS features, the DNA sequence is the CDS
            const cdsSequence = dnaSequence;
            const translation = gene.qualifiers?.translation || this.translateDNA(cdsSequence, gene.strand);
            
            // CDS Sequence section
            html += `
                <div class="sequence-section">
                    <h4><i class="fas fa-code"></i> CDS Sequence (${cdsSequence.length} bp)</h4>
                    <div class="sequence-content">
                        <div class="sequence-display" data-sequence-type="cds">
                            <div class="sequence-preview">${this.formatSequencePreview(cdsSequence, 60)}</div>
                            <div class="sequence-full" style="display: none;">
                                <div class="sequence-formatted">${this.formatSequenceWithLineNumbers(cdsSequence, gene.start)}</div>
                            </div>
                        </div>
                        <div class="sequence-actions">
                            <button class="btn btn-sm toggle-sequence-btn" data-target="cds">
                                <i class="fas fa-expand"></i> Show Full Sequence
                            </button>
                            <button class="btn btn-sm copy-sequence-btn" data-sequence-type="cds" data-gene-name="${geneName}" data-chr="${chromosome}" data-start="${gene.start}" data-end="${gene.end}" data-strand="${gene.strand}">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                    </div>
                </div>
            `;
            
            */
           // Translation section
           // const translationLength = translation.replace(/\*/g, '').length; // Remove stop codons for length count
            /*
            html += `
                <div class="sequence-section">
                    <h4><i class="fas fa-atom"></i> Protein Translation (${translationLength} aa)</h4>
                    <div class="sequence-content">
                        <div class="sequence-display" data-sequence-type="translation">
                            <div class="sequence-preview">${this.formatProteinPreview(translation, 40)}</div>
                            <div class="sequence-full" style="display: none;">
                                <div class="sequence-formatted">${this.formatProteinWithLineNumbers(translation)}</div>
                            </div>
                        </div>
                        <div class="sequence-actions">
                            <button class="btn btn-sm toggle-sequence-btn" data-target="translation">
                                <i class="fas fa-expand"></i> Show Full Sequence
                            </button>
                            <button class="btn btn-sm copy-sequence-btn" data-sequence-type="translation" data-gene-name="${geneName}" data-chr="${chromosome}" data-start="${gene.start}" data-end="${gene.end}" data-strand="${gene.strand}">
                                <i class="fas fa-copy"></i> Copy
                            </button>
                        </div>
                    </div>
                </div>
            `;
        }
        */
        
       // html += `</div>`;
        
        return html;
    }
    
    /**
     * Format sequence preview (first N characters with ellipsis)
     */
    formatSequencePreview(sequence, maxLength = 60) {
        if (sequence.length <= maxLength) {
            return `<span class="sequence-text">${sequence}</span>`;
        }
        return `<span class="sequence-text">${sequence.substring(0, maxLength)}<span class="sequence-ellipsis">...</span></span>`;
    }
    
    /**
     * Format protein preview with colored amino acids
     */
    formatProteinPreview(sequence, maxLength = 40) {
        const preview = sequence.length <= maxLength ? sequence : sequence.substring(0, maxLength);
        let formatted = '';
        for (let i = 0; i < preview.length; i++) {
            const aa = preview[i];
            formatted += `<span class="amino-acid">${aa}</span>`;
        }
        if (sequence.length > maxLength) {
            formatted += '<span class="sequence-ellipsis">...</span>';
        }
        return `<span class="sequence-text">${formatted}</span>`;
    }
    
    /**
     * Format sequence with line numbers for full display
     */
    formatSequenceWithLineNumbers(sequence, startPosition = 1) {
        const lineLength = 60;
        let formatted = '';
        
        for (let i = 0; i < sequence.length; i += lineLength) {
            const lineNumber = startPosition + i;
            const lineSequence = sequence.substring(i, i + lineLength);
            formatted += `
                <div class="sequence-line">
                    <span class="sequence-position">${lineNumber.toLocaleString()}</span>
                    <span class="sequence-bases">${this.colorizeSequenceBases(lineSequence)}</span>
                </div>
            `;
        }
        
        return formatted;
    }
    
    /**
     * Format protein with line numbers
     */
    formatProteinWithLineNumbers(sequence) {
        const lineLength = 50;
        let formatted = '';
        
        for (let i = 0; i < sequence.length; i += lineLength) {
            const lineNumber = i + 1;
            const lineSequence = sequence.substring(i, i + lineLength);
            let colorizedSeq = '';
            for (let j = 0; j < lineSequence.length; j++) {
                const aa = lineSequence[j];
                colorizedSeq += `<span class="amino-acid">${aa}</span>`;
            }
            
            formatted += `
                <div class="sequence-line">
                    <span class="sequence-position">${lineNumber}</span>
                    <span class="sequence-bases">${colorizedSeq}</span>
                </div>
            `;
        }
        
        return formatted;
    }
    
    /**
     * Colorize DNA sequence bases
     */
    colorizeSequenceBases(sequence) {
        let colorized = '';
        for (let i = 0; i < sequence.length; i++) {
            const base = sequence[i].toLowerCase();
            colorized += `<span class="base-${base}">${sequence[i]}</span>`;
        }
        return colorized;
    }
    
    /**
     * Setup expandable sequences functionality
     */
    setupExpandableSequences() {
        // Toggle sequence display
        document.querySelectorAll('.toggle-sequence-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.target.closest('.toggle-sequence-btn').dataset.target;
                const sequenceDisplay = document.querySelector(`[data-sequence-type="${target}"]`);
                const preview = sequenceDisplay.querySelector('.sequence-preview');
                const full = sequenceDisplay.querySelector('.sequence-full');
                const icon = e.target.closest('.toggle-sequence-btn').querySelector('i');
                const text = e.target.closest('.toggle-sequence-btn');
                
                if (full.style.display === 'none') {
                    preview.style.display = 'none';
                    full.style.display = 'block';
                    icon.className = 'fas fa-compress';
                    text.innerHTML = '<i class="fas fa-compress"></i> Show Preview';
                } else {
                    preview.style.display = 'block';
                    full.style.display = 'none';
                    icon.className = 'fas fa-expand';
                    text.innerHTML = '<i class="fas fa-expand"></i> Show Full Sequence';
                }
            });
        });
        
        // Copy individual sequences
        document.querySelectorAll('.copy-sequence-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const button = e.target.closest('.copy-sequence-btn');
                const type = button.dataset.sequenceType;
                const geneName = button.dataset.geneName;
                const chr = button.dataset.chr;
                const start = button.dataset.start;
                const end = button.dataset.end;
                const strand = button.dataset.strand;
                
                this.copySpecificSequence(type, geneName, chr, start, end, strand);
            });
        });
    }
    
    /**
     * Copy specific sequence type
     */
    copySpecificSequence(type, geneName, chromosome, start, end, strand) {
        if (!this.currentSequence || !this.currentSequence[chromosome]) {
            const errorMessage = 'No sequence available to copy';
            if (this.uiManager) {
                this.uiManager.updateStatus(errorMessage);
            } else {
                const statusElement = document.getElementById('statusText');
                if (statusElement) {
                    statusElement.textContent = errorMessage;
                }
            }
            return;
        }
        
        const fullSequence = this.currentSequence[chromosome];
        let sequence, header, description;
        
        switch (type) {
            case 'dna':
            case 'cds':
                sequence = fullSequence.substring(start - 1, end);
                if (strand === '-1') {
                    sequence = this.sequenceUtils.getReverseComplement(sequence);
                }
                header = `>${geneName}_${type.toUpperCase()} ${chromosome}:${start}-${end} (${strand === '-1' ? '-' : '+'} strand)`;
                description = `${type.toUpperCase()} sequence`;
                break;
                
            case 'translation':
                const dnaSeq = fullSequence.substring(start - 1, end);
                let rawTranslation = this.translateDNA(dnaSeq, parseInt(strand));
                sequence = rawTranslation.replace(/\*/g, ''); // Remove stop codons
                header = `>${geneName}_TRANSLATION ${chromosome}:${start}-${end} (${strand === '-1' ? '-' : '+'} strand)`;
                description = 'protein translation';
                break;
                
            default:
                alert('Unknown sequence type');
                return;
        }
        
        const fastaContent = `${header}\n${sequence}`;
        
        navigator.clipboard.writeText(fastaContent).then(() => {
            // Choose appropriate icon and color based on sequence type
            let icon, color;
            switch (type) {
                case 'translation':
                    icon = '🧬';
                    color = '#2196F3';
                    break;
                case 'dna':
                case 'cds':
                    icon = '✅';
                    color = '#4CAF50';
                    break;
                default:
                    icon = '📋';
                    color = '#4CAF50';
            }
            
            const successMessage = `${icon} Copied ${geneName} ${description} (${sequence.length} ${type === 'translation' ? 'aa' : 'bp'}) to clipboard`;
            if (this.uiManager) {
                this.uiManager.updateStatus(successMessage, { 
                    highlight: true, 
                    color: color, 
                    duration: 4000 
                });
            } else {
                const statusElement = document.getElementById('statusText');
                if (statusElement) {
                    statusElement.textContent = successMessage;
                    statusElement.style.color = color;
                    statusElement.style.fontWeight = 'bold';
                    setTimeout(() => {
                        statusElement.style.color = '';
                        statusElement.style.fontWeight = '';
                    }, 4000);
                }
            }
        }).catch(err => {
            console.error('Failed to copy: ', err);
            const errorMessage = '❌ Failed to copy to clipboard';
            if (this.uiManager) {
                this.uiManager.updateStatus(errorMessage, { 
                    highlight: true, 
                    color: '#f44336', 
                    duration: 4000 
                });
            } else {
                const statusElement = document.getElementById('statusText');
                if (statusElement) {
                    statusElement.textContent = errorMessage;
                }
            }
        });
    }
    
    /**
     * Copy gene translation (main button functionality)
     */
    copyGeneTranslation() {
        if (!this.selectedGene) return;
        
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.currentSequence || !this.currentSequence[currentChr]) {
            const errorMessage = 'No sequence available to copy';
            if (this.uiManager) {
                this.uiManager.updateStatus(errorMessage);
            } else {
                const statusElement = document.getElementById('statusText');
                if (statusElement) {
                    statusElement.textContent = errorMessage;
                }
            }
            return;
        }
        
        const gene = this.selectedGene.gene;
        let translation;
        
        // Always translate from DNA to ensure we get the complete sequence
        // The gene.qualifiers.translation might be truncated during GenBank parsing for memory efficiency
        const sequence = this.currentSequence[currentChr];
        const geneSequence = sequence.substring(gene.start - 1, gene.end);
        translation = this.translateDNA(geneSequence, gene.strand);
        
        // Remove stop codons (*) from the translation
        const cleanTranslation = translation.replace(/\*/g, '');
        
        const geneName = gene.qualifiers?.gene || gene.qualifiers?.locus_tag || gene.type;
        const fastaHeader = `>${geneName}_TRANSLATION ${currentChr}:${gene.start}-${gene.end} (${gene.strand === -1 ? '-' : '+'} strand)`;
        const fastaContent = `${fastaHeader}\n${cleanTranslation}`;
        
        navigator.clipboard.writeText(fastaContent).then(() => {
            const successMessage = `🧬 Copied ${geneName} translation (${cleanTranslation.length} aa) to clipboard`;
            if (this.uiManager) {
                this.uiManager.updateStatus(successMessage, { 
                    highlight: true, 
                    color: '#2196F3', 
                    duration: 4000 
                });
            } else {
                const statusElement = document.getElementById('statusText');
                if (statusElement) {
                    statusElement.textContent = successMessage;
                    statusElement.style.color = '#2196F3';
                    statusElement.style.fontWeight = 'bold';
                    setTimeout(() => {
                        statusElement.style.color = '';
                        statusElement.style.fontWeight = '';
                    }, 4000);
                }
            }
        }).catch(err => {
            console.error('Failed to copy: ', err);
            const errorMessage = '❌ Failed to copy translation to clipboard';
            if (this.uiManager) {
                this.uiManager.updateStatus(errorMessage, { 
                    highlight: true, 
                    color: '#f44336', 
                    duration: 4000 
                });
            } else {
                const statusElement = document.getElementById('statusText');
                if (statusElement) {
                    statusElement.textContent = errorMessage;
                }
            }
        });
    }

    highlightGeneSequence(gene) {
        // Clear previous highlights and selections
        this.clearSequenceHighlights();
        this.clearSequenceSelection();
        
        // Only highlight if the gene is within the current view
        const currentStart = this.currentPosition.start;
        const currentEnd = this.currentPosition.end;
        
        if (gene.end < currentStart || gene.start > currentEnd) {
            console.log('Gene is outside current view, skipping sequence highlight');
            return;
        }
        
        // Set the sequence selection to the gene region
        const currentChr = document.getElementById('chromosomeSelect').value;
        this.sequenceSelection = {
            start: gene.start,
            end: gene.end,
            active: true,
            chromosome: currentChr,
            source: 'gene', // Mark that this selection came from a gene click
            geneName: gene.qualifiers?.gene || gene.qualifiers?.locus_tag || gene.type
        };
        
        // Find sequence bases within the gene range and mark them as selected
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
                baseElement.classList.add('sequence-selected');
                baseElement.classList.add('gene-sequence-selected');
            }
        });
        
        // Update copy button text to indicate gene sequence is selected
        this.updateCopyButtonState();
        
        // Update status bar with gene selection information
        const selectionLength = gene.end - gene.start + 1;
        const geneName = this.sequenceSelection.geneName;
        const statusMessage = `🔵 Gene Selection: ${geneName} (${gene.start.toLocaleString()}-${gene.end.toLocaleString()}, ${selectionLength.toLocaleString()} bp)`;
        
        if (this.uiManager) {
            this.uiManager.updateStatus(statusMessage);
        } else {
            const statusElement = document.getElementById('statusText');
            if (statusElement) {
                statusElement.textContent = statusMessage;
                statusElement.style.color = '#3b82f6';
                statusElement.style.fontWeight = 'bold';
                
                // Reset to normal after 5 seconds
                setTimeout(() => {
                    statusElement.style.color = '';
                    statusElement.style.fontWeight = '';
                    statusElement.textContent = 'Ready';
                }, 5000);
            }
        }
        
        console.log(`Selected gene sequence for ${this.sequenceSelection.geneName} (${gene.start}-${gene.end})`);
    }
    
    updateCopyButtonState() {
        const copyBtn = document.getElementById('copySequenceBtn');
        if (!copyBtn) return;
        
        // Check if there's any active selection (gene or manual)
        const hasGeneSelection = this.sequenceSelection && this.sequenceSelection.active && this.sequenceSelection.source === 'gene';
        const hasManualSelection = this.currentSequenceSelection !== null;
        const hasTextSelection = window.getSelection() && window.getSelection().toString().length > 0;
        const hasVisualSelection = document.querySelectorAll('.gene-sequence-selected').length > 0;
        
        if (hasGeneSelection) {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            copyBtn.title = `Copy ${this.sequenceSelection.geneName} sequence`;
            copyBtn.classList.add('gene-copy-active');
        } else if (hasManualSelection || hasTextSelection || hasVisualSelection) {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            copyBtn.title = 'Copy selected sequence';
            copyBtn.classList.add('gene-copy-active');
        } else {
            copyBtn.innerHTML = '<i class="fas fa-copy"></i> Copy';
            copyBtn.title = 'Copy sequence';
            copyBtn.classList.remove('gene-copy-active');
        }
    }
    
    showSelectionFeedback() {
        if (this.sequenceSelection && this.sequenceSelection.active && this.sequenceSelection.source === 'gene') {
            // Show a brief tooltip or notification
            const message = `${this.sequenceSelection.geneName} sequence is selected. Click "Copy" button to copy.`;
            this.showNotification(message, 'info');
        }
    }

    clearSequenceHighlights() {
        const highlightedBases = document.querySelectorAll('.sequence-selected, .gene-sequence-selected');
        highlightedBases.forEach(el => {
            el.classList.remove('sequence-selected');
            el.classList.remove('gene-sequence-selected');
        });
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
            
            // Update current tab title with new position
            if (this.tabManager) {
                this.tabManager.updateCurrentTabPosition(currentChr, newStart + 1, newEnd);
            }
        }
    }

    copyGeneSequence() {
        if (!this.selectedGene) return;
        
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (!currentChr || !this.currentSequence || !this.currentSequence[currentChr]) {
            const errorMessage = 'No sequence available to copy';
            if (this.uiManager) {
                this.uiManager.updateStatus(errorMessage);
            } else {
                const statusElement = document.getElementById('statusText');
                if (statusElement) {
                    statusElement.textContent = errorMessage;
                }
            }
            return;
        }
        
        const gene = this.selectedGene.gene;
        const sequence = this.currentSequence[currentChr];
        const geneSequence = sequence.substring(gene.start - 1, gene.end); // Convert to 0-based indexing
        
        const geneName = gene.qualifiers?.gene || gene.qualifiers?.locus_tag || gene.type;
        const fastaHeader = `>${geneName} ${currentChr}:${gene.start}-${gene.end} (${gene.strand === -1 ? '-' : '+'} strand)`;
        const fastaContent = `${fastaHeader}\n${geneSequence}`;
        
        navigator.clipboard.writeText(fastaContent).then(() => {
            const successMessage = `✅ Copied ${geneName} sequence (${geneSequence.length} bp) to clipboard`;
            if (this.uiManager) {
                this.uiManager.updateStatus(successMessage, { 
                    highlight: true, 
                    color: '#4CAF50', 
                    duration: 4000 
                });
            } else {
                const statusElement = document.getElementById('statusText');
                if (statusElement) {
                    statusElement.textContent = successMessage;
                    statusElement.style.color = '#4CAF50';
                    statusElement.style.fontWeight = 'bold';
                    setTimeout(() => {
                        statusElement.style.color = '';
                        statusElement.style.fontWeight = '';
                    }, 4000);
                }
            }
        }).catch(err => {
            console.error('Failed to copy: ', err);
            const errorMessage = '❌ Failed to copy to clipboard';
            if (this.uiManager) {
                this.uiManager.updateStatus(errorMessage, { 
                    highlight: true, 
                    color: '#f44336', 
                    duration: 4000 
                });
            } else {
                const statusElement = document.getElementById('statusText');
                if (statusElement) {
                    statusElement.textContent = errorMessage;
                }
            }
        });
    }

    // Search PDB experimental structures for the selected gene
    searchPDBStructures(geneName) {
        if (!this.chatManager) {
            console.error('ChatManager not available for PDB structure search');
            return;
        }

        if (!geneName) {
            console.warn('No gene name provided for PDB structure search');
            return;
        }

        // Get current organism/species information
        const organism = this.getCurrentOrganismInfo();
        
        // Create a specific PDB search message
        const searchMessage = `Search PDB experimental structures for gene ${geneName} from ${organism}. Please find experimentally determined protein structures in the Protein Data Bank (PDB) for this protein, including X-ray crystallography, NMR, and cryo-EM structures.`;
        
        // Send the search message to the chat manager
        this.chatManager.sendMessageProgrammatically(searchMessage);
        
        // Optionally show the chat box if it's hidden
        this.showChatIfHidden();
        
        // Update status
        if (this.uiManager) {
            this.uiManager.updateStatus(`Searching PDB structures for ${geneName} in ${organism}...`);
        }
    }

    // Search AlphaFold predicted structures for the selected gene
    searchAlphaFoldStructures(geneName) {
        if (!this.chatManager) {
            console.error('ChatManager not available for AlphaFold structure search');
            return;
        }

        if (!geneName) {
            console.warn('No gene name provided for AlphaFold structure search');
            return;
        }

        // Get current organism/species information
        const organism = this.getCurrentOrganismInfo();
        
        // Create a specific AlphaFold search message
        const searchMessage = `Search AlphaFold predicted structures for gene ${geneName} from ${organism}. Please find AI-predicted protein structures from the AlphaFold database for this protein, including confidence scores and structural predictions.`;
        
        // Send the search message to the chat manager
        this.chatManager.sendMessageProgrammatically(searchMessage);
        
        // Optionally show the chat box if it's hidden
        this.showChatIfHidden();
        
        // Update status
        if (this.uiManager) {
            this.uiManager.updateStatus(`Searching AlphaFold structures for ${geneName} in ${organism}...`);
        }
    }

    // Legacy method for backward compatibility - now searches both
    searchProteinStructures(geneName) {
        if (!this.chatManager) {
            console.error('ChatManager not available for protein structure search');
            return;
        }

        if (!geneName) {
            console.warn('No gene name provided for structure search');
            return;
        }

        // Get current organism/species information
        const organism = this.getCurrentOrganismInfo();
        
        // Create a comprehensive search message that will trigger both PDB and AlphaFold searches
        const searchMessage = `Search protein structures for gene ${geneName} in ${organism}. Please search both PDB experimental structures and AlphaFold predictions for this protein.`;
        
        // Send the search message to the chat manager
        this.chatManager.sendMessageProgrammatically(searchMessage);
        
        // Optionally show the chat box if it's hidden
        this.showChatIfHidden();
        
        // Update status
        if (this.uiManager) {
            this.uiManager.updateStatus(`Searching protein structures for ${geneName}...`);
        }
    }

    // Helper method to show chat if hidden
    showChatIfHidden() {
        const chatBox = document.querySelector('.chat-container');
        if (chatBox && !chatBox.classList.contains('visible')) {
            const toggleChatBtn = document.getElementById('toggleChatBtn');
            if (toggleChatBtn) {
                toggleChatBtn.click();
            }
        }
    }

    // Standardize organism name by removing strain, serovar, and other subspecific information
    standardizeOrganismName(organismName) {
        if (!organismName || typeof organismName !== 'string') {
            return 'Unknown organism';
        }

        // Common patterns to remove (strain, serovar, subspecies, etc.)
        const cleaningPatterns = [
            // Strain patterns
            /\s+str\.\s+\S+/gi,           // str. K-12
            /\s+strain\s+\S+/gi,         // strain K-12
            /\s+K-12\s*\S*/gi,           // K-12 MG1655
            /\s+MG1655/gi,               // MG1655
            /\s+W3110/gi,                // W3110
            /\s+DH5α/gi,                 // DH5α
            /\s+BL21/gi,                 // BL21
            
            // Serovar patterns
            /\s+serovar\s+\S+/gi,        // serovar Typhimurium
            /\s+sv\.\s+\S+/gi,           // sv. Typhimurium
            
            // Subspecies patterns
            /\s+subsp\.\s+\S+/gi,        // subsp. enterica
            /\s+subspecies\s+\S+/gi,     // subspecies enterica
            
            // Other common patterns
            /\s+ATCC\s+\d+/gi,           // ATCC numbers
            /\s+DSM\s+\d+/gi,            // DSM numbers
            /\s+NCTC\s+\d+/gi,           // NCTC numbers
            /\s+\([^)]*\)/g,             // Content in parentheses
            /\s+var\.\s+\S+/gi,          // var. variant
            /\s+f\.\s+sp\.\s+\S+/gi,     // f. sp. formae speciales
            
            // Plasmid and specific identifiers
            /\s+plasmid\s+\S+/gi,        // plasmid names
            /\s+chromosome\s+\S+/gi,     // chromosome identifiers
            
            // Generic patterns for numbered strains
            /\s+[A-Z]+\d+[A-Z]*\d*/gi,  // ABC123, K12, etc.
            /\s+\d+[A-Z]+\d*/gi,        // 123ABC, etc.
        ];

        let cleanName = organismName;
        
        // Apply all cleaning patterns
        for (const pattern of cleaningPatterns) {
            cleanName = cleanName.replace(pattern, '');
        }
        
        // Remove extra whitespace and clean up
        cleanName = cleanName.replace(/\s+/g, ' ').trim();
        
        // Handle specific known mappings
        const specificMappings = {
            'Escherichia coli': 'Escherichia coli',
            'E. coli': 'Escherichia coli',
            'Salmonella enterica': 'Salmonella enterica',
            'S. enterica': 'Salmonella enterica',
            'Bacillus subtilis': 'Bacillus subtilis',
            'B. subtilis': 'Bacillus subtilis',
            'Staphylococcus aureus': 'Staphylococcus aureus',
            'S. aureus': 'Staphylococcus aureus',
            'Pseudomonas aeruginosa': 'Pseudomonas aeruginosa',
            'P. aeruginosa': 'Pseudomonas aeruginosa',
            'Saccharomyces cerevisiae': 'Saccharomyces cerevisiae',
            'S. cerevisiae': 'Saccharomyces cerevisiae',
            'Homo sapiens': 'Homo sapiens',
            'H. sapiens': 'Homo sapiens',
            'Mus musculus': 'Mus musculus',
            'M. musculus': 'Mus musculus',
            'Arabidopsis thaliana': 'Arabidopsis thaliana',
            'A. thaliana': 'Arabidopsis thaliana'
        };
        
        // Check for specific mappings first
        for (const [key, value] of Object.entries(specificMappings)) {
            if (cleanName.toLowerCase().includes(key.toLowerCase())) {
                return value;
            }
        }
        
        // If we have a valid genus species format, return it
        const genusSpeciesMatch = cleanName.match(/^([A-Z][a-z]+)\s+([a-z]+)/);
        if (genusSpeciesMatch) {
            return `${genusSpeciesMatch[1]} ${genusSpeciesMatch[2]}`;
        }
        
        // Return cleaned name or fallback
        return cleanName || 'Unknown organism';
    }

    // Get current organism information for structure searches
    getCurrentOrganismInfo() {
        // Try to get organism from loaded file metadata
        if (this.fileManager && this.fileManager.currentFileInfo) {
            const fileInfo = this.fileManager.currentFileInfo;
            
            // Check GenBank ORGANISM field
            if (fileInfo.organism) {
                return this.standardizeOrganismName(fileInfo.organism);
            }
            
            // Check other common organism indicators
            if (fileInfo.source) {
                return this.standardizeOrganismName(fileInfo.source);
            }
            
            // Check for species in features
            if (fileInfo.features) {
                for (const feature of fileInfo.features) {
                    if (feature.qualifiers) {
                        if (feature.qualifiers.organism) {
                            return this.standardizeOrganismName(feature.qualifiers.organism);
                        }
                        if (feature.qualifiers.species) {
                            return this.standardizeOrganismName(feature.qualifiers.species);
                        }
                    }
                }
            }
        }
        
        // Try to infer from current chromosome name
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr) {
            // Common organism mappings based on chromosome names
            const organismMap = {
                'COLI-K12': 'Escherichia coli K-12',
                'NC_000913': 'Escherichia coli K-12 MG1655',
                'chr': 'Homo sapiens', // Generic human chromosome
                'chrI': 'Saccharomyces cerevisiae',
                'chrII': 'Saccharomyces cerevisiae',
                'chrIII': 'Saccharomyces cerevisiae'
            };
            
            // Check for exact matches
            if (organismMap[currentChr]) {
                return this.standardizeOrganismName(organismMap[currentChr]);
            }
            
            // Check for partial matches
            if (currentChr.startsWith('chr') && currentChr.length <= 5) {
                return this.standardizeOrganismName('Homo sapiens');
            }
            if (currentChr.includes('COLI') || currentChr.includes('coli')) {
                return this.standardizeOrganismName('Escherichia coli');
            }
        }
        
        // Default fallback
        return 'Unknown organism';
    }

    clearGeneSelection() {
        // Clear selected gene
        this.selectedGene = null;
        
        // Remove selection styling from all gene elements (both regular and SVG)
        const selectedElements = document.querySelectorAll('.gene-element.selected, .svg-gene-element.selected');
        selectedElements.forEach(el => el.classList.remove('selected'));
        
        // Clear sequence highlights and selection
        this.clearSequenceHighlights();
        this.clearSequenceSelection();
        
        // Update tab manager about gene selection clear
        if (this.tabManager) {
            this.tabManager.updateCurrentTabSidebarPanel('geneDetailsSection', false, null);
        }
        
        console.log('Cleared gene selection');
    }

    // Edit gene annotation functionality
    editGeneAnnotation() {
        if (!this.selectedGene || !this.selectedGene.gene) {
            console.warn('No gene selected for editing');
            return;
        }

        const gene = this.selectedGene.gene;
        const modal = document.getElementById('editGeneModal');
        
        if (!modal) {
            console.error('Edit gene modal not found');
            return;
        }

        // Populate modal fields with current gene data
        this.populateEditModal(gene);
        
        // Show the modal
        modal.classList.add('show');
        
        // Set up event listeners for the modal
        this.setupEditModalEventListeners();
    }

    populateEditModal(gene) {
        // Get form elements
        const geneName = document.getElementById('editGeneName');
        const geneType = document.getElementById('editGeneType');
        const geneStart = document.getElementById('editGeneStart');
        const geneEnd = document.getElementById('editGeneEnd');
        const geneStrand = document.getElementById('editGeneStrand');
        const geneProduct = document.getElementById('editGeneProduct');
        const geneLocusTag = document.getElementById('editGeneLocusTag');
        const geneNote = document.getElementById('editGeneNote');

        // Populate basic fields
        if (geneName) geneName.value = gene.qualifiers?.gene || '';
        if (geneType) geneType.value = gene.type || 'gene';
        if (geneStart) geneStart.value = gene.start || '';
        if (geneEnd) geneEnd.value = gene.end || '';
        if (geneStrand) geneStrand.value = gene.strand || 1;
        if (geneProduct) geneProduct.value = gene.qualifiers?.product || '';
        if (geneLocusTag) geneLocusTag.value = gene.qualifiers?.locus_tag || '';
        if (geneNote) geneNote.value = gene.qualifiers?.note || '';

        // Populate additional qualifiers
        this.populateAdditionalQualifiers(gene.qualifiers || {});
    }

    populateAdditionalQualifiers(qualifiers) {
        const qualifiersList = document.getElementById('editGeneQualifiers');
        if (!qualifiersList) return;

        // Clear existing qualifiers
        qualifiersList.innerHTML = '';

        // Define standard qualifiers that are handled by dedicated fields
        const standardQualifiers = ['gene', 'product', 'locus_tag', 'note'];

        // Add remaining qualifiers
        Object.entries(qualifiers).forEach(([key, value]) => {
            if (!standardQualifiers.includes(key) && value && value.toString().trim()) {
                this.addQualifierRow(key, value.toString());
            }
        });
    }

    addQualifierRow(key = '', value = '') {
        const qualifiersList = document.getElementById('editGeneQualifiers');
        if (!qualifiersList) return;

        const qualifierDiv = document.createElement('div');
        qualifierDiv.className = 'qualifier-row';
        qualifierDiv.innerHTML = `
            <div class="qualifier-inputs">
                <input type="text" class="qualifier-key input-full" placeholder="Qualifier name" value="${key}">
                <input type="text" class="qualifier-value input-full" placeholder="Qualifier value" value="${value}">
                <button type="button" class="btn btn-sm btn-danger remove-qualifier-btn" title="Remove qualifier">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        // Add event listener for remove button
        const removeBtn = qualifierDiv.querySelector('.remove-qualifier-btn');
        removeBtn.addEventListener('click', () => {
            qualifierDiv.remove();
        });

        qualifiersList.appendChild(qualifierDiv);
    }

    setupEditModalEventListeners() {
        // Add qualifier button
        const addQualifierBtn = document.getElementById('addQualifierBtn');
        if (addQualifierBtn) {
            addQualifierBtn.removeEventListener('click', this.handleAddQualifier);
            addQualifierBtn.addEventListener('click', this.handleAddQualifier.bind(this));
        }

        // Save button
        const saveBtn = document.getElementById('saveGeneEditBtn');
        if (saveBtn) {
            saveBtn.removeEventListener('click', this.handleSaveGeneEdit);
            saveBtn.addEventListener('click', this.handleSaveGeneEdit.bind(this));
        }

        // Modal close buttons
        const modal = document.getElementById('editGeneModal');
        const closeButtons = modal.querySelectorAll('.modal-close');
        closeButtons.forEach(btn => {
            btn.removeEventListener('click', this.handleCloseEditModal);
            btn.addEventListener('click', this.handleCloseEditModal.bind(this));
        });

        // Close on outside click
        modal.removeEventListener('click', this.handleModalOutsideClick);
        modal.addEventListener('click', this.handleModalOutsideClick.bind(this));
    }

    handleAddQualifier() {
        this.addQualifierRow();
    }

    handleCloseEditModal() {
        const modal = document.getElementById('editGeneModal');
        if (modal) {
            modal.classList.remove('show');
        }
    }

    handleModalOutsideClick(e) {
        if (e.target === e.currentTarget) {
            this.handleCloseEditModal();
        }
    }

    handleSaveGeneEdit() {
        if (!this.selectedGene || !this.selectedGene.gene) {
            console.warn('No gene selected for saving');
            return;
        }

        // Get form data
        const formData = this.collectEditFormData();
        if (!formData) {
            return; // Error occurred during data collection
        }

        // Update the gene object
        this.updateGeneData(this.selectedGene.gene, formData);

        // Refresh the gene details display
        this.populateGeneDetails(this.selectedGene.gene, this.selectedGene.operonInfo);

        // Refresh the tracks to show updated annotation
        this.refreshTrackDisplay();

        // Close the modal
        this.handleCloseEditModal();

        // Show success message
        if (this.uiManager) {
            this.uiManager.updateStatus(`Gene annotation updated: ${formData.geneName || 'Unknown'}`);
        }

        console.log('Gene annotation updated successfully');
    }

    collectEditFormData() {
        try {
            const geneName = document.getElementById('editGeneName')?.value || '';
            const geneType = document.getElementById('editGeneType')?.value || 'gene';
            const geneStart = parseInt(document.getElementById('editGeneStart')?.value) || 0;
            const geneEnd = parseInt(document.getElementById('editGeneEnd')?.value) || 0;
            const geneStrand = parseInt(document.getElementById('editGeneStrand')?.value) || 1;
            const geneProduct = document.getElementById('editGeneProduct')?.value || '';
            const geneLocusTag = document.getElementById('editGeneLocusTag')?.value || '';
            const geneNote = document.getElementById('editGeneNote')?.value || '';

            // Validate required fields
            if (geneStart <= 0 || geneEnd <= 0 || geneStart >= geneEnd) {
                alert('Please enter valid start and end positions (start must be less than end and both must be positive)');
                return null;
            }

            // Collect additional qualifiers
            const additionalQualifiers = {};
            const qualifierRows = document.querySelectorAll('.qualifier-row');
            qualifierRows.forEach(row => {
                const keyInput = row.querySelector('.qualifier-key');
                const valueInput = row.querySelector('.qualifier-value');
                if (keyInput && valueInput && keyInput.value.trim() && valueInput.value.trim()) {
                    additionalQualifiers[keyInput.value.trim()] = valueInput.value.trim();
                }
            });

            return {
                geneName,
                geneType,
                geneStart,
                geneEnd,
                geneStrand,
                geneProduct,
                geneLocusTag,
                geneNote,
                additionalQualifiers
            };
        } catch (error) {
            console.error('Error collecting form data:', error);
            alert('Error collecting form data. Please check your inputs.');
            return null;
        }
    }

    updateGeneData(gene, formData) {
        // Update basic gene properties
        gene.type = formData.geneType;
        gene.start = formData.geneStart;
        gene.end = formData.geneEnd;
        gene.strand = formData.geneStrand;

        // Update qualifiers
        if (!gene.qualifiers) {
            gene.qualifiers = {};
        }

        // Update standard qualifiers
        if (formData.geneName) gene.qualifiers.gene = formData.geneName;
        if (formData.geneProduct) gene.qualifiers.product = formData.geneProduct;
        if (formData.geneLocusTag) gene.qualifiers.locus_tag = formData.geneLocusTag;
        if (formData.geneNote) gene.qualifiers.note = formData.geneNote;

        // Add additional qualifiers
        Object.entries(formData.additionalQualifiers).forEach(([key, value]) => {
            gene.qualifiers[key] = value;
        });

        // Remove empty qualifiers
        Object.keys(gene.qualifiers).forEach(key => {
            if (!gene.qualifiers[key] || gene.qualifiers[key].toString().trim() === '') {
                delete gene.qualifiers[key];
            }
        });
    }

    refreshTrackDisplay() {
        // Get current chromosome
        const currentChr = document.getElementById('chromosomeSelect')?.value;
        if (!currentChr) return;

        // Refresh gene track if visible
        if (this.visibleTracks.has('genes')) {
            const annotations = this.currentAnnotations[currentChr] || [];
            const operons = this.operons || [];
            
            // Re-render the gene track
            const geneTrack = document.querySelector('.gene-track');
            if (geneTrack) {
                const trackContent = geneTrack.querySelector('.track-content');
                if (trackContent && this.trackRenderer) {
                    // Get current viewport
                    const viewport = {
                        start: this.currentPosition.start,
                        end: this.currentPosition.end,
                        range: this.currentPosition.end - this.currentPosition.start
                    };

                    // Filter visible genes
                    const visibleGenes = annotations.filter(gene => {
                        return this.shouldShowGeneType(gene.type) &&
                               gene.end >= viewport.start && gene.start <= viewport.end;
                    });

                    // Clear and re-render
                    trackContent.innerHTML = '';
                    this.trackRenderer.renderGeneElements(trackContent, visibleGenes, viewport, operons);
                }
            }
        }
    }

    selectRead(read, fileInfo = null) {
        // Store the selected read
        this.selectedRead = { read: read, fileInfo: fileInfo };
        
        // Clear any existing read selection
        this.clearReadSelection(false);
        
        // Show read selection feedback
        this.showReadSelectionFeedback(read);
        
        // Highlight the selected read in the track
        this.highlightSelectedRead(read);
        
        // Populate and show read details panel
        this.populateReadDetails(read, fileInfo);
        this.showReadDetailsPanel();
        
        console.log('Read selected:', read.id || read.qname, 'at position', read.start + '-' + read.end);
    }

    showReadSelectionFeedback(read) {
        const readName = read.id || read.qname || 'Unknown Read';
        const position = `${read.start.toLocaleString()}-${read.end.toLocaleString()}`;
        
        this.showNotification(`Selected read: ${readName} at ${position}`, 'info');
    }

    highlightSelectedRead(read) {
        // Remove previous selection highlights
        document.querySelectorAll('.svg-read-element.selected').forEach(element => {
            element.classList.remove('selected');
            element.style.filter = '';
            element.style.stroke = '';
            element.style.strokeWidth = '';
        });
        
        // Find and highlight the selected read element
        document.querySelectorAll('.svg-read-element').forEach(element => {
            const readGroup = element.closest('g[class*="svg-read-element"]') || element;
            const title = readGroup.querySelector('title');
            
            if (title && title.textContent.includes(read.id || read.qname || '')) {
                readGroup.classList.add('selected');
                console.log('Highlighted selected read element');
            }
        });
    }

    clearReadSelection(hidePanel = true) {
        this.selectedRead = null;
        
        // Remove selected class from all read elements
        document.querySelectorAll('.svg-read-element.selected').forEach(element => {
            element.classList.remove('selected');
            element.style.filter = '';
            element.style.stroke = '';
            element.style.strokeWidth = '';
        });
        
        // Hide read details panel if requested
        if (hidePanel) {
            const readDetailsSection = document.getElementById('readDetailsSection');
            if (readDetailsSection) {
                readDetailsSection.style.display = 'none';
            }
            
            // Update tab manager about read selection clear
            if (this.tabManager) {
                this.tabManager.updateCurrentTabSidebarPanel('readDetailsSection', false, null);
            }
            
            this.uiManager.checkAndHideSidebarIfAllPanelsClosed();
        }
    }

    // Action methods for read details buttons
    zoomToRead() {
        if (!this.selectedRead) return;
        
        const read = this.selectedRead.read;
        const readLength = read.end - read.start;
        const padding = Math.max(500, Math.floor(readLength * 2)); // 2x padding or 500bp minimum
        
        const newStart = Math.max(0, read.start - padding);
        const newEnd = read.end + padding;
        
        this.currentPosition = { start: newStart, end: newEnd };
        
        const currentChr = document.getElementById('chromosomeSelect').value;
        if (currentChr && this.currentSequence && this.currentSequence[currentChr]) {
            this.updateStatistics(currentChr, this.currentSequence[currentChr]);
            this.displayGenomeView(currentChr, this.currentSequence[currentChr]);
            
            // Update current tab title with new position
            if (this.tabManager) {
                this.tabManager.updateCurrentTabPosition(currentChr, newStart + 1, newEnd);
            }
        }
    }

    copyReadSequence() {
        if (!this.selectedRead || !this.selectedRead.read.sequence) {
            this.showNotification('No sequence data available for selected read', 'warning');
            return;
        }
        
        const read = this.selectedRead.read;
        const readName = read.id || read.qname || 'Unknown Read';
        const sequence = read.sequence;
        
        const sequenceText = `>${readName} ${read.start}-${read.end} (${read.strand})\n${sequence}`;
        
        navigator.clipboard.writeText(sequenceText).then(() => {
            this.showNotification(`Read sequence copied to clipboard (${sequence.length} bp)`, 'success');
        }).catch(err => {
            console.error('Failed to copy read sequence:', err);
            this.showNotification('Failed to copy read sequence', 'error');
        });
    }

    copyReadQuality() {
        if (!this.selectedRead || !this.selectedRead.read.quality) {
            this.showNotification('No quality data available for selected read', 'warning');
            return;
        }
        
        const read = this.selectedRead.read;
        const readName = read.id || read.qname || 'Unknown Read';
        const quality = read.quality;
        
        const qualityText = `>${readName} Quality Scores\n${quality}`;
        
        navigator.clipboard.writeText(qualityText).then(() => {
            this.showNotification(`Read quality scores copied to clipboard`, 'success');
        }).catch(err => {
            console.error('Failed to copy read quality:', err);
            this.showNotification('Failed to copy read quality', 'error');
        });
    }

    copySpecificReadSequence(type, readName) {
        if (!this.selectedRead) return;
        
        const read = this.selectedRead.read;
        let content = '';
        let description = '';
        
        switch (type) {
            case 'dna':
                if (read.sequence) {
                    content = read.sequence;
                    description = 'DNA sequence';
                }
                break;
            case 'quality':
                if (read.quality) {
                    content = read.quality;
                    description = 'quality scores';
                }
                break;
            case 'cigar':
                if (read.cigar) {
                    content = read.cigar;
                    description = 'CIGAR string';
                }
                break;
        }
        
        if (content) {
            navigator.clipboard.writeText(content).then(() => {
                this.showNotification(`Read ${description} copied to clipboard`, 'success');
            }).catch(err => {
                console.error(`Failed to copy read ${description}:`, err);
                this.showNotification(`Failed to copy read ${description}`, 'error');
            });
        } else {
            this.showNotification(`No ${description} available for this read`, 'warning');
        }
    }

    toggleReadSequence(elementId) {
        const previewElement = document.getElementById(`${elementId}-preview`);
        const fullElement = document.getElementById(`${elementId}-full`);
        const toggleButton = document.querySelector(`button[onclick*="${elementId}"]`);
        
        if (previewElement && fullElement && toggleButton) {
            const isShowingFull = fullElement.style.display !== 'none';
            
            if (isShowingFull) {
                previewElement.style.display = 'block';
                fullElement.style.display = 'none';
                toggleButton.innerHTML = '<i class="fas fa-expand-alt"></i> Show Full';
            } else {
                previewElement.style.display = 'none';
                fullElement.style.display = 'block';
                toggleButton.innerHTML = '<i class="fas fa-compress-alt"></i> Show Preview';
            }
        }
    }

    // User-defined features functionality
    initializeUserFeatures() {
        // Add features dropdown toggle
        document.getElementById('addFeaturesBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleAddFeaturesDropdown();
        });
        
        // Actions dropdown menu
        document.getElementById('actionsMenuBtn')?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleActionsDropdown();
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
        document.addEventListener('click', () => {
            this.hideAddFeaturesDropdown();
            this.hideActionsDropdown();
        });
        
        // Enable sequence selection in bottom panel
        this.initializeSequenceSelection();
        
        // Initialize copy button state
        this.updateCopyButtonState();
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
    
    toggleActionsDropdown() {
        const dropdown = document.getElementById('actionsDropdown');
        const button = document.getElementById('actionsMenuBtn');
        
        if (dropdown && button) {
            const isVisible = dropdown.style.display === 'block';
            dropdown.style.display = isVisible ? 'none' : 'block';
            button.classList.toggle('active', !isVisible);
        }
    }

    hideActionsDropdown() {
        const dropdown = document.getElementById('actionsDropdown');
        const button = document.getElementById('actionsMenuBtn');
        
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
        
        // Use the same styling as gene selection for consistency
        const sequenceBases = document.querySelectorAll('.sequence-bases span');
        sequenceBases.forEach(baseElement => {
            const pos = this.getSequencePosition(baseElement);
            if (pos && pos.position >= startPos && pos.position <= endPos) {
                baseElement.classList.add('sequence-selected');
                baseElement.classList.add('gene-sequence-selected'); // Use same styling as gene selection
            }
        });
        
        // Update copy button state during selection
        this.updateCopyButtonState();
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
        
        // Update copy button state when manual selection is made
        this.updateCopyButtonState();
        
        // Update status bar with selection information
        const selectionLength = endPos - startPos + 1;
        const statusMessage = `🔵 Sequence Track Selection: ${start.chromosome}:${startPos.toLocaleString()}-${endPos.toLocaleString()} (${selectionLength.toLocaleString()} bp)`;
        
        if (this.uiManager) {
            this.uiManager.updateStatus(statusMessage);
        } else {
            const statusElement = document.getElementById('statusText');
            if (statusElement) {
                statusElement.textContent = statusMessage;
                statusElement.style.color = '#3b82f6';
                statusElement.style.fontWeight = 'bold';
                
                // Reset to normal after 5 seconds
                setTimeout(() => {
                    statusElement.style.color = '';
                    statusElement.style.fontWeight = '';
                    statusElement.textContent = 'Ready';
                }, 5000);
            }
        }
        
        console.log(`Selected sequence: ${start.chromosome}:${startPos}-${endPos} (${endPos - startPos + 1} bp)`);
    }

    clearSequenceSelection() {
        this.currentSequenceSelection = null;
        this.sequenceSelection = { start: null, end: null, active: false };
        
        // Remove visual selection (using consistent classes)
        const selectedElements = document.querySelectorAll('.sequence-selected, .gene-sequence-selected');
        selectedElements.forEach(element => {
            element.classList.remove('sequence-selected');
            element.classList.remove('gene-sequence-selected');
        });
        
        // Hide selection info in modal
        const selectionInfo = document.getElementById('sequenceSelectionInfo');
        if (selectionInfo) {
            selectionInfo.style.display = 'none';
        }
        
        // Update copy button state
        this.updateCopyButtonState();
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
            
            // Removed click listener to prevent collapse/uncollapse on header click
            // sequenceHeader.addEventListener('click', () => {
            //     this.toggleBottomSequencePanel();
            // });
        }
    }

    // Toggle collapse/expand of bottom sequence panel
    toggleBottomSequencePanel() {
        const sequenceContent = document.getElementById('sequenceContent');
        const sequenceDisplaySection = document.getElementById('sequenceDisplaySection');
        const splitter = document.getElementById('splitter');
        const genomeViewerSection = document.getElementById('genomeViewerSection');
        
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
                
                // Let genome viewer expand to fill space
                if (genomeViewerSection) {
                    genomeViewerSection.style.flexGrow = '1';
                }
            }
            
            // Trigger resize event for layout adjustment
            window.dispatchEvent(new Event('resize'));
        }
    }

    createGCTrack(chromosome, sequence) {
        const track = document.createElement('div');
        track.className = 'gc-track';
        
        const trackHeader = document.createElement('div');
        trackHeader.className = 'track-header';
        trackHeader.textContent = 'GC Content & Skew';
        track.appendChild(trackHeader);
        
        const trackContent = document.createElement('div');
        trackContent.className = 'track-content gc-content-skew-display';
        
        // Add draggable functionality
        this.makeDraggable(trackContent, chromosome);
        
        const start = this.currentPosition.start;
        const end = this.currentPosition.end;
        const subsequence = sequence.substring(start, end);
        
        // Get GC track settings
        const gcSettings = this.trackRenderer.getTrackSettings('gc'); // Retrieve settings

        // Create GC content visualization (now passing settings)
        const gcCanvas = this.genomeBrowser.createGCContentVisualization(subsequence, gcSettings); // Pass settings
        
        trackContent.appendChild(gcCanvas);
        track.appendChild(trackContent);

        // Add track settings button
        const settingsButton = this.trackRenderer.createTrackSettingsButton('gc'); // Use trackRenderer method
        trackHeader.appendChild(settingsButton);
        
        return track;
    }

    createGCContentVisualization(sequence, settings) {
        const canvas = document.createElement('canvas');
        canvas.className = 'gc-visualization-canvas';
        const context = canvas.getContext('2d');
        
        // Default settings if none provided (should be handled by TrackRenderer, but for safety)
        const gcSettings = settings || {
            contentColor: '#3b82f6', // blue
            skewPositiveColor: '#10b981', // green
            skewNegativeColor: '#ef4444', // red
            lineWidth: 2,
            height: 140
        };

        const width = canvas.width = 800; // Arbitrary width, will be scaled by CSS
        const height = canvas.height = 120; // Fixed height for the visualization
        const barWidth = 1; // Width of each data point
        
        const step = Math.max(1, Math.floor(sequence.length / width)); // Calculate step size to fit data to canvas width
        
        let gcContentData = [];
        let gcSkewData = [];
        
        // Calculate GC content and skew for sliding windows
        const windowSize = 500; // Window size for calculation
        for (let i = 0; i < sequence.length - windowSize; i += step) {
            const windowSeq = sequence.substring(i, i + windowSize);
            let g = 0;
            let c = 0;
            let total = 0;
            
            for (let j = 0; j < windowSeq.length; j++) {
                const base = windowSeq[j].toLowerCase();
                if (base === 'g') g++;
                else if (base === 'c') c++;
                if (base === 'g' || base === 'c' || base === 'a' || base === 't') total++;
            }
            
            const gcRatio = total > 0 ? (g + c) / total : 0;
            const gcSkew = (g + c) > 0 ? (g - c) / (g + c) : 0;
            
            gcContentData.push(gcRatio * height); // Scale to canvas height
            gcSkewData.push(gcSkew * (height / 2) + (height / 2)); // Scale and offset for skew
        }
        
        // Draw GC content and skew
        context.clearRect(0, 0, width, height);
        
        // Draw GC Content (blue bars)
        context.fillStyle = gcSettings.contentColor; // Use setting
        for (let i = 0; i < gcContentData.length; i++) {
            const barHeight = gcContentData[i];
            context.fillRect(i * barWidth, height - barHeight, barWidth, barHeight);
        }
        
        // Draw GC Skew (line graph, positive green, negative red)
        context.lineWidth = gcSettings.lineWidth; // Use setting
        context.beginPath();
        context.moveTo(0, gcSkewData[0]);
        
        for (let i = 1; i < gcSkewData.length; i++) {
            context.lineTo(i * barWidth, gcSkewData[i]);
        }
        
        // Apply color gradient based on skew value
        const gradient = context.createLinearGradient(0, 0, width, 0);
        // Create color stops based on skew values across the width
        for(let i = 0; i < gcSkewData.length; i++) {
            const skewValue = (gcSkewData[i] - (height / 2)) / (height / 2);
            let color;
            if (skewValue > 0) {
                 // Interpolate between white (0 skew) and positive color
                 const ratio = skewValue; // Skew is already scaled from 0 to 1 relative to height/2
                 color = this.interpolateColor('#ffffff', gcSettings.skewPositiveColor, ratio); // Use setting
            } else {
                 // Interpolate between white (0 skew) and negative color
                 const ratio = -skewValue; // Use absolute value for interpolation
                 color = this.interpolateColor('#ffffff', gcSettings.skewNegativeColor, ratio); // Use setting
            }
             gradient.addColorStop(i / gcSkewData.length, color);
        }

        context.strokeStyle = gradient;
        context.stroke();
        
        return canvas;
    }

    // Helper function for color interpolation
    interpolateColor(color1, color2, factor) {
        const result = color1.slice(); // Copy color1
        for (let i = 1; i < 7; i += 2) {
            const c1 = parseInt(color1.substr(i, 2), 16);
            const c2 = parseInt(color2.substr(i, 2), 16);
            const c = Math.round(c1 + factor * (c2 - c1)).toString(16);
            result[i] = ('0' + c).slice(-2);
            result[i+1] = ('0' + c).slice(-2);
        }
        return result.join('');
    }

    // MCP Server Control Methods for Built-in Server
    async initializeMCPServerStatus() {
        try {
            await this.updateMCPServerStatus();
            
            // Check status periodically
            setInterval(() => {
                this.updateMCPServerStatus();
            }, 5000); // Check every 5 seconds
        } catch (error) {
            console.error('Error initializing MCP server status:', error);
        }
    }

    async updateMCPServerStatus() {
        try {
            // Check both the main process server and the chat manager connections
            const mainProcessResult = await ipcRenderer.invoke('mcp-server-status');
            
            // Check if ChatManager has connections to the built-in server
            let hasActiveConnections = false;
            if (this.chatManager?.mcpServerManager) {
                const connectedCount = this.chatManager.mcpServerManager.getConnectedServersCount();
                hasActiveConnections = connectedCount > 0;
                
                // Check specifically for genome-studio server connection
                const genomeStudioServer = this.chatManager.mcpServerManager.getServer('genome-studio');
                const isGenomeStudioConnected = genomeStudioServer && 
                    this.chatManager.mcpServerManager.activeServers.has('genome-studio');
                
                if (isGenomeStudioConnected) {
                    hasActiveConnections = true;
                }
            }
            
            // If main process says running OR we have active connections, show as running
            if (mainProcessResult.isRunning || hasActiveConnections) {
                this.setMCPServerUIStatus('running', {
                    httpPort: 3000,
                    wsPort: 3001,
                    connectedClients: hasActiveConnections ? 1 : 0
                });
            } else {
                this.setMCPServerUIStatus(mainProcessResult.status, mainProcessResult);
            }
        } catch (error) {
            console.error('Error checking MCP server status:', error);
            this.setMCPServerUIStatus('stopped');
        }
    }

    setMCPServerUIStatus(status, info = {}) {
        const btn = document.getElementById('mcpServerBtn');
        const statusText = document.getElementById('mcpServerStatus');
        const statusIndicator = document.getElementById('mcpStatusIndicator');
        const statusDot = statusIndicator?.querySelector('.status-dot');
        const statusTextElement = statusIndicator?.querySelector('.status-text');

        if (!btn || !statusText || !statusIndicator) return;

        // Remove all status classes
        btn.classList.remove('starting', 'running', 'stopping');
        statusDot?.classList.remove('status-stopped', 'status-starting', 'status-running', 'status-stopping');

        switch (status) {
            case 'stopped':
                statusText.textContent = 'Start';
                statusTextElement.textContent = 'Stopped';
                statusDot?.classList.add('status-stopped');
                btn.disabled = false;
                btn.title = 'Start Unified Claude MCP Server';
                break;
            case 'starting':
                statusText.textContent = 'Starting...';
                statusTextElement.textContent = 'Starting';
                statusDot?.classList.add('status-starting');
                btn.classList.add('starting');
                btn.disabled = true;
                btn.title = 'Unified Claude MCP Server is starting...';
                break;
            case 'running':
                statusText.textContent = 'Stop';
                const connectedText = info.connectedClients ? ` (${info.connectedClients} client${info.connectedClients !== 1 ? 's' : ''})` : '';
                statusTextElement.textContent = `Running${connectedText}`;
                statusDot?.classList.add('status-running');
                btn.classList.add('running');
                btn.disabled = false;
                const serverTypeText = info.serverType === 'unified-claude-mcp' ? 'Unified Claude MCP Server' : 'MCP Server';
                btn.title = `Stop ${serverTypeText} (Connect Claude Desktop to: http://localhost:${info.httpPort || 3000}/mcp)${connectedText}`;
                break;
            case 'stopping':
                statusText.textContent = 'Stopping...';
                statusTextElement.textContent = 'Stopping';
                statusDot?.classList.add('status-stopping');
                btn.classList.add('stopping');
                btn.disabled = true;
                btn.title = 'Unified Claude MCP Server is stopping...';
                break;
        }
    }

    async toggleMCPServer() {
        try {
            const statusResult = await ipcRenderer.invoke('mcp-server-status');
            
            // Check if we have active connections through ChatManager
            let hasActiveConnections = false;
            if (this.chatManager?.mcpServerManager) {
                const connectedCount = this.chatManager.mcpServerManager.getConnectedServersCount();
                hasActiveConnections = connectedCount > 0;
                
                // Check specifically for genome-studio server connection
                const genomeStudioServer = this.chatManager.mcpServerManager.getServer('genome-studio');
                const isGenomeStudioConnected = genomeStudioServer && 
                    this.chatManager.mcpServerManager.activeServers.has('genome-studio');
                
                if (isGenomeStudioConnected) {
                    hasActiveConnections = true;
                }
            }
            
            const isCurrentlyRunning = statusResult.isRunning || hasActiveConnections;
            
            if (isCurrentlyRunning) {
                // Stop the server and disconnect clients
                this.setMCPServerUIStatus('stopping');
                
                // Disconnect from ChatManager first if connected
                if (hasActiveConnections && this.chatManager?.mcpServerManager) {
                    this.chatManager.mcpServerManager.disconnectAll();
                }
                
                const result = await ipcRenderer.invoke('mcp-server-stop');
                
                if (result.success) {
                    this.showNotification('MCP Server stopped successfully', 'success');
                } else {
                    this.showNotification(`Failed to stop MCP Server: ${result.message}`, 'error');
                }
            } else {
                // Start the server
                this.setMCPServerUIStatus('starting');
                const result = await ipcRenderer.invoke('mcp-server-start');
                
                if (result.success) {
                    const serverTypeText = result.serverType === 'unified-claude-mcp' ? 'Unified Claude MCP Server' : 'MCP Server';
                    this.showNotification(`${serverTypeText} started successfully! Claude Desktop can connect via custom connector: http://localhost:${result.httpPort}/mcp`, 'success');
                    
                    // Auto-connect the ChatManager to the built-in server after starting (only if auto-activation is allowed)
                    const currentSettings = this.configManager ? 
                        this.configManager.get('mcpSettings', { allowAutoActivation: false }) : 
                        { allowAutoActivation: false };
                        
                    if (currentSettings.allowAutoActivation) {
                        // For unified RPC server, no WebSocket connection needed
                        // The RPC interface is automatically available when the server starts
                        console.log('✅ Unified Claude MCP Server RPC interface is ready');
                    }
                } else {
                    this.showNotification(`Failed to start MCP Server: ${result.message}`, 'error');
                }
            }
            
            // Update status after action
            setTimeout(() => {
                this.updateMCPServerStatus();
            }, 1500);
            
        } catch (error) {
            console.error('Error toggling MCP server:', error);
            this.showNotification(`Error controlling MCP Server: ${error.message}`, 'error');
            this.setMCPServerUIStatus('stopped');
        }
    }

    // Global notification method
    showNotification(message, type = 'info') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        notification.innerHTML = `
            <div class="notification-content">
                <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                <span>${message}</span>
            </div>
        `;
        
        // Add to page
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => notification.classList.add('show'), 100);
        
        // Remove after 3 seconds
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                if (notification.parentElement) {
                    document.body.removeChild(notification);
                }
            }, 300);
        }, 3000);
    }

    /**
     * Show Smart Execution Demo page
     */
    showSmartExecutionDemo() {
        try {
            // Use IPC to request opening the demo from main process
            ipcRenderer.send('open-smart-execution-demo');
            
            this.showNotification('智能执行演示窗口正在打开...', 'info');
        } catch (error) {
            console.error('Failed to open Smart Execution Demo:', error);
            this.showNotification('无法打开智能执行演示页面', 'error');
        }
    }

    /**
     * Open Resource Manager window
     */
    openResourceManager() {
        try {
            // Use IPC to request opening the Resource Manager from main process
            ipcRenderer.send('open-resource-manager');
            
            this.showNotification('Resource Manager window is opening...', 'info');
        } catch (error) {
            console.error('Failed to open Resource Manager:', error);
            this.showNotification('Unable to open Resource Manager window', 'error');
        }
    }

    /**
     * Open Project Manager window
     */
    async openProjectManagerWindow() {
        try {
            // Use IPC to request opening the Project Manager from main process
            ipcRenderer.send('open-project-manager');
            
            this.showNotification('Project Manager window is opening...', 'info');
            
            // 返回一个promise，等待项目管理器窗口可用
            return new Promise((resolve) => {
                // 这里可以添加监听器等待窗口准备好
                setTimeout(() => {
                    // 模拟返回一个包含窗口实例的对象
                    // 实际使用中，可能需要通过IPC或其他方式获取窗口实例
                    resolve({
                        projectManagerWindow: {
                            saveCurrentProjectAsXML: async () => {
                                console.log('Triggered save current project as XML');
                                this.showNotification('Project saved as XML via Project Manager', 'success');
                            }
                        }
                    });
                }, 500);
            });
        } catch (error) {
            console.error('Failed to open Project Manager:', error);
            this.showNotification('Unable to open Project Manager window', 'error');
            throw error;
        }
    }

    /**
     * Initialize Plugin Management UI with retry mechanism
     */
    async initializePluginManagementUI() {
        let attempts = 0;
        const maxAttempts = 10;
        const delay = 200; // 200ms delay between attempts
        
        const tryInitialize = async () => {
            attempts++;
            
            try {
                if (this.chatManager && this.chatManager.pluginManager) {
                    this.pluginManagementUI = new PluginManagementUI(this.chatManager.pluginManager, this.configManager);
                    window.pluginManagementUI = this.pluginManagementUI; // Make globally available for onclick handlers
                    console.log('✅ PluginManagementUI initialized successfully');
                    return true;
                } else if (attempts < maxAttempts) {
                    console.log(`🔄 PluginManager not ready yet, retrying... (${attempts}/${maxAttempts})`);
                    setTimeout(tryInitialize, delay);
                    return false;
                } else {
                    console.warn('⚠️ PluginManager not available after maximum attempts, PluginManagementUI initialization failed');
                    return false;
                }
            } catch (error) {
                console.error('❌ Error initializing PluginManagementUI:', error);
                if (attempts < maxAttempts) {
                    setTimeout(tryInitialize, delay);
                    return false;
                } else {
                    return false;
                }
            }
        };
        
        return tryInitialize();
    }

    /**
     * Initialize Visualization Tools Manager
     */
    async initializeVisualizationToolsManager(pluginId = null) {
        try {
            // 加载VisualizationToolsManager脚本
            if (typeof VisualizationToolsManager === 'undefined') {
                const script = document.createElement('script');
                script.src = 'modules/VisualizationToolsManager.js';
                script.onload = () => {
                    this.createVisualizationToolsManager(pluginId);
                };
                script.onerror = () => {
                    console.error('Failed to load VisualizationToolsManager');
                    if (pluginId) {
                        this.openBasicVisualizationTool(pluginId);
                    }
                };
                document.head.appendChild(script);
            } else {
                this.createVisualizationToolsManager(pluginId);
            }
        } catch (error) {
            console.error('Error initializing VisualizationToolsManager:', error);
            if (pluginId) {
                this.openBasicVisualizationTool(pluginId);
            }
        }
    }

    /**
     * Create Visualization Tools Manager instance
     */
    createVisualizationToolsManager(pluginId = null) {
        try {
            this.visualizationToolsManager = new VisualizationToolsManager(this, this.configManager);
            window.visualizationToolsManager = this.visualizationToolsManager;
            
            if (pluginId) {
                // 打开请求的工具
                setTimeout(() => {
                    this.visualizationToolsManager.openVisualizationTool(pluginId);
                }, 100);
            }
        } catch (error) {
            console.error('Error creating VisualizationToolsManager:', error);
            if (pluginId) {
                this.openBasicVisualizationTool(pluginId);
            }
        }
    }

    /**
     * Basic visualization tool opener (fallback)
     */
    openBasicVisualizationTool(pluginId) {
        const toolNames = {
            'network-graph': 'Network Graph Viewer',
            'protein-interaction-network': 'Protein Interaction Network',
            'gene-regulatory-network': 'Gene Regulatory Network',
            'phylogenetic-tree': 'Phylogenetic Tree Viewer',
            'sequence-alignment': 'Sequence Alignment Viewer'
        };

        const toolName = toolNames[pluginId] || pluginId;
        
        const toolWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
        
        toolWindow.document.write(`
            <!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>${toolName} - Genome AI Studio</title>
                <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
                <style>
                    body {
                        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                        margin: 0;
                        padding: 2rem;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        color: #333;
                        min-height: 100vh;
                    }
                    .container {
                        max-width: 1200px;
                        margin: 0 auto;
                        background: white;
                        border-radius: 1rem;
                        padding: 2rem;
                        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                    }
                    .header {
                        text-align: center;
                        margin-bottom: 3rem;
                        padding-bottom: 1rem;
                        border-bottom: 2px solid #e2e8f0;
                    }
                    .header h1 {
                        font-size: 2.5rem;
                        margin-bottom: 0.5rem;
                        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                        -webkit-background-clip: text;
                        -webkit-text-fill-color: transparent;
                    }
                    .status {
                        padding: 1rem;
                        background: #f7fafc;
                        border: 1px solid #e2e8f0;
                        border-radius: 0.5rem;
                        margin: 2rem 0;
                        text-align: center;
                        color: #4a5568;
                    }
                    .info {
                        background: #ebf8ff;
                        border-color: #90cdf4;
                        color: #2b6cb0;
                    }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1><i class="fas fa-chart-bar"></i> ${toolName}</h1>
                        <p>Advanced visualization tool for genomic data analysis</p>
                    </div>
                    
                    <div class="status info">
                        <i class="fas fa-info-circle"></i>
                        This visualization tool is being prepared. The full plugin framework is initializing...
                    </div>
                    
                    <div class="status">
                        Plugin ID: <strong>${pluginId}</strong><br>
                        Tool Name: <strong>${toolName}</strong><br>
                        Status: <strong>Available</strong>
                    </div>
                </div>
            </body>
            </html>
        `);
        
        toolWindow.document.close();
        toolWindow.focus();
        
        this.showNotification(`${toolName} opened in new window`, 'info');
    }

    /**
     * Handle Copy action from Edit menu
     */
    handleMenuCopy() {
        try {
            // Allow Edit menu to work regardless of focus state
            // This ensures menu copy/paste work when accessed via menu bar

            // Get the currently focused element
            const activeElement = document.activeElement;
            
            // If there's a text selection anywhere on the page
            const selection = window.getSelection();
            if (selection && selection.toString().trim()) {
                navigator.clipboard.writeText(selection.toString()).then(() => {
                    this.showNotification('✅ Text copied to clipboard', 'success');
                }).catch(err => {
                    console.error('Failed to copy selection:', err);
                    this.showNotification('❌ Failed to copy text', 'error');
                });
                return;
            }

            // If focused on an input field with selected text
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                const start = activeElement.selectionStart;
                const end = activeElement.selectionEnd;
                if (start !== end) {
                    const selectedText = activeElement.value.substring(start, end);
                    navigator.clipboard.writeText(selectedText).then(() => {
                        this.showNotification('✅ Text copied to clipboard', 'success');
                    }).catch(err => {
                        console.error('Failed to copy input text:', err);
                        this.showNotification('❌ Failed to copy text', 'error');
                    });
                    return;
                }
            }

            // Check if there's a sequence to copy (gene or sequence selection)
            if (this.sequenceUtils && this.currentSequence && Object.keys(this.currentSequence).length > 0) {
                // Use existing sequence copy functionality
                this.sequenceUtils.copySequence();
                return;
            }

            // If ChatManager is available and there's selected text in chat
            if (window.chatManager && typeof window.chatManager.copySelectedText === 'function') {
                const chatSelection = window.getSelection();
                if (chatSelection && chatSelection.toString().trim()) {
                    window.chatManager.copySelectedText();
                    return;
                }
            }

            // No content to copy
            this.showNotification('⚠️ No content selected to copy', 'warning');
            
        } catch (error) {
            console.error('Error in handleMenuCopy:', error);
            this.showNotification('❌ Error copying content', 'error');
        }
    }

    /**
     * Handle Paste action from Edit menu
     */
    handleMenuPaste() {
        try {
            // Allow Edit menu to work regardless of focus state
            // This ensures menu copy/paste work when accessed via menu bar

            const activeElement = document.activeElement;
            
            // If focused on an input field or textarea
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                navigator.clipboard.readText().then(text => {
                    if (!text.trim()) {
                        this.showNotification('⚠️ Clipboard is empty', 'warning');
                        return;
                    }

                    // Insert text at cursor position
                    const start = activeElement.selectionStart;
                    const end = activeElement.selectionEnd;
                    const currentValue = activeElement.value;
                    const newValue = currentValue.substring(0, start) + text + currentValue.substring(end);
                    activeElement.value = newValue;

                    // Set cursor position after pasted text
                    const newCursorPosition = start + text.length;
                    activeElement.setSelectionRange(newCursorPosition, newCursorPosition);

                    // Trigger input event for any listeners
                    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                    
                    this.showNotification(`✅ Pasted ${text.length} characters`, 'success');
                }).catch(err => {
                    console.error('Failed to paste text:', err);
                    this.showNotification('❌ Failed to paste from clipboard', 'error');
                });
                return;
            }

            // If ChatManager is available and chat input is present
            if (window.chatManager && typeof window.chatManager.pasteFromClipboard === 'function') {
                const chatInput = document.getElementById('chatInput');
                if (chatInput) {
                    window.chatManager.pasteFromClipboard();
                    return;
                }
            }

            // No suitable target for pasting
            this.showNotification('⚠️ No input field selected for pasting', 'warning');
            
        } catch (error) {
            console.error('Error in handleMenuPaste:', error);
            this.showNotification('❌ Error pasting content', 'error');
        }
    }

    /**
     * Handle Select All action from Edit menu
     */
    handleMenuSelectAll() {
        try {
            const activeElement = document.activeElement;
            
            // If focused on an input field or textarea
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                activeElement.select();
                this.showNotification('✅ All text selected', 'success');
                return;
            }

            // If there's content in the main genome viewer area
            const genomeViewer = document.getElementById('genomeViewer');
            if (genomeViewer && genomeViewer.textContent.trim()) {
                // Select all text in the genome viewer
                const range = document.createRange();
                range.selectNodeContents(genomeViewer);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                this.showNotification('✅ Genome content selected', 'success');
                return;
            }

            // If there's chat content
            const chatMessages = document.getElementById('chatMessages');
            if (chatMessages && chatMessages.textContent.trim()) {
                const range = document.createRange();
                range.selectNodeContents(chatMessages);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                this.showNotification('✅ Chat content selected', 'success');
                return;
            }

            // Select all content on the page as fallback
            document.execCommand('selectAll');
            this.showNotification('✅ All page content selected', 'success');
            
        } catch (error) {
            console.error('Error in handleMenuSelectAll:', error);
            this.showNotification('❌ Error selecting content', 'error');
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