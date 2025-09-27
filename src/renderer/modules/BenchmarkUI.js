/**
 * Benchmark UI - User interface for LLM benchmark system
 */
class BenchmarkUI {
    constructor(benchmarkFramework) {
        this.framework = benchmarkFramework;
        this.currentResults = null;
        this.isRunning = false;
        this.window = null;
        this.manualTestLock = false; // Prevent concurrent manual tests
        this.manualTestResults = {};
        this.setupEventHandlers();
    }

    /**
     * Show benchmark runner - Open in separate window
     */
    async showBenchmarkRunner() {
        console.log('🧪 Opening benchmark runner window...');
        
        try {
            // Directly open benchmark runner window
            this.showBenchmarkRunnerWindow();
            console.log('✅ Benchmark runner window opened');
            
        } catch (error) {
            console.error('❌ Failed to open benchmark runner:', error);
        }
    }

    /**
     * Show benchmark interface in main window
     */
    showBenchmarkInterface() {
        try {
            console.log('🎯 Starting benchmark interface display...');
            
            // CRITICAL FIX: Check if interface already exists
            const existingInterface = document.getElementById('benchmarkInterface');
            if (existingInterface) {
                console.log('⚠️ Benchmark interface already exists, focusing existing one');
                // Focus existing interface and ensure it's visible
                existingInterface.style.display = 'block';
                existingInterface.style.visibility = 'visible';
                existingInterface.style.opacity = '1';
                
                // If collapsed, expand it
                if (existingInterface.classList.contains('collapsed')) {
                    this.toggleBenchmarkInterface();
                }
                
                return; // Exit early - do not create duplicate
            }
            
            // Create benchmark interface only if none exists
            const benchmarkInterface = this.createBenchmarkInterface();
            console.log('🔧 Benchmark interface created:', benchmarkInterface);
            
            // Add benchmark interface to body as an overlay
            document.body.appendChild(benchmarkInterface);
            console.log('✅ Benchmark interface added to body');
            
            // Ensure interface is visible with overlay positioning
            benchmarkInterface.style.display = 'block';
            benchmarkInterface.style.visibility = 'visible';
            benchmarkInterface.style.opacity = '1';
            benchmarkInterface.style.position = 'fixed';
            benchmarkInterface.style.top = '0';
            benchmarkInterface.style.left = '0';
            benchmarkInterface.style.width = '100vw';
            benchmarkInterface.style.height = '100vh';
            benchmarkInterface.style.zIndex = '999999';
            
            // Force immediate rendering
            benchmarkInterface.offsetHeight;
            benchmarkInterface.offsetWidth;
            
            // Setup interface event handlers
            this.setupBenchmarkInterfaceHandlers();
            console.log('🎮 Event handlers setup complete');
            
            // Verify interface is actually visible
            const isVisible = benchmarkInterface.offsetHeight > 0 && 
                             benchmarkInterface.offsetWidth > 0 &&
                             window.getComputedStyle(benchmarkInterface).display !== 'none';
            
            if (!isVisible) {
                console.warn('⚠️ Interface may not be visible, forcing display');
                benchmarkInterface.style.cssText = `
                    display: block !important;
                    visibility: visible !important;
                    opacity: 1 !important;
                    position: fixed !important;
                    top: 0 !important;
                    left: 0 !important;
                    width: 100vw !important;
                    height: 100vh !important;
                    z-index: 999999 !important;
                    background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%) !important;
                `;
            }
            
            console.log('✅ Benchmark interface display complete');
            
        } catch (error) {
            console.error('❌ Failed to show benchmark interface:', error);
            
            // Emergency fallback: show alert with instructions
            alert('Failed to display benchmark interface. Please try restarting the application.');
            
            throw error;
        }
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
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background: transparent;
                    z-index: 999999; /* High z-index to stay above main interface tabs */
                    overflow-y: auto;
                    padding: 20px;
                    display: block !important;
                    visibility: visible !important;
                    pointer-events: none;
                }

                .benchmark-container {
                    max-width: 1400px;
                    margin: 0 auto;
                    background: rgba(255, 255, 255, 0.98);
                    border-radius: 15px;
                    padding: 30px;
                    box-shadow: 0 8px 30px rgba(0,0,0,0.25);
                    backdrop-filter: blur(10px);
                    border: 2px solid rgba(52, 152, 219, 0.3);
                    pointer-events: auto;
                    z-index: inherit; /* Inherit high z-index from parent */
                }

                .benchmark-header {
                    text-align: center;
                    margin-bottom: 30px;
                    padding-bottom: 20px;
                    border-bottom: 3px solid #3498db;
                    position: relative;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }

                .benchmark-header:hover {
                    background: rgba(52, 152, 219, 0.05);
                }

                .header-content {
                    width: 100%;
                }

                .header-controls {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    display: flex;
                    gap: 8px;
                    z-index: 10;
                }

                .minimize-benchmark-btn {
                    width: 40px;
                    height: 40px;
                    border: none;
                    background: #3498db;
                    color: white;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                }

                .minimize-benchmark-btn:hover {
                    background: #2980b9;
                    transform: scale(1.1);
                }

                .close-benchmark-btn {
                    width: 40px;
                    height: 40px;
                    border: none;
                    background: #e74c3c;
                    color: white;
                    border-radius: 50%;
                    cursor: pointer;
                    font-size: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    transition: all 0.3s ease;
                }

                .close-benchmark-btn:hover {
                    background: #c0392b;
                    transform: scale(1.1);
                }

                /* Collapsed state styles */
                .benchmark-interface.collapsed {
                    height: 80px !important;
                    overflow: hidden;
                    background: transparent;
                    z-index: 999999 !important; /* Ensure collapsed state stays above main tabs */
                }

                .benchmark-interface.collapsed .benchmark-container {
                    height: 80px;
                    padding: 10px 30px;
                    overflow: hidden;
                    background: rgba(255, 255, 255, 0.95);
                    z-index: 999999 !important; /* Maintain high z-index during dragging */
                }

                /* Hide sections but keep header visible */
                .benchmark-interface.collapsed .benchmark-section {
                    display: none !important;
                }

                .benchmark-interface.collapsed .benchmark-header {
                    margin-bottom: 0;
                    padding-bottom: 0;
                    border-bottom: none;
                    display: block !important; /* Ensure header stays visible */
                }

                .benchmark-interface.collapsed .benchmark-title {
                    font-size: 20px;
                    margin-bottom: 0;
                }

                .benchmark-interface.collapsed .benchmark-subtitle {
                    font-size: 12px;
                }

                .expand-indicator {
                    display: none;
                    position: absolute;
                    bottom: 5px;
                    left: 50%;
                    transform: translateX(-50%);
                    background: rgba(52, 152, 219, 0.2);
                    color: #3498db;
                    padding: 2px 8px;
                    border-radius: 10px;
                    font-size: 10px;
                    font-weight: 600;
                }

                .benchmark-interface.collapsed .expand-indicator {
                    display: block;
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

                .checkbox-item span small {
                    color: #6c757d;
                    font-weight: 500;
                    font-size: 12px;
                    margin-left: 5px;
                    background: rgba(52, 152, 219, 0.1);
                    padding: 2px 6px;
                    border-radius: 10px;
                    border: 1px solid rgba(52, 152, 219, 0.2);
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
                <div class="benchmark-header" id="benchmarkHeader">
                    <div class="header-content">
                        <h1 class="benchmark-title">
                            <span>🧪</span>
                            LLM Instruction Following Benchmark
                            <span>🧪</span>
                        </h1>

                    </div>
                    <div class="header-controls">
                        <button class="minimize-benchmark-btn" onclick="event.stopPropagation(); window.benchmarkUI.toggleBenchmarkInterface()" title="Minimize/Expand Interface">
                            <i class="fas fa-chevron-up" id="toggleIcon"></i>
                        </button>
                        <button class="close-benchmark-btn" onclick="event.stopPropagation(); window.benchmarkUI.closeBenchmarkInterface()" title="Close Benchmark Interface">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </div>

                <!-- Configuration Section -->
                <div class="benchmark-section" id="configSection">
                    <h2>⚙️ Configuration</h2>
                    <div class="config-grid">
                        <div class="config-group">
                            <h3>📋 Test Suites</h3>
                            <div class="checkbox-grid">
                                <label class="checkbox-item">
                                    <input type="checkbox" id="suite-automatic_simple" checked>
                                    <span>⚙️ Automatic Simple Tests <small>(14 tests)</small></span>
                                </label>
                                <label class="checkbox-item">
                                    <input type="checkbox" id="suite-automatic_complex">
                                    <span>🔧 Automatic Complex Tests <small>(1 test)</small></span>
                                </label>
                                <label class="checkbox-item">
                                    <input type="checkbox" id="suite-manual_simple">
                                    <span>👥 Manual Simple Tests <small>(8 tests)</small></span>
                                </label>
                                <label class="checkbox-item">
                                    <input type="checkbox" id="suite-manual_complex">
                                    <span>🧠 Manual Complex Tests <small>(10 tests)</small></span>
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
                                    <input type="checkbox" id="includeLLMInteractions" checked>
                                    <span>🤖 Include LLM Interaction Details</span>
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
                                        <option value="120000">2 minutes</option>
                                        <option value="180000">3 minutes</option>
                                        <option value="240000">4 minutes</option>
                                        <option value="300000">5 minutes</option>
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
                        <button class="btn" id="exportLLMInteractions" disabled style="background: #9b59b6; color: white;">
                            <span>🤖</span> Export LLM Interactions
                        </button>
                        <button class="btn" id="testManualDialog" style="background: #f39c12; color: white;" title="Test Manual Dialog System">
                            <span>🗪</span> Test Manual Dialog
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
     * Toggle benchmark interface between collapsed and expanded states
     */
    toggleBenchmarkInterface() {
        const benchmarkInterface = document.getElementById('benchmarkInterface');
        const toggleIcon = document.getElementById('toggleIcon');
        
        if (!benchmarkInterface) return;
        
        const isCollapsed = benchmarkInterface.classList.contains('collapsed');
        
        if (isCollapsed) {
            // Expand
            benchmarkInterface.classList.remove('collapsed');
            if (toggleIcon) {
                toggleIcon.className = 'fas fa-chevron-up';
            }
            console.log('🔼 Benchmark interface expanded');
        } else {
            // Collapse
            benchmarkInterface.classList.add('collapsed');
            if (toggleIcon) {
                toggleIcon.className = 'fas fa-chevron-down';
            }
            console.log('🔽 Benchmark interface collapsed');
        }
    }

    /**
     * Close benchmark interface
     */
    closeBenchmarkInterface() {
        console.log('📜 Closing benchmark interface...');
        
        // Remove benchmark interface
        const benchmarkInterface = document.getElementById('benchmarkInterface');
        if (benchmarkInterface) {
            benchmarkInterface.remove();
        }
        
        // Clean up drag styles
        const dragStyles = document.getElementById('benchmark-drag-styles');
        if (dragStyles) {
            dragStyles.remove();
        }
        
        // Reset handlers flag to allow fresh setup next time
        this.handlersSetup = false;
        
        // Stop any running benchmark
        if (this.isRunning) {
            this.stopMainWindowBenchmark();
        }
        
        console.log('✅ Benchmark interface closed and cleaned up');
    }

    /**
     * Setup benchmark interface event handlers
     */
    setupBenchmarkInterfaceHandlers() {
        // CRITICAL FIX: Prevent duplicate handler setup
        if (this.handlersSetup) {
            console.log('⚠️ Event handlers already setup, skipping duplicate setup');
            return;
        }
        
        // Button handlers
        const startBtn = document.getElementById('startBenchmark');
        const stopBtn = document.getElementById('stopBenchmark');
        const exportBtn = document.getElementById('exportResults');
        const testBtn = document.getElementById('testManualDialog');
        
        if (startBtn) startBtn.onclick = () => this.startMainWindowBenchmark();
        if (stopBtn) stopBtn.onclick = () => this.stopMainWindowBenchmark();
        if (exportBtn) exportBtn.onclick = () => this.exportMainWindowResults();
        if (testBtn) testBtn.onclick = () => this.triggerTestManualDialog();
        
        // Setup drag functionality for the title bar
        this.setupDragFunctionality();
        
        // Add manual test interaction handlers
        this.setupManualTestHandlers();
        
        // Mark handlers as setup to prevent duplicates
        this.handlersSetup = true;
        console.log('✅ Event handlers setup complete (no duplicates)');
    }

    /**
     * Setup drag functionality for moving the benchmark interface
     */
    setupDragFunctionality() {
        const header = document.getElementById('benchmarkHeader');
        const container = header.closest('.benchmark-container');
        
        if (!header || !container) return;
        
        let isDragging = false;
        let startX, startY, startLeft, startTop;
        
        // Add draggable cursor style
        header.style.cursor = 'move';
        
        header.addEventListener('mousedown', (e) => {
            // Only start dragging if clicking directly on header (not controls)
            if (e.target.closest('.header-controls')) return;
            
            isDragging = true;
            startX = e.clientX;
            startY = e.clientY;
            
            // Get current position of container
            const rect = container.getBoundingClientRect();
            startLeft = rect.left;
            startTop = rect.top;
            
            // CRITICAL: Boost z-index for dragging to stay above main tabs
            const benchmarkInterface = document.getElementById('benchmarkInterface');
            if (benchmarkInterface) {
                benchmarkInterface.style.zIndex = '9999999';
            }
            container.style.zIndex = '9999999';
            
            // Change container positioning to absolute for dragging
            container.style.position = 'absolute';
            container.style.left = startLeft + 'px';
            container.style.top = startTop + 'px';
            container.style.margin = '0';
            container.style.transform = 'none';
            
            // Add dragging class for visual feedback
            header.classList.add('dragging');
            
            e.preventDefault();
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            const newLeft = startLeft + deltaX;
            const newTop = startTop + deltaY;
            
            // Ensure the interface stays within viewport bounds
            const viewportWidth = window.innerWidth;
            const viewportHeight = window.innerHeight;
            const containerWidth = container.offsetWidth;
            const containerHeight = container.offsetHeight;
            
            const boundedLeft = Math.max(0, Math.min(newLeft, viewportWidth - containerWidth));
            const boundedTop = Math.max(0, Math.min(newTop, viewportHeight - containerHeight));
            
            container.style.left = boundedLeft + 'px';
            container.style.top = boundedTop + 'px';
        });
        
        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                header.classList.remove('dragging');
                
                // Restore normal z-index after dragging
                const benchmarkInterface = document.getElementById('benchmarkInterface');
                if (benchmarkInterface) {
                    benchmarkInterface.style.zIndex = '999999'; // Back to normal high z-index
                }
                container.style.zIndex = ''; // Remove inline z-index, let CSS take over
            }
        });
        
        // Add CSS styles for dragging state (prevent duplicates)
        const existingDragStyle = document.getElementById('benchmark-drag-styles');
        if (!existingDragStyle) {
            const style = document.createElement('style');
            style.id = 'benchmark-drag-styles'; // Add ID to prevent duplicates
            style.textContent = `
                .benchmark-header.dragging {
                    cursor: grabbing !important;
                    user-select: none;
                }
                
                .benchmark-header:hover {
                    background: rgba(52, 152, 219, 0.05);
                }
                
                /* Enhanced z-index during dragging to stay above main tabs */
                .benchmark-header.dragging .benchmark-container,
                .benchmark-header.dragging ~ * {
                    z-index: 9999999 !important;
                }
                
                /* Ensure entire interface has maximum z-index during drag */
                .benchmark-interface:has(.benchmark-header.dragging) {
                    z-index: 9999999 !important;
                }
            `;
            document.head.appendChild(style);
        }
    }

    /**
     * Setup handlers for manual test interactions
     */
    setupManualTestHandlers() {
        console.log('🔍 Setting up manual test handlers...');
        
        // Remove existing event listeners to prevent duplicates
        if (this.manualTestRequiredHandler) {
            document.removeEventListener('manualTestRequired', this.manualTestRequiredHandler);
        }
        if (this.manualTestCompletedHandler) {
            document.removeEventListener('manualTestCompleted', this.manualTestCompletedHandler);
        }
        
        // Create bound handlers
        this.manualTestRequiredHandler = (event) => {
            console.log('📝 Manual test required event received:', event.detail);
            this.handleManualTest(event.detail);
        };
        
        this.manualTestCompletedHandler = (event) => {
            console.log('✅ Manual test completed event received:', event.detail);
            this.handleManualTestCompletion(event.detail);
        };
        
        // Listen for manual test events
        document.addEventListener('manualTestRequired', this.manualTestRequiredHandler);
        
        // Listen for manual test completion
        document.addEventListener('manualTestCompleted', this.manualTestCompletedHandler);
        
        console.log('✅ Manual test handlers setup complete');
    }

    /**
     * Trigger a manual test (for testing the dialog system)
     */
    triggerTestManualDialog() {
        console.log('🧪 Triggering test manual dialog...');
        
        const testData = {
            testId: 'test_manual_01',
            testName: 'Test Manual Dialog',
            category: 'navigation',
            complexity: 'simple',
            instruction: 'This is a test manual dialog. Please verify that this dialog appears correctly and all interactive elements work as expected.',
            expectedResult: {
                tool_name: 'test_function',
                parameters: {
                    test: true
                }
            },
            maxScore: 5,
            manualVerification: 'Please verify: 1) This dialog appears correctly, 2) All buttons are clickable, 3) The interface is user-friendly, 4) You can interact with verification items.'
        };
        
        // Dispatch manual test event
        document.dispatchEvent(new CustomEvent('manualTestRequired', {
            detail: testData
        }));
    }

    /**
     * Handle manual test execution with user interaction
     */
    async handleManualTest(testData) {
        console.log('🔍 Manual test required:', testData.testName);
        
        // Check if another manual test is already running
        if (this.manualTestLock) {
            console.warn('⚠️ Another manual test is already running, waiting...');
            
            // Wait for the current manual test to complete
            while (this.manualTestLock) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
        
        // Set lock to prevent concurrent manual tests
        this.manualTestLock = true;
        console.log('🔒 Manual test lock acquired for:', testData.testId);
        
        try {
            // Create manual test dialog
            const dialog = this.createManualTestDialog(testData);
            document.body.appendChild(dialog);
            
            // Show the dialog with animation
            dialog.style.display = 'block';
            dialog.style.opacity = '0';
            dialog.offsetHeight; // Force reflow
            dialog.style.transition = 'opacity 0.3s ease';
            dialog.style.opacity = '1';
            
            console.log('✨ Manual test dialog displayed for:', testData.testName);
            
            // Return a promise that resolves when user completes the test
            return new Promise((resolve) => {
                // Store resolve function globally for access from onclick handlers
                window[`resolveManualTest_${testData.testId}`] = (resultData) => {
                    console.log('📝 Manual test completed, resolving promise:', resultData);
                    
                    // Release the lock
                    this.manualTestLock = false;
                    console.log('🔓 Manual test lock released for:', testData.testId);
                    
                    resolve(resultData);
                };
                
                console.log('⏳ Waiting for user to complete manual test:', testData.testId);
            });
        } catch (error) {
            // Release lock on error
            this.manualTestLock = false;
            console.error('❌ Error creating manual test dialog:', error);
            throw error;
        }
    }

    /**
     * Create interactive dialog for manual tests with automatic scoring
     */
    createManualTestDialog(testData) {
        const dialog = document.createElement('div');
        dialog.className = 'manual-test-dialog';
        dialog.id = `manual-test-${testData.testId}`;
        
        // Parse verification items and assign scores
        const verificationItems = this.parseVerificationItems(testData.manualVerification);
        const itemScore = verificationItems.length > 0 ? Math.floor((testData.maxScore - 1) / verificationItems.length) : 0;
        const bonusScore = 1; // Extra point for completion
        
        dialog.innerHTML = `
            <style>
                .manual-test-dialog {
                    position: fixed;
                    top: 50px;
                    right: 50px;
                    width: auto;
                    height: auto;
                    background: transparent;
                    display: none;
                    z-index: 999999;
                    pointer-events: none;
                }
                
                .manual-test-content {
                    background: white;
                    border-radius: 15px;
                    padding: 30px;
                    max-width: 500px;
                    width: auto;
                    max-height: 80vh;
                    overflow-y: auto;
                    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.4);
                    border: 3px solid #3498db;
                    animation: modalAppear 0.3s ease;
                    pointer-events: all;
                    position: relative;
                }
                
                @keyframes modalAppear {
                    from {
                        opacity: 0;
                        transform: scale(0.8) translateY(-50px);
                    }
                    to {
                        opacity: 1;
                        transform: scale(1) translateY(0);
                    }
                }
                
                .manual-test-header {
                    border-bottom: 2px solid #3498db;
                    padding-bottom: 15px;
                    margin-bottom: 20px;
                }
                
                .manual-test-title {
                    font-size: 24px;
                    font-weight: 700;
                    color: #2c3e50;
                    margin: 0 0 10px 0;
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }
                
                .test-category {
                    background: #3498db;
                    color: white;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                
                .test-complexity {
                    background: ${testData.complexity === 'simple' ? '#27ae60' : '#e74c3c'};
                    color: white;
                    padding: 4px 12px;
                    border-radius: 20px;
                    font-size: 12px;
                    font-weight: 600;
                    text-transform: uppercase;
                }
                
                .manual-test-instruction {
                    background: #f8f9fa;
                    border-left: 4px solid #3498db;
                    padding: 20px;
                    margin: 20px 0;
                    border-radius: 8px;
                }
                
                .manual-test-instruction h4 {
                    margin: 0 0 10px 0;
                    color: #2c3e50;
                    font-size: 18px;
                }
                
                .manual-test-instruction p {
                    margin: 0;
                    font-size: 16px;
                    line-height: 1.5;
                    color: #34495e;
                }
                
                .verification-checklist {
                    background: #fff3cd;
                    border: 1px solid #ffeaa7;
                    border-radius: 8px;
                    padding: 20px;
                    margin: 20px 0;
                }
                
                .verification-checklist h4 {
                    margin: 0 0 15px 0;
                    color: #856404;
                    font-size: 16px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .checklist-items {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                }
                
                .checklist-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 10px;
                    margin-bottom: 10px;
                    padding: 8px;
                    border-radius: 4px;
                    transition: background 0.2s;
                }
                
                .checklist-item:hover {
                    background: rgba(255, 235, 59, 0.1);
                }
                
                .checklist-item input[type="checkbox"] {
                    margin-top: 2px;
                    width: 18px;
                    height: 18px;
                    accent-color: #f39c12;
                }
                
                .checklist-item label {
                    flex: 1;
                    cursor: pointer;
                    line-height: 1.4;
                    color: #5d4e75;
                }
                
                .item-score {
                    font-size: 11px;
                    color: #6c757d;
                    font-weight: normal;
                    margin-left: 5px;
                }
                
                .auto-score-display {
                    border: 2px solid #28a745;
                    color: #155724;
                    font-weight: bold;
                }
                
                .verification-checklist {
                    transition: all 0.3s ease;
                    border-left: 4px solid #3498db;
                    padding-left: 15px;
                }
                
                .test-actions {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-top: 30px;
                    padding-top: 20px;
                    border-top: 1px solid #dee2e6;
                }
                
                .test-score-input {
                    display: flex;
                    align-items: center;
                    gap: 15px;
                }
                
                .test-score-input label {
                    font-weight: 600;
                    color: #495057;
                }
                
                .test-score-input select {
                    padding: 8px 12px;
                    border: 2px solid #ced4da;
                    border-radius: 6px;
                    font-size: 14px;
                    background: white;
                    min-width: 120px;
                }
                
                .test-action-buttons {
                    display: flex;
                    gap: 10px;
                }
                
                .btn-manual-test {
                    padding: 10px 20px;
                    border: none;
                    border-radius: 6px;
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }
                
                .btn-manual-test:hover {
                    transform: translateY(-1px);
                }
                
                .btn-pass {
                    background: #27ae60;
                    color: white;
                }
                
                .btn-pass:hover {
                    background: #229954;
                }
                
                .btn-fail {
                    background: #e74c3c;
                    color: white;
                }
                
                .btn-fail:hover {
                    background: #c0392b;
                }
                
                .btn-skip {
                    background: #95a5a6;
                    color: white;
                }
                
                .btn-skip:hover {
                    background: #7f8c8d;
                }
                
                .expected-result {
                    background: #e8f5e8;
                    border: 1px solid #c3e6cb;
                    border-radius: 8px;
                    padding: 15px;
                    margin: 15px 0;
                }
                
                .expected-result h4 {
                    margin: 0 0 10px 0;
                    color: #155724;
                    font-size: 14px;
                    font-weight: 600;
                }
                
                .expected-result code {
                    background: #f1f3f4;
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 13px;
                    color: #2c3e50;
                }
            </style>
            
            <div class="manual-test-content">
                <div class="manual-test-header">
                    <h2 class="manual-test-title">
                        <i class="fas fa-hand-paper"></i>
                        ${testData.testName}
                        <span class="test-category">${testData.category}</span>
                        <span class="test-complexity">${testData.complexity}</span>
                    </h2>
                </div>
                
                <div class="manual-test-instruction">
                    <h4><i class="fas fa-play-circle"></i> Test Instruction</h4>
                    <p>${testData.instruction}</p>
                </div>
                
                ${testData.expectedResult ? `
                <div class="expected-result">
                    <h4><i class="fas fa-bullseye"></i> Expected Tool & Parameters</h4>
                    <p><strong>Tool:</strong> <code>${testData.expectedResult.tool_name || 'N/A'}</code></p>
                    ${testData.expectedResult.parameters ? `
                    <p><strong>Parameters:</strong> <code>${JSON.stringify(testData.expectedResult.parameters, null, 2)}</code></p>
                    ` : ''}
                </div>
                ` : ''}
                
                ${testData.manualVerification ? `
                <div class="verification-checklist">
                    <h4><i class="fas fa-tasks"></i> Verification Checklist (Auto-Scoring)</h4>
                    <div class="scoring-info" style="background: #e3f2fd; border: 1px solid #90caf9; padding: 10px; border-radius: 6px; margin-bottom: 15px; font-size: 13px;">
                        <strong>Automatic Scoring:</strong> Each item = ${itemScore} pts, Completion bonus = ${bonusScore} pt, Total possible = ${testData.maxScore} pts
                    </div>
                    <ul class="checklist-items">
                        ${this.parseVerificationItems(testData.manualVerification).map((item, index) => `
                            <li class="checklist-item">
                                <input type="checkbox" id="check-${testData.testId}-${index}" 
                                       data-score="${itemScore}" 
                                       onchange="window.benchmarkUI.updateAutomaticScore('${testData.testId}', ${itemScore}, ${bonusScore}, ${testData.maxScore})">
                                <label for="check-${testData.testId}-${index}">
                                    ${item} <span class="item-score">(${itemScore} pts)</span>
                                </label>
                            </li>
                        `).join('')}
                    </ul>
                    <div class="auto-score-display" style="margin-top: 10px; padding: 8px; background: #f8f9fa; border-radius: 4px; text-align: center;">
                        <strong>Current Score: <span id="auto-score-${testData.testId}">0</span> / ${testData.maxScore} pts</strong>
                    </div>
                </div>
                ` : ''}
                
                <div class="test-actions">
                    <div class="test-score-input">
                        <label for="manual-score-${testData.testId}">Manual Score:</label>
                        <select id="manual-score-${testData.testId}">
                            <option value="${testData.maxScore}">Full Score (${testData.maxScore} pts)</option>
                            <option value="${Math.floor(testData.maxScore * 0.75)}">Good (${Math.floor(testData.maxScore * 0.75)} pts)</option>
                            <option value="${Math.floor(testData.maxScore * 0.5)}">Partial (${Math.floor(testData.maxScore * 0.5)} pts)</option>
                            <option value="${Math.floor(testData.maxScore * 0.25)}">Minimal (${Math.floor(testData.maxScore * 0.25)} pts)</option>
                            <option value="0">Failed (0 pts)</option>
                        </select>
                    </div>
                    
                    <div class="test-action-buttons">
                        <button class="btn-manual-test btn-pass" onclick="window.benchmarkUI.completeManualTest('${testData.testId}', 'pass')">
                            <i class="fas fa-check"></i> Pass
                        </button>
                        <button class="btn-manual-test btn-fail" onclick="window.benchmarkUI.completeManualTest('${testData.testId}', 'fail')">
                            <i class="fas fa-times"></i> Fail
                        </button>
                        <button class="btn-manual-test btn-skip" onclick="window.benchmarkUI.completeManualTest('${testData.testId}', 'skip')">
                            <i class="fas fa-forward"></i> Skip
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        return dialog;
    }

    /**
     * Update automatic score based on checklist verification
     */
    updateAutomaticScore(testId, itemScore, bonusScore, maxScore) {
        const dialog = document.getElementById(`manual-test-${testId}`);
        if (!dialog) return;
        
        // Count checked items
        const checkboxes = dialog.querySelectorAll('input[type="checkbox"]');
        const checkedItems = Array.from(checkboxes).filter(cb => cb.checked).length;
        
        // Calculate score: (checked items * item score) + bonus if all completed
        let autoScore = checkedItems * itemScore;
        if (checkedItems === checkboxes.length && checkboxes.length > 0) {
            autoScore += bonusScore; // Completion bonus
        }
        
        // Cap at max score
        autoScore = Math.min(autoScore, maxScore);
        
        // Update display
        const scoreDisplay = document.getElementById(`auto-score-${testId}`);
        if (scoreDisplay) {
            scoreDisplay.textContent = autoScore;
        }
        
        // Update manual score select to match auto score
        const scoreSelect = document.getElementById(`manual-score-${testId}`);
        if (scoreSelect) {
            scoreSelect.value = autoScore;
        }
        
        // Visual feedback for completion
        const checklistContainer = dialog.querySelector('.verification-checklist');
        if (checklistContainer) {
            if (checkedItems === checkboxes.length && checkboxes.length > 0) {
                checklistContainer.style.borderLeft = '4px solid #27ae60';
                checklistContainer.style.background = '#f8fff8';
            } else {
                checklistContainer.style.borderLeft = '4px solid #3498db';
                checklistContainer.style.background = '#f8f9fa';
            }
        }
        
        console.log(`📊 Auto-score updated for ${testId}: ${autoScore}/${maxScore} (${checkedItems}/${checkboxes.length} items checked)`);
    }

    /**
     * Parse verification items from manualVerification string
     */
    parseVerificationItems(verificationText) {
        if (!verificationText) return [];
        
        // Remove "Please verify:" prefix if it exists
        let cleanText = verificationText.replace(/^Please verify:\s*/i, '');
        
        // Split by numbered items (1), 2), 3), etc.) or simple enumeration
        const items = cleanText.split(/\d+\)\s*/).filter(item => item.trim());
        
        // If no numbered items found, try splitting by commas or line breaks
        if (items.length <= 1) {
            const alternativeItems = cleanText.split(/[,;\n]/).filter(item => item.trim());
            if (alternativeItems.length > 1) {
                return alternativeItems.map(item => item.trim());
            }
        }
        
        return items.map(item => item.trim()).filter(item => item.length > 0);
    }

    /**
     * Complete manual test with user input and automatic scoring
     */
    completeManualTest(testId, result) {
        console.log('✅ Completing manual test:', testId, 'with result:', result);
        
        const dialog = document.getElementById(`manual-test-${testId}`);
        if (!dialog) {
            console.error('❌ Manual test dialog not found for:', testId);
            return;
        }
        
        try {
            // Get automatic score (already calculated by updateAutomaticScore)
            const scoreSelect = document.getElementById(`manual-score-${testId}`);
            const automaticScore = scoreSelect ? parseInt(scoreSelect.value) : 0;
            
            // Get verification checklist status
            const checkboxes = dialog.querySelectorAll('input[type="checkbox"]');
            const completedItems = Array.from(checkboxes).filter(cb => cb.checked).length;
            const totalItems = checkboxes.length;
            
            // Calculate verification percentage
            const verificationPercentage = totalItems > 0 ? (completedItems / totalItems) : 1;
            
            // Create result data with automatic scoring
            const resultData = {
                testId: testId,
                result: result,
                manualScore: automaticScore, // Use automatic score
                automaticScore: automaticScore,
                verificationCompletion: verificationPercentage,
                completedVerifications: completedItems,
                totalVerifications: totalItems,
                timestamp: new Date().toISOString(),
                scoringMethod: 'automatic',
                verificationDetails: Array.from(checkboxes).map((cb, index) => ({
                    item: cb.nextElementSibling.textContent,
                    completed: cb.checked,
                    score: cb.checked ? parseInt(cb.dataset.score || '0') : 0
                }))
            };
            
            console.log('📊 Manual test completed with automatic scoring:', resultData);
            
            // Close dialog with animation
            dialog.style.transition = 'opacity 0.3s ease';
            dialog.style.opacity = '0';
            setTimeout(() => {
                dialog.remove();
            }, 300);
            
            // Resolve the promise if available
            const resolveFunction = window[`resolveManualTest_${testId}`];
            if (resolveFunction) {
                resolveFunction(resultData);
                delete window[`resolveManualTest_${testId}`];
            }
            
            // Dispatch completion event
            document.dispatchEvent(new CustomEvent('manualTestCompleted', {
                detail: resultData
            }));
            
            console.log('✨ Manual test completed successfully:', resultData);
            
        } catch (error) {
            console.error('❌ Error completing manual test:', error);
        }
    }

    /**
     * Handle manual test completion
     */
    handleManualTestCompletion(resultData) {
        // Store result for later use
        if (!this.manualTestResults) {
            this.manualTestResults = {};
        }
        this.manualTestResults[resultData.testId] = resultData;
        
        // Update progress display if visible
        this.updateManualTestProgress(resultData);
    }

    /**
     * Update progress display for manual tests
     */
    updateManualTestProgress(resultData) {
        // This will be called to update any progress indicators
        // Implementation depends on how progress is displayed
        console.log('📊 Manual test progress updated:', resultData);
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
            // Status update removed - no menu manager
            
            // Get configuration
            const options = this.getBenchmarkConfiguration();
            
            console.log('🧪 Starting benchmark in main window:', options);
            
            // Run benchmark
            const results = await this.framework.runAllBenchmarks(options);
            
            this.currentResults = results;
            this.displayMainWindowResults(results);
            
            // Status update removed - no menu manager
            
        } catch (error) {
            console.error('❌ Benchmark failed:', error);
            // Status update removed - no menu manager
            alert('Benchmark failed: ' + error.message);
        } finally {
            this.isRunning = false;
            document.getElementById('startBenchmark').disabled = false;
            document.getElementById('stopBenchmark').disabled = true;
            document.getElementById('exportResults').disabled = false;
            
            // Enable LLM interaction export button
            const exportLLMBtn = document.getElementById('exportLLMInteractions');
            if (exportLLMBtn) {
                exportLLMBtn.disabled = false;
            }
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
        
        // Status update removed - no menu manager
        
        console.log('⏹️ Benchmark stopped in main window');
    }

    /**
     * Safe JSON serialization that handles circular references
     */
    safeJSONStringify(obj, maxDepth = 10) {
        const seen = new WeakSet();
        const depthMap = new WeakMap();
        
        return JSON.stringify(obj, (key, value) => {
            // Handle basic types
            if (value === null || typeof value !== 'object') {
                return value;
            }
            
            // Check depth to prevent infinite recursion
            const currentDepth = depthMap.get(value) || 0;
            if (currentDepth > maxDepth) {
                return '[Max Depth Reached]';
            }
            
            // Handle circular references
            if (seen.has(value)) {
                return '[Circular Reference]';
            }
            
            seen.add(value);
            depthMap.set(value, currentDepth + 1);
            
            // Filter out problematic properties
            if (value && typeof value === 'object') {
                const filtered = {};
                for (const [k, v] of Object.entries(value)) {
                    // Skip known problematic properties
                    if (k === 'genomeBrowser' || k === 'fileManager' || k === 'chatManager' || 
                        k === 'configManager' || k === 'framework' || k === 'window' || 
                        k === 'document' || k === 'parent' || k === 'constructor') {
                        filtered[k] = '[Filtered: Circular Reference]';
                    } else if (typeof v === 'function') {
                        filtered[k] = '[Function]';
                    } else if (v instanceof Promise) {
                        filtered[k] = '[Promise]';
                    } else if (v instanceof HTMLElement) {
                        filtered[k] = '[DOM Element]';
                    } else {
                        filtered[k] = v;
                    }
                }
                return filtered;
            }
            
            return value;
        }, 2);
    }

    /**
     * Export results from main window
     */
    exportMainWindowResults() {
        if (!this.currentResults) {
            alert('No results to export');
            return;
        }
        
        try {
            const safeJSON = this.safeJSONStringify(this.currentResults);
            const blob = new Blob([safeJSON], {type: 'application/json'});
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'benchmark-results-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.json';
            a.click();
            URL.revokeObjectURL(url);
            
            console.log('📤 Results exported from main window');
        } catch (error) {
            console.error('Failed to export results:', error);
            alert('Failed to export results: ' + error.message);
        }
    }

    /**
     * Export detailed LLM interaction data
     */
    exportDetailedLLMInteractions() {
        if (!this.currentResults) {
            alert('No benchmark results available to export');
            return;
        }

        try {
            // Extract all LLM interaction data
            const detailedInteractions = this.extractAllLLMInteractionData(this.currentResults);
            
            // Create comprehensive export data
            const exportData = {
                metadata: {
                    exportTimestamp: new Date().toISOString(),
                    benchmarkTimestamp: this.currentResults.startTime,
                    totalTests: this.currentResults.overallStats?.totalTests || 0,
                    totalInteractions: detailedInteractions.length,
                    exportType: 'detailed_llm_interactions',
                    version: '1.0.0'
                },
                
                // Summary statistics
                summary: {
                    totalInteractions: detailedInteractions.length,
                    successfulInteractions: detailedInteractions.filter(i => !i.analysis?.isError).length,
                    failedInteractions: detailedInteractions.filter(i => i.analysis?.isError).length,
                    averageResponseTime: this.calculateAverageResponseTime(detailedInteractions),
                    totalConsoleLogs: detailedInteractions.reduce((sum, i) => sum + (i.detailedLogs?.totalLogs || 0), 0)
                },
                
                // Complete interaction data
                interactions: detailedInteractions,
                
                // Benchmark results for context
                benchmarkResults: this.currentResults
            };

            // Create and download JSON file
            const jsonString = this.safeJSONStringify(exportData);
            const blob = new Blob([jsonString], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'llm-interactions-detailed-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.json';
            a.click();
            URL.revokeObjectURL(url);
            
            console.log('📤 Detailed LLM interactions exported');
            
            // Also offer HTML report export
            this.exportDetailedHTMLReport(exportData);
            
        } catch (error) {
            console.error('Failed to export detailed interactions:', error);
            alert('Failed to export detailed interactions: ' + error.message);
        }
    }

    /**
     * Extract all LLM interaction data from benchmark results
     * Enhanced to extract data from multiple sources including incomplete/timeout scenarios
     */
    extractAllLLMInteractionData(results) {
        const interactions = [];
        
        if (results.testSuiteResults) {
            results.testSuiteResults.forEach(suite => {
                if (suite.testResults) {
                    suite.testResults.forEach(test => {
                        // Primary source: dedicated llmInteractionData field
                        if (test.llmInteractionData) {
                            interactions.push({
                                ...test.llmInteractionData,
                                testInfo: {
                                    testId: test.testId,
                                    testName: test.testName,
                                    suiteId: test.suiteId,
                                    score: test.score,
                                    success: test.success,
                                    duration: test.duration,
                                    status: test.status
                                }
                            });
                        } else {
                            // Fallback: construct interaction data from available test fields
                            const reconstructedInteraction = this.reconstructLLMInteractionFromTest(test);
                            if (reconstructedInteraction) {
                                interactions.push(reconstructedInteraction);
                            }
                        }
                    });
                }
            });
        }
        
        return interactions;
    }

    /**
     * Reconstruct LLM interaction data from test result fields
     * Used when dedicated llmInteractionData is not available
     */
    reconstructLLMInteractionFromTest(test) {
        // Skip if no meaningful data is available
        if (!test.llmResponse && !test.actualResult && !test.errors?.length && !test.metrics) {
            return null;
        }

        const interaction = {
            // Reconstruct request information
            request: {
                prompt: test.details?.instruction || `Test: ${test.testName}`,
                timestamp: new Date(test.startTime || Date.now()).toISOString(),
                requestId: `reconstructed_${test.testId}_${Date.now()}`,
                testContext: {
                    expectedResult: test.expectedResult,
                    maxScore: test.maxScore,
                    testType: test.type || 'unknown'
                }
            },

            // Reconstruct response information
            response: {
                content: test.llmResponse || null,
                responseTime: test.metrics?.responseTime || test.duration || 0,
                timestamp: new Date(test.endTime || Date.now()).toISOString(),
                responseId: `reconstructed_resp_${test.testId}_${Date.now()}`,
                
                // Extract function calls if available
                toolCalls: this.extractToolCallsFromResult(test.actualResult),
                
                // Response metadata
                tokenCount: test.metrics?.tokenCount || 0,
                responseLength: test.metrics?.responseLength || 0,
                functionCallsCount: test.metrics?.functionCallsCount || 0
            },

            // Reconstruct analysis information
            analysis: {
                correctToolUsed: test.success && test.actualResult?.tool_name,
                parametersCorrect: test.success,
                taskCompleted: test.success,
                isError: test.status === 'error' || test.errors?.length > 0,
                errorDetails: test.errors?.join('; ') || null,
                confidence: test.metrics?.confidence || null,
                score: test.score || 0,
                maxScore: test.maxScore || 100,
                successRate: test.success ? 100 : 0
            },

            // Reconstruct detailed logs
            detailedLogs: {
                totalLogs: (test.errors?.length || 0) + (test.warnings?.length || 0) + 1,
                consoleLogs: [
                    `Test ${test.testId} (${test.testName}) executed`,
                    ...(test.errors || []).map(error => `ERROR: ${error}`),
                    ...(test.warnings || []).map(warning => `WARNING: ${warning}`),
                    `Result: ${test.status} (score: ${test.score}/${test.maxScore})`
                ],
                errorLogs: test.errors || [],
                warningLogs: test.warnings || [],
                performanceLogs: test.metrics ? [
                    `Response time: ${test.metrics.responseTime || test.duration}ms`,
                    `Token count: ${test.metrics.tokenCount || 'unknown'}`,
                    `Function calls: ${test.metrics.functionCallsCount || 0}`
                ] : []
            },

            // Test context information
            testInfo: {
                testId: test.testId,
                testName: test.testName,
                suiteId: test.suiteId,
                score: test.score,
                success: test.success,
                duration: test.duration,
                status: test.status,
                
                // Additional context
                startTime: test.startTime,
                endTime: test.endTime,
                expectedResult: test.expectedResult,
                actualResult: test.actualResult
            }
        };

        return interaction;
    }

    /**
     * Extract tool calls from actualResult
     */
    extractToolCallsFromResult(actualResult) {
        if (!actualResult) return [];

        const toolCalls = [];

        // Handle direct tool call format
        if (actualResult.tool_name) {
            toolCalls.push({
                tool: actualResult.tool_name,
                parameters: actualResult.parameters || {},
                result: actualResult.result || 'executed'
            });
        }

        // Handle array of function calls
        if (Array.isArray(actualResult)) {
            actualResult.forEach(call => {
                if (call.tool_name) {
                    toolCalls.push({
                        tool: call.tool_name,
                        parameters: call.parameters || {},
                        result: call.result || 'executed'
                    });
                }
            });
        }

        // Handle functionCalls array
        if (actualResult.functionCalls && Array.isArray(actualResult.functionCalls)) {
            actualResult.functionCalls.forEach(call => {
                if (call.tool_name || call.name) {
                    toolCalls.push({
                        tool: call.tool_name || call.name,
                        parameters: call.parameters || call.args || {},
                        result: call.result || 'executed'
                    });
                }
            });
        }

        return toolCalls;
    }

    /**
     * Calculate average response time from interactions
     */
    calculateAverageResponseTime(interactions) {
        const responseTimes = interactions
            .map(i => i.response?.responseTime)
            .filter(time => time && time > 0);
        
        if (responseTimes.length === 0) return 0;
        
        return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
    }

    /**
     * Export detailed HTML report with LLM interactions
     */
    exportDetailedHTMLReport(exportData) {
        try {
            const htmlContent = this.generateDetailedHTMLReport(exportData);
            
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'llm-interactions-report-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.html';
            a.click();
            URL.revokeObjectURL(url);
            
            console.log('📤 Detailed HTML report exported');
            
        } catch (error) {
            console.error('Failed to export HTML report:', error);
        }
    }

    /**
     * Generate detailed HTML report with complete LLM interaction data
     */
    generateDetailedHTMLReport(exportData) {
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Detailed LLM Interaction Report</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 30px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        h1 { color: #2c3e50; text-align: center; border-bottom: 3px solid #3498db; padding-bottom: 15px; }
        h2 { color: #34495e; border-bottom: 1px solid #bdc3c7; padding-bottom: 8px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 20px 0; }
        .summary-card { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; }
        .summary-card h3 { margin: 0 0 10px 0; font-size: 14px; }
        .summary-card .value { font-size: 24px; font-weight: bold; }
        .interaction { border: 1px solid #ddd; border-radius: 8px; margin: 20px 0; overflow: hidden; }
        .interaction-header { background: #34495e; color: white; padding: 15px; }
        .interaction-content { padding: 20px; }
        .section { margin-bottom: 20px; padding: 15px; border-radius: 6px; }
        .request-section { background: #e3f2fd; border-left: 4px solid #2196f3; }
        .response-section { background: #e8f5e8; border-left: 4px solid #4caf50; }
        .thinking-section { background: #f3e5f5; border-left: 4px solid #9c27b0; }
        .debug-section { background: #fff3e0; border-left: 4px solid #ff9800; }
        .error-section { background: #ffebee; border-left: 4px solid #f44336; }
        pre { background: #f8f9fa; padding: 12px; border-radius: 4px; overflow-x: auto; font-size: 12px; border: 1px solid #dee2e6; }
        .metric { display: inline-block; margin: 5px 10px; padding: 5px 10px; background: #ecf0f1; border-radius: 4px; font-size: 12px; }
        details { margin: 10px 0; }
        summary { cursor: pointer; font-weight: bold; padding: 8px; background: #f8f9fa; border-radius: 4px; }
        .log-entry { background: #2c3e50; color: #ecf0f1; padding: 8px; margin: 4px 0; border-radius: 4px; font-family: monospace; font-size: 11px; }
    </style>
</head>
<body>
    <div class="container">
        <h1>🤖 Detailed LLM Interaction Report</h1>
        <p><strong>Generated:</strong> ${exportData.metadata.exportTimestamp}</p>
        <p><strong>Benchmark Date:</strong> ${new Date(exportData.metadata.benchmarkTimestamp).toLocaleString()}</p>
        
        <div class="summary">
            <div class="summary-card">
                <h3>Total Interactions</h3>
                <div class="value">${exportData.summary.totalInteractions}</div>
            </div>
            <div class="summary-card">
                <h3>Successful</h3>
                <div class="value">${exportData.summary.successfulInteractions}</div>
            </div>
            <div class="summary-card">
                <h3>Failed</h3>
                <div class="value">${exportData.summary.failedInteractions}</div>
            </div>
            <div class="summary-card">
                <h3>Avg Response Time</h3>
                <div class="value">${Math.round(exportData.summary.averageResponseTime)}ms</div>
            </div>
            <div class="summary-card">
                <h3>Console Logs</h3>
                <div class="value">${exportData.summary.totalConsoleLogs}</div>
            </div>
        </div>
        
        <h2>📋 Detailed Interactions</h2>
        
        ${exportData.interactions.map(interaction => `
            <div class="interaction">
                <div class="interaction-header">
                    <h3 style="margin: 0;">🧪 ${interaction.testInfo?.testName || interaction.testName}</h3>
                    <div style="font-size: 12px; opacity: 0.9;">
                        Test ID: ${interaction.testInfo?.testId || interaction.testId} | 
                        Request ID: ${interaction.request?.requestId || 'N/A'} | 
                        Score: ${interaction.testInfo?.score || 'N/A'}/${interaction.testInfo?.maxScore || 100}
                    </div>
                </div>
                
                <div class="interaction-content">
                    <!-- Request Section -->
                    <div class="section request-section">
                        <h4>📤 Request Information</h4>
                        <div class="metric">Provider: ${interaction.request?.provider || 'N/A'}</div>
                        <div class="metric">Model: ${interaction.request?.model || 'N/A'}</div>
                        <div class="metric">Temperature: ${interaction.request?.temperature || 'N/A'}</div>
                        <div class="metric">Max Tokens: ${interaction.request?.maxTokens || 'N/A'}</div>
                        <div class="metric">Timeout: ${interaction.request?.timeout ? (interaction.request.timeout/1000) + 's' : 'N/A'}</div>
                        
                        <details>
                            <summary>📝 Full Prompt</summary>
                            <pre>${interaction.request?.fullPrompt || interaction.request?.instruction || 'Not available'}</pre>
                        </details>
                    </div>
                    
                    <!-- Response Section -->
                    <div class="section response-section">
                        <h4>📥 Response Information</h4>
                        <div class="metric">Response Time: ${interaction.response?.responseTime || 0}ms</div>
                        <div class="metric">Length: ${interaction.response?.rawResponse?.length || 0} chars</div>
                        <div class="metric">Function Calls: ${interaction.response?.functionCalls?.length || 0}</div>
                        <div class="metric">Tokens: ${interaction.response?.tokenUsage?.totalTokens || 0}</div>
                        
                        <details>
                            <summary>🗨️ Raw Response</summary>
                            <pre>${interaction.response?.rawResponse || 'Not available'}</pre>
                        </details>
                    </div>
                    
                    <!-- Thinking Process -->
                    ${interaction.detailedLogs?.thinkingProcess?.thinkingContent ? `
                    <div class="section thinking-section">
                        <h4>🧠 LLM Thinking Process</h4>
                        <pre>${interaction.detailedLogs.thinkingProcess.thinkingContent}</pre>
                    </div>
                    ` : ''}
                    
                    <!-- Debug Information -->
                    ${interaction.detailedLogs?.llmRawResponse?.sectionFound ? `
                    <div class="section debug-section">
                        <h4>🔍 Debug Information</h4>
                        <div class="metric">Response Type: ${interaction.detailedLogs.llmRawResponse.responseType || 'N/A'}</div>
                        <div class="metric">Original Length: ${interaction.detailedLogs.llmRawResponse.responseLength || 'N/A'}</div>
                        <div class="metric">Trimmed Length: ${interaction.detailedLogs.llmRawResponse.trimmedLength || 'N/A'}</div>
                        
                        ${interaction.detailedLogs.llmRawResponse.hexDump ? `
                        <details>
                            <summary>🔢 Hex Dump</summary>
                            <pre>${interaction.detailedLogs.llmRawResponse.hexDump}</pre>
                        </details>
                        ` : ''}
                    </div>
                    ` : ''}
                    
                    <!-- Error Information -->
                    ${interaction.analysis?.isError ? `
                    <div class="section error-section">
                        <h4>❌ Error Information</h4>
                        <div class="metric">Error Type: ${interaction.analysis.errorType || 'Unknown'}</div>
                        <div class="metric">Error Message: ${interaction.analysis.errorMessage || 'No details'}</div>
                    </div>
                    ` : ''}
                    
                    <!-- Complete Console Logs -->
                    ${interaction.detailedLogs?.logs ? `
                    <details>
                        <summary>📜 Complete Console Logs (${interaction.detailedLogs.totalLogs} entries)</summary>
                        <div style="max-height: 400px; overflow-y: auto;">
                            ${interaction.detailedLogs.logs.map(log => `
                                <div class="log-entry">
                                    <div style="font-size: 10px; color: #bdc3c7;">[${log.timestamp}]</div>
                                    <pre style="margin: 2px 0; color: #ecf0f1;">${log.message}</pre>
                                </div>
                            `).join('')}
                        </div>
                    </details>
                    ` : ''}
                </div>
            </div>
        `).join('')}
        
        <div style="margin-top: 40px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
            <h3>📊 Export Information</h3>
            <p><strong>Export Timestamp:</strong> ${exportData.metadata.exportTimestamp}</p>
            <p><strong>Total Interactions:</strong> ${exportData.summary.totalInteractions}</p>
            <p><strong>Total Console Logs:</strong> ${exportData.summary.totalConsoleLogs}</p>
            <p><strong>Average Response Time:</strong> ${Math.round(exportData.summary.averageResponseTime)}ms</p>
        </div>
    </div>
</body>
</html>
        `;
    }

    /**
     * Export detailed HTML report
     */
    exportDetailedHTMLReport(exportData) {
        try {
            const htmlContent = this.generateDetailedHTMLReport(exportData);
            
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            
            const a = document.createElement('a');
            a.href = url;
            a.download = 'llm-interactions-report-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-') + '.html';
            a.click();
            URL.revokeObjectURL(url);
            
            console.log('📤 Detailed HTML report exported');
            
        } catch (error) {
            console.error('Failed to export HTML report:', error);
        }
    }

    /**
     * Generate detailed LLM interaction display for test results
     */
    generateLLMInteractionDisplay(testResult) {
        if (!testResult.llmInteractionData) {
            return '<div class="llm-interaction-missing">❌ No LLM interaction data available</div>';
        }

        const interaction = testResult.llmInteractionData;
        const requestData = interaction.request || {};
        const responseData = interaction.response || {};
        const analysisData = interaction.analysis || {};

        return `
            <div class="llm-interaction-details" style="border: 1px solid #ddd; border-radius: 8px; margin: 10px 0; background: #f9f9f9;">
                <div class="interaction-header" style="background: #34495e; color: white; padding: 10px; border-radius: 8px 8px 0 0;">
                    <h4 style="margin: 0; font-size: 14px;">🤖 LLM Interaction Details</h4>
                    <div style="font-size: 11px; opacity: 0.8;">
                        Request ID: ${requestData.requestId || 'N/A'} | 
                        Timestamp: ${interaction.timestamp || 'N/A'}
                    </div>
                </div>
                
                <div class="interaction-content" style="padding: 15px;">
                    <!-- Request Information -->
                    <div class="request-section" style="margin-bottom: 20px;">
                        <h5 style="color: #2c3e50; margin-bottom: 10px; border-bottom: 1px solid #bdc3c7; padding-bottom: 5px;">
                            📤 Request Information
                        </h5>
                        <div class="request-details" style="background: white; padding: 10px; border-radius: 4px; border-left: 4px solid #3498db;">
                            <div style="margin-bottom: 8px;">
                                <strong>Provider:</strong> ${requestData.provider || 'Not specified'} |
                                <strong>Model:</strong> ${requestData.model || 'Not specified'} |
                                <strong>Timeout:</strong> ${requestData.timeout ? (requestData.timeout/1000) + 's' : 'N/A'}
                            </div>
                            <div style="margin-bottom: 8px;">
                                <strong>Temperature:</strong> ${requestData.temperature || 'N/A'} |
                                <strong>Max Tokens:</strong> ${requestData.maxTokens || 'N/A'} |
                                <strong>Context Length:</strong> ${requestData.contextLength || 0}
                            </div>
                            <div style="margin-bottom: 10px;">
                                <strong>Available Tools:</strong> ${requestData.availableTools ? requestData.availableTools.join(', ') : 'None'}
                            </div>
                            <details style="margin-top: 10px;">
                                <summary style="cursor: pointer; font-weight: bold; color: #2980b9;">📝 Full Prompt (Click to expand)</summary>
                                <pre style="background: #ecf0f1; padding: 10px; border-radius: 4px; font-size: 11px; overflow-x: auto; margin-top: 8px; white-space: pre-wrap;">${requestData.fullPrompt || requestData.instruction || 'Not available'}</pre>
                            </details>
                            <details style="margin-top: 10px;">
                                <summary style="cursor: pointer; font-weight: bold; color: #8e44ad;">🔧 System Prompt (Click to expand)</summary>
                                <pre style="background: #ecf0f1; padding: 10px; border-radius: 4px; font-size: 11px; overflow-x: auto; margin-top: 8px; white-space: pre-wrap;">${requestData.systemPrompt || 'Not available'}</pre>
                            </details>
                        </div>
                    </div>
                    
                    <!-- Response Information -->
                    <div class="response-section" style="margin-bottom: 20px;">
                        <h5 style="color: #2c3e50; margin-bottom: 10px; border-bottom: 1px solid #bdc3c7; padding-bottom: 5px;">
                            📥 Response Information
                        </h5>
                        <div class="response-details" style="background: white; padding: 10px; border-radius: 4px; border-left: 4px solid #27ae60;">
                            <div style="margin-bottom: 8px;">
                                <strong>Response Time:</strong> ${responseData.responseTime || 0}ms |
                                <strong>Response Length:</strong> ${responseData.rawResponse ? responseData.rawResponse.length : 0} chars |
                                <strong>Function Calls:</strong> ${responseData.functionCalls ? responseData.functionCalls.length : 0}
                            </div>
                            <div style="margin-bottom: 8px;">
                                <strong>Token Usage:</strong> 
                                Prompt: ${responseData.tokenUsage?.promptTokens || 0}, 
                                Completion: ${responseData.tokenUsage?.completionTokens || 0}, 
                                Total: ${responseData.tokenUsage?.totalTokens || 0}
                            </div>
                            <details style="margin-top: 10px;">
                                <summary style="cursor: pointer; font-weight: bold; color: #27ae60;">🗨️ Raw Response (Click to expand)</summary>
                                <pre style="background: #ecf0f1; padding: 10px; border-radius: 4px; font-size: 11px; overflow-x: auto; margin-top: 8px; white-space: pre-wrap;">${responseData.rawResponse || 'Not available'}</pre>
                            </details>
                            ${responseData.processedResponse && responseData.processedResponse !== responseData.rawResponse ? `
                            <details style="margin-top: 10px;">
                                <summary style="cursor: pointer; font-weight: bold; color: #f39c12;">⚙️ Processed Response (Click to expand)</summary>
                                <pre style="background: #ecf0f1; padding: 10px; border-radius: 4px; font-size: 11px; overflow-x: auto; margin-top: 8px; white-space: pre-wrap;">${responseData.processedResponse}</pre>
                            </details>
                            ` : ''}
                            
                            <!-- ENHANCED: Add detailed debug information from Console logs -->
                            ${interaction.detailedLogs ? this.generateDetailedLogsDisplay(interaction.detailedLogs) : ''}
                        </div>
                    </div>
                    
                    <!-- Analysis Information -->
                    <div class="analysis-section">
                        <h5 style="color: #2c3e50; margin-bottom: 10px; border-bottom: 1px solid #bdc3c7; padding-bottom: 5px;">
                            🔍 Quality Analysis
                        </h5>
                        <div class="analysis-details" style="background: white; padding: 10px; border-radius: 4px; border-left: 4px solid ${analysisData.isError ? '#e74c3c' : '#9b59b6'};">
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 10px; margin-bottom: 10px;">
                                <div style="text-align: center; padding: 8px; background: #ecf0f1; border-radius: 4px;">
                                    <div style="font-size: 16px; font-weight: bold; color: ${BenchmarkUI.getConfidenceColor(analysisData.confidence)};">
                                        ${(analysisData.confidence !== null && analysisData.confidence !== undefined) ? analysisData.confidence.toFixed(1) : 'N/A'}
                                    </div>
                                    <div style="font-size: 11px; color: #7f8c8d;">Confidence</div>
                                </div>
                                <div style="text-align: center; padding: 8px; background: #ecf0f1; border-radius: 4px;">
                                    <div style="font-size: 16px; font-weight: bold; color: ${BenchmarkUI.getComplexityColor(analysisData.complexity)};">
                                        ${(analysisData.complexity !== null && analysisData.complexity !== undefined) ? analysisData.complexity.toFixed(1) : 'N/A'}
                                    </div>
                                    <div style="font-size: 11px; color: #7f8c8d;">Complexity</div>
                                </div>
                                <div style="text-align: center; padding: 8px; background: #ecf0f1; border-radius: 4px;">
                                    <div style="font-size: 16px; font-weight: bold; color: ${BenchmarkUI.getAmbiguityColor(analysisData.ambiguity)};">
                                        ${(analysisData.ambiguity !== null && analysisData.ambiguity !== undefined) ? analysisData.ambiguity.toFixed(1) : 'N/A'}
                                    </div>
                                    <div style="font-size: 11px; color: #7f8c8d;">Ambiguity</div>
                                </div>
                                <div style="text-align: center; padding: 8px; background: #ecf0f1; border-radius: 4px;">
                                    <div style="font-size: 16px; font-weight: bold; color: ${BenchmarkUI.getRelevanceColor(analysisData.contextRelevance)};">
                                        ${(analysisData.contextRelevance !== null && analysisData.contextRelevance !== undefined) ? analysisData.contextRelevance.toFixed(1) : 'N/A'}
                                    </div>
                                    <div style="font-size: 11px; color: #7f8c8d;">Relevance</div>
                                </div>
                            </div>
                            ${analysisData.isError ? `
                            <div style="background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 8px; margin-top: 8px;">
                                <strong style="color: #721c24;">❌ Error Detected:</strong> 
                                <span style="color: #721c24;">${analysisData.errorType || 'Unknown'} - ${analysisData.errorMessage || 'No details'}</span>
                            </div>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Generate detailed logs display from captured Console output
     */
    generateDetailedLogsDisplay(detailedLogs) {
        if (!detailedLogs || !detailedLogs.logs) {
            return '';
        }

        return `
            <div style="margin-top: 15px; border-top: 1px solid #ddd; padding-top: 15px;">
                <h6 style="color: #2c3e50; margin-bottom: 10px;">🔍 Detailed Console Logs (${detailedLogs.totalLogs} entries)</h6>
                
                <!-- Thinking Process -->
                ${detailedLogs.thinkingProcess?.thinkingContent ? `
                <details style="margin-bottom: 10px;">
                    <summary style="cursor: pointer; font-weight: bold; color: #9b59b6;">🧠 LLM Thinking Process (Click to expand)</summary>
                    <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 12px; margin-top: 8px;">
                        <pre style="background: #fff; padding: 10px; border-radius: 4px; font-size: 11px; white-space: pre-wrap; border: 1px solid #e9ecef;">${detailedLogs.thinkingProcess.thinkingContent}</pre>
                    </div>
                </details>
                ` : ''}
                
                <!-- Raw Response Debug Info -->
                ${detailedLogs.llmRawResponse?.sectionFound ? `
                <details style="margin-bottom: 10px;">
                    <summary style="cursor: pointer; font-weight: bold; color: #17a2b8;">📊 Raw Response Debug Info (Click to expand)</summary>
                    <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 12px; margin-top: 8px;">
                        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 10px; margin-bottom: 10px;">
                            <div><strong>Type:</strong> ${detailedLogs.llmRawResponse.responseType || 'N/A'}</div>
                            <div><strong>Length:</strong> ${detailedLogs.llmRawResponse.responseLength || 'N/A'}</div>
                            <div><strong>Empty:</strong> ${detailedLogs.llmRawResponse.isEmpty || 'N/A'}</div>
                            <div><strong>Undefined:</strong> ${detailedLogs.llmRawResponse.isUndefined || 'N/A'}</div>
                        </div>
                        ${detailedLogs.llmRawResponse.firstChars ? `
                        <div style="margin-bottom: 8px;">
                            <strong>First 100 chars:</strong>
                            <pre style="background: #fff; padding: 8px; border-radius: 4px; font-size: 10px; border: 1px solid #e9ecef;">${detailedLogs.llmRawResponse.firstChars}</pre>
                        </div>
                        ` : ''}
                        ${detailedLogs.llmRawResponse.hexDump ? `
                        <div style="margin-bottom: 8px;">
                            <strong>Hex Dump (first 50 chars):</strong>
                            <pre style="background: #fff; padding: 8px; border-radius: 4px; font-size: 10px; font-family: monospace; border: 1px solid #e9ecef;">${detailedLogs.llmRawResponse.hexDump}</pre>
                        </div>
                        ` : ''}
                    </div>
                </details>
                ` : ''}
                
                <!-- Tool Call History -->
                ${detailedLogs.toolCallHistory?.toolCallRounds.length > 0 ? `
                <details style="margin-bottom: 10px;">
                    <summary style="cursor: pointer; font-weight: bold; color: #28a745;">🔧 Function Call Rounds (Click to expand)</summary>
                    <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 12px; margin-top: 8px;">
                        ${detailedLogs.toolCallHistory.toolCallRounds.map(round => `
                            <div style="background: #fff; padding: 8px; margin: 5px 0; border-radius: 4px; border-left: 3px solid #28a745;">
                                <strong>Round ${round.current}/${round.total}</strong> - ${round.timestamp}
                            </div>
                        `).join('')}
                        
                        ${detailedLogs.toolCallHistory.skippedTools.length > 0 ? `
                        <div style="margin-top: 10px;">
                            <strong>Skipped Tools:</strong> ${detailedLogs.toolCallHistory.skippedTools.join(', ')}
                        </div>
                        ` : ''}
                    </div>
                </details>
                ` : ''}
                
                <!-- Conversation History Debug -->
                ${detailedLogs.conversationHistory?.historyEntries.length > 0 ? `
                <details style="margin-bottom: 10px;">
                    <summary style="cursor: pointer; font-weight: bold; color: #6f42c1;">💬 Conversation History Debug (Click to expand)</summary>
                    <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 12px; margin-top: 8px;">
                        <div style="margin-bottom: 10px;"><strong>Total History Length:</strong> ${detailedLogs.conversationHistory.historyLength || 'N/A'}</div>
                        ${detailedLogs.conversationHistory.historyEntries.map((entry, index) => `
                            <div style="background: #fff; padding: 8px; margin: 5px 0; border-radius: 4px; border-left: 3px solid ${entry.role === 'user' ? '#007bff' : entry.role === 'assistant' ? '#28a745' : '#6c757d'};">
                                <strong>History[${entry.index}]</strong> - Role: ${entry.role}, Length: ${entry.contentLength} chars
                                ${detailedLogs.conversationHistory.contentPreviews[index] ? `
                                <div style="font-size: 10px; color: #6c757d; margin-top: 4px; font-style: italic;">
                                    Preview: ${detailedLogs.conversationHistory.contentPreviews[index]}
                                </div>
                                ` : ''}
                            </div>
                        `).join('')}
                    </div>
                </details>
                ` : ''}
                
                <!-- Parse Debug Information -->
                ${detailedLogs.parseDebugInfo?.parseSteps.length > 0 ? `
                <details style="margin-bottom: 10px;">
                    <summary style="cursor: pointer; font-weight: bold; color: #dc3545;">🔍 Response Parse Debug (Click to expand)</summary>
                    <div style="background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 4px; padding: 12px; margin-top: 8px;">
                        ${detailedLogs.parseDebugInfo.parseSteps.map(step => `
                            <div style="background: #fff; padding: 6px; margin: 3px 0; border-radius: 3px; font-size: 10px; font-family: monospace;">
                                ${step}
                            </div>
                        `).join('')}
                    </div>
                </details>
                ` : ''}
                
                <!-- Complete Console Log Dump -->
                <details style="margin-bottom: 10px;">
                    <summary style="cursor: pointer; font-weight: bold; color: #fd7e14;">📜 Complete Console Log Dump (Click to expand)</summary>
                    <div style="background: #2c3e50; color: #ecf0f1; border-radius: 4px; padding: 12px; margin-top: 8px; max-height: 400px; overflow-y: auto;">
                        ${detailedLogs.logs.map(log => `
                            <div style="margin-bottom: 8px; padding: 6px; background: rgba(255,255,255,0.1); border-radius: 3px;">
                                <div style="font-size: 10px; color: #bdc3c7;">[${log.timestamp}]</div>
                                <pre style="margin: 4px 0; font-size: 11px; white-space: pre-wrap;">${log.message}</pre>
                            </div>
                        `).join('')}
                    </div>
                </details>
            </div>
        `;
    }

    /**
     * Get color for confidence score (5-point scale)
     */
    static getConfidenceColor(confidence) {
        if (confidence === null || confidence === undefined) return '#95a5a6';
        if (confidence >= 4.0) return '#27ae60'; // High confidence (4.0-5.0)
        if (confidence >= 3.0) return '#f39c12'; // Medium confidence (3.0-3.9)
        return '#e74c3c'; // Low confidence (0-2.9)
    }

    /**
     * Get color for complexity score (5-point scale)
     */
    static getComplexityColor(complexity) {
        if (complexity === null || complexity === undefined) return '#95a5a6';
        if (complexity >= 7.0) return '#e74c3c'; // High complexity (7.0-10.0)
        if (complexity >= 4.0) return '#f39c12'; // Medium complexity (4.0-6.9)
        return '#27ae60'; // Low complexity (0-3.9)
    }

    /**
     * Get color for ambiguity score (5-point scale)
     */
    static getAmbiguityColor(ambiguity) {
        if (ambiguity === null || ambiguity === undefined) return '#95a5a6';
        if (ambiguity >= 2.5) return '#e74c3c'; // High ambiguity (2.5-5.0)
        if (ambiguity >= 1.25) return '#f39c12'; // Medium ambiguity (1.25-2.4)
        return '#27ae60'; // Low ambiguity (0-1.24)
    }

    /**
     * Get color for relevance score (5-point scale)
     */
    static getRelevanceColor(relevance) {
        if (relevance === null || relevance === undefined) return '#95a5a6';
        if (relevance >= 4.0) return '#27ae60'; // High relevance (4.0-5.0)
        if (relevance >= 3.0) return '#f39c12'; // Medium relevance (3.0-3.9)
        return '#e74c3c'; // Low relevance (0-2.9)
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
            includeLLMInteractions: document.getElementById('includeLLMInteractions')?.checked !== false, // Default to true
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
        // Status update removed - no menu manager
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
     * Display results in main window with enhanced LLM interaction details
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
                                    
                                    <!-- CRITICAL ENHANCEMENT: Add detailed LLM interaction display -->
                                    ${this.generateLLMInteractionDisplay(test)}
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

            console.log('✅ Benchmark mode exited');
            
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
                <div class="dropdown-item" onclick="benchmarkApp.exportResults()">📤 Export Detailed Results</div>
                <div class="dropdown-item" onclick="benchmarkApp.exportBasicResults()">📄 Export Basic Results</div>
                <div class="dropdown-item" onclick="benchmarkApp.exportDetailedLLMInteractions()">🤖 Export LLM Interactions Only</div>
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
                                <input type="checkbox" id="includeLLMInteractions" checked> Include LLM Interactions
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
                                <option value="120000">2 minutes</option>
                                <option value="180000">3 minutes</option>
                                <option value="240000">4 minutes</option>
                                <option value="300000">5 minutes</option>
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
                        📊 Export Detailed Results
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
                
                try {
                    this.downloadJSON(this.currentResults, 'benchmark-results');
                } catch (error) {
                    console.error('Failed to save benchmark:', error);
                    alert('Failed to save benchmark: ' + error.message);
                }
            }

            exportResults() {
                if (!this.currentResults) {
                    alert('No results to export');
                    return;
                }
                
                try {
                    // Export detailed LLM interaction data
                    const detailedInteractions = this.extractAllLLMInteractionData(this.currentResults);
                    
                    // Clean the benchmark results to avoid circular references
                    const cleanBenchmarkResults = this.cleanDataForExport(this.currentResults);
                    
                    // Create comprehensive export data
                    const exportData = {
                        metadata: {
                            exportTimestamp: new Date().toISOString(),
                            benchmarkTimestamp: this.currentResults.startTime,
                            totalTests: this.currentResults.overallStats?.totalTests || 0,
                            totalInteractions: detailedInteractions.length,
                            exportType: 'detailed_benchmark_results_with_llm_interactions',
                            version: '1.0.0'
                        },
                        
                        // Summary statistics
                        summary: {
                            totalInteractions: detailedInteractions.length,
                            successfulInteractions: detailedInteractions.filter(i => !i.analysis?.isError).length,
                            failedInteractions: detailedInteractions.filter(i => i.analysis?.isError).length,
                            averageResponseTime: this.calculateAverageResponseTime(detailedInteractions),
                            totalConsoleLogs: detailedInteractions.reduce((sum, i) => sum + (i.detailedLogs?.totalLogs || 0), 0)
                        },
                        
                        // Complete interaction data (cleaned)
                        llmInteractions: this.cleanDataForExport(detailedInteractions),
                        
                        // Complete benchmark results for context (cleaned)
                        benchmarkResults: cleanBenchmarkResults
                    };

                    this.downloadJSONSafe(exportData, 'benchmark-detailed-export');
                    
                    console.log('📤 Detailed benchmark results with LLM interactions exported');
                    this.updateStatus('ready', 'Results exported successfully');
                    setTimeout(() => this.updateStatus('ready', 'System Ready'), 2000);
                    
                } catch (error) {
                    console.error('Failed to export detailed results:', error);
                    alert('Failed to export detailed results: ' + error.message);
                    // Fallback to basic export
                    try {
                        const cleanResults = this.cleanDataForExport(this.currentResults);
                        this.downloadJSONSafe(cleanResults, 'benchmark-basic-export-fallback');
                    } catch (fallbackError) {
                        console.error('Fallback export also failed:', fallbackError);
                        alert('Export failed completely: ' + fallbackError.message);
                    }
                }
            }

            closeWindow() {
                if (this.isRunning && !confirm('Stop benchmark and close?')) return;
                window.close();
            }

            /**
             * Extract all LLM interaction data from benchmark results
             * Enhanced to extract data from multiple sources including incomplete/timeout scenarios
             */
            extractAllLLMInteractionData(results) {
                const interactions = [];
                
                if (results.testSuiteResults) {
                    results.testSuiteResults.forEach(suite => {
                        if (suite.testResults) {
                            suite.testResults.forEach(test => {
                                // Primary source: dedicated llmInteractionData field
                                if (test.llmInteractionData) {
                                    interactions.push({
                                        ...test.llmInteractionData,
                                        testInfo: {
                                            testId: test.testId,
                                            testName: test.testName,
                                            suiteId: test.suiteId,
                                            score: test.score,
                                            success: test.success,
                                            duration: test.duration,
                                            status: test.status
                                        }
                                    });
                                } else {
                                    // Fallback: construct interaction data from available test fields
                                    const reconstructedInteraction = this.reconstructLLMInteractionFromTest(test);
                                    if (reconstructedInteraction) {
                                        interactions.push(reconstructedInteraction);
                                    }
                                }
                            });
                        }
                    });
                }
                
                return interactions;
            }

            /**
             * Reconstruct LLM interaction data from test result fields
             * Used when dedicated llmInteractionData is not available
             */
            reconstructLLMInteractionFromTest(test) {
                // Skip if no meaningful data is available
                if (!test.llmResponse && !test.actualResult && !test.errors?.length && !test.metrics) {
                    return null;
                }

                const interaction = {
                    // Reconstruct request information
                    request: {
                        prompt: test.details?.instruction || 'Test: ' + test.testName,
                        timestamp: new Date(test.startTime || Date.now()).toISOString(),
                        requestId: 'reconstructed_' + test.testId + '_' + Date.now(),
                        testContext: {
                            expectedResult: test.expectedResult,
                            maxScore: test.maxScore,
                            testType: test.type || 'unknown'
                        }
                    },

                    // Reconstruct response information
                    response: {
                        content: test.llmResponse || null,
                        responseTime: test.metrics?.responseTime || test.duration || 0,
                        timestamp: new Date(test.endTime || Date.now()).toISOString(),
                        responseId: 'reconstructed_resp_' + test.testId + '_' + Date.now(),
                        
                        // Extract function calls if available
                        toolCalls: this.extractToolCallsFromResult(test.actualResult),
                        
                        // Response metadata
                        tokenCount: test.metrics?.tokenCount || 0,
                        responseLength: test.metrics?.responseLength || 0,
                        functionCallsCount: test.metrics?.functionCallsCount || 0
                    },

                    // Reconstruct analysis information
                    analysis: {
                        correctToolUsed: test.success && test.actualResult?.tool_name,
                        parametersCorrect: test.success,
                        taskCompleted: test.success,
                        isError: test.status === 'error' || test.errors?.length > 0,
                        errorDetails: test.errors?.join('; ') || null,
                        confidence: test.metrics?.confidence || null,
                        score: test.score || 0,
                        maxScore: test.maxScore || 100,
                        successRate: test.success ? 100 : 0
                    },

                    // Reconstruct detailed logs
                    detailedLogs: {
                        totalLogs: (test.errors?.length || 0) + (test.warnings?.length || 0) + 1,
                        consoleLogs: [
                            'Test ' + test.testId + ' (' + test.testName + ') executed',
                            ...(test.errors || []).map(error => 'ERROR: ' + error),
                            ...(test.warnings || []).map(warning => 'WARNING: ' + warning),
                            'Result: ' + test.status + ' (score: ' + test.score + '/' + test.maxScore + ')'
                        ],
                        errorLogs: test.errors || [],
                        warningLogs: test.warnings || [],
                        performanceLogs: test.metrics ? [
                            'Response time: ' + (test.metrics.responseTime || test.duration) + 'ms',
                            'Token count: ' + (test.metrics.tokenCount || 'unknown'),
                            'Function calls: ' + (test.metrics.functionCallsCount || 0)
                        ] : []
                    },

                    // Test context information
                    testInfo: {
                        testId: test.testId,
                        testName: test.testName,
                        suiteId: test.suiteId,
                        score: test.score,
                        success: test.success,
                        duration: test.duration,
                        status: test.status,
                        
                        // Additional context
                        startTime: test.startTime,
                        endTime: test.endTime,
                        expectedResult: test.expectedResult,
                        actualResult: test.actualResult
                    }
                };

                return interaction;
            }

            /**
             * Extract tool calls from actualResult
             */
            extractToolCallsFromResult(actualResult) {
                if (!actualResult) return [];

                const toolCalls = [];

                // Handle direct tool call format
                if (actualResult.tool_name) {
                    toolCalls.push({
                        tool: actualResult.tool_name,
                        parameters: actualResult.parameters || {},
                        result: actualResult.result || 'executed'
                    });
                }

                // Handle array of function calls
                if (Array.isArray(actualResult)) {
                    actualResult.forEach(call => {
                        if (call.tool_name) {
                            toolCalls.push({
                                tool: call.tool_name,
                                parameters: call.parameters || {},
                                result: call.result || 'executed'
                            });
                        }
                    });
                }

                // Handle functionCalls array
                if (actualResult.functionCalls && Array.isArray(actualResult.functionCalls)) {
                    actualResult.functionCalls.forEach(call => {
                        if (call.tool_name || call.name) {
                            toolCalls.push({
                                tool: call.tool_name || call.name,
                                parameters: call.parameters || call.args || {},
                                result: call.result || 'executed'
                            });
                        }
                    });
                }

                return toolCalls;
            }

            /**
             * Calculate average response time from interactions
             */
            calculateAverageResponseTime(interactions) {
                const responseTimes = interactions
                    .map(i => i.response?.responseTime)
                    .filter(time => time && time > 0);
                
                if (responseTimes.length === 0) return 0;
                
                return responseTimes.reduce((sum, time) => sum + time, 0) / responseTimes.length;
            }

            /**
             * Safe JSON serialization that handles circular references
             */
            safeJSONStringify(obj, space = 2) {
                const seen = new WeakSet();
                return JSON.stringify(obj, (key, value) => {
                    if (typeof value === "object" && value !== null) {
                        if (seen.has(value)) {
                            return "[Circular Reference]";
                        }
                        seen.add(value);
                    }
                    // Filter out potentially problematic properties
                    if (key === 'genomeBrowser' || key === 'fileManager' || key === 'app' || key === 'chatManager' || key === 'configManager') {
                        return "[Object Reference Removed]";
                    }
                    // Filter out DOM elements and functions
                    if (typeof value === 'function') {
                        return "[Function]";
                    }
                    if (value instanceof Element || value instanceof Node) {
                        return "[DOM Element]";
                    }
                    return value;
                }, space);
            }

            /**
             * Clean data for safe export by removing circular references and problematic objects
             */
            cleanDataForExport(data) {
                if (!data) return data;
                
                // Create a deep copy while filtering out problematic properties
                const cleanData = JSON.parse(this.safeJSONStringify(data));
                return cleanData;
            }

            /**
             * Safe download JSON method using safe serialization
             */
            downloadJSONSafe(data, filename) {
                try {
                    const jsonString = this.safeJSONStringify(data, 2);
                    const blob = new Blob([jsonString], {type: 'application/json'});
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename + '.json';
                    a.click();
                    URL.revokeObjectURL(url);
                } catch (error) {
                    console.error('Download failed:', error);
                    throw new Error('Failed to serialize data for download: ' + error.message);
                }
            }

            /**
             * Export basic benchmark results
             */
            exportBasicResults() {
                if (!this.currentResults) {
                    alert('No results to export');
                    return;
                }
                
                try {
                    const cleanResults = this.cleanDataForExport(this.currentResults);
                    this.downloadJSONSafe(cleanResults, 'benchmark-basic-results');
                    console.log('📄 Basic benchmark results exported');
                    this.updateStatus('ready', 'Basic results exported');
                    setTimeout(() => this.updateStatus('ready', 'System Ready'), 2000);
                } catch (error) {
                    console.error('Failed to export basic results:', error);
                    alert('Failed to export basic results: ' + error.message);
                }
            }

            /**
             * Export detailed LLM interaction data only
             */
            exportDetailedLLMInteractions() {
                if (!this.currentResults) {
                    alert('No benchmark results available to export');
                    return;
                }

                try {
                    // Extract all LLM interaction data
                    const detailedInteractions = this.extractAllLLMInteractionData(this.currentResults);
                    
                    if (detailedInteractions.length === 0) {
                        alert('No LLM interaction data found in results');
                        return;
                    }
                    
                    // Clean interactions data to avoid circular references
                    const cleanInteractions = this.cleanDataForExport(detailedInteractions);
                    
                    // Create comprehensive export data focused on interactions
                    const exportData = {
                        metadata: {
                            exportTimestamp: new Date().toISOString(),
                            benchmarkTimestamp: this.currentResults.startTime,
                            totalTests: this.currentResults.overallStats?.totalTests || 0,
                            totalInteractions: detailedInteractions.length,
                            exportType: 'llm_interactions_only',
                            version: '1.0.0'
                        },
                        
                        // Summary statistics
                        summary: {
                            totalInteractions: detailedInteractions.length,
                            successfulInteractions: detailedInteractions.filter(i => !i.analysis?.isError).length,
                            failedInteractions: detailedInteractions.filter(i => i.analysis?.isError).length,
                            averageResponseTime: this.calculateAverageResponseTime(detailedInteractions),
                            totalConsoleLogs: detailedInteractions.reduce((sum, i) => sum + (i.detailedLogs?.totalLogs || 0), 0)
                        },
                        
                        // Complete interaction data (cleaned)
                        interactions: cleanInteractions
                    };

                    this.downloadJSONSafe(exportData, 'llm-interactions-detailed');
                    
                    console.log('🤖 Detailed LLM interactions exported');
                    this.updateStatus('ready', 'LLM interactions exported');
                    setTimeout(() => this.updateStatus('ready', 'System Ready'), 2000);
                    
                } catch (error) {
                    console.error('Failed to export detailed interactions:', error);
                    alert('Failed to export detailed interactions: ' + error.message);
                }
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
                alert(\`LLM Instruction Following Benchmark v1.0.0

Comprehensive testing framework for LLM instruction following capabilities.

• 12 test suites
• 140+ individual tests
• Advanced statistical analysis
• Professional reporting

Includes comprehensive Edit operations testing:\`);
            }

            downloadJSON(data, filename) {
                try {
                    // Use safe serialization to handle circular references
                    const cleanData = this.cleanDataForExport(data);
                    const jsonString = this.safeJSONStringify(cleanData, 2);
                    const blob = new Blob([jsonString], {type: 'application/json'});
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename + '.json';
                    a.click();
                    URL.revokeObjectURL(url);
                } catch (error) {
                    console.error('Download failed:', error);
                    throw new Error('Failed to serialize data for download: ' + error.message);
                }
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
        
        // Setup export button handlers when DOM is ready
        document.addEventListener('DOMContentLoaded', () => {
            this.setupExportButtonHandlers();
        });
        
        // If DOM is already loaded, setup immediately
        if (document.readyState === 'loading') {
            // DOM is still loading
        } else {
            // DOM is already loaded
            setTimeout(() => this.setupExportButtonHandlers(), 100);
        }
    }

    /**
     * Setup export button event handlers
     */
    setupExportButtonHandlers() {
        // Main window export buttons
        const exportResultsBtn = document.getElementById('exportResults');
        const exportLLMBtn = document.getElementById('exportLLMInteractions');
        
        if (exportResultsBtn) {
            exportResultsBtn.addEventListener('click', () => {
                this.exportMainWindowResults();
            });
        }
        
        if (exportLLMBtn) {
            exportLLMBtn.addEventListener('click', () => {
                this.exportDetailedLLMInteractions();
            });
        }
        
        // Make UI instance globally available for onclick handlers
        window.benchmarkUI = this;
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
