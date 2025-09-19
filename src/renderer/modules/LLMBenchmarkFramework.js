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
        
        for (let i = 0; i < tests.length; i++) {
            const test = tests[i];
            
            if (options.tests && !options.tests.includes(test.id)) {
                continue; // Skip if specific tests requested and this isn't one
            }

            console.log(`Running test: ${test.id} (${i + 1}/${tests.length})`);
            
            const testResult = await this.runSingleTest(test, suiteId);
            results.testResults.push(testResult);
            
            // Update test progress if callback provided
            if (options.onTestProgress) {
                const progress = (i + 1) / tests.length;
                options.onTestProgress(progress, test.id, testResult, suiteId);
            }
        }

        results.endTime = Date.now();
        results.duration = results.endTime - results.startTime;
        results.stats = this.statisticsEngine.calculateSuiteStatistics(results.testResults);

        return results;
    }

    /**
     * Run a single test
     */
    async runSingleTest(test, suiteId) {
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
            // Send the test instruction to the LLM
            const llmResponse = await this.sendTestInstruction(test.instruction, test.options);
            
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
            
            // Use ChatManager's sendToLLM method which handles all the configuration,
            // function calling, plugin integration, and system prompts automatically
            const response = await this.chatManager.sendToLLM(instruction);
            
            console.log(`📥 Received benchmark response:`, response);
            return response;

        } catch (error) {
            console.error('❌ Benchmark test instruction failed:', error);
            throw new Error(`LLM communication failed: ${error.message}`);
        }
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
        
        // Look for patterns that indicate function calls were made
        const patterns = [
            // Direct JSON function calls (if any leaked through)
            /\{"tool_name":\s*"([^"]+)",\s*"parameters":\s*(\{[^}]*\})\}/g,
            // Function execution indicators
            /(?:executed|called|running)\s+(?:function|tool|command):\s*(\w+)/gi,
            // Tool usage indicators  
            /(?:using|with)\s+tool:\s*(\w+)/gi,
            // Function name patterns
            /(\w+)\s*\([^)]*\)/g
        ];

        for (const pattern of patterns) {
            let match;
            while ((match = pattern.exec(response)) !== null) {
                if (match[1]) {
                    functionCalls.push({
                        tool_name: match[1],
                        parameters: match[2] ? this.safeParseJSON(match[2]) : {},
                        evidence: match[0]
                    });
                }
            }
        }

        return functionCalls;
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
     * Parse function call response
     */
    parseFunctionCallResponse(response, parsedResponse = null) {
        if (parsedResponse) {
            // Use the pre-parsed response with extracted function calls
            return parsedResponse.functionCalls.length > 0 ? parsedResponse.functionCalls : parsedResponse;
        }

        try {
            // Fallback: Look for JSON function calls in the response
            const jsonMatches = response.match(/\{[^}]*"tool_name"[^}]*\}/g);
            if (jsonMatches) {
                return jsonMatches.map(match => JSON.parse(match));
            }
            return { content: response, functionCalls: [] };
        } catch (error) {
            return { error: 'Invalid JSON format', response: response };
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

        if (!testResult.actualResult) {
            evaluation.errors.push('No result obtained from test execution');
            return evaluation;
        }

        // Use test-specific evaluator if provided
        if (test.evaluator && typeof test.evaluator === 'function') {
            try {
                const customEval = await test.evaluator(testResult.actualResult, test.expectedResult, testResult);
                Object.assign(evaluation, customEval);
                return evaluation;
            } catch (error) {
                evaluation.errors.push(`Custom evaluator failed: ${error.message}`);
                return evaluation;
            }
        }

        // Default evaluation based on test type
        switch (test.type) {
            case 'function_call':
                return this.evaluateFunctionCallTest(test, testResult, evaluation);
            case 'text_analysis':
                return this.evaluateTextAnalysisTest(test, testResult, evaluation);
            case 'json_output':
                return this.evaluateJSONOutputTest(test, testResult, evaluation);
            case 'workflow':
                return this.evaluateWorkflowTest(test, testResult, evaluation);
            default:
                return this.evaluateGenericTest(test, testResult, evaluation);
        }
    }

    /**
     * Evaluate function call test
     */
    evaluateFunctionCallTest(test, testResult, evaluation) {
        const actualResult = testResult.actualResult;
        const expectedResult = test.expectedResult;

        if (Array.isArray(actualResult)) {
            // Multiple function calls expected
            evaluation.score = 0;
            
            for (let i = 0; i < actualResult.length; i++) {
                const call = actualResult[i];
                const expected = expectedResult[i];
                
                if (expected) {
                    if (call.tool_name === expected.tool_name) {
                        evaluation.score += 40; // Correct function name
                        
                        // Check parameters
                        if (this.compareParameters(call.parameters, expected.parameters)) {
                            evaluation.score += 60; // Correct parameters
                        } else {
                            evaluation.score += 20; // Partial parameter match
                            evaluation.warnings.push(`Parameters don't match for ${call.tool_name}`);
                        }
                    } else {
                        evaluation.errors.push(`Expected ${expected.tool_name}, got ${call.tool_name}`);
                    }
                }
            }
            
            evaluation.score = Math.min(evaluation.score, evaluation.maxScore);
            evaluation.success = evaluation.score >= (evaluation.maxScore * 0.7);
            
        } else if (actualResult.error) {
            evaluation.errors.push(actualResult.error);
            evaluation.success = false;
            
        } else {
            // Single function call
            if (actualResult.tool_name === expectedResult.tool_name) {
                evaluation.score += 50;
                if (this.compareParameters(actualResult.parameters, expectedResult.parameters)) {
                    evaluation.score += 50;
                    evaluation.success = true;
                } else {
                    evaluation.score += 20;
                    evaluation.warnings.push('Parameters partially match');
                }
            } else {
                evaluation.errors.push(`Expected ${expectedResult.tool_name}, got ${actualResult.tool_name}`);
            }
        }

        return evaluation;
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
        if (!actual || !expected) return false;
        
        for (const [key, expectedValue] of Object.entries(expected)) {
            if (actual[key] !== expectedValue) {
                // Allow some flexibility for similar values
                if (typeof expectedValue === 'string' && typeof actual[key] === 'string') {
                    if (actual[key].toLowerCase() !== expectedValue.toLowerCase()) {
                        return false;
                    }
                } else {
                    return false;
                }
            }
        }
        return true;
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
        this.isRunning = false;
        console.log('Benchmark stopped by user');
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
