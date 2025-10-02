/**
 * Automatic Simple Benchmark Suite - Automatic evaluation + Simple complexity tests
 * Extracted from ComprehensiveBenchmarkSuite.js for better organization
 */
class AutomaticSimpleSuite {
    constructor() {
        this.suiteName = 'Automatic Simple Tests';
        this.suiteId = 'automatic_simple';
        this.description = 'Simple tests with automatic evaluation - Basic genomic analysis operations';
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
            console.log(`📁 AutomaticSimpleSuite default directory set to: ${this.defaultDirectory}`);
            
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
     * Initialize automatic simple test cases
     */
    initializeTests() {
        return [
            // DATA LOADING TASKS - Automatic + Simple (FIRST - Data must be loaded before other tests)
            {
                id: 'load_auto_01',
                name: 'Load Genome File Path',
                type: 'function_call',
                category: 'data_loading',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: `Load genome file ${this.buildFilePath('ECOLI.gbk')}`,
                expectedResult: {
                    tool_name: 'load_genome_file',
                    parameters: {
                        filePath: this.buildFilePath('ECOLI.gbk')
                    }
                },
                maxScore: 5,
                bonusScore: 1,

                evaluator: this.evaluateFileLoadingCall.bind(this)
            },
            {
                id: 'load_auto_02',
                name: 'Load BED Annotation File',
                type: 'function_call',
                category: 'data_loading',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: `Load BED annotation file ${this.buildFilePath('CHOPCHOP-Design.bed')}`,
                expectedResult: {
                    tool_name: 'load_annotation_file',
                    parameters: {
                        filePath: this.buildFilePath('CHOPCHOP-Design.bed')
                    }
                },
                maxScore: 5,
                bonusScore: 1,

                evaluator: this.evaluateFileLoadingCall.bind(this)
            },
            {
                id: 'load_auto_03',
                name: 'Load Aligned Reads File',
                type: 'function_call',
                category: 'data_loading',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: `Load aligned reads file ${this.buildFilePath('1655_C10.sorted.bam')}`,
                expectedResult: {
                    tool_name: 'load_reads_file',
                    parameters: {
                        filePath: this.buildFilePath('1655_C10.sorted.bam')
                    }
                },
                maxScore: 5,
                bonusScore: 1,

                evaluator: this.evaluateFileLoadingCall.bind(this)
            },
            {
                id: 'load_auto_04',
                name: 'Load Variant VCF File',
                type: 'function_call',
                category: 'data_loading',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: `Load variant VCF file ${this.buildFilePath('1655_C10.mutations.vcf')}`,
                expectedResult: {
                    tool_name: 'load_variant_file',
                    parameters: {
                        filePath: this.buildFilePath('1655_C10.mutations.vcf')
                    }
                },
                maxScore: 5,
                bonusScore: 1,

                evaluator: this.evaluateFileLoadingCall.bind(this)
            },
            {
                id: 'load_auto_05',
                name: 'Load WIG Track File',
                type: 'function_call',
                category: 'data_loading',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: `Load WIG track file ${this.buildFilePath('another_sample.wig')}`,
                expectedResult: {
                    tool_name: 'load_wig_tracks',
                    parameters: {
                        filePath: this.buildFilePath('another_sample.wig')
                    }
                },
                maxScore: 5,
                bonusScore: 1,

                evaluator: this.evaluateFileLoadingCall.bind(this)
            },

            // NAVIGATION TASKS - Automatic + Simple
            {
                id: 'nav_auto_01',
                name: 'Navigate to Genomic Position',
                type: 'function_call',
                category: 'navigation',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Navigate to genomic position 100000 on the current chromosome.',
                expectedResult: {
                    tool_name: 'navigate_to_position',
                    parameters: {
                        chromosome: '<current_chromosome>',
                        position: 100000
                    }
                },
                maxScore: 5,
                bonusScore: 1,

                evaluator: this.evaluateNavigationCall.bind(this)
            },
            {
                id: 'nav_auto_02',
                name: 'Navigate to 3.5M Position',
                type: 'function_call',
                category: 'navigation',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Navigate to genomic position 3.5M',
                expectedResult: {
                    tool_name: 'navigate_to_position',
                    parameters: {
                        chromosome: '<current_chromosome>',
                        position: 3500000
                    }
                },
                maxScore: 5,
                bonusScore: 1,

                evaluator: this.evaluateNavigationCall.bind(this)
            },
            {
                id: 'nav_auto_03',
                name: 'Navigate to Region Range',
                type: 'function_call',
                category: 'navigation',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Show me the genomic region from position 50000 to 75000.',
                expectedResult: {
                    tool_name: 'navigate_to_position',
                    parameters: {
                        chromosome: '<current_chromosome>',
                        start: 50000,
                        end: 75000
                    }
                },
                maxScore: 5,
                bonusScore: 1,

                evaluator: this.evaluateNavigationCall.bind(this)
            },
            {
                id: 'nav_auto_04',
                name: 'Get Current Browser State',
                type: 'function_call',
                category: 'navigation',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Get the current state of the genome browser.',
                expectedResult: {
                    tool_name: 'get_current_state',
                    parameters: {}
                },
                maxScore: 5,
                bonusScore: 1,

                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },

            // ANALYSIS TASKS - Automatic + Simple
            {
                id: 'anal_auto_01',
                name: 'Calculate GC Content',
                type: 'function_call',
                category: 'analysis',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Calculate the GC content of this DNA sequence: TCAAAATAGCCCAAGTTGCCCGGTCATAAGTGTAGCAAAATTATCCTCAATAAAAGGGAGTATTCCCTCCGCCACGGGTTGTAGCTGGCGGGTCAGATAGTGTTCGTAATCCAGTGGTGAACGTTGGTAGTCCAGCGGCTCCGGGCCGTTGGTGGTCCATACGTACTTAATGGTGCCGCGATTCTGATATTGCAAGGGGCGACCACGCTTTTGGTTTTCTTCATCGGCAAGGCGAGCGGCGCGTACATGAGGCGGCACATTACGCTGATACTCGCTCAGCGGACGGCGAAGGCGTTTACGGTAAACCAGTCGCGCATCCAGTTCA',
                expectedResult: {
                    tool_name: 'compute_gc',
                    parameters: {
                        sequence: 'TCAAAATAGCCCAAGTTGCCCGGTCATAAGTGTAGCAAAATTATCCTCAATAAAAGGGAGTATTCCCTCCGCCACGGGTTGTAGCTGGCGGGTCAGATAGTGTTCGTAATCCAGTGGTGAACGTTGGTAGTCCAGCGGCTCCGGGCCGTTGGTGGTCCATACGTACTTAATGGTGCCGCGATTCTGATATTGCAAGGGGCGACCACGCTTTTGGTTTTCTTCATCGGCAAGGCGAGCGGCGCGTACATGAGGCGGCACATTACGCTGATACTCGCTCAGCGGACGGCGAAGGCGTTTACGGTAAACCAGTCGCGCATCCAGTTCA',
                        include_statistics: true
                    }
                },
                maxScore: 5,
                bonusScore: 1,

                evaluator: this.evaluateSequenceAnalysisCall.bind(this)
            },
            {
                id: 'anal_auto_02',
                name: 'Reverse Complement',
                type: 'function_call',
                category: 'analysis',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Get the reverse complement of sequence TTACCGACTGCGGCCTGAGTTTTTTAAGTGACGTAAAATCGTGTTGAGGCCAACGCCCATAATGCGGGCTGTTGCCCGGCATCCAACGCCATTCATGGCCATATCAATGATTTTCTGGTGCGTACCGGGTTGAGAAGCGGTGTAAGTGAACTGCAGTTGCCATGTTTTACGGCAGTGAGAGCAGAGATAGCGCTGATGTCCGGCGGTGCTTTTGCCGTTACGCACCACCCCGTCAGTAGCTGAACAGGAGGGACAGCTGATAGAAACAGAAGCCAC',
                expectedResult: {
                    tool_name: 'reverse_complement',
                    parameters: {
                        sequence: 'TTACCGACTGCGGCCTGAGTTTTTTAAGTGACGTAAAATCGTGTTGAGGCCAACGCCCATAATGCGGGCTGTTGCCCGGCATCCAACGCCATTCATGGCCATATCAATGATTTTCTGGTGCGTACCGGGTTGAGAAGCGGTGTAAGTGAACTGCAGTTGCCATGTTTTACGGCAGTGAGAGCAGAGATAGCGCTGATGTCCGGCGGTGCTTTTGCCGTTACGCACCACCCCGTCAGTAGCTGAACAGGAGGGACAGCTGATAGAAACAGAAGCCAC'
                    }
                },
                maxScore: 5,
                bonusScore: 1,

                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },
            {
                id: 'anal_auto_03',
                name: 'Translate DNA to Protein',
                type: 'function_call',
                category: 'analysis',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Translate DNA sequence "TTGGCTAATATCAAATCAGCTAAGAAGCGCGCCATTCAGTCTGAAAAGGCTCGTAAGCACAACGCAAGCCGTCGCTCTATGATGCGTACTTTCATCAAGAAAGTATACGCAGCTATCGAAGCTGGCGACAAAGCTGCTGCACAGAAAGCATTTAACGAAATGCAACCGATCGTGGACCGTCAGGCTGCTAAAGGTCTGATCCACAAAAACAAAGCTGCACGTCATAAGGCTAACCTGACTGCACAGATCAACAAACTGGCTTAA" to protein',
                expectedResult: {
                    tool_name: 'translate_dna',
                    parameters: {
                        dna: 'TTGGCTAATATCAAATCAGCTAAGAAGCGCGCCATTCAGTCTGAAAAGGCTCGTAAGCACAACGCAAGCCGTCGCTCTATGATGCGTACTTTCATCAAGAAAGTATACGCAGCTATCGAAGCTGGCGACAAAGCTGCTGCACAGAAAGCATTTAACGAAATGCAACCGATCGTGGACCGTCAGGCTGCTAAAGGTCTGATCCACAAAAACAAAGCTGCACGTCATAAGGCTAACCTGACTGCACAGATCAACAAACTGGCTTAA'  // FIXED: Use 'dna' parameter name instead of 'sequence'
                    }
                },
                maxScore: 5,
                bonusScore: 1,

                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },

            // SEARCH TASKS - Automatic + Simple
            {
                id: 'search_auto_01',
                name: 'Search Gene lacZ',
                type: 'function_call',
                category: 'search',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Search for the gene lacZ by name.',
                expectedResult: {
                    tool_name: 'search_gene_by_name',
                    parameters: {
                        name: 'lacZ'
                    }
                },
                maxScore: 5,
                bonusScore: 1,

                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },
            {
                id: 'search_auto_02',
                name: 'Search Ribosome Functions',
                type: 'function_call',
                category: 'search',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Find genes related to ribosome function.',
                expectedResult: {
                    tool_name: 'search_features',
                    parameters: {
                        query: 'ribosome',
                        caseSensitive: false
                    }
                },
                maxScore: 5,
                bonusScore: 1,

                evaluator: this.evaluateSearchFunctionCall.bind(this)
            },
            {
                id: 'search_auto_03',
                name: 'Search Locus Tag b0344',
                type: 'function_call',
                category: 'search',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Find the gene with locus tag b0344.',
                expectedResult: {
                    tool_name: 'search_gene_by_name',
                    parameters: {
                        name: 'b0344'
                    }
                },
                maxScore: 5,
                bonusScore: 1,

                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },

            // EXTERNAL DATABASE TASKS - Automatic + Simple
            // Note: ext_auto_01 (UniProt lacZ search) test removed as requested
            {
                id: 'ext_auto_02',
                name: 'Get AlphaFold Structure for araA',
                type: 'function_call',
                category: 'external_database',
                complexity: 'simple',
                evaluation: 'automatic',
                instruction: 'Get AlphaFold structure prediction for gene araA.',
                expectedResult: {
                    tool_name: 'alphafold_search',
                    parameters: {
                        sequence: '<araA_protein_sequence>',
                        blastType: 'blastp',
                        database: 'nr'
                    }
                },
                maxScore: 5,
                bonusScore: 1,

                evaluator: this.evaluateBasicFunctionCall.bind(this)
            }
        ];
    }

    /**
     * Evaluator methods - shared across all suite types
     */
    async evaluateBasicFunctionCall(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 5, // Use test's actual maxScore, default to 5 for simple
            errors: [],
            warnings: []
        };

        if (!actualResult) {
            evaluation.errors.push('No result obtained from test execution');
            return evaluation;
        }

        // // 🔍 SONG'S DEBUGGING: Log detected tools for analysis
        // console.log(`🎯 [SONG DEBUG] evaluateBasicFunctionCall called for test: ${testResult.testId || 'unknown'}`);
        // console.log(`🎯 [SONG DEBUG] actualResult type:`, typeof actualResult);
        // console.log(`🎯 [SONG DEBUG] actualResult content:`, actualResult);
        // console.log(`🎯 [SONG DEBUG] expectedResult:`, expectedResult);
        
        // Extract tool name from actualResult - SONG DEBUG
        let actualTool = Array.isArray(actualResult) ? actualResult[0]?.tool_name : actualResult.tool_name;
        console.log(`🎯 [SONG DEBUG] Extracted tool name: '${actualTool}' (expected: '${expectedResult.tool_name}')`);
        
        // Record detected tool for Song's analysis
        if (window.songBenchmarkDebug) {
            window.songBenchmarkDebug.detectedTools = window.songBenchmarkDebug.detectedTools || [];
            window.songBenchmarkDebug.detectedTools.push({
                testId: testResult.testId,
                testName: testResult.testName || 'unknown',
                expectedTool: expectedResult.tool_name,
                actualTool: actualTool,
                actualResultType: typeof actualResult,
                actualResult: actualResult,
                timestamp: new Date().toISOString()
            });
        } else {
            window.songBenchmarkDebug = {
                detectedTools: [{
                    testId: testResult.testId,
                    testName: testResult.testName || 'unknown', 
                    expectedTool: expectedResult.tool_name,
                    actualTool: actualTool,
                    actualResultType: typeof actualResult,
                    actualResult: actualResult,
                    timestamp: new Date().toISOString()
                }]
            };
        }

        console.log(`📊 [evaluateBasicFunctionCall] Evaluating test result:`, {
            testId: testResult.testId,
            expectedTool: expectedResult.tool_name,
            actualResult: actualResult,
            resultType: typeof actualResult
        });

        // PRIORITY 0: Check Tool Execution Tracker for direct execution status
        if (window.chatManager && window.chatManager.toolExecutionTracker) {
            const tracker = window.chatManager.toolExecutionTracker;
            const recentExecutions = tracker.getSessionExecutions();
            
            console.log(`🔍 [evaluateBasicFunctionCall] Checking tracker for tool: ${expectedResult.tool_name}`);
            
            // Look for recent successful execution of the expected tool
            const relevantExecution = recentExecutions.find(exec => 
                exec.toolName === expectedResult.tool_name && 
                exec.status === 'completed' &&
                Date.now() - exec.startTime < 30000 // Within last 30 seconds
            );
            
            if (relevantExecution) {
                console.log(`✅ [evaluateBasicFunctionCall] TRACKER SUCCESS: Found successful execution of '${expectedResult.tool_name}'`, relevantExecution);
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
                console.log(`❌ [evaluateBasicFunctionCall] TRACKER FAILURE: Found failed execution of '${expectedResult.tool_name}'`, failedExecution);
                evaluation.errors.push(`Tool execution failed: ${failedExecution.error?.message || 'Unknown error'}`);
                return evaluation; // Score remains 0
            }
        }

        // PRIORITY 1: Check for explicit tool execution success signals
        if (typeof actualResult === 'string') {
            const successPatterns = [
                /tool execution completed.*succeeded/i,
                /successfully (executed|navigated|loaded|processed|analyzed)/i,
                /task completed successfully/i,
                /operation completed successfully/i,
                /results have been processed/i
            ];
            
            const hasSuccessSignal = successPatterns.some(pattern => pattern.test(actualResult));
            
            if (hasSuccessSignal) {
                // For "Tool execution completed: X succeeded" - this is explicit success, award full points
                if (/tool execution completed.*succeeded/i.test(actualResult)) {
                    console.log(`✅ [evaluateBasicFunctionCall] EXPLICIT EXECUTION SUCCESS: "Tool execution completed" detected`);
                    evaluation.score = evaluation.maxScore; // FULL POINTS
                    evaluation.success = true;
                    evaluation.warnings.push('Awarded full points based on explicit tool execution success');
                    return evaluation;
                }
                
                // For other success patterns, check if the expected tool name appears in the response
                const toolMentioned = actualResult.toLowerCase().includes(expectedResult.tool_name.toLowerCase());
                
                if (toolMentioned) {
                    console.log(`✅ [evaluateBasicFunctionCall] SUCCESS SIGNAL DETECTED: Tool '${expectedResult.tool_name}' executed successfully`);
                    evaluation.score = evaluation.maxScore; // FULL POINTS
                    evaluation.success = true;
                    evaluation.warnings.push('Awarded full points based on explicit success signal');
                    return evaluation;
                }
            }
        }

        // PRIORITY 2: Standard structured result evaluation
        actualTool = Array.isArray(actualResult) ? actualResult[0]?.tool_name : actualResult.tool_name;
        
        if (actualTool === expectedResult.tool_name) {
            console.log(`✅ [evaluateBasicFunctionCall] Correct tool name detected: ${actualTool}`);
            evaluation.score = evaluation.maxScore; // Full points for correct tool
        } else {
            console.log(`❌ [evaluateBasicFunctionCall] Tool mismatch: expected '${expectedResult.tool_name}', got '${actualTool}'`);
            evaluation.errors.push(`Expected tool '${expectedResult.tool_name}' but got '${actualTool}'`);
            evaluation.score = 0; // No points for wrong tool
            evaluation.success = false;
            return evaluation;
        }

        // PRIORITY 3: Enhanced parameter validation with position↔range conversion support
        const actualParams = Array.isArray(actualResult) ? actualResult[0]?.parameters : actualResult.parameters;
        if (actualParams && expectedResult.parameters) {
            const expectedKeys = Object.keys(expectedResult.parameters);
            const matchingKeys = expectedKeys.filter(key => {
                if (!(key in actualParams)) {
                    // Special case: position parameter might be converted to start/end range
                    if (key === 'position' && 'start' in actualParams && 'end' in actualParams) {
                        const expectedPosition = expectedResult.parameters[key];
                        const actualStart = actualParams.start;
                        const actualEnd = actualParams.end;
                        
                        // Check if the expected position is within the actual range (tolerance: 2000bp)
                        const rangeCenter = Math.floor((actualStart + actualEnd) / 2);
                        const tolerance = Math.abs(actualEnd - actualStart); // Use actual range size as tolerance
                        const positionMatch = Math.abs(expectedPosition - rangeCenter) <= tolerance / 2;
                        
                        console.log(`🔄 [evaluateBasicFunctionCall] Position→Range conversion detected:`, {
                            expectedPosition,
                            actualStart,
                            actualEnd,
                            rangeCenter,
                            tolerance,
                            positionMatch
                        });
                        
                        return positionMatch;
                    }
                    
                    // Special case: start/end range might be expected when position was provided
                    if ((key === 'start' || key === 'end') && 'position' in actualParams) {
                        const actualPosition = actualParams.position;
                        const expectedValue = expectedResult.parameters[key];
                        
                        // For start parameter: check if position is reasonably close (within expected range)
                        if (key === 'start') {
                            const expectedEnd = expectedResult.parameters.end || (expectedValue + 2000);
                            const positionInRange = actualPosition >= expectedValue && actualPosition <= expectedEnd;
                            
                            console.log(`🔄 [evaluateBasicFunctionCall] Range→Position conversion for start:`, {
                                expectedStart: expectedValue,
                                expectedEnd,
                                actualPosition,
                                positionInRange
                            });
                            
                            return positionInRange;
                        }
                        
                        // For end parameter: check if position is reasonably close (within expected range)
                        if (key === 'end') {
                            const expectedStart = expectedResult.parameters.start || (expectedValue - 2000);
                            const positionInRange = actualPosition >= expectedStart && actualPosition <= expectedValue;
                            
                            console.log(`🔄 [evaluateBasicFunctionCall] Range→Position conversion for end:`, {
                                expectedStart,
                                expectedEnd: expectedValue,
                                actualPosition,
                                positionInRange
                            });
                            
                            return positionInRange;
                        }
                    }
                    
                    console.log(`❌ [evaluateBasicFunctionCall] Missing parameter: ${key}`);
                    return false;
                }
                
                const actualValue = actualParams[key];
                const expectedValue = expectedResult.parameters[key];
                
                // Direct value match
                const directMatch = actualValue === expectedValue;
                
                // Placeholder matches (enhanced)
                const isPlaceholder = expectedValue === '<current_chromosome>' ||
                                    expectedValue === '<lacZ_protein_sequence>' ||
                                    expectedValue === '<araA_protein_sequence>';
                
                // For chromosome placeholder, accept any valid chromosome name
                const isValidChromosome = expectedValue === '<current_chromosome>' && 
                    (typeof actualValue === 'string' && actualValue.length > 0);
                
                const matches = directMatch || isPlaceholder || isValidChromosome;
                
                console.log(`🔍 [evaluateBasicFunctionCall] Parameter '${key}':`, {
                    expected: expectedValue,
                    actual: actualValue,
                    directMatch,
                    isPlaceholder,
                    isValidChromosome,
                    matches
                });
                
                return matches;
            });
            
            // Deduct 1 point for each missing/incorrect parameter
            const missingParams = expectedKeys.length - matchingKeys.length;
            if (missingParams > 0) {
                evaluation.score = Math.max(0, evaluation.score - missingParams);
                evaluation.warnings.push(`${missingParams} parameter(s) missing or incorrect`);
                console.log(`⚠️ [evaluateBasicFunctionCall] Deducting ${missingParams} points for parameter issues`);
            } else {
                console.log(`✅ [evaluateBasicFunctionCall] All parameters matched correctly`);
            }
        }

        evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * 0.6); // 60% threshold
        
        console.log(`🏆 [evaluateBasicFunctionCall] Final evaluation:`, {
            score: evaluation.score,
            maxScore: evaluation.maxScore,
            success: evaluation.success,
            errors: evaluation.errors,
            warnings: evaluation.warnings
        });
        
        // 📊 SONG'S TOOL DETECTION SUMMARY
        console.log(`📊 [SONG SUMMARY] Tool Detection Result for ${testResult.testName || testResult.testId}:`);
        console.log(`   Expected: ${expectedResult.tool_name}`);
        console.log(`   Detected: ${actualTool}`);
        console.log(`   Match: ${actualTool === expectedResult.tool_name ? '✅ YES' : '❌ NO'}`);
        console.log(`   Score: ${evaluation.score}/${evaluation.maxScore}`);
        console.log(`📋 [SONG TIP] Use 'window.songBenchmarkDebug.detectedTools' in console to see all detected tools`);
        
        return evaluation;
    }

    async evaluateNavigationCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // Add navigation-specific checks
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
        }
        
        return evaluation;
    }

    async evaluateFileLoadingCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // Add file loading specific checks
        if (actualResult && actualResult.parameters && actualResult.parameters.filePath) {
            const actualFilePath = actualResult.parameters.filePath;
            const expectedFilePath = expectedResult.parameters.filePath;
            
            // Check if filename matches (flexible path matching)
            const expectedFileName = expectedFilePath.split('/').pop();
            const actualFileName = actualFilePath.split('/').pop();
            
            if (actualFileName === expectedFileName || actualFilePath.includes(expectedFileName)) {
                evaluation.score = Math.min(evaluation.maxScore, evaluation.score + (testResult.bonusScore || 1));
                console.log(`✅ File loading: correct file '${expectedFileName}'`);
            } else {
                evaluation.warnings.push(`Expected file '${expectedFileName}' but got '${actualFileName}'`);
            }
            
            // Log current default directory for debugging
            const currentDir = this.getDefaultDirectory();
            console.log(`📁 File loading using directory: ${currentDir}`);
        }
        
        return evaluation;
    }

    async evaluateSequenceAnalysisCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // Add sequence-specific bonus
        if (actualResult && actualResult.parameters && actualResult.parameters.sequence) {
            const sequence = actualResult.parameters.sequence.toUpperCase();
            const validChars = /^[ATCGN]+$/;
            
            if (validChars.test(sequence)) {
                evaluation.score = Math.min(evaluation.maxScore, evaluation.score + (testResult.bonusScore || 1)); // Add bonus points
            } else {
                evaluation.warnings.push('Sequence contains invalid DNA characters');
            }
        }
        
        return evaluation;
    }

    async evaluateSearchFunctionCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // Add search-specific bonus
        if (actualResult && actualResult.parameters) {
            const params = actualResult.parameters;
            
            // Check for case sensitivity handling
            if (params.caseSensitive === false || params.caseSensitive === true) {
                evaluation.score = Math.min(evaluation.maxScore, evaluation.score + (testResult.bonusScore || 1)); // Add bonus points
            }
        }
        
        return evaluation;
    }

    async setup(context) {
        console.log('Setting up Automatic Simple test suite');
    }

    async cleanup(context) {
        console.log('Cleaning up Automatic Simple test suite');
    }
}

// Make the class available globally
window.AutomaticSimpleSuite = AutomaticSimpleSuite;