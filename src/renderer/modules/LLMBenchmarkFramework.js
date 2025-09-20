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
        this.testTimeout = 30000; // 30 seconds default timeout
        this.statisticsEngine = new BenchmarkStatistics();
        this.reportGenerator = new BenchmarkReportGenerator();
        
        this.initializeTestSuites();
        this.setupEventHandlers();
    }

    /**
     * Initialize all test suites
     */
    initializeTestSuites() {
        // Basic Operations Tests (Copy, Paste, Select All, etc.)
        this.registerTestSuite('basic_operations', new BasicOperationsSuite());
        
        // Edit Operations Tests (Comprehensive Edit menu operations)
        this.registerTestSuite('edit_operations', new EditOperationsSuite());
        
        // Basic Function Calling Tests
        this.registerTestSuite('basic_functions', new BasicFunctionCallingSuite());
        
        // Complex Analysis Tests
        this.registerTestSuite('complex_analysis', new ComplexAnalysisSuite());
        
        // Plugin Integration Tests
        this.registerTestSuite('plugin_integration', new PluginIntegrationSuite());
        
        // Parameter Handling Tests
        this.registerTestSuite('parameter_handling', new ParameterHandlingSuite());
        
        // Error Recovery Tests
        this.registerTestSuite('error_recovery', new ErrorRecoverySuite());
        
        // Multi-step Workflow Tests
        this.registerTestSuite('workflow_tests', new WorkflowTestSuite());
        
        // Contextual Understanding Tests
        this.registerTestSuite('contextual_understanding', new ContextualUnderstandingSuite());
        
        // Edge Case Tests
        this.registerTestSuite('edge_cases', new EdgeCaseTestSuite());
        
        // Performance Tests
        this.registerTestSuite('performance_tests', new PerformanceTestSuite());
        
        // Consistency Tests
        this.registerTestSuite('consistency_tests', new ConsistencyTestSuite());
        
        console.log(`Initialized ${this.testSuites.size} test suites with ${this.getTotalTestCount()} total tests`);
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

        this.isRunning = true;
        const startTime = Date.now();
        
        try {
            const results = {
                startTime: startTime,
                endTime: null,
                duration: null,
                testSuiteResults: [],
                overallStats: null,
                options: options
            };

            // Run each test suite
            for (const [suiteId, testSuite] of this.testSuites.entries()) {
                // Check if benchmark was stopped
                if (!this.isRunning) {
                    console.log('🛑 Benchmark stopped by user');
                    this.chatManager.updateThinkingMessage('\n\n🛑 **Benchmark Stopped**\nBenchmark execution was stopped by user request.');
                    break;
                }

                if (options.suites && !options.suites.includes(suiteId)) {
                    continue; // Skip if specific suites requested and this isn't one
                }

                console.log(`Running test suite: ${suiteId}`);
                
                const suiteResult = await this.runTestSuite(suiteId, options);
                results.testSuiteResults.push(suiteResult);
                
                // Update progress if callback provided
                if (options.onProgress) {
                    const progress = results.testSuiteResults.length / this.testSuites.size;
                    options.onProgress(progress, suiteId, suiteResult);
                }
            }

            results.endTime = Date.now();
            results.duration = results.endTime - results.startTime;
            results.overallStats = this.statisticsEngine.calculateOverallStatistics(results.testSuiteResults);

            this.benchmarkResults.push(results);
            
            // Generate report if requested
            if (options.generateReport !== false) {
                const report = this.reportGenerator.generateReport(results);
                results.report = report;
            }

            return results;
            
        } finally {
            this.isRunning = false;
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
            stats: null
        };

        const tests = testSuite.getTests();
        const filteredTests = options.tests ? 
            tests.filter(test => options.tests.includes(test.id)) : tests;

        // Display test suite start
        this.displayTestSuiteStart(testSuite, filteredTests.length);
        
        for (let i = 0; i < tests.length; i++) {
            const test = tests[i];
            
            // Check if benchmark was stopped
            if (!this.isRunning) {
                console.log('🛑 Test suite stopped by user');
                this.chatManager.updateThinkingMessage('\n\n🛑 **Test Suite Stopped**\nTest suite execution was stopped by user request.');
                break;
            }
            
            if (options.tests && !options.tests.includes(test.id)) {
                continue; // Skip if specific tests requested and this isn't one
            }

            console.log(`Running test: ${test.id} (${i + 1}/${filteredTests.length})`);
            
            // Display test progress
            this.displayTestProgress(test, i + 1, filteredTests.length);
            
            const testResult = await this.runSingleTest(test, suiteId);
            results.testResults.push(testResult);
            
            // Update test progress if callback provided
            if (options.onTestProgress) {
                const progress = (i + 1) / filteredTests.length;
                options.onTestProgress(progress, test.id, testResult, suiteId);
            }
        }

        results.endTime = Date.now();
        results.duration = results.endTime - results.startTime;
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
            `📋 **Test Suite Execution Started**\n\n` +
            `**Suite Name:** ${testSuite.getName()}\n` +
            `**Suite ID:** ${testSuite.suiteId || 'N/A'}\n` +
            `**Description:** ${testSuite.description || 'No description available'}\n` +
            `**Total Tests:** ${testCount} tests\n` +
            `**Test Types:** Function calls, workflows, and analysis\n\n` +
            `🎯 **Test Suite Objectives:**\n` +
            `• Validate LLM instruction following capabilities\n` +
            `• Test function calling accuracy and parameters\n` +
            `• Measure response quality and consistency\n` +
            `• Evaluate performance metrics\n\n` +
            `⚡ Starting test execution...`
        );
    }

    /**
     * Display individual test progress
     */
    displayTestProgress(test, currentIndex, totalTests) {
        this.chatManager.updateThinkingMessage(
            `\n\n📍 **Test ${currentIndex}/${totalTests}**\n` +
            `**Starting:** ${test.name} (${test.id})\n` +
            `**Progress:** ${Math.round((currentIndex / totalTests) * 100)}%\n` +
            `═══════════════════════════════════════`
        );
    }

    /**
     * Display test suite completion summary
     */
    displayTestSuiteComplete(testSuite, results) {
        const successRate = ((results.stats.passedTests / results.stats.totalTests) * 100).toFixed(1);
        const avgScore = results.stats.scoreStats.average.toFixed(1);
        const durationSeconds = (results.duration / 1000).toFixed(1);
        
        const gradeEmoji = successRate >= 90 ? '🏆' : 
                          successRate >= 75 ? '🥈' : 
                          successRate >= 60 ? '🥉' : '📊';

        this.chatManager.updateThinkingMessage(
            `\n\n${gradeEmoji} **Test Suite Complete**\n\n` +
            `**Suite:** ${testSuite.getName()}\n` +
            `**Duration:** ${durationSeconds}s\n` +
            `**Success Rate:** ${successRate}% (${results.stats.passedTests}/${results.stats.totalTests})\n` +
            `**Average Score:** ${avgScore}/100\n\n` +
            `📊 **Results Breakdown:**\n` +
            `• ✅ Passed: ${results.stats.passedTests} tests\n` +
            `• ❌ Failed: ${results.stats.failedTests} tests\n` +
            `• ⚠️ Errors: ${results.stats.errorTests} tests\n\n` +
            `📈 **Performance Summary:**\n` +
            `• Best Score: ${results.stats.scoreStats.max}/100\n` +
            `• Worst Score: ${results.stats.scoreStats.min}/100\n` +
            `• Avg Response Time: ${results.stats.performanceStats.averageResponseTime}ms\n\n` +
            `${successRate >= 80 ? '🎉 Excellent performance!' : 
              successRate >= 60 ? '👍 Good performance with room for improvement.' : 
              '🔧 Performance needs attention.'}`
        );
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
                metrics: {}
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
            metrics: {}
        };

        try {
            // Execute the test
            const testResult = await Promise.race([
                this.executeTest(test),
                new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Test timeout')), this.testTimeout)
                )
            ]);

            result.llmResponse = testResult.llmResponse;
            result.actualResult = testResult.actualResult;
            result.details = testResult.details || {};
            result.metrics = testResult.metrics || {};

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
        
        // Prepare test context
        const context = {
            chatManager: this.chatManager,
            configManager: this.configManager,
            testId: test.id,
            framework: this
        };

        // Execute test setup if provided
        if (test.setup) {
            await test.setup(context);
        }

        try {
            // Send the test instruction to the LLM with test information
            const instructionOptions = {
                ...test.options,
                testInfo: {
                    id: test.id,
                    name: test.name,
                    type: test.type,
                    expectedResult: test.expectedResult,
                    maxScore: test.maxScore
                }
            };
            
            const llmResponse = await this.sendTestInstruction(test.instruction, instructionOptions);
            
            // Parse and analyze the response
            const actualResult = await this.parseTestResponse(llmResponse, test);
            
            // Collect metrics
            const metrics = {
                responseTime: Date.now() - startTime,
                responseLength: llmResponse ? llmResponse.length : 0,
                tokenCount: this.estimateTokenCount(llmResponse),
                functionCallsCount: this.countFunctionCalls(llmResponse),
                instructionComplexity: this.calculateInstructionComplexity(test.instruction)
            };

            return {
                llmResponse: llmResponse,
                actualResult: actualResult,
                metrics: metrics,
                details: {
                    instruction: test.instruction,
                    context: context
                }
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
        }
    }

    /**
     * Send test instruction to LLM using ChatManager's configuration and function tools
     */
    async sendTestInstruction(instruction, options = {}) {
        if (!this.chatManager) {
            throw new Error('ChatManager not available');
        }

        // Check if LLM is configured
        if (!this.chatManager.llmConfigManager.isConfigured()) {
            throw new Error('LLM not configured. Please configure an LLM provider first.');
        }

        try {
            console.log(`📤 Sending benchmark test instruction: ${instruction}`);
            
            // Display detailed test process as a simulated tester
            this.displayTestProcess(instruction, options);
            
            // Use ChatManager's sendToLLM method which handles all the configuration,
            // function calling, plugin integration, and system prompts automatically
            const response = await this.chatManager.sendToLLM(instruction);
            
            console.log(`📥 Received benchmark response:`, response);
            
            // Display response analysis
            this.displayResponseAnalysis(response, options);
            
            return response;

        } catch (error) {
            console.error('❌ Benchmark test instruction failed:', error);
            this.displayTestError(error, options);
            throw new Error(`LLM communication failed: ${error.message}`);
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
        
        // Show test initiation
        this.chatManager.addThinkingMessage(
            `🧪 **Test Execution Started**\n\n` +
            `**Test Name:** ${testName}\n` +
            `**Test Type:** ${testType}\n` +
            `**Test ID:** ${testInfo.id || 'N/A'}\n\n` +
            `**Expected Function:** ${expectedResult.tool_name || 'N/A'}\n` +
            `**Expected Parameters:** ${JSON.stringify(expectedResult.parameters || {}, null, 2)}\n\n` +
            `**Test Instruction:**\n` +
            `"${instruction}"`
        );
        
        // Show what we're testing for
        this.chatManager.updateThinkingMessage(
            `\n\n📋 **Test Criteria:**\n` +
            `• LLM should understand the instruction correctly\n` +
            `• LLM should call the expected function: \`${expectedResult.tool_name}\`\n` +
            `• Parameters should match expected values\n` +
            `• Function execution should be successful\n\n` +
            `⏳ Sending instruction to LLM...`
        );
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
        
        this.chatManager.updateThinkingMessage(
            `\n\n📥 **LLM Response Received:**\n` +
            `**Response Length:** ${response ? response.length : 0} characters\n` +
            `**Response Preview:** "${response ? response.substring(0, 150) + (response.length > 150 ? '...' : '') : 'No response'}"\n\n` +
            `🔍 **Function Call Analysis:**\n` +
            `**Detected Functions:** ${detectedFunctions || 'None detected'}\n` +
            `**Detection Confidence:** ${extractedCalls.length > 0 ? extractedCalls[0].confidence + '%' : 'N/A'}\n` +
            `**Function Call Evidence:** ${extractedCalls.length > 0 ? extractedCalls[0].evidence : 'No evidence found'}\n\n` +
            `📊 **Initial Assessment:**\n` +
            `• Response received: ${hasValidResponse ? '✅ Yes' : '❌ No'}\n` +
            `• Function calls detected: ${extractedCalls.length > 0 ? '✅ Yes' : '❌ No'}\n` +
            `• Expected function found: ${detectedFunctions.includes(testInfo.expectedResult?.tool_name) ? '✅ Yes' : '❌ No'}\n\n` +
            `⚖️ Proceeding to detailed evaluation...`
        );
    }

    /**
     * Display test error information
     */
    displayTestError(error, options = {}) {
        const testInfo = options.testInfo || {};
        
        this.chatManager.updateThinkingMessage(
            `\n\n❌ **Test Execution Error:**\n` +
            `**Error Type:** ${error.name || 'Unknown Error'}\n` +
            `**Error Message:** ${error.message}\n` +
            `**Test Status:** FAILED (Error during execution)\n\n` +
            `🔧 **Troubleshooting:**\n` +
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
    async parseTestResponse(response, test) {
        if (!response) {
            return null;
        }

        // ChatManager returns text responses after handling function calls internally
        // We need to analyze the response to understand what happened
        const parsedResponse = {
            content: response,
            functionCalls: this.extractFunctionCallsFromResponse(response),
            completionIndicators: this.findCompletionIndicators(response),
            steps: this.extractWorkflowSteps(response)
        };

        switch (test.type) {
            case 'function_call':
                return this.parseFunctionCallResponse(response, parsedResponse);
            case 'text_analysis':
                return this.parseTextResponse(response);
            case 'json_output':
                return this.parseJSONResponse(response);
            case 'workflow':
                return this.parseWorkflowResponse(response, parsedResponse);
            default:
                return parsedResponse;
        }
    }

    /**
     * Extract function calls from ChatManager response
     * Since ChatManager handles function calls internally, we look for evidence in the response
     */
    extractFunctionCallsFromResponse(response) {
        const functionCalls = [];
        
        // Enhanced patterns to detect function calls from ChatManager responses
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
            /(?:successfully|completed)\s+([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:operation|function|tool|search|navigation)/gi
        ];

        // Common genome browser function names to look for
        const knownFunctions = [
            'search_gene_by_name', 'search_features', 'search_by_position',
            'navigate_to_position', 'jump_to_gene', 'get_gene_sequence',
            'run_blast_search', 'zoom_in', 'zoom_out', 'set_zoom_level',
            'show_gene_details', 'export_sequence', 'save_current_view',
            'load_genome_file', 'switch_chromosome', 'toggle_track_visibility'
        ];

        for (const pattern of patterns) {
            let match;
            pattern.lastIndex = 0; // Reset regex state
            while ((match = pattern.exec(response)) !== null) {
                if (match[1]) {
                    const toolName = match[1].toLowerCase();
                    
                    // Validate against known functions or common patterns
                    if (knownFunctions.includes(toolName) || 
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
                        toolName.includes('set_')) {
                        
                        functionCalls.push({
                            tool_name: toolName,
                            parameters: match[2] ? this.safeParseJSON(match[2]) : {},
                            evidence: match[0],
                            confidence: this.calculateConfidence(match[0], toolName)
                        });
                    }
                }
            }
        }

        // Look for parameter patterns in the response
        functionCalls.forEach(call => {
            call.parameters = this.extractParametersFromResponse(response, call.tool_name);
        });

        // Remove duplicates and sort by confidence
        const uniqueCalls = this.deduplicateFunctionCalls(functionCalls);
        
        console.log(`🔍 Extracted ${uniqueCalls.length} function calls from response:`, uniqueCalls);
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
        let confidence = 50; // Base confidence
        
        // Higher confidence for explicit execution messages
        if (evidence.includes('executed') || evidence.includes('successfully')) {
            confidence += 30;
        }
        
        // Higher confidence for specific function names
        if (evidence.includes('`' + toolName + '`') || evidence.includes('"' + toolName + '"')) {
            confidence += 20;
        }
        
        // Higher confidence for parameter mentions
        if (evidence.includes('parameters') || evidence.includes('with')) {
            confidence += 10;
        }
        
        return Math.min(confidence, 100);
    }

    /**
     * Extract parameters from response context for a given tool
     */
    extractParametersFromResponse(response, toolName) {
        const parameters = {};
        
        // Look for common parameter patterns
        const paramPatterns = [
            // Gene names in quotes
            /(?:gene|name|query).*?["']([^"']+)["']/gi,
            // Coordinates
            /(?:position|start|from).*?(\d+)/gi,
            /(?:end|to).*?(\d+)/gi,
            // Chromosome names
            /(?:chromosome|chr).*?["']?([A-Za-z0-9\-_]+)["']?/gi,
            // Boolean flags
            /(?:caseSensitive|case).*?(true|false)/gi
        ];
        
        // Extract gene/query names
        const geneMatch = response.match(/(?:gene|search|find|locate).*?["']([^"']+)["']/i);
        if (geneMatch) {
            parameters.name = geneMatch[1];
            parameters.query = geneMatch[1];
        }
        
        // Extract coordinates
        const coordMatch = response.match(/(\d+)(?:\s*(?:to|-)?\s*(\d+))?/);
        if (coordMatch) {
            parameters.start = parseInt(coordMatch[1]);
            if (coordMatch[2]) {
                parameters.end = parseInt(coordMatch[2]);
            }
        }
        
        // Extract chromosome
        const chrMatch = response.match(/(?:chromosome|chr).*?([A-Za-z0-9\-_]+)/i);
        if (chrMatch) {
            parameters.chromosome = chrMatch[1];
        }
        
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
    parseFunctionCallResponse(response, parsedResponse = null) {
        if (parsedResponse && parsedResponse.functionCalls && parsedResponse.functionCalls.length > 0) {
            // Return the highest confidence function call for single function tests
            const sortedCalls = parsedResponse.functionCalls.sort((a, b) => (b.confidence || 0) - (a.confidence || 0));
            console.log('🎯 Returning highest confidence function call:', sortedCalls[0]);
            return sortedCalls[0];
        }

        try {
            // Fallback: Look for JSON function calls in the response
            const jsonMatches = response.match(/\{[^}]*"tool_name"[^}]*\}/g);
            if (jsonMatches) {
                const parsed = jsonMatches.map(match => JSON.parse(match));
                return parsed.length === 1 ? parsed[0] : parsed;
            }
            
            // If no function calls detected, return response with empty function calls
            console.log('⚠️ No function calls detected in response');
            return { 
                error: 'No function calls detected',
                content: response, 
                functionCalls: [],
                actualResult: null
            };
        } catch (error) {
            console.error('❌ Error parsing function call response:', error);
            return { 
                error: 'Invalid JSON format', 
                response: response,
                actualResult: null
            };
        }
    }

    /**
     * Parse text response
     */
    parseTextResponse(response) {
        return {
            content: response,
            wordCount: response.split(/\s+/).length,
            hasKeywords: this.checkForKeywords(response),
            sentiment: this.analyzeSentiment(response)
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
            functionCalls: this.extractFunctionCallsFromResponse(response)
        };
    }

    /**
     * Evaluate test result against expectations
     */
    async evaluateTestResult(test, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: test.maxScore || 100,
            errors: [],
            warnings: []
        };

        // Display evaluation start
        this.displayEvaluationStart(test, testResult);

        if (!testResult.actualResult) {
            evaluation.errors.push('No result obtained from test execution');
            this.displayEvaluationResult(test, evaluation, testResult);
            return evaluation;
        }

        // Use test-specific evaluator if provided
        if (test.evaluator && typeof test.evaluator === 'function') {
            try {
                const customEval = await test.evaluator(testResult.actualResult, test.expectedResult, testResult);
                Object.assign(evaluation, customEval);
                this.displayEvaluationResult(test, evaluation, testResult);
                return evaluation;
            } catch (error) {
                evaluation.errors.push(`Custom evaluator failed: ${error.message}`);
                this.displayEvaluationResult(test, evaluation, testResult);
                return evaluation;
            }
        }

        // Default evaluation based on test type
        let finalEvaluation;
        switch (test.type) {
            case 'function_call':
                finalEvaluation = this.evaluateFunctionCallTest(test, testResult, evaluation);
                break;
            case 'text_analysis':
                finalEvaluation = this.evaluateTextAnalysisTest(test, testResult, evaluation);
                break;
            case 'json_output':
                finalEvaluation = this.evaluateJSONOutputTest(test, testResult, evaluation);
                break;
            case 'workflow':
                finalEvaluation = this.evaluateWorkflowTest(test, testResult, evaluation);
                break;
            default:
                finalEvaluation = this.evaluateGenericTest(test, testResult, evaluation);
        }

        // Display final evaluation result
        this.displayEvaluationResult(test, finalEvaluation, testResult);
        return finalEvaluation;
    }

    /**
     * Display evaluation start information
     */
    displayEvaluationStart(test, testResult) {
        this.chatManager.updateThinkingMessage(
            `\n\n⚖️ **Test Evaluation Started**\n` +
            `**Evaluating:** ${test.name}\n` +
            `**Evaluation Method:** ${test.evaluator ? 'Custom Evaluator' : 'Default ' + test.type + ' Evaluator'}\n` +
            `**Max Score:** ${test.maxScore || 100} points\n` +
            `**Response Time:** ${testResult.metrics?.responseTime || 'N/A'}ms\n\n` +
            `🔍 Analyzing test results...`
        );
    }

    /**
     * Display detailed evaluation results
     */
    displayEvaluationResult(test, evaluation, testResult) {
        const successIcon = evaluation.success ? '✅' : '❌';
        const scorePercentage = ((evaluation.score / evaluation.maxScore) * 100).toFixed(1);
        const gradeEmoji = evaluation.success ? '🎉' : evaluation.score > 50 ? '⚠️' : '💥';
        
        // Determine performance level
        let performanceLevel = 'Excellent';
        if (scorePercentage < 70) performanceLevel = 'Poor';
        else if (scorePercentage < 85) performanceLevel = 'Good';
        else if (scorePercentage < 95) performanceLevel = 'Very Good';

        this.chatManager.updateThinkingMessage(
            `\n\n${gradeEmoji} **Test Evaluation Complete**\n\n` +
            `**Test Result:** ${successIcon} ${evaluation.success ? 'PASS' : 'FAIL'}\n` +
            `**Score:** ${evaluation.score}/${evaluation.maxScore} (${scorePercentage}%)\n` +
            `**Performance:** ${performanceLevel}\n` +
            `**Response Time:** ${testResult.metrics?.responseTime || 'N/A'}ms\n\n` +
            `📊 **Detailed Analysis:**\n` +
            `${evaluation.errors.length > 0 ? '**Errors:**\n' + evaluation.errors.map(e => `• ${e}`).join('\n') + '\n\n' : ''}` +
            `${evaluation.warnings.length > 0 ? '**Warnings:**\n' + evaluation.warnings.map(w => `• ${w}`).join('\n') + '\n\n' : ''}` +
            `${evaluation.errors.length === 0 && evaluation.warnings.length === 0 ? '• All criteria met successfully\n\n' : ''}` +
            `📈 **Test Metrics:**\n` +
            `• Token Usage: ~${testResult.metrics?.tokenCount || 'N/A'} tokens\n` +
            `• Response Length: ${testResult.metrics?.responseLength || 'N/A'} characters\n` +
            `• Function Calls: ${testResult.metrics?.functionCallsCount || 'N/A'}\n` +
            `• Instruction Complexity: ${testResult.metrics?.instructionComplexity || 'N/A'}\n\n` +
            `${evaluation.success ? '🎯 Test completed successfully!' : '🔧 Test requires attention.'}`
        );
    }

    /**
     * Evaluate function call test
     */
    evaluateFunctionCallTest(test, testResult, evaluation) {
        const actualResult = testResult.actualResult;
        const expectedResult = test.expectedResult;

        console.log('🔍 Evaluating function call test:', {
            testId: test.id,
            actualResult: actualResult,
            expectedResult: expectedResult
        });

        // Handle case where no function call was detected
        if (!actualResult || actualResult.error === 'No function calls detected') {
            evaluation.errors.push('No function call detected in LLM response');
            evaluation.success = false;
            return evaluation;
        }

        // Handle parsing errors
        if (actualResult.error && actualResult.error !== 'No function calls detected') {
            evaluation.errors.push(actualResult.error);
            evaluation.success = false;
            return evaluation;
        }

        if (Array.isArray(actualResult)) {
            // Multiple function calls expected
            evaluation.score = 0;
            
            for (let i = 0; i < actualResult.length; i++) {
                const call = actualResult[i];
                const expected = Array.isArray(expectedResult) ? expectedResult[i] : expectedResult;
                
                if (expected) {
                    const functionScore = this.evaluateSingleFunctionCall(call, expected);
                    evaluation.score += functionScore.score;
                    evaluation.errors.push(...functionScore.errors);
                    evaluation.warnings.push(...functionScore.warnings);
                }
            }
            
            evaluation.score = Math.min(evaluation.score, evaluation.maxScore);
            evaluation.success = evaluation.score >= (evaluation.maxScore * 0.7);
            
        } else {
            // Single function call
            const functionScore = this.evaluateSingleFunctionCall(actualResult, expectedResult);
            evaluation.score = functionScore.score;
            evaluation.success = functionScore.success;
            evaluation.errors.push(...functionScore.errors);
            evaluation.warnings.push(...functionScore.warnings);
        }

        console.log('📊 Function call evaluation result:', {
            score: evaluation.score,
            success: evaluation.success,
            errors: evaluation.errors,
            warnings: evaluation.warnings
        });

        return evaluation;
    }

    /**
     * Evaluate a single function call
     */
    evaluateSingleFunctionCall(actualCall, expectedCall) {
        const result = {
            score: 0,
            success: false,
            errors: [],
            warnings: []
        };

        if (!actualCall || !actualCall.tool_name) {
            result.errors.push('Invalid function call format');
            return result;
        }

        console.log('🎯 Comparing function calls:', {
            actual: actualCall.tool_name,
            expected: expectedCall.tool_name,
            actualParams: actualCall.parameters,
            expectedParams: expectedCall.parameters
        });

        // Check function name (50 points)
        if (actualCall.tool_name === expectedCall.tool_name) {
            result.score += 50;
            console.log('✅ Function name matches');
        } else {
            result.errors.push(`Expected function ${expectedCall.tool_name}, got ${actualCall.tool_name}`);
            console.log('❌ Function name mismatch');
        }

        // Check parameters (50 points)
        if (actualCall.parameters && expectedCall.parameters) {
            const paramScore = this.compareParameters(actualCall.parameters, expectedCall.parameters);
            result.score += paramScore;
            
            if (paramScore >= 40) {
                console.log('✅ Parameters match well');
            } else if (paramScore >= 20) {
                result.warnings.push('Parameters partially match expected values');
                console.log('⚠️ Parameters partially match');
            } else {
                result.errors.push('Parameters do not match expected values');
                console.log('❌ Parameters do not match');
            }
        } else if (!expectedCall.parameters) {
            // No parameters expected
            result.score += 50;
            console.log('✅ No parameters expected');
        } else {
            result.errors.push('Missing required parameters');
            console.log('❌ Missing parameters');
        }

        result.success = result.score >= 70;
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
        evaluation.success = evaluation.score >= (evaluation.maxScore * 0.7);

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
                actualResult.hasOwnProperty(field)
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
        evaluation.success = evaluation.score >= (evaluation.maxScore * 0.8);

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
        evaluation.success = evaluation.score >= (evaluation.maxScore * 0.6);

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
    compareParameters(actual, expected) {
        if (!actual && !expected) return 50; // Both empty
        if (!actual || !expected) return 0;  // One empty, one not
        
        const expectedKeys = Object.keys(expected);
        const actualKeys = Object.keys(actual);
        
        if (expectedKeys.length === 0) return 50; // No parameters expected
        
        let score = 0;
        let maxScore = expectedKeys.length * 50; // 50 points per parameter
        
        console.log('🔍 Comparing parameters:', {
            actual: actual,
            expected: expected,
            expectedKeys: expectedKeys,
            actualKeys: actualKeys
        });
        
        for (const key of expectedKeys) {
            const expectedValue = expected[key];
            const actualValue = actual[key];
            
            if (actualValue === undefined) {
                console.log(`❌ Missing parameter: ${key}`);
                continue; // No points for missing parameter
            }
            
            if (actualValue === expectedValue) {
                score += 50; // Full points for exact match
                console.log(`✅ Exact match for ${key}: ${actualValue}`);
            } else if (typeof expectedValue === 'string' && typeof actualValue === 'string') {
                // String comparison with case insensitivity
                if (actualValue.toLowerCase() === expectedValue.toLowerCase()) {
                    score += 45; // Nearly full points for case-insensitive match
                    console.log(`✅ Case-insensitive match for ${key}: ${actualValue}`);
                } else if (actualValue.includes(expectedValue) || expectedValue.includes(actualValue)) {
                    score += 25; // Partial points for substring match
                    console.log(`⚠️ Partial match for ${key}: ${actualValue} vs ${expectedValue}`);
                } else {
                    console.log(`❌ No match for ${key}: ${actualValue} vs ${expectedValue}`);
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
            functionKeywords: (instruction.match(/\b(search|find|analyze|calculate|compare|generate|create|delete|insert|replace)\b/gi) || []).length,
            parameters: (instruction.match(/\b\w+:\s*\w+/g) || []).length
        };
        
        return Math.min(10, Math.round(
            (factors.words / 10) + 
            (factors.sentences / 2) + 
            (factors.functionKeywords * 2) + 
            (factors.parameters * 1.5)
        ));
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
        const stepPatterns = [
            /\d+\.\s*([^\n]+)/g,
            /[-*]\s*([^\n]+)/g,
            /Step \d+[:\s]*([^\n]+)/gi
        ];
        
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
            'completed', 'finished', 'done', 'complete', 'analysis finished',
            'task completed', 'in summary', 'conclusion', 'results'
        ];
        
        return indicators.filter(indicator => 
            text.toLowerCase().includes(indicator.toLowerCase())
        );
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
     * Export benchmark results
     */
    exportResults(format = 'json') {
        switch (format) {
            case 'json':
                return JSON.stringify(this.benchmarkResults, null, 2);
            case 'csv':
                return this.reportGenerator.generateCSVReport(this.benchmarkResults);
            case 'html':
                return this.reportGenerator.generateHTMLReport(this.benchmarkResults);
            default:
                throw new Error(`Unsupported export format: ${format}`);
        }
    }
}

// Make available globally
window.LLMBenchmarkFramework = LLMBenchmarkFramework;
