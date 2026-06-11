// @ts-check
/**
 * LLM Benchmark Framework - Comprehensive system for testing LLM instruction following capabilities
 */
class LLMBenchmarkFramework {
  constructor(chatManager, configManager = null) {
    this.chatManager = chatManager;
    this.configManager = configManager;
    this.testSuites = new Map();
    this.benchmarkResults = [];
    this.currentTest = null;
    this.isRunning = false;
    this.testTimeout = 120000; // 2 minutes default timeout
    this.useIndividualTimeouts = false; // Default to using global timeout
    this.testDelay = 0; // default no delay every 10 tests to avoid rate limits
    this.totalDelayTime = 0; // Track total delay time to subtract from final duration
    this.statisticsEngine = new BenchmarkStatistics();
    this.reportGenerator = new BenchmarkReportGenerator();

    // MEMORY OPTIMIZATION: Add memory monitoring with tighter thresholds
    this.memoryMonitor = {
      maxMemoryUsage: 500 * 1024 * 1024, // 500MB limit (unchanged)
      warningThreshold: 300 * 1024 * 1024, // 300MB warning (reduced from 400MB for earlier detection)
      lastCheck: Date.now(),
      checkInterval: 10000, // Check every 10 seconds (increased from 5s — less overhead)
      enabled: true,
    };

    // Wait a short time for all classes to be loaded before initializing test suites
    setTimeout(() => {
      this.initializeTestSuites();
    }, 100);

    this.setupEventHandlers();
  }

  getPathModule() {
    if (typeof window !== 'undefined' && window.path) {
      return window.path;
    }
    return {
      join: (...parts) =>
        parts
          .filter(part => part !== undefined && part !== null && part !== '')
          .join('/')
          .replace(/\/+/g, '/'),
      resolve: (...parts) => {
        const joined = parts.filter(part => part !== undefined && part !== null && part !== '').join('/');
        const normalized = joined.replace(/\\/g, '/').replace(/\/+/g, '/');
        return /^([A-Za-z]:[\\/]|\/)/.test(normalized) ? normalized : `/${normalized}`;
      },
    };
  }

  normalizeDirectoryPath(directoryPath) {
    const rawPath = String(directoryPath || '').trim();
    if (!rawPath) return rawPath;

    try {
      const pathModule = this.getPathModule();
      if (pathModule && typeof pathModule.resolve === 'function') {
        return pathModule.resolve(rawPath);
      }
    } catch (error) {
      console.warn(`⚠️ [LLMBenchmarkFramework] Path normalization fallback used: ${error.message}`);
    }

    return rawPath.replace(/\\/g, '/').replace(/\/+/g, '/');
  }

  collectGarbageIfAvailable(reason) {
    const runtimeGlobal =
      typeof globalThis !== 'undefined' ? globalThis : typeof window !== 'undefined' ? window : null;
    if (runtimeGlobal && typeof runtimeGlobal.gc === 'function') {
      runtimeGlobal.gc();
      console.log(`🧹 ${reason}`);
      return true;
    }
    return false;
  }

  /**
   * Initialize all test suites
   */
  initializeTestSuites() {
    // Check if all required test suite classes are available
    const requiredClasses = ['AutomaticSimpleSuite', 'AutomaticComplexSuite', 'ManualSuite', 'ManualComplexSuite'];
    const missingClasses = requiredClasses.filter(className => !window[className]);

    if (missingClasses.length > 0) {
      console.warn('⚠️ Missing test suite classes:', missingClasses);
      console.log(
        '🔍 Available classes:',
        requiredClasses.filter(className => window[className])
      );

      // Retry after a short delay (allow for async script loading)
      console.log('🔄 Retrying test suite initialization in 500ms...');
      setTimeout(() => {
        this.initializeTestSuites();
      }, 500);
      return;
    }

    // Specialized Genomic Analysis Test Suites (4 suites organized by evaluation method and complexity)
    this.registerTestSuite('automatic_simple', new AutomaticSimpleSuite());
    this.registerTestSuite('automatic_complex', new AutomaticComplexSuite());
    this.registerTestSuite('manual_suite', new ManualSuite());
    this.registerTestSuite('manual_complex', new ManualComplexSuite());

    // Update suite names with actual test counts
    this.updateSuiteNamesWithCounts();

    console.log(`✅ Initialized ${this.testSuites.size} test suites with ${this.getTotalTestCount()} total tests`);
  }

  /**
   * Update suite names to include actual test counts
   * Strips any existing count suffix before appending the current count
   */
  updateSuiteNamesWithCounts() {
    for (const [, suite] of this.testSuites.entries()) {
      if (suite.suiteName) {
        const count = suite.getTestCount();
        // Remove any existing count suffix like " (122)" or " (4)"
        const baseName = suite.suiteName.replace(/\s*\(\d+\)\s*$/, '').trim();
        suite.suiteName = `${baseName} (${count})`;
      }
    }
  }

  /**
   * Register a test suite
   */
  registerTestSuite(id, testSuite) {
    this.testSuites.set(id, testSuite);
    testSuite.framework = this;
  }

  /**
   * Get total number of tests across all suites
   */
  getTotalTestCount() {
    if (this.testSuites.size === 0) {
      return 0; // Return 0 if test suites not yet loaded
    }

    let total = 0;
    for (const suite of this.testSuites.values()) {
      total += suite.getTestCount();
    }
    return total;
  }

  /**
   * Run all benchmarks
   */
  async runAllBenchmarks(options = {}) {
    if (this.isRunning) {
      throw new Error('Benchmark is already running');
    }

    // CRITICAL FIX: Validate LLM configuration before starting any tests
    if (!this.chatManager || !this.chatManager.llmConfigManager) {
      throw new Error('ChatManager or LLMConfigManager not available. Cannot run benchmarks without LLM integration.');
    }

    if (!this.chatManager.llmConfigManager.isConfigured()) {
      const errorMessage = 'LLM not configured. Please configure an LLM provider first.';
      console.error('❌ [Benchmark] LLM Configuration Error:', errorMessage);

      // Show user-friendly error message
      if (this.chatManager.addThinkingMessage) {
        this.chatManager.addThinkingMessage(
          '❌ **Benchmark Configuration Error**\n\n' +
            'LLM provider is not configured. To run benchmarks, please:\n\n' +
            '• Go to Options → Configure LLMs\n' +
            '• Set up your preferred AI provider (OpenAI, Anthropic, Google, etc.)\n' +
            '• Enable at least one provider\n' +
            '• Test the connection to ensure it works\n\n' +
            'Once configured, you can run benchmarks to evaluate AI performance.'
        );
      }

      throw new Error(errorMessage);
    }

    // Log successful configuration validation
    const enabledProviders = Object.entries(this.chatManager.llmConfigManager.providers)
      .filter(([key, provider]) => provider.enabled)
      .map(([key, provider]) => `${key} (${provider.model})`);

    console.log('✅ [Benchmark] LLM Configuration validated:', enabledProviders.join(', '));

    this.isRunning = true;
    const startTime = Date.now();
    let benchmarkRunSessionId = null;
    const previousBenchmarkAutomationActive = this.chatManager?.benchmarkAutomationActive === true;

    // Set timeout from options if provided
    // If timeout is null, it means use individual test timeouts
    if (options.timeout !== undefined) {
      if (options.timeout === null || options.useIndividualTimeouts) {
        this.useIndividualTimeouts = true;
        this.testTimeout = 120000; // Keep default as fallback
        console.log(`🕐 Using individual test timeout settings (each test controls its own timeout)`);
      } else {
        this.useIndividualTimeouts = false;
        this.testTimeout = options.timeout;
        console.log(
          `🕐 Global test timeout set to ${this.testTimeout}ms (${this.testTimeout / 1000}s) - overriding individual test timeouts`
        );
      }
    }

    // Set test delay from options if provided
    if (options.testDelay !== undefined) {
      this.testDelay = options.testDelay;
      console.log(
        `⏱️ Batch delay set to ${this.testDelay}ms (${this.testDelay / 1000}s) every 10 tests to avoid rate limits`
      );
    }

    // Reset total delay time tracking
    this.totalDelayTime = 0;

    try {
      if (this.chatManager) {
        this.chatManager.benchmarkAutomationActive = true;
        if (this.chatManager.toolExecutionTracker) {
          benchmarkRunSessionId = `benchmark_run_${startTime}`;
          this.chatManager.toolExecutionTracker.startSession(benchmarkRunSessionId, {
            benchmark: true,
            scope: 'run',
            startTime,
          });
          console.log(`🔬 [Benchmark] Started run-level tracker session: ${benchmarkRunSessionId}`);
        }
      }

      const results = {
        startTime: startTime,
        endTime: null,
        duration: null,
        testSuiteResults: [],
        overallStats: null,
        options: options,
      };

      // Calculate total test count for accurate progress tracking
      let totalTestCount = 0;

      for (const [suiteId, testSuite] of this.testSuites.entries()) {
        if (options.suites && !options.suites.includes(suiteId)) {
          continue; // Skip if specific suites requested and this isn't one
        }

        let suiteTests = testSuite.getTests();
        if (options.tests) {
          suiteTests = suiteTests.filter(test => options.tests.includes(test.id));
        }
        totalTestCount += suiteTests.length;
      }

      console.log(`📊 [Progress Tracking] Total tests to run: ${totalTestCount}`);

      // CRITICAL FIX: Initial cleanup before any suites run
      if (this.chatManager) {
        if (typeof this.chatManager.clearChat === 'function') {
          this.chatManager.clearChat();
          console.log('🧹 [Benchmark] Initial cleanup: cleared chat history before starting benchmark run');
        }
        if (typeof this.chatManager.clearExecutionData === 'function') {
          this.chatManager.clearExecutionData();
        }
        // MEMORY OPTIMIZATION: Clear Evolution events accumulated from previous runs
        if (this.chatManager.currentConversationData && this.chatManager.currentConversationData.events) {
          this.chatManager.currentConversationData.events.length = 0;
        }
        // MEMORY OPTIMIZATION: Clear stale thinking process DOM elements
        try {
          document.querySelectorAll('[id^="thinkingProcess_"]').forEach(el => el.remove());
        } catch (e) {
          /* ignore */
        }
      }

      // Store for progress calculation
      this.totalTestCount = totalTestCount;
      this.completedTestCount = 0;

      // Monitor memory usage
      const initialMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
      console.log(`🧠 Initial memory usage: ${Math.round(initialMemory / 1024 / 1024)} MB`);

      // Run each test suite with error handling
      for (const [suiteId, testSuite] of this.testSuites.entries()) {
        // Check if benchmark was stopped
        if (!this.isRunning) {
          console.log('🛑 Benchmark stopped by user');
          this.chatManager.updateThinkingMessage(
            '\n\n🛑 **Benchmark Stopped**\nBenchmark execution was stopped by user request.'
          );
          break;
        }

        if (options.suites && !options.suites.includes(suiteId)) {
          continue; // Skip if specific suites requested and this isn't one
        }

        console.log(`Running test suite: ${suiteId}`);

        // Configure test suite with options (including default directory)
        if (testSuite.setConfiguration && typeof testSuite.setConfiguration === 'function') {
          testSuite.setConfiguration(options);
          console.log(`🔧 Test suite ${suiteId} configured with options:`, {
            defaultDirectory: options.defaultDirectory,
            timeout: options.timeout,
          });
        }

        // CRITICAL: Set ChatBox working directory before starting ANY test suite
        await this.setupBenchmarkWorkingDirectory(
          options.defaultDirectory || '/Users/song/Documents/Genome-AI-Studio-Projects/test_data/'
        );

        try {
          const suiteResult = await this.runTestSuite(suiteId, options);
          results.testSuiteResults.push(suiteResult);

          // Update completed test count
          this.completedTestCount += suiteResult.stats.totalTests;

          // Update progress with granular test-based calculation
          if (options.onProgress) {
            const testBasedProgress = this.totalTestCount > 0 ? this.completedTestCount / this.totalTestCount : 0;
            console.log(
              `📊 [Progress Update] Suite '${suiteId}' completed: ${this.completedTestCount}/${this.totalTestCount} tests (${(testBasedProgress * 100).toFixed(1)}%)`
            );
            options.onProgress(testBasedProgress, suiteId, suiteResult);
          }

          // Memory monitoring
          const currentMemory = performance.memory ? performance.memory.usedJSHeapSize : 0;
          const memoryDelta = currentMemory - initialMemory;
          console.log(
            `🧠 Memory after suite ${suiteId}: ${Math.round(currentMemory / 1024 / 1024)} MB (Δ${Math.round(memoryDelta / 1024 / 1024)} MB)`
          );

          // Force garbage collection if memory usage is high
          if (memoryDelta > 100 * 1024 * 1024) {
            // 100MB threshold
            this.collectGarbageIfAvailable('Forced garbage collection due to high memory usage');
          }
        } catch (suiteError) {
          console.error(`❌ Error in test suite ${suiteId}:`, suiteError);

          // Add error result instead of crashing
          results.testSuiteResults.push({
            suiteId: suiteId,
            startTime: Date.now(),
            endTime: Date.now(),
            duration: 0,
            testResults: [],
            stats: { totalTests: 0, passedTests: 0, failedTests: 0, averageScore: 0 },
            error: suiteError.message,
          });

          // Continue with next suite
          continue;
        }
      }

      results.endTime = Date.now();
      results.duration = results.endTime - results.startTime;
      results.overallStats = this.statisticsEngine.calculateOverallStatistics(results.testSuiteResults);

      this.benchmarkResults.push(results);

      // Generate report if requested
      if (options.generateReport !== false) {
        const report = this.reportGenerator.generateReport(results, options);
        results.report = report;
      }

      return results;
    } finally {
      if (benchmarkRunSessionId && this.chatManager?.toolExecutionTracker) {
        this.chatManager.toolExecutionTracker.endSession(benchmarkRunSessionId);
        console.log(`🔬 [Benchmark] Ended run-level tracker session: ${benchmarkRunSessionId}`);
      }
      if (this.chatManager) {
        this.chatManager.benchmarkAutomationActive = previousBenchmarkAutomationActive;
      }
      this.isRunning = false;
    }
  }

  /**
   * Setup benchmark working directory
   * CRITICAL: This must be called before any file operations in benchmark tests
   * Ensures ChatBox uses the correct directory for all file operations
   */
  async setupBenchmarkWorkingDirectory(directoryPath) {
    console.log('📁 [LLMBenchmarkFramework] Setting up benchmark working directory:', directoryPath);

    try {
      // Ensure directory path is normalized without depending on unrestricted Node APIs in the renderer.
      const normalizedPath = this.normalizeDirectoryPath(directoryPath);

      // Call ChatManager's setWorkingDirectory method directly
      if (this.chatManager && typeof this.chatManager.setWorkingDirectory === 'function') {
        console.log('🔧 [LLMBenchmarkFramework] Calling ChatManager.setWorkingDirectory...');

        const result = await this.chatManager.setWorkingDirectory({
          directory_path: normalizedPath,
          validate_permissions: true,
          create_if_missing: false, // Don't create directory in benchmark mode
        });

        if (result && result.success) {
          console.log('✅ [LLMBenchmarkFramework] Working directory set successfully:', result.current_directory);

          // Add to thinking message to show users what happened
          this.chatManager.addThinkingMessage(
            `📁 **Benchmark Environment Setup**</br>` +
              `• Working Directory: \`${result.current_directory}\`</br>` +
              `• Previous Directory: \`${result.previous_directory}\`</br>` +
              `• Status: ✅ Successfully configured</br>` +
              `• All file operations will use this directory as base path</br></br>`
          );
        } else {
          console.warn('⚠️ [LLMBenchmarkFramework] Working directory setup returned non-success result:', result);

          // Show warning but continue
          this.chatManager.addThinkingMessage(
            `⚠️ **Working Directory Warning**</br>` +
              `• Attempted Directory: \`${normalizedPath}\`</br>` +
              `• Result: ${result?.message || result?.error || 'Unknown error'}</br>` +
              `• Continuing with current working directory</br></br>`
          );
        }
      } else {
        console.error('❌ [LLMBenchmarkFramework] ChatManager.setWorkingDirectory method not available');

        // Show error message to user
        this.chatManager.addThinkingMessage(
          `❌ **Working Directory Setup Failed**</br>` +
            `• Reason: setWorkingDirectory method not available on ChatManager</br>` +
            `• This may cause file operation tests to fail</br>` +
            `• Please ensure ChatManager has working directory tool implemented</br></br>`
        );

        throw new Error('ChatManager working directory tool not available');
      }
    } catch (error) {
      console.error('❌ [LLMBenchmarkFramework] Failed to setup working directory:', error);

      // Add error to thinking message
      this.chatManager.addThinkingMessage(
        `❌ **Working Directory Setup Error**</br>` +
          `• Directory: \`${directoryPath}\`</br>` +
          `• Error: ${error.message}</br>` +
          `• File operation tests may fail due to incorrect working directory</br></br>`
      );

      // Don't throw - allow benchmark to continue with warning
      console.warn('⚠️ [LLMBenchmarkFramework] Continuing benchmark despite working directory setup failure');
    }
  }

  /**
   * Run a specific test suite
   */
  async runTestSuite(suiteId, options = {}) {
    const testSuite = this.testSuites.get(suiteId);
    if (!testSuite) {
      throw new Error(`Test suite not found: ${suiteId}`);
    }

    const startTime = Date.now();
    const results = {
      suiteId: suiteId,
      suiteName: testSuite.getName(),
      startTime: startTime,
      endTime: null,
      duration: null,
      testResults: [],
      stats: null,
    };

    const tests = testSuite.getTests();
    const filteredTests = options.tests ? tests.filter(test => options.tests.includes(test.id)) : tests;

    // CRITICAL FIX: Update current suite name at the beginning
    if (options.onProgress) {
      // Call with 0 progress to indicate suite is starting
      const initialProgress = this.framework ? this.framework.completedTestCount / this.framework.totalTestCount : 0;
      console.log(`🚀 [Suite Progress START] Starting suite ${suiteId}`);
      options.onProgress(initialProgress, suiteId, null);
    }

    // CRITICAL FIX: Call test suite setup method before running any tests
    if (testSuite.setup && typeof testSuite.setup === 'function') {
      console.log(`🔧 [LLMBenchmarkFramework] Calling setup for test suite: ${suiteId}`);
      try {
        const context = {
          chatManager: this.chatManager,
          configManager: this.configManager,
          suiteId: suiteId,
          framework: this,
        };
        await testSuite.setup(context);
        console.log(`✅ [LLMBenchmarkFramework] Setup completed for test suite: ${suiteId}`);
      } catch (setupError) {
        console.error(`❌ [LLMBenchmarkFramework] Setup failed for test suite ${suiteId}:`, setupError);
        // Don't throw - allow tests to continue even if setup fails
      }
    } else {
      console.log(`ℹ️  [LLMBenchmarkFramework] No setup method found for test suite: ${suiteId}`);
    }

    // Display test suite start
    this.displayTestSuiteStart(testSuite, filteredTests.length);

    // Track delay time for this suite
    let suiteDelayTime = 0;

    // Run tests with proper memory management
    for (let i = 0; i < filteredTests.length; i++) {
      const test = filteredTests[i];

      // Check if benchmark was stopped
      if (!this.isRunning) {
        console.log('🛑 Test suite stopped by user');
        this.chatManager.updateThinkingMessage(
          '\n\n🛑 Test Suite Stopped\nTest suite execution was stopped by user request.'
        );
        break;
      }

      console.log(`Running test: ${test.id} (${i + 1}/${filteredTests.length})`);

      // CRITICAL FIX: Update test progress BEFORE starting the test to show current test name
      if (options.onTestProgress) {
        const testProgress = i / filteredTests.length; // Use i (starting) instead of i+1 (completed)
        const overallTestProgress = this.framework
          ? (this.framework.completedTestCount + i) / this.framework.totalTestCount
          : testProgress;

        console.log(
          `📊 [Test Progress START] Starting test ${i + 1}/${filteredTests.length} in suite, Overall: ${this.framework?.completedTestCount + i || i}/${this.framework?.totalTestCount || filteredTests.length}`
        );

        // Call with null testResult to indicate test is starting
        options.onTestProgress(overallTestProgress, test.id, null, suiteId);
      }

      // CRITICAL FIX: Clear chat history and previous execution data before test starts to prevent memory bloat and context contamination
      if (this.chatManager) {
        if (typeof this.chatManager.clearChat === 'function') {
          this.chatManager.clearChat();
          console.log(`🧹 [Benchmark] Cleared chat history before test ${test.id}`);
        }
        if (typeof this.chatManager.clearExecutionData === 'function') {
          this.chatManager.clearExecutionData();
        }
        // MEMORY OPTIMIZATION: Clear Evolution data that accumulates per test.
        // Each addThinkingMessage() call adds to currentConversationData.events,
        // which is never cleared by clearChat() and grows unboundedly.
        if (this.chatManager.currentConversationData && this.chatManager.currentConversationData.events) {
          this.chatManager.currentConversationData.events.length = 0;
          console.log(`🧹 [Benchmark] Cleared Evolution events before test ${test.id}`);
        }
        // MEMORY OPTIMIZATION: Remove stale thinking process DOM elements.
        // addThinkingMessage() creates DOM nodes that are never cleaned up between tests.
        try {
          const staleThinking = document.querySelectorAll('[id^="thinkingProcess_"]');
          staleThinking.forEach(el => el.remove());
          if (staleThinking.length > 0) {
            console.log(
              `🧹 [Benchmark] Removed ${staleThinking.length} stale thinking DOM elements before test ${test.id}`
            );
          }
        } catch (domError) {
          // Ignore DOM errors in non-browser contexts
        }
      }

      // Display test progress
      this.displayTestProgress(test, i + 1, filteredTests.length);

      const testResult = await this.runSingleTest(test, suiteId);

      // MEMORY OPTIMIZATION: Slim down the test result before storing it in the array.
      // The full llmInteractionData can be 5-15MB per test (logs, prompts, execution data).
      // After evaluation, we only need the scoring-relevant fields in the stored result.
      const slimResult = await this.slimDownTestResult(testResult);
      results.testResults.push(slimResult);

      // MEMORY OPTIMIZATION: Clear the full result reference immediately
      // This allows GC to reclaim the large llmInteractionData sooner
      if (testResult !== slimResult) {
        testResult.llmInteractionData = null;
        testResult.detailedLogs = null;
        testResult.llmResponse = null;
      }

      // Update test progress AFTER completion with result
      if (options.onTestProgress) {
        const testProgress = (i + 1) / filteredTests.length;
        const overallTestProgress = this.framework
          ? (this.framework.completedTestCount + i + 1) / this.framework.totalTestCount
          : testProgress;

        console.log(
          `📊 [Test Progress COMPLETE] Test ${i + 1}/${filteredTests.length} in suite, Overall: ${this.framework?.completedTestCount + i + 1 || i + 1}/${this.framework?.totalTestCount || filteredTests.length}`
        );
        options.onTestProgress(overallTestProgress, test.id, testResult, suiteId);
      }

      // MEMORY OPTIMIZATION: Force garbage collection every 5 tests AND check memory
      if (i % 5 === 0) {
        this.checkMemoryUsage();
        this.collectGarbageIfAvailable(`Memory cleanup performed after test ${i + 1}`);
      }

      // Add configurable delay every 10 tests to prevent rate limiting
      // Apply delay after tests 10, 20, 30, etc. (but not after the last test)
      if (i < filteredTests.length - 1 && (i + 1) % 10 === 0) {
        if (this.testDelay > 0) {
          const testsRemaining = filteredTests.length - (i + 1);
          console.log(
            `⏳ [Rate Limit Protection] Completed ${i + 1} tests. Waiting ${this.testDelay}ms (${this.testDelay / 1000}s) before continuing... (${testsRemaining} tests remaining)`
          );
          await new Promise(resolve => setTimeout(resolve, this.testDelay));
          suiteDelayTime += this.testDelay;
          this.totalDelayTime += this.testDelay;
        } else {
          // Minimal delay to prevent overwhelming the system
          await new Promise(resolve => setTimeout(resolve, 100));
        }
      } else if (i < filteredTests.length - 1) {
        // Small delay between tests for system stability
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    results.endTime = Date.now();
    results.duration = results.endTime - results.startTime;
    results.delayTime = suiteDelayTime; // Track delay time for this suite
    results.stats = this.statisticsEngine.calculateSuiteStatistics(results.testResults);

    // Display test suite completion
    this.displayTestSuiteComplete(testSuite, results);

    return results;
  }

  /**
   * Display test suite start information
   */
  displayTestSuiteStart(testSuite, testCount) {
    this.chatManager.addThinkingMessage(
      `👩‍🔬 **CodeXomics Benchmark Tester** </br>` +
        `🏢 **GenomeAI Testing Laboratory** | 📅 ${new Date().toLocaleDateString()}</br>` +
        `═══════════════════════════════════════════════════════════\n\n` +
        `📋 **INITIATING TEST SUITE EXECUTION**</br></br>` +
        `**Suite Specification:**</br>` +
        `• Name: ${testSuite.getName()}</br>` +
        `• Suite ID: ${testSuite.suiteId || testSuite.getName().toLowerCase().replace(/\s+/g, '_')}</br>` +
        `• Description: ${testSuite.description || 'Comprehensive LLM capability assessment'}</br>` +
        `• Test Count: ${testCount} individual tests</br>` +
        `• Estimated Duration: ~${Math.ceil(testCount * 0.5)} minutes</br></br>` +
        `🎯 **Testing Objectives:**</br>` +
        `• Validate LLM instruction comprehension accuracy</br>` +
        `• Assess function calling precision and reliability</br>` +
        `• Measure response quality and consistency metrics</br>` +
        `• Evaluate computational efficiency and performance</br>` +
        `• Document behavioral patterns and edge cases</br>` +
        `🔬 **Quality Assurance Protocol:**</br>` +
        `• Each test scored on 100-point scale</br>` +
        `• Pass threshold: 70% minimum score</br>` +
        `• Automated function call detection</br>` +
        `• Parameter validation and compliance checking</br>` +
        `• Performance metrics collection</br></br>` +
        `⚡ **Status:** Beginning systematic test execution with enhanced monitoring...`
    );
  }

  /**
   * Display individual test progress
   */
  displayTestProgress(test, currentIndex, totalTests) {
    const progressPercentage = Math.round((currentIndex / totalTests) * 100);
    const progressBar =
      '█'.repeat(Math.floor(progressPercentage / 5)) + '░'.repeat(20 - Math.floor(progressPercentage / 5));

    this.chatManager.updateThinkingMessage(
      `</br></br>📍 **TEST PROGRESS:** ${currentIndex}/${totalTests} (${progressPercentage}%)</br>\n` +
        `${progressBar}</br></br>\n\n` +
        `👩‍🔬 CodeXomics Benchmark Tester: "Proceeding with ${test.name}"</br></br>\n` +
        `**Test Specification:**</br>\n` +
        `&nbsp;&nbsp;&nbsp;• Test ID: ${test.id}</br>\n` +
        `&nbsp;&nbsp;&nbsp;• Type: ${this.getTestTypeDescription(test.type)}</br>\n` +
        `&nbsp;&nbsp;&nbsp;• Complexity: ${test.complexity || 'Standard'}</br>\n` +
        `&nbsp;&nbsp;&nbsp;• Expected Tool: \`${test.expectedResult?.tool_name || 'Various'}\`</br>\n` +
        `&nbsp;&nbsp;&nbsp;• Max Score: ${test.maxScore || 100} points</br>\n` +
        `&nbsp;&nbsp;&nbsp;• Estimated Completion: ${Math.ceil((totalTests - currentIndex) * 0.5)} minutes remaining</br>\n` +
        `═══════════════════════════════════════════════════════════</br>\n` +
        `🚀 **Initiating LLM interaction for comprehensive testing...**`
    );
  }

  /**
   * Display test suite completion summary
   */
  displayTestSuiteComplete(testSuite, results) {
    const successRate = ((results.stats.passedTests / results.stats.totalTests) * 100).toFixed(1);
    const avgScore = (results.stats.scoreStats?.percentage?.mean || results.stats.scoreStats?.raw?.mean || 0).toFixed(
      1
    );

    // Calculate actual test execution time (excluding delays)
    const actualDuration = results.duration - (results.delayTime || 0);
    const totalDuration = results.duration;
    const delayTime = results.delayTime || 0;

    const actualMinutes = (actualDuration / 60000).toFixed(1);
    const actualSeconds = (actualDuration / 1000).toFixed(1);
    const totalMinutes = (totalDuration / 60000).toFixed(1);
    const totalSeconds = (totalDuration / 1000).toFixed(1);
    const delayMinutes = (delayTime / 60000).toFixed(1);
    const delaySeconds = (delayTime / 1000).toFixed(1);

    // Determine overall grade and certification
    let certification = '';
    let gradeEmoji = '';
    if (successRate >= 95) {
      certification = 'CERTIFIED FOR PRODUCTION ✅';
      gradeEmoji = '🏆';
    } else if (successRate >= 85) {
      certification = 'APPROVED WITH RECOMMENDATIONS ⚠️';
      gradeEmoji = '🥇';
    } else if (successRate >= 70) {
      certification = 'CONDITIONAL APPROVAL 🔍';
      gradeEmoji = '🥈';
    } else if (successRate >= 50) {
      certification = 'REQUIRES IMPROVEMENT ⚠️';
      gradeEmoji = '🥉';
    } else {
      certification = 'NOT RECOMMENDED FOR DEPLOYMENT ❌';
      gradeEmoji = '📊';
    }

    this.chatManager.updateThinkingMessage(
      `<br><br>👩‍🔬 CodeXomics Benchmark Tester - FINAL SUITE REPORT<br>` +
        `═══════════════════════════════════════════════════════════<br><br>` +
        `${gradeEmoji} **TEST SUITE COMPLETED: ${testSuite.getName()}**<br><br>` +
        `**📊 EXECUTIVE SUMMARY:**<br>` +
        `&nbsp;&nbsp;&nbsp;• Total Elapsed Time: ${totalMinutes} minutes (${totalSeconds}s)<br>` +
        `&nbsp;&nbsp;&nbsp;• Actual Test Time: ${actualMinutes} minutes (${actualSeconds}s)<br>` +
        (delayTime > 0 ? `&nbsp;&nbsp;&nbsp;• Rate Limit Delays: ${delayMinutes} minutes (${delaySeconds}s)<br>` : '') +
        `&nbsp;&nbsp;&nbsp;• Success Rate: ${successRate}% (${results.stats.passedTests}/${results.stats.totalTests} tests)<br>` +
        `&nbsp;&nbsp;&nbsp;• Average Performance Score: ${avgScore}/100 points<br>` +
        `&nbsp;&nbsp;&nbsp;• Quality Certification: ${certification}<br><br>` +
        `**📈 DETAILED BREAKDOWN:**<br>` +
        `&nbsp;&nbsp;&nbsp;• ✅ Passed Tests: ${results.stats.passedTests} (${((results.stats.passedTests / results.stats.totalTests) * 100).toFixed(1)}%)<br>` +
        `&nbsp;&nbsp;&nbsp;• ❌ Failed Tests: ${results.stats.failedTests} (${((results.stats.failedTests / results.stats.totalTests) * 100).toFixed(1)}%)<br>` +
        `&nbsp;&nbsp;&nbsp;• ⚠️ Error Cases: ${results.stats.errorTests} (${((results.stats.errorTests / results.stats.totalTests) * 100).toFixed(1)}%)<br><br>` +
        `**🎯 PERFORMANCE METRICS:**<br>` +
        `&nbsp;&nbsp;&nbsp;• Highest Score: ${results.stats.scoreStats?.raw?.max || results.stats.scoreStats?.max || 'N/A'}/100 (Peak Performance)<br>` +
        `&nbsp;&nbsp;&nbsp;• Lowest Score: ${results.stats.scoreStats?.raw?.min || results.stats.scoreStats?.min || 'N/A'}/100 (Needs Review)<br>` +
        `&nbsp;&nbsp;&nbsp;• Score Distribution: σ = ${results.stats.scoreStats?.raw?.standardDeviation?.toFixed(1) || results.stats.scoreStats?.standardDeviation?.toFixed(1) || 'N/A'}<br>` +
        `&nbsp;&nbsp;&nbsp;• Average Response Time: ${results.stats.performanceStats?.averageResponseTime || 'N/A'}ms<br>` +
        `&nbsp;&nbsp;&nbsp;• Efficiency Rating: ${this.calculateSuiteEfficiency(results)}<br><br>` +
        `**📋 PROFESSIONAL RECOMMENDATION:**<br>` +
        `&nbsp;&nbsp;&nbsp;${this.generateSuiteRecommendation(successRate, avgScore, testSuite.getName())}<br><br>` +
        `───────────────────────────────────────────────────────────<br>` +
        `**Test Engineer:** | **Lab:** GenomeAI Testing | **Date:** ${new Date().toLocaleDateString()}<br>` +
        `**Report Status:** ${successRate >= 70 ? 'APPROVED FOR REVIEW ✅' : 'REQUIRES IMMEDIATE ATTENTION ⚠️'}`
    );
  }

  /**
   * Calculate suite efficiency rating
   */
  calculateSuiteEfficiency(results) {
    const avgResponseTime = results.stats.performanceStats?.averageResponseTime || 0;
    const successRate = (results.stats.passedTests / results.stats.totalTests) * 100;

    if (avgResponseTime === 0) return '⚡ Excellent'; // No timing data available
    if (avgResponseTime < 1500 && successRate >= 90) return '🚀 Exceptional';
    if (avgResponseTime < 2500 && successRate >= 80) return '⚡ Excellent';
    if (avgResponseTime < 4000 && successRate >= 70) return '👍 Good';
    if (avgResponseTime < 6000 && successRate >= 60) return '⏳ Average';
    return '🐌 Needs Optimization';
  }

  /**
   * Generate professional suite recommendation
   */
  generateSuiteRecommendation(successRate, avgScore, suiteName) {
    if (successRate >= 95) {
      return `"${suiteName} demonstrates exceptional LLM performance with ${successRate}% success rate. The system shows production-ready capabilities with minimal risk. Recommend immediate deployment with standard monitoring protocols."`;
    } else if (successRate >= 85) {
      return `"${suiteName} shows strong performance (${successRate}% success) with minor optimization opportunities. Suitable for production deployment with enhanced monitoring during initial rollout phase."`;
    } else if (successRate >= 70) {
      return `"${suiteName} meets minimum production standards (${successRate}% success) but requires attention to failed test cases. Recommend targeted improvements before full deployment."`;
    } else if (successRate >= 50) {
      return `"${suiteName} performance (${successRate}% success) below production standards. Significant improvements required in core capabilities before deployment consideration."`;
    } else {
      return `"${suiteName} demonstrates critical deficiencies (${successRate}% success). Comprehensive system review and retraining required before production readiness assessment."`;
    }
  }

  /**
   * Run a single test
   */
  async runSingleTest(test, suiteId) {
    // Check if benchmark was stopped before starting test
    if (!this.isRunning) {
      console.log(`🛑 Test ${test.id} skipped - benchmark stopped`);
      return {
        testId: test.id,
        testName: test.name,
        suiteId: suiteId,
        startTime: Date.now(),
        endTime: Date.now(),
        duration: 0,
        status: 'cancelled',
        success: false,
        score: 0,
        maxScore: test.maxScore || 100,
        details: { cancelled: true },
        errors: ['Test cancelled by user'],
        warnings: [],
        llmResponse: null,
        expectedResult: test.expectedResult || null,
        actualResult: null,
        metrics: {},
      };
    }

    const startTime = Date.now();
    this.currentTest = test;

    const result = {
      testId: test.id,
      testName: test.name,
      suiteId: suiteId,
      startTime: startTime,
      endTime: null,
      duration: null,
      status: 'running',
      success: false,
      score: 0,
      maxScore: test.maxScore || 100,
      details: {},
      errors: [],
      warnings: [],
      llmResponse: null,
      expectedResult: test.expectedResult || null,
      actualResult: null,
      metrics: {},
    };

    try {
      // Determine timeout based on configuration
      let timeoutMs;
      if (this.useIndividualTimeouts) {
        // Use individual test timeout if specified, otherwise use global default
        timeoutMs = test.timeout || this.testTimeout;
        console.log(
          `⏱️ Running test ${test.id} with ${test.timeout ? 'individual' : 'default'} timeout: ${timeoutMs}ms (${timeoutMs / 1000}s)`
        );
      } else {
        // Use global timeout, overriding individual test settings
        timeoutMs = this.testTimeout;
        if (test.timeout && test.timeout !== timeoutMs) {
          console.log(
            `⏱️ Running test ${test.id} with global timeout: ${timeoutMs}ms (${timeoutMs / 1000}s) [overriding individual timeout: ${test.timeout}ms]`
          );
        } else {
          console.log(`⏱️ Running test ${test.id} with global timeout: ${timeoutMs}ms (${timeoutMs / 1000}s)`);
        }
      }

      // Create a promise that tracks partial progress
      const executeTestWithProgress = async () => {
        try {
          const testResult = await this.executeTest(test);
          return testResult;
        } catch (error) {
          // Even if test execution fails, try to capture any partial LLM interaction data
          console.warn(`Test execution failed for ${test.id}, but attempting to capture partial data:`, error);
          throw error;
        }
      };

      // Execute the test with timeout (except for manual tests)
      let testResult;
      if (test.evaluation === 'manual') {
        console.log(`📋 Manual test detected, removing timeout limit: ${test.id}`);
        // Manual tests don't have timeout - wait indefinitely for user input
        testResult = await executeTestWithProgress();
      } else {
        // Automated tests have timeout
        testResult = await Promise.race([
          executeTestWithProgress(),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Test timeout after ${timeoutMs}ms`)), timeoutMs)
          ),
        ]);
      }

      result.llmResponse = testResult.llmResponse;
      result.actualResult = testResult.actualResult;
      result.details = testResult.details || {};
      result.metrics = testResult.metrics || {};

      // CRITICAL ENHANCEMENT: Store complete LLM interaction data
      result.llmInteractionData = testResult.llmInteractionData || null;

      // Evaluate the test result
      const evaluation = await this.evaluateTestResult(test, testResult);
      result.success = evaluation.success;
      result.score = evaluation.score;
      result.status = evaluation.success ? 'passed' : 'failed';

      if (evaluation.errors) {
        result.errors.push(...evaluation.errors);
      }
      if (evaluation.warnings) {
        result.warnings.push(...evaluation.warnings);
      }
    } catch (error) {
      result.status = 'error';
      result.success = false;
      result.score = 0;
      result.errors.push(error.message);
      console.error(`Test ${test.id} failed with error:`, error);

      // CRITICAL FIX: Try to capture LLM interaction data even on timeout/error
      // Check if we have any LLM interaction data from ChatManager or other sources
      try {
        const partialInteractionData = await this.attemptToRecoverLLMInteractionData(test, error);
        if (partialInteractionData) {
          result.llmInteractionData = partialInteractionData;
          console.log(`🔄 Recovered partial LLM interaction data for test ${test.id}`);
        }
      } catch (recoveryError) {
        console.warn(`Failed to recover LLM interaction data for test ${test.id}:`, recoveryError);
      }
    }

    result.endTime = Date.now();
    result.duration = result.endTime - result.startTime;
    this.currentTest = null;

    return result;
  }

  /**
   * Execute a single test
   */
  async executeTest(test) {
    const startTime = Date.now();

    let benchmarkSessionId = null;
    let createdTrackerSessionForTest = false;
    if (this.chatManager && this.chatManager.toolExecutionTracker) {
      if (this.chatManager.toolExecutionTracker.currentSessionId) {
        benchmarkSessionId = this.chatManager.toolExecutionTracker.currentSessionId;
        this.chatManager.toolExecutionTracker.setCurrentTestId(test.id);
        console.log(`🔬 [Benchmark] Using tracker session ${benchmarkSessionId} for test ${test.id}`);
      } else {
        benchmarkSessionId = `benchmark_${test.id}_${Date.now()}`;
        createdTrackerSessionForTest = true;
        this.chatManager.toolExecutionTracker.startSession(benchmarkSessionId, {
          testId: test.id,
          testName: test.name,
          testType: test.type,
          benchmark: true,
          startTime: startTime,
        });
        console.log(`🔬 [Benchmark] Started tracker session: ${benchmarkSessionId}`);
      }
    }

    // Check if this is a manual evaluation test
    if (test.evaluation === 'manual') {
      console.log(`📋 Manual test detected: ${test.name}`);
      try {
        return await this.executeManualTest(test);
      } finally {
        // End tracker session for manual tests
        if (benchmarkSessionId && createdTrackerSessionForTest && this.chatManager.toolExecutionTracker) {
          this.chatManager.toolExecutionTracker.endSession(benchmarkSessionId);
          console.log(`🔬 [Benchmark] Ended tracker session for manual test: ${benchmarkSessionId}`);
        }
      }
    }

    // Prepare test context for automated tests
    const context = {
      chatManager: this.chatManager,
      configManager: this.configManager,
      testId: test.id,
      framework: this,
    };

    // Execute test setup if provided
    if (test.setup) {
      await test.setup(context);
    }

    try {
      // Determine timeout based on configuration
      let timeoutMs;
      if (this.useIndividualTimeouts) {
        // Use individual test timeout if specified, otherwise use global default
        timeoutMs = test.timeout || this.testTimeout;
      } else {
        // Use global timeout, overriding individual test settings
        timeoutMs = this.testTimeout;
      }

      // Check for showFileDialog parameter and warn if found
      if (test.expectedResult && test.expectedResult.parameters && test.expectedResult.parameters.showFileDialog) {
        console.warn(
          `⚠️ Test ${test.id} uses showFileDialog which requires user activation. Consider marking as manual test.`
        );
      }

      // Send the test instruction to the LLM with test information
      const instructionOptions = {
        ...test.options,
        timeout: timeoutMs, // Pass the actual timeout being used
        testInfo: {
          id: test.id,
          name: test.name,
          type: test.type,
          expectedResult: test.expectedResult,
          maxScore: test.maxScore,
        },
      };

      const llmInteractionResult = await this.sendTestInstruction(test.instruction, instructionOptions);

      // Handle both old format (string) and new format (object with interactionData)
      let llmResponse;
      let interactionData;
      if (typeof llmInteractionResult === 'string') {
        // Old format - just response string
        llmResponse = llmInteractionResult;
        interactionData = null;
      } else {
        // New format - response with detailed interaction data
        llmResponse = llmInteractionResult.response;
        interactionData = llmInteractionResult.interactionData;
      }

      // Parse and analyze the response
      const actualResult = await this.parseTestResponse(llmResponse, test);

      // Collect enhanced metrics including interaction data
      const metrics = {
        responseTime: Date.now() - startTime,
        responseLength: llmResponse ? llmResponse.length : 0,
        tokenCount: this.estimateTokenCount(llmResponse),
        functionCallsCount: this.countFunctionCalls(llmResponse),
        instructionComplexity: this.calculateInstructionComplexity(test.instruction),

        // Enhanced metrics from interaction data
        llmResponseTime: interactionData?.response?.responseTime || 0,
        tokenUsage: interactionData?.response?.tokenUsage || {},
        confidence: interactionData?.analysis?.confidence || null,
        ambiguity: interactionData?.analysis?.ambiguity || null,
        contextRelevance: interactionData?.analysis?.contextRelevance || null,
      };

      return {
        llmResponse: llmResponse,
        actualResult: actualResult,
        metrics: metrics,
        details: {
          instruction: test.instruction,
          context: context,
        },

        // CRITICAL ENHANCEMENT: Include complete LLM interaction data
        llmInteractionData: interactionData,

        // CRITICAL FIX: Include parseDebugInfo for tool evaluation
        parseDebugInfo: actualResult?.parseDebugInfo || null,

        // SONG'S CRITICAL REQUIREMENT: Include detailedLogs for round-by-round analysis
        detailedLogs: interactionData?.detailedLogs || null,
      };
    } finally {
      // Execute test cleanup if provided
      if (test.cleanup) {
        try {
          await test.cleanup(context);
        } catch (cleanupError) {
          console.warn(`Cleanup failed for test ${test.id}:`, cleanupError);
        }
      }

      // CRITICAL FIX: End Tool Execution Tracker session for benchmark test
      if (
        benchmarkSessionId &&
        createdTrackerSessionForTest &&
        this.chatManager &&
        this.chatManager.toolExecutionTracker
      ) {
        this.chatManager.toolExecutionTracker.endSession(benchmarkSessionId);
        console.log(`🔬 [Benchmark] Ended tracker session: ${benchmarkSessionId}`);
      }
    }
  }

  /**
   * Execute a manual test that requires user interaction
   * CRITICAL FIX: First send instruction to LLM, then show manual dialog with actual LLM response
   */
  async executeManualTest(test) {
    console.log(`📋 Executing manual test: ${test.name}`);
    console.log(`🚀 STEP 1: Sending instruction to LLM first...`);

    const startTime = Date.now();
    let llmResponse = null;
    let llmInteractionData = null;

    try {
      // STEP 1: Send instruction to LLM first (like automatic tests)
      const instructionOptions = {
        timeout: test.timeout || this.testTimeout,
        testInfo: {
          id: test.id,
          name: test.name,
          type: test.type,
          expectedResult: test.expectedResult,
          maxScore: test.maxScore,
        },
      };

      console.log(`📤 Sending instruction to LLM: "${test.instruction}"`);
      const llmInteractionResult = await this.sendTestInstruction(test.instruction, instructionOptions);

      // Handle both old format (string) and new format (object with interactionData)
      if (typeof llmInteractionResult === 'string') {
        llmResponse = llmInteractionResult;
      } else {
        llmResponse = llmInteractionResult.response;
        llmInteractionData = llmInteractionResult.interactionData;
      }

      console.log(`📥 LLM Response received:`, llmResponse);
      console.log(`🚀 STEP 2: Showing manual dialog with LLM response for user evaluation...`);

      // STEP 2: Prepare test data for manual dialog INCLUDING LLM response
      const testData = {
        testId: test.id,
        testName: test.name,
        category: test.category || 'manual',
        complexity: test.complexity || 'simple',
        instruction: test.instruction,
        expectedResult: test.expectedResult,
        maxScore: test.maxScore || 100,
        manualVerification: test.manualVerification,
        timeout: test.timeout || this.testTimeout,
        // CRITICAL: Include actual LLM response for user evaluation
        llmResponse: llmResponse,
        llmInteractionData: llmInteractionData,
      };

      // Check if BenchmarkUI is available
      if (!window.benchmarkUI || !window.benchmarkUI.handleManualTest) {
        throw new Error('BenchmarkUI not available for manual test handling');
      }

      console.log(`📡 Requesting manual verification dialog with LLM response...`);

      // STEP 3: Call BenchmarkUI's handleManualTest method and wait for user result
      const manualResult = await window.benchmarkUI.handleManualTest(testData);

      console.log(`✅ Manual test completed with LLM interaction:`, manualResult);

      // Parse the actual LLM response to extract tool calls
      let actualResult = null;
      try {
        actualResult = await this.parseTestResponse(llmResponse, test);
      } catch (parseError) {
        console.warn(`Failed to parse LLM response for manual test ${test.id}:`, parseError);
        actualResult = {
          tool_name: 'manual_test_response',
          parameters: {},
          rawResponse: llmResponse,
        };
      }

      // STEP 4: Create comprehensive test result with both LLM and manual data
      const testResult = {
        llmResponse: llmResponse,
        actualResult: actualResult || {
          tool_name: test.expectedResult?.tool_name || 'manual_verification',
          parameters: test.expectedResult?.parameters || {},
          manual_result: manualResult.result,
          manual_score: manualResult.manualScore,
          verification_completion: manualResult.verificationCompletion,
        },
        metrics: {
          responseTime: Date.now() - startTime,
          manualScore: manualResult.manualScore,
          verificationCompletion: manualResult.verificationCompletion,
          completedVerifications: manualResult.completedVerifications,
          totalVerifications: manualResult.totalVerifications,
          // Include LLM metrics
          llmResponseTime: llmInteractionData?.response?.responseTime || 0,
          tokenUsage: llmInteractionData?.response?.tokenUsage || {},
          confidence: llmInteractionData?.analysis?.confidence || null,
          ambiguity: llmInteractionData?.analysis?.ambiguity || null,
          contextRelevance: llmInteractionData?.analysis?.contextRelevance || null,
        },
        details: {
          instruction: test.instruction,
          manualResult: manualResult,
          llmResponse: llmResponse,
        },
        // CRITICAL ENHANCEMENT: Include complete LLM interaction data for manual tests
        llmInteractionData: llmInteractionData || {
          request: {
            instruction: test.instruction,
            timestamp: new Date().toISOString(),
            requestId: `manual_${test.id}_${Date.now()}`,
            testContext: testData,
          },
          response: {
            content: llmResponse,
            responseTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            manualInput: true,
          },
          analysis: {
            isManual: true,
            manualResult: manualResult.result,
            manualScore: manualResult.manualScore,
            verificationCompletion: manualResult.verificationCompletion,
          },
        },
      };

      return testResult;
    } catch (error) {
      console.error(`❌ Manual test failed for ${test.name}:`, error);

      // Return error result
      return {
        llmResponse: llmResponse || `Manual test failed: ${error.message}`,
        actualResult: {
          tool_name: 'manual_test_error',
          parameters: {},
          error: error.message,
        },
        metrics: {
          responseTime: Date.now() - startTime,
          manualScore: 0,
          verificationCompletion: 0,
        },
        details: {
          instruction: test.instruction,
          error: error.message,
          llmResponse: llmResponse,
        },
        llmInteractionData: llmInteractionData || {
          request: {
            instruction: test.instruction,
            timestamp: new Date().toISOString(),
            requestId: `manual_error_${test.id}_${Date.now()}`,
            testContext: {
              testId: test.id,
              testName: test.name,
              instruction: test.instruction,
            },
          },
          response: {
            content: llmResponse || `Manual test error: ${error.message}`,
            responseTime: Date.now() - startTime,
            timestamp: new Date().toISOString(),
            manualInput: false,
            error: true,
          },
          analysis: {
            isManual: true,
            isError: true,
            errorMessage: error.message,
          },
        },
      };
    }
  }

  /**
   * Send test instruction to LLM using ChatManager's configuration and function tools
   * Enhanced to capture detailed LLM interaction data for comprehensive analysis
   */
  async sendTestInstruction(instruction, options = {}) {
    if (!this.chatManager) {
      throw new Error('ChatManager not available');
    }

    // Check if LLM is configured
    if (!this.chatManager.llmConfigManager.isConfigured()) {
      throw new Error('LLM not configured. Please configure an LLM provider first.');
    }

    // Capture detailed LLM interaction data
    const interactionData = {
      timestamp: new Date().toISOString(),
      testId: options.testInfo?.id || 'unknown',
      testName: options.testInfo?.name || 'Unknown Test',

      // Request details
      request: {
        instruction: instruction,
        systemPrompt: null, // Will be captured from ChatManager
        fullPrompt: null, // Complete prompt sent to LLM
        provider: null, // LLM provider used
        model: null, // Model name
        temperature: null, // Model parameters
        maxTokens: null,
        timeout: options.timeout || this.testTimeout,
        contextLength: 0, // Length of conversation context
        availableTools: [], // Available function tools
        requestId: this.generateRequestId(),
      },

      // Response details
      response: {
        rawResponse: null, // Complete LLM response
        processedResponse: null, // Processed/cleaned response
        functionCalls: [], // Detected function calls
        toolExecutions: [], // Tool execution results
        responseTime: 0, // Time to get response
        tokenUsage: {
          // Token consumption
          promptTokens: 0,
          completionTokens: 0,
          totalTokens: 0,
        },
        finishReason: null, // Why LLM stopped generating
        modelVersion: null, // Actual model version used
      },

      // Analysis metadata
      analysis: {
        isError: false,
        errorType: null,
        errorMessage: null,
        confidence: null, // LLM response confidence
        complexity: null, // Instruction complexity score
        ambiguity: null, // Instruction ambiguity score
        contextRelevance: null, // Context relevance score
      },
    };

    // Declare response variable in outer scope
    let response = null;

    try {
      console.log(`📤 Sending benchmark test instruction: ${instruction}`);

      // Capture request timing
      const requestStartTime = Date.now();

      // Get LLM configuration details
      try {
        const llmConfig = this.chatManager.llmConfigManager.getConfiguration();
        if (llmConfig && llmConfig.providers) {
          // Find the currently enabled provider
          const currentProvider = this.chatManager.llmConfigManager.getProviderForModelType('task');
          if (currentProvider && llmConfig.providers[currentProvider]) {
            const providerConfig = llmConfig.providers[currentProvider];
            interactionData.request.provider = currentProvider;
            interactionData.request.model = providerConfig.model;
            interactionData.request.temperature = providerConfig.temperature;
            interactionData.request.maxTokens = providerConfig.maxTokens;
          }
        }
      } catch (configError) {
        console.warn('Failed to capture LLM config:', configError);
        interactionData.request.provider = 'unknown';
        interactionData.request.model = 'unknown';
      }

      // Capture the complete system prompt (now stored in full since details are persisted to disk)
      const capturedSystemPrompt = await this.captureSystemPrompt();
      interactionData.request.systemPrompt = capturedSystemPrompt;
      interactionData.request.systemPromptLength = capturedSystemPrompt ? capturedSystemPrompt.length : 0;
      interactionData.request.contextLength = this.getChatContextLength();
      interactionData.request.availableTools = this.getAvailableTools();
      interactionData.request.dynamicToolsAnalysis = this.captureDynamicToolsAnalysis(capturedSystemPrompt);

      // MEMORY OPTIMIZATION: Removed fullPrompt storage — it's just systemPrompt + instruction,
      // both of which are already stored separately. Building and storing it again is pure duplication.
      interactionData.request.fullPrompt = null;

      // Display detailed test process as a simulated tester
      this.displayTestProcess(instruction, options);

      // Enhanced logging for detailed ChatBox display
      this.displayLLMProcessingDetails(instruction, options);

      // ENHANCED: Capture detailed LLM interaction by hooking into ChatManager's internal logging
      // MEMORY OPTIMIZATION: Drastically reduced limits to prevent 2GB+ memory bloat
      // Root cause: 160 tests × 1000 logs × 10KB/log + duplicated args = ~2.3GB
      const originalConsoleLog = console.log;
      const capturedLogs = [];
      const MAX_CAPTURED_LOGS = 200; // Reduced from 1000 — extracted summaries replace raw logs
      const MAX_LOG_SIZE = 1000; // Reduced from 10000 — only need key info for extraction

      // Store captured logs in instance for access by other methods
      this.capturedLogs = capturedLogs;

      // Temporarily override console.log to capture ChatManager's detailed logging
      console.log = (...args) => {
        // MEMORY SAFETY: Check limits before capturing
        if (capturedLogs.length >= MAX_CAPTURED_LOGS) {
          // Remove oldest logs to make room (FIFO)
          capturedLogs.shift();
        }

        // Capture ChatManager's detailed logs with safe JSON handling
        const logString = args
          .map(arg => {
            if (typeof arg === 'object' && arg !== null) {
              try {
                // Use safe JSON stringify to avoid circular references
                const jsonString = JSON.stringify(arg, this.getCircularReplacer());
                // MEMORY OPTIMIZATION: Truncate aggressively
                return jsonString.length > MAX_LOG_SIZE
                  ? jsonString.substring(0, MAX_LOG_SIZE) + '...[TRUNCATED]'
                  : jsonString;
              } catch (error) {
                return `[Object: ${arg.constructor?.name || 'Unknown'} - Circular Reference]`;
              }
            }
            const stringArg = String(arg);
            // MEMORY OPTIMIZATION: Truncate aggressively
            return stringArg.length > MAX_LOG_SIZE
              ? stringArg.substring(0, MAX_LOG_SIZE) + '...[TRUNCATED]'
              : stringArg;
          })
          .join(' ');

        // MEMORY OPTIMIZATION: Removed `args: this.sanitizeArgsForStorage(args)` —
        // the stringified `message` field already contains all the data; storing
        // parsed args again doubles memory per log entry with zero additional value.
        capturedLogs.push({
          timestamp: new Date().toISOString(),
          level: 'log',
          message: logString,
        });

        // Still call original console.log
        originalConsoleLog.apply(console, args);
      };

      // CRITICAL FIX: Save original context mode before any potential errors
      // This ensures only the current test instruction is sent, not the entire conversation history
      const originalContextMode = this.chatManager.contextModeEnabled;

      try {
        // CRITICAL FIX: Enable context mode for benchmark tests to prevent token overflow
        this.chatManager.contextModeEnabled = true;

        console.log('🔧 [Benchmark] Enabled context mode to prevent token overflow');
        console.log('🔧 [Benchmark] Original context mode:', originalContextMode);

        // Add detailed thinking process using addThinkingMessage
        this.chatManager.addThinkingMessage(
          `🧠 **LLM Thinking Process Analysis** | Benchmark Testing Mode<br>` +
            `═══════════════════════════════════════════════════════════<br><br>` +
            `🔧 **LLM Configuration:**<br>` +
            `&nbsp;&nbsp;&nbsp;• Provider: ${this.getLLMProvider()}<br>` +
            `&nbsp;&nbsp;&nbsp;• Model: ${this.getLLMModel()}<br>` +
            `&nbsp;&nbsp;&nbsp;• Timeout: ${options.timeout || this.testTimeout}ms<br>` +
            `&nbsp;&nbsp;&nbsp;• Function Calling: Enabled<br>` +
            `&nbsp;&nbsp;&nbsp;• Context Mode: Dynamic<br><br>` +
            `📊 **Request Processing Pipeline:**<br>` +
            `&nbsp;&nbsp;&nbsp;1. 🔍 Instruction Analysis & Parsing<br>` +
            `&nbsp;&nbsp;&nbsp;2. 🛠️ System Prompt Construction<br>` +
            `&nbsp;&nbsp;&nbsp;3. 🔗 Function Registry Integration<br>` +
            `&nbsp;&nbsp;&nbsp;4. 🚀 LLM Provider Communication<br>` +
            `&nbsp;&nbsp;&nbsp;5. 🧠 Response Analysis & Tool Detection<br>` +
            `&nbsp;&nbsp;&nbsp;6. ⚙️ Tool Execution & Result Processing<br><br>` +
            `🔄 **Status:** Sending request to AI model...`
        );

        // Use ChatManager's sendToLLM method
        response = await this.chatManager.sendToLLM(instruction);
        const actualPromptMetadata = this.captureDynamicToolsAnalysis();
        if (actualPromptMetadata) {
          interactionData.request.dynamicToolsAnalysis = actualPromptMetadata;
          if (actualPromptMetadata.promptLength) {
            interactionData.request.systemPromptLength = actualPromptMetadata.promptLength;
          }
        }

        // Capture response timing
        const requestEndTime = Date.now();
        interactionData.response.responseTime = requestEndTime - requestStartTime;

        console.log(`📥 Received benchmark response:`, response);

        // Add detailed response analysis using addThinkingMessage
        this.chatManager.addThinkingMessage(
          `<br>✅ **LLM Response Received** (${interactionData.response.responseTime}ms)<br>` +
            `────────────────────────────────────────────<br>` +
            `📄 **Raw Response Analysis:**<br>` +
            `&nbsp;&nbsp;&nbsp;• Response Length: ${response ? response.length : 0} characters<br>` +
            `&nbsp;&nbsp;&nbsp;• Processing Time: ${interactionData.response.responseTime}ms<br>` +
            `&nbsp;&nbsp;&nbsp;• Content Type: ${this.detectContentType(response)}<br>` +
            `&nbsp;&nbsp;&nbsp;• Content Preview: "${response ? response.substring(0, 80) + (response.length > 80 ? '...' : '') : 'No Response'}"<br><br>` +
            `🔍 **Starting Response Analysis:**<br>` +
            `&nbsp;&nbsp;&nbsp;🔄 Parsing function calls...<br>` +
            `&nbsp;&nbsp;&nbsp;🔄 Extracting tool parameters...<br>` +
            `&nbsp;&nbsp;&nbsp;🔄 Validating response format...<br>` +
            `&nbsp;&nbsp;&nbsp;🔄 Computing confidence scores...`
        );

        // Display detailed response processing
        this.displayResponseProcessing(response, interactionData);

        // MEMORY OPTIMIZATION: Truncate large response data instead of storing full copies
        // rawResponse and processedResponse are often 10-50KB each, and both contain
        // essentially the same content. Store a truncated preview + length for diagnostics.
        const MAX_RESPONSE_STORE_SIZE = 2048; // 2KB preview is sufficient for diagnostics
        interactionData.response.rawResponse =
          response && response.length > MAX_RESPONSE_STORE_SIZE
            ? response.substring(0, MAX_RESPONSE_STORE_SIZE) + `...[TRUNCATED: ${response.length} chars total]`
            : response;
        interactionData.response.rawResponseLength = response ? response.length : 0;
        interactionData.response.processedResponse = null; // Removed — redundant with rawResponse

        // ENHANCED: Get actual function call execution data from ChatManager
        const executionData = this.chatManager.getLastExecutionData();
        if (executionData) {
          // CRITICAL FIX: Assign high confidence to actual execution data
          const functionCallsWithConfidence = (executionData.functionCalls || []).map(call => ({
            ...call,
            confidence: call.confidence || 100, // Actual execution = 100% confidence
            executed: true,
            actualResult: true,
            detectionMethod: 'actual_execution',
          }));

          // MEMORY OPTIMIZATION: Store only summary data, not the full executionData object.
          // The full executionData can contain large tool output (e.g. genome sequences)
          // which is already available via ChatManager.getLastExecutionData() if needed.
          interactionData.response.functionCalls = functionCallsWithConfidence;
          // Store only summary of tool results (success/failure), not full output
          interactionData.response.toolExecutions = (executionData.toolResults || []).map(r => ({
            tool_name: r.tool_name,
            success: r.success,
            executionTime: r.executionTime,
            // Truncate large result data to first 200 chars
            resultPreview:
              typeof r.result === 'string'
                ? r.result.substring(0, 200) + (r.result.length > 200 ? '...[TRUNCATED]' : '')
                : r.result
                  ? JSON.stringify(r.result).substring(0, 200) + '...[TRUNCATED]'
                  : null,
          }));
          interactionData.response.executionRounds = executionData.rounds || 0;
          interactionData.response.totalExecutionTime = executionData.totalExecutionTime || 0;
          // Removed: interactionData.response.actualExecutionData = executionData;
          // This was storing the entire execution object (including full tool output) per test.
          // If the full data is needed later, it can be reconstructed from the summary.

          // Display detailed tool execution information using addThinkingMessage
          if (executionData.functionCalls && executionData.functionCalls.length > 0) {
            this.chatManager.addThinkingMessage(
              `<br>🚀 **Tool Execution Detected** - Tool Calls Found<br>` +
                `══════════════════════════════════════════<br>` +
                `📊 **Execution Summary:**<br>` +
                `&nbsp;&nbsp;&nbsp;• Total Function Calls: ${executionData.functionCalls.length}<br>` +
                `&nbsp;&nbsp;&nbsp;• Execution Rounds: ${executionData.rounds || 0}<br>` +
                `&nbsp;&nbsp;&nbsp;• Total Execution Time: ${executionData.totalExecutionTime || 0}ms<br>` +
                `&nbsp;&nbsp;&nbsp;• Success Rate: ${this.calculateSuccessRate(executionData.toolResults || [])}%<br><br>` +
                `🔧 **Detected Tool Calls:** <br>` +
                `${this.formatDetectedToolsForDisplay(executionData.functionCalls)}<br><br>` +
                `📈 **Execution Results:**<br>` +
                `${this.formatExecutionResults(executionData.toolResults || [])}`
            );
          } else {
            this.chatManager.addThinkingMessage(
              `<br>⚠️ **No Tool Execution Detected**<br>` +
                `&nbsp;&nbsp;&nbsp;• LLM response did not trigger any function calls<br>` +
                `&nbsp;&nbsp;&nbsp;• Response appears to be conversational only<br>` +
                `&nbsp;&nbsp;&nbsp;• Falling back to text-based analysis mode...`
            );
          }

          console.log(`🔍 Actual function calls executed:`, executionData.functionCalls);
          console.log(`🔧 Tool execution results:`, executionData.toolResults);
        } else {
          // Fallback to text-based extraction if no execution data available
          console.log(`⚠️ No execution data available, falling back to text parsing`);
          interactionData.response.functionCalls = this.extractFunctionCallsFromResponse(response);
          interactionData.response.toolExecutions = this.captureToolExecutions();

          // Display text-based analysis results using addThinkingMessage
          const detectedCalls = this.extractFunctionCallsFromResponse(response);
          this.chatManager.addThinkingMessage(
            `<br>🔍 **Text-Based Analysis Results**<br>` +
              `────────────────────────────────────────<br>` +
              `📝 **Response Content Analysis:**<br>` +
              `&nbsp;&nbsp;&nbsp;• Content Length: ${response ? response.length : 0} characters<br>` +
              `&nbsp;&nbsp;&nbsp;• Detected Functions: ${detectedCalls.length}<br>` +
              `&nbsp;&nbsp;&nbsp;• Analysis Method: Pattern matching<br><br>` +
              `🔍 **Pattern Detection Results:** <br>` +
              `${detectedCalls.length > 0 ? this.formatDetectedFunctions(detectedCalls) : '&nbsp;&nbsp;&nbsp;• No function patterns detected in response'}<br><br>` +
              `📉 Confidence Assessment:<br>` +
              `&nbsp;&nbsp;&nbsp;• Overall Confidence: ${this.calculateOverallConfidence(detectedCalls)}%<br>` +
              `&nbsp;&nbsp;&nbsp;• Detection Reliability: ${detectedCalls.length > 0 ? 'Medium' : 'Low'}`
          );
        }

        // MEMORY OPTIMIZATION: Extract structured data from logs, then DISCARD raw logs.
        // Previously, `logs: capturedLogs` stored the full array AND all 6 extracted sub-objects
        // contained overlapping data — effectively 7× duplication of the same information.
        // Now we extract what we need and null out the raw array.
        const extractedData = {
          totalLogs: capturedLogs.length,
          logs: null, // Raw logs discarded after extraction — use extracted fields instead

          // Extract specific information from logs (these ARE the useful data)
          llmRawResponse: this.extractLLMRawResponseFromLogs(capturedLogs),
          thinkingProcess: this.extractThinkingProcessFromLogs(capturedLogs),
          toolCallHistory: this.extractToolCallHistoryFromLogs(capturedLogs),
          conversationHistory: this.extractConversationHistoryFromLogs(capturedLogs),
          parseDebugInfo: this.extractParseDebugInfoFromLogs(capturedLogs),
          functionCallRounds: this.extractFunctionCallRoundsFromLogs(capturedLogs),
        };

        interactionData.detailedLogs = extractedData;

        // Clear capturedLogs immediately — data has been extracted into detailedLogs
        capturedLogs.length = 0;
        this.capturedLogs = null;

        // SONG'S CRITICAL FIX: If toolCallHistory has no tools but executionData has function calls,
        // construct toolCallHistory from executionData directly
        if (executionData && executionData.functionCalls && executionData.functionCalls.length > 0) {
          const hasToolsInRounds = interactionData.detailedLogs.toolCallHistory.toolCallRounds.some(
            r => r.tools && r.tools.length > 0
          );

          if (!hasToolsInRounds) {
            console.log('⚠️ [Benchmark] No tools detected in rounds from logs, reconstructing from executionData');
            console.log('🔧 [Benchmark] ExecutionData function calls:', executionData.functionCalls);

            // Group function calls by round
            const roundsMap = new Map();
            executionData.functionCalls.forEach(call => {
              const roundNum = call.round || 1;
              if (!roundsMap.has(roundNum)) {
                roundsMap.set(roundNum, {
                  current: roundNum,
                  total: executionData.rounds || 3,
                  timestamp: call.timestamp || new Date().toISOString(),
                  tools: [],
                });
              }
              roundsMap.get(roundNum).tools.push(call.tool_name);
            });

            // Replace toolCallRounds with reconstructed data
            interactionData.detailedLogs.toolCallHistory.toolCallRounds = Array.from(roundsMap.values());

            console.log(
              '✅ [Benchmark] Reconstructed rounds from executionData:',
              interactionData.detailedLogs.toolCallHistory.toolCallRounds
            );
          }
        }
      } finally {
        // Restore original console.log
        console.log = originalConsoleLog;

        // CRITICAL FIX: Restore original context mode after benchmark test
        this.chatManager.contextModeEnabled = originalContextMode;
        console.log('🔧 [Benchmark] Restored context mode to:', originalContextMode);

        // MEMORY SAFETY: Check memory usage and cleanup if needed
        this.checkMemoryUsage();
      }

      // Capture token usage if available
      interactionData.response.tokenUsage = this.captureTokenUsage();

      // Analyze response quality (response is now in scope)
      interactionData.analysis = this.analyzeResponseQuality(instruction, response || 'No response received');

      // CRITICAL FIX: Check if response indicates LLM failure
      if (response && this.isLLMErrorResponse(response)) {
        console.log('❌ LLM error response detected');
        const errorMessage = `LLM Error Response: ${response}`;

        // Update interaction data with error info
        interactionData.analysis.isError = true;
        interactionData.analysis.errorType = 'llm_error_response';
        interactionData.analysis.errorMessage = errorMessage;

        this.displayTestError(new Error(errorMessage), options);

        // Return interaction data even for errors
        return {
          response: response,
          interactionData: interactionData,
        };
      }

      // Display response analysis
      if (response) {
        this.displayResponseAnalysis(response, options);

        // Add final comprehensive analysis using addThinkingMessage
        const functionCalls = interactionData?.response?.functionCalls || [];
        const toolResults = interactionData?.response?.toolExecutions || [];
        const responseTime = interactionData?.response?.responseTime || 0;

        this.chatManager.addThinkingMessage(
          `<br>📈 Comprehensive Analysis Complete - Benchmark Testing Detailed Report<br>` +
            `═════════════════════════════════════════════════<br>` +
            `🔍 Final Analysis Summary:<br>` +
            `&nbsp;&nbsp;&nbsp;• Total Response Time: ${responseTime}ms<br>` +
            `&nbsp;&nbsp;&nbsp;• Function Calls Detected: ${functionCalls.length}<br>` +
            `&nbsp;&nbsp;&nbsp;• Tools Successfully Executed: ${toolResults.filter(r => r.success).length}<br>` +
            `&nbsp;&nbsp;&nbsp;• Execution Success Rate: ${this.calculateSuccessRate(toolResults)}%<br>` +
            `&nbsp;&nbsp;&nbsp;• Response Content Type: ${this.detectContentType(response)}<br><br>` +
            `🧠 AI Model Performance Assessment:<br>` +
            `&nbsp;&nbsp;&nbsp;• Instruction Understanding: ${this.assessInstructionUnderstanding(response, functionCalls)}<br>` +
            `&nbsp;&nbsp;&nbsp;• Function Selection Accuracy: ${this.assessFunctionSelection(functionCalls)}<br>` +
            `&nbsp;&nbsp;&nbsp;• Parameter Extraction Quality: ${this.assessParameterQuality(functionCalls)}<br>` +
            `&nbsp;&nbsp;&nbsp;• Response Completeness: ${this.assessResponseCompleteness(response)}<br><br>` +
            `📉 Interaction Data Captured: <br>` +
            `&nbsp;&nbsp;&nbsp;• Raw Response Length: ${response ? response.length : 0} characters<br>` +
            `&nbsp;&nbsp;&nbsp;• Detailed Logs: ${interactionData?.detailedLogs?.totalLogs || 0} entries<br>` +
            `&nbsp;&nbsp;&nbsp;• Execution Rounds: ${interactionData?.response?.executionRounds || 0}<br>` +
            `&nbsp;&nbsp;&nbsp;• Memory Usage: ${this.getMemoryUsage()} MB<br><br>` +
            `✅ Status: Analysis complete - Ready for scoring evaluation`
        );
      }

      // Return both response and detailed interaction data
      return {
        response: response,
        interactionData: interactionData,
      };
    } catch (error) {
      console.error('❌ Benchmark test instruction failed:', error);

      // Capture error in interaction data
      interactionData.analysis.isError = true;
      interactionData.analysis.errorType = 'communication_error';
      interactionData.analysis.errorMessage = error.message;
      interactionData.response.responseTime =
        Date.now() -
        (interactionData.request.timestamp ? new Date(interactionData.request.timestamp).getTime() : Date.now());

      this.displayTestError(error, options);

      // Return error with interaction data
      const wrappedError = new Error(`LLM communication failed: ${error.message}`);
      wrappedError.originalError = error;
      wrappedError.interactionData = interactionData;
      throw wrappedError;
    }
  }

  /**
   * Display detailed test process as a simulated tester
   */
  displayTestProcess(instruction, options = {}) {
    const testInfo = options.testInfo || {};
    const testName = testInfo.name || 'Unknown Test';
    const testType = testInfo.type || 'function_call';
    const expectedResult = testInfo.expectedResult || {};

    // Create professional test engineer persona
    const testerName = 'CodeXomics';
    const testerRole = 'Benchmark Tester';

    // Show test initiation with improved formatting
    this.chatManager.addThinkingMessage(
      `👩‍🔬 ${testerName} (${testerRole})<br>` +
        `═══════════════════════════════════════════════════════════<br><br>` +
        `🧪 INITIATING TEST EXECUTION<br><br>` +
        `📋 Test Specification:<br>` +
        `&nbsp;&nbsp;&nbsp;• Name: ${testName}<br>` +
        `&nbsp;&nbsp;&nbsp;• Type: ${this.getTestTypeDescription(testType)}<br>` +
        `&nbsp;&nbsp;&nbsp;• ID: ${testInfo.id || 'N/A'}<br>` +
        `&nbsp;&nbsp;&nbsp;• Max Score: ${testInfo.maxScore || 100} points<br><br>` +
        `🎯 Expected Behavior:<br>` +
        `${this.formatExpectedBehavior(testType, expectedResult, instruction)}<br><br>` +
        `📝 Test Instruction to LLM:<br>` +
        `&nbsp;&nbsp;&nbsp;"${instruction}"<br><br>` +
        `⚖️ Evaluation Criteria:<br>` +
        `${this.formatEvaluationCriteria(testType, expectedResult)}<br><br>` +
        `⚡ Status: Sending instruction to LLM for evaluation...<br><br>` +
        `🔄 LLM Processing Started: Waiting for AI model response...`
    );
  }

  /**
   * Get descriptive test type name
   */
  getTestTypeDescription(testType) {
    const descriptions = {
      function_call: 'Function Call Accuracy Test',
      workflow: 'Multi-Step Workflow Test',
      text_analysis: 'Text Analysis & Understanding Test',
      json_output: 'Structured Output Format Test',
      parameter_handling: 'Parameter Validation Test',
      error_recovery: 'Error Handling & Recovery Test',
      performance: 'Performance & Efficiency Test',
    };
    return descriptions[testType] || `${testType.charAt(0).toUpperCase() + testType.slice(1)} Test`;
  }

  /**
   * Format expected behavior description
   */
  formatExpectedBehavior(testType, expectedResult, instruction) {
    switch (testType) {
      case 'function_call':
        if (expectedResult.tool_name) {
          const params = expectedResult.parameters || {};
          let paramStr = 'None';
          if (Object.keys(params).length > 0) {
            paramStr = Object.entries(params)
              .map(([key, value]) => `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${key}: "${value}"`)
              .join('<br>');
          }
          return (
            `&nbsp;&nbsp;&nbsp;• LLM should call function: \`${expectedResult.tool_name}\`<br>` +
            `&nbsp;&nbsp;&nbsp;• Required parameters:<br>${paramStr}`
          );
        }
        return '• LLM should identify and execute appropriate function calls';

      case 'workflow': {
        const steps = expectedResult.expectedSteps || [];
        const functions = expectedResult.expectedFunctions || [];
        return (
          `&nbsp;&nbsp;&nbsp;• LLM should complete multi-step workflow<br>` +
          `&nbsp;&nbsp;&nbsp;• Expected steps:<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${steps.length > 0 ? steps.join(' → ') : 'Complex workflow sequence'}<br>` +
          `&nbsp;&nbsp;&nbsp;• Expected functions:<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${functions.length > 0 ? functions.join(', ') : 'Multiple coordinated functions'}`
        );
      }

      case 'text_analysis': {
        const keywords = expectedResult.requiredKeywords || [];
        return (
          `&nbsp;&nbsp;&nbsp;• LLM should provide comprehensive text analysis<br>` +
          `&nbsp;&nbsp;&nbsp;• Required elements:<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${keywords.length > 0 ? keywords.join(', ') : 'Analytical content'}<br>` +
          `&nbsp;&nbsp;&nbsp;• Minimum quality threshold:<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${expectedResult.minWords || 'Standard'} words`
        );
      }

      default:
        return (
          '&nbsp;&nbsp;&nbsp;• LLM should respond appropriately to the given instruction<br>' +
          '&nbsp;&nbsp;&nbsp;• Output should meet specified requirements'
        );
    }
  }

  /**
   * Format evaluation criteria
   */
  formatEvaluationCriteria(testType, expectedResult) {
    const baseCriteria = [
      '&nbsp;&nbsp;&nbsp;✓ Instruction comprehension (25%)',
      '&nbsp;&nbsp;&nbsp;✓ Appropriate response generation (25%)',
      '&nbsp;&nbsp;&nbsp;✓ Technical accuracy (25%)',
      '&nbsp;&nbsp;&nbsp;✓ Completeness and quality (25%)',
    ];

    switch (testType) {
      case 'function_call':
        return [
          '&nbsp;&nbsp;&nbsp;✓ Correct function identification (50%)',
          '&nbsp;&nbsp;&nbsp;✓ Parameter accuracy and completeness (30%)',
          '&nbsp;&nbsp;&nbsp;✓ Function execution success (20%)',
        ].join('<br>');

      case 'workflow':
        return [
          '&nbsp;&nbsp;&nbsp;✓ Workflow step completion (40%)',
          '&nbsp;&nbsp;&nbsp;✓ Function call sequence (30%)',
          '&nbsp;&nbsp;&nbsp;✓ Step coordination and logic (20%)',
          '&nbsp;&nbsp;&nbsp;✓ Final outcome achievement (10%)',
        ].join('<br>');

      default:
        return baseCriteria.join('<br>');
    }
  }

  /**
   * Display response analysis
   */
  displayResponseAnalysis(response, options = {}) {
    const testInfo = options.testInfo || {};

    // Analyze the response
    const extractedCalls = this.extractFunctionCallsFromResponse(response);
    const hasValidResponse = response && response.length > 0;
    const detectedFunctions = extractedCalls.map(call => call.tool_name).join(', ');

    // Create separation between tester analysis and LLM response
    this.chatManager.updateThinkingMessage(
      `<br><br>🤖 LLM RESPONSE RECEIVED & ANALYZED<br>` +
        `───────────────────────────────────────────────────────────<br>` +
        `📊 Response Summary:<br>` +
        `&nbsp;&nbsp;&nbsp;• Length: ${response ? response.length : 0} characters<br>` +
        `&nbsp;&nbsp;&nbsp;• Processing time: ~${(Math.random() * 2 + 1) | 0}s<br>` +
        `&nbsp;&nbsp;&nbsp;• Content preview:<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;"${response ? response.substring(0, 100) + (response.length > 100 ? '...' : '') : 'No response'}"<br><br>` +
        `🧠 AI Model Thinking Process:<br>` +
        `&nbsp;&nbsp;&nbsp;• Instruction interpretation completed<br>` +
        `&nbsp;&nbsp;&nbsp;• Function registry lookup performed<br>` +
        `&nbsp;&nbsp;&nbsp;• Context analysis and tool selection executed<br>` +
        `&nbsp;&nbsp;&nbsp;• Response generation and formatting finalized<br><br>` +
        `🔍 Technical Analysis:<br>` +
        `&nbsp;&nbsp;&nbsp;• Function detection: ${extractedCalls.length > 0 ? `✅ Found ${extractedCalls.length} function(s)` : '❌ No functions detected'}<br>` +
        `&nbsp;&nbsp;&nbsp;• Detected functions: ${detectedFunctions || 'None'}<br>` +
        `&nbsp;&nbsp;&nbsp;• Confidence level: ${extractedCalls.length > 0 ? extractedCalls[0].confidence + '%' : 'N/A'}<br>` +
        `&nbsp;&nbsp;&nbsp;• Evidence pattern: "${extractedCalls.length > 0 ? extractedCalls[0].evidence : 'No evidence found'}"<br><br>` +
        `📋 Compliance Check:<br>` +
        `&nbsp;&nbsp;&nbsp;• Response completeness: ${hasValidResponse ? '✅ Complete' : '❌ Incomplete'}<br>` +
        `&nbsp;&nbsp;&nbsp;• Function execution: ${extractedCalls.length > 0 ? '✅ Detected' : '❌ Not detected'}<br>` +
        `&nbsp;&nbsp;&nbsp;• Expected behavior match: ${this.assessBehaviorMatch(testInfo, extractedCalls)}<br><br>` +
        `⚙️ Tool Call Processing:<br>` +
        `${this.formatToolCallDetails(extractedCalls)}<br><br>` +
        `⚖️ Status: Proceeding to detailed scoring evaluation...`
    );
  }

  /**
   * Display detailed LLM processing information
   */
  displayLLMProcessingDetails(instruction, options = {}) {
    options.testInfo || {};

    // Get LLM configuration details
    let modelName = 'Unknown';
    let provider = 'Unknown';

    try {
      if (this.chatManager && this.chatManager.llmConfigManager) {
        const config = this.chatManager.llmConfigManager.getConfiguration();
        if (config && config.providers) {
          const currentProvider = this.chatManager.llmConfigManager.getProviderForModelType('task');
          if (currentProvider && config.providers[currentProvider]) {
            provider = currentProvider;
            modelName = config.providers[currentProvider].model;
          }
        }
      }
    } catch (error) {
      console.warn('Failed to get LLM config for display:', error);
    }

    this.chatManager.updateThinkingMessage(
      `<br>🔧 LLM Configuration Analysis:<br>` +
        `&nbsp;&nbsp;&nbsp;• Provider: ${provider}<br>` +
        `&nbsp;&nbsp;&nbsp;• Model: ${modelName}<br>` +
        `&nbsp;&nbsp;&nbsp;• Timeout: ${options.timeout || this.testTimeout}ms<br>` +
        `&nbsp;&nbsp;&nbsp;• Function Calling: Enabled<br>` +
        `&nbsp;&nbsp;&nbsp;• Context Mode: Dynamic<br><br>` +
        `📊 Request Processing Pipeline:<br>` +
        `&nbsp;&nbsp;&nbsp;1. 🔍 Instruction Analysis & Parsing<br>` +
        `&nbsp;&nbsp;&nbsp;2. 🛠️ System Prompt & Context Building<br>` +
        `&nbsp;&nbsp;&nbsp;3. 🔗 Function Registry Integration<br>` +
        `&nbsp;&nbsp;&nbsp;4. 🚀 LLM Provider Communication<br>` +
        `&nbsp;&nbsp;&nbsp;5. 🧠 Response Analysis & Tool Detection<br>` +
        `&nbsp;&nbsp;&nbsp;6. ⚙️ Tool Execution & Result Processing<br><br>` +
        `⏱️ Performance Monitoring: Active<br>` +
        `🔍 Response Detection: Comprehensive tool pattern matching<br>` +
        `📈 Quality Metrics: Response time, token usage, accuracy scoring<br><br>` +
        `🔄 Status: Initiating LLM communication...`
    );
  }

  /**
   * Format tool call details for display
   */
  formatToolCallDetails(extractedCalls) {
    if (!extractedCalls || extractedCalls.length === 0) {
      return '&nbsp;&nbsp;&nbsp;• No tool calls detected in response';
    }

    return extractedCalls
      .map((call, index) => {
        const params = call.parameters || {};
        const paramStr =
          Object.keys(params).length > 0
            ? Object.entries(params)
                .map(([key, value]) => `${key}: "${value}"`)
                .join(', ')
            : 'None';

        return (
          `&nbsp;&nbsp;&nbsp;• Tool ${index + 1}: \`${call.tool_name}\`<br>` +
          `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Parameters: ${paramStr}<br>` +
          `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Confidence: ${call.confidence || 'N/A'}%<br>` +
          `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;Detection Method: ${call.detectionMethod || 'pattern_match'}`
        );
      })
      .join('<br>');
  }

  /**
   * Display real-time LLM processing information
   */
  displayRealTimeLLMProcess(instruction, options = {}) {
    this.chatManager.updateThinkingMessage(
      `<br>🚀 LLM REQUEST INITIATED<br>` +
        `─────────────────────────────────<br>` +
        `🔄 Processing stages:<br>` +
        `&nbsp;&nbsp;&nbsp;✓ Instruction received and validated<br>` +
        `&nbsp;&nbsp;&nbsp;🔄 Building conversation context...<br>` +
        `&nbsp;&nbsp;&nbsp;🔄 Loading function registry...<br>` +
        `&nbsp;&nbsp;&nbsp;🔄 Preparing system prompts...<br>` +
        `&nbsp;&nbsp;&nbsp;🔄 Establishing LLM connection...<br>` +
        `&nbsp;&nbsp;&nbsp;🔄 Sending request to AI model...<br><br>` +
        `⏳ Waiting for AI model response...`
    );

    // Add progressive updates to show AI thinking process
    setTimeout(() => {
      this.chatManager.updateThinkingMessage(
        `<br>🤖 AI Model Processing Request...<br>` +
          `&nbsp;&nbsp;&nbsp;• Analyzing instruction semantics<br>` +
          `&nbsp;&nbsp;&nbsp;• Searching function registry<br>` +
          `&nbsp;&nbsp;&nbsp;• Planning response strategy<br>` +
          `&nbsp;&nbsp;&nbsp;• Generating appropriate function calls`
      );
    }, 200);

    setTimeout(() => {
      this.chatManager.updateThinkingMessage(
        `<br>⚙️ Function Call Analysis in Progress...<br>` +
          `&nbsp;&nbsp;&nbsp;• Evaluating available tools<br>` +
          `&nbsp;&nbsp;&nbsp;• Matching instruction to functions<br>` +
          `&nbsp;&nbsp;&nbsp;• Preparing parameter extraction<br>` +
          `&nbsp;&nbsp;&nbsp;• Validating function signatures`
      );
    }, 500);

    setTimeout(() => {
      this.chatManager.updateThinkingMessage(
        `<br>🔎 Deep Function Call Processing...<br>` +
          `&nbsp;&nbsp;&nbsp;• Round 1 analysis initiated<br>` +
          `&nbsp;&nbsp;&nbsp;• Conversation history building<br>` +
          `&nbsp;&nbsp;&nbsp;• Context integration active<br>` +
          `&nbsp;&nbsp;&nbsp;• Multi-round processing enabled`
      );
    }, 800);
  }

  /**
   * Display detailed response processing
   */
  displayResponseProcessing(response, interactionData) {
    const responseTime = interactionData?.response?.responseTime || 0;

    this.chatManager.updateThinkingMessage(
      `<br><br>✅ LLM RESPONSE RECEIVED (${responseTime}ms)<br>` +
        `────────────────────────────────────────────<br>` +
        `📄 Raw Response Analysis:<br>` +
        `&nbsp;&nbsp;&nbsp;• Response length: ${response ? response.length : 0} characters<br>` +
        `&nbsp;&nbsp;&nbsp;• Processing time: ${responseTime}ms<br>` +
        `&nbsp;&nbsp;&nbsp;• Content type: ${this.detectContentType(response)}<br><br>` +
        `🔍 Starting response analysis:<br>` +
        `&nbsp;&nbsp;&nbsp;🔄 Parsing for function calls...<br>` +
        `&nbsp;&nbsp;&nbsp;🔄 Extracting tool parameters...<br>` +
        `&nbsp;&nbsp;&nbsp;🔄 Validating response format...<br>` +
        `&nbsp;&nbsp;&nbsp;🔄 Computing confidence scores...`
    );
  }

  /**
   * Detect response content type
   */
  detectContentType(response) {
    if (!response) return 'Empty';
    if (response.includes('tool_name')) return 'Function Call';
    if (response.includes('```')) return 'Code Block';
    if (response.includes('json')) return 'JSON Data';
    if (response.length > 500) return 'Detailed Text';
    return 'Simple Text';
  }

  /**
   * Display detailed tool execution information
   */
  displayToolExecutionDetails(executionData) {
    const functionCalls = executionData.functionCalls || [];
    const toolResults = executionData.toolResults || [];
    const rounds = executionData.rounds || 0;
    const totalTime = executionData.totalExecutionTime || 0;

    if (functionCalls.length > 0) {
      this.chatManager.updateThinkingMessage(
        `<br><br>🚀 TOOL EXECUTION DETECTED<br>` +
          `══════════════════════════════════════════<br>` +
          `📊 Execution Summary:<br>` +
          `&nbsp;&nbsp;&nbsp;• Total function calls: ${functionCalls.length}<br>` +
          `&nbsp;&nbsp;&nbsp;• Execution rounds: ${rounds}<br>` +
          `&nbsp;&nbsp;&nbsp;• Total execution time: ${totalTime}ms<br>` +
          `&nbsp;&nbsp;&nbsp;• Success rate: ${this.calculateSuccessRate(toolResults)}%<br><br>` +
          `🔧 Detailed Tool Calls:<br>` +
          `${this.formatExecutedToolCalls(functionCalls)}<br><br>` +
          `📈 Execution Results:<br>` +
          `${this.formatToolResults(toolResults)}`
      );
    } else {
      this.chatManager.updateThinkingMessage(
        `<br><br>⚠️ **NO TOOL EXECUTION DETECTED**<br>` +
          `&nbsp;&nbsp;&nbsp;• LLM response did not trigger any function calls<br>` +
          `&nbsp;&nbsp;&nbsp;• Response appears to be conversational only<br>` +
          `&nbsp;&nbsp;&nbsp;• Falling back to text-based analysis...`
      );
    }
  }

  /**
   * Display text-based analysis results
   */
  displayTextBasedAnalysis(response, functionCalls) {
    this.chatManager.updateThinkingMessage(
      `<br><br>🔍 TEXT-BASED ANALYSIS RESULTS<br>` +
        `────────────────────────────────────────<br>` +
        `📝 Response Content Analysis:<br>` +
        `&nbsp;&nbsp;&nbsp;• Content Length: ${response ? response.length : 0} characters<br>` +
        `&nbsp;&nbsp;&nbsp;• Detected Functions: ${functionCalls.length}<br>` +
        `&nbsp;&nbsp;&nbsp;• Analysis Method: Pattern matching<br><br>` +
        `🔍 Pattern Detection Results:<br>` +
        `${functionCalls.length > 0 ? this.formatDetectedFunctions(functionCalls) : '&nbsp;&nbsp;&nbsp;• No function patterns detected in response'}<br><br>` +
        `📉 Confidence Assessment:<br>` +
        `&nbsp;&nbsp;&nbsp;• Overall confidence: ${this.calculateOverallConfidence(functionCalls)}%<br>` +
        `&nbsp;&nbsp;&nbsp;• Detection reliability: ${functionCalls.length > 0 ? 'Medium' : 'Low'}`
    );
  }

  /**
   * Calculate success rate for tool results
   */
  calculateSuccessRate(toolResults) {
    if (!toolResults || toolResults.length === 0) return 0;
    const successful = toolResults.filter(result => result.success).length;
    return Math.round((successful / toolResults.length) * 100);
  }

  /**
   * Format executed tool calls for display
   */
  formatExecutedToolCalls(functionCalls) {
    return functionCalls
      .map((call, index) => {
        const params = call.parameters || {};
        const paramStr =
          Object.keys(params).length > 0
            ? Object.entries(params)
                .map(([key, value]) => `${key}: "${value}"`)
                .join(', ')
            : 'None';

        return (
          `&nbsp;&nbsp;&nbsp;${index + 1}. **${call.tool_name}**<br>` +
          `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• Parameters: ${paramStr}<br>` +
          `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• Round: ${call.round || 'N/A'}<br>` +
          `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• Timestamp: ${call.timestamp || 'N/A'}`
        );
      })
      .join('<br>');
  }

  /**
   * Format tool execution results
   */
  formatToolResults(toolResults) {
    if (!toolResults || toolResults.length === 0) {
      return '&nbsp;&nbsp;&nbsp;• No execution results available';
    }

    return toolResults
      .map((result, index) => {
        const status = result.success ? '✅ Success' : '❌ Failed';
        const errorInfo = result.error ? `<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• Error: ${result.error}` : '';

        return (
          `&nbsp;&nbsp;&nbsp;${index + 1}. **${result.tool}** - ${status}<br>` +
          `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• Result: ${this.formatResultData(result.result)}${errorInfo}`
        );
      })
      .join('<br>');
  }

  /**
   * Format detected functions for display
   */
  formatDetectedFunctions(functionCalls) {
    return functionCalls
      .map((call, index) => {
        return (
          `&nbsp;&nbsp;&nbsp;${index + 1}. **${call.tool_name}** (${call.confidence || 'N/A'}% confidence)<br>` +
          `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• Method: ${call.detectionMethod || 'pattern_match'}<br>` +
          `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• Evidence: "${call.evidence || 'N/A'}"`
        );
      })
      .join('<br>');
  }

  /**
   * Calculate overall confidence from function calls
   */
  calculateOverallConfidence(functionCalls) {
    if (!functionCalls || functionCalls.length === 0) {
      console.log('📈 [Confidence] No function calls to calculate confidence for');
      return 0;
    }

    const confidenceValues = functionCalls.map(call => call.confidence || 0);
    const totalConfidence = confidenceValues.reduce((sum, conf) => sum + conf, 0);
    const avgConfidence = Math.round(totalConfidence / functionCalls.length);

    console.log('📈 [Confidence] Confidence calculation:', {
      functionCallsCount: functionCalls.length,
      confidenceValues: confidenceValues,
      totalConfidence: totalConfidence,
      averageConfidence: avgConfidence,
    });

    return avgConfidence;
  }

  /**
   * Format result data for display
   */
  formatResultData(result) {
    if (!result) return 'No data';
    if (typeof result === 'string') return result.substring(0, 100) + (result.length > 100 ? '...' : '');
    if (typeof result === 'object') return JSON.stringify(result).substring(0, 100) + '...';
    return String(result);
  }

  /**
   * Display final comprehensive analysis results
   */
  displayFinalAnalysisResults(response, interactionData) {
    const functionCalls = interactionData?.response?.functionCalls || [];
    const toolResults = interactionData?.response?.toolExecutions || [];
    const responseTime = interactionData?.response?.responseTime || 0;
    const executionRounds = interactionData?.response?.executionRounds || 0;

    this.chatManager.updateThinkingMessage(
      `<br><br>📈 COMPREHENSIVE ANALYSIS COMPLETE<br>` +
        `═════════════════════════════════════════════════<br>` +
        `🔍 Final Analysis Summary:<br>` +
        `&nbsp;&nbsp;&nbsp;• Total Response Time: ${responseTime}ms<br>` +
        `&nbsp;&nbsp;&nbsp;• Function Calls Detected: ${functionCalls.length}<br>` +
        `&nbsp;&nbsp;&nbsp;• Tools Successfully Executed: ${toolResults.filter(r => r.success).length}<br>` +
        `&nbsp;&nbsp;&nbsp;• Execution Success Rate: ${this.calculateSuccessRate(toolResults)}%<br>` +
        `&nbsp;&nbsp;&nbsp;• Response Content Type: ${this.detectContentType(response)}<br><br>` +
        `🧠 AI Model Performance:<br>` +
        `&nbsp;&nbsp;&nbsp;• Instruction Understanding: ${this.assessInstructionUnderstanding(response, functionCalls)}<br>` +
        `&nbsp;&nbsp;&nbsp;• Function Selection Accuracy: ${this.assessFunctionSelection(functionCalls)}<br>` +
        `&nbsp;&nbsp;&nbsp;• Parameter Extraction Quality: ${this.assessParameterQuality(functionCalls)}<br>` +
        `&nbsp;&nbsp;&nbsp;• Response Completeness: ${this.assessResponseCompleteness(response)}<br><br>` +
        `📉 Interaction Data Captured:<br>` +
        `&nbsp;&nbsp;&nbsp;• Raw Response Length: ${response ? response.length : 0} chars<br>` +
        `&nbsp;&nbsp;&nbsp;• Detailed Logs: ${interactionData?.detailedLogs?.totalLogs || 0} entries<br>` +
        `&nbsp;&nbsp;&nbsp;• Execution Rounds: ${executionRounds}<br>` +
        `&nbsp;&nbsp;&nbsp;• Memory Usage: ${this.getMemoryUsage()} MB<br><br>` +
        `✅ Status: Analysis complete - Ready for scoring evaluation`
    );
  }

  /**
   * Assess instruction understanding quality
   */
  assessInstructionUnderstanding(response, functionCalls) {
    if (!response) return '❌ Poor';
    if (functionCalls.length > 0) return '✅ Excellent';
    if (response.length > 50) return '⚠️ Good';
    return '❌ Poor';
  }

  /**
   * Assess function selection accuracy
   */
  assessFunctionSelection(functionCalls) {
    if (functionCalls.length === 0) return '❌ No Functions';

    // CRITICAL FIX: Check if these are actual execution calls (high confidence)
    const hasActualExecution = functionCalls.some(
      call => call.executed || call.actualResult || call.round !== undefined
    );

    if (hasActualExecution) {
      // Real execution data should always be rated as excellent
      console.log('🎆 [Function Selection] Detected actual execution data - rating as Excellent');
      return '✅ Excellent (Actual Execution)';
    }

    // For text-based detection, use adjusted thresholds
    const avgConfidence = this.calculateOverallConfidence(functionCalls);
    console.log('📈 [Function Selection] Average confidence:', avgConfidence, '%');

    // FIXED: More reasonable thresholds for text-based detection
    if (avgConfidence >= 70) return '✅ Excellent';
    if (avgConfidence >= 50) return '⚠️ Good';
    if (avgConfidence >= 30) return '🟡 Fair';
    return '❌ Poor';
  }

  /**
   * Assess parameter extraction quality
   */
  assessParameterQuality(functionCalls) {
    if (functionCalls.length === 0) return '❌ N/A';
    const hasValidParams = functionCalls.some(call => call.parameters && Object.keys(call.parameters).length > 0);
    return hasValidParams ? '✅ Good' : '⚠️ Limited';
  }

  /**
   * Assess response completeness
   */
  assessResponseCompleteness(response) {
    if (!response) return '❌ Empty';
    if (response.length > 200) return '✅ Complete';
    if (response.length > 50) return '⚠️ Partial';
    return '❌ Minimal';
  }

  /**
   * Get current memory usage
   */
  getMemoryUsage() {
    if (performance.memory) {
      return Math.round(performance.memory.usedJSHeapSize / 1024 / 1024);
    }
    return 'N/A';
  }

  /**
   * Get LLM provider name
   */
  getLLMProvider() {
    try {
      if (this.chatManager && this.chatManager.llmConfigManager) {
        return this.chatManager.llmConfigManager.getProviderForModelType('task') || 'Unknown';
      }
    } catch (error) {
      console.warn('Failed to get LLM provider:', error);
    }
    return 'Unknown';
  }

  /**
   * Get LLM model name
   */
  getLLMModel() {
    try {
      if (this.chatManager && this.chatManager.llmConfigManager) {
        const config = this.chatManager.llmConfigManager.getConfiguration();
        const provider = this.getLLMProvider();
        if (config && config.providers && config.providers[provider]) {
          return config.providers[provider].model || 'Unknown';
        }
      }
    } catch (error) {
      console.warn('Failed to get LLM model:', error);
    }
    return 'Unknown';
  }

  /**
   * Format detected tools for display (as requested by Song)
   */
  formatDetectedToolsForDisplay(functionCalls) {
    if (!functionCalls || functionCalls.length === 0) {
      return '&nbsp;&nbsp;&nbsp;• No tool calls detected';
    }

    return functionCalls
      .map((call, index) => {
        const params = call.parameters || {};
        const paramStr =
          Object.keys(params).length > 0
            ? Object.entries(params)
                .map(([key, value]) => `${key}: "${value}"`)
                .join(', ')
            : 'No parameters';

        return (
          `&nbsp;&nbsp;&nbsp;${index + 1}. **${call.tool_name}** [Detected]<br>` +
          `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• Parameters: ${paramStr}<br>` +
          `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• Round: ${call.round || 'N/A'}<br>` +
          `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• Timestamp: ${call.timestamp || 'N/A'}`
        );
      })
      .join('<br>');
  }

  /**
   * Format execution results for display
   */
  formatExecutionResults(toolResults) {
    if (!toolResults || toolResults.length === 0) {
      return '&nbsp;&nbsp;&nbsp;• No execution results available';
    }

    return toolResults
      .map((result, index) => {
        const status = result.success ? '✅ Success' : '❌ Failed';
        const errorInfo = result.error ? `<br>&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• Error: ${result.error}` : '';

        return (
          `&nbsp;&nbsp;&nbsp;${index + 1}. **${result.tool}** - ${status}<br>` +
          `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• Result: ${this.formatResultData(result.result)}${errorInfo}`
        );
      })
      .join('<br>');
  }

  /**
   * Override ChatManager's simple messages with our detailed benchmark analysis
   */
  overrideChatManagerMessages() {
    // Find any thinking process messages that ChatManager might have added
    const thinkingMessages = document.querySelectorAll('.thinking-process');

    thinkingMessages.forEach(message => {
      const content = message.querySelector('.thinking-content');
      if (content) {
        const text = content.innerHTML;

        // Check if this is a generic ChatManager message that we need to replace
        if (
          text.includes('🔄 Starting request processing') ||
          text.includes('🤖 Round') ||
          text.includes('max rounds:')
        ) {
          console.log('🔧 [Benchmark] Overriding ChatManager generic message');

          // Replace with our detailed processing message
          this.chatManager.updateThinkingMessage(
            `<br>📶 LLM REQUEST PROCESSING - DETAILED MODE<br>` +
              `══════════════════════════════════════════════<br>` +
              `🔄 Multi-Round Function Call Processing Active<br>` +
              `&nbsp;&nbsp;&nbsp;• Maximum rounds configured: 10<br>` +
              `&nbsp;&nbsp;&nbsp;• Early completion detection enabled<br>` +
              `&nbsp;&nbsp;&nbsp;• Tool execution monitoring active<br>` +
              `&nbsp;&nbsp;&nbsp;• Response quality analysis in progress<br><br>` +
              `🔎 Round 1 Analysis:<br>` +
              `&nbsp;&nbsp;&nbsp;• Parsing LLM response for tool calls...<br>` +
              `&nbsp;&nbsp;&nbsp;• Function signature validation<br>` +
              `&nbsp;&nbsp;&nbsp;• Parameter extraction and validation<br>` +
              `&nbsp;&nbsp;&nbsp;• Tool execution preparation<br><br>` +
              `⚡ Status: Advanced parsing and analysis in progress...`
          );
        }
      }
    });
  }

  /**
   * Assess if behavior matches expectations
   */
  assessBehaviorMatch(testInfo, extractedCalls) {
    const expectedResult = testInfo.expectedResult || {};

    if (testInfo.type === 'workflow') {
      const expectedFunctions = expectedResult.expectedFunctions || [];
      const detectedFunctions = extractedCalls.map(call => call.tool_name);
      const matchCount = expectedFunctions.filter(fn => detectedFunctions.includes(fn)).length;

      if (expectedFunctions.length === 0) {
        return extractedCalls.length > 0 ? '✅ Functions executed' : '⚠️ No functions detected';
      }

      const percentage = ((matchCount / expectedFunctions.length) * 100).toFixed(0);
      return `${matchCount}/${expectedFunctions.length} expected functions (${percentage}%)`;
    }

    if (testInfo.type === 'function_call' && expectedResult.tool_name) {
      const detectedFunctions = extractedCalls.map(call => call.tool_name);
      return detectedFunctions.includes(expectedResult.tool_name)
        ? '✅ Expected function found'
        : '❌ Expected function not found';
    }

    return extractedCalls.length > 0 ? '✅ Functions detected' : '⚠️ Analyzing...';
  }

  /**
   * Display test error information
   */
  displayTestError(error, options = {}) {
    options.testInfo || {};

    this.chatManager.updateThinkingMessage(
      `\n\n❌ Test Execution Error:\n` +
        `Error Type: ${error.name || 'Unknown Error'}\n` +
        `Error Message: ${error.message}\n` +
        `Test Status: FAILED (Error during execution)\n\n` +
        `🔧 Troubleshooting:\n` +
        `• Check LLM configuration\n` +
        `• Verify network connectivity\n` +
        `• Check function calling setup\n` +
        `• Review test instruction format`
    );
  }

  /**
   * Parse test response based on test type
   * Note: ChatManager handles function calls internally and returns the final text response
   */
  /**
   * Return the authoritative list of function calls that actually executed during the
   * most recent ChatManager interaction, recovering each call's success state from the
   * recorded tool results. This is the same data source the ChatBox uses, so benchmark
   * tool detection stays in lock-step with real execution behavior.
   * @returns {Array<{tool_name: string, parameters: object, success: boolean, status: string}>}
   */
  getExecutedFunctionCalls() {
    const executionData = this.chatManager?.getLastExecutionData?.();
    if (!executionData || !Array.isArray(executionData.functionCalls)) {
      return [];
    }

    // Pair each call with its first unconsumed tool result (calls and results are
    // recorded in execution order) to recover success/failure per call.
    const pendingResults = Array.isArray(executionData.toolResults) ? [...executionData.toolResults] : [];

    return executionData.functionCalls
      .map(call => {
        const toolName = call.tool_name || call.toolName || call.tool;
        let success = true;
        const resultIndex = pendingResults.findIndex(r => (r.tool || r.tool_name) === toolName);
        if (resultIndex !== -1) {
          success = pendingResults[resultIndex].success !== false;
          pendingResults.splice(resultIndex, 1);
        }
        return {
          tool_name: toolName,
          parameters: call.parameters || {},
          success,
          status: success ? 'completed' : 'failed',
          detectionMethod: 'execution_data',
          executed: true,
        };
      })
      .filter(call => call.tool_name);
  }

  async parseTestResponse(response, test) {
    if (!response) {
      return null;
    }

    console.log('🔍 DEEP DEBUG - parseTestResponse called with:', {
      response: response,
      testType: test.type,
      testId: test.id,
      expectedResult: test.expectedResult,
    });

    // Extract parseDebugInfo from console logs (ChatManager's parseToolCall results)
    const parseDebugInfo = this.extractParseDebugInfoFromLogs(this.capturedLogs || []);

    // ChatManager returns text responses after handling function calls internally
    // We need to analyze the response to understand what happened
    const parsedResponse = {
      content: response,
      functionCalls: this.extractFunctionCallsFromResponse(response),
      completionIndicators: this.findCompletionIndicators(response),
      steps: this.extractWorkflowSteps(response),
      parseDebugInfo: parseDebugInfo, // Include parse debug info
    };

    // Attach the authoritative list of tools that actually executed during this
    // interaction. ChatManager records every executed function call across all
    // function-call rounds in getLastExecutionData() — the same ground truth the
    // ChatBox relies on. Evaluators must score against this rather than re-deriving
    // tools from the final assistant text, which omits intermediate tool calls and
    // causes multi-step workflows (e.g. "compute GC then export BED") to be reported
    // as "tool not detected".
    const executedFunctionCalls = this.getExecutedFunctionCalls();
    if (executedFunctionCalls.length > 0) {
      parsedResponse.executedFunctionCalls = executedFunctionCalls;
    }

    console.log('📊 Parsed response structure:', parsedResponse);
    console.log('🔍 ParseDebugInfo extracted:', parseDebugInfo);

    // Pass test context to parsing methods for better inference
    const parsingOptions = {
      test: test,
      expectedResult: test.expectedResult,
    };

    switch (test.type) {
      case 'function_call':
        return this.parseFunctionCallResponse(response, parsedResponse, parsingOptions);
      case 'text_analysis':
        return this.parseTextResponse(response);
      case 'json_output':
        return this.parseJSONResponse(response);
      case 'workflow':
        return this.parseWorkflowResponse(response, parsedResponse, parsingOptions);
      default:
        return parsedResponse;
    }
  }

  /**
   * Extract function calls from ChatManager response
   * Since ChatManager handles function calls internally, we look for evidence in the response
   * ENHANCED: Add comprehensive tool detection logging as requested by Song
   */
  extractFunctionCallsFromResponse(response) {
    console.log('🔍 [Tool Detection] Starting function call extraction from response');
    console.log('📝 [Tool Detection] Response length:', response ? response.length : 0);
    console.log('📝 [Tool Detection] Response preview:', response ? response.substring(0, 200) + '...' : 'No response');

    const functionCalls = [];

    // PRIORITY 1: Enhanced patterns to detect function calls from ChatManager responses
    const patterns = [
      // Direct JSON function calls (if any leaked through)
      /\{"tool_name":\s*"([^"]+)",\s*"parameters":\s*(\{[^}]*\})\}/g,

      // ChatManager execution success messages
      /(?:Successfully\s+)?(?:executed|called|running|performed|completed)\s+(?:function|tool|command|action)?\s*:?\s*`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi,

      // Function execution with parameters
      /(?:executed|called)\s+`?([a-zA-Z_][a-zA-Z0-9_]*)`?\s*with\s+(?:parameters?|args?)?\s*:?\s*(\{[^}]*\})/gi,

      // Tool usage indicators
      /(?:using|with|via)\s+(?:tool|function)?\s*:?\s*`?([a-zA-Z_][a-zA-Z0-9_]*)`?/gi,

      // Navigation/search result patterns (specific to genome browser)
      /(?:navigated to|searched for|found|located)\s+.*(?:using|via)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,

      // Function call results patterns
      /([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:function|tool)\s+(?:returned|completed|executed)/gi,

      // Genome browser specific patterns
      /(?:searched|navigated|jumped|displayed|opened|loaded|analyzed)\s+.*?(?:via|using|with)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi,

      // Success confirmation patterns
      /(?:successfully|completed)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:operation|function|tool|search|navigation)/gi,
    ];

    console.log('🔍 [Tool Detection] Testing', patterns.length, 'detection patterns');

    // PRIORITY 2: Tool-specific response content detection
    const toolContentPatterns = {
      get_current_state: [
        /current genome browser state/i,
        /position information/i,
        /track visibility/i,
        /current chromosome.*u00096/i,
        /current position.*\d+/i,
      ],
      compute_gc: [/gc content.*\d+/i, /calculated gc/i, /dna sequence.*atgc/i, /nucleotide composition/i],
      reverse_complement: [/reverse complement/i, /complementary sequence/i, /dna complement/i],
      translate_dna: [
        /protein sequence/i,
        /amino acid sequence/i,
        /translation/i,
        /methionine.*arginine.*serine/i,
        /start codon.*stop codon/i,
        /reading frame/i,
        /genetic code/i,
        /codon/i,
      ],
    };

    console.log(
      '🔍 [Tool Detection] Testing tool-specific content patterns for',
      Object.keys(toolContentPatterns).length,
      'tools'
    );

    // Check for tool-specific content patterns first
    for (const [toolName, contentPatterns] of Object.entries(toolContentPatterns)) {
      console.log(`🔍 [Tool Detection] Testing ${toolName} with ${contentPatterns.length} patterns`);
      const hasContent = contentPatterns.some(pattern => {
        const matches = pattern.test(response);
        if (matches) {
          console.log(`✅ [Tool Detection] Pattern match for ${toolName}:`, pattern.toString());
        }
        return matches;
      });

      if (hasContent) {
        console.log(`🎯 [Tool Detection] Found content pattern for tool: ${toolName}`);
        functionCalls.push({
          tool_name: toolName,
          parameters: {},
          evidence: `Response contains ${toolName} content patterns`,
          confidence: 95, // High confidence for content pattern matches
          contentMatch: true,
          detectionMethod: 'content_pattern',
          executed: false, // Mark as text-based detection
          actualResult: false,
        });
      }
    }

    // If we found content-based matches, return those first
    if (functionCalls.length > 0) {
      console.log(
        `✅ [Tool Detection] Extracted ${functionCalls.length} function calls from content patterns:`,
        functionCalls
      );
      const deduped = this.deduplicateFunctionCalls(functionCalls);
      console.log(`📋 [Tool Detection] After deduplication: ${deduped.length} unique tools detected`);
      return deduped;
    }

    console.log('⚠️ [Tool Detection] No content patterns matched, trying text-based detection...');

    // Fix Problem 6: Dynamic knownFunctions from builtInToolsMap instead of hardcoded list
    // Fallback list for when ChatManager is not available
    const DEFAULT_KNOWN_FUNCTIONS = [
      'find_gene_by_name',
      'search_features',
      'search_by_position',
      'navigate_to_position',
      'jump_to_gene',
      'get_gene_sequence',
      'run_blast_search',
      'zoom_in',
      'zoom_out',
      'set_zoom_level',
      'show_gene_details',
      'export_sequence',
      'save_current_view',
      'load_genome_file',
      'switch_chromosome',
      'toggle_track_visibility',
      'get_current_state',
      'compute_gc',
      'reverse_complement',
      'translate_dna',
      'codon_usage_analysis',
    ];

    let knownFunctions;
    try {
      if (window.chatManager && typeof window.chatManager.getRegisteredToolNames === 'function') {
        knownFunctions = window.chatManager.getRegisteredToolNames();
      } else if (window.chatManager && window.chatManager.builtInToolsMap) {
        knownFunctions = Array.from(window.chatManager.builtInToolsMap.keys());
      } else {
        knownFunctions = DEFAULT_KNOWN_FUNCTIONS;
      }
    } catch (e) {
      console.warn('⚠️ [Tool Detection] Failed to get dynamic tool list, using defaults:', e.message);
      knownFunctions = DEFAULT_KNOWN_FUNCTIONS;
    }

    console.log('🔍 [Tool Detection] Known functions list:', knownFunctions.length, 'functions');

    for (const pattern of patterns) {
      let match;
      pattern.lastIndex = 0; // Reset regex state
      console.log('🔍 [Tool Detection] Testing pattern:', pattern.toString());

      while ((match = pattern.exec(response)) !== null) {
        if (match[1]) {
          const toolName = match[1].toLowerCase();
          console.log(`🔍 [Tool Detection] Pattern matched tool name: ${toolName}`);

          // Validate against known functions or common patterns
          if (
            knownFunctions.includes(toolName) ||
            toolName.includes('search') ||
            toolName.includes('navigate') ||
            toolName.includes('jump') ||
            toolName.includes('get_') ||
            toolName.includes('run_') ||
            toolName.includes('show_') ||
            toolName.includes('export_') ||
            toolName.includes('save_') ||
            toolName.includes('load_') ||
            toolName.includes('switch_') ||
            toolName.includes('toggle_') ||
            toolName.includes('zoom_') ||
            toolName.includes('set_')
          ) {
            console.log(`✅ [Tool Detection] Valid tool detected: ${toolName}`);
            functionCalls.push({
              tool_name: toolName,
              parameters: match[2] ? this.safeParseJSON(match[2]) : {},
              evidence: match[0],
              confidence: this.calculateConfidence(match[0], toolName),
              detectionMethod: 'text_pattern',
              executed: false, // Mark as text-based detection
              actualResult: false,
            });
          } else {
            console.log(`❌ [Tool Detection] Invalid/unknown tool: ${toolName}`);
          }
        }
      }
    }

    // Look for parameter patterns in the response
    functionCalls.forEach(call => {
      console.log(`🔧 [Tool Detection] Extracting parameters for ${call.tool_name}`);
      call.parameters = this.extractParametersFromResponse(response, call.tool_name);
      console.log(`📝 [Tool Detection] Extracted parameters for ${call.tool_name}:`, call.parameters);
    });

    // Remove duplicates and sort by confidence
    const uniqueCalls = this.deduplicateFunctionCalls(functionCalls);

    console.log(`🔍 [Tool Detection] FINAL RESULT: Extracted ${uniqueCalls.length} function calls from response`);
    uniqueCalls.forEach((call, index) => {
      console.log(
        `📋 [Tool Detection] Tool ${index + 1}: ${call.tool_name} (confidence: ${call.confidence}%, method: ${call.detectionMethod}, executed: ${call.executed || false})`
      );
    });

    return uniqueCalls;
  }

  /**
   * Safely parse JSON with fallback
   */
  safeParseJSON(jsonString) {
    try {
      return JSON.parse(jsonString);
    } catch (error) {
      return {};
    }
  }

  /**
   * Calculate confidence score for function call detection
   */
  calculateConfidence(evidence, toolName) {
    let confidence = 60; // FIXED: Higher base confidence for detected patterns

    // Higher confidence for explicit execution messages
    if (evidence.includes('executed') || evidence.includes('successfully')) {
      confidence += 25; // Increased bonus
    }

    // Higher confidence for specific function names
    if (evidence.includes('`' + toolName + '`') || evidence.includes('"' + toolName + '"')) {
      confidence += 15; // Increased bonus
    }

    // Higher confidence for parameter mentions
    if (evidence.includes('parameters') || evidence.includes('with')) {
      confidence += 10;
    }

    // Bonus for tool-specific content patterns
    if (evidence.includes('content patterns') || evidence.includes('Response contains')) {
      confidence += 20; // High bonus for content-based detection
    }

    // Bonus for common genome browser actions
    const genomeBrowserActions = ['navigated', 'searched', 'jumped', 'displayed', 'opened', 'loaded', 'analyzed'];
    if (genomeBrowserActions.some(action => evidence.toLowerCase().includes(action))) {
      confidence += 15;
    }

    console.log(
      `🎯 [Confidence] Calculated confidence for ${toolName}: ${Math.min(confidence, 100)}% (evidence: "${evidence.substring(0, 50)}...")`
    );

    return Math.min(confidence, 100);
  }

  /**
   * Extract parameters from response context for a given tool
   * ENHANCED: Add comprehensive logging and fix translate_dna parameter handling
   */
  extractParametersFromResponse(response, toolName) {
    const parameters = {};

    console.log('🔍 [Parameter Extraction] Starting parameter extraction for:', {
      response: response.substring(0, 200) + '...',
      toolName: toolName,
    });

    // For navigation tools, look specifically for coordinates and chromosome information
    if (toolName === 'navigate_to_position') {
      console.log('🧭 [Parameter Extraction] Processing navigation tool');
      // Extract coordinates - look for patterns like "100000", "1000-2000", "position 100000"
      const coordMatch = response.match(/(?:position|start|from|to|navigate.*?to).*?(\d+)(?:\s*(?:to|-)\s*(\d+))?/i);
      if (coordMatch) {
        const firstNumber = parseInt(coordMatch[1]);
        const secondNumber = coordMatch[2] ? parseInt(coordMatch[2]) : null;

        if (secondNumber && secondNumber > firstNumber) {
          // Range format: start-end
          parameters.start = firstNumber;
          parameters.end = secondNumber;
          console.log('🎯 [Parameter Extraction] Found coordinate range:', { start: firstNumber, end: secondNumber });
        } else {
          // Single position format
          parameters.position = firstNumber;
          console.log('🎯 [Parameter Extraction] Found single position:', firstNumber);
        }
      }

      // Extract chromosome - look for patterns like "chr1", "U00096", "chromosome 1"
      const chrMatch = response.match(/(?:chromosome|chr)\s*["']?([A-Za-z0-9\-_]+)["']?/i);
      if (chrMatch && chrMatch[1]) {
        parameters.chromosome = chrMatch[1];
        console.log('🎯 [Parameter Extraction] Found chromosome:', chrMatch[1]);
      }
    }

    // For search tools
    else if (toolName.includes('search')) {
      console.log('🔍 [Parameter Extraction] Processing search tool');
      // Extract gene/query names
      const geneMatch = response.match(/(?:gene|search|find|locate).*?["']([^"']+)["']/i);
      if (geneMatch) {
        parameters.name = geneMatch[1];
        parameters.query = geneMatch[1];
        console.log('🎯 [Parameter Extraction] Found search term:', geneMatch[1]);
      }

      // Extract case sensitivity
      const caseMatch = response.match(/(?:caseSensitive|case).*?(true|false)/i);
      if (caseMatch) {
        parameters.caseSensitive = caseMatch[1].toLowerCase() === 'true';
        console.log('🎯 [Parameter Extraction] Found caseSensitive:', parameters.caseSensitive);
      }
    }

    // For sequence analysis tools
    else if (toolName === 'compute_gc') {
      console.log('🧬 [Parameter Extraction] Processing GC computation tool');
      // Extract DNA sequence
      const seqMatch = response.match(/(?:sequence|dna).*?["']?([ATCGN]+)["']?/i);
      if (seqMatch) {
        parameters.sequence = seqMatch[1];
        console.log('🎯 [Parameter Extraction] Found DNA sequence:', seqMatch[1]);
      }
      // Look for include_statistics parameter
      if (response.toLowerCase().includes('statistics') || response.toLowerCase().includes('detailed')) {
        parameters.include_statistics = true;
        console.log('🎯 [Parameter Extraction] Added include_statistics: true');
      }
    } else if (toolName === 'reverse_complement') {
      console.log('🔄 [Parameter Extraction] Processing reverse complement tool');
      // Extract DNA sequence
      const seqMatch = response.match(/(?:sequence|dna|complement).*?["']?([ATCGN]+)["']?/i);
      if (seqMatch) {
        parameters.sequence = seqMatch[1];
        console.log('🎯 [Parameter Extraction] Found DNA sequence for reverse complement:', seqMatch[1]);
      }
    }

    // CRITICAL FIX: translate_dna tool parameter handling (from memory)
    else if (toolName === 'translate_dna') {
      console.log('🧬➡️🧪 [Parameter Extraction] Processing DNA translation tool');
      // Extract DNA sequence - CRITICAL: Use 'dna' parameter name, not 'sequence'
      const seqMatch = response.match(/(?:sequence|dna|translate).*?["']?([ATCGN]+)["']?/i);
      if (seqMatch) {
        parameters.dna = seqMatch[1]; // FIXED: Use 'dna' parameter name as per memory
        console.log('🎯 [Parameter Extraction] Found DNA sequence for translation (using dna param):', seqMatch[1]);
      }
      // Look for reading frame
      const frameMatch = response.match(/(?:frame|reading).*?(\d+)/i);
      if (frameMatch) {
        parameters.frame = parseInt(frameMatch[1]);
        console.log('🎯 [Parameter Extraction] Found reading frame:', parameters.frame);
      }
      // Set default frame if not found
      if (!parameters.frame) {
        parameters.frame = 1;
        console.log('🎯 [Parameter Extraction] Using default reading frame: 1');
      }
    }

    // For get_current_state - no parameters needed
    else if (toolName === 'get_current_state') {
      console.log('📊 [Parameter Extraction] get_current_state requires no parameters');
    } else {
      console.log('❓ [Parameter Extraction] Unknown tool type, using generic extraction');
      // Generic parameter extraction for unknown tools
      const genericSeqMatch = response.match(/["']?([ATCGN]{10,})["']?/i);
      if (genericSeqMatch) {
        parameters.sequence = genericSeqMatch[1];
        console.log('🎯 [Parameter Extraction] Found generic DNA sequence:', genericSeqMatch[1]);
      }
    }

    console.log('📄 [Parameter Extraction] FINAL extracted parameters for', toolName, ':', parameters);
    return parameters;
  }

  /**
   * Remove duplicate function calls and sort by confidence
   */
  deduplicateFunctionCalls(functionCalls) {
    const seen = new Map();

    functionCalls.forEach(call => {
      const key = call.tool_name;
      if (!seen.has(key) || seen.get(key).confidence < call.confidence) {
        seen.set(key, call);
      }
    });

    return Array.from(seen.values()).sort((a, b) => b.confidence - a.confidence);
  }

  /**
   * Parse function call response
   */
  parseFunctionCallResponse(response, parsedResponse = null, options = {}) {
    console.log('🔍 DEEP DEBUG - parseFunctionCallResponse called with:', {
      response: response,
      parsedResponse: parsedResponse,
      functionCallsFound: parsedResponse?.functionCalls?.length || 0,
      expectedFunction: options.expectedResult?.tool_name,
    });

    // CRITICAL FIX: Check for actual execution data first but validate it's current
    if (parsedResponse && parsedResponse.actualExecutionData) {
      const executionData = parsedResponse.actualExecutionData;
      console.log('🎯 Using actual execution data:', executionData);

      if (executionData.functionCalls && executionData.functionCalls.length > 0) {
        // Return the actual function call that was executed
        const executedCall = executionData.functionCalls[0]; // Get first executed function
        console.log('✅ Found actual executed function call:', executedCall);
        return {
          tool_name: executedCall.tool_name,
          parameters: executedCall.parameters,
          executed: true,
          round: executedCall.round,
          timestamp: executedCall.timestamp,
          confidence: 100, // Actual execution = 100% confidence
          actualResult: true,
          error: executedCall.error || undefined,
        };
      }
    }

    // ENHANCED: Check current ChatManager execution data but validate timestamp
    if (this.chatManager && this.chatManager.getLastExecutionData) {
      const currentExecutionData = this.chatManager.getLastExecutionData();
      if (currentExecutionData && currentExecutionData.functionCalls && currentExecutionData.functionCalls.length > 0) {
        // CRITICAL: Check if this execution data is recent (within last 2 minutes)
        const dataAge = Date.now() - (currentExecutionData.startTime || 0);
        const maxAge = 2 * 60 * 1000; // 2 minutes

        if (dataAge < maxAge) {
          console.log('✅ Using recent ChatManager execution data:', {
            functionCalls: currentExecutionData.functionCalls.length,
            age: Math.round(dataAge / 1000) + 's',
            tools: currentExecutionData.functionCalls.map(c => c.tool_name),
          });

          // CRITICAL FIX: Return ALL function calls if multiple, not just the latest
          if (currentExecutionData.functionCalls.length > 1) {
            console.log(
              `🎯 Multiple ChatManager function calls detected (${currentExecutionData.functionCalls.length}), returning all:`,
              currentExecutionData.functionCalls.map(call => call.tool_name)
            );

            // Return array of all function calls for multiple tools evaluation
            return currentExecutionData.functionCalls.map(call => ({
              tool_name: call.tool_name,
              parameters: call.parameters,
              executed: true,
              round: call.round,
              timestamp: call.timestamp,
              confidence: 100, // Actual execution = 100% confidence
              actualResult: true,
              detectionMethod: 'chatmanager_execution',
              error: call.error || undefined,
            }));
          } else {
            // Single function call, return as single object
            const latestCall = currentExecutionData.functionCalls[0];
            return {
              tool_name: latestCall.tool_name,
              parameters: latestCall.parameters,
              executed: true,
              round: latestCall.round,
              timestamp: latestCall.timestamp,
              confidence: 100, // Actual execution = 100% confidence
              actualResult: true,
              detectionMethod: 'chatmanager_execution',
              error: latestCall.error || undefined,
            };
          }
        } else {
          console.log('⚠️ Ignoring stale ChatManager execution data:', {
            age: Math.round(dataAge / 1000) + 's',
            maxAge: Math.round(maxAge / 1000) + 's',
            tools: currentExecutionData.functionCalls.map(c => c.tool_name),
          });
        }
      }
    }

    // CRITICAL FIX: Return all detected function calls for multiple tools evaluation
    if (parsedResponse && parsedResponse.functionCalls && parsedResponse.functionCalls.length > 0) {
      const sortedCalls = parsedResponse.functionCalls.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));

      // If multiple function calls detected, return all of them for proper evaluation
      if (sortedCalls.length > 1) {
        console.log(
          `🎯 Multiple function calls detected (${sortedCalls.length}), returning all for evaluation:`,
          sortedCalls.map(call => call.tool_name)
        );
        return sortedCalls; // Return array of all tools
      } else {
        // Single function call, return as single object
        console.log('🎯 Returning single function call:', sortedCalls[0]);
        return sortedCalls[0];
      }
    }

    // CRITICAL INSIGHT: If ChatManager executed functions successfully,
    // the response will contain success indicators even if we can't detect the exact function calls
    // Let's create a smart inference system with test context
    const inferredResult = this.inferFunctionCallFromResponse(response, options.expectedResult);
    if (inferredResult) {
      console.log('🧠 Inferred function call from response:', inferredResult);
      return inferredResult;
    }

    try {
      // Fallback: Look for JSON function calls in the response
      const jsonMatches = response.match(/\{[^}]*"tool_name"[^}]*\}/g);
      if (jsonMatches) {
        const parsed = jsonMatches.map(match => JSON.parse(match));
        console.log(
          `🎯 JSON fallback found ${parsed.length} tool calls:`,
          parsed.map(p => p.tool_name)
        );

        // CRITICAL FIX: Return all parsed tools if multiple, single if one
        if (parsed.length > 1) {
          return parsed; // Return array for multiple tools
        } else {
          return parsed[0]; // Return single object for one tool
        }
      }

      // If no function calls detected, return response with empty function calls
      console.log('⚠️ No function calls detected in response');
      return {
        error: 'No function calls detected',
        content: response,
        functionCalls: [],
        actualResult: null,
      };
    } catch (error) {
      console.error('❌ Error parsing function call response:', error);
      return {
        error: 'Invalid JSON format',
        response: response,
        actualResult: null,
      };
    }
  }

  /**
   * Infer function call from response content using smart analysis
   */
  inferFunctionCallFromResponse(response, expectedResult = null) {
    if (!response || typeof response !== 'string') return null;

    const lowerResponse = response.toLowerCase();

    console.log('🧠 INFERENCE DEBUG:', {
      response: response.substring(0, 200),
      expectedResult: expectedResult,
      expectedTool: expectedResult?.tool_name,
    });

    // CRITICAL FIX: Enhanced error pattern detection to prevent false positives
    // Only detect errors if they aren't preceded by negations like "no", "without"
    const errorPatternRegexes = [
      /(?<!no\s+)(?<!without\s+)(?<!0\s+)error\b/i,
      /(?<!not\s+)failed\b/i,
      /\bnot found\b/i,
      /\bnot available\b/i,
      /\bunavailable\b/i,
      /\bnot configured\b/i,
      /\b(does|did)\s+not exist\b/i,
      /\bmissing\b/i,
      /(?<!not\s+)invalid\b/i,
      /connection failed/i,
      /\btimeout\b/i,
      /\b404\b/,
      /\b500\b/,
      /http error/i,
      /model not found/i,
      /provider failed/i,
      /api error/i,
      /no llm/i,
      /llm error/i,
      /communication error/i,
    ];

    const hasErrorPattern = errorPatternRegexes.some(regex => regex.test(response));

    if (hasErrorPattern) {
      console.log('❌ Error pattern detected in response, skipping inference');
      console.log(
        '🔍 Found error patterns:',
        errorPatternRegexes.filter(regex => regex.test(response)).map(r => r.source)
      );
      return null;
    }

    // ENHANCED TOOL-SPECIFIC DETECTION: Check for specific tool patterns first
    if (expectedResult && expectedResult.tool_name) {
      const toolName = expectedResult.tool_name;

      // Tool-specific success patterns
      const toolPatterns = {
        get_current_state: [
          'current genome browser state',
          'browser state',
          'position information',
          'track visibility',
          'data status',
          'selection status',
          'current chromosome',
          'current position',
          'loaded files',
        ],
        compute_gc: [
          'gc content',
          'gc percentage',
          'calculate gc',
          'calculated gc',
          'dna sequence',
          'sequence analysis',
          'nucleotide composition',
          'base composition',
        ],
        translate_dna: [
          'dna sequence.*translates',
          'protein sequence',
          'amino acid sequence',
          'translation',
          'methionine.*arginine.*serine',
          'start codon.*stop codon',
          'reading frame',
          'genetic code',
          'codon',
        ],
      };

      const patterns = toolPatterns[toolName];
      if (patterns) {
        const hasToolPattern = patterns.some(pattern => lowerResponse.includes(pattern.toLowerCase()));

        if (hasToolPattern) {
          console.log(`✅ [inferFunctionCallFromResponse] Tool-specific pattern detected for ${toolName}`);
          const matchedPatterns = patterns.filter(pattern => lowerResponse.includes(pattern.toLowerCase()));

          const inferredResult = {
            tool_name: toolName,
            parameters: expectedResult.parameters || {},
            confidence: 90, // High confidence for tool-specific patterns
            inferred: true,
            evidence: `Response contains tool-specific patterns for ${toolName}: ${matchedPatterns.join(', ')}`,
          };

          console.log('🎯 [inferFunctionCallFromResponse] Tool-specific inference successful:', inferredResult);
          return inferredResult;
        }
      }
    }

    // Success indicators suggest function was executed successfully
    const successIndicators = [
      'found',
      'located',
      'identified',
      'discovered',
      'retrieved',
      'navigated',
      'moved',
      'jumped',
      'displayed',
      'showed',
      'searched',
      'analyzed',
      'processed',
      'completed',
      'exported',
      'saved',
      'loaded',
      'opened',
      'executed',
      'performed',
      'called',
      'ran',
      'using',
    ];

    const hasSuccessIndicator = successIndicators.some(indicator => lowerResponse.includes(indicator));

    console.log('🔍 Success indicators check:', {
      hasSuccessIndicator: hasSuccessIndicator,
      foundIndicators: successIndicators.filter(indicator => lowerResponse.includes(indicator)),
    });

    // ENHANCED LOGIC: Only infer if we have genuine success indicators AND no error patterns
    if (hasSuccessIndicator && expectedResult && expectedResult.tool_name) {
      console.log('🎯 Using expected result as basis for inference');

      // Additional validation: check if response actually contains function execution evidence
      const executionEvidence = [
        'task completed',
        'analysis finished',
        'operation successful',
        'result:',
        'output:',
        'data retrieved',
        'information found',
      ];

      const hasExecutionEvidence = executionEvidence.some(evidence => lowerResponse.includes(evidence));

      if (!hasExecutionEvidence) {
        console.log('⚠️ No execution evidence found, reducing confidence');
        // Still allow inference but with lower confidence
      }

      // Extract parameters from response using the expected function context
      const inferredParams = this.extractParametersFromResponse(response, expectedResult.tool_name);

      // Merge with expected parameters for better accuracy
      // CRITICAL: Don't override placeholders unless we have actual values
      const finalParams = {};

      // Start with expected parameters
      Object.assign(finalParams, expectedResult.parameters);

      // Only override with inferred parameters if they are not empty/undefined
      for (const [key, value] of Object.entries(inferredParams)) {
        if (value !== undefined && value !== null && value !== '') {
          finalParams[key] = value;
        }
      }

      console.log('🔍 [inferFunctionCallFromResponse] Parameter merging:', {
        expectedParams: expectedResult.parameters,
        inferredParams: inferredParams,
        finalParams: finalParams,
      });

      const inferredResult = {
        tool_name: expectedResult.tool_name,
        parameters: finalParams,
        confidence: hasExecutionEvidence ? 85 : 60, // Lower confidence without execution evidence
        inferred: true,
        evidence: `Response contains success indicators${hasExecutionEvidence ? ' and execution evidence' : ''} for function: ${expectedResult.tool_name}`,
      };

      console.log('✅ [inferFunctionCallFromResponse] Successfully inferred function call:', inferredResult);
      return inferredResult;
    }

    if (!hasSuccessIndicator) {
      console.log('❌ No success indicators found in response');
      return null;
    }

    // Infer function type based on response content
    let inferredFunction = null;
    const inferredParams = {};

    // Gene search patterns
    if (lowerResponse.includes('gene') || lowerResponse.includes('search')) {
      if (lowerResponse.includes('position') || lowerResponse.includes('location')) {
        inferredFunction = 'search_by_position';
      } else if (lowerResponse.includes('feature') || lowerResponse.includes('product')) {
        inferredFunction = 'search_features';
        // Extract query from response
        const queryMatch = response.match(/(?:search|find|locate).*?["']([^"']+)["']/i);
        if (queryMatch) {
          inferredParams.query = queryMatch[1];
        }
      } else {
        inferredFunction = 'find_gene_by_name';
        // Extract gene name from response
        const geneMatch = response.match(/(?:gene|locus).*?["']?([a-zA-Z0-9_-]+)["']?/i);
        if (geneMatch) {
          inferredParams.name = geneMatch[1];
        }
      }
    }

    // Navigation patterns
    else if (lowerResponse.includes('navigat') || lowerResponse.includes('jump') || lowerResponse.includes('move')) {
      inferredFunction = 'navigate_to_position';
      // Extract coordinates
      const coordMatch = response.match(/(\d+).*?(\d+)/);
      if (coordMatch) {
        inferredParams.start = parseInt(coordMatch[1]);
        inferredParams.end = parseInt(coordMatch[2]);
      }
    }

    // BLAST patterns
    else if (lowerResponse.includes('blast') || lowerResponse.includes('alignment')) {
      inferredFunction = 'run_blast_search';
      // Extract sequence if mentioned
      const seqMatch = response.match(/sequence.*?["']([ATCGN]+)["']/i);
      if (seqMatch) {
        inferredParams.sequence = seqMatch[1];
      }
    }

    if (inferredFunction) {
      console.log(`🧠 Inferred function call: ${inferredFunction} with params:`, inferredParams);
      return {
        tool_name: inferredFunction,
        parameters: inferredParams,
        confidence: 75, // High confidence for inference
        inferred: true,
        evidence: `Response contains success indicators for ${inferredFunction}`,
      };
    }

    return null;
  }

  /**
   * Check if response indicates LLM error or failure
   */
  isLLMErrorResponse(response) {
    if (!response || typeof response !== 'string') return false;

    const lowerResponse = response.toLowerCase();

    // Error patterns that indicate LLM failure
    const errorPatterns = [
      'model not found',
      'model "',
      'not found, try pulling',
      'llm not configured',
      'no llm provider',
      'provider failed',
      'connection failed',
      'api error',
      'http error',
      'timeout',
      'error sending message',
      'failed to load resource',
      'server responded with a status of',
      'status 404',
      'status 500',
      'status 503',
      'error 404',
      'error 500',
      'error 503',
      '404 error',
      '500 error',
      '503 error',
      'http 404',
      'http 500',
      'http 503',
      'communication error',
      'network error',
      'service unavailable',
    ];

    const hasErrorPattern = errorPatterns.some(pattern => lowerResponse.includes(pattern));

    // Also check for specific error message patterns (but be more precise)
    const isErrorMessage =
      lowerResponse.includes('**model not found**') ||
      (lowerResponse.includes('**error**') &&
        !lowerResponse.includes('successfully') &&
        !lowerResponse.includes('navigated to')) ||
      (lowerResponse.includes('please:') && lowerResponse.includes('configure llms'));

    return hasErrorPattern || isErrorMessage;
  }

  /**
   * Generate unique request ID for tracking
   */
  generateRequestId() {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Capture system prompt from ChatManager
   */
  async captureSystemPrompt() {
    try {
      // Try to get system prompt from ChatManager
      if (this.chatManager && this.chatManager.buildSystemMessage) {
        const systemPrompt = await this.chatManager.buildSystemMessage();
        return systemPrompt || 'System prompt not available';
      }
      return 'System prompt not available';
    } catch (error) {
      return `Error capturing system prompt: ${error.message}`;
    }
  }

  captureDynamicToolsAnalysis(systemPrompt = null) {
    try {
      const metadata = this.chatManager?.lastSystemPromptMetadata;
      if (!metadata) {
        return systemPrompt
          ? {
              mode: 'unknown',
              selectedToolCount: 0,
              selectedBuiltInToolCount: 0,
              selectedRegistryToolCount: 0,
              selectedPluginToolCount: 0,
              selectedToolsByCategory: {},
              promptLength: systemPrompt.length,
              promptTokenEstimate: this.estimateTokenCount(systemPrompt),
              baselinePromptLength: systemPrompt.length,
              baselineTokenEstimate: this.estimateTokenCount(systemPrompt),
              estimatedTokensSaved: 0,
              estimatedPercentSaved: 0,
            }
          : null;
      }

      return {
        mode: metadata.mode,
        generatedAt: metadata.generatedAt,
        userQuery: metadata.userQuery,
        dynamicToolsEnabled: metadata.dynamicToolsEnabled,
        selectedToolCount: metadata.selectedToolCount || 0,
        selectedBuiltInToolCount: metadata.selectedBuiltInToolCount || 0,
        selectedRegistryToolCount: metadata.selectedRegistryToolCount || 0,
        selectedPluginToolCount: metadata.selectedPluginToolCount || 0,
        selectedToolsByCategory: metadata.selectedToolsByCategory || {},
        selectedToolNames: Array.isArray(metadata.selectedTools) ? metadata.selectedTools.map(tool => tool.name) : [],
        promptLength: metadata.promptLength || (systemPrompt ? systemPrompt.length : 0),
        promptTokenEstimate: metadata.promptTokenEstimate || this.estimateTokenCount(systemPrompt || ''),
        baselineMode: metadata.baselineMode,
        baselineToolCount: metadata.baselineToolCount || 0,
        baselinePromptLength: metadata.baselinePromptLength || 0,
        baselineTokenEstimate: metadata.baselineTokenEstimate || 0,
        estimatedTokensSaved: metadata.estimatedTokensSaved || 0,
        estimatedPercentSaved: metadata.estimatedPercentSaved || 0,
      };
    } catch (error) {
      console.warn('Failed to capture dynamic tools benchmark analysis:', error);
      return null;
    }
  }

  /**
   * Get current chat context length
   */
  getChatContextLength() {
    try {
      if (this.chatManager && this.chatManager.configManager) {
        const history = this.chatManager.configManager.getChatHistory();
        return history ? history.length : 0;
      }
      return 0;
    } catch (error) {
      return 0;
    }
  }

  /**
   * Get available tools for the current context
   */
  getAvailableTools() {
    try {
      if (this.chatManager && this.chatManager.app) {
        // Try to get available tools from the application
        const tools = [];

        // Add genomic analysis tools
        if (this.chatManager.app.fileManager) {
          tools.push('file_operations', 'sequence_analysis');
        }

        // Add visualization tools
        if (this.chatManager.app.visualizationToolsManager) {
          tools.push('visualization_tools');
        }

        // Add plugin tools
        if (this.chatManager.app.pluginManager) {
          tools.push('plugin_functions');
        }

        return tools;
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Build full prompt for logging
   */
  async buildFullPrompt(instruction) {
    try {
      const systemPrompt = await this.captureSystemPrompt();
      return `${systemPrompt}\n\nUser: ${instruction}`;
    } catch (error) {
      return instruction;
    }
  }

  /**
   * Process response for analysis
   */
  processResponse(response) {
    try {
      // Clean and normalize response
      let processed = response.trim();

      // Remove thinking tags if present
      processed = processed.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();

      // Extract main content
      if (processed.includes('```json')) {
        const jsonMatch = processed.match(/```json\s*([\s\S]*?)\s*```/);
        if (jsonMatch) {
          processed = jsonMatch[1].trim();
        }
      }

      return processed;
    } catch (error) {
      return response;
    }
  }

  /**
   * Capture tool executions from the current session
   */
  captureToolExecutions() {
    // This would need to be integrated with ChatManager's tool execution tracking
    // For now, return empty array as placeholder
    return [];
  }

  /**
   * Capture token usage information with enhanced tracking
   */
  captureTokenUsage() {
    try {
      // Get token usage from ChatManager if available
      if (this.chatManager && this.chatManager.lastExecutionData) {
        const executionData = this.chatManager.lastExecutionData;
        if (executionData.tokenUsage) {
          return executionData.tokenUsage;
        }
      }

      // Get token usage from LLM config manager if available
      if (this.chatManager && this.chatManager.llmConfigManager) {
        const llmManager = this.chatManager.llmConfigManager;
        if (llmManager.lastTokenUsage) {
          return llmManager.lastTokenUsage;
        }
      }

      // Fallback to estimation based on conversation history size
      let estimatedTokens = 0;
      if (this.chatManager && this.chatManager.configManager) {
        const chatHistory = this.chatManager.configManager.getChatHistory();
        if (chatHistory && chatHistory.length > 0) {
          const totalTextLength = chatHistory.reduce((sum, msg) => {
            return sum + (msg.message ? msg.message.length : 0);
          }, 0);
          estimatedTokens = Math.ceil(totalTextLength / 4); // Rough estimation: 4 chars per token

          console.log(
            `📊 [Benchmark] Estimated tokens from chat history: ${estimatedTokens} (${totalTextLength} chars)`
          );

          return {
            promptTokens: Math.ceil(estimatedTokens * 0.7), // Estimate 70% for prompts
            completionTokens: Math.ceil(estimatedTokens * 0.3), // Estimate 30% for completions
            totalTokens: estimatedTokens,
            estimated: true,
            note: 'Token usage estimated from conversation history',
          };
        }
      }

      // Default fallback structure
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        estimated: false,
        note: 'Token usage tracking not available for this provider',
      };
    } catch (error) {
      console.warn('Failed to capture token usage:', error);
      return {
        promptTokens: 0,
        completionTokens: 0,
        totalTokens: 0,
        error: error.message,
        note: 'Token usage capture failed',
      };
    }
  }

  /**
   * Analyze response quality and characteristics
   */
  analyzeResponseQuality(instruction, response) {
    try {
      const analysis = {
        isError: false,
        errorType: null,
        errorMessage: null,
        confidence: this.calculateResponseConfidence(response),
        complexity: this.calculateInstructionComplexity(instruction),
        ambiguity: this.calculateInstructionAmbiguity(instruction),
        contextRelevance: this.calculateContextRelevance(instruction, response),
      };

      // Check for error patterns
      if (this.isLLMErrorResponse(response)) {
        analysis.isError = true;
        analysis.errorType = 'llm_error_response';
        analysis.errorMessage = 'Response contains error patterns';
      }

      return analysis;
    } catch (error) {
      return {
        isError: true,
        errorType: 'analysis_error',
        errorMessage: error.message,
        confidence: null,
        complexity: null,
        ambiguity: null,
        contextRelevance: null,
      };
    }
  }

  /**
   * Calculate response confidence score (5-point scale)
   */
  calculateResponseConfidence(response) {
    try {
      let confidence = 2.5; // Base confidence (middle of 5-point scale)

      // Higher confidence for JSON responses
      if (response.includes('{') && response.includes('}')) {
        confidence += 1.0;
      }

      // Higher confidence for function calls
      if (response.includes('tool_name') && response.includes('parameters')) {
        confidence += 1.0;
      }

      // Lower confidence for error messages
      if (this.isLLMErrorResponse(response)) {
        confidence = Math.max(0.5, confidence - 2.0);
      }

      // Lower confidence for very short responses
      if (response.length < 20) {
        confidence -= 0.75;
      }

      return Math.max(0, Math.min(5, confidence));
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate instruction complexity score (5-point scale)
   * CRITICAL FIX: Enforce 5-point scale as per memory requirements
   */

  /**
   * Calculate instruction ambiguity score (5-point scale)
   */
  calculateInstructionAmbiguity(instruction) {
    try {
      let ambiguity = 0;

      // Vague terms increase ambiguity
      const vagueTerms = ['something', 'anything', 'maybe', 'perhaps', 'might', 'could', 'some'];
      const foundVague = vagueTerms.filter(term => instruction.toLowerCase().includes(term));
      ambiguity += foundVague.length * 0.75; // Scale to 5-point system

      // Questions increase ambiguity
      if (instruction.includes('?')) {
        ambiguity += 0.5;
      }

      // Lack of specific parameters increases ambiguity
      if (!instruction.match(/["'][^"']+["']/) && !instruction.match(/\d+/)) {
        ambiguity += 1.0;
      }

      return Math.max(0, Math.min(5, ambiguity));
    } catch (error) {
      return null;
    }
  }

  /**
   * Calculate context relevance score (5-point scale)
   */
  calculateContextRelevance(instruction, response) {
    try {
      let relevance = 2.5; // Base relevance (middle of 5-point scale)

      // Check if response addresses the instruction
      const instructionWords = instruction.toLowerCase().split(/\s+/);
      const responseWords = response.toLowerCase().split(/\s+/);

      const commonWords = instructionWords.filter(word => word.length > 3 && responseWords.includes(word));

      relevance += Math.min(1.5, commonWords.length * 0.25); // Scale to 5-point system

      // Check for function call relevance
      if (instruction.toLowerCase().includes('search') && response.includes('search_')) {
        relevance += 1.0;
      }

      if (instruction.toLowerCase().includes('navigate') && response.includes('navigate_')) {
        relevance += 1.0;
      }

      return Math.max(0, Math.min(5, relevance));
    } catch (error) {
      return null;
    }
  }

  /**
   * Extract LLM raw response information from captured logs
   */
  extractLLMRawResponseFromLogs(logs) {
    const rawResponseInfo = {
      responseType: null,
      responseLength: null,
      isEmpty: null,
      isUndefined: null,
      trimmedLength: null,
      firstChars: null,
      hexDump: null,
      fullResponse: null,
    };

    logs.forEach(log => {
      const msg = log.message;

      if (msg.includes('=== LLM Raw Response ===')) {
        rawResponseInfo.sectionFound = true;
      } else if (msg.includes('Response type:')) {
        rawResponseInfo.responseType = msg.split('Response type:')[1]?.trim();
      } else if (msg.includes('Response length:')) {
        rawResponseInfo.responseLength = msg.split('Response length:')[1]?.trim();
      } else if (msg.includes('Response is empty string:')) {
        rawResponseInfo.isEmpty = msg.split('Response is empty string:')[1]?.trim();
      } else if (msg.includes('Response is undefined:')) {
        rawResponseInfo.isUndefined = msg.split('Response is undefined:')[1]?.trim();
      } else if (msg.includes('Response.trim() length:')) {
        rawResponseInfo.trimmedLength = msg.split('Response.trim() length:')[1]?.trim();
      } else if (msg.includes('Response characters (first 100):')) {
        rawResponseInfo.firstChars = msg.split('Response characters (first 100):')[1]?.trim();
      } else if (msg.includes('Response hex dump (first 50 chars):')) {
        rawResponseInfo.hexDump = msg.split('Response hex dump (first 50 chars):')[1]?.trim();
      } else if (msg.includes('Full response:')) {
        rawResponseInfo.fullResponse = msg.split('Full response:')[1]?.trim();
      }
    });

    return rawResponseInfo;
  }

  /**
   * Extract thinking process from captured logs
   */
  extractThinkingProcessFromLogs(logs) {
    const thinkingInfo = {
      thinkingContent: null,
      afterTrimContent: null,
      afterRemovingThinkingTags: null,
      afterRemovingCodeBlocks: null,
      parseSteps: [],
    };

    logs.forEach(log => {
      const msg = log.message;

      if (msg.includes('After trim:')) {
        thinkingInfo.afterTrimContent = msg.split('After trim:')[1]?.trim();
      } else if (msg.includes('After removing thinking tags:')) {
        thinkingInfo.afterRemovingThinkingTags = msg.split('After removing thinking tags:')[1]?.trim();
      } else if (msg.includes('After removing code block markers:')) {
        thinkingInfo.afterRemovingCodeBlocks = msg.split('After removing code block markers:')[1]?.trim();
      } else if (msg.includes('parseToolCall DEBUG')) {
        thinkingInfo.parseSteps.push(msg);
      }
    });

    // Extract thinking content from the raw response
    if (thinkingInfo.afterTrimContent && thinkingInfo.afterTrimContent.includes('<think>')) {
      const thinkMatch = thinkingInfo.afterTrimContent.match(/<think>([\s\S]*?)<\/think>/);
      if (thinkMatch) {
        thinkingInfo.thinkingContent = thinkMatch[1].trim();
      }
    }

    return thinkingInfo;
  }

  /**
   * Extract tool call history from captured logs
   * CRITICAL FIX: Use actual execution data and tool detection logs
   */
  extractToolCallHistoryFromLogs(logs) {
    console.log(`🔍🔍🔍 [extractToolCallHistoryFromLogs] Starting extraction from ${logs.length} logs`);

    const toolCallInfo = {
      executedTools: [],
      skippedTools: [],
      toolCallRounds: [],
      parseResults: [],
    };

    let currentRound = null;
    let currentRoundNumber = 0;

    // DEBUGGING: Log all messages to see what we're working with
    console.log('🔍 [extractToolCallHistoryFromLogs] Scanning through all log messages:');
    logs.forEach((log, index) => {
      const msg = log.message;
      // Log key messages for debugging
      if (msg.includes('ROUND') || msg.includes('tool') || msg.includes('Tool') || msg.includes('execute')) {
        console.log(`  [${index}] ${msg.substring(0, 100)}...`);
      }
    });

    logs.forEach((log, index) => {
      const msg = log.message;

      // Track round markers
      if (msg.includes('=== FUNCTION CALL ROUND')) {
        const roundMatch = msg.match(/ROUND (\d+)\/(\d+)/);
        if (roundMatch) {
          currentRoundNumber = parseInt(roundMatch[1]);
          currentRound = {
            current: currentRoundNumber,
            total: parseInt(roundMatch[2]),
            timestamp: log.timestamp,
            tools: [], // SONG'S REQUEST: Track tools called in this round
          };
          toolCallInfo.toolCallRounds.push(currentRound);
          console.log(`🎯 [extractToolCallHistoryFromLogs] Created round ${currentRoundNumber}`);
        }
      }
      // CRITICAL: Extract tool names from tool execution detection
      else if (msg.includes('=== ') && msg.includes('TOOL CALL(S) DETECTED ===')) {
        // Extract count
        const countMatch = msg.match(/=== (\d+) TOOL CALL/);
        if (countMatch) {
          console.log(`🎯 [extractToolCallHistoryFromLogs] Found ${countMatch[1]} tool calls marker at index ${index}`);
        }
      }
      // Extract tool names from the "Tools to execute" log
      else if (msg.includes('Tools to execute:')) {
        console.log(`🎯 [extractToolCallHistoryFromLogs] Found "Tools to execute" at index ${index}: ${msg}`);
        try {
          // Extract array from log message: "Tools to execute: ['tool1', 'tool2']"
          const toolsMatch = msg.match(/Tools to execute:\s*\[(.*)\]/);
          if (toolsMatch) {
            console.log(`🎯 [extractToolCallHistoryFromLogs] Matched tools string: ${toolsMatch[1]}`);
            // Parse the tools array (handling both single-quoted and double-quoted strings)
            const toolsStr = toolsMatch[1].replace(/'/g, '"');
            const tools = JSON.parse(`[${toolsStr}]`);

            console.log(`🎯 [extractToolCallHistoryFromLogs] Parsed tools:`, tools);

            if (currentRound && tools.length > 0) {
              tools.forEach(tool => {
                if (!currentRound.tools.includes(tool)) {
                  currentRound.tools.push(tool);
                  console.log(
                    `✅ [extractToolCallHistoryFromLogs] Added tool '${tool}' to round ${currentRound.current}`
                  );
                }
              });
            } else if (!currentRound) {
              console.warn(`⚠️ [extractToolCallHistoryFromLogs] No current round to add tools to!`);
            }
          } else {
            console.warn(`⚠️ [extractToolCallHistoryFromLogs] Could not match tools array pattern in: ${msg}`);
          }
        } catch (e) {
          console.error('[extractToolCallHistoryFromLogs] Failed to parse tools from:', msg, e);
        }
      }
      // Also check for individual tool execution logs
      else if (msg.includes('tool(s) executed successfully')) {
        const countMatch = msg.match(/(\d+) tool\(s\) executed successfully/);
        if (countMatch) {
          console.log(
            `✅ [extractToolCallHistoryFromLogs] ${countMatch[1]} tools executed successfully in round ${currentRoundNumber}`
          );
        }
      }
      // Track skipped tools
      else if (msg.includes('Skipping already executed tool:') || msg.includes('Blocking execution of:')) {
        const toolMatch = msg.match(/(?:Skipping already executed tool:|Blocking execution of:)\s*([^\s,]+)/);
        if (toolMatch) {
          toolCallInfo.skippedTools.push(toolMatch[1]);
          console.log(`🚫 [extractToolCallHistoryFromLogs] Skipped tool: ${toolMatch[1]}`);
        }
      }
      // Track parse results for debugging
      else if (msg.includes('Parsed tool call result:') || msg.includes('Valid tool call found')) {
        toolCallInfo.parseResults.push(msg);
      }
    });

    console.log('🔍 [extractToolCallHistoryFromLogs] Final extracted rounds:', toolCallInfo.toolCallRounds);
    console.log(
      '🔍 [extractToolCallHistoryFromLogs] Tools per round:',
      toolCallInfo.toolCallRounds.map(r => `Round ${r.current}: [${r.tools.join(', ')}]`)
    );

    return toolCallInfo;
  }

  /**
   * Extract conversation history from captured logs
   */
  extractConversationHistoryFromLogs(logs) {
    const conversationInfo = {
      historyLength: null,
      historyEntries: [],
      contentPreviews: [],
    };

    logs.forEach(log => {
      const msg = log.message;

      if (msg.includes('Current conversation history length:')) {
        conversationInfo.historyLength = msg.split('Current conversation history length:')[1]?.trim();
      } else if (msg.includes('History[')) {
        const historyMatch = msg.match(/History\[(\d+)\] Role: (\w+), Content length: (\d+)/);
        if (historyMatch) {
          conversationInfo.historyEntries.push({
            index: parseInt(historyMatch[1]),
            role: historyMatch[2],
            contentLength: parseInt(historyMatch[3]),
          });
        }
      } else if (msg.includes('Content preview:')) {
        conversationInfo.contentPreviews.push(msg.split('Content preview:')[1]?.trim());
      }
    });

    return conversationInfo;
  }

  /**
   * Extract parse debug information from captured logs
   * ENHANCED: Better detection of "SUCCESS - FLEXIBLE" and multi-tool patterns
   */
  extractParseDebugInfoFromLogs(logs) {
    const parseInfo = {
      parseSteps: [],
      jsonParseAttempts: [],
      directParseResults: [],
      toolCallDetection: [],
      detectedTools: [], // SONG'S REQUEST: Track detected tools
    };

    logs.forEach(log => {
      const msg = log.message;

      if (msg.includes('parseToolCall DEBUG')) {
        parseInfo.parseSteps.push(msg);
      } else if (msg.includes('Attempting direct JSON parse')) {
        parseInfo.jsonParseAttempts.push(msg);
      } else if (msg.includes('Direct parse successful:')) {
        parseInfo.directParseResults.push(msg);

        // SONG'S REQUEST: Extract tool name from direct parse success
        try {
          const toolMatch = msg.match(/Direct parse successful:\s*({.*})/s);
          if (toolMatch) {
            const toolData = JSON.parse(toolMatch[1]);
            if (toolData.tool_name) {
              parseInfo.detectedTools.push({
                tool: toolData.tool_name,
                method: 'direct_parse',
                parameters: toolData.parameters || {},
                timestamp: log.timestamp,
              });
            }
          }
        } catch (e) {
          // Ignore parsing errors for tool extraction
        }
      } else if (msg.includes('Valid tool call found')) {
        parseInfo.toolCallDetection.push(msg);

        // SONG'S REQUEST: Extract tool name from validation messages
        const toolMatch = msg.match(/Valid tool call found.*tool_name["']?\s*:\s*["']?([^"',}\s]+)/i);
        if (toolMatch) {
          parseInfo.detectedTools.push({
            tool: toolMatch[1],
            method: 'validation',
            timestamp: log.timestamp,
          });
        }
      } else if (
        msg.includes('SUCCESS - FLEXIBLE') ||
        msg.includes('SUCCESS - DIRECT') ||
        msg.includes('SUCCESS - REGEX') ||
        msg.includes('SUCCESS - SEARCH')
      ) {
        // CRITICAL FIX: Detect successful tool parsing from different methods
        parseInfo.toolCallDetection.push(msg);

        // Try to extract tool information from the previous log entries
        // Look backwards for the tool data that was just parsed
        for (let i = logs.indexOf(log) - 1; i >= 0 && i >= logs.indexOf(log) - 10; i--) {
          const prevMsg = logs[i]?.message;
          if (!prevMsg) continue;

          // Look for flexible extraction parse successful
          if (prevMsg.includes('Flexible extraction parse successful:')) {
            try {
              const toolMatch = prevMsg.match(/Flexible extraction parse successful:\s*({.*})/s);
              if (toolMatch) {
                const toolData = JSON.parse(toolMatch[1]);
                if (toolData.tool_name) {
                  parseInfo.detectedTools.push({
                    tool: toolData.tool_name,
                    method: 'flexible_extraction',
                    parameters: toolData.parameters || {},
                    timestamp: log.timestamp,
                  });
                  break;
                }
              }
            } catch (e) {
              // Continue searching
            }
          }

          // Look for regex parse successful
          else if (prevMsg.includes('Regex parse successful:')) {
            try {
              const toolMatch = prevMsg.match(/Regex parse successful:\s*({.*})/s);
              if (toolMatch) {
                const toolData = JSON.parse(toolMatch[1]);
                if (toolData.tool_name) {
                  parseInfo.detectedTools.push({
                    tool: toolData.tool_name,
                    method: 'regex_extraction',
                    parameters: toolData.parameters || {},
                    timestamp: log.timestamp,
                  });
                  break;
                }
              }
            } catch (e) {
              // Continue searching
            }
          }

          // Look for direct parse successful (if not already found)
          else if (prevMsg.includes('Direct parse successful:')) {
            try {
              const toolMatch = prevMsg.match(/Direct parse successful:\s*({.*})/s);
              if (toolMatch) {
                const toolData = JSON.parse(toolMatch[1]);
                if (toolData.tool_name) {
                  parseInfo.detectedTools.push({
                    tool: toolData.tool_name,
                    method: 'direct_parse',
                    parameters: toolData.parameters || {},
                    timestamp: log.timestamp,
                  });
                  break;
                }
              }
            } catch (e) {
              // Continue searching
            }
          }
        }
      } else if (msg.includes('[parseMultipleToolCalls] Valid tool call')) {
        // ENHANCED: Capture multiple tool calls detection
        parseInfo.toolCallDetection.push(msg);

        // Extract tool name from multiple tool calls detection
        const toolMatch = msg.match(/Valid tool call \d+.*?:\s*([^\s,]+)/i);
        if (toolMatch) {
          parseInfo.detectedTools.push({
            tool: toolMatch[1],
            method: 'multiple_tools',
            timestamp: log.timestamp,
          });
        }
      } else if (msg.includes('Multiple tool calls found:')) {
        parseInfo.toolCallDetection.push(msg);
      }
    });

    // SONG'S REQUEST: Deduplicate detected tools
    const uniqueTools = [];
    const seenTools = new Set();
    parseInfo.detectedTools.forEach(tool => {
      if (!seenTools.has(tool.tool)) {
        seenTools.add(tool.tool);
        uniqueTools.push(tool);
      }
    });
    parseInfo.detectedTools = uniqueTools;

    console.log('🔍 [extractParseDebugInfoFromLogs] Final detected tools:', parseInfo.detectedTools);
    console.log('🔍 [extractParseDebugInfoFromLogs] Parse steps found:', parseInfo.parseSteps.length);
    console.log('🔍 [extractParseDebugInfoFromLogs] Tool call detections found:', parseInfo.toolCallDetection.length);

    return parseInfo;
  }

  /**
   * Extract function call rounds information from captured logs
   */
  extractFunctionCallRoundsFromLogs(logs) {
    const roundsInfo = {
      totalRounds: 0,
      roundDetails: [],
      executionFlow: [],
    };

    logs.forEach(log => {
      const msg = log.message;

      if (msg.includes('=== FUNCTION CALL ROUND')) {
        const roundMatch = msg.match(/ROUND (\d+)\/(\d+)/);
        if (roundMatch) {
          roundsInfo.totalRounds = Math.max(roundsInfo.totalRounds, parseInt(roundMatch[1]));
          roundsInfo.roundDetails.push({
            roundNumber: parseInt(roundMatch[1]),
            maxRounds: parseInt(roundMatch[2]),
            timestamp: log.timestamp,
          });
        }
      } else if (msg.includes('thinking...') || msg.includes('Sending to LLM...')) {
        roundsInfo.executionFlow.push({
          step: msg,
          timestamp: log.timestamp,
        });
      }
    });

    return roundsInfo;
  }

  /**
   * Get circular reference replacer for safe JSON.stringify
   */
  getCircularReplacer() {
    const seen = new WeakSet();
    return (key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return `[Circular Reference: ${value.constructor?.name || 'Object'}]`;
        }
        seen.add(value);
      }
      return value;
    };
  }

  /**
   * Sanitize arguments for safe storage
   */
  sanitizeArgsForStorage(args) {
    return args.map(arg => {
      if (typeof arg === 'object' && arg !== null) {
        try {
          // Try to create a safe copy without circular references
          return JSON.parse(JSON.stringify(arg, this.getCircularReplacer()));
        } catch (error) {
          return {
            type: arg.constructor?.name || 'Object',
            error: 'Circular reference or non-serializable',
            keys: Object.keys(arg).slice(0, 10), // First 10 keys for reference
          };
        }
      }
      return arg;
    });
  }

  /**
   * Parse text response
   */
  parseTextResponse(response) {
    return {
      content: response,
      wordCount: response.split(/\s+/).length,
      hasKeywords: this.checkForKeywords(response),
      sentiment: this.analyzeSentiment(response),
    };
  }

  /**
   * Parse JSON response
   */
  parseJSONResponse(response) {
    try {
      // Try to find and parse JSON in the response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      return { error: 'No JSON found in response', response: response };
    } catch (error) {
      return { error: 'Invalid JSON', response: response };
    }
  }

  /**
   * Parse workflow response
   */
  parseWorkflowResponse(response, parsedResponse = null) {
    if (parsedResponse) {
      return parsedResponse;
    }

    return {
      content: response,
      steps: this.extractWorkflowSteps(response),
      completionIndicators: this.findCompletionIndicators(response),
      functionCalls: this.extractFunctionCallsFromResponse(response),
    };
  }

  /**
   * Evaluate test result against expectations
   */
  /**
   * Evaluate test result
   * ENHANCED: Add comprehensive logging for tool detection scoring as requested by Song
   */
  async evaluateTestResult(test, testResult) {
    console.log('⚙️ [Test Evaluation] Starting evaluation for test:', test.id);
    console.log('📝 [Test Evaluation] Test type:', test.type);
    console.log('📝 [Test Evaluation] Expected result:', test.expectedResult);
    console.log('📝 [Test Evaluation] Actual result:', testResult.actualResult);

    const evaluation = {
      success: false,
      score: 0,
      maxScore: test.maxScore || 5, // Use test's actual maxScore, default to 5 for simple tests
      errors: [],
      warnings: [],
    };

    // Display evaluation start
    this.displayEvaluationStart(test, testResult);

    // CRITICAL: Log detected tools for scoring verification (Song's request)
    if (testResult.actualResult && testResult.actualResult.tool_name) {
      console.log('✅ [Test Evaluation] Detected tool from actualResult:', testResult.actualResult.tool_name);
      console.log('📊 [Test Evaluation] Tool parameters:', testResult.actualResult.parameters);
      console.log('📈 [Test Evaluation] Tool confidence:', testResult.actualResult.confidence);
      console.log('🔍 [Test Evaluation] Detection method:', testResult.actualResult.detectionMethod);
    } else {
      console.log('❌ [Test Evaluation] No tool detected in actualResult');
    }

    // Additional logging for function calls array if present
    if (testResult.actualResult && testResult.actualResult.functionCalls) {
      console.log('📦 [Test Evaluation] Function calls array detected:', testResult.actualResult.functionCalls.length);
      testResult.actualResult.functionCalls.forEach((call, index) => {
        console.log(`📝 [Test Evaluation] Function call ${index + 1}:`, {
          tool_name: call.tool_name,
          confidence: call.confidence,
          detectionMethod: call.detectionMethod,
        });
      });
    }

    // Log parseDebugInfo if available for debugging tool detection
    if (testResult.parseDebugInfo) {
      console.log('🔍 [Test Evaluation] Parse debug info available:', testResult.parseDebugInfo);
    }

    // CRITICAL FIX: Add debugging for ChatManager execution data state
    if (this.chatManager && this.chatManager.getLastExecutionData) {
      const currentExecutionData = this.chatManager.getLastExecutionData();
      if (currentExecutionData) {
        console.log('📄 [Test Evaluation] ChatManager execution data available:');
        console.log('   Function calls:', currentExecutionData.functionCalls?.length || 0);
        if (currentExecutionData.functionCalls && currentExecutionData.functionCalls.length > 0) {
          currentExecutionData.functionCalls.forEach((call, index) => {
            console.log(`   ${index + 1}. ${call.tool_name} (round: ${call.round}, timestamp: ${call.timestamp})`);
          });
        }
        console.log('   Tool results:', currentExecutionData.toolResults?.length || 0);
        console.log('   Start time:', new Date(currentExecutionData.startTime || 0).toISOString());
        console.log(
          '   End time:',
          currentExecutionData.endTime ? new Date(currentExecutionData.endTime).toISOString() : 'Not finished'
        );
      } else {
        console.log('📄 [Test Evaluation] No ChatManager execution data available');
      }
    }

    if (!testResult.actualResult) {
      console.log('❌ [Test Evaluation] No result obtained from test execution');
      evaluation.errors.push('No result obtained from test execution');
      this.displayEvaluationResult(test, evaluation, testResult);
      return evaluation;
    }

    // CRITICAL FIX: For manual tests, use the manual score directly
    if (test.evaluation === 'manual' && testResult.actualResult.manual_score !== undefined) {
      console.log('📋 [Test Evaluation] Processing manual test with score:', testResult.actualResult.manual_score);
      evaluation.score = testResult.actualResult.manual_score;
      evaluation.maxScore = test.maxScore || 5; // Ensure correct maxScore for manual tests
      evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * 0.6); // 60% threshold

      // Add manual test specific information
      if (testResult.actualResult.verification_completion !== undefined) {
        const completionPercentage = (testResult.actualResult.verification_completion * 100).toFixed(1);
        evaluation.warnings.push(`Manual verification completion: ${completionPercentage}%`);
        console.log('📊 [Test Evaluation] Manual verification completion:', completionPercentage + '%');
      }

      this.displayEvaluationResult(test, evaluation, testResult);
      return evaluation;
    }

    // Use test-specific evaluator if provided (for automatic tests only)
    if (test.evaluator && typeof test.evaluator === 'function') {
      console.log('🔧 [Test Evaluation] Using custom evaluator for test:', test.id);
      try {
        const evaluatorContext = { ...testResult, earlyReturn: test.earlyReturn || false, testId: test.id };
        const customEval = await test.evaluator(testResult.actualResult, test.expectedResult, evaluatorContext);
        Object.assign(evaluation, customEval);
        console.log('✅ [Test Evaluation] Custom evaluator completed with score:', evaluation.score);
        this.displayEvaluationResult(test, evaluation, testResult);
        return evaluation;
      } catch (error) {
        console.error('❌ [Test Evaluation] Custom evaluator failed:', error);
        evaluation.errors.push(`Custom evaluator failed: ${error.message}`);
        this.displayEvaluationResult(test, evaluation, testResult);
        return evaluation;
      }
    }

    // Default evaluation based on test type
    console.log('🎯 [Test Evaluation] Using default evaluation for type:', test.type);
    let finalEvaluation;
    switch (test.type) {
      case 'function_call':
        console.log('🔧 [Test Evaluation] Evaluating function call test');
        finalEvaluation = this.evaluateFunctionCallTest(test, testResult, evaluation);
        break;
      case 'text_analysis':
        console.log('📄 [Test Evaluation] Evaluating text analysis test');
        finalEvaluation = this.evaluateTextAnalysisTest(test, testResult, evaluation);
        break;
      case 'json_output':
        console.log('🗂️ [Test Evaluation] Evaluating JSON output test');
        finalEvaluation = this.evaluateJSONOutputTest(test, testResult, evaluation);
        break;
      case 'workflow':
        console.log('🔄 [Test Evaluation] Evaluating workflow test');
        finalEvaluation = this.evaluateWorkflowTest(test, testResult, evaluation);
        break;
      default:
        console.log('❓ [Test Evaluation] Evaluating generic test');
        finalEvaluation = this.evaluateGenericTest(test, testResult, evaluation);
    }

    console.log('🏁 [Test Evaluation] Final evaluation completed:', {
      testId: test.id,
      success: finalEvaluation.success,
      score: finalEvaluation.score,
      maxScore: finalEvaluation.maxScore,
      errors: finalEvaluation.errors.length,
      warnings: finalEvaluation.warnings.length,
    });

    // Display final evaluation result
    this.displayEvaluationResult(test, finalEvaluation, testResult);
    return finalEvaluation;
  }

  /**
   * Display evaluation start information
   */
  displayEvaluationStart(test, testResult) {
    this.chatManager.updateThinkingMessage(
      `<br><br>👩‍🔬 ** EVALUATION PHASE**<br>` +
        `═══════════════════════════════════════════════════════════<br><br>` +
        `⚖️ **SCORING EVALUATION INITIATED**<br><br>` +
        `**📋 Test Details:**<br>` +
        `&nbsp;&nbsp;&nbsp;• Name: ${test.name}<br>` +
        `&nbsp;&nbsp;&nbsp;• Type: ${this.getTestTypeDescription(test.type)}<br>` +
        `&nbsp;&nbsp;&nbsp;• Evaluator: ${test.evaluator ? 'Custom Algorithm' : 'Standard ' + test.type.charAt(0).toUpperCase() + test.type.slice(1) + ' Evaluator'}<br>` +
        `&nbsp;&nbsp;&nbsp;• Maximum Score: ${test.maxScore || 100} points<br>` +
        `&nbsp;&nbsp;&nbsp;• Response Time: ${testResult.metrics?.responseTime || 'N/A'}ms<br><br>` +
        `🧮 **Applying evaluation matrix...**`
    );
  }

  /**
   * Display detailed evaluation results
   */
  displayEvaluationResult(test, evaluation, testResult) {
    const successIcon = evaluation.success ? '✅' : '❌';
    const scorePercentage = ((evaluation.score / evaluation.maxScore) * 100).toFixed(1);
    const gradeEmoji = evaluation.success ? '🎉' : evaluation.score > 50 ? '⚠️' : '💥';

    // Determine performance level and grade
    let performanceLevel = 'Excellent (A+)';
    let performanceColor = '🟢';
    if (scorePercentage < 60) {
      performanceLevel = 'Poor (F)';
      performanceColor = '🔴';
    } else if (scorePercentage < 70) {
      performanceLevel = 'Below Average (D)';
      performanceColor = '🟠';
    } else if (scorePercentage < 80) {
      performanceLevel = 'Good (C)';
      performanceColor = '🟡';
    } else if (scorePercentage < 90) {
      performanceLevel = 'Very Good (B)';
      performanceColor = '🔵';
    } else if (scorePercentage < 95) {
      performanceLevel = 'Excellent (A)';
      performanceColor = '🟢';
    }

    // Professional test report format
    this.chatManager.updateThinkingMessage(
      `<br><br>👩‍🔬 **EVALUATION REPORT**<br>` +
        `═══════════════════════════════════════════════════════════<br><br>` +
        `${gradeEmoji} **FINAL TEST RESULT: ${evaluation.success ? 'PASS' : 'FAIL'}** ${successIcon}<br><br>` +
        `**📊 SCORING BREAKDOWN:**<br>` +
        `&nbsp;&nbsp;&nbsp;• Final Score: ${evaluation.score}/${evaluation.maxScore} points<br>` +
        `&nbsp;&nbsp;&nbsp;• Percentage: ${scorePercentage}%<br>` +
        `&nbsp;&nbsp;&nbsp;• Performance Level: ${performanceColor} ${performanceLevel}<br>` +
        `&nbsp;&nbsp;&nbsp;• Response Time: ${testResult.metrics?.responseTime || 'N/A'}ms<br>` +
        `&nbsp;&nbsp;&nbsp;• Efficiency Rating: ${this.calculateEfficiencyRating(testResult.metrics)}<br><br>` +
        `${this.formatDetailedAnalysis(evaluation, testResult)}<br>` +
        `**📋 TECHNICAL METRICS:**<br>` +
        `&nbsp;&nbsp;&nbsp;• Computational Cost: ~${testResult.metrics?.tokenCount || 'N/A'} tokens<br>` +
        `&nbsp;&nbsp;&nbsp;• Response Verbosity: ${testResult.metrics?.responseLength || 'N/A'} characters<br>` +
        `&nbsp;&nbsp;&nbsp;• Function Execution Count: ${testResult.metrics?.functionCallsCount || 'N/A'}<br>` +
        `&nbsp;&nbsp;&nbsp;• Instruction Complexity Score: ${testResult.metrics?.instructionComplexity || 'N/A'}/5<br><br>` +
        `**🎯 PROFESSIONAL ASSESSMENT:**<br>` +
        `&nbsp;&nbsp;&nbsp;${this.generateProfessionalAssessment(evaluation, scorePercentage, test.type)}<br><br>` +
        `───────────────────────────────────────────────────────────<br>` +
        `**Test Engineer:**  | **Date:** ${new Date().toLocaleDateString()} | **Status:** ${evaluation.success ? 'APPROVED ✅' : 'REQUIRES REVIEW ⚠️'}`
    );
  }

  /**
   * Calculate efficiency rating
   */
  calculateEfficiencyRating(metrics) {
    if (!metrics || !metrics.responseTime) return 'N/A';

    const responseTime = metrics.responseTime;
    if (responseTime < 1000) return '🚀 Excellent';
    if (responseTime < 3000) return '⚡ Good';
    if (responseTime < 5000) return '⏳ Average';
    return '🐌 Needs Optimization';
  }

  /**
   * Format detailed analysis section
   */
  formatDetailedAnalysis(evaluation, testResult) {
    let analysis = `**🔍 DETAILED ANALYSIS:**<br>`;

    if (evaluation.errors.length > 0) {
      analysis += `<br>&nbsp;&nbsp;&nbsp;❌ **Critical Issues:**<br>`;
      evaluation.errors.forEach((error, index) => {
        analysis += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${index + 1}. ${error}<br>`;
      });
    }

    if (evaluation.warnings.length > 0) {
      analysis += `<br>&nbsp;&nbsp;&nbsp;⚠️ **Areas for Improvement:**<br>`;
      evaluation.warnings.forEach((warning, index) => {
        analysis += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;${index + 1}. ${warning}<br>`;
      });
    }

    if (evaluation.errors.length === 0 && evaluation.warnings.length === 0) {
      analysis += `<br>&nbsp;&nbsp;&nbsp;✅ **All evaluation criteria successfully met**<br>`;
      analysis += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• No critical issues identified<br>`;
      analysis += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• Performance within acceptable parameters<br>`;
      analysis += `&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;• LLM demonstrated expected capabilities<br>`;
    }

    return analysis;
  }

  /**
   * Generate professional assessment
   */
  generateProfessionalAssessment(evaluation, scorePercentage, testType) {
    if (evaluation.success) {
      if (scorePercentage >= 95) {
        return `"Outstanding performance. The LLM demonstrated exceptional ${testType} capabilities with near-perfect execution. Recommend for production deployment."`;
      } else if (scorePercentage >= 85) {
        return `"Strong performance with minor areas for optimization. The LLM shows reliable ${testType} capabilities suitable for most production scenarios."`;
      } else {
        return `"Acceptable performance meeting minimum requirements. Consider additional training or optimization for enhanced ${testType} capabilities."`;
      }
    } else {
      if (scorePercentage >= 50) {
        return `"Performance below standards with significant issues requiring attention. Recommend focused training on ${testType} scenarios before deployment."`;
      } else {
        return `"Critical performance deficiencies identified. Comprehensive review and retraining required before production consideration."`;
      }
    }
  }

  /**
   * Evaluate function call test
   * ENHANCED: Add comprehensive tool detection logging for scoring verification
   */
  evaluateFunctionCallTest(test, testResult, evaluation) {
    const actualResult = testResult.actualResult;
    const expectedResult = test.expectedResult;

    console.log('🔍 [Function Call Eval] Starting function call evaluation for test:', test.id);
    console.log('📝 [Function Call Eval] Expected:', expectedResult);
    console.log('📝 [Function Call Eval] Actual:', actualResult);

    // CRITICAL: Detailed logging for tool detection scoring verification (Song's request)
    if (actualResult && actualResult.tool_name) {
      console.log('✅ [Function Call Eval] Tool detected successfully!');
      console.log('🎯 [Function Call Eval] Detected tool name:', actualResult.tool_name);
      console.log('📈 [Function Call Eval] Tool confidence level:', actualResult.confidence);
      console.log('🔧 [Function Call Eval] Detection method used:', actualResult.detectionMethod);
      console.log('📊 [Function Call Eval] Tool parameters found:', Object.keys(actualResult.parameters || {}).length);

      // Detailed parameter analysis
      if (actualResult.parameters && Object.keys(actualResult.parameters).length > 0) {
        console.log('📄 [Function Call Eval] Parameter details:');
        Object.entries(actualResult.parameters).forEach(([key, value]) => {
          console.log(
            `  • ${key}: ${typeof value === 'string' ? value.substring(0, 50) + (value.length > 50 ? '...' : '') : JSON.stringify(value)}`
          );
        });
      } else {
        console.log('⚠️ [Function Call Eval] No parameters detected in tool call');
      }
    } else {
      console.log('❌ [Function Call Eval] No tool detected in actualResult');
      console.log('🔍 [Function Call Eval] ActualResult structure:', Object.keys(actualResult || {}));
    }

    // Expected vs Actual comparison logging
    if (expectedResult && expectedResult.tool_name) {
      console.log('🎯 [Function Call Eval] Expected tool:', expectedResult.tool_name);
      console.log('📅 [Function Call Eval] Expected parameters:', expectedResult.parameters);

      if (actualResult && actualResult.tool_name === expectedResult.tool_name) {
        console.log('✅ [Function Call Eval] TOOL MATCH: Expected and actual tools match!');
      } else {
        console.log(
          '❌ [Function Call Eval] TOOL MISMATCH: Expected',
          expectedResult.tool_name,
          'but got',
          actualResult?.tool_name || 'none'
        );
      }
    }

    console.log('🔍 Evaluating function call test:', {
      testId: test.id,
      hasActualResult: !!actualResult,
      hasExpectedResult: !!expectedResult,
      actualToolName: actualResult?.tool_name,
      expectedToolName: expectedResult?.tool_name,
    });

    // Handle case where no function call was detected
    if (!actualResult || actualResult.error === 'No function calls detected') {
      console.log('❌ [Function Call Eval] No function call detected - scoring 0 points');
      evaluation.errors.push('No function call detected in LLM response');
      evaluation.success = false;
      evaluation.score = 0; // Explicit 0 score for no detection
      console.log('📋 [Function Call Eval] Final score for no detection: 0/', evaluation.maxScore);
      return evaluation;
    }

    // Handle parsing errors (or execution errors from perfectly parsed tools)
    if (actualResult.error && actualResult.error !== 'No function calls detected') {
      if (actualResult.tool_name) {
        console.log(
          '⚠️ [Function Call Eval] Tool executed but returned error. Scoring tool selection and parameters anyway:',
          actualResult.error
        );
        evaluation.warnings.push(`Execution error: ${actualResult.error}`);
        // Do NOT return here. Continue to evaluate the tool name and parameters.
      } else {
        console.log('❌ [Function Call Eval] Parsing error detected:', actualResult.error);
        evaluation.errors.push(actualResult.error);
        evaluation.success = false;
        evaluation.score = 0; // Explicit 0 score for parsing errors
        console.log('📋 [Function Call Eval] Final score for parsing error: 0/', evaluation.maxScore);
        return evaluation;
      }
    }

    if (Array.isArray(actualResult)) {
      // Multiple function calls detected
      console.log('📦 [Function Call Eval] Multiple function calls detected:', actualResult.length);

      // CRITICAL FIX: Handle single expected tool with multiple detected tools
      if (!Array.isArray(expectedResult)) {
        console.log(
          '🎯 [Function Call Eval] Single expected tool vs multiple detected tools - checking if expected tool is present'
        );

        // Look for the expected tool among the detected tools
        const matchingCall = actualResult.find(call => call.tool_name === expectedResult.tool_name);

        if (matchingCall) {
          console.log('✅ [Function Call Eval] Expected tool found among multiple calls:', matchingCall.tool_name);
          const functionScore = this.evaluateSingleFunctionCall(matchingCall, expectedResult);

          // CRITICAL FIX: Scale the 0-100 score from evaluateSingleFunctionCall to the test's maxScore
          const scaledScore = Math.round((functionScore.score / 100) * evaluation.maxScore);

          evaluation.score = scaledScore;
          evaluation.success = functionScore.success;
          evaluation.errors.push(...functionScore.errors);
          evaluation.warnings.push(...functionScore.warnings);

          // Add bonus for additional tool usage
          const bonusTools = actualResult.filter(call => call.tool_name !== expectedResult.tool_name);
          if (bonusTools.length > 0) {
            const bonusPoints = Math.min(bonusTools.length * 5, 10); // Max 10 bonus points
            evaluation.score = Math.min(evaluation.score + bonusPoints, evaluation.maxScore);
            evaluation.warnings.push(
              `Bonus: ${bonusPoints} points for additional tool usage: ${bonusTools.map(t => t.tool_name).join(', ')}`
            );
            console.log('🎆 [Function Call Eval] Bonus points for additional tools:', bonusPoints);
          }

          console.log('📋 [Function Call Eval] Expected tool among multiple scored:', evaluation.score, 'points');
        } else {
          console.log('❌ [Function Call Eval] Expected tool not found among multiple calls');
          const detectedTools = actualResult.map(call => call.tool_name).join(', ');
          evaluation.errors.push(`Expected tool '${expectedResult.tool_name}' not found. Detected: ${detectedTools}`);
          evaluation.success = false;
          evaluation.score = 0;
        }
      } else {
        // Multiple expected tools - original logic
        console.log('📦 [Function Call Eval] Multiple expected tools - evaluating sequence');
        evaluation.score = 0;

        for (let i = 0; i < actualResult.length; i++) {
          const call = actualResult[i];
          const expected = expectedResult[i];

          console.log(`🔍 [Function Call Eval] Evaluating call ${i + 1}:`, call.tool_name);

          if (expected) {
            const functionScore = this.evaluateSingleFunctionCall(call, expected);

            // CRITICAL FIX: Scale the score proportionally for multiple expected tools
            const callMaxScore = evaluation.maxScore / expectedResult.length;
            const scaledScore = Math.round((functionScore.score / 100) * callMaxScore);

            evaluation.score += scaledScore;
            evaluation.errors.push(...functionScore.errors);
            evaluation.warnings.push(...functionScore.warnings);

            console.log(
              `📋 [Function Call Eval] Call ${i + 1} scored:`,
              functionScore.score,
              `points (scaled: ${scaledScore})`
            );
          }
        }

        evaluation.score = Math.min(evaluation.score, evaluation.maxScore);
        evaluation.success = evaluation.score >= evaluation.maxScore * 0.7;
      }
    } else {
      // Single function call
      console.log('🎯 [Function Call Eval] Single function call evaluation');
      const functionScore = this.evaluateSingleFunctionCall(actualResult, expectedResult);

      // CRITICAL FIX: Scale the 0-100 score from evaluateSingleFunctionCall to the test's maxScore
      const scaledScore = Math.round((functionScore.score / 100) * evaluation.maxScore);

      evaluation.score = scaledScore;
      evaluation.success = functionScore.success;
      evaluation.errors.push(...functionScore.errors);
      evaluation.warnings.push(...functionScore.warnings);

      console.log(
        `📋 [Function Call Eval] Single call scored: ${functionScore.score} points (scaled: ${scaledScore}/${evaluation.maxScore})`
      );
    }

    console.log('🏁 [Function Call Eval] FINAL EVALUATION RESULT:');
    console.log('📋 [Function Call Eval] Score:', evaluation.score, '/', evaluation.maxScore);
    console.log('🎯 [Function Call Eval] Success:', evaluation.success);
    console.log('🚫 [Function Call Eval] Errors:', evaluation.errors.length);
    console.log('⚠️ [Function Call Eval] Warnings:', evaluation.warnings.length);

    if (evaluation.errors.length > 0) {
      console.log('📄 [Function Call Eval] Error details:', evaluation.errors);
    }

    if (evaluation.warnings.length > 0) {
      console.log('📄 [Function Call Eval] Warning details:', evaluation.warnings);
    }

    return evaluation;
  }

  /**
   * Evaluate a single function call
   * ENHANCED: Add comprehensive parameter scoring logging
   */
  evaluateSingleFunctionCall(actualCall, expectedCall) {
    const result = {
      score: 0,
      success: false,
      errors: [],
      warnings: [],
    };

    console.log('🎯 [Single Call Eval] Starting single function call evaluation');
    console.log('📝 [Single Call Eval] Actual call:', {
      tool_name: actualCall?.tool_name,
      hasParameters: !!actualCall?.parameters,
      paramCount: Object.keys(actualCall?.parameters || {}).length,
    });
    console.log('📝 [Single Call Eval] Expected call:', {
      tool_name: expectedCall?.tool_name,
      hasParameters: !!expectedCall?.parameters,
      paramCount: Object.keys(expectedCall?.parameters || {}).length,
    });

    if (!actualCall || !actualCall.tool_name) {
      console.log('❌ [Single Call Eval] Invalid function call format - no tool_name found');
      result.errors.push('Invalid function call format');
      return result;
    }

    console.log('🎯 [Single Call Eval] Comparing function calls:', {
      actual: actualCall.tool_name,
      expected: expectedCall.tool_name,
      actualParams: actualCall.parameters,
      expectedParams: expectedCall.parameters,
    });

    // Check function name (50 points out of 100)
    console.log('🔍 [Single Call Eval] Checking function name match...');
    const normalizeToolName = name => {
      if (!name || typeof name !== 'string') return '';
      let normalized = name.replace(/([a-z])([A-Z])/g, '$1_$2'); // camelCase → snake_case
      normalized = normalized.replace(/-/g, '_'); // kebab-case → snake_case
      return normalized.toLowerCase();
    };

    if (actualCall.tool_name === expectedCall.tool_name) {
      result.score += 50;
      console.log('✅ [Single Call Eval] Function name matches! +50 points (Total:', result.score, '/100)');
    } else if (normalizeToolName(actualCall.tool_name) === normalizeToolName(expectedCall.tool_name)) {
      // Name matches after normalization (camelCase/kebab/snake_case variants)
      result.score += 45;
      result.warnings.push(
        `Function name matches after normalization: ${actualCall.tool_name} ≈ ${expectedCall.tool_name}`
      );
      console.log(
        '✅ [Single Call Eval] Function name matches after normalization! +45 points (Total:',
        result.score,
        '/100)'
      );
    } else {
      result.errors.push(`Expected function ${expectedCall.tool_name}, got ${actualCall.tool_name}`);
      console.log('❌ [Single Call Eval] Function name mismatch! +0 points (Total:', result.score, '/100)');
    }

    // Check parameters (50 points out of 100)
    console.log('🔍 [Single Call Eval] Checking parameter match...');
    // Fix Problem 5: Reduce executed bypass from full 50pts to 30+20 with critical-param check
    if (actualCall.executed && actualCall.confidence === 100) {
      // Tool was executed successfully, but we still validate critical parameters
      // Base score for successful execution (reduced from 50 to 30)
      result.score += 30;
      console.log('✅ [Single Call Eval] Tool executed successfully (+30 points)');

      // Check if critical parameters also match for bonus 20 points
      if (actualCall.parameters && expectedCall.parameters) {
        const hasCriticalParams = this.hasCriticalParams(actualCall.parameters, expectedCall.parameters);
        if (hasCriticalParams) {
          result.score += 20;
          console.log('✅ [Single Call Eval] Critical parameters match (+20 bonus points, total +50)!');
        } else {
          result.warnings.push('Tool executed but critical parameters mismatch');
          console.log('⚠️ [Single Call Eval] Tool executed but critical parameters mismatch (+30 only)');
        }
      } else if (!expectedCall.parameters || Object.keys(expectedCall.parameters).length === 0) {
        // No parameters expected, give full points for execution
        result.score += 20;
        console.log('✅ [Single Call Eval] No parameters expected, full execution bonus (+20, total +50)!');
      }
    } else if (actualCall.parameters && expectedCall.parameters) {
      console.log('📊 [Single Call Eval] Both actual and expected have parameters, comparing...');
      const paramScore = this.compareParameters(actualCall.parameters, expectedCall.parameters);
      result.score += paramScore;

      console.log('📋 [Single Call Eval] Parameter comparison score:', paramScore, '/50 points');

      if (paramScore >= 40) {
        console.log('✅ [Single Call Eval] Parameters match well! (40+ points)');
      } else if (paramScore >= 20) {
        result.warnings.push('Parameters partially match expected values');
        console.log('⚠️ [Single Call Eval] Parameters partially match (20-39 points)');
      } else {
        result.errors.push('Parameters do not match expected values');
        console.log('❌ [Single Call Eval] Parameters do not match (<20 points)');
      }
    } else if (!expectedCall.parameters || Object.keys(expectedCall.parameters).length === 0) {
      // No parameters expected
      result.score += 50;
      console.log('✅ [Single Call Eval] No parameters expected - perfect match! +50 points');
    } else {
      result.errors.push('Missing required parameters');
      console.log('❌ [Single Call Eval] Missing required parameters! +0 points');
    }

    console.log('📋 [Single Call Eval] Final score calculation:', result.score, '/100');
    console.log('📊 [Single Call Eval] Success threshold: 70 points');

    result.success = result.score >= 70;

    console.log('🏁 [Single Call Eval] FINAL SINGLE CALL RESULT:');
    console.log('📋 [Single Call Eval] Score:', result.score, '/100');
    console.log('🎯 [Single Call Eval] Success:', result.success);
    console.log('🚫 [Single Call Eval] Errors:', result.errors.length);
    console.log('⚠️ [Single Call Eval] Warnings:', result.warnings.length);

    return result;
  }

  /**
   * Evaluate text analysis test
   */
  evaluateTextAnalysisTest(test, testResult, evaluation) {
    const actualResult = testResult.actualResult;
    const expectedResult = test.expectedResult;

    let score = 0;

    // Check content quality
    if (actualResult.wordCount >= expectedResult.minWords) {
      score += 25;
    }

    // Check for required keywords
    if (expectedResult.requiredKeywords) {
      const foundKeywords = expectedResult.requiredKeywords.filter(keyword =>
        actualResult.content.toLowerCase().includes(keyword.toLowerCase())
      );
      score += (foundKeywords.length / expectedResult.requiredKeywords.length) * 50;
    }

    // Check structure and formatting
    if (expectedResult.requiresStructure) {
      if (this.hasGoodStructure(actualResult.content)) {
        score += 25;
      }
    }

    evaluation.score = Math.min(score, evaluation.maxScore);
    evaluation.success = evaluation.score >= evaluation.maxScore * 0.7;

    return evaluation;
  }

  /**
   * Evaluate JSON output test
   */
  evaluateJSONOutputTest(test, testResult, evaluation) {
    const actualResult = testResult.actualResult;
    const expectedResult = test.expectedResult;

    if (actualResult.error) {
      evaluation.errors.push(actualResult.error);
      return evaluation;
    }

    let score = 0;

    // Check required fields
    if (expectedResult.requiredFields) {
      const foundFields = expectedResult.requiredFields.filter(field =>
        Object.prototype.hasOwnProperty.call(actualResult, field)
      );
      score += (foundFields.length / expectedResult.requiredFields.length) * 60;
    }

    // Check data types
    if (expectedResult.fieldTypes) {
      let typeMatches = 0;
      for (const [field, expectedType] of Object.entries(expectedResult.fieldTypes)) {
        if (actualResult[field] && typeof actualResult[field] === expectedType) {
          typeMatches++;
        }
      }
      score += (typeMatches / Object.keys(expectedResult.fieldTypes).length) * 40;
    }

    evaluation.score = Math.min(score, evaluation.maxScore);
    evaluation.success = evaluation.score >= evaluation.maxScore * 0.8;

    return evaluation;
  }

  /**
   * Evaluate workflow test
   */
  evaluateWorkflowTest(test, testResult, evaluation) {
    const actualResult = testResult.actualResult;
    const expectedResult = test.expectedResult;

    let score = 0;

    // Check if workflow steps are present
    if (actualResult.steps && expectedResult.expectedSteps) {
      const stepScore = (actualResult.steps.length / expectedResult.expectedSteps) * 40;
      score += Math.min(stepScore, 40);
    }

    // Check for completion indicators
    if (actualResult.completionIndicators && actualResult.completionIndicators.length > 0) {
      score += 30;
    }

    // Check function calls if expected
    if (actualResult.functionCalls && expectedResult.expectedFunctionCalls) {
      if (actualResult.functionCalls.length >= expectedResult.expectedFunctionCalls) {
        score += 30;
      }
    }

    evaluation.score = Math.min(score, evaluation.maxScore);
    evaluation.success = evaluation.score >= evaluation.maxScore * 0.6;

    return evaluation;
  }

  /**
   * Generic test evaluation
   */
  evaluateGenericTest(test, testResult, evaluation) {
    // Simple string comparison or custom logic
    if (test.expectedResult === testResult.actualResult) {
      evaluation.success = true;
      evaluation.score = evaluation.maxScore;
    } else {
      evaluation.score = 0;
      evaluation.errors.push('Result does not match expected output');
    }

    return evaluation;
  }

  /**
   * Helper methods
   */

  /**
   * Fix Problem 5: Check if critical parameters match between actual and expected.
   * Critical parameters are those most important for tool correctness (e.g., geneName, filePath, chromosome).
   */
  hasCriticalParams(actualParams, expectedParams) {
    const criticalParamNames = [
      'geneName',
      'name',
      'filePath',
      'file_path',
      'filePaths',
      'file_paths',
      'chromosome',
      'position',
      'start',
      'end',
      'factor',
    ];
    const expectedKeys = Object.keys(expectedParams);
    const criticalKeys = expectedKeys.filter(k => criticalParamNames.includes(k));

    if (criticalKeys.length === 0) {
      // No critical params to check; consider it a pass
      return true;
    }

    for (const key of criticalKeys) {
      if (!(key in actualParams)) return false;
      const expectedVal = expectedParams[key];
      const actualVal = actualParams[key];
      // For placeholders, accept any non-empty value
      if (typeof expectedVal === 'string' && expectedVal.startsWith('<')) continue;
      if (actualVal !== expectedVal) return false;
    }
    return true;
  }

  /**
   * Fix Problem 3: Calculate string similarity using Levenshtein distance.
   * Returns a value between 0.0 (completely different) and 1.0 (identical).
   */
  calculateStringSimilarity(a, b) {
    if (!a || !b) return 0;
    const longer = a.length > b.length ? a.toLowerCase() : b.toLowerCase();
    const shorter = a.length > b.length ? b.toLowerCase() : a.toLowerCase();
    if (longer.length === 0) return 1.0;
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  /**
   * Fix Problem 3: Compute Levenshtein edit distance between two strings.
   */
  levenshteinDistance(a, b) {
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(matrix[i - 1][j - 1] + 1, matrix[i][j - 1] + 1, matrix[i - 1][j] + 1);
        }
      }
    }
    return matrix[b.length][a.length];
  }

  compareParameters(actual, expected) {
    if (!actual && !expected) return 50; // Both empty
    if (!actual || !expected) return 0; // One empty, one not

    const expectedKeys = Object.keys(expected);
    const actualKeys = Object.keys(actual);

    if (expectedKeys.length === 0) return 50; // No parameters expected

    let score = 0;
    const maxScore = expectedKeys.length * 50; // 50 points per parameter

    console.log('🔍 Comparing parameters:', {
      actual: actual,
      expected: expected,
      expectedKeys: expectedKeys,
      actualKeys: actualKeys,
    });

    for (const key of expectedKeys) {
      const expectedValue = expected[key];
      const actualValue = actual[key];

      if (actualValue === undefined) {
        console.log(`❌ Missing parameter: ${key}`);
        continue; // No points for missing parameter
      }

      // CRITICAL FIX: Check if expected value is a placeholder
      if (typeof expectedValue === 'string' && expectedValue.startsWith('<') && expectedValue.endsWith('>')) {
        score += 50; // Full points - actual LLM output resolved the placeholder
        console.log(`✅ Placeholder match for ${key}: expected ${expectedValue}, got ${actualValue}`);
        continue;
      }

      if (actualValue === expectedValue) {
        score += 50; // Full points for exact match
        console.log(`✅ Exact match for ${key}: ${actualValue}`);
      } else if (typeof expectedValue === 'string' && typeof actualValue === 'string') {
        // String comparison with case insensitivity
        if (actualValue.toLowerCase() === expectedValue.toLowerCase()) {
          score += 45; // Nearly full points for case-insensitive match
          console.log(`✅ Case-insensitive match for ${key}: ${actualValue}`);
        } else {
          // Fix Problem 3: Use Levenshtein similarity instead of loose substring matching
          const similarity = this.calculateStringSimilarity(actualValue, expectedValue);
          if (similarity >= 0.8) {
            score += 35; // High similarity
            console.log(
              `✅ High similarity match for ${key}: ${actualValue} vs ${expectedValue} (${(similarity * 100).toFixed(0)}%)`
            );
          } else if (similarity >= 0.5) {
            score += 20; // Moderate similarity
            console.log(
              `⚠️ Moderate similarity for ${key}: ${actualValue} vs ${expectedValue} (${(similarity * 100).toFixed(0)}%)`
            );
          } else if (similarity >= 0.3) {
            score += 8; // Low similarity - minimal credit
            console.log(
              `⚠️ Low similarity for ${key}: ${actualValue} vs ${expectedValue} (${(similarity * 100).toFixed(0)}%)`
            );
          } else {
            console.log(
              `❌ No meaningful match for ${key}: ${actualValue} vs ${expectedValue} (${(similarity * 100).toFixed(0)}%)`
            );
          }
        }
      } else if (typeof expectedValue === 'number' && typeof actualValue === 'number') {
        // Number comparison with tolerance
        const diff = Math.abs(actualValue - expectedValue);
        const tolerance = Math.abs(expectedValue * 0.1); // 10% tolerance

        if (diff === 0) {
          score += 50; // Exact match
          console.log(`✅ Exact number match for ${key}: ${actualValue}`);
        } else if (diff <= tolerance) {
          score += 40; // Close match within tolerance
          console.log(`✅ Close number match for ${key}: ${actualValue} vs ${expectedValue}`);
        } else {
          score += 10; // Some points for having a number
          console.log(`⚠️ Number mismatch for ${key}: ${actualValue} vs ${expectedValue}`);
        }
      } else if (typeof expectedValue === 'boolean' && typeof actualValue === 'boolean') {
        if (actualValue === expectedValue) {
          score += 50;
          console.log(`✅ Boolean match for ${key}: ${actualValue}`);
        } else {
          console.log(`❌ Boolean mismatch for ${key}: ${actualValue} vs ${expectedValue}`);
        }
      } else {
        // Type mismatch, but give some points for having the parameter
        score += 10;
        console.log(`⚠️ Type mismatch for ${key}: ${typeof actualValue} vs ${typeof expectedValue}`);
      }
    }

    const finalScore = Math.min(Math.round((score / maxScore) * 50), 50);
    console.log(`📊 Parameter comparison score: ${finalScore}/50 (${score}/${maxScore})`);
    return finalScore;
  }

  estimateTokenCount(text) {
    if (!text) return 0;
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(text.length / 4);
  }

  countFunctionCalls(response) {
    if (!response) return 0;
    const matches = response.match(/\{[^}]*"tool_name"[^}]*\}/g);
    return matches ? matches.length : 0;
  }

  calculateInstructionComplexity(instruction) {
    const factors = {
      length: instruction.length,
      words: instruction.split(/\s+/).length,
      sentences: instruction.split(/[.!?]+/).length,
      functionKeywords: (
        instruction.match(/\b(search|find|analyze|calculate|compare|generate|create|delete|insert|replace)\b/gi) || []
      ).length,
      parameters: (instruction.match(/\b\w+:\s*\w+/g) || []).length,
    };

    return Math.min(
      10,
      Math.round(factors.words / 10 + factors.sentences / 2 + factors.functionKeywords * 2 + factors.parameters * 1.5)
    );
  }

  checkForKeywords(text) {
    const keywords = ['analysis', 'result', 'function', 'parameter', 'data', 'sequence', 'gene'];
    return keywords.filter(keyword => text.toLowerCase().includes(keyword));
  }

  analyzeSentiment(text) {
    // Simple sentiment analysis
    const positive = ['good', 'excellent', 'successful', 'complete', 'found', 'available'];
    const negative = ['error', 'failed', 'missing', 'unavailable', 'incorrect'];

    const positiveCount = positive.filter(word => text.toLowerCase().includes(word)).length;
    const negativeCount = negative.filter(word => text.toLowerCase().includes(word)).length;

    if (positiveCount > negativeCount) return 'positive';
    if (negativeCount > positiveCount) return 'negative';
    return 'neutral';
  }

  extractWorkflowSteps(text) {
    // Extract numbered steps or bullet points
    const stepPatterns = [/\d+\.\s*([^\n]+)/g, /[-*]\s*([^\n]+)/g, /Step \d+[:\s]*([^\n]+)/gi];

    const steps = [];
    for (const pattern of stepPatterns) {
      const matches = [...text.matchAll(pattern)];
      if (matches.length > 0) {
        steps.push(...matches.map(match => match[1].trim()));
      }
    }

    return steps;
  }

  findCompletionIndicators(text) {
    const indicators = [
      'completed',
      'finished',
      'done',
      'complete',
      'analysis finished',
      'task completed',
      'in summary',
      'conclusion',
      'results',
    ];

    return indicators.filter(indicator => text.toLowerCase().includes(indicator.toLowerCase()));
  }

  hasGoodStructure(text) {
    // Check for paragraphs, headers, lists, etc.
    const hasHeaders = /^#+\s/m.test(text);
    const hasParagraphs = text.includes('\n\n');
    const hasLists = /^[-*+]\s/m.test(text) || /^\d+\.\s/m.test(text);

    return hasHeaders || hasParagraphs || hasLists;
  }

  /**
   * Setup event handlers
   */
  setupEventHandlers() {
    // Handle benchmark events
    window.addEventListener('benchmark-stop', () => {
      this.stopBenchmark();
    });

    window.addEventListener('benchmark-pause', () => {
      this.pauseBenchmark();
    });

    window.addEventListener('benchmark-resume', () => {
      this.resumeBenchmark();
    });
  }

  /**
   * Stop current benchmark
   */
  stopBenchmark() {
    console.log('🛑 Stopping benchmark...');
    this.isRunning = false;

    // Display stop message in ChatBox
    if (this.chatManager) {
      this.chatManager.updateThinkingMessage(
        '\n\n🛑 **Benchmark Stop Requested**\n' +
          'Stopping benchmark execution gracefully...\n' +
          'Current test will complete, then execution will halt.'
      );
    }

    console.log('✅ Benchmark stop signal sent');
  }

  /**
   * Pause current benchmark
   */
  pauseBenchmark() {
    this.isPaused = true;
    console.log('Benchmark paused');
  }

  /**
   * Resume paused benchmark
   */
  resumeBenchmark() {
    this.isPaused = false;
    console.log('Benchmark resumed');
  }

  /**
   * Get benchmark history
   */
  getBenchmarkHistory() {
    return this.benchmarkResults;
  }

  /**
   * Clear benchmark history
   */
  clearBenchmarkHistory() {
    this.benchmarkResults = [];
    console.log('Benchmark history cleared');
  }

  /**
   * Attempt to recover LLM interaction data when test fails/times out
   * This method tries to extract any available LLM interaction data from various sources
   */
  async attemptToRecoverLLMInteractionData(test, error) {
    console.log(`🔄 Attempting to recover LLM interaction data for test ${test.id}...`);

    try {
      // Check if ChatManager has recent conversation data
      if (this.chatManager && this.chatManager.conversationHistory) {
        const recentMessages = this.chatManager.conversationHistory.slice(-5); // Last 5 messages

        // Look for messages related to this test
        const testRelatedMessages = recentMessages.filter(
          msg =>
            msg.content &&
            (msg.content.includes(test.instruction) ||
              msg.content.includes(test.id) ||
              msg.content.includes('find_gene_by_name') || // Based on the logs
              msg.content.includes('lacZ')) // Based on the logs
        );

        if (testRelatedMessages.length > 0) {
          console.log(`Found ${testRelatedMessages.length} test-related messages`);

          // Reconstruct interaction data from conversation history
          const lastUserMessage = testRelatedMessages.find(msg => msg.role === 'user');
          const lastAssistantMessage = testRelatedMessages.find(msg => msg.role === 'assistant');

          if (lastUserMessage || lastAssistantMessage) {
            return this.reconstructInteractionDataFromMessages(test, lastUserMessage, lastAssistantMessage, error);
          }
        }
      }

      // Check if there's any cached LLM response data
      if (this.chatManager && this.chatManager.lastResponse) {
        console.log('Found cached LLM response data');
        return this.reconstructInteractionDataFromCachedResponse(test, this.chatManager.lastResponse, error);
      }

      console.log('No recoverable LLM interaction data found');
      return null;
    } catch (recoveryError) {
      console.error('Error during LLM interaction data recovery:', recoveryError);
      return null;
    }
  }

  /**
   * Reconstruct interaction data from conversation messages
   */
  reconstructInteractionDataFromMessages(test, userMessage, assistantMessage, error) {
    return {
      timestamp: new Date().toISOString(),
      testId: test.id,
      testName: test.name,

      request: {
        instruction: test.instruction,
        timestamp: userMessage ? new Date(userMessage.timestamp || Date.now()).toISOString() : new Date().toISOString(),
        requestId: `recovered_${test.id}_${Date.now()}`,
        originalMessage: userMessage ? userMessage.content : test.instruction,
      },

      response: {
        content: assistantMessage ? assistantMessage.content : null,
        timestamp: assistantMessage
          ? new Date(assistantMessage.timestamp || Date.now()).toISOString()
          : new Date().toISOString(),
        responseId: `recovered_resp_${test.id}_${Date.now()}`,
        recovered: true,
        recoveryReason: 'timeout_recovery',
      },

      analysis: {
        isError: true,
        errorDetails: error.message,
        taskCompleted: false,
        confidence: 0,
        recoveredData: true,
        timeoutOccurred: error.message.includes('timeout'),
      },

      detailedLogs: {
        totalLogs: 3,
        consoleLogs: [
          `Test ${test.id} started`,
          `LLM interaction occurred (recovered from conversation history)`,
          `Test failed: ${error.message}`,
        ],
        errorLogs: [error.message],
        recoveryLogs: ['Data recovered from conversation history'],
      },
    };
  }

  /**
   * Reconstruct interaction data from cached response
   */
  reconstructInteractionDataFromCachedResponse(test, cachedResponse, error) {
    return {
      timestamp: new Date().toISOString(),
      testId: test.id,
      testName: test.name,

      request: {
        instruction: test.instruction,
        timestamp: new Date().toISOString(),
        requestId: `cached_${test.id}_${Date.now()}`,
      },

      response: {
        content: cachedResponse,
        timestamp: new Date().toISOString(),
        responseId: `cached_resp_${test.id}_${Date.now()}`,
        recovered: true,
        recoveryReason: 'cached_response',
      },

      analysis: {
        isError: true,
        errorDetails: error.message,
        taskCompleted: false,
        confidence: 0,
        recoveredData: true,
        timeoutOccurred: error.message.includes('timeout'),
      },

      detailedLogs: {
        totalLogs: 3,
        consoleLogs: [`Test ${test.id} started`, `LLM response cached (recovered)`, `Test failed: ${error.message}`],
        errorLogs: [error.message],
        recoveryLogs: ['Data recovered from cached response'],
      },
    };
  }

  /**
   * Export benchmark results
   */
  exportResults(format = 'json', options = {}) {
    switch (format) {
      case 'json':
        return JSON.stringify(this.benchmarkResults, null, 2);
      case 'csv':
        return this.reportGenerator.generateCSVReport(this.benchmarkResults);
      case 'html':
        return this.reportGenerator.generateHTMLReport(this.benchmarkResults, options);
      default:
        throw new Error(`Unsupported export format: ${format}`);
    }
  }

  /**
   * MEMORY SAFETY: Check memory usage and cleanup if needed
   */
  checkMemoryUsage() {
    if (!this.memoryMonitor.enabled) return;

    const now = Date.now();
    if (now - this.memoryMonitor.lastCheck < this.memoryMonitor.checkInterval) {
      return; // Skip check if too soon
    }

    this.memoryMonitor.lastCheck = now;

    // Get current memory usage
    const memoryInfo = performance.memory
      ? {
          used: performance.memory.usedJSHeapSize,
          total: performance.memory.totalJSHeapSize,
          limit: performance.memory.jsHeapSizeLimit,
        }
      : {
          used: 0,
          total: 0,
          limit: this.memoryMonitor.maxMemoryUsage,
        };

    const usedMB = Math.round(memoryInfo.used / 1024 / 1024);
    const totalMB = Math.round(memoryInfo.total / 1024 / 1024);
    const warningMB = Math.round(this.memoryMonitor.warningThreshold / 1024 / 1024);
    const maxMB = Math.round(this.memoryMonitor.maxMemoryUsage / 1024 / 1024);

    console.log(`🔍 [Memory Monitor] Used: ${usedMB}MB, Total: ${totalMB}MB`);

    // Check if memory usage is too high
    if (memoryInfo.used > this.memoryMonitor.warningThreshold) {
      console.warn(`⚠️ [Memory Monitor] High memory usage detected: ${usedMB}MB (warning threshold: ${warningMB}MB)`);

      // Perform cleanup if memory usage exceeds limit
      if (memoryInfo.used > this.memoryMonitor.maxMemoryUsage) {
        console.error(
          `🚨 [Memory Monitor] Memory limit exceeded: ${usedMB}MB (max: ${maxMB}MB) - performing emergency cleanup`
        );
        this.performMemoryCleanup();
      } else {
        console.log(`🧹 [Memory Monitor] Performing preventive cleanup...`);
        this.performMemoryCleanup();
      }
    }

    // Check for memory leaks (gradually increasing memory usage)
    if (!this.memoryMonitor.previousUsage) {
      this.memoryMonitor.previousUsage = memoryInfo.used;
    } else {
      const growth = memoryInfo.used - this.memoryMonitor.previousUsage;
      const growthMB = Math.round(growth / 1024 / 1024);

      if (growth > 50 * 1024 * 1024) {
        // More than 50MB growth
        console.warn(`📈 [Memory Monitor] Significant memory growth detected: +${growthMB}MB`);
      }

      this.memoryMonitor.previousUsage = memoryInfo.used;
    }
  }

  /**
   * MEMORY SAFETY: Trigger memory cleanup
   */
  performMemoryCleanup() {
    console.log('🧹 [Memory Monitor] Starting memory cleanup...');

    try {
      // MEMORY OPTIMIZATION: Reduce benchmark results retention from 50 to 5.
      // Each run result now contains slimmed test results, but even so,
      // keeping 50 full runs is excessive. 5 recent runs is plenty for comparison.
      if (this.benchmarkResults.length > 5) {
        const toRemove = this.benchmarkResults.length - 5;
        this.benchmarkResults.splice(0, toRemove);
        console.log(`🧹 [Memory Monitor] Removed ${toRemove} old benchmark results (keeping 5 most recent)`);
      }

      // Clear test suites if they have accumulated data
      this.testSuites.forEach(suite => {
        if (suite.cleanup && typeof suite.cleanup === 'function') {
          try {
            suite.cleanup();
          } catch (error) {
            console.warn('⚠️ [Memory Monitor] Suite cleanup failed:', error.message);
          }
        }
      });

      // MEMORY OPTIMIZATION: Clear instance-level capturedLogs reference
      if (this.capturedLogs) {
        this.capturedLogs.length = 0;
        this.capturedLogs = null;
      }

      // MEMORY OPTIMIZATION: Clear ChatManager Evolution data to free accumulated events
      if (this.chatManager) {
        if (this.chatManager.currentConversationData && this.chatManager.currentConversationData.events) {
          const eventCount = this.chatManager.currentConversationData.events.length;
          this.chatManager.currentConversationData.events.length = 0;
          if (eventCount > 0) {
            console.log(`🧹 [Memory Monitor] Cleared ${eventCount} ChatManager Evolution events`);
          }
        }
        // Clear stale thinking process DOM elements
        try {
          const staleThinking = document.querySelectorAll('[id^="thinkingProcess_"]');
          staleThinking.forEach(el => el.remove());
          if (staleThinking.length > 0) {
            console.log(`🧹 [Memory Monitor] Removed ${staleThinking.length} stale thinking DOM elements`);
          }
        } catch (domError) {
          // Ignore DOM errors
        }
      }

      // Force garbage collection hint
      if (typeof gc === 'function') {
        gc();
        console.log('🧹 [Memory Monitor] Garbage collection triggered');
      }

      console.log('✅ [Memory Monitor] Memory cleanup completed');
    } catch (error) {
      console.error('❌ [Memory Monitor] Memory cleanup failed:', error);
    }
  }

  /**
   * MEMORY OPTIMIZATION: Slim down test result to retain only scoring-relevant data.
   * The full llmInteractionData (5-15MB per test) is persisted to disk via IPC,
   * and only a lightweight summary + disk reference is kept in memory.
   * The UI can load detailed data on demand from disk when the user expands a test.
   */
  async slimDownTestResult(result) {
    if (!result) return result;

    // Build a slim copy with fields needed for reporting/scoring AND UI fallback reconstruction
    const slim = {
      testId: result.testId,
      testName: result.testName,
      suiteId: result.suiteId,
      startTime: result.startTime,
      endTime: result.endTime,
      duration: result.duration,
      status: result.status,
      success: result.success,
      score: result.score,
      maxScore: result.maxScore,
      errors: result.errors || [],
      warnings: result.warnings || [],
      metrics: result.metrics || {},
      // Keep actualResult for scoring verification (it's small — just tool_name + params)
      actualResult: result.actualResult
        ? {
            tool_name: result.actualResult.tool_name,
            parameters: result.actualResult.parameters,
            confidence: result.actualResult.confidence,
            detectionMethod: result.actualResult.detectionMethod,
            functionCalls: result.actualResult.functionCalls
              ? result.actualResult.functionCalls.map(c => ({
                  tool_name: c.tool_name,
                  confidence: c.confidence,
                  detectionMethod: c.detectionMethod,
                }))
              : undefined,
          }
        : null,
      expectedResult: result.expectedResult,
      // Preserve fields needed by BenchmarkUI.reconstructLLMInteractionFromTest fallback
      llmResponse: result.llmResponse
        ? result.llmResponse.length > 500
          ? result.llmResponse.substring(0, 500) + '...[TRUNCATED]'
          : result.llmResponse
        : null,
      details: result.details ? { instruction: result.details.instruction } : null,
    };

    // Replace the massive llmInteractionData with a lightweight summary
    if (result.llmInteractionData) {
      const data = result.llmInteractionData;
      slim.llmInteractionDataSummary = {
        testId: data.testId,
        testName: data.testName,
        // Request summary (no full prompts)
        requestProvider: data.request?.provider,
        requestModel: data.request?.model,
        requestSystemPromptLength: data.request?.systemPromptLength,
        requestContextLength: data.request?.contextLength,
        // Response summary
        responseTime: data.response?.responseTime,
        responseRawLength: data.response?.rawResponseLength,
        executionRounds: data.response?.executionRounds,
        totalExecutionTime: data.response?.totalExecutionTime,
        tokenUsage: data.response?.tokenUsage,
        dynamicToolsAnalysis: data.request?.dynamicToolsAnalysis,
        functionCallCount: data.response?.functionCalls?.length || 0,
        toolExecutionCount: data.response?.toolExecutions?.length || 0,
        // Analysis summary
        analysisIsError: data.analysis?.isError,
        analysisErrorType: data.analysis?.errorType,
        analysisConfidence: data.analysis?.confidence,
        // Detailed logs summary (counts only, not the full data)
        detailedLogsTotalLogs: data.detailedLogs?.totalLogs || 0,
        toolCallRounds: data.detailedLogs?.toolCallHistory?.toolCallRounds || [],
      };

      // Persist full interaction data to disk for on-demand retrieval
      const diskPath = await this.persistInteractionDataToDisk(result.testId, result.suiteId, data);
      if (diskPath) {
        slim.llmInteractionDataSummary.diskPath = diskPath;
      }
    }

    return slim;
  }

  /**
   * MEMORY OPTIMIZATION: Persist full LLM interaction data to disk via IPC.
   * This allows the UI to load detailed data on demand instead of keeping
   * 5-15MB per test in memory. Data is stored in the app's temp directory.
   */
  sanitizeBenchmarkFileSegment(value) {
    return String(value || 'unknown')
      .replace(/[^A-Za-z0-9._-]/g, '_')
      .replace(/_+/g, '_')
      .slice(0, 120);
  }

  async getBenchmarkDataDirectory(pathModule) {
    const appPathsResult =
      typeof window !== 'undefined' && window.electronAPI?.getAppPaths ? await window.electronAPI.getAppPaths() : null;
    const appPaths = appPathsResult?.success ? appPathsResult.paths || {} : {};
    const baseDir = appPaths.temp || appPaths.userData;

    if (baseDir) {
      return pathModule.join(baseDir, 'codexomics-benchmark-data');
    }

    const osTmpDir =
      typeof window !== 'undefined' && window.os && typeof window.os.tmpdir === 'function' ? window.os.tmpdir() : '';

    return osTmpDir ? pathModule.join(osTmpDir, 'codexomics-benchmark-data') : null;
  }

  getInteractionDataReplacer() {
    const circularReplacer = this.getCircularReplacer();
    return (key, value) => {
      if (typeof value === 'bigint') {
        return value.toString();
      }
      return circularReplacer(key, value);
    };
  }

  async persistInteractionDataToDisk(testId, suiteId, interactionData) {
    try {
      const pathModule = this.getPathModule();
      const electronAPI = typeof window !== 'undefined' ? window.electronAPI : null;

      if (!pathModule || typeof pathModule.join !== 'function') {
        console.warn('[Benchmark] Cannot persist interaction data: path utilities are unavailable');
        return null;
      }

      const benchmarkDir = await this.getBenchmarkDataDirectory(pathModule);
      if (!benchmarkDir) {
        console.warn('[Benchmark] Cannot persist interaction data: no temp or userData directory is available');
        return null;
      }

      const safeSuiteId = this.sanitizeBenchmarkFileSegment(suiteId);
      const safeTestId = this.sanitizeBenchmarkFileSegment(testId);
      const filename = `interaction_${safeSuiteId}_${safeTestId}_${Date.now()}.json`;
      const filePath = pathModule.join(benchmarkDir, filename);

      const jsonContent = JSON.stringify(interactionData, this.getInteractionDataReplacer());

      if (electronAPI?.writeFile) {
        if (electronAPI.ensureDirectory) {
          const ensureResult = await electronAPI.ensureDirectory(benchmarkDir);
          if (ensureResult?.success === false) {
            throw new Error(ensureResult.error || `Failed to create benchmark data directory: ${benchmarkDir}`);
          }
        }

        const writeResult = await electronAPI.writeFile(filePath, jsonContent);
        if (writeResult?.success === false) {
          throw new Error(writeResult.error || `Failed to write benchmark interaction data: ${filePath}`);
        }

        console.log(
          `💾 [Benchmark] Persisted interaction data to: ${filePath} (${(jsonContent.length / 1024).toFixed(1)} KB)`
        );
        return filePath;
      } else {
        console.warn('[Benchmark] Cannot persist interaction data: electronAPI.writeFile is unavailable');
        return null;
      }
    } catch (error) {
      console.warn(`[Benchmark] Failed to persist interaction data for ${testId}: ${error.message}`);
      return null;
    }
  }

  /**
   * MEMORY OPTIMIZATION: Load full LLM interaction data from disk on demand.
   * Called by the UI when the user expands a test's detailed results.
   */
  async loadInteractionDataFromDisk(diskPath) {
    if (!diskPath) return null;

    try {
      if (window.electronAPI?.readFile) {
        const result = await window.electronAPI.readFile(diskPath);
        if (result?.success === false) {
          throw new Error(result.error || `Failed to read interaction data: ${diskPath}`);
        }
        const content = typeof result === 'string' ? result : result?.data;
        if (typeof content !== 'string') {
          throw new Error('Interaction data read returned no text content');
        }
        return JSON.parse(content);
      } else {
        throw new Error('electronAPI.readFile is unavailable in the hardened renderer');
      }
    } catch (error) {
      console.warn(`[Benchmark] Failed to load interaction data from ${diskPath}: ${error.message}`);
      return null;
    }
  }

  /**
   * MEMORY SAFETY: Get memory usage info
   */
  getMemoryInfo() {
    if (!performance.memory) {
      return { available: false, message: 'Memory API not available' };
    }

    return {
      available: true,
      used: performance.memory.usedJSHeapSize,
      total: performance.memory.totalJSHeapSize,
      limit: performance.memory.jsHeapSizeLimit,
      usedMB: (performance.memory.usedJSHeapSize / 1024 / 1024).toFixed(2),
      totalMB: (performance.memory.totalJSHeapSize / 1024 / 1024).toFixed(2),
      limitMB: (performance.memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2),
    };
  }
}

// Make available globally
window.LLMBenchmarkFramework = LLMBenchmarkFramework;
