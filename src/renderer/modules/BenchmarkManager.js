/**
 * Benchmark Manager - Main controller for the LLM benchmark system
 */
class BenchmarkManager {
    constructor(app, chatManager, configManager) {
        this.app = app;
        this.chatManager = chatManager;
        this.configManager = configManager;
        this.framework = null;
        this.ui = null;
        this.isInitialized = false;
        this.initializationPromise = null;
        
        // Initialize asynchronously to avoid blocking
        this.initializationPromise = this.initializeSystem().catch(error => {
            console.error('❌ Benchmark system initialization failed:', error);
            throw error;
        });
        this.setupEventHandlers();
    }

    /**
     * Initialize the benchmark system
     */
    async initializeSystem() {
        try {
            // Check if required classes are available
            if (typeof LLMBenchmarkFramework === 'undefined') {
                console.warn('⚠️ LLMBenchmarkFramework not available, deferring initialization...');
                // Wait and retry
                await new Promise(resolve => setTimeout(resolve, 1000));
                return await this.initializeSystem();
            }

            // Load all test suites
            await this.loadTestSuites();
            
            // Initialize benchmark framework
            console.log('🔧 Creating LLMBenchmarkFramework...');
            this.framework = new LLMBenchmarkFramework(this.chatManager, this.configManager);
            console.log('✅ LLMBenchmarkFramework created');
            
            // Initialize UI
            console.log('🔧 Creating BenchmarkUI...');
            this.ui = new BenchmarkUI(this.framework);
            console.log('✅ BenchmarkUI created');
            
            this.isInitialized = true;
            console.log('✅ Benchmark system initialized successfully');
            console.log('🔍 Final state check:', {
                framework: !!this.framework,
                ui: !!this.ui,
                isInitialized: this.isInitialized
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize benchmark system:', error);
            this.showError('Failed to initialize benchmark system: ' + error.message);
            
            // Retry once after error
            if (!this.isInitialized) {
                await new Promise(resolve => setTimeout(resolve, 2000));
                return await this.initializeSystem();
            }
        }
    }

    /**
     * Load all test suites on demand
     */
    async loadTestSuites() {
        const suites = [
            'AutomaticSimpleSuite',
            'AutomaticComplexSuite',
            'ManualSimpleSuite',
            'ManualComplexSuite'
        ];

        console.log('📦 Loading test suites...');
        let loadedCount = 0;

        for (const suiteName of suites) {
            try {
                // Load suite script if not already loaded
                if (!window[suiteName]) {
                    const scriptPath = `modules/benchmark-suites/${suiteName}.js`;
                    await this.loadScript(scriptPath);
                }
                
                if (window[suiteName]) {
                    loadedCount++;
                    console.log(`✅ Test suite loaded: ${suiteName}`);
                } else {
                    console.warn(`⚠️ Test suite ${suiteName} not available after loading`);
                }
            } catch (error) {
                console.warn(`⚠️ Failed to load test suite ${suiteName}:`, error);
            }
        }

        console.log(`📦 Loaded ${loadedCount}/${suites.length} test suites`);
    }

    /**
     * Load a script dynamically
     */
    async loadScript(src) {
        return new Promise((resolve, reject) => {
            // Check if script is already loaded
            const existingScript = document.querySelector(`script[src="${src}"]`);
            if (existingScript) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = () => {
                console.log(`📜 Script loaded: ${src}`);
                resolve();
            };
            script.onerror = (error) => {
                console.warn(`⚠️ Failed to load script: ${src}`, error);
                reject(new Error(`Failed to load script: ${src}`));
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Setup event handlers
     */
    setupEventHandlers() {
        // Listen for menu actions from main process
        if (window.electronAPI) {
            window.electronAPI.onMenuAction((action, data) => {
                this.handleMenuAction(action, data);
            });
        }

        // Listen for benchmark events (UI-triggered only)
        // Note: Main menu benchmark actions have been removed
    }

    /**
     * Handle menu actions from main process (legacy support)
     * Note: Main menu benchmark actions have been removed
     */
    handleMenuAction(action, data) {
        switch (action) {
            case 'open-benchmark-runner':
                console.warn('Benchmark runner should be accessed via Benchmark & Debug Tools');
                this.openBenchmarkRunner();
                break;
            default:
                console.warn('Unknown benchmark action:', action);
        }
    }

    /**
     * Open benchmark runner window
     */
    async openBenchmarkRunner() {
        // Wait for initialization to complete
        if (!this.isInitialized) {
            console.log('⏳ Waiting for benchmark system initialization...');
            try {
                await this.initializationPromise;
            } catch (error) {
                this.showError('Failed to initialize benchmark system: ' + error.message);
                return;
            }
        }

        // Double-check that UI is available
        if (!this.ui) {
            console.error('❌ BenchmarkUI not available after initialization');
            this.showError('Benchmark UI not properly initialized');
            return;
        }

        await this.ui.showBenchmarkRunner();
    }

    /**
     * Show benchmark interface in main window
     */
    async showBenchmarkInterface() {
        // Wait for initialization to complete
        if (!this.isInitialized) {
            console.log('⏳ Waiting for benchmark system initialization...');
            try {
                await this.initializationPromise;
            } catch (error) {
                this.showError('Failed to initialize benchmark system: ' + error.message);
                return;
            }
        }

        // Double-check that UI is available
        if (!this.ui) {
            console.error('❌ BenchmarkUI not available after initialization');
            this.showError('Benchmark UI not properly initialized');
            return;
        }

        await this.ui.showBenchmarkInterface();
    }

    /**
     * Run quick benchmark with default settings
     */
    async runQuickBenchmark() {
        // Wait for initialization to complete
        if (!this.isInitialized) {
            console.log('⏳ Waiting for benchmark system initialization...');
            try {
                await this.initializationPromise;
            } catch (error) {
                this.showError('Failed to initialize benchmark system: ' + error.message);
                return;
            }
        }

        try {
            const quickOptions = {
                suites: ['automatic_simple'],
                generateReport: true,
                includeCharts: false,
                includeRawData: false,
                timeout: 15000
            };

            this.showInfo('Starting quick benchmark...');
            const results = await this.framework.runAllBenchmarks(quickOptions);
            
            this.showBenchmarkResults(results);
            this.showSuccess('Quick benchmark completed successfully!');
            
        } catch (error) {
            console.error('Quick benchmark failed:', error);
            this.showError('Quick benchmark failed: ' + error.message);
        }
    }

    /**
     * Open custom benchmark configuration
     */
    async openCustomBenchmark() {
        // Wait for initialization to complete
        if (!this.isInitialized) {
            console.log('⏳ Waiting for benchmark system initialization...');
            try {
                await this.initializationPromise;
            } catch (error) {
                this.showError('Failed to initialize benchmark system: ' + error.message);
                return;
            }
        }

        // Create custom benchmark dialog
        const dialog = this.createCustomBenchmarkDialog();
        dialog.style.display = 'block';
    }

    /**
     * Show benchmark history
     */
    async showBenchmarkHistory() {
        // Wait for initialization to complete
        if (!this.isInitialized) {
            console.log('⏳ Waiting for benchmark system initialization...');
            try {
                await this.initializationPromise;
            } catch (error) {
                this.showError('Failed to initialize benchmark system: ' + error.message);
                return;
            }
        }

        const history = this.framework.getBenchmarkHistory();
        this.displayBenchmarkHistory(history);
    }

    /**
     * Export benchmark results
     */
    async exportBenchmarkResults() {
        // Wait for initialization to complete
        if (!this.isInitialized) {
            console.log('⏳ Waiting for benchmark system initialization...');
            try {
                await this.initializationPromise;
            } catch (error) {
                this.showError('Failed to initialize benchmark system: ' + error.message);
                return;
            }
        }

        const history = this.framework.getBenchmarkHistory();
        if (history.length === 0) {
            this.showWarning('No benchmark results to export');
            return;
        }

        try {
            const latestResults = history[history.length - 1];
            const exportData = this.framework.exportResults('json');
            
            // Create download
            const blob = new Blob([exportData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const link = document.createElement('a');
            link.href = url;
            link.download = `llm-benchmark-results-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
            link.click();
            
            URL.revokeObjectURL(url);
            
            this.showSuccess('Benchmark results exported successfully!');
            
        } catch (error) {
            console.error('Export failed:', error);
            this.showError('Failed to export results: ' + error.message);
        }
    }

    /**
     * Create custom benchmark dialog
     */
    createCustomBenchmarkDialog() {
        // Remove existing dialog if present
        const existingDialog = document.getElementById('customBenchmarkDialog');
        if (existingDialog) {
            existingDialog.remove();
        }

        const dialog = document.createElement('div');
        dialog.id = 'customBenchmarkDialog';
        dialog.className = 'benchmark-dialog';
        dialog.innerHTML = `
            <div class="dialog-overlay">
                <div class="dialog-content">
                    <div class="dialog-header">
                        <h2>Custom Benchmark Configuration</h2>
                        <button class="close-btn" onclick="this.closest('.benchmark-dialog').style.display='none'">&times;</button>
                    </div>
                    <div class="dialog-body">
                        <div class="config-section">
                            <h3>Test Suites</h3>
                            <div class="suite-checkboxes">
                                <label><input type="checkbox" value="automatic_simple" checked> ⚙️ Automatic Simple Tests</label>
                                <label><input type="checkbox" value="automatic_complex"> 🔧 Automatic Complex Tests</label>
                                <label><input type="checkbox" value="manual_simple"> 👥 Manual Simple Tests</label>
                                <label><input type="checkbox" value="manual_complex"> 🧠 Manual Complex Tests</label>
                            </div>
                        </div>
                        <div class="config-section">
                            <h3>Options</h3>
                            <label><input type="checkbox" id="customGenerateReport" checked> Generate Report</label>
                            <label><input type="checkbox" id="customIncludeCharts" checked> Include Charts</label>
                            <label><input type="checkbox" id="customIncludeRawData"> Include Raw Data</label>
                            <label><input type="checkbox" id="customStopOnError"> Stop on Error</label>
                        </div>
                        <div class="config-section">
                            <h3>Timeout</h3>
                            <select id="customTimeout">
                                <option value="15000">15 seconds</option>
                                <option value="30000" selected>30 seconds</option>
                                <option value="60000">60 seconds</option>
                                <option value="120000">2 minutes</option>
                                <option value="180000">3 minutes</option>
                                <option value="240000">4 minutes</option>
                                <option value="300000">5 minutes</option>
                            </select>
                        </div>
                    </div>
                    <div class="dialog-footer">
                        <button class="btn btn-secondary" onclick="this.closest('.benchmark-dialog').style.display='none'">Cancel</button>
                        <button class="btn btn-primary" onclick="benchmarkManager.runCustomBenchmark()">Run Benchmark</button>
                    </div>
                </div>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.textContent = `
            .benchmark-dialog {
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                z-index: 10000;
                display: none;
            }
            .dialog-overlay {
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0,0,0,0.5);
                display: flex;
                align-items: center;
                justify-content: center;
            }
            .dialog-content {
                background: white;
                border-radius: 8px;
                width: 90%;
                max-width: 600px;
                max-height: 80%;
                overflow-y: auto;
                box-shadow: 0 10px 30px rgba(0,0,0,0.3);
            }
            .dialog-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 20px;
                border-bottom: 1px solid #e1e8ed;
            }
            .dialog-header h2 {
                margin: 0;
                color: #2c3e50;
            }
            .close-btn {
                background: none;
                border: none;
                font-size: 24px;
                cursor: pointer;
                color: #6c757d;
            }
            .dialog-body {
                padding: 20px;
            }
            .config-section {
                margin-bottom: 25px;
            }
            .config-section h3 {
                color: #34495e;
                margin-bottom: 15px;
                border-bottom: 2px solid #3498db;
                padding-bottom: 5px;
            }
            .suite-checkboxes {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
            }
            .suite-checkboxes label {
                display: flex;
                align-items: center;
                gap: 8px;
                cursor: pointer;
            }
            .dialog-footer {
                display: flex;
                justify-content: flex-end;
                gap: 10px;
                padding: 20px;
                border-top: 1px solid #e1e8ed;
            }
            .btn {
                padding: 10px 20px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                font-weight: 500;
            }
            .btn-primary {
                background: #3498db;
                color: white;
            }
            .btn-secondary {
                background: #95a5a6;
                color: white;
            }
        `;
        
        document.head.appendChild(style);
        document.body.appendChild(dialog);
        
        return dialog;
    }

    /**
     * Run custom benchmark with user-selected options
     */
    async runCustomBenchmark() {
        const dialog = document.getElementById('customBenchmarkDialog');
        if (!dialog) return;

        try {
            // Get selected suites
            const selectedSuites = [];
            dialog.querySelectorAll('.suite-checkboxes input:checked').forEach(checkbox => {
                selectedSuites.push(checkbox.value);
            });

            if (selectedSuites.length === 0) {
                this.showWarning('Please select at least one test suite');
                return;
            }

            // Get options
            const options = {
                suites: selectedSuites,
                generateReport: dialog.querySelector('#customGenerateReport').checked,
                includeCharts: dialog.querySelector('#customIncludeCharts').checked,
                includeRawData: dialog.querySelector('#customIncludeRawData').checked,
                stopOnError: dialog.querySelector('#customStopOnError').checked,
                timeout: parseInt(dialog.querySelector('#customTimeout').value)
            };

            // Close dialog
            dialog.style.display = 'none';

            // Run benchmark
            this.showInfo('Starting custom benchmark...');
            const results = await this.framework.runAllBenchmarks(options);
            
            this.showBenchmarkResults(results);
            this.showSuccess('Custom benchmark completed successfully!');
            
        } catch (error) {
            console.error('Custom benchmark failed:', error);
            this.showError('Custom benchmark failed: ' + error.message);
        }
    }

    /**
     * Display benchmark results
     */
    showBenchmarkResults(results) {
        // Create results window or show in existing UI
        this.openBenchmarkRunner();
        
        // The UI will handle displaying the results
        if (this.ui && this.ui.window && !this.ui.window.closed) {
            // Send results to benchmark window
            this.ui.window.postMessage({
                type: 'benchmark-results',
                data: results
            }, '*');
        }
    }

    /**
     * Display benchmark history
     */
    displayBenchmarkHistory(history) {
        const historyWindow = window.open('', 'BenchmarkHistory', 'width=800,height=600,scrollbars=yes,resizable=yes');
        
        let historyHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Benchmark History</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; }
                    .history-item { border: 1px solid #ddd; margin: 10px 0; padding: 15px; border-radius: 5px; }
                    .history-header { font-weight: bold; color: #2c3e50; margin-bottom: 10px; }
                    .history-stats { color: #6c757d; font-size: 14px; }
                </style>
            </head>
            <body>
                <h1>Benchmark History</h1>
        `;

        if (history.length === 0) {
            historyHTML += '<p>No benchmark history available.</p>';
        } else {
            history.forEach((result, index) => {
                const date = new Date(result.startTime).toLocaleString();
                const duration = Math.round(result.duration / 1000);
                const successRate = result.overallStats.overallSuccessRate.toFixed(1);
                
                historyHTML += `
                    <div class="history-item">
                        <div class="history-header">Benchmark Run #${history.length - index}</div>
                        <div class="history-stats">
                            Date: ${date}<br>
                            Duration: ${duration} seconds<br>
                            Success Rate: ${successRate}%<br>
                            Tests: ${result.overallStats.passedTests}/${result.overallStats.totalTests} passed
                        </div>
                    </div>
                `;
            });
        }

        historyHTML += '</body></html>';
        
        historyWindow.document.write(historyHTML);
        historyWindow.document.close();
    }

    /**
     * Show notification messages
     */
    showSuccess(message) {
        this.showNotification(message, 'success');
    }

    showError(message) {
        this.showNotification(message, 'error');
    }

    showWarning(message) {
        this.showNotification(message, 'warning');
    }

    showInfo(message) {
        this.showNotification(message, 'info');
    }

    showNotification(message, type = 'info') {
        // Use existing notification system if available
        if (this.app && this.app.showNotification) {
            this.app.showNotification(message, type);
        } else {
            // Fallback to console and alert
            console.log(`[${type.toUpperCase()}] ${message}`);
            if (type === 'error') {
                alert('Error: ' + message);
            }
        }
    }

    /**
     * Get benchmark statistics
     */
    getBenchmarkStatistics() {
        if (!this.framework) return null;
        
        const history = this.framework.getBenchmarkHistory();
        if (history.length === 0) return null;

        const latestResults = history[history.length - 1];
        return {
            totalRuns: history.length,
            latestRun: {
                date: new Date(latestResults.startTime).toLocaleString(),
                duration: Math.round(latestResults.duration / 1000),
                successRate: latestResults.overallStats.overallSuccessRate.toFixed(1),
                totalTests: latestResults.overallStats.totalTests,
                passedTests: latestResults.overallStats.passedTests
            },
            averageSuccessRate: history.reduce((sum, result) => 
                sum + result.overallStats.overallSuccessRate, 0) / history.length
        };
    }

    /**
     * Clear all benchmark data
     */
    clearBenchmarkData() {
        if (!this.framework) return;
        
        const confirmed = confirm('Are you sure you want to clear all benchmark history? This action cannot be undone.');
        if (confirmed) {
            this.framework.clearBenchmarkHistory();
            this.showInfo('Benchmark history cleared');
        }
    }

    /**
     * Get system status
     */
    getSystemStatus() {
        return {
            initialized: this.isInitialized,
            frameworkReady: !!this.framework,
            uiReady: !!this.ui,
            chatManagerAvailable: !!this.chatManager,
            testSuitesLoaded: this.framework ? this.framework.testSuites.size : 0,
            initializationPending: !!this.initializationPromise && !this.isInitialized
        };
    }

    /**
     * Wait for initialization to complete (public method for external use)
     */
    async waitForInitialization() {
        if (this.isInitialized) {
            return true;
        }
        
        if (this.initializationPromise) {
            try {
                await this.initializationPromise;
                return this.isInitialized;
            } catch (error) {
                console.error('Initialization failed:', error);
                return false;
            }
        }
        
        return false;
    }
}

// Make available globally
window.BenchmarkManager = BenchmarkManager;
