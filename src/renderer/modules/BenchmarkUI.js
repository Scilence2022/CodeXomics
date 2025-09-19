/**
 * Benchmark UI - User interface for LLM benchmark system
 */
class BenchmarkUI {
    constructor(benchmarkFramework) {
        this.framework = benchmarkFramework;
        this.currentResults = null;
        this.isRunning = false;
        this.window = null;
        this.menuManager = null;
        this.setupEventHandlers();
    }

    /**
     * Show benchmark runner - Replace main window menus instead of opening new window
     */
    async showBenchmarkRunner() {
        console.log('🧪 Activating benchmark mode in main window...');
        
        try {
            // Initialize menu manager if not already done
            if (!this.menuManager) {
                if (typeof BenchmarkMenuManager === 'undefined') {
                    console.error('❌ BenchmarkMenuManager not available');
                    throw new Error('BenchmarkMenuManager not loaded');
                }
                this.menuManager = new BenchmarkMenuManager(this.framework.chatManager.app);
                window.benchmarkMenuManager = this.menuManager;
                console.log('✅ BenchmarkMenuManager initialized');
            }

            // Activate benchmark menus in main window
            console.log('🔄 Activating benchmark menus...');
            this.menuManager.activateBenchmarkMenus();
            
            // Show benchmark interface in main content area
            console.log('🔄 Showing benchmark interface...');
            this.showBenchmarkInterface();
            
            console.log('✅ Benchmark mode activated in main window');
            
        } catch (error) {
            console.error('❌ Failed to activate benchmark mode:', error);
            // Fallback to separate window
            this.showBenchmarkRunnerWindow();
        }
    }

    /**
     * Show benchmark interface in main window
     */
    showBenchmarkInterface() {
        // Get main content area
        const mainContent = document.querySelector('.main-content') || 
                           document.querySelector('#mainContent') || 
                           document.querySelector('main') ||
                           document.body;

        // Create benchmark interface
        const benchmarkInterface = this.createBenchmarkInterface();
        
        // Hide existing content
        this.hideMainContent();
        
        // Add benchmark interface
        mainContent.appendChild(benchmarkInterface);
        
        // Setup interface event handlers
        this.setupBenchmarkInterfaceHandlers();
    }

    /**
     * Fallback: Show benchmark runner in separate window
     */
    showBenchmarkRunnerWindow() {
        if (this.window && !this.window.closed) {
            this.window.focus();
            return;
        }

        const windowFeatures = 'width=1400,height=900,scrollbars=yes,resizable=yes,menubar=no,toolbar=no';
        this.window = window.open('', 'BenchmarkRunner', windowFeatures);
        
        // Generate and write HTML content directly
        this.window.document.write(this.generateBenchmarkHTML());
        this.window.document.close();
        
        // Setup window event handlers
        this.setupWindowEventHandlers();
        
        console.log('🧪 Benchmark runner window opened (fallback mode)');
    }

    /**
     * Load BenchmarkMenuManager module
     */
    async loadBenchmarkMenuManager() {
        return new Promise((resolve, reject) => {
            if (document.querySelector('script[src*="BenchmarkMenuManager"]')) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = 'modules/BenchmarkMenuManager.js';
            script.onload = () => {
                console.log('📜 BenchmarkMenuManager loaded');
                resolve();
            };
            script.onerror = (error) => {
                console.error('❌ Failed to load BenchmarkMenuManager:', error);
                reject(error);
            };
            document.head.appendChild(script);
        });
    }

    /**
     * Create benchmark interface for main window
     */
    createBenchmarkInterface() {
        const benchmarkInterface = document.createElement('div');
        benchmarkInterface.id = 'benchmarkInterface';
        benchmarkInterface.className = 'benchmark-interface';
        benchmarkInterface.innerHTML = `
            <style>
                .benchmark-interface {
                    position: fixed;
                    top: 45px;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                    z-index: 900;
                    overflow-y: auto;
                    padding: 20px;
                }

                .benchmark-container {
                    max-width: 1400px;
                    margin: 0 auto;
                    background: rgba(255, 255, 255, 0.95);
                    border-radius: 15px;
                    padding: 30px;
                    box-shadow: 0 8px 30px rgba(0,0,0,0.15);
                    backdrop-filter: blur(10px);
                }

                .benchmark-header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 3px solid #3498db;
                }

                .benchmark-title {
                    font-size: 28px;
                    font-weight: 700;
                    color: #2c3e50;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 15px;
                }

                .benchmark-subtitle {
                    font-size: 16px;
                    color: #6c757d;
                    font-weight: 400;
                }

                .benchmark-section {
                    background: white;
                    border-radius: 12px;
                    padding: 25px;
                    margin-bottom: 25px;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.08);
                    border: 1px solid rgba(52, 152, 219, 0.1);
                }

                .benchmark-section h2 {
                    color: #2c3e50;
                    font-size: 20px;
                    margin-bottom: 20px;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .config-grid {
                    display: grid;
                    grid-template-columns: 2fr 1fr 1fr;
                    gap: 30px;
                }

                .config-group h3 {
                    color: #34495e;
                    font-size: 16px;
                    font-weight: 600;
                    margin-bottom: 15px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .checkbox-grid {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 10px;
                }

                .checkbox-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    cursor: pointer;
                    font-size: 14px;
                    color: #495057;
                    padding: 8px;
                    border-radius: 6px;
                    transition: background 0.2s ease;
                }

                .checkbox-item:hover {
                    background: #f8f9fa;
                }

                .checkbox-item input[type="checkbox"] {
                    width: 18px;
                    height: 18px;
                    accent-color: #3498db;
                }

                .form-group {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .form-item {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    font-size: 14px;
                }

                select {
                    padding: 10px 12px;
                    border: 2px solid #e1e8ed;
                    border-radius: 6px;
                    font-size: 14px;
                    background: white;
                    width: 100%;
                }

                .btn-group {
                    display: flex;
                    justify-content: center;
                    gap: 15px;
                    margin-top: 25px;
                }

                .btn {
                    padding: 12px 24px;
                    border: none;
                    border-radius: 8px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.3s ease;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .btn:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 6px 20px rgba(0,0,0,0.2);
                }

                .btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                .btn-primary {
                    background: linear-gradient(135deg, #3498db 0%, #2980b9 100%);
                    color: white;
                }

                .btn-danger {
                    background: linear-gradient(135deg, #e74c3c 0%, #c0392b 100%);
                    color: white;
                }

                .btn-success {
                    background: linear-gradient(135deg, #27ae60 0%, #229954 100%);
                    color: white;
                }

                .progress-container {
                    margin-bottom: 20px;
                }

                .progress-bar {
                    width: 100%;
                    height: 12px;
                    background: #ecf0f1;
                    border-radius: 6px;
                    overflow: hidden;
                    margin-bottom: 15px;
                }

                .progress-fill {
                    height: 100%;
                    background: linear-gradient(90deg, #3498db 0%, #27ae60 100%);
                    width: 0%;
                    transition: width 0.3s ease;
                }

                .progress-info {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
                    gap: 15px;
                }

                .progress-item {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 10px 15px;
                    background: #f8f9fa;
                    border-radius: 6px;
                    border-left: 4px solid #3498db;
                }

                .progress-label {
                    color: #6c757d;
                    font-weight: 500;
                    font-size: 13px;
                }

                .progress-value {
                    color: #2c3e50;
                    font-weight: 700;
                    font-size: 14px;
                }

                .results-summary {
                    display: grid;
                    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
                    gap: 20px;
                    margin-bottom: 25px;
                }

                .summary-card {
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 25px;
                    border-radius: 12px;
                    text-align: center;
                    box-shadow: 0 6px 25px rgba(102, 126, 234, 0.3);
                }

                .summary-card h3 {
                    font-size: 16px;
                    margin-bottom: 10px;
                    opacity: 0.9;
                }

                .summary-card .value {
                    font-size: 32px;
                    font-weight: bold;
                    margin-bottom: 5px;
                }

                .summary-card .unit {
                    font-size: 14px;
                    opacity: 0.8;
                }
            </style>

            <div class="benchmark-container">
                <div class="benchmark-header">
                    <h1 class="benchmark-title">
                        <span>🧪</span>
                        LLM Instruction Following Benchmark
                        <span>🧪</span>
                    </h1>
                    <p class="benchmark-subtitle">Comprehensive testing of LLM instruction following capabilities in Genome AI Studio</p>
                </div>

                <!-- Configuration Section -->
                <div class="benchmark-section" id="configSection">
                    <h2>⚙️ Configuration</h2>
                    <div class="config-grid">
                        <div class="config-group">
                            <h3>📋 Test Suites</h3>
                            <div class="checkbox-grid">
                                <label class="checkbox-item">
                                    <input type="checkbox" id="suite-basic_operations" checked>
                                    <span>✂️ Basic Operations</span>
                                </label>
                                <label class="checkbox-item">
                                    <input type="checkbox" id="suite-edit_operations" checked>
                                    <span>📝 Edit Operations</span>
                                </label>
                                <label class="checkbox-item">
                                    <input type="checkbox" id="suite-basic_functions" checked>
                                    <span>🔧 Basic Functions</span>
                                </label>
                                <label class="checkbox-item">
                                    <input type="checkbox" id="suite-parameter_handling" checked>
                                    <span>📊 Parameter Handling</span>
                                </label>
                                <label class="checkbox-item">
                                    <input type="checkbox" id="suite-performance_tests" checked>
                                    <span>⚡ Performance Tests</span>
                                </label>
                                <label class="checkbox-item">
                                    <input type="checkbox" id="suite-complex_analysis">
                                    <span>🔬 Complex Analysis</span>
                                </label>
                                <label class="checkbox-item">
                                    <input type="checkbox" id="suite-plugin_integration">
                                    <span>🔌 Plugin Integration</span>
                                </label>
                                <label class="checkbox-item">
                                    <input type="checkbox" id="suite-error_recovery">
                                    <span>🛡️ Error Recovery</span>
                                </label>
                            </div>
                        </div>
                        <div class="config-group">
                            <h3>⚙️ Options</h3>
                            <div class="form-group">
                                <label class="form-item">
                                    <input type="checkbox" id="generateReport" checked>
                                    <span>📊 Generate Report</span>
                                </label>
                                <label class="form-item">
                                    <input type="checkbox" id="includeCharts" checked>
                                    <span>📈 Include Charts</span>
                                </label>
                                <label class="form-item">
                                    <input type="checkbox" id="includeRawData">
                                    <span>📋 Include Raw Data</span>
                                </label>
                                <label class="form-item">
                                    <input type="checkbox" id="stopOnError">
                                    <span>🛑 Stop on Error</span>
                                </label>
                                <label class="form-item">
                                    <input type="checkbox" id="verboseLogging">
                                    <span>📝 Verbose Logging</span>
                                </label>
                            </div>
                        </div>
                        <div class="config-group">
                            <h3>⏱️ Settings</h3>
                            <div class="form-group">
                                <div>
                                    <label style="display: block; margin-bottom: 8px; color: #34495e; font-weight: 500;">Test Timeout:</label>
                                    <select id="testTimeout">
                                        <option value="15000">15 seconds</option>
                                        <option value="30000" selected>30 seconds</option>
                                        <option value="60000">60 seconds</option>
                                        <option value="120000">120 seconds</option>
                                    </select>
                                </div>
                                <div>
                                    <label style="display: block; margin-bottom: 8px; color: #34495e; font-weight: 500;">Concurrency:</label>
                                    <select id="concurrency">
                                        <option value="1" selected>Sequential</option>
                                        <option value="2">2 parallel tests</option>
                                        <option value="3">3 parallel tests</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="btn-group">
                        <button class="btn btn-primary" id="startBenchmark">
                            <span>▶️</span> Start Benchmark
                        </button>
                        <button class="btn btn-danger" id="stopBenchmark" disabled>
                            <span>⏹️</span> Stop
                        </button>
                        <button class="btn btn-success" id="exportResults" disabled>
                            <span>📊</span> Export Results
                        </button>
                    </div>
                </div>

                <!-- Progress Section -->
                <div class="benchmark-section" id="progressSection" style="display: none;">
                    <h2>📊 Progress</h2>
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progressFill"></div>
                        </div>
                        <div class="progress-info">
                            <div class="progress-item">
                                <span class="progress-label">Current Suite:</span>
                                <span class="progress-value" id="currentSuite">-</span>
                            </div>
                            <div class="progress-item">
                                <span class="progress-label">Current Test:</span>
                                <span class="progress-value" id="currentTest">-</span>
                            </div>
                            <div class="progress-item">
                                <span class="progress-label">Completed:</span>
                                <span class="progress-value" id="completedTests">0</span>
                            </div>
                            <div class="progress-item">
                                <span class="progress-label">Passed:</span>
                                <span class="progress-value" id="passedTests">0</span>
                            </div>
                            <div class="progress-item">
                                <span class="progress-label">Failed:</span>
                                <span class="progress-value" id="failedTests">0</span>
                            </div>
                            <div class="progress-item">
                                <span class="progress-label">Elapsed:</span>
                                <span class="progress-value" id="elapsedTime">00:00</span>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Results Section -->
                <div class="benchmark-section" id="resultsSection" style="display: none;">
                    <h2>📈 Results</h2>
                    <div class="results-summary" id="resultsSummary"></div>
                    <div id="resultsContent"></div>
                </div>
            </div>
        `;

        return benchmarkInterface;
    }

    /**
     * Hide main content when benchmark interface is active
     */
    hideMainContent() {
        const elementsToHide = [
            '.genome-browser-container',
            '.genome-content', 
            '.main-canvas-container',
            '.sidebar',
            '.chatbox',
            '#app > *:not(.benchmark-menu-bar):not(#benchmarkInterface)',
            '.main-content',
            '.content-area',
            '.genome-viewer',
            '.tab-container'
        ];

        elementsToHide.forEach(selector => {
            const elements = document.querySelectorAll(selector);
            elements.forEach(element => {
                // Skip if it's the benchmark interface itself
                if (element.id === 'benchmarkInterface' || 
                    element.classList.contains('benchmark-menu-bar') ||
                    element.classList.contains('benchmark-interface')) {
                    return;
                }
                
                if (!element.dataset.originalDisplay) {
                    element.dataset.originalDisplay = element.style.display || getComputedStyle(element).display;
                }
                element.style.display = 'none';
                element.dataset.benchmarkHidden = 'true';
            });
        });
        
        console.log('🙈 Main content hidden for benchmark mode');
    }

    /**
     * Show main content when exiting benchmark mode
     */
    showMainContent() {
        const hiddenElements = document.querySelectorAll('[data-benchmark-hidden="true"]');
        hiddenElements.forEach(element => {
            element.style.display = element.dataset.originalDisplay || '';
            delete element.dataset.originalDisplay;
            delete element.dataset.benchmarkHidden;
        });
        
        console.log('👁️ Main content restored');
    }

    /**
     * Setup benchmark interface event handlers
     */
    setupBenchmarkInterfaceHandlers() {
        // Button handlers
        document.getElementById('startBenchmark').onclick = () => this.startMainWindowBenchmark();
        document.getElementById('stopBenchmark').onclick = () => this.stopMainWindowBenchmark();
        document.getElementById('exportResults').onclick = () => this.exportMainWindowResults();
    }

    /**
     * Start benchmark in main window
     */
    async startMainWindowBenchmark() {
        if (this.isRunning) return;

        try {
            this.isRunning = true;
            
            // Update UI
            document.getElementById('startBenchmark').disabled = true;
            document.getElementById('stopBenchmark').disabled = false;
            document.getElementById('progressSection').style.display = 'block';
            
            // Update menu status
            if (this.menuManager) {
                this.menuManager.updateBenchmarkStatus('running', 'Running Benchmark');
            }
            
            // Get configuration
            const options = this.getBenchmarkConfiguration();
            
            console.log('🧪 Starting benchmark in main window:', options);
            
            // Run benchmark
            const results = await this.framework.runAllBenchmarks(options);
            
            this.currentResults = results;
            this.displayMainWindowResults(results);
            
            if (this.menuManager) {
                this.menuManager.updateBenchmarkStatus('ready', 'Benchmark Completed');
            }
            
        } catch (error) {
            console.error('❌ Benchmark failed:', error);
            if (this.menuManager) {
                this.menuManager.updateBenchmarkStatus('error', 'Benchmark Failed');
            }
            alert('Benchmark failed: ' + error.message);
        } finally {
            this.isRunning = false;
            document.getElementById('startBenchmark').disabled = false;
            document.getElementById('stopBenchmark').disabled = true;
            document.getElementById('exportResults').disabled = false;
        }
    }

    /**
     * Stop benchmark in main window
     */
    stopMainWindowBenchmark() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        if (this.framework) {
            this.framework.stopBenchmark();
        }
        
        // Update UI
        document.getElementById('startBenchmark').disabled = false;
        document.getElementById('stopBenchmark').disabled = true;
        
        if (this.menuManager) {
            this.menuManager.updateBenchmarkStatus('ready', 'Benchmark Stopped');
        }
        
        console.log('⏹️ Benchmark stopped in main window');
    }

    /**
     * Export results from main window
     */
    exportMainWindowResults() {
        if (!this.currentResults) {
            alert('No results to export');
            return;
        }
        
        const blob = new Blob([JSON.stringify(this.currentResults, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'benchmark-results-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.json';
        a.click();
        URL.revokeObjectURL(url);
        
        console.log('📤 Results exported from main window');
    }

    /**
     * Get benchmark configuration from UI
     */
    getBenchmarkConfiguration() {
        const selectedSuites = [];
        document.querySelectorAll('input[id^="suite-"]:checked').forEach(cb => {
            selectedSuites.push(cb.id.replace('suite-', ''));
        });

        return {
            suites: selectedSuites,
            generateReport: document.getElementById('generateReport').checked,
            includeCharts: document.getElementById('includeCharts').checked,
            includeRawData: document.getElementById('includeRawData')?.checked || false,
            stopOnError: document.getElementById('stopOnError').checked,
            verboseLogging: document.getElementById('verboseLogging')?.checked || false,
            timeout: parseInt(document.getElementById('testTimeout').value),
            concurrency: parseInt(document.getElementById('concurrency')?.value || '1'),
            onProgress: (progress, suiteId, suiteResult) => {
                this.updateMainWindowProgress(progress, suiteId, suiteResult);
            },
            onTestProgress: (progress, testId, testResult, suiteId) => {
                this.updateMainWindowTestProgress(progress, testId, testResult, suiteId);
            }
        };
    }

    /**
     * Update progress in main window
     */
    updateMainWindowProgress(progress, suiteId, suiteResult) {
        const progressFill = document.getElementById('progressFill');
        const currentSuite = document.getElementById('currentSuite');
        
        if (progressFill) progressFill.style.width = (progress * 100) + '%';
        if (currentSuite) currentSuite.textContent = suiteId || '-';
        
        if (suiteResult) {
            const completed = parseInt(document.getElementById('completedTests')?.textContent || '0') + suiteResult.stats.totalTests;
            const passed = parseInt(document.getElementById('passedTests')?.textContent || '0') + suiteResult.stats.passedTests;
            const failed = parseInt(document.getElementById('failedTests')?.textContent || '0') + suiteResult.stats.failedTests;
            
            if (document.getElementById('completedTests')) document.getElementById('completedTests').textContent = completed;
            if (document.getElementById('passedTests')) document.getElementById('passedTests').textContent = passed;
            if (document.getElementById('failedTests')) document.getElementById('failedTests').textContent = failed;
        }

        // Update menu status
        if (this.menuManager) {
            this.menuManager.updateBenchmarkStatus('running', 'Running: ' + (suiteId || 'Starting...'), progress);
        }
    }

    /**
     * Update test progress in main window
     */
    updateMainWindowTestProgress(progress, testId, testResult, suiteId) {
        const currentTest = document.getElementById('currentTest');
        if (currentTest) currentTest.textContent = testId || '-';
        
        // Update elapsed time
        const elapsedTime = document.getElementById('elapsedTime');
        if (elapsedTime && this.startTime) {
            const elapsed = Date.now() - this.startTime;
            const minutes = Math.floor(elapsed / 60000);
            const seconds = Math.floor((elapsed % 60000) / 1000);
            elapsedTime.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
    }

    /**
     * Display results in main window
     */
    displayMainWindowResults(results) {
        const resultsSection = document.getElementById('resultsSection');
        const resultsSummary = document.getElementById('resultsSummary');
        const resultsContent = document.getElementById('resultsContent');
        
        if (resultsSection) resultsSection.style.display = 'block';
        
        const stats = results.overallStats;
        
        // Display summary cards
        if (resultsSummary) {
            resultsSummary.innerHTML = `
                <div class="summary-card">
                    <h3>Overall Success Rate</h3>
                    <div class="value">${stats.overallSuccessRate.toFixed(1)}</div>
                    <div class="unit">%</div>
                </div>
                <div class="summary-card">
                    <h3>Tests Passed</h3>
                    <div class="value">${stats.passedTests}</div>
                    <div class="unit">/ ${stats.totalTests}</div>
                </div>
                <div class="summary-card">
                    <h3>Average Score</h3>
                    <div class="value">${stats.scoreStats.percentage.mean.toFixed(1)}</div>
                    <div class="unit">%</div>
                </div>
                <div class="summary-card">
                    <h3>Duration</h3>
                    <div class="value">${Math.round(results.duration / 1000)}</div>
                    <div class="unit">seconds</div>
                </div>
            `;
        }
        
        // Display detailed results
        if (resultsContent) {
            resultsContent.innerHTML = `
                <h3 style="color: #2c3e50; margin-bottom: 15px;">📋 Detailed Results</h3>
                ${results.testSuiteResults.map(suite => `
                    <div style="border: 1px solid #ddd; border-radius: 8px; margin: 15px 0; overflow: hidden;">
                        <div style="background: #f8f9fa; padding: 20px; font-weight: bold; cursor: pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                            <div style="display: flex; justify-content: space-between; align-items: center;">
                                <span>${suite.suiteName}</span>
                                <span style="font-size: 14px; color: #6c757d;">
                                    ${(suite.stats.passedTests / suite.stats.totalTests * 100).toFixed(1)}% pass rate | 
                                    ${Math.round(suite.duration / 1000)}s
                                </span>
                            </div>
                        </div>
                        <div style="padding: 20px; display: none;">
                            ${suite.testResults.map(test => `
                                <div style="padding: 12px; margin: 8px 0; border-radius: 6px; background: ${test.success ? '#d4edda' : '#f8d7da'}; border-left: 4px solid ${test.success ? '#28a745' : '#dc3545'};">
                                    <div style="font-weight: bold; margin-bottom: 5px;">${test.testName}</div>
                                    <div style="font-size: 13px; color: #6c757d;">
                                        Score: ${test.score}/${test.maxScore} | 
                                        Duration: ${test.duration}ms | 
                                        Status: ${test.status}
                                    </div>
                                    ${test.errors.length > 0 ? `<div style="font-size: 12px; color: #dc3545; margin-top: 5px;">Errors: ${test.errors.join(', ')}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `).join('')}
            `;
        }
    }

    /**
     * Exit benchmark mode and restore main app
     */
    exitBenchmarkMode() {
        console.log('🚪 Exiting benchmark mode...');
        
        try {
            // Remove benchmark interface
            const benchmarkInterface = document.getElementById('benchmarkInterface');
            if (benchmarkInterface) {
                benchmarkInterface.remove();
            }

            // Show main content
            this.showMainContent();

            // Deactivate benchmark menus
            if (this.menuManager) {
                this.menuManager.deactivateBenchmarkMenus();
            }

            console.log('✅ Benchmark mode exited, main app restored');
            
        } catch (error) {
            console.error('❌ Failed to exit benchmark mode:', error);
        }
    }

    /**
     * Generate complete benchmark HTML with menu system
     */
    generateBenchmarkHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LLM Instruction Following Benchmark - Genome AI Studio</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: #333;
            line-height: 1.6;
            height: 100vh;
            overflow: hidden;
        }

        .menu-bar {
            background: linear-gradient(135deg, #2c3e50 0%, #34495e 100%);
            color: white;
            padding: 0;
            border-bottom: 2px solid #3498db;
            display: flex;
            align-items: center;
            height: 40px;
            position: relative;
            z-index: 1000;
        }

        .menu-item {
            padding: 10px 15px;
            cursor: pointer;
            transition: background 0.3s ease;
            position: relative;
            height: 100%;
            display: flex;
            align-items: center;
        }

        .menu-item:hover { background: rgba(52, 152, 219, 0.3); }
        .menu-item.active { background: rgba(52, 152, 219, 0.5); }

        .dropdown-menu {
            position: absolute;
            top: 100%;
            left: 0;
            background: white;
            border: 1px solid #ddd;
            border-radius: 0 0 5px 5px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            display: none;
            min-width: 200px;
            z-index: 1001;
        }

        .dropdown-menu.show { display: block; }

        .dropdown-item {
            padding: 10px 15px;
            cursor: pointer;
            color: #333;
            border-bottom: 1px solid #f0f0f0;
            transition: background 0.2s ease;
        }

        .dropdown-item:hover { background: #f8f9fa; }
        .dropdown-separator { height: 1px; background: #e9ecef; margin: 5px 0; }

        button {
            border: none;
            border-radius: 6px;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 500;
        }

        button:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(0,0,0,0.15); }
        button:disabled { opacity: 0.5; cursor: not-allowed; transform: none; box-shadow: none; }
    </style>
</head>
<body>
    <!-- Menu Bar -->
    <div class="menu-bar">
        <div class="menu-item" data-menu="file">
            File
            <div class="dropdown-menu" id="fileMenu">
                <div class="dropdown-item" onclick="benchmarkApp.newBenchmark()">🆕 New Benchmark</div>
                <div class="dropdown-item" onclick="benchmarkApp.saveBenchmark()">💾 Save Results</div>
                <div class="dropdown-item" onclick="benchmarkApp.exportResults()">📤 Export Results</div>
                <div class="dropdown-separator"></div>
                <div class="dropdown-item" onclick="benchmarkApp.closeWindow()">❌ Close</div>
            </div>
        </div>

        <div class="menu-item" data-menu="edit">
            Edit
            <div class="dropdown-menu" id="editMenu">
                <div class="dropdown-item" onclick="benchmarkApp.copyResults()">📋 Copy Results</div>
                <div class="dropdown-item" onclick="benchmarkApp.selectAllTests()">🎯 Select All Tests</div>
                <div class="dropdown-item" onclick="benchmarkApp.clearSelection()">🔄 Clear Selection</div>
            </div>
        </div>

        <div class="menu-item" data-menu="benchmark">
            Benchmark
            <div class="dropdown-menu" id="benchmarkMenu">
                <div class="dropdown-item" onclick="benchmarkApp.runQuickBenchmark()">⚡ Quick Benchmark</div>
                <div class="dropdown-item" onclick="benchmarkApp.runEditOperationsTest()">📝 Edit Operations Test</div>
                <div class="dropdown-separator"></div>
                <div class="dropdown-item" onclick="benchmarkApp.stopBenchmark()" id="stopBenchmarkMenu">⏹️ Stop Benchmark</div>
            </div>
        </div>

        <div class="menu-item" data-menu="help">
            Help
            <div class="dropdown-menu" id="helpMenu">
                <div class="dropdown-item" onclick="benchmarkApp.showAbout()">ℹ️ About</div>
            </div>
        </div>

        <div style="margin-left: auto; padding-right: 15px; display: flex; align-items: center; gap: 8px; font-size: 12px;">
            <span id="statusIndicator" style="width: 8px; height: 8px; border-radius: 50%; background: #27ae60;"></span>
            <span id="statusText">Ready</span>
        </div>
    </div>

    <!-- Main Container -->
    <div style="height: calc(100vh - 40px); display: flex; flex-direction: column;">
        <!-- Header -->
        <div style="background: rgba(255, 255, 255, 0.95); padding: 20px 30px; border-bottom: 1px solid rgba(0,0,0,0.1);">
            <h1 style="color: #2c3e50; font-size: 24px; margin-bottom: 5px;">🧪 LLM Instruction Following Benchmark</h1>
            <div style="color: #6c757d; font-size: 14px;">Comprehensive testing of LLM instruction following capabilities</div>
        </div>

        <!-- Content -->
        <div style="flex: 1; padding: 20px; overflow-y: auto; background: rgba(255, 255, 255, 0.9);">
            <!-- Configuration Section -->
            <div id="configSection" style="background: white; border-radius: 12px; padding: 25px; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                <h2 style="color: #2c3e50; font-size: 18px; margin-bottom: 15px; border-bottom: 2px solid #3498db; padding-bottom: 8px;">⚙️ Configuration</h2>
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 25px;">
                    <div>
                        <h3 style="color: #34495e; font-size: 14px; margin-bottom: 12px;">Test Suites</h3>
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                                <input type="checkbox" id="suite-basic_operations" checked> Basic Operations
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                                <input type="checkbox" id="suite-edit_operations" checked> Edit Operations
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                                <input type="checkbox" id="suite-basic_functions" checked> Basic Functions
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                                <input type="checkbox" id="suite-parameter_handling" checked> Parameter Handling
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                                <input type="checkbox" id="suite-performance_tests" checked> Performance Tests
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 13px;">
                                <input type="checkbox" id="suite-complex_analysis"> Complex Analysis
                            </label>
                        </div>
                    </div>
                    <div>
                        <h3 style="color: #34495e; font-size: 14px; margin-bottom: 12px;">Options</h3>
                        <div style="display: flex; flex-direction: column; gap: 8px;">
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                                <input type="checkbox" id="generateReport" checked> Generate Report
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                                <input type="checkbox" id="includeCharts" checked> Include Charts
                            </label>
                            <label style="display: flex; align-items: center; gap: 8px; font-size: 13px;">
                                <input type="checkbox" id="stopOnError"> Stop on Error
                            </label>
                        </div>
                        <div style="margin-top: 15px;">
                            <label style="color: #34495e; font-size: 14px; margin-bottom: 8px; display: block;">Timeout:</label>
                            <select id="testTimeout" style="width: 100%; padding: 8px; border: 1px solid #ddd; border-radius: 4px;">
                                <option value="15000">15 seconds</option>
                                <option value="30000" selected>30 seconds</option>
                                <option value="60000">60 seconds</option>
                            </select>
                        </div>
                    </div>
                </div>
                
                <div style="margin-top: 20px; text-align: center;">
                    <button id="startBenchmark" style="background: #3498db; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin: 0 5px;">
                        ▶️ Start Benchmark
                    </button>
                    <button id="stopBenchmark" style="background: #e74c3c; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin: 0 5px;" disabled>
                        ⏹️ Stop
                    </button>
                    <button id="exportResults" style="background: #27ae60; color: white; border: none; padding: 12px 24px; border-radius: 6px; cursor: pointer; margin: 0 5px;" disabled>
                        📊 Export
                    </button>
                </div>
            </div>

            <!-- Progress Section -->
            <div id="progressSection" style="background: white; border-radius: 12px; padding: 25px; margin-bottom: 20px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); display: none;">
                <h2 style="color: #2c3e50; font-size: 18px; margin-bottom: 15px;">📊 Progress</h2>
                <div style="margin-bottom: 15px;">
                    <div style="width: 100%; height: 8px; background: #ecf0f1; border-radius: 4px; overflow: hidden;">
                        <div id="progressFill" style="height: 100%; background: linear-gradient(90deg, #3498db 0%, #27ae60 100%); width: 0%; transition: width 0.3s ease;"></div>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px;">
                    <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f8f9fa; border-radius: 4px;">
                        <span style="color: #6c757d;">Current Suite:</span>
                        <span id="currentSuite" style="color: #2c3e50; font-weight: 600;">-</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f8f9fa; border-radius: 4px;">
                        <span style="color: #6c757d;">Current Test:</span>
                        <span id="currentTest" style="color: #2c3e50; font-weight: 600;">-</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f8f9fa; border-radius: 4px;">
                        <span style="color: #6c757d;">Completed:</span>
                        <span id="completedTests" style="color: #2c3e50; font-weight: 600;">0</span>
                    </div>
                    <div style="display: flex; justify-content: space-between; padding: 8px 12px; background: #f8f9fa; border-radius: 4px;">
                        <span style="color: #6c757d;">Passed:</span>
                        <span id="passedTests" style="color: #2c3e50; font-weight: 600;">0</span>
                    </div>
                </div>
            </div>

            <!-- Results Section -->
            <div id="resultsSection" style="background: white; border-radius: 12px; padding: 25px; box-shadow: 0 4px 20px rgba(0,0,0,0.1); display: none;">
                <h2 style="color: #2c3e50; font-size: 18px; margin-bottom: 15px;">📈 Results</h2>
                <div id="resultsContent"></div>
            </div>
        </div>
    </div>

    <script>
        class BenchmarkApp {
            constructor() {
                this.isRunning = false;
                this.currentResults = null;
                this.benchmarkManager = null;
                this.startTime = null;
                
                this.initializeApp();
                this.setupEventListeners();
            }

                async initializeApp() {
                    try {
                        // Try different ways to access the parent application
                        let parentApp = null;
                        
                        if (window.opener) {
                            parentApp = window.opener.genomeBrowser || 
                                       window.opener.genomeApp || 
                                       window.opener.app;
                        }
                        
                        if (parentApp && typeof parentApp.initializeBenchmarkSystemOnDemand === 'function') {
                            console.log('🔗 Connecting to parent application...');
                            this.benchmarkManager = await parentApp.initializeBenchmarkSystemOnDemand();
                            
                            if (this.benchmarkManager) {
                                this.updateStatus('ready', 'System Ready');
                                console.log('✅ Benchmark system connected');
                            } else {
                                throw new Error('Failed to initialize benchmark system');
                            }
                        } else {
                            throw new Error('Parent application not available or missing initializeBenchmarkSystemOnDemand method');
                        }
                    } catch (error) {
                        console.error('❌ Failed to initialize:', error);
                        this.updateStatus('error', 'Initialization Failed');
                        alert('Failed to connect to parent application: ' + error.message);
                    }
                }

            setupEventListeners() {
                // Menu handling
                document.querySelectorAll('.menu-item').forEach(item => {
                    item.addEventListener('click', (e) => {
                        e.stopPropagation();
                        this.toggleMenu(item);
                    });
                });

                document.addEventListener('click', () => this.closeAllMenus());

                // Button handlers
                document.getElementById('startBenchmark').onclick = () => this.startBenchmark();
                document.getElementById('stopBenchmark').onclick = () => this.stopBenchmark();
                document.getElementById('exportResults').onclick = () => this.exportResults();

                // Keyboard shortcuts
                document.addEventListener('keydown', (e) => {
                    if (e.ctrlKey || e.metaKey) {
                        switch (e.key) {
                            case 'n': e.preventDefault(); this.newBenchmark(); break;
                            case 's': e.preventDefault(); this.saveBenchmark(); break;
                            case 'c': e.preventDefault(); this.copyResults(); break;
                            case 'a': e.preventDefault(); this.selectAllTests(); break;
                        }
                    }
                });
            }

            toggleMenu(menuItem) {
                const menuData = menuItem.dataset.menu;
                const dropdown = document.getElementById(menuData + 'Menu');
                
                this.closeAllMenus();
                dropdown.classList.add('show');
                menuItem.classList.add('active');
            }

            closeAllMenus() {
                document.querySelectorAll('.dropdown-menu').forEach(menu => menu.classList.remove('show'));
                document.querySelectorAll('.menu-item').forEach(item => item.classList.remove('active'));
            }

            updateStatus(type, message) {
                const indicator = document.getElementById('statusIndicator');
                const text = document.getElementById('statusText');
                
                const colors = {
                    ready: '#27ae60',
                    running: '#f39c12', 
                    error: '#e74c3c'
                };
                
                indicator.style.background = colors[type] || colors.ready;
                text.textContent = message;
            }

            // File Menu Actions
            newBenchmark() {
                if (this.isRunning) {
                    if (!confirm('Stop current benchmark and create new one?')) return;
                    this.stopBenchmark();
                }
                
                // Reset configuration
                document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                    cb.checked = cb.id.includes('basic_operations') || 
                                cb.id.includes('edit_operations') ||
                                cb.id.includes('basic_functions') || 
                                cb.id === 'generateReport' ||
                                cb.id === 'includeCharts';
                });
                
                // Show config section
                document.getElementById('configSection').style.display = 'block';
                document.getElementById('progressSection').style.display = 'none';
                document.getElementById('resultsSection').style.display = 'none';
                
                this.updateStatus('ready', 'New Benchmark Ready');
            }

            saveBenchmark() {
                if (!this.currentResults) {
                    alert('No results to save');
                    return;
                }
                this.downloadJSON(this.currentResults, 'benchmark-results');
            }

            exportResults() {
                if (!this.currentResults) {
                    alert('No results to export');
                    return;
                }
                this.downloadJSON(this.currentResults, 'benchmark-export');
            }

            closeWindow() {
                if (this.isRunning && !confirm('Stop benchmark and close?')) return;
                window.close();
            }

            // Edit Menu Actions
            copyResults() {
                if (!this.currentResults) {
                    alert('No results to copy');
                    return;
                }
                
                const text = JSON.stringify(this.currentResults, null, 2);
                navigator.clipboard.writeText(text).then(() => {
                    this.updateStatus('ready', 'Results copied');
                    setTimeout(() => this.updateStatus('ready', 'System Ready'), 2000);
                });
            }

            selectAllTests() {
                document.querySelectorAll('input[id^="suite-"]').forEach(cb => cb.checked = true);
                this.updateStatus('ready', 'All tests selected');
                setTimeout(() => this.updateStatus('ready', 'System Ready'), 2000);
            }

            clearSelection() {
                document.querySelectorAll('input[id^="suite-"]').forEach(cb => cb.checked = false);
                this.updateStatus('ready', 'Selection cleared');
                setTimeout(() => this.updateStatus('ready', 'System Ready'), 2000);
            }

            // Benchmark Menu Actions
            runQuickBenchmark() {
                document.querySelectorAll('input[id^="suite-"]').forEach(cb => {
                    cb.checked = cb.id.includes('basic_operations') || 
                                cb.id.includes('edit_operations') ||
                                cb.id.includes('performance_tests');
                });
                this.startBenchmark();
            }

            runEditOperationsTest() {
                document.querySelectorAll('input[id^="suite-"]').forEach(cb => {
                    cb.checked = cb.id.includes('basic_operations') || 
                                cb.id.includes('edit_operations');
                });
                this.startBenchmark();
            }

            async startBenchmark() {
                if (this.isRunning || !this.benchmarkManager) return;

                try {
                    this.isRunning = true;
                    this.startTime = Date.now();
                    
                    // Update UI
                    document.getElementById('startBenchmark').disabled = true;
                    document.getElementById('stopBenchmark').disabled = false;
                    document.getElementById('progressSection').style.display = 'block';
                    
                    this.updateStatus('running', 'Running Benchmark');
                    
                    // Get selected suites
                    const selectedSuites = [];
                    document.querySelectorAll('input[id^="suite-"]:checked').forEach(cb => {
                        selectedSuites.push(cb.id.replace('suite-', ''));
                    });

                    const options = {
                        suites: selectedSuites,
                        generateReport: document.getElementById('generateReport').checked,
                        includeCharts: document.getElementById('includeCharts').checked,
                        stopOnError: document.getElementById('stopOnError').checked,
                        timeout: parseInt(document.getElementById('testTimeout').value),
                        onProgress: (progress, suiteId) => this.updateProgress(progress, suiteId),
                        onTestProgress: (progress, testId) => this.updateTestProgress(testId)
                    };

                    console.log('🧪 Starting benchmark:', options);
                    const results = await this.benchmarkManager.framework.runAllBenchmarks(options);
                    
                    this.currentResults = results;
                    this.displayResults(results);
                    this.updateStatus('ready', 'Benchmark Completed');
                    
                } catch (error) {
                    console.error('❌ Benchmark failed:', error);
                    this.updateStatus('error', 'Benchmark Failed');
                    alert('Benchmark failed: ' + error.message);
                } finally {
                    this.isRunning = false;
                    document.getElementById('startBenchmark').disabled = false;
                    document.getElementById('stopBenchmark').disabled = true;
                    document.getElementById('exportResults').disabled = false;
                }
            }

            stopBenchmark() {
                if (!this.isRunning) return;
                
                this.isRunning = false;
                if (this.benchmarkManager && this.benchmarkManager.framework) {
                    this.benchmarkManager.framework.stopBenchmark();
                }
                
                this.updateStatus('ready', 'Benchmark Stopped');
                
                // Update UI
                document.getElementById('startBenchmark').disabled = false;
                document.getElementById('stopBenchmark').disabled = true;
            }

            updateProgress(progress, suiteId) {
                document.getElementById('progressFill').style.width = (progress * 100) + '%';
                document.getElementById('currentSuite').textContent = suiteId || '-';
            }

            updateTestProgress(testId) {
                document.getElementById('currentTest').textContent = testId || '-';
            }

            displayResults(results) {
                const resultsSection = document.getElementById('resultsSection');
                const resultsContent = document.getElementById('resultsContent');
                
                resultsSection.style.display = 'block';
                
                const stats = results.overallStats;
                resultsContent.innerHTML = \`
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px;">
                        <div style="background: #3498db; color: white; padding: 20px; border-radius: 8px; text-align: center;">
                            <h3>Success Rate</h3>
                            <div style="font-size: 24px; font-weight: bold;">\${stats.overallSuccessRate.toFixed(1)}%</div>
                        </div>
                        <div style="background: #27ae60; color: white; padding: 20px; border-radius: 8px; text-align: center;">
                            <h3>Tests Passed</h3>
                            <div style="font-size: 24px; font-weight: bold;">\${stats.passedTests}/\${stats.totalTests}</div>
                        </div>
                        <div style="background: #f39c12; color: white; padding: 20px; border-radius: 8px; text-align: center;">
                            <h3>Duration</h3>
                            <div style="font-size: 24px; font-weight: bold;">\${Math.round(results.duration / 1000)}s</div>
                        </div>
                    </div>
                    <h3>Test Suite Results</h3>
                    \${results.testSuiteResults.map(suite => \`
                        <div style="border: 1px solid #ddd; border-radius: 6px; margin: 10px 0; overflow: hidden;">
                            <div style="background: #f8f9fa; padding: 15px; font-weight: bold; cursor: pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'">
                                \${suite.suiteName} - \${(suite.stats.passedTests / suite.stats.totalTests * 100).toFixed(1)}% pass rate
                            </div>
                            <div style="padding: 15px; display: none;">
                                \${suite.testResults.map(test => \`
                                    <div style="padding: 8px; margin: 5px 0; border-radius: 4px; background: \${test.success ? '#d4edda' : '#f8d7da'}; border-left: 4px solid \${test.success ? '#28a745' : '#dc3545'};">
                                        <strong>\${test.testName}</strong><br>
                                        <small>Score: \${test.score}/\${test.maxScore} | Duration: \${test.duration}ms</small>
                                        \${test.errors.length > 0 ? \`<br><small style="color: #dc3545;">Errors: \${test.errors.join(', ')}</small>\` : ''}
                                    </div>
                                \`).join('')}
                            </div>
                        </div>
                    \`).join('')}
                \`;
                
                // Enable export
                document.getElementById('exportResults').disabled = false;
            }

            showAbout() {
                alert(\`LLM Instruction Following Benchmark v1.0.0\\n\\nComprehensive testing framework for LLM instruction following capabilities.\\n\\n• 12 test suites\\n• 140+ individual tests\\n• Advanced statistical analysis\\n• Professional reporting\\n\\nIncludes comprehensive Edit operations testing:\`);
            }

            downloadJSON(data, filename) {
                const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = filename + '.json';
                a.click();
                URL.revokeObjectURL(url);
            }
        }

        // Initialize
        const benchmarkApp = new BenchmarkApp();
        window.benchmarkApp = benchmarkApp;
    </script>
</body>
</html>`;
    }

    /**
     * Setup window event handlers
     */
    setupWindowEventHandlers() {
        if (!this.window) return;

        // Handle window close
        this.window.addEventListener('beforeunload', () => {
            if (this.isRunning) {
                this.framework.stopBenchmark();
            }
        });

        // Make framework available to window
        this.window.benchmarkFramework = this.framework;
    }

    /**
     * Setup main window event handlers
     */
    setupEventHandlers() {
        // Listen for benchmark events
        window.addEventListener('benchmark-complete', (event) => {
            this.onBenchmarkComplete(event.detail);
        });

        window.addEventListener('benchmark-error', (event) => {
            this.onBenchmarkError(event.detail);
        });
    }

    /**
     * Handle benchmark completion
     */
    onBenchmarkComplete(results) {
        this.currentResults = results;
        console.log('Benchmark completed:', results);
    }

    /**
     * Handle benchmark error
     */
    onBenchmarkError(error) {
        console.error('Benchmark error:', error);
    }
}

// Make available globally
window.BenchmarkUI = BenchmarkUI;
