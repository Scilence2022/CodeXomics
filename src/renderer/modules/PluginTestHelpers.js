/**
 * PluginTestHelpers - Helper methods for plugin testing UI
 */
class PluginTestHelpers {
    /**
     * Generate overview tab content
     */
    static generateOverviewTab(plugin, type) {
        return `
            <div class="test-section">
                <div class="test-section-header">
                    <span><i class="fas fa-info-circle"></i> Plugin Overview</span>
                </div>
                <div class="test-section-content">
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
                        <div>
                            <h4>Basic Information</h4>
                            <table style="width: 100%; border-collapse: collapse;">
                                <tr><td style="padding: 0.5rem 0; font-weight: 600;">Name:</td><td>${plugin.name}</td></tr>
                                <tr><td style="padding: 0.5rem 0; font-weight: 600;">Version:</td><td>${plugin.version}</td></tr>
                                <tr><td style="padding: 0.5rem 0; font-weight: 600;">Author:</td><td>${plugin.author || 'Unknown'}</td></tr>
                                <tr><td style="padding: 0.5rem 0; font-weight: 600;">Type:</td><td>${type === 'function' ? 'Function Plugin' : 'Visualization Plugin'}</td></tr>
                                <tr><td style="padding: 0.5rem 0; font-weight: 600;">Status:</td><td>
                                    <span style="color: ${plugin.enabled !== false ? '#48bb78' : '#f56565'};">
                                        ${plugin.enabled !== false ? 'Enabled' : 'Disabled'}
                                    </span>
                                </td></tr>
                            </table>
                        </div>
                        <div>
                            <h4>Capabilities</h4>
                            ${type === 'function' && plugin.functions ? `
                                <p><strong>Functions:</strong> ${Object.keys(plugin.functions).length}</p>
                                <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                                    ${Object.keys(plugin.functions).map(func => `<li>${func}</li>`).join('')}
                                </ul>
                            ` : ''}
                            ${type === 'visualization' && plugin.supportedDataTypes ? `
                                <p><strong>Supported Data Types:</strong> ${plugin.supportedDataTypes.length}</p>
                                <ul style="margin-top: 0.5rem; padding-left: 1.5rem;">
                                    ${plugin.supportedDataTypes.map(dataType => `<li>${dataType}</li>`).join('')}
                                </ul>
                            ` : ''}
                        </div>
                    </div>
                    <div style="margin-top: 2rem;">
                        <h4>Description</h4>
                        <p style="background: #f7fafc; padding: 1rem; border-radius: 0.5rem; margin-top: 0.5rem;">
                            ${plugin.description}
                        </p>
                    </div>
                    <div style="margin-top: 2rem;">
                        <h4>Quick Actions</h4>
                        <div style="display: flex; gap: 1rem; margin-top: 0.5rem;">
                            <button class="btn btn-primary" onclick="runQuickTest()">
                                <i class="fas fa-bolt"></i> Quick Test
                            </button>
                            <button class="btn btn-info" onclick="runBasicValidation()">
                                <i class="fas fa-check-circle"></i> Basic Validation
                            </button>
                            <button class="btn btn-secondary" onclick="showPluginDetails()">
                                <i class="fas fa-info"></i> View Details
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate results tab content
     */
    static generateResultsTab() {
        return `
            <div class="test-section">
                <div class="test-section-header">
                    <span><i class="fas fa-chart-line"></i> Test Results</span>
                    <div>
                        <button class="btn btn-secondary" onclick="clearResults()">
                            <i class="fas fa-trash"></i> Clear Results
                        </button>
                        <button class="btn btn-info" onclick="exportResults()">
                            <i class="fas fa-download"></i> Export Results
                        </button>
                    </div>
                </div>
                <div class="test-section-content">
                    <div id="testResultsContainer">
                        <div style="text-align: center; padding: 3rem; color: #718096;">
                            <i class="fas fa-flask" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i>
                            <p>No test results yet. Run a test to see results here.</p>
                        </div>
                    </div>
                    <div id="testProgress" style="margin-top: 1rem; display: none;">
                        <div class="progress-bar">
                            <div class="progress-fill" id="progressFill"></div>
                        </div>
                        <p style="text-align: center; margin-top: 0.5rem; color: #718096;" id="progressText">
                            Running tests...
                        </p>
                    </div>
                </div>
            </div>

            <div class="test-section">
                <div class="test-section-header">
                    <span><i class="fas fa-chart-pie"></i> Test Summary</span>
                </div>
                <div class="test-section-content">
                    <div class="chart-container" id="resultsChart">
                        <span>Test results chart will appear here after running tests</span>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate functions tab content
     */
    static generateFunctionsTab(plugin, type) {
        if (type === 'function') {
            if (!plugin.functions || Object.keys(plugin.functions).length === 0) {
                return `
                    <div class="test-section">
                        <div class="test-section-header">
                            <span><i class="fas fa-exclamation-triangle"></i> No Functions Available</span>
                        </div>
                        <div class="test-section-content">
                            <p>This plugin does not expose any testable functions.</p>
                        </div>
                    </div>
                `;
            }

            const functionsHTML = Object.entries(plugin.functions).map(([funcName, func]) => `
                <div class="function-card">
                    <div class="function-name">
                        <i class="fas fa-code"></i>
                        ${funcName}
                        <button class="btn btn-small btn-primary" onclick="testSingleFunction('${funcName}')" 
                                style="margin-left: auto; padding: 0.25rem 0.75rem; font-size: 0.875rem;">
                            <i class="fas fa-vial"></i> Test
                        </button>
                    </div>
                    <div class="function-desc">${func.description}</div>
                    <div class="function-params">
                        <strong>Parameters:</strong><br>
                        ${JSON.stringify(func.parameters || {}, null, 2)}
                    </div>
                    <div style="margin-top: 0.75rem;">
                        <button class="btn btn-secondary" onclick="showFunctionDetails('${funcName}')" 
                                style="padding: 0.25rem 0.75rem; font-size: 0.875rem;">
                            <i class="fas fa-info-circle"></i> Details
                        </button>
                        <button class="btn btn-info" onclick="generateSampleCall('${funcName}')" 
                                style="padding: 0.25rem 0.75rem; font-size: 0.875rem;">
                            <i class="fas fa-code"></i> Sample Code
                        </button>
                    </div>
                    <div id="functionResult_${funcName}" style="margin-top: 0.75rem; display: none;"></div>
                </div>
            `).join('');

            return `
                <div class="test-section">
                    <div class="test-section-header">
                        <span><i class="fas fa-code"></i> Function Tests</span>
                        <button class="btn btn-primary" onclick="testAllFunctions()">
                            <i class="fas fa-play"></i> Test All Functions
                        </button>
                    </div>
                    <div class="test-section-content">
                        ${functionsHTML}
                    </div>
                </div>
            `;
        } else {
            const supportedTypes = plugin.supportedDataTypes || [];
            
            const testsHTML = supportedTypes.map(dataType => `
                <div class="function-card">
                    <div class="function-name">
                        <i class="fas fa-chart-bar"></i>
                        Visualization: ${dataType}
                        <button class="btn btn-small btn-primary" onclick="testVisualization('${dataType}')" 
                                style="margin-left: auto; padding: 0.25rem 0.75rem; font-size: 0.875rem;">
                            <i class="fas fa-eye"></i> Test Render
                        </button>
                    </div>
                    <div class="function-desc">Test rendering with ${dataType} data</div>
                    <div style="margin-top: 0.75rem;">
                        <button class="btn btn-secondary" onclick="generateSampleData('${dataType}')" 
                                style="padding: 0.25rem 0.75rem; font-size: 0.875rem;">
                            <i class="fas fa-database"></i> Sample Data
                        </button>
                        <button class="btn btn-info" onclick="testLargeDataset('${dataType}')" 
                                style="padding: 0.25rem 0.75rem; font-size: 0.875rem;">
                            <i class="fas fa-expand-arrows-alt"></i> Large Dataset
                        </button>
                    </div>
                    <div id="visualizationResult_${dataType}" style="margin-top: 0.75rem; display: none;"></div>
                </div>
            `).join('');

            return `
                <div class="test-section">
                    <div class="test-section-header">
                        <span><i class="fas fa-chart-bar"></i> Visualization Tests</span>
                        <button class="btn btn-primary" onclick="testAllVisualizations()">
                            <i class="fas fa-play"></i> Test All Visualizations
                        </button>
                    </div>
                    <div class="test-section-content">
                        ${testsHTML}
                        <div class="function-card">
                            <div class="function-name">
                                <i class="fas fa-tachometer-alt"></i>
                                Performance Test
                                <button class="btn btn-small btn-warning" onclick="runPerformanceTest()" 
                                        style="margin-left: auto; padding: 0.25rem 0.75rem; font-size: 0.875rem;">
                                    <i class="fas fa-stopwatch"></i> Run Performance Test
                                </button>
                            </div>
                            <div class="function-desc">Test rendering performance with large datasets</div>
                        </div>
                    </div>
                </div>
            `;
        }
    }

    /**
     * Generate performance tab content
     */
    static generatePerformanceTab() {
        return `
            <div class="test-section">
                <div class="test-section-header">
                    <span><i class="fas fa-tachometer-alt"></i> Performance Metrics</span>
                    <button class="btn btn-primary" onclick="runBenchmarks()">
                        <i class="fas fa-play"></i> Run Benchmarks
                    </button>
                </div>
                <div class="test-section-content">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 1rem;">
                        <div class="stat-card">
                            <div class="stat-icon info">
                                <i class="fas fa-clock"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value" id="avgExecutionTime">-</div>
                                <div class="stat-label">Avg Execution Time</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon warning">
                                <i class="fas fa-memory"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value" id="memoryUsage">-</div>
                                <div class="stat-label">Memory Usage</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon success">
                                <i class="fas fa-rocket"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value" id="throughput">-</div>
                                <div class="stat-label">Throughput</div>
                            </div>
                        </div>
                        <div class="stat-card">
                            <div class="stat-icon error">
                                <i class="fas fa-exclamation-triangle"></i>
                            </div>
                            <div class="stat-content">
                                <div class="stat-value" id="errorRate">-</div>
                                <div class="stat-label">Error Rate</div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div class="test-section">
                <div class="test-section-header">
                    <span><i class="fas fa-chart-line"></i> Performance History</span>
                </div>
                <div class="test-section-content">
                    <div class="chart-container" id="performanceChart">
                        <span>Performance chart will appear here after running benchmarks</span>
                    </div>
                </div>
            </div>

            <div class="test-section">
                <div class="test-section-header">
                    <span><i class="fas fa-cogs"></i> Stress Tests</span>
                </div>
                <div class="test-section-content">
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
                        <div class="function-card">
                            <div class="function-name">
                                <i class="fas fa-expand-arrows-alt"></i>
                                Load Test
                            </div>
                            <div class="function-desc">Test with increasing load to find performance limits</div>
                            <button class="btn btn-warning" onclick="runLoadTest()">
                                <i class="fas fa-weight-hanging"></i> Run Load Test
                            </button>
                        </div>
                        <div class="function-card">
                            <div class="function-name">
                                <i class="fas fa-bolt"></i>
                                Concurrency Test
                            </div>
                            <div class="function-desc">Test concurrent execution performance</div>
                            <button class="btn btn-warning" onclick="runConcurrencyTest()">
                                <i class="fas fa-layer-group"></i> Run Concurrency Test
                            </button>
                        </div>
                        <div class="function-card">
                            <div class="function-name">
                                <i class="fas fa-hourglass-half"></i>
                                Endurance Test
                            </div>
                            <div class="function-desc">Test long-running performance and memory leaks</div>
                            <button class="btn btn-warning" onclick="runEnduranceTest()">
                                <i class="fas fa-stopwatch"></i> Run Endurance Test
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate logs tab content
     */
    static generateLogsTab() {
        return `
            <div class="test-section">
                <div class="test-section-header">
                    <span><i class="fas fa-terminal"></i> Test Logs</span>
                    <div>
                        <button class="btn btn-secondary" onclick="clearLogs()">
                            <i class="fas fa-trash"></i> Clear Logs
                        </button>
                        <button class="btn btn-info" onclick="exportLogs()">
                            <i class="fas fa-download"></i> Export Logs
                        </button>
                    </div>
                </div>
                <div class="test-section-content">
                    <div class="test-logs" id="testLogs">
[${new Date().toLocaleTimeString()}] [INFO] Test logging system initialized
[${new Date().toLocaleTimeString()}] [INFO] Ready to capture test output...

                    </div>
                </div>
            </div>

            <div class="test-section">
                <div class="test-section-header">
                    <span><i class="fas fa-filter"></i> Log Filters</span>
                </div>
                <div class="test-section-content">
                    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
                        <label style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="checkbox" id="logInfo" checked>
                            <span style="color: #4299e1;">INFO</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="checkbox" id="logWarning" checked>
                            <span style="color: #ed8936;">WARNING</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="checkbox" id="logError" checked>
                            <span style="color: #f56565;">ERROR</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 0.5rem;">
                            <input type="checkbox" id="logDebug">
                            <span style="color: #718096;">DEBUG</span>
                        </label>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate enhanced test script
     */
    static generateEnhancedTestScript(pluginId, plugin, type) {
        return `
            // Test state management
            let testState = {
                isRunning: false,
                currentTest: null,
                results: [],
                stats: {
                    total: 0,
                    passed: 0,
                    failed: 0,
                    startTime: null,
                    endTime: null
                },
                logs: []
            };

            // Logging system
            function log(message, level = 'INFO') {
                const timestamp = new Date().toLocaleTimeString();
                const logEntry = \`[\${timestamp}] [\${level}] \${message}\`;
                testState.logs.push({ timestamp, level, message });
                
                const logsContainer = document.getElementById('testLogs');
                if (logsContainer) {
                    logsContainer.textContent += logEntry + '\\n';
                    logsContainer.scrollTop = logsContainer.scrollHeight;
                }
                
                console.log(logEntry);
            }

            // Statistics update
            function updateStats() {
                document.getElementById('totalTests').textContent = testState.stats.total;
                document.getElementById('passedTests').textContent = testState.stats.passed;
                document.getElementById('failedTests').textContent = testState.stats.failed;
                
                if (testState.stats.startTime) {
                    const duration = testState.stats.endTime ? 
                        testState.stats.endTime - testState.stats.startTime :
                        Date.now() - testState.stats.startTime;
                    document.getElementById('testDuration').textContent = duration + 'ms';
                }
                
                const successRate = testState.stats.total > 0 ? 
                    (testState.stats.passed / testState.stats.total * 100).toFixed(1) : 0;
                document.getElementById('successRate').textContent = successRate + '%';
            }

            // Tab switching
            function switchTab(tabName) {
                // Update tab buttons
                document.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.classList.toggle('active', btn.dataset.tab === tabName);
                });
                
                // Update tab content
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.toggle('active', content.id === tabName + '-tab');
                });
            }

            // Test execution functions
            async function runFullTestSuite() {
                if (testState.isRunning) {
                    log('Test suite is already running', 'WARNING');
                    return;
                }

                log('Starting full test suite for ${plugin.name}');
                testState.isRunning = true;
                testState.stats.startTime = Date.now();
                testState.stats.total = 0;
                testState.stats.passed = 0;
                testState.stats.failed = 0;
                
                try {
                    await runBasicValidation();
                    ${type === 'function' ? 'await testAllFunctions();' : 'await testAllVisualizations();'}
                    await runPerformanceTest();
                    
                    testState.stats.endTime = Date.now();
                    log(\`Test suite completed. \${testState.stats.passed}/\${testState.stats.total} tests passed.\`);
                    
                } catch (error) {
                    log(\`Test suite failed: \${error.message}\`, 'ERROR');
                } finally {
                    testState.isRunning = false;
                    updateStats();
                }
            }

            async function runQuickTest() {
                log('Running quick validation test');
                await runBasicValidation();
            }

            async function runBasicValidation() {
                log('Running basic plugin validation...');
                
                const plugin = ${JSON.stringify(plugin)};
                
                addTestResult('Plugin Name', !!plugin.name, 
                    plugin.name ? \`Name: \${plugin.name}\` : 'Missing plugin name');
                addTestResult('Plugin Version', !!plugin.version, 
                    plugin.version ? \`Version: \${plugin.version}\` : 'Missing version');
                addTestResult('Plugin Description', !!plugin.description, 
                    plugin.description ? 'Description present' : 'Missing description');
                
                ${type === 'function' ? `
                    addTestResult('Functions Available', 
                        !!(plugin.functions && Object.keys(plugin.functions).length > 0), 
                        plugin.functions ? \`\${Object.keys(plugin.functions).length} functions available\` : 'No functions defined');
                ` : `
                    addTestResult('Supported Data Types', 
                        !!(plugin.supportedDataTypes && plugin.supportedDataTypes.length > 0),
                        plugin.supportedDataTypes ? \`\${plugin.supportedDataTypes.length} data types supported\` : 'No data types defined');
                `}
            }

            function addTestResult(testName, success, message, details = '') {
                testState.stats.total++;
                if (success) {
                    testState.stats.passed++;
                } else {
                    testState.stats.failed++;
                }
                
                const result = { testName, success, message, details, timestamp: Date.now() };
                testState.results.push(result);
                
                // Add to results tab
                const resultsContainer = document.getElementById('testResultsContainer');
                if (resultsContainer && resultsContainer.children.length === 1) {
                    resultsContainer.innerHTML = '';
                }
                
                if (resultsContainer) {
                    const resultDiv = document.createElement('div');
                    resultDiv.className = \`test-result \${success ? 'success' : 'error'}\`;
                    resultDiv.innerHTML = \`
                        <i class="fas \${success ? 'fa-check-circle' : 'fa-times-circle'}"></i>
                        <div>
                            <strong>\${testName}</strong>: \${message}
                            \${details ? \`<br><small>\${details}</small>\` : ''}
                        </div>
                    \`;
                    resultsContainer.appendChild(resultDiv);
                }
                
                updateStats();
                log(\`Test "\${testName}": \${success ? 'PASSED' : 'FAILED'} - \${message}\`);
            }

            // Initialize event listeners
            document.addEventListener('DOMContentLoaded', () => {
                // Tab switching
                document.querySelectorAll('.tab-btn').forEach(btn => {
                    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
                });
                
                // Control buttons
                document.getElementById('runFullTestSuite')?.addEventListener('click', runFullTestSuite);
                document.getElementById('runQuickTest')?.addEventListener('click', runQuickTest);
                document.getElementById('runPerformanceTest')?.addEventListener('click', runPerformanceTest);
                document.getElementById('generateReport')?.addEventListener('click', generateReport);
                
                // Auto-run quick test
                setTimeout(runQuickTest, 1000);
            });

            // Utility functions
            function generateReport() {
                const report = {
                    plugin: '${plugin.name}',
                    version: '${plugin.version}',
                    type: '${type}',
                    timestamp: new Date().toISOString(),
                    stats: testState.stats,
                    results: testState.results,
                    logs: testState.logs
                };
                
                const blob = new Blob([JSON.stringify(report, null, 2)], {type: 'application/json'});
                const url = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = \`plugin-test-report-\${plugin.name}-\${Date.now()}.json\`;
                a.click();
                URL.revokeObjectURL(url);
                
                log('Test report generated and downloaded');
            }

            function clearResults() {
                testState.results = [];
                testState.stats = { total: 0, passed: 0, failed: 0, startTime: null, endTime: null };
                document.getElementById('testResultsContainer').innerHTML = 
                    '<div style="text-align: center; padding: 3rem; color: #718096;"><i class="fas fa-flask" style="font-size: 3rem; margin-bottom: 1rem; opacity: 0.5;"></i><p>No test results yet. Run a test to see results here.</p></div>';
                updateStats();
                log('Test results cleared');
            }

            function clearLogs() {
                testState.logs = [];
                document.getElementById('testLogs').textContent = '[' + new Date().toLocaleTimeString() + '] [INFO] Logs cleared\\n';
                log('Logs cleared');
            }

            // Export the enhanced script
            if (typeof window !== 'undefined') {
                window.TestHelpers = {
                    log, updateStats, switchTab, runFullTestSuite, runQuickTest,
                    runBasicValidation, addTestResult, generateReport, clearResults, clearLogs
                };
            }
        `;
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginTestHelpers;
} else if (typeof window !== 'undefined') {
    window.PluginTestHelpers = PluginTestHelpers;
} 