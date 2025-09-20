/**
 * Benchmark Menu Manager - Manages menu replacement for benchmark mode
 */
class BenchmarkMenuManager {
    constructor(app) {
        this.app = app;
        this.originalMenus = null;
        this.benchmarkMenusActive = false;
        this.benchmarkWindow = null;
        
        this.setupEventHandlers();
    }

    /**
     * Activate benchmark menus (replace main window menus)
     */
    activateBenchmarkMenus(benchmarkWindow = null) {
        if (this.benchmarkMenusActive) {
            console.log('🧪 Benchmark menus already active');
            return;
        }

        console.log('🧪 Activating benchmark-specific menus...');
        
        try {
            // Store original menus for restoration
            this.storeOriginalMenus();
            
            // Set benchmark window reference
            this.benchmarkWindow = benchmarkWindow;
            
            // Replace main window menus with benchmark-specific menus
            this.createBenchmarkMenus();
            
            // Update window title
            this.updateWindowTitle('LLM Instruction Following Benchmark');
            
            // Update UI state
            this.updateUIForBenchmarkMode();
            
            this.benchmarkMenusActive = true;
            console.log('✅ Benchmark menus activated successfully');
            
        } catch (error) {
            console.error('❌ Failed to activate benchmark menus:', error);
        }
    }

    /**
     * Deactivate benchmark menus (restore original menus)
     */
    deactivateBenchmarkMenus() {
        if (!this.benchmarkMenusActive) {
            console.log('🧪 Benchmark menus not active');
            return;
        }

        console.log('🧪 Deactivating benchmark menus...');
        
        try {
            // Restore original menus
            this.restoreOriginalMenus();
            
            // Restore window title
            this.updateWindowTitle('Genome AI Studio');
            
            // Restore UI state
            this.restoreUIFromBenchmarkMode();
            
            this.benchmarkMenusActive = false;
            this.benchmarkWindow = null;
            console.log('✅ Original menus restored successfully');
            
        } catch (error) {
            console.error('❌ Failed to deactivate benchmark menus:', error);
        }
    }

    /**
     * Store original menus for later restoration
     */
    storeOriginalMenus() {
        // Get current header and menu elements
        const header = document.querySelector('.header') || document.querySelector('header');
        const menuBar = document.querySelector('.menu-bar') || document.querySelector('#menuBar');
        const toolbar = document.querySelector('.toolbar') || document.querySelector('#toolbar');
        
        this.originalMenus = {
            headerHTML: header ? header.outerHTML : null,
            menuBarHTML: menuBar ? menuBar.outerHTML : null,
            toolbarHTML: toolbar ? toolbar.outerHTML : null,
            windowTitle: document.title,
            bodyClass: document.body.className
        };
        
        console.log('💾 Original header and menus stored');
    }

    /**
     * Create benchmark-specific menus
     */
    createBenchmarkMenus() {
        // Remove existing header and menu elements
        const header = document.querySelector('.header') || document.querySelector('header');
        const existingMenuBar = document.querySelector('.menu-bar') || document.querySelector('#menuBar');
        const toolbar = document.querySelector('.toolbar') || document.querySelector('#toolbar');
        
        if (header) {
            header.style.display = 'none';
            header.dataset.benchmarkHidden = 'true';
        }
        if (existingMenuBar) {
            existingMenuBar.style.display = 'none';
            existingMenuBar.dataset.benchmarkHidden = 'true';
        }
        if (toolbar) {
            toolbar.style.display = 'none';
            toolbar.dataset.benchmarkHidden = 'true';
        }

        // Create benchmark menu bar
        const benchmarkMenuBar = this.createBenchmarkMenuBar();
        
        // Insert at the top of the body
        document.body.insertBefore(benchmarkMenuBar, document.body.firstChild);
        
        // Update main content to account for menu bar
        this.adjustMainContentForMenuBar();
        
        console.log('🧪 Benchmark menus created and original header hidden');
    }

    /**
     * Create benchmark menu bar HTML
     */
    createBenchmarkMenuBar() {
        const menuBar = document.createElement('div');
        menuBar.className = 'benchmark-menu-bar';
        menuBar.innerHTML = `
            <style>
                .benchmark-menu-bar {
                    background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
                    color: white;
                    padding: 0;
                    border-bottom: 3px solid #3498db;
                    display: flex;
                    align-items: center;
                    height: 45px;
                    position: sticky;
                    top: 0;
                    z-index: 1000;
                    box-shadow: 0 2px 10px rgba(0,0,0,0.2);
                }

                .benchmark-menu-item {
                    padding: 12px 18px;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    position: relative;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    font-weight: 500;
                    font-size: 14px;
                }

                .benchmark-menu-item:hover {
                    background: rgba(52, 152, 219, 0.4);
                    transform: translateY(-1px);
                }

                .benchmark-menu-item.active {
                    background: rgba(52, 152, 219, 0.6);
                }

                .benchmark-dropdown-menu {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    background: white;
                    border: 1px solid #ddd;
                    border-radius: 0 0 8px 8px;
                    box-shadow: 0 6px 20px rgba(0,0,0,0.25);
                    display: none;
                    min-width: 220px;
                    z-index: 1001;
                }

                .benchmark-dropdown-menu.show {
                    display: block;
                    animation: dropdownSlide 0.2s ease-out;
                }

                @keyframes dropdownSlide {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }

                .benchmark-dropdown-item {
                    padding: 12px 18px;
                    cursor: pointer;
                    color: #333;
                    border-bottom: 1px solid #f0f0f0;
                    transition: background 0.2s ease;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 13px;
                }

                .benchmark-dropdown-item:hover {
                    background: #f8f9fa;
                    color: #2c3e50;
                }

                .benchmark-dropdown-item:last-child {
                    border-bottom: none;
                }

                .benchmark-dropdown-separator {
                    height: 1px;
                    background: #e9ecef;
                    margin: 8px 0;
                }

                .benchmark-dropdown-item.disabled {
                    color: #6c757d;
                    cursor: not-allowed;
                    opacity: 0.6;
                }

                .benchmark-dropdown-item.disabled:hover {
                    background: none;
                }

                .benchmark-menu-title {
                    margin-left: auto;
                    margin-right: 20px;
                    font-size: 16px;
                    font-weight: 600;
                    color: #ecf0f1;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .benchmark-status-indicator {
                    width: 10px;
                    height: 10px;
                    border-radius: 50%;
                    background: #27ae60;
                    animation: pulse 2s infinite;
                }

                @keyframes pulse {
                    0% { opacity: 1; }
                    50% { opacity: 0.5; }
                    100% { opacity: 1; }
                }

                .benchmark-status-indicator.running {
                    background: #f39c12;
                }

                .benchmark-status-indicator.error {
                    background: #e74c3c;
                }
            </style>

            <!-- File Menu -->
            <div class="benchmark-menu-item" data-menu="file">
                📁 File
                <div class="benchmark-dropdown-menu" id="benchmarkFileMenu">
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.newBenchmark()">
                        <span>🆕</span> New Benchmark
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Ctrl+N</span>
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.openBenchmarkResults()">
                        <span>📂</span> Open Results
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Ctrl+O</span>
                    </div>
                    <div class="benchmark-dropdown-separator"></div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.saveBenchmarkResults()">
                        <span>💾</span> Save Results
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Ctrl+S</span>
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.saveAsReport()">
                        <span>📊</span> Save as Report
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Ctrl+Shift+S</span>
                    </div>
                    <div class="benchmark-dropdown-separator"></div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.exportResults()">
                        <span>📤</span> Export Results
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Ctrl+E</span>
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.exportHistory()">
                        <span>📚</span> Export History
                    </div>
                    <div class="benchmark-dropdown-separator"></div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.exitBenchmarkMode()">
                        <span>🚪</span> Exit Benchmark Mode
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Esc</span>
                    </div>
                </div>
            </div>

            <!-- Edit Menu -->
            <div class="benchmark-menu-item" data-menu="edit">
                ✂️ Edit
                <div class="benchmark-dropdown-menu" id="benchmarkEditMenu">
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.copyResults()">
                        <span>📋</span> Copy Results
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Ctrl+C</span>
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.copySelectedTests()">
                        <span>📄</span> Copy Selected Tests
                    </div>
                    <div class="benchmark-dropdown-separator"></div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.selectAllTests()">
                        <span>🎯</span> Select All Tests
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Ctrl+A</span>
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.selectFailedTests()">
                        <span>❌</span> Select Failed Tests
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.selectPassedTests()">
                        <span>✅</span> Select Passed Tests
                    </div>
                    <div class="benchmark-dropdown-separator"></div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.clearSelection()">
                        <span>🔄</span> Clear Selection
                    </div>
                </div>
            </div>

            <!-- Benchmark Menu -->
            <div class="benchmark-menu-item" data-menu="benchmark">
                🧪 Benchmark
                <div class="benchmark-dropdown-menu" id="benchmarkBenchmarkMenu">
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.runQuickBenchmark()">
                        <span>⚡</span> Quick Benchmark
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Ctrl+Q</span>
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.runFullBenchmark()">
                        <span>🔬</span> Full Benchmark
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Ctrl+F</span>
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.runCustomBenchmark()">
                        <span>⚙️</span> Custom Benchmark
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Ctrl+U</span>
                    </div>
                    <div class="benchmark-dropdown-separator"></div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.runBasicOperationsTest()">
                        <span>✂️</span> Basic Operations Test
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.runEditOperationsTest()">
                        <span>📝</span> Edit Operations Test
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.runPluginIntegrationTest()">
                        <span>🔌</span> Plugin Integration Test
                    </div>
                    <div class="benchmark-dropdown-separator"></div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.stopBenchmark()" id="stopBenchmarkMenuItem" class="disabled">
                        <span>⏹️</span> Stop Benchmark
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Ctrl+.</span>
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.pauseBenchmark()" id="pauseBenchmarkMenuItem" class="disabled">
                        <span>⏸️</span> Pause Benchmark
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Ctrl+P</span>
                    </div>
                </div>
            </div>

            <!-- View Menu -->
            <div class="benchmark-menu-item" data-menu="view">
                👁️ View
                <div class="benchmark-dropdown-menu" id="benchmarkViewMenu">
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.showConfiguration()">
                        <span>⚙️</span> Configuration Panel
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Ctrl+1</span>
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.showProgress()">
                        <span>📊</span> Progress Panel
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Ctrl+2</span>
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.showResults()">
                        <span>📈</span> Results Panel
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Ctrl+3</span>
                    </div>
                    <div class="benchmark-dropdown-separator"></div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.showOverview()">
                        <span>📋</span> Overview
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.showDetailedResults()">
                        <span>📄</span> Detailed Results
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.showStatistics()">
                        <span>📊</span> Statistics
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.showCharts()">
                        <span>📈</span> Charts
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.showErrorAnalysis()">
                        <span>🔍</span> Error Analysis
                    </div>
                    <div class="benchmark-dropdown-separator"></div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.toggleFullscreen()">
                        <span>🖥️</span> Toggle Fullscreen
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">F11</span>
                    </div>
                </div>
            </div>

            <!-- Tools Menu -->
            <div class="benchmark-menu-item" data-menu="tools">
                🔧 Tools
                <div class="benchmark-dropdown-menu" id="benchmarkToolsMenu">
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.validateConfiguration()">
                        <span>✅</span> Validate Configuration
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.testLLMConnection()">
                        <span>🔗</span> Test LLM Connection
                    </div>
                    <div class="benchmark-dropdown-separator"></div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.openChatBox()">
                        <span>💬</span> Open ChatBox
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Ctrl+T</span>
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.configureLLM()">
                        <span>🤖</span> Configure LLM
                    </div>
                    <div class="benchmark-dropdown-separator"></div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.clearHistory()">
                        <span>🗑️</span> Clear History
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.resetSettings()">
                        <span>🔄</span> Reset Settings
                    </div>
                    <div class="benchmark-dropdown-separator"></div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.openDebugConsole()">
                        <span>🐛</span> Debug Console
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">F12</span>
                    </div>
                </div>
            </div>

            <!-- Window Menu -->
            <div class="benchmark-menu-item" data-menu="window">
                🪟 Window
                <div class="benchmark-dropdown-menu" id="benchmarkWindowMenu">
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.openBenchmarkWindow()">
                        <span>🧪</span> Open Benchmark Window
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.returnToMainApp()">
                        <span>🏠</span> Return to Main App
                        <span style="margin-left: auto; font-size: 11px; color: #6c757d;">Ctrl+M</span>
                    </div>
                    <div class="benchmark-dropdown-separator"></div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.minimizeWindow()">
                        <span>➖</span> Minimize
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.maximizeWindow()">
                        <span>⬜</span> Maximize
                    </div>
                </div>
            </div>

            <!-- Help Menu -->
            <div class="benchmark-menu-item" data-menu="help">
                ❓ Help
                <div class="benchmark-dropdown-menu" id="benchmarkHelpMenu">
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.showDocumentation()">
                        <span>📚</span> Documentation
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.showTestGuide()">
                        <span>📖</span> Test Guide
                    </div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.showKeyboardShortcuts()">
                        <span>⌨️</span> Keyboard Shortcuts
                    </div>
                    <div class="benchmark-dropdown-separator"></div>
                    <div class="benchmark-dropdown-item" onclick="benchmarkMenuManager.showAbout()">
                        <span>ℹ️</span> About Benchmark
                    </div>
                </div>
            </div>

            <!-- Title and Status -->
            <div class="benchmark-menu-title">
                <span class="benchmark-status-indicator" id="benchmarkStatusIndicator"></span>
                🧪 LLM Instruction Following Benchmark
            </div>
        `;

        // Setup menu event handlers
        this.setupBenchmarkMenuHandlers(menuBar);

        return menuBar;
    }

    /**
     * Setup event handlers for benchmark menus
     */
    setupBenchmarkMenuHandlers(menuBar) {
        // Menu dropdown handling
        menuBar.querySelectorAll('.benchmark-menu-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleBenchmarkMenu(item);
            });
        });

        // Close dropdowns when clicking outside
        document.addEventListener('click', () => {
            this.closeAllBenchmarkMenus();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleBenchmarkKeyboardShortcuts(e);
        });
    }

    /**
     * Toggle benchmark menu dropdown
     */
    toggleBenchmarkMenu(menuItem) {
        const menuData = menuItem.dataset.menu;
        const dropdown = document.getElementById('benchmark' + menuData.charAt(0).toUpperCase() + menuData.slice(1) + 'Menu');
        
        // Close other menus
        this.closeAllBenchmarkMenus();
        
        // Toggle current menu
        if (dropdown) {
            dropdown.classList.add('show');
            menuItem.classList.add('active');
        }
    }

    /**
     * Close all benchmark menus
     */
    closeAllBenchmarkMenus() {
        document.querySelectorAll('.benchmark-dropdown-menu').forEach(menu => {
            menu.classList.remove('show');
        });
        document.querySelectorAll('.benchmark-menu-item').forEach(item => {
            item.classList.remove('active');
        });
    }

    /**
     * Handle keyboard shortcuts for benchmark mode
     */
    handleBenchmarkKeyboardShortcuts(e) {
        const isCtrlOrCmd = e.ctrlKey || e.metaKey;
        
        if (isCtrlOrCmd) {
            switch (e.key) {
                case 'n':
                    e.preventDefault();
                    this.newBenchmark();
                    break;
                case 'o':
                    e.preventDefault();
                    this.openBenchmarkResults();
                    break;
                case 's':
                    e.preventDefault();
                    if (e.shiftKey) {
                        this.saveAsReport();
                    } else {
                        this.saveBenchmarkResults();
                    }
                    break;
                case 'e':
                    e.preventDefault();
                    this.exportResults();
                    break;
                case 'c':
                    e.preventDefault();
                    this.copyResults();
                    break;
                case 'a':
                    e.preventDefault();
                    this.selectAllTests();
                    break;
                case 'q':
                    e.preventDefault();
                    this.runQuickBenchmark();
                    break;
                case 'f':
                    e.preventDefault();
                    this.runFullBenchmark();
                    break;
                case 'u':
                    e.preventDefault();
                    this.runCustomBenchmark();
                    break;
                case 't':
                    e.preventDefault();
                    this.openChatBox();
                    break;
                case 'm':
                    e.preventDefault();
                    this.returnToMainApp();
                    break;
                case '.':
                    e.preventDefault();
                    this.stopBenchmark();
                    break;
                case 'p':
                    e.preventDefault();
                    this.pauseBenchmark();
                    break;
                case '1':
                    e.preventDefault();
                    this.showConfiguration();
                    break;
                case '2':
                    e.preventDefault();
                    this.showProgress();
                    break;
                case '3':
                    e.preventDefault();
                    this.showResults();
                    break;
            }
        }
        
        if (e.key === 'Escape') {
            e.preventDefault();
            this.exitBenchmarkMode();
        }
        
        if (e.key === 'F11') {
            e.preventDefault();
            this.toggleFullscreen();
        }
        
        if (e.key === 'F12') {
            e.preventDefault();
            this.openDebugConsole();
        }
    }

    /**
     * Restore original menus
     */
    restoreOriginalMenus() {
        if (!this.originalMenus) {
            console.warn('⚠️ No original menus to restore');
            return;
        }

        // Remove benchmark menu bar
        const benchmarkMenuBar = document.querySelector('.benchmark-menu-bar');
        if (benchmarkMenuBar) {
            benchmarkMenuBar.remove();
        }

        // Restore hidden elements
        const hiddenElements = document.querySelectorAll('[data-benchmark-hidden="true"]');
        hiddenElements.forEach(element => {
            element.style.display = '';
            delete element.dataset.benchmarkHidden;
        });

        // Restore body class
        if (this.originalMenus.bodyClass) {
            document.body.className = this.originalMenus.bodyClass;
        }

        // Restore main content layout
        this.restoreMainContentLayout();
        
        console.log('✅ Original header and menus restored');
    }

    /**
     * Update window title
     */
    updateWindowTitle(title) {
        document.title = title;
        
        // Also update any title elements in the DOM
        const titleElements = document.querySelectorAll('h1, .app-title, .window-title');
        titleElements.forEach(element => {
            if (element.textContent.includes('Genome AI Studio') || 
                element.textContent.includes('LLM Instruction Following Benchmark')) {
                element.textContent = title;
            }
        });
    }

    /**
     * Update UI for benchmark mode
     */
    updateUIForBenchmarkMode() {
        // Add benchmark mode class to body
        document.body.classList.add('benchmark-mode');
        
        // Hide non-essential UI elements
        this.hideNonEssentialElements();
        
        // Show benchmark-specific elements
        this.showBenchmarkElements();
        
        // Update theme
        this.applyBenchmarkTheme();
    }

    /**
     * Restore UI from benchmark mode
     */
    restoreUIFromBenchmarkMode() {
        // Remove benchmark mode class
        document.body.classList.remove('benchmark-mode');
        
        // Show previously hidden elements
        this.showNonEssentialElements();
        
        // Hide benchmark-specific elements
        this.hideBenchmarkElements();
        
        // Restore original theme
        this.restoreOriginalTheme();
    }

    /**
     * Adjust main content for menu bar
     */
    adjustMainContentForMenuBar() {
        const mainContent = document.querySelector('.main-content') || 
                           document.querySelector('#mainContent') || 
                           document.querySelector('main');
        
        if (mainContent) {
            mainContent.style.marginTop = '45px';
            mainContent.style.transition = 'margin-top 0.3s ease';
        }
    }

    /**
     * Restore main content layout
     */
    restoreMainContentLayout() {
        const mainContent = document.querySelector('.main-content') || 
                           document.querySelector('#mainContent') || 
                           document.querySelector('main');
        
        if (mainContent) {
            mainContent.style.marginTop = '';
            mainContent.style.transition = '';
        }
    }

    /**
     * Hide non-essential elements during benchmark mode
     */
    hideNonEssentialElements() {
        const elementsToHide = [
            '.sidebar',
            '.gene-details-panel',
            '.search-panel',
            '.file-panel',
            '.navigation-bar',
            '.genome-navigation-bar'
        ];

        elementsToHide.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                element.style.display = 'none';
                element.dataset.benchmarkHidden = 'true';
            });
        });
    }

    /**
     * Show non-essential elements after benchmark mode
     */
    showNonEssentialElements() {
        const hiddenElements = document.querySelectorAll('[data-benchmark-hidden="true"]');
        hiddenElements.forEach(element => {
            element.style.display = '';
            delete element.dataset.benchmarkHidden;
        });
    }

    /**
     * Show benchmark-specific elements
     */
    showBenchmarkElements() {
        // Create or show benchmark-specific UI elements
        this.createBenchmarkStatusPanel();
        this.createBenchmarkControlPanel();
    }

    /**
     * Hide benchmark-specific elements
     */
    hideBenchmarkElements() {
        const benchmarkElements = document.querySelectorAll('.benchmark-specific');
        benchmarkElements.forEach(element => element.remove());
    }

    /**
     * Apply benchmark theme
     */
    applyBenchmarkTheme() {
        document.body.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
        document.body.classList.add('benchmark-theme');
    }

    /**
     * Restore original theme
     */
    restoreOriginalTheme() {
        document.body.style.background = '';
        document.body.classList.remove('benchmark-theme');
    }

    /**
     * Create benchmark status panel
     */
    createBenchmarkStatusPanel() {
        const existingPanel = document.getElementById('benchmarkStatusPanel');
        if (existingPanel) return;

        const statusPanel = document.createElement('div');
        statusPanel.id = 'benchmarkStatusPanel';
        statusPanel.className = 'benchmark-specific';
        statusPanel.innerHTML = `
            <div style="position: fixed; top: 50px; right: 20px; background: rgba(255,255,255,0.95); padding: 15px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 999; backdrop-filter: blur(10px);">
                <h3 style="margin: 0 0 10px 0; color: #2c3e50; font-size: 14px;">📊 Benchmark Status</h3>
                <div style="font-size: 12px; color: #6c757d;">
                    <div>Status: <span id="benchmarkCurrentStatus" style="font-weight: bold;">Ready</span></div>
                    <div>Tests: <span id="benchmarkTestCount">0</span> loaded</div>
                    <div>Progress: <span id="benchmarkProgress">0%</span></div>
                </div>
            </div>
        `;
        
        document.body.appendChild(statusPanel);
    }

    /**
     * Create benchmark control panel
     */
    createBenchmarkControlPanel() {
        const existingPanel = document.getElementById('benchmarkControlPanel');
        if (existingPanel) return;

        const controlPanel = document.createElement('div');
        controlPanel.id = 'benchmarkControlPanel';
        controlPanel.className = 'benchmark-specific';
        controlPanel.innerHTML = `
            <div style="position: fixed; bottom: 20px; right: 20px; background: rgba(255,255,255,0.95); padding: 15px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.2); z-index: 999; backdrop-filter: blur(10px);">
                <div style="display: flex; gap: 10px;">
                    <button onclick="benchmarkMenuManager.runQuickBenchmark()" style="background: #3498db; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        ⚡ Quick
                    </button>
                    <button onclick="benchmarkMenuManager.stopBenchmark()" style="background: #e74c3c; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;" disabled id="quickStopBtn">
                        ⏹️ Stop
                    </button>
                    <button onclick="benchmarkMenuManager.exitBenchmarkMode()" style="background: #95a5a6; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer; font-size: 12px;">
                        🚪 Exit
                    </button>
                </div>
            </div>
        `;
        
        document.body.appendChild(controlPanel);
    }

    /**
     * Update benchmark status in UI
     */
    updateBenchmarkStatus(status, message, progress = null) {
        // Update status indicator
        const indicator = document.getElementById('benchmarkStatusIndicator');
        if (indicator) {
            indicator.className = 'benchmark-status-indicator ' + status;
        }

        // Update status text
        const statusText = document.getElementById('benchmarkCurrentStatus');
        if (statusText) {
            statusText.textContent = message;
        }

        // Update progress
        if (progress !== null) {
            const progressText = document.getElementById('benchmarkProgress');
            if (progressText) {
                progressText.textContent = Math.round(progress * 100) + '%';
            }
        }

        // Update menu item states
        this.updateMenuItemStates(status);
    }

    /**
     * Update menu item states based on benchmark status
     */
    updateMenuItemStates(status) {
        const stopMenuItem = document.getElementById('stopBenchmarkMenuItem');
        const pauseMenuItem = document.getElementById('pauseBenchmarkMenuItem');
        const quickStopBtn = document.getElementById('quickStopBtn');

        if (status === 'running') {
            if (stopMenuItem) stopMenuItem.classList.remove('disabled');
            if (pauseMenuItem) pauseMenuItem.classList.remove('disabled');
            if (quickStopBtn) quickStopBtn.disabled = false;
        } else {
            if (stopMenuItem) stopMenuItem.classList.add('disabled');
            if (pauseMenuItem) pauseMenuItem.classList.add('disabled');
            if (quickStopBtn) quickStopBtn.disabled = true;
        }
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Listen for benchmark events
        window.addEventListener('benchmark-menu-activate', () => {
            this.activateBenchmarkMenus();
        });

        window.addEventListener('benchmark-menu-deactivate', () => {
            this.deactivateBenchmarkMenus();
        });

        window.addEventListener('benchmark-status-update', (event) => {
            const { status, message, progress } = event.detail;
            this.updateBenchmarkStatus(status, message, progress);
        });
    }

    // Menu Action Methods Implementation
    newBenchmark() { 
        console.log('📝 New Benchmark');
        if (window.app && window.app.benchmarkManager && window.app.benchmarkManager.ui) {
            // Reset benchmark interface
            const configSection = document.getElementById('configSection');
            const progressSection = document.getElementById('progressSection');
            const resultsSection = document.getElementById('resultsSection');
            
            if (configSection) configSection.style.display = 'block';
            if (progressSection) progressSection.style.display = 'none';
            if (resultsSection) resultsSection.style.display = 'none';
            
            // Reset form
            document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = cb.id.includes('basic_operations') || 
                            cb.id.includes('edit_operations') ||
                            cb.id.includes('basic_functions') || 
                            cb.id === 'generateReport' ||
                            cb.id === 'includeCharts';
            });
            
            this.updateBenchmarkStatus('ready', 'New Benchmark Ready');
        }
    }
    
    openBenchmarkResults() { 
        console.log('📂 Open Results');
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = (e) => {
            const file = e.target.files[0];
            if (file) {
                const reader = new FileReader();
                reader.onload = (e) => {
                    try {
                        const results = JSON.parse(e.target.result);
                        if (window.app && window.app.benchmarkManager && window.app.benchmarkManager.ui) {
                            window.app.benchmarkManager.ui.displayMainWindowResults(results);
                        }
                    } catch (error) {
                        alert('Invalid benchmark file format');
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
    
    saveBenchmarkResults() { 
        console.log('💾 Save Results');
        if (window.app && window.app.benchmarkManager && window.app.benchmarkManager.ui) {
            window.app.benchmarkManager.ui.exportMainWindowResults();
        }
    }
    
    saveAsReport() { 
        console.log('📊 Save as Report');
        // Generate HTML report and download
        if (window.app && window.app.benchmarkManager && window.app.benchmarkManager.ui) {
            const results = window.app.benchmarkManager.ui.currentResults;
            if (results) {
                const htmlReport = this.generateHTMLReport(results);
                const blob = new Blob([htmlReport], {type: 'text/html'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = 'benchmark-report-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.html';
                a.click();
                URL.revokeObjectURL(url);
            }
        }
    }
    
    exportResults() { 
        console.log('📤 Export Results');
        this.saveBenchmarkResults();
    }
    
    exportHistory() { 
        console.log('📚 Export History');
        if (window.app && window.app.benchmarkManager && window.app.benchmarkManager.framework) {
            const history = window.app.benchmarkManager.framework.getBenchmarkHistory();
            const blob = new Blob([JSON.stringify(history, null, 2)], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'benchmark-history-' + new Date().toISOString().slice(0, 10) + '.json';
            a.click();
            URL.revokeObjectURL(url);
        }
    }
    
    exitBenchmarkMode() { 
        console.log('🚪 Exit Benchmark Mode');
        this.deactivateBenchmarkMenus();
        if (window.app && window.app.benchmarkManager && window.app.benchmarkManager.ui) {
            window.app.benchmarkManager.ui.exitBenchmarkMode();
        }
    }
    
    copyResults() { 
        console.log('📋 Copy Results');
        if (window.app && window.app.benchmarkManager && window.app.benchmarkManager.ui) {
            const results = window.app.benchmarkManager.ui.currentResults;
            if (results) {
                const text = JSON.stringify(results, null, 2);
                navigator.clipboard.writeText(text).then(() => {
                    this.updateBenchmarkStatus('ready', 'Results copied to clipboard');
                    setTimeout(() => this.updateBenchmarkStatus('ready', 'System Ready'), 2000);
                });
            } else {
                alert('No results to copy');
            }
        }
    }
    
    copySelectedTests() { 
        console.log('📄 Copy Selected Tests');
        alert('Copy Selected Tests - Feature to be implemented');
    }
    
    selectAllTests() { 
        console.log('🎯 Select All Tests');
        document.querySelectorAll('input[id^="suite-"]').forEach(cb => cb.checked = true);
        this.updateBenchmarkStatus('ready', 'All tests selected');
        setTimeout(() => this.updateBenchmarkStatus('ready', 'System Ready'), 2000);
    }
    
    selectFailedTests() { 
        console.log('❌ Select Failed Tests');
        alert('Select Failed Tests - Feature to be implemented');
    }
    
    selectPassedTests() { 
        console.log('✅ Select Passed Tests');
        alert('Select Passed Tests - Feature to be implemented');
    }
    
    clearSelection() { 
        console.log('🔄 Clear Selection');
        document.querySelectorAll('input[id^="suite-"]').forEach(cb => cb.checked = false);
        this.updateBenchmarkStatus('ready', 'Selection cleared');
        setTimeout(() => this.updateBenchmarkStatus('ready', 'System Ready'), 2000);
    }
    
    runQuickBenchmark() { 
        console.log('⚡ Quick Benchmark');
        // Select basic test suites
        document.querySelectorAll('input[id^="suite-"]').forEach(cb => {
            cb.checked = cb.id.includes('basic_operations') || 
                        cb.id.includes('edit_operations') ||
                        cb.id.includes('performance_tests');
        });
        
        // Start benchmark
        if (window.app && window.app.benchmarkManager && window.app.benchmarkManager.ui) {
            window.app.benchmarkManager.ui.startMainWindowBenchmark();
        }
    }
    
    runFullBenchmark() { 
        console.log('🔬 Full Benchmark');
        // Select all test suites
        this.selectAllTests();
        setTimeout(() => {
            if (window.app && window.app.benchmarkManager && window.app.benchmarkManager.ui) {
                window.app.benchmarkManager.ui.startMainWindowBenchmark();
            }
        }, 500);
    }
    
    runCustomBenchmark() { 
        console.log('⚙️ Custom Benchmark');
        // Show configuration section
        const configSection = document.getElementById('configSection');
        if (configSection) {
            configSection.style.display = 'block';
            configSection.scrollIntoView({ behavior: 'smooth' });
        }
    }
    
    runBasicOperationsTest() { 
        console.log('✂️ Basic Operations Test');
        document.querySelectorAll('input[id^="suite-"]').forEach(cb => {
            cb.checked = cb.id.includes('basic_operations');
        });
        
        if (window.app && window.app.benchmarkManager && window.app.benchmarkManager.ui) {
            window.app.benchmarkManager.ui.startMainWindowBenchmark();
        }
    }
    
    runEditOperationsTest() { 
        console.log('📝 Edit Operations Test');
        document.querySelectorAll('input[id^="suite-"]').forEach(cb => {
            cb.checked = cb.id.includes('basic_operations') || 
                        cb.id.includes('edit_operations');
        });
        
        if (window.app && window.app.benchmarkManager && window.app.benchmarkManager.ui) {
            window.app.benchmarkManager.ui.startMainWindowBenchmark();
        }
    }
    
    runPluginIntegrationTest() { 
        console.log('🔌 Plugin Integration Test');
        document.querySelectorAll('input[id^="suite-"]').forEach(cb => {
            cb.checked = cb.id.includes('plugin_integration') || 
                        cb.id.includes('basic_functions');
        });
        
        if (window.app && window.app.benchmarkManager && window.app.benchmarkManager.ui) {
            window.app.benchmarkManager.ui.startMainWindowBenchmark();
        }
    }
    
    stopBenchmark() { 
        console.log('⏹️ Stop Benchmark');
        if (window.app && window.app.benchmarkManager && window.app.benchmarkManager.ui) {
            window.app.benchmarkManager.ui.stopMainWindowBenchmark();
        }
    }
    
    pauseBenchmark() { 
        console.log('⏸️ Pause Benchmark');
        if (window.app && window.app.benchmarkManager && window.app.benchmarkManager.framework) {
            window.app.benchmarkManager.framework.pauseBenchmark();
            this.updateBenchmarkStatus('warning', 'Benchmark Paused');
        }
    }
    
    showConfiguration() { console.log('⚙️ Show Configuration'); }
    showProgress() { console.log('📊 Show Progress'); }
    showResults() { console.log('📈 Show Results'); }
    showOverview() { console.log('📋 Show Overview'); }
    showDetailedResults() { console.log('📄 Show Detailed Results'); }
    showStatistics() { console.log('📊 Show Statistics'); }
    showCharts() { console.log('📈 Show Charts'); }
    showErrorAnalysis() { console.log('🔍 Show Error Analysis'); }
    toggleFullscreen() { 
        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            document.documentElement.requestFullscreen();
        }
    }
    
    validateConfiguration() { console.log('✅ Validate Configuration'); }
    testLLMConnection() { console.log('🔗 Test LLM Connection'); }
    openChatBox() { 
        // Show chatbox if hidden
        const chatbox = document.querySelector('.chatbox') || document.getElementById('chatbox');
        if (chatbox) {
            chatbox.style.display = 'block';
        }
    }
    configureLLM() { console.log('🤖 Configure LLM'); }
    clearHistory() { console.log('🗑️ Clear History'); }
    resetSettings() { console.log('🔄 Reset Settings'); }
    openDebugConsole() {
        if (typeof require !== 'undefined') {
            const { remote } = require('electron');
            remote.getCurrentWindow().webContents.openDevTools();
        }
    }
    
    openBenchmarkWindow() { console.log('🧪 Open Benchmark Window'); }
    returnToMainApp() {
        this.exitBenchmarkMode();
        console.log('🏠 Return to Main App');
    }
    minimizeWindow() {
        if (typeof require !== 'undefined') {
            const { remote } = require('electron');
            remote.getCurrentWindow().minimize();
        }
    }
    maximizeWindow() {
        if (typeof require !== 'undefined') {
            const { remote } = require('electron');
            const window = remote.getCurrentWindow();
            if (window.isMaximized()) {
                window.unmaximize();
            } else {
                window.maximize();
            }
        }
    }
    
    showDocumentation() { console.log('📚 Show Documentation'); }
    showTestGuide() { console.log('📖 Show Test Guide'); }
    showKeyboardShortcuts() {
        alert(`Keyboard Shortcuts:
        
File:
• Ctrl+N - New Benchmark
• Ctrl+O - Open Results  
• Ctrl+S - Save Results
• Ctrl+E - Export Results

Edit:
• Ctrl+C - Copy Results
• Ctrl+A - Select All Tests

Benchmark:
• Ctrl+Q - Quick Benchmark
• Ctrl+F - Full Benchmark
• Ctrl+U - Custom Benchmark
• Ctrl+. - Stop Benchmark

View:
• Ctrl+1 - Configuration
• Ctrl+2 - Progress
• Ctrl+3 - Results

Other:
• Esc - Exit Benchmark Mode
• F11 - Toggle Fullscreen
• F12 - Debug Console`);
    }
    showAbout() { 
        alert(`LLM Instruction Following Benchmark v1.0.0
        
A comprehensive testing framework for evaluating LLM instruction following capabilities in bioinformatics applications.

Features:
• 12 test suites with 140+ individual tests
• Advanced statistical analysis
• Professional reporting
• Real-time progress monitoring
• Export capabilities
• Comprehensive Edit operations testing

© 2024 Genome AI Studio`);
    }
    /**
     * Generate HTML report
     */
    generateHTMLReport(results) {
        const stats = results.overallStats;
        return `
<!DOCTYPE html>
<html>
<head>
    <title>LLM Instruction Following Benchmark Report</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .summary-card { background: #3498db; color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card h3 { margin-bottom: 10px; }
        .summary-card .value { font-size: 24px; font-weight: bold; }
        .suite-result { border: 1px solid #ddd; margin: 15px 0; border-radius: 6px; }
        .suite-header { background: #f8f9fa; padding: 15px; font-weight: bold; }
        .test-result { padding: 10px; margin: 5px 0; border-radius: 4px; }
        .test-result.passed { background: #d4edda; border-left: 4px solid #28a745; }
        .test-result.failed { background: #f8d7da; border-left: 4px solid #dc3545; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🧪 LLM Instruction Following Benchmark Report</h1>
        <p><strong>Generated:</strong> ${new Date().toLocaleString()}</p>
        <p><strong>Duration:</strong> ${Math.round(results.duration / 1000)} seconds</p>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Success Rate</h3>
                <div class="value">${stats.overallSuccessRate.toFixed(1)}%</div>
            </div>
            <div class="summary-card">
                <h3>Tests Passed</h3>
                <div class="value">${stats.passedTests}/${stats.totalTests}</div>
            </div>
            <div class="summary-card">
                <h3>Average Score</h3>
                <div class="value">${stats.scoreStats.percentage.mean.toFixed(1)}%</div>
            </div>
        </div>
        
        <h2>Test Suite Results</h2>
        ${results.testSuiteResults.map(suite => `
            <div class="suite-result">
                <div class="suite-header">${suite.suiteName} - ${(suite.stats.passedTests / suite.stats.totalTests * 100).toFixed(1)}% pass rate</div>
                <div>
                    ${suite.testResults.map(test => `
                        <div class="test-result ${test.success ? 'passed' : 'failed'}">
                            <strong>${test.testName}</strong><br>
                            Score: ${test.score}/${test.maxScore} | Duration: ${test.duration}ms
                        </div>
                    `).join('')}
                </div>
            </div>
        `).join('')}
    </div>
</body>
</html>
        `;
    }
}

// Make available globally
window.BenchmarkMenuManager = BenchmarkMenuManager;
