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
        
        this.window.document.write(this.generateBenchmarkHTML());
        this.window.document.close();
        
        // Setup window event handlers
        this.setupWindowEventHandlers();
    }

    /**
     * Generate benchmark runner HTML
     */
    generateBenchmarkHTML() {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>LLM Instruction Following Benchmark</title>
    <style>
        ${this.getBenchmarkCSS()}
    </style>
</head>
<body>
    <div class="benchmark-container">
        <header class="benchmark-header">
            <h1>🧪 LLM Instruction Following Benchmark</h1>
            <div class="header-controls">
                <button id="startBenchmark" class="btn btn-primary">
                    <i class="icon">▶</i> Start Benchmark
                </button>
                <button id="stopBenchmark" class="btn btn-secondary" disabled>
                    <i class="icon">⏹</i> Stop
                </button>
                <button id="exportResults" class="btn btn-tertiary" disabled>
                    <i class="icon">📊</i> Export Results
                </button>
            </div>
        </header>

        <div class="benchmark-content">
            <!-- Configuration Panel -->
            <section class="config-panel">
                <h2>Configuration</h2>
                <div class="config-grid">
                    <div class="config-group">
                        <label>Test Suites</label>
                        <div class="checkbox-group">
                            <label><input type="checkbox" id="suite-basic_functions" checked> Basic Functions</label>
                            <label><input type="checkbox" id="suite-complex_analysis" checked> Complex Analysis</label>
                            <label><input type="checkbox" id="suite-plugin_integration" checked> Plugin Integration</label>
                            <label><input type="checkbox" id="suite-parameter_handling" checked> Parameter Handling</label>
                            <label><input type="checkbox" id="suite-error_recovery" checked> Error Recovery</label>
                            <label><input type="checkbox" id="suite-workflow_tests" checked> Workflow Tests</label>
                            <label><input type="checkbox" id="suite-contextual_understanding" checked> Contextual Understanding</label>
                            <label><input type="checkbox" id="suite-edge_cases" checked> Edge Cases</label>
                            <label><input type="checkbox" id="suite-performance_tests" checked> Performance Tests</label>
                            <label><input type="checkbox" id="suite-consistency_tests" checked> Consistency Tests</label>
                        </div>
                    </div>
                    <div class="config-group">
                        <label>Options</label>
                        <div class="form-group">
                            <label><input type="checkbox" id="generateReport" checked> Generate Report</label>
                            <label><input type="checkbox" id="includeCharts" checked> Include Charts</label>
                            <label><input type="checkbox" id="includeRawData"> Include Raw Data</label>
                            <label><input type="checkbox" id="stopOnError"> Stop on Error</label>
                        </div>
                    </div>
                    <div class="config-group">
                        <label>Test Timeout</label>
                        <select id="testTimeout">
                            <option value="15000">15 seconds</option>
                            <option value="30000" selected>30 seconds</option>
                            <option value="60000">60 seconds</option>
                            <option value="120000">120 seconds</option>
                        </select>
                    </div>
                </div>
            </section>

            <!-- Progress Panel -->
            <section class="progress-panel" id="progressPanel" style="display: none;">
                <h2>Progress</h2>
                <div class="progress-info">
                    <div class="progress-bar-container">
                        <div class="progress-bar" id="overallProgress">
                            <div class="progress-fill" id="overallProgressFill"></div>
                        </div>
                        <span class="progress-text" id="overallProgressText">0%</span>
                    </div>
                    <div class="progress-details">
                        <div class="progress-item">
                            <span class="label">Current Suite:</span>
                            <span class="value" id="currentSuite">-</span>
                        </div>
                        <div class="progress-item">
                            <span class="label">Current Test:</span>
                            <span class="value" id="currentTest">-</span>
                        </div>
                        <div class="progress-item">
                            <span class="label">Tests Completed:</span>
                            <span class="value" id="testsCompleted">0</span>
                        </div>
                        <div class="progress-item">
                            <span class="label">Tests Passed:</span>
                            <span class="value" id="testsPassed">0</span>
                        </div>
                        <div class="progress-item">
                            <span class="label">Tests Failed:</span>
                            <span class="value" id="testsFailed">0</span>
                        </div>
                        <div class="progress-item">
                            <span class="label">Elapsed Time:</span>
                            <span class="value" id="elapsedTime">00:00</span>
                        </div>
                    </div>
                </div>
                <div class="test-log" id="testLog">
                    <h3>Test Log</h3>
                    <div class="log-content" id="logContent"></div>
                </div>
            </section>

            <!-- Results Panel -->
            <section class="results-panel" id="resultsPanel" style="display: none;">
                <h2>Benchmark Results</h2>
                <div class="results-summary" id="resultsSummary"></div>
                <div class="results-tabs">
                    <button class="tab-button active" data-tab="overview">Overview</button>
                    <button class="tab-button" data-tab="suites">Test Suites</button>
                    <button class="tab-button" data-tab="statistics">Statistics</button>
                    <button class="tab-button" data-tab="errors">Errors</button>
                    <button class="tab-button" data-tab="charts">Charts</button>
                </div>
                <div class="tab-content">
                    <div class="tab-pane active" id="tab-overview"></div>
                    <div class="tab-pane" id="tab-suites"></div>
                    <div class="tab-pane" id="tab-statistics"></div>
                    <div class="tab-pane" id="tab-errors"></div>
                    <div class="tab-pane" id="tab-charts"></div>
                </div>
            </section>

            <!-- History Panel -->
            <section class="history-panel">
                <h2>Benchmark History</h2>
                <div class="history-controls">
                    <button id="clearHistory" class="btn btn-secondary">Clear History</button>
                    <button id="exportHistory" class="btn btn-tertiary">Export History</button>
                </div>
                <div class="history-list" id="historyList"></div>
            </section>
        </div>
    </div>

    <script>
        ${this.getBenchmarkJavaScript()}
    </script>
</body>
</html>`;
    }

    /**
     * Get benchmark CSS styles
     */
    getBenchmarkCSS() {
        return `
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }

            body {
                font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
                color: #333;
                line-height: 1.6;
            }

            .benchmark-container {
                max-width: 1400px;
                margin: 0 auto;
                padding: 20px;
            }

            .benchmark-header {
                background: white;
                padding: 30px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
                margin-bottom: 30px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }

            .benchmark-header h1 {
                color: #2c3e50;
                font-size: 28px;
                font-weight: 600;
            }

            .header-controls {
                display: flex;
                gap: 15px;
            }

            .btn {
                padding: 12px 24px;
                border: none;
                border-radius: 8px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.3s ease;
                display: inline-flex;
                align-items: center;
                gap: 8px;
            }

            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            }

            .btn:disabled {
                opacity: 0.5;
                cursor: not-allowed;
                transform: none;
                box-shadow: none;
            }

            .btn-primary {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
            }

            .btn-secondary {
                background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
                color: white;
            }

            .btn-tertiary {
                background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
                color: white;
            }

            .benchmark-content {
                display: grid;
                gap: 30px;
            }

            section {
                background: white;
                padding: 30px;
                border-radius: 12px;
                box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            }

            section h2 {
                color: #2c3e50;
                font-size: 22px;
                margin-bottom: 20px;
                border-bottom: 3px solid #3498db;
                padding-bottom: 10px;
            }

            .config-grid {
                display: grid;
                grid-template-columns: 2fr 1fr 1fr;
                gap: 30px;
            }

            .config-group label {
                font-weight: 600;
                color: #34495e;
                margin-bottom: 15px;
                display: block;
            }

            .checkbox-group {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 10px;
            }

            .checkbox-group label {
                font-weight: normal;
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
                cursor: pointer;
            }

            .checkbox-group input[type="checkbox"] {
                width: 18px;
                height: 18px;
                accent-color: #3498db;
            }

            .form-group {
                display: flex;
                flex-direction: column;
                gap: 10px;
            }

            .form-group label {
                font-weight: normal;
                display: flex;
                align-items: center;
                gap: 8px;
                margin-bottom: 8px;
            }

            select {
                padding: 10px;
                border: 2px solid #e1e8ed;
                border-radius: 6px;
                font-size: 14px;
                background: white;
            }

            .progress-bar-container {
                display: flex;
                align-items: center;
                gap: 15px;
                margin-bottom: 20px;
            }

            .progress-bar {
                flex: 1;
                height: 12px;
                background: #ecf0f1;
                border-radius: 6px;
                overflow: hidden;
                position: relative;
            }

            .progress-fill {
                height: 100%;
                background: linear-gradient(90deg, #3498db 0%, #2ecc71 100%);
                width: 0%;
                transition: width 0.3s ease;
            }

            .progress-text {
                font-weight: 600;
                color: #2c3e50;
                min-width: 50px;
            }

            .progress-details {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 15px;
                margin-bottom: 20px;
            }

            .progress-item {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 10px;
                background: #f8f9fa;
                border-radius: 6px;
            }

            .progress-item .label {
                font-weight: 500;
                color: #6c757d;
            }

            .progress-item .value {
                font-weight: 600;
                color: #2c3e50;
            }

            .test-log {
                margin-top: 20px;
            }

            .log-content {
                height: 200px;
                overflow-y: auto;
                background: #2c3e50;
                color: #ecf0f1;
                padding: 15px;
                border-radius: 6px;
                font-family: 'Monaco', 'Menlo', monospace;
                font-size: 12px;
                line-height: 1.4;
            }

            .log-entry {
                margin-bottom: 5px;
                padding: 2px 0;
            }

            .log-entry.success {
                color: #2ecc71;
            }

            .log-entry.error {
                color: #e74c3c;
            }

            .log-entry.warning {
                color: #f39c12;
            }

            .log-entry.info {
                color: #3498db;
            }

            .results-summary {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }

            .summary-card {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 25px;
                border-radius: 10px;
                text-align: center;
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

            .results-tabs {
                display: flex;
                border-bottom: 2px solid #e1e8ed;
                margin-bottom: 20px;
            }

            .tab-button {
                padding: 12px 24px;
                border: none;
                background: none;
                cursor: pointer;
                font-size: 14px;
                font-weight: 500;
                color: #6c757d;
                border-bottom: 3px solid transparent;
                transition: all 0.3s ease;
            }

            .tab-button:hover {
                color: #3498db;
            }

            .tab-button.active {
                color: #3498db;
                border-bottom-color: #3498db;
            }

            .tab-pane {
                display: none;
            }

            .tab-pane.active {
                display: block;
            }

            .history-controls {
                display: flex;
                gap: 10px;
                margin-bottom: 20px;
            }

            .history-list {
                max-height: 300px;
                overflow-y: auto;
            }

            .history-item {
                padding: 15px;
                border: 1px solid #e1e8ed;
                border-radius: 6px;
                margin-bottom: 10px;
                cursor: pointer;
                transition: all 0.3s ease;
            }

            .history-item:hover {
                background: #f8f9fa;
                border-color: #3498db;
            }

            .history-item-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 5px;
            }

            .history-item-title {
                font-weight: 600;
                color: #2c3e50;
            }

            .history-item-date {
                font-size: 12px;
                color: #6c757d;
            }

            .history-item-stats {
                font-size: 14px;
                color: #6c757d;
            }

            .suite-result {
                margin-bottom: 20px;
                border: 1px solid #e1e8ed;
                border-radius: 8px;
                overflow: hidden;
            }

            .suite-header {
                background: #f8f9fa;
                padding: 15px 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                cursor: pointer;
            }

            .suite-title {
                font-weight: 600;
                color: #2c3e50;
            }

            .suite-stats {
                display: flex;
                gap: 15px;
                font-size: 14px;
            }

            .suite-content {
                padding: 20px;
                display: none;
            }

            .suite-content.expanded {
                display: block;
            }

            .test-result {
                padding: 10px;
                margin-bottom: 10px;
                border-radius: 6px;
                border-left: 4px solid #e1e8ed;
            }

            .test-result.passed {
                background: #d4edda;
                border-left-color: #28a745;
            }

            .test-result.failed {
                background: #f8d7da;
                border-left-color: #dc3545;
            }

            .test-result.error {
                background: #fff3cd;
                border-left-color: #ffc107;
            }

            .test-name {
                font-weight: 600;
                margin-bottom: 5px;
            }

            .test-details {
                font-size: 14px;
                color: #6c757d;
            }

            .chart-container {
                margin-bottom: 30px;
                padding: 20px;
                background: #f8f9fa;
                border-radius: 8px;
            }

            .icon {
                font-size: 16px;
            }

            @media (max-width: 768px) {
                .config-grid {
                    grid-template-columns: 1fr;
                }

                .checkbox-group {
                    grid-template-columns: 1fr;
                }

                .progress-details {
                    grid-template-columns: 1fr;
                }

                .results-summary {
                    grid-template-columns: 1fr;
                }
            }
        `;
    }

    /**
     * Get benchmark JavaScript
     */
    getBenchmarkJavaScript() {
        return `
            class BenchmarkWindow {
                constructor() {
                    this.isRunning = false;
                    this.currentResults = null;
                    this.startTime = null;
                    this.timer = null;
                    this.setupEventListeners();
                    this.loadHistory();
                }

                setupEventListeners() {
                    document.getElementById('startBenchmark').addEventListener('click', () => this.startBenchmark());
                    document.getElementById('stopBenchmark').addEventListener('click', () => this.stopBenchmark());
                    document.getElementById('exportResults').addEventListener('click', () => this.exportResults());
                    document.getElementById('clearHistory').addEventListener('click', () => this.clearHistory());
                    document.getElementById('exportHistory').addEventListener('click', () => this.exportHistory());

                    // Tab switching
                    document.querySelectorAll('.tab-button').forEach(btn => {
                        btn.addEventListener('click', (e) => this.switchTab(e.target.dataset.tab));
                    });

                    // Suite expansion
                    document.addEventListener('click', (e) => {
                        if (e.target.closest('.suite-header')) {
                            this.toggleSuite(e.target.closest('.suite-result'));
                        }
                    });
                }

                getSelectedSuites() {
                    const suites = [];
                    document.querySelectorAll('[id^="suite-"]:checked').forEach(checkbox => {
                        suites.push(checkbox.id.replace('suite-', ''));
                    });
                    return suites;
                }

                getOptions() {
                    return {
                        generateReport: document.getElementById('generateReport').checked,
                        includeCharts: document.getElementById('includeCharts').checked,
                        includeRawData: document.getElementById('includeRawData').checked,
                        stopOnError: document.getElementById('stopOnError').checked,
                        timeout: parseInt(document.getElementById('testTimeout').value),
                        suites: this.getSelectedSuites()
                    };
                }

                async startBenchmark() {
                    if (this.isRunning) return;

                    this.isRunning = true;
                    this.startTime = Date.now();
                    
                    // Update UI
                    document.getElementById('startBenchmark').disabled = true;
                    document.getElementById('stopBenchmark').disabled = false;
                    document.getElementById('progressPanel').style.display = 'block';
                    document.getElementById('resultsPanel').style.display = 'none';
                    
                    // Reset progress
                    this.updateProgress(0, 'Initializing benchmark...', '');
                    this.clearLog();
                    this.startTimer();

                    try {
                        // Get benchmark framework from parent window
                        const framework = window.opener?.benchmarkFramework;
                        if (!framework) {
                            throw new Error('Benchmark framework not available');
                        }

                        const options = this.getOptions();
                        options.onProgress = (progress, suiteId, suiteResult) => {
                            this.onSuiteProgress(progress, suiteId, suiteResult);
                        };
                        options.onTestProgress = (progress, testId, testResult, suiteId) => {
                            this.onTestProgress(progress, testId, testResult, suiteId);
                        };

                        this.logInfo('Starting benchmark with ' + options.suites.length + ' test suites...');
                        
                        const results = await framework.runAllBenchmarks(options);
                        this.onBenchmarkComplete(results);

                    } catch (error) {
                        this.logError('Benchmark failed: ' + error.message);
                        this.onBenchmarkError(error);
                    }
                }

                stopBenchmark() {
                    if (!this.isRunning) return;

                    this.isRunning = false;
                    
                    // Notify framework to stop
                    if (window.opener?.benchmarkFramework) {
                        window.opener.benchmarkFramework.stopBenchmark();
                    }

                    this.logWarning('Benchmark stopped by user');
                    this.finalizeBenchmark();
                }

                onSuiteProgress(progress, suiteId, suiteResult) {
                    this.updateProgress(progress * 100, 'Running test suites...', suiteId);
                    
                    if (suiteResult) {
                        const passRate = (suiteResult.stats.passedTests / suiteResult.stats.totalTests * 100).toFixed(1);
                        this.logSuccess(\`Completed suite: \${suiteResult.suiteName} (\${passRate}% pass rate)\`);
                        
                        // Update counters
                        this.updateCounters(suiteResult);
                    }
                }

                onTestProgress(progress, testId, testResult, suiteId) {
                    this.updateProgress(null, null, testId);
                    
                    if (testResult) {
                        if (testResult.success) {
                            this.logSuccess(\`✓ \${testResult.testName} (\${testResult.score}/\${testResult.maxScore})\`);
                        } else if (testResult.status === 'error') {
                            this.logError(\`✗ \${testResult.testName} (ERROR)\`);
                        } else {
                            this.logWarning(\`✗ \${testResult.testName} (\${testResult.score}/\${testResult.maxScore})\`);
                        }
                    }
                }

                onBenchmarkComplete(results) {
                    this.logSuccess('Benchmark completed successfully!');
                    this.currentResults = results;
                    this.displayResults(results);
                    this.saveToHistory(results);
                    this.finalizeBenchmark();
                }

                onBenchmarkError(error) {
                    this.logError('Benchmark encountered an error: ' + error.message);
                    this.finalizeBenchmark();
                }

                finalizeBenchmark() {
                    this.isRunning = false;
                    this.stopTimer();
                    
                    document.getElementById('startBenchmark').disabled = false;
                    document.getElementById('stopBenchmark').disabled = true;
                    document.getElementById('exportResults').disabled = !this.currentResults;
                }

                updateProgress(percentage, currentSuite, currentTest) {
                    if (percentage !== null) {
                        document.getElementById('overallProgressFill').style.width = percentage + '%';
                        document.getElementById('overallProgressText').textContent = Math.round(percentage) + '%';
                    }
                    
                    if (currentSuite !== null) {
                        document.getElementById('currentSuite').textContent = currentSuite || '-';
                    }
                    
                    if (currentTest !== null) {
                        document.getElementById('currentTest').textContent = currentTest || '-';
                    }
                }

                updateCounters(suiteResult) {
                    const completed = parseInt(document.getElementById('testsCompleted').textContent) + suiteResult.stats.totalTests;
                    const passed = parseInt(document.getElementById('testsPassed').textContent) + suiteResult.stats.passedTests;
                    const failed = parseInt(document.getElementById('testsFailed').textContent) + suiteResult.stats.failedTests;
                    
                    document.getElementById('testsCompleted').textContent = completed;
                    document.getElementById('testsPassed').textContent = passed;
                    document.getElementById('testsFailed').textContent = failed;
                }

                startTimer() {
                    this.timer = setInterval(() => {
                        const elapsed = Date.now() - this.startTime;
                        const minutes = Math.floor(elapsed / 60000);
                        const seconds = Math.floor((elapsed % 60000) / 1000);
                        document.getElementById('elapsedTime').textContent = 
                            \`\${minutes.toString().padStart(2, '0')}:\${seconds.toString().padStart(2, '0')}\`;
                    }, 1000);
                }

                stopTimer() {
                    if (this.timer) {
                        clearInterval(this.timer);
                        this.timer = null;
                    }
                }

                clearLog() {
                    document.getElementById('logContent').innerHTML = '';
                }

                logInfo(message) {
                    this.addLogEntry(message, 'info');
                }

                logSuccess(message) {
                    this.addLogEntry(message, 'success');
                }

                logWarning(message) {
                    this.addLogEntry(message, 'warning');
                }

                logError(message) {
                    this.addLogEntry(message, 'error');
                }

                addLogEntry(message, type) {
                    const logContent = document.getElementById('logContent');
                    const entry = document.createElement('div');
                    entry.className = \`log-entry \${type}\`;
                    entry.textContent = \`[\${new Date().toLocaleTimeString()}] \${message}\`;
                    logContent.appendChild(entry);
                    logContent.scrollTop = logContent.scrollHeight;
                }

                displayResults(results) {
                    document.getElementById('resultsPanel').style.display = 'block';
                    
                    // Display summary
                    this.displayResultsSummary(results);
                    
                    // Display detailed results in tabs
                    this.displayOverviewTab(results);
                    this.displaySuitesTab(results);
                    this.displayStatisticsTab(results);
                    this.displayErrorsTab(results);
                    this.displayChartsTab(results);
                }

                displayResultsSummary(results) {
                    const stats = results.overallStats;
                    const summary = document.getElementById('resultsSummary');
                    
                    summary.innerHTML = \`
                        <div class="summary-card">
                            <h3>Overall Success Rate</h3>
                            <div class="value">\${stats.overallSuccessRate.toFixed(1)}</div>
                            <div class="unit">%</div>
                        </div>
                        <div class="summary-card">
                            <h3>Tests Passed</h3>
                            <div class="value">\${stats.passedTests}</div>
                            <div class="unit">/ \${stats.totalTests}</div>
                        </div>
                        <div class="summary-card">
                            <h3>Average Score</h3>
                            <div class="value">\${stats.scoreStats.percentage.mean.toFixed(1)}</div>
                            <div class="unit">%</div>
                        </div>
                        <div class="summary-card">
                            <h3>Duration</h3>
                            <div class="value">\${Math.round(results.duration / 1000)}</div>
                            <div class="unit">seconds</div>
                        </div>
                    \`;
                }

                displayOverviewTab(results) {
                    const tab = document.getElementById('tab-overview');
                    const stats = results.overallStats;
                    
                    tab.innerHTML = \`
                        <h3>Benchmark Overview</h3>
                        <p><strong>Total Test Suites:</strong> \${stats.totalSuites}</p>
                        <p><strong>Total Tests:</strong> \${stats.totalTests}</p>
                        <p><strong>Tests Passed:</strong> \${stats.passedTests} (\${stats.overallSuccessRate.toFixed(1)}%)</p>
                        <p><strong>Tests Failed:</strong> \${stats.failedTests}</p>
                        <p><strong>Tests with Errors:</strong> \${stats.errorTests}</p>
                        <p><strong>Average Response Time:</strong> \${stats.performanceStats.duration.mean.toFixed(0)}ms</p>
                        <p><strong>Quality Score:</strong> \${stats.qualityMetrics.excellence.toFixed(1)}%</p>
                    \`;
                }

                displaySuitesTab(results) {
                    const tab = document.getElementById('tab-suites');
                    let html = '<h3>Test Suite Results</h3>';
                    
                    results.testSuiteResults.forEach(suite => {
                        const passRate = (suite.stats.passedTests / suite.stats.totalTests * 100).toFixed(1);
                        html += \`
                            <div class="suite-result">
                                <div class="suite-header">
                                    <div class="suite-title">\${suite.suiteName}</div>
                                    <div class="suite-stats">
                                        <span>Pass Rate: \${passRate}%</span>
                                        <span>Duration: \${Math.round(suite.duration / 1000)}s</span>
                                    </div>
                                </div>
                                <div class="suite-content">
                                    \${suite.testResults.map(test => \`
                                        <div class="test-result \${test.success ? 'passed' : (test.status === 'error' ? 'error' : 'failed')}">
                                            <div class="test-name">\${test.testName}</div>
                                            <div class="test-details">
                                                Score: \${test.score}/\${test.maxScore} | 
                                                Duration: \${test.duration}ms |
                                                Status: \${test.status}
                                            </div>
                                        </div>
                                    \`).join('')}
                                </div>
                            </div>
                        \`;
                    });
                    
                    tab.innerHTML = html;
                }

                displayStatisticsTab(results) {
                    const tab = document.getElementById('tab-statistics');
                    const stats = results.overallStats;
                    
                    tab.innerHTML = \`
                        <h3>Statistical Analysis</h3>
                        <h4>Score Statistics</h4>
                        <p><strong>Mean:</strong> \${stats.scoreStats.percentage.mean.toFixed(2)}%</p>
                        <p><strong>Median:</strong> \${stats.scoreStats.percentage.median.toFixed(2)}%</p>
                        <p><strong>Standard Deviation:</strong> \${stats.scoreStats.percentage.standardDeviation.toFixed(2)}%</p>
                        <p><strong>95th Percentile:</strong> \${stats.scoreStats.percentage.percentiles.p95.toFixed(2)}%</p>
                        
                        <h4>Performance Statistics</h4>
                        <p><strong>Average Duration:</strong> \${stats.performanceStats.duration.mean.toFixed(0)}ms</p>
                        <p><strong>Fastest Test:</strong> \${stats.performanceStats.duration.min}ms</p>
                        <p><strong>Slowest Test:</strong> \${stats.performanceStats.duration.max}ms</p>
                        
                        <h4>Quality Metrics</h4>
                        <p><strong>Excellence:</strong> \${stats.qualityMetrics.excellence.toFixed(1)}%</p>
                        <p><strong>Reliability:</strong> \${stats.qualityMetrics.reliability.toFixed(1)}%</p>
                        <p><strong>Consistency:</strong> \${stats.qualityMetrics.consistency.toFixed(1)}%</p>
                    \`;
                }

                displayErrorsTab(results) {
                    const tab = document.getElementById('tab-errors');
                    const errorStats = results.overallStats.errorAnalysis;
                    
                    let html = '<h3>Error Analysis</h3>';
                    html += \`<p><strong>Total Errors:</strong> \${errorStats.totalErrors}</p>\`;
                    html += \`<p><strong>Error Rate:</strong> \${errorStats.errorRate.toFixed(1)}%</p>\`;
                    
                    if (Object.keys(errorStats.errorCategories).length > 0) {
                        html += '<h4>Error Categories</h4><ul>';
                        for (const [category, count] of Object.entries(errorStats.errorCategories)) {
                            html += \`<li>\${category}: \${count}</li>\`;
                        }
                        html += '</ul>';
                    }
                    
                    tab.innerHTML = html;
                }

                displayChartsTab(results) {
                    const tab = document.getElementById('tab-charts');
                    tab.innerHTML = '<h3>Performance Charts</h3><p>Charts will be implemented with Chart.js integration.</p>';
                }

                switchTab(tabName) {
                    // Update tab buttons
                    document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
                    document.querySelector(\`[data-tab="\${tabName}"]\`).classList.add('active');
                    
                    // Update tab panes
                    document.querySelectorAll('.tab-pane').forEach(pane => pane.classList.remove('active'));
                    document.getElementById(\`tab-\${tabName}\`).classList.add('active');
                }

                toggleSuite(suiteElement) {
                    const content = suiteElement.querySelector('.suite-content');
                    content.classList.toggle('expanded');
                }

                exportResults() {
                    if (!this.currentResults) return;
                    
                    const dataStr = JSON.stringify(this.currentResults, null, 2);
                    const dataBlob = new Blob([dataStr], {type: 'application/json'});
                    const url = URL.createObjectURL(dataBlob);
                    
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = \`benchmark-results-\${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json\`;
                    link.click();
                    
                    URL.revokeObjectURL(url);
                }

                saveToHistory(results) {
                    const history = JSON.parse(localStorage.getItem('benchmarkHistory') || '[]');
                    
                    const historyItem = {
                        id: Date.now(),
                        date: new Date().toISOString(),
                        duration: results.duration,
                        totalTests: results.overallStats.totalTests,
                        passedTests: results.overallStats.passedTests,
                        successRate: results.overallStats.overallSuccessRate,
                        results: results
                    };
                    
                    history.unshift(historyItem);
                    history.splice(10); // Keep only last 10 results
                    
                    localStorage.setItem('benchmarkHistory', JSON.stringify(history));
                    this.loadHistory();
                }

                loadHistory() {
                    const history = JSON.parse(localStorage.getItem('benchmarkHistory') || '[]');
                    const historyList = document.getElementById('historyList');
                    
                    if (history.length === 0) {
                        historyList.innerHTML = '<p>No benchmark history available.</p>';
                        return;
                    }
                    
                    historyList.innerHTML = history.map(item => \`
                        <div class="history-item" onclick="benchmarkWindow.loadHistoryItem(\${item.id})">
                            <div class="history-item-header">
                                <div class="history-item-title">Benchmark Run</div>
                                <div class="history-item-date">\${new Date(item.date).toLocaleString()}</div>
                            </div>
                            <div class="history-item-stats">
                                \${item.passedTests}/\${item.totalTests} passed (\${item.successRate.toFixed(1)}%) | 
                                Duration: \${Math.round(item.duration / 1000)}s
                            </div>
                        </div>
                    \`).join('');
                }

                loadHistoryItem(id) {
                    const history = JSON.parse(localStorage.getItem('benchmarkHistory') || '[]');
                    const item = history.find(h => h.id === id);
                    
                    if (item) {
                        this.currentResults = item.results;
                        this.displayResults(item.results);
                        document.getElementById('exportResults').disabled = false;
                    }
                }

                clearHistory() {
                    if (confirm('Are you sure you want to clear the benchmark history?')) {
                        localStorage.removeItem('benchmarkHistory');
                        this.loadHistory();
                    }
                }

                exportHistory() {
                    const history = JSON.parse(localStorage.getItem('benchmarkHistory') || '[]');
                    const dataStr = JSON.stringify(history, null, 2);
                    const dataBlob = new Blob([dataStr], {type: 'application/json'});
                    const url = URL.createObjectURL(dataBlob);
                    
                    const link = document.createElement('a');
                    link.href = url;
                    link.download = \`benchmark-history-\${new Date().toISOString().slice(0, 10)}.json\`;
                    link.click();
                    
                    URL.revokeObjectURL(url);
                }
            }

            // Initialize benchmark window
            const benchmarkWindow = new BenchmarkWindow();
        `;
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
