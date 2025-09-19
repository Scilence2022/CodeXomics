/**
 * Benchmark UI - User interface for LLM benchmark system
 */
class BenchmarkUI {
    constructor(benchmarkFramework) {
        this.framework = benchmarkFramework;
        this.currentResults = null;
        this.isRunning = false;
        this.window = null;
        this.setupEventHandlers();
    }

    /**
     * Show benchmark runner window
     */
    showBenchmarkRunner() {
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
        
        console.log('🧪 Benchmark runner window opened');
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
