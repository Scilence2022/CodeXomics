/**
 * Automatic Complex Benchmark Suite - Automatic evaluation + Complex complexity tests
 * Extracted from ComprehensiveBenchmarkSuite.js for better organization
 */
class AutomaticComplexSuite {
    constructor() {
        this.suiteName = 'Automatic Complex Tests';
        this.suiteId = 'automatic_complex';
        this.description = 'Complex tests with automatic evaluation - Advanced genomic analysis operations';
        this.framework = null;
        this.defaultDirectory = null; // Will be set when framework provides configuration
        this.tests = this.initializeTests();
    }

    getName() {
        return this.suiteName;
    }

    getTests() {
        return this.tests;
    }

    getTestCount() {
        return this.tests.length;
    }

    /**
     * Set configuration including default directory
     */
    setConfiguration(config) {
        if (config && config.defaultDirectory) {
            this.defaultDirectory = config.defaultDirectory;
            console.log(`📁 AutomaticComplexSuite default directory set to: ${this.defaultDirectory}`);
            
            // Regenerate tests with updated paths
            this.tests = this.initializeTests();
        }
    }

    /**
     * Get default file directory from configuration or fallback
     */
    getDefaultDirectory() {
        // Try to get from current configuration
        if (this.defaultDirectory) {
            return this.defaultDirectory;
        }
        
        // Try to get from BenchmarkUI if available
        if (window.benchmarkUI && window.benchmarkUI.getDefaultDirectory) {
            const uiDirectory = window.benchmarkUI.getDefaultDirectory();
            if (uiDirectory) {
                return uiDirectory;
            }
        }
        
        // Fallback to memory default
        return '/Users/song/Documents/Genome-AI-Studio-Projects/test_data/';
    }

    /**
     * Build file path using default directory
     */
    buildFilePath(filename) {
        const defaultDir = this.getDefaultDirectory();
        // Ensure directory ends with slash
        const normalizedDir = defaultDir.endsWith('/') ? defaultDir : defaultDir + '/';
        return normalizedDir + filename;
    }

    /**
     * Clean up target export files before tests to prevent false positives
     * 在测试开始前检测并删除目标导出文件，避免判断错误
     */
    async cleanupExportFiles() {
        const exportFiles = [
            'exported_sequences.fasta',
            'exported_data.gbk',
            'exported_annotations.gff3', 
            'exported_features.bed',
            'exported_cds.fasta',
            'exported_proteins.fasta',
            'exported_region.fasta'
        ];
        
        console.log('🧹 [AutomaticComplexSuite] Starting export file cleanup...');
        
        for (const filename of exportFiles) {
            try {
                const filePath = this.buildFilePath(filename);
                console.log(`🔍 [AutomaticComplexSuite] Checking if ${filePath} exists...`);
                
                // Method 1: Try Node.js fs module if available
                if (typeof require !== 'undefined') {
                    const fs = require('fs');
                    if (fs.existsSync(filePath)) {
                        fs.unlinkSync(filePath);
                        console.log(`✅ [AutomaticComplexSuite] Deleted existing file: ${filePath}`);
                    } else {
                        console.log(`ℹ️  [AutomaticComplexSuite] File does not exist: ${filePath}`);
                    }
                } 
                // Method 2: Try via ChatManager's file operations if available
                else if (window.chatManager && window.chatManager.deleteFile) {
                    try {
                        const result = await window.chatManager.deleteFile({ filePath: filePath });
                        if (result && result.success) {
                            console.log(`✅ [AutomaticComplexSuite] Deleted via ChatManager: ${filePath}`);
                        } else {
                            console.log(`ℹ️  [AutomaticComplexSuite] File may not exist or delete failed: ${filePath}`);
                        }
                    } catch (error) {
                        if (error.message && error.message.includes('not found')) {
                            console.log(`ℹ️  [AutomaticComplexSuite] File does not exist: ${filePath}`);
                        } else {
                            console.warn(`⚠️  [AutomaticComplexSuite] Error checking/deleting ${filePath}:`, error.message);
                        }
                    }
                }
                // Method 3: Log warning if no deletion method available
                else {
                    console.warn(`⚠️  [AutomaticComplexSuite] No file deletion method available for ${filePath}`);
                }
                
            } catch (error) {
                console.warn(`⚠️  [AutomaticComplexSuite] Failed to cleanup ${filename}:`, error.message);
                // Continue with other files even if one fails
            }
        }
        
        console.log('✅ [AutomaticComplexSuite] Export file cleanup completed');
    }

    /**
     * Initialize automatic complex test cases
     */
    initializeTests() {
        return [
            // FILE LOADING WORKFLOW - Automatic + Complex
            {
                id: 'file_auto_01',
                name: 'Complete Genomic Data Loading Workflow',
                type: 'workflow',
                category: 'file_loading',
                complexity: 'complex',
                evaluation: 'automatic',
                instruction: `Load genome file "${this.buildFilePath('ECOLI.gbk')}"; Load aligned read file "${this.buildFilePath('1655_C10.sorted.bam')}"; Load variant VCF "${this.buildFilePath('1655_C10.mutations.vcf')}"; Load WIG files "${this.buildFilePath('first_sample.wig')}", "${this.buildFilePath('another_sample.wig')}"`,
                expectedResult: {
                    tool_sequence: ['load_genome_file', 'load_reads_file', 'load_variant_file', 'load_wig_tracks'],
                    parameters: [
                        {
                            filePath: this.buildFilePath('ECOLI.gbk')
                        },
                        {
                            filePath: this.buildFilePath('1655_C10.sorted.bam')
                        },
                        {
                            filePath: this.buildFilePath('1655_C10.mutations.vcf')
                        },
                        {
                            filePaths: [
                                this.buildFilePath('first_sample.wig'),
                                this.buildFilePath('another_sample.wig')
                            ]
                        }
                    ]
                },
                maxScore: 15,
                bonusScore: 3,
                timeout: 120000,
                evaluator: this.evaluateFileLoadingWorkflow.bind(this)
            },
            
            // NAVIGATION TASKS - Automatic + Complex
            {
                id: 'nav_auto_05',
                name: 'Navigate and Zoom Complex Analysis',
                type: 'workflow',
                category: 'navigation',
                complexity: 'complex',
                evaluation: 'automatic',
                instruction: 'Navigate to region 1230000 to 1300000 and then zoom in 10x to see the features.',
                expectedResult: {
                    tool_sequence: ['navigate_to_position', 'zoom_in'],
                    parameters: [
                        {
                            chromosome: '<current_chromosome>',
                            start: 1230000,
                            end: 1300000
                        },
                        {
                            factor: 10
                        }
                    ]
                },
                maxScore: 10,
                bonusScore: 2,
                timeout: 60000,
                evaluator: this.evaluateWorkflowCall.bind(this)
            }
        ];
    }

    /**
     * Parse natural language response from LLM to detect successful file loading
     */
    parseNaturalLanguageFileLoadingResponse(actualResult, evaluation) {
        let responseText = '';
        
        // Extract text from various response formats
        if (typeof actualResult === 'string') {
            responseText = actualResult;
        } else if (actualResult && actualResult.response) {
            responseText = actualResult.response;
        } else if (actualResult && actualResult.message) {
            responseText = actualResult.message;
        } else {
            responseText = JSON.stringify(actualResult);
        }
        
        console.log('📄 [FileLoadingWorkflow] Parsing response text:', responseText.substring(0, 500));
        
        // Expected files and their success indicators
        const expectedFiles = [
            { name: 'ECOLI.gbk', patterns: ['genome file loaded successfully', 'ECOLI.gbk', 'genome file.*loaded', 'file type.*genome'] },
            { name: '1655_C10.sorted.bam', patterns: ['reads file loaded successfully', '1655_C10.sorted.bam', 'aligned read', 'reads.*loaded'] },
            { name: '1655_C10.mutations.vcf', patterns: ['variant file loaded successfully', '1655_C10.mutations.vcf', 'variant.*loaded', 'VCF.*loaded'] },
            { name: 'first_sample.wig', patterns: ['wig.*loaded', 'first_sample.wig', 'tracks.*loaded'] },
            { name: 'another_sample.wig', patterns: ['wig.*loaded', 'another_sample.wig', 'tracks.*loaded'] }
        ];
        
        const pointsPerFile = Math.floor(evaluation.maxScore / evaluation.details.totalFiles);
        console.log(`📊 [FileLoadingWorkflow] Points per file: ${pointsPerFile}`);
        
        // Check for each expected file
        expectedFiles.forEach(file => {
            const found = file.patterns.some(pattern => {
                const regex = new RegExp(pattern, 'i');
                return regex.test(responseText);
            });
            
            if (found) {
                evaluation.details.filesLoaded.push(file.name);
                evaluation.details.successfulFiles++;
                evaluation.score += pointsPerFile;
                console.log(`✅ [FileLoadingWorkflow] File detected as loaded: ${file.name} (+${pointsPerFile} points)`);
            } else {
                console.log(`❌ [FileLoadingWorkflow] File not detected as loaded: ${file.name}`);
            }
        });
        
        // Special handling for WIG files (they might be reported together)
        if (responseText.toLowerCase().includes('wig tracks loading completed') || 
            responseText.toLowerCase().includes('wig.*loading.*completed')) {
            // If WIG loading was mentioned but individual files weren't detected, award partial credit
            const wigFilesAlreadyCounted = evaluation.details.filesLoaded.filter(f => f.includes('.wig')).length;
            if (wigFilesAlreadyCounted === 0) {
                // Award points for at least one WIG file
                evaluation.details.filesLoaded.push('wig_files');
                evaluation.details.successfulFiles++;
                evaluation.score += pointsPerFile;
                console.log(`✅ [FileLoadingWorkflow] WIG files detected as loaded (+${pointsPerFile} points)`);
            }
        }
        
        // Calculate success based on file loading
        const successRate = evaluation.details.successfulFiles / evaluation.details.totalFiles;
        evaluation.success = successRate >= 0.4; // At least 40% of files loaded successfully
        
        // Cap score at maximum
        evaluation.score = Math.min(evaluation.score, evaluation.maxScore);
        
        console.log(`🎯 [FileLoadingWorkflow] Natural language parsing results:`);
        console.log(`   Score: ${evaluation.score}/${evaluation.maxScore}`);
        console.log(`   Files loaded: ${evaluation.details.successfulFiles}/${evaluation.details.totalFiles} (${evaluation.details.filesLoaded.join(', ')})`);
        console.log(`   Success rate: ${(successRate * 100).toFixed(1)}%`);
        console.log(`   Success: ${evaluation.success}`);
        
        if (!evaluation.success) {
            evaluation.errors.push(`Insufficient files loaded: ${evaluation.details.successfulFiles}/${evaluation.details.totalFiles} (need at least 2 files)`);
        }
        
        return evaluation;
    }

    /**
     * Evaluator methods - shared across all suite types
     */
    async evaluateBasicFunctionCall(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 10, // Use test's actual maxScore, default to 10 for complex
            errors: [],
            warnings: []
        };

        if (!actualResult) {
            evaluation.errors.push('No result obtained from test execution');
            return evaluation;
        }

        console.log(`📊 [AutomaticComplexSuite] Evaluating test result:`, {
            testId: testResult.testId,
            expectedTool: expectedResult.tool_name,
            actualResult: actualResult,
            resultType: typeof actualResult
        });

        // PRIORITY 0: Check Tool Execution Tracker for direct execution status
        if (window.chatManager && window.chatManager.toolExecutionTracker) {
            const tracker = window.chatManager.toolExecutionTracker;
            const recentExecutions = tracker.getSessionExecutions();
            
            console.log(`🔍 [AutomaticComplexSuite] Checking tracker for tool: ${expectedResult.tool_name}`);
            
            // Look for recent successful execution of the expected tool
            const relevantExecution = recentExecutions.find(exec => 
                exec.toolName === expectedResult.tool_name && 
                exec.status === 'completed' &&
                Date.now() - exec.startTime < 30000 // Within last 30 seconds
            );
            
            if (relevantExecution) {
                console.log(`✅ [AutomaticComplexSuite] TRACKER SUCCESS: Found successful execution of '${expectedResult.tool_name}'`, relevantExecution);
                evaluation.score = evaluation.maxScore; // FULL POINTS from tracker
                evaluation.success = true;
                evaluation.warnings.push('Awarded full points based on Tool Execution Tracker data');
                return evaluation;
            }
            
            // Look for recent failed execution
            const failedExecution = recentExecutions.find(exec => 
                exec.toolName === expectedResult.tool_name && 
                exec.status === 'failed' &&
                Date.now() - exec.startTime < 30000 // Within last 30 seconds
            );
            
            if (failedExecution) {
                console.log(`❌ [AutomaticComplexSuite] TRACKER FAILURE: Found failed execution of '${expectedResult.tool_name}'`, failedExecution);
                evaluation.errors.push(`Tool execution failed: ${failedExecution.error?.message || 'Unknown error'}`);
                return evaluation; // Score remains 0
            }
        }

        // Check tool name - PRIORITIZE ChatManager's parseToolCall results
        let actualTool = null;
        
        // PRIORITY 1: Use ChatManager's reliable parseToolCall results from testResult
        if (testResult.parseDebugInfo && testResult.parseDebugInfo.detectedTools && testResult.parseDebugInfo.detectedTools.length > 0) {
            const detectedTools = testResult.parseDebugInfo.detectedTools;
            console.log(`🎯 [ComplexSuite PRIORITY 1] Using ChatManager's detected tools:`, detectedTools);
            
            // Find the first detected tool that matches our expected tool
            const matchingTool = detectedTools.find(tool => 
                tool.tool === expectedResult.tool_name || 
                tool.tool.toLowerCase().includes(expectedResult.tool_name.toLowerCase()) ||
                expectedResult.tool_name.toLowerCase().includes(tool.tool.toLowerCase())
            );
            
            if (matchingTool) {
                actualTool = matchingTool.tool;
                console.log(`✅ [ComplexSuite PRIORITY 1] Found matching tool from ChatManager: '${actualTool}'`);
            } else {
                // If no exact match, use the first detected tool (ChatManager is usually reliable)
                actualTool = detectedTools[0].tool;
                console.log(`🔄 [ComplexSuite PRIORITY 1] Using first detected tool from ChatManager: '${actualTool}'`);
            }
        }
        
        // PRIORITY 2: Standard extraction if no parseDebugInfo available
        if (!actualTool) {
            if (Array.isArray(actualResult)) {
                actualTool = actualResult[0]?.tool_name;
            } else if (actualResult && typeof actualResult === 'object') {
                actualTool = actualResult.tool_name;
            }
        }
        
        // PRIORITY 3: Fallback - Parse from string if it contains tool call JSON
        if (!actualTool && typeof actualResult === 'string') {
            try {
                const jsonMatch = actualResult.match(/\{[^{}]*"tool_name"[^{}]*\}/);
                if (jsonMatch) {
                    const parsedTool = JSON.parse(jsonMatch[0]);
                    actualTool = parsedTool.tool_name;
                    console.log(`🔄 [ComplexSuite PRIORITY 3] Extracted tool name from string JSON: '${actualTool}'`);
                }
            } catch (e) {
                // JSON parsing failed, continue with other methods
            }
        }
        
        // PRIORITY 4: Fallback - Check alternative property names
        if (!actualTool && actualResult && typeof actualResult === 'object') {
            actualTool = actualResult.function_call?.name || 
                        actualResult.tool_call?.name || 
                        actualResult.function_name ||
                        actualResult.name;
        }
        
        // PRIORITY 5: Emergency fallback - check if expected tool name appears in string
        if (!actualTool && typeof actualResult === 'string') {
            const expectedToolLower = expectedResult.tool_name.toLowerCase();
            if (actualResult.toLowerCase().includes(expectedToolLower)) {
                actualTool = expectedResult.tool_name;
                console.log(`🔄 [ComplexSuite PRIORITY 5] Emergency fallback: using expected tool name`);
            }
        }
        
        console.log(`🎯 [ComplexSuite FINAL] Extracted tool name: '${actualTool}' (expected: '${expectedResult.tool_name}')`);
        console.log(`🔍 [ComplexSuite DEBUG] parseDebugInfo available: ${!!(testResult.parseDebugInfo && testResult.parseDebugInfo.detectedTools)}`);
        if (testResult.parseDebugInfo && testResult.parseDebugInfo.detectedTools) {
            console.log(`🔍 [ComplexSuite DEBUG] ChatManager detected tools:`, testResult.parseDebugInfo.detectedTools.map(t => t.tool));
        }
        if (actualTool === expectedResult.tool_name) {
            evaluation.score = evaluation.maxScore; // Full points for correct tool
        } else {
            evaluation.errors.push(`Expected tool '${expectedResult.tool_name}' but got '${actualTool}'`);
            evaluation.score = 0; // No points for wrong tool
            evaluation.success = false;
            return evaluation;
        }

        // Check parameters - deduct points for parameter issues
        const actualParams = Array.isArray(actualResult) ? actualResult[0]?.parameters : actualResult.parameters;
        if (actualParams && expectedResult.parameters) {
            const expectedKeys = Object.keys(expectedResult.parameters);
            const matchingKeys = expectedKeys.filter(key => 
                key in actualParams && 
                (actualParams[key] === expectedResult.parameters[key] || 
                 expectedResult.parameters[key] === '<current_chromosome>' ||
                 expectedResult.parameters[key] === '<lacZ_protein_sequence>' ||
                 expectedResult.parameters[key] === '<araA_protein_sequence>')
            );
            
            // Deduct 1 point for each missing/incorrect parameter (up to 2 points for complex)
            const missingParams = expectedKeys.length - matchingKeys.length;
            if (missingParams > 0) {
                evaluation.score = Math.max(0, evaluation.score - Math.min(2, missingParams));
                evaluation.warnings.push(`${missingParams} parameter(s) missing or incorrect`);
            }
        }

        evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * 0.4); // 40% threshold for complex tests
        return evaluation;
    }

    async evaluateNavigationCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // Add navigation-specific checks for complex tests
        if (actualResult && actualResult.parameters) {
            const params = actualResult.parameters;
            
            // Check for reasonable coordinate ranges
            if (params.start && params.end && params.start > params.end) {
                evaluation.warnings.push('Start position should be less than end position');
            }
            
            // Check for very large ranges that might indicate errors
            if (params.start && params.end && (params.end - params.start) > 10000000) {
                evaluation.warnings.push('Range is very large (>10Mb), verify this is intentional');
            }

            // Complex test: Check for appropriate range size for analysis
            if (params.start && params.end) {
                const rangeSize = params.end - params.start;
                if (rangeSize > 50000 && rangeSize < 500000) {
                    evaluation.score = Math.min(evaluation.maxScore, evaluation.score + (testResult.bonusScore || 2)); // Add bonus points
                }
            }
        }
        
        return evaluation;
    }

    /**
     * Parse natural language response for navigation workflow
     */
    parseNaturalLanguageNavigationResponse(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 10,
            errors: [],
            warnings: []
        };

        let responseText = '';
        
        // Extract text from various response formats
        if (typeof actualResult === 'string') {
            responseText = actualResult;
        } else if (actualResult && actualResult.response) {
            responseText = actualResult.response;
        } else if (actualResult && actualResult.message) {
            responseText = actualResult.message;
        } else {
            responseText = JSON.stringify(actualResult);
        }
        
        console.log('📄 [NavigationWorkflow] Parsing response text:', responseText.substring(0, 500));
        
        // Check for navigation success indicators
        const navigationSuccessPatterns = [
            'navigate.*position.*completed',
            'navigation.*successful',
            'navigated to.*position',
            'task completed.*navigate',
            'navigate_to_position.*success',
            'results have been processed',
            'navigation.*complete'
        ];
        
        const navigationDetected = navigationSuccessPatterns.some(pattern => {
            const regex = new RegExp(pattern, 'i');
            return regex.test(responseText);
        });
        
        if (navigationDetected) {
            // Award points for successful navigation (partial credit)
            evaluation.score = Math.ceil(evaluation.maxScore * 0.6); // 60% for navigation success
            console.log(`✅ [NavigationWorkflow] Navigation detected as successful (+${evaluation.score} points)`);
            
            // Check if coordinates were mentioned
            const coordinatePatterns = [
                '123\\d{4}',  // 1230000 pattern
                '130\\d{4}',  // 1300000 pattern
                '1230000',
                '1300000'
            ];
            
            const coordinatesDetected = coordinatePatterns.some(pattern => {
                const regex = new RegExp(pattern, 'i');
                return regex.test(responseText);
            });
            
            if (coordinatesDetected) {
                // Award bonus points for correct coordinates
                evaluation.score = Math.min(evaluation.maxScore, evaluation.score + 2);
                console.log(`✅ [NavigationWorkflow] Correct coordinates detected (+2 bonus points)`);
            }
            
            // Check for zoom functionality mention
            const zoomPatterns = [
                'zoom.*10x',
                'zoom.*in',
                'magnify',
                'zoom.*factor'
            ];
            
            const zoomDetected = zoomPatterns.some(pattern => {
                const regex = new RegExp(pattern, 'i');
                return regex.test(responseText);
            });
            
            if (zoomDetected) {
                // Award remaining points for zoom functionality
                evaluation.score = evaluation.maxScore;
                console.log(`✅ [NavigationWorkflow] Zoom functionality detected - full points awarded`);
            }
        } else {
            evaluation.errors.push('Navigation success not detected in response');
            console.log(`❌ [NavigationWorkflow] Navigation success not detected`);
        }
        
        // Calculate success based on score
        evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * 0.4); // 40% threshold
        
        console.log(`🎯 [NavigationWorkflow] Natural language parsing results:`);
        console.log(`   Score: ${evaluation.score}/${evaluation.maxScore}`);
        console.log(`   Success: ${evaluation.success}`);
        
        return evaluation;
    }

    async evaluateWorkflowCall(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 10, // Use test's actual maxScore, default to 10 for complex
            errors: [],
            warnings: []
        };

        if (!actualResult) {
            evaluation.errors.push('No result obtained from workflow execution');
            return evaluation;
        }
        
        // Handle both structured tool results AND natural language responses
        const isNaturalLanguageResponse = typeof actualResult === 'string' || 
            (actualResult && typeof actualResult === 'object' && !actualResult.tool_name && !Array.isArray(actualResult));
        
        if (isNaturalLanguageResponse) {
            console.log('📝 [WorkflowCall] Detected natural language response, parsing for navigation success');
            return this.parseNaturalLanguageNavigationResponse(actualResult, expectedResult, testResult);
        }

        // For workflows, award points based on completion
        if (Array.isArray(actualResult) && actualResult.length > 1) {
            evaluation.score = Math.ceil(evaluation.maxScore * 0.5); // 50% for multi-step execution
            
            // Check if expected tools are present
            if (expectedResult.tool_sequence) {
                const actualTools = actualResult.map(call => call.tool_name);
                const expectedTools = expectedResult.tool_sequence;
                
                let toolMatches = 0;
                expectedTools.forEach(expectedTool => {
                    if (actualTools.includes(expectedTool)) {
                        toolMatches++;
                    }
                });
                
                if (expectedTools.length > 0) {
                    const remainingPoints = evaluation.maxScore - evaluation.score;
                    const toolScore = Math.floor(remainingPoints * (toolMatches / expectedTools.length));
                    evaluation.score += toolScore;
                }
            }
        } else {
            // Single step workflow
            const singleStepEval = await this.evaluateBasicFunctionCall(actualResult, 
                { tool_name: expectedResult.tool_sequence?.[0] || expectedResult.tool_name, 
                  parameters: expectedResult.parameters?.[0] || expectedResult.parameters }, 
                testResult);
            evaluation.score = singleStepEval.score;
            evaluation.errors = singleStepEval.errors;
            evaluation.warnings = singleStepEval.warnings;
        }

        evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * 0.4); // 40% threshold for complex workflows
        return evaluation;
    }

    async evaluateFileLoadingWorkflow(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 15,
            errors: [],
            warnings: [],
            details: {
                filesLoaded: [],
                toolsExecuted: [],
                successfulFiles: 0,
                totalFiles: 5  // Total expected files: ECOLI.gbk, bam, vcf, 2 wig files
            }
        };

        console.log('🔍 [FileLoadingWorkflow] Starting simplified evaluation with result:', actualResult);

        if (!actualResult) {
            evaluation.errors.push('No result obtained from file loading workflow');
            return evaluation;
        }

        // Handle both structured tool results AND natural language responses
        const isNaturalLanguageResponse = typeof actualResult === 'string' || 
            (actualResult && typeof actualResult === 'object' && !actualResult.tool_name && !Array.isArray(actualResult));
        
        if (isNaturalLanguageResponse) {
            console.log('📝 [FileLoadingWorkflow] Detected natural language response, parsing for file loading success');
            return this.parseNaturalLanguageFileLoadingResponse(actualResult, evaluation);
        }

        // Handle different result formats flexibly
        let results = [];
        if (Array.isArray(actualResult)) {
            results = actualResult;
        } else if (actualResult && typeof actualResult === 'object') {
            if (actualResult.tool_name) {
                results = [actualResult];
            } else if (actualResult.results && Array.isArray(actualResult.results)) {
                results = actualResult.results;
            } else {
                // Extract tool calls from object
                const extractedResults = [];
                Object.values(actualResult).forEach(value => {
                    if (value && typeof value === 'object' && value.tool_name) {
                        extractedResults.push(value);
                    }
                });
                results = extractedResults;
            }
        }

        console.log(`📋 [FileLoadingWorkflow] Processing ${results.length} results`);

        // Expected files for checking
        const expectedFiles = [
            'ECOLI.gbk', 
            '1655_C10.sorted.bam', 
            '1655_C10.mutations.vcf', 
            'first_sample.wig', 
            'another_sample.wig'
        ];
        
        // Expected tools for validation
        const expectedTools = {
            'load_genome_file': ['ECOLI.gbk'],
            'load_reads_file': ['1655_C10.sorted.bam'],
            'load_variant_file': ['1655_C10.mutations.vcf'],
            'load_wig_tracks': ['first_sample.wig', 'another_sample.wig']
        };
        
        // Points per successfully loaded file
        const pointsPerFile = Math.floor(evaluation.maxScore / evaluation.details.totalFiles);
        console.log(`📊 [FileLoadingWorkflow] Points per file: ${pointsPerFile}`);
        
        // Track loaded files to avoid double counting
        const loadedFiles = new Set();
        
        // Evaluate each result
        results.forEach((result, index) => {
            if (!result || !result.tool_name) {
                console.log(`⚠️ [FileLoadingWorkflow] Result ${index} missing tool_name`);
                return;
            }
            
            const toolName = result.tool_name;
            evaluation.details.toolsExecuted.push(toolName);
            console.log(`🔧 [FileLoadingWorkflow] Processing tool: ${toolName}`);
            
            // Check if tool is expected
            if (expectedTools[toolName]) {
                // Check if operation was successful
                const isSuccessful = result.success !== false && 
                                   !result.error && 
                                   result.message && 
                                   !result.message.toLowerCase().includes('error') &&
                                   !result.message.toLowerCase().includes('failed');
                
                if (isSuccessful) {
                    // Award points for each expected file that should be loaded by this tool
                    const toolFiles = expectedTools[toolName];
                    
                    // Check parameters to see if files are correctly specified
                    let hasCorrectParameters = false;
                    if (result.parameters) {
                        // Single file parameter
                        if (result.parameters.filePath) {
                            const fileName = result.parameters.filePath.split('/').pop();
                            if (toolFiles.some(expectedFile => 
                                fileName === expectedFile || 
                                fileName.includes(expectedFile) || 
                                expectedFile.includes(fileName)
                            )) {
                                hasCorrectParameters = true;
                            }
                        }
                        
                        // Multiple files parameter (for WIG tracks)
                        if (result.parameters.filePaths && Array.isArray(result.parameters.filePaths)) {
                            const fileNames = result.parameters.filePaths.map(path => path.split('/').pop());
                            hasCorrectParameters = toolFiles.some(expectedFile => 
                                fileNames.some(fileName => 
                                    fileName === expectedFile || 
                                    fileName.includes(expectedFile) || 
                                    expectedFile.includes(fileName)
                                )
                            );
                        }
                    }
                    
                    if (hasCorrectParameters) {
                        // Successful file loading - award full points per file
                        toolFiles.forEach(file => {
                            if (!loadedFiles.has(file)) {
                                loadedFiles.add(file);
                                evaluation.details.filesLoaded.push(file);
                                evaluation.details.successfulFiles++;
                                evaluation.score += pointsPerFile;
                                console.log(`✅ [FileLoadingWorkflow] File loaded successfully: ${file} (+${pointsPerFile} points)`);
                            }
                        });
                    } else {
                        // Tool correct but parameters incorrect - award 1 point only
                        evaluation.score += 1;
                        evaluation.warnings.push(`Tool '${toolName}' executed but parameters incorrect`);
                        console.log(`⚠️ [FileLoadingWorkflow] Tool '${toolName}' has incorrect parameters (+1 point only)`);
                    }
                } else {
                    // Tool failed - no points
                    evaluation.errors.push(`Tool '${toolName}' failed to execute successfully`);
                    console.log(`❌ [FileLoadingWorkflow] Tool '${toolName}' failed - no points`);
                }
            } else {
                // Unexpected tool - no points
                evaluation.warnings.push(`Unexpected tool executed: ${toolName}`);
                console.log(`⚠️ [FileLoadingWorkflow] Unexpected tool: ${toolName} - no points`);
            }
        });
        
        // Calculate success based on file loading
        const successRate = evaluation.details.successfulFiles / evaluation.details.totalFiles;
        evaluation.success = successRate >= 0.4; // At least 40% of files loaded successfully
        
        // Cap score at maximum
        evaluation.score = Math.min(evaluation.score, evaluation.maxScore);
        
        console.log(`🎯 [FileLoadingWorkflow] Final evaluation:`);
        console.log(`   Score: ${evaluation.score}/${evaluation.maxScore}`);
        console.log(`   Files loaded: ${evaluation.details.successfulFiles}/${evaluation.details.totalFiles} (${evaluation.details.filesLoaded.join(', ')})`);
        console.log(`   Success rate: ${(successRate * 100).toFixed(1)}%`);
        console.log(`   Success: ${evaluation.success}`);
        
        if (!evaluation.success) {
            evaluation.errors.push(`Insufficient files loaded: ${evaluation.details.successfulFiles}/${evaluation.details.totalFiles} (need at least 2 files)`);
        }
        
        return evaluation;
    }

    async setup(context) {
        console.log('🔧 [AutomaticComplexSuite] Setting up Automatic Complex test suite...');
        
        // 清理导出文件防止假阳性
        // Clean up export files to prevent false positives
        await this.cleanupExportFiles();
        
        console.log('✅ [AutomaticComplexSuite] Setup completed');
    }

    async cleanup(context) {
        console.log('Cleaning up Automatic Complex test suite');
    }
}

// Make the class available globally
window.AutomaticComplexSuite = AutomaticComplexSuite;