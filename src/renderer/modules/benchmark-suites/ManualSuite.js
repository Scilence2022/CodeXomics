/**
 * Manual Benchmark Suite - Manual evaluation tests (Simple + Complex)
 * Renamed from ManualSimpleSuite.js for broader scope
 */
class ManualSuite {
    constructor() {
        this.suiteName = 'Manual Tests';
        this.suiteId = 'manual_suite';
        this.description = 'Manual evaluation tests - Genomic operations requiring human verification';
        this.framework = null;
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
     * Initialize manual test cases
     */
    initializeTests() {
        return [
            // DATA LOADING TASKS - Manual + Simple (FIRST - Data must be loaded before other tests)
            {
                id: 'load_manual_01',
                name: 'Load Genome File Dialog',
                type: 'function_call',
                category: 'data_loading',
                complexity: 'simple',
                evaluation: 'manual',
                instruction: 'Load a genome file using the file selection dialog.',
                expectedResult: {
                    tool_name: 'load_genome_file',
                    parameters: {
                        showFileDialog: true
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 300000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please verify: 1) File selection dialog opens properly, 2) Dialog supports FASTA/GenBank formats.'
            },
            {
                id: 'load_manual_02',
                name: 'Load Annotation Data',
                type: 'function_call',
                category: 'data_loading',
                complexity: 'simple',
                evaluation: 'manual',
                instruction: 'Load annotation data for the current genome.',
                expectedResult: {
                    tool_name: 'load_annotation_file',
                    parameters: {}
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 300000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please verify: 1) Annotation loading interface appears, 2) Annotation file can be loaded and visualized.'
            },
            {
                id: 'load_manual_03',
                name: 'Load Aligned Reads',
                type: 'function_call',
                category: 'data_loading',
                complexity: 'simple',
                evaluation: 'manual',
                instruction: 'Load aligned reads data for genome visualization.',
                expectedResult: {
                    tool_name: 'load_reads_file',
                    parameters: {}
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 300000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please verify: 1) Reads file dialog opens, 2) BAM/SAM file can be loaded and visualized.'
            },
            {
                id: 'load_manual_04',
                name: 'Load WIG Track Data',
                type: 'function_call',
                category: 'data_loading',
                complexity: 'simple',
                evaluation: 'manual',
                instruction: 'Load WIG track data for quantitative visualization.',
                expectedResult: {
                    tool_name: 'load_wig_tracks',
                    parameters: {}
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 300000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please verify: 1) WIG file loading interface appears, 2) WIG files can be loaded and visulized.'
            },

            // NAVIGATION TASKS - Manual + Simple
            {
                id: 'nav_manual_01',
                name: 'Jump to lacZ Gene',
                type: 'function_call',
                category: 'navigation',
                complexity: 'simple',
                evaluation: 'manual',
                instruction: 'Jump to the lacZ gene location.',
                expectedResult: {
                    tool_name: 'jump_to_gene',
                    parameters: {
                        geneName: 'lacZ'
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 300000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please verify: 1) Browser navigates to lacZ gene；'
            },
            {
                id: 'nav_manual_02',
                name: 'Open New Browser Tab',
                type: 'function_call',
                category: 'navigation',
                complexity: 'simple',
                evaluation: 'manual',
                instruction: 'Open a new tab.',
                expectedResult: {
                    tool_name: 'open_new_tab',
                    parameters: {}
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 300000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please verify: 1) New browser tab opens successfully；'
            },
            {
                id: 'nav_manual_03',
                name: 'Switch to First Tab',
                type: 'function_call',
                category: 'navigation',
                complexity: 'simple',
                evaluation: 'manual',
                instruction: 'Switch to the first tab (tab index 0).',
                expectedResult: {
                    tool_name: 'switch_to_tab',
                    parameters: {
                        tab_index: 0
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 300000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please verify: 1) Browser switches to the first tab successfully；'
            },
           

            // ANALYSIS TASKS - Manual + Simple
            {
                id: 'anal_manual_01',
                name: 'lacZ Codon Usage Analysis',
                type: 'function_call',
                category: 'analysis',
                complexity: 'simple',
                evaluation: 'manual',
                instruction: 'Analyze codon usage patterns for the lacZ gene',
                expectedResult: {
                    tool_name: 'codon_usage_analysis',
                    parameters: {
                        geneName: 'lacZ',
                        include_statistics: true
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 300000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please verify: 1) Codon usage analysis is performed for lacZ, 2) Results show frequency tables and statistics；'
            },

            // SEARCH TASKS - Manual + Simple
            {
                id: 'search_manual_01',
                name: 'Search b1210 Locus Tags',
                type: 'function_call',
                category: 'search',
                complexity: 'simple',
                evaluation: 'manual',
                instruction: 'Search for genes with locus tags starting with \'b1210\'.',
                expectedResult: {
                    tool_name: 'search_gene_by_name',
                    parameters: {
                        name: 'b1210',
                        exact_match: false
                    }
                },
                maxScore: 5,
                bonusScore: 1,
                timeout: 300000,
                evaluator: this.evaluateBasicFunctionCall.bind(this),
                manualVerification: 'Please verify: 1) Search identifies genes with locus tags b1210 etc.;'
            },

            // COMPLEX NAVIGATION WORKFLOW - Manual + Complex
            {
                id: 'navi_manual_01',
                name: 'Open tabs and navigate to different positions',
                type: 'workflow',
                category: 'navigation',
                complexity: 'complex',
                evaluation: 'manual',
                instruction: 'Open three new tabs and navigate to different positions: 1) Open a new tab then navigate to position 1000000, 2) Open a new tab then jump to lacZ gene, 3) Open a new tab then navigate to position 2500000.',
                expectedResult: {
                    tool_sequence: ['open_new_tab', 'navigate_to_position', 'open_new_tab', 'jump_to_gene', 'open_new_tab', 'navigate_to_position'],
                    parameters: [
                        {},  // open_new_tab 1
                        { chromosome: '<current_chromosome>', position: 1000000 },  // navigate to 1M in new tab
                        {},  // open_new_tab 2
                        { geneName: 'lacZ' },  // jump to lacZ in new tab
                        {},  // open_new_tab 3
                        { chromosome: '<current_chromosome>', position: 2500000 }  // navigate to 2.5M in new tab
                    ]
                },
                maxScore: 15,
                bonusScore: 5,
                timeout: 300000,
                evaluator: this.evaluateComplexNavigationWorkflow.bind(this),
                manualVerification: 'Please verify: 1) Three new tabs are opened successfully, 2) First new tab automatically navigates to position 1000000, 3) Second new tab automatically navigates to lacZ gene location, 4) Third new tab automatically navigates to position 2500000, 5) Navigation in each tab is accurate and responsive.'
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

        console.log(`📊 [ManualSuite] Evaluating test result:`, {
            testId: testResult.testId,
            expectedTool: expectedResult.tool_name,
            actualResult: actualResult,
            resultType: typeof actualResult
        });

        // PRIORITY 0: Check Tool Execution Tracker for direct execution status
        if (window.chatManager && window.chatManager.toolExecutionTracker) {
            const tracker = window.chatManager.toolExecutionTracker;
            const recentExecutions = tracker.getSessionExecutions();
            
            console.log(`🔍 [ManualSuite] Checking tracker for tool: ${expectedResult.tool_name}`);
            
            // Look for recent successful execution of the expected tool
            // Use configured benchmark timeout instead of hardcoded 30 seconds
            const timeoutMs = (this.framework && this.framework.testTimeout) || 120000; // Default to 2 minutes
            const relevantExecution = recentExecutions.find(exec => 
                exec.toolName === expectedResult.tool_name && 
                exec.status === 'completed' &&
                Date.now() - exec.startTime < timeoutMs // Within configured timeout window
            );
            
            if (relevantExecution) {
                console.log(`✅ [ManualSuite] TRACKER SUCCESS: Found successful execution of '${expectedResult.tool_name}'`, relevantExecution);
                evaluation.score = evaluation.maxScore; // FULL POINTS from tracker
                evaluation.success = true;
                evaluation.warnings.push('Awarded full points based on Tool Execution Tracker data');
                return evaluation;
            }
            
            // Look for recent failed execution
            const failedExecution = recentExecutions.find(exec => 
                exec.toolName === expectedResult.tool_name && 
                exec.status === 'failed' &&
                Date.now() - exec.startTime < timeoutMs // Within configured timeout window
            );
            
            if (failedExecution) {
                console.log(`❌ [ManualSuite] TRACKER FAILURE: Found failed execution of '${expectedResult.tool_name}'`, failedExecution);
                evaluation.errors.push(`Tool execution failed: ${failedExecution.error?.message || 'Unknown error'}`);
                return evaluation; // Score remains 0
            }
        }

        // ENHANCED: Handle multiple tool calls - check all tools in array
        let actualTools = [];
        let actualTool = null;
        
        if (Array.isArray(actualResult)) {
            actualTools = actualResult.map(call => call?.tool_name).filter(Boolean);
            actualTool = actualTools[0]; // Primary tool for backward compatibility
            console.log(`🎯 [ManualSuite] Multiple tools detected:`, actualTools);
            console.log(`🎯 [ManualSuite] Checking if expected tool '${expectedResult.tool_name}' is in:`, actualTools);
            
            // Check if expected tool is in the array
            if (actualTools.includes(expectedResult.tool_name)) {
                actualTool = expectedResult.tool_name; // Use the expected tool for evaluation
                console.log(`✅ [ManualSuite] Expected tool '${expectedResult.tool_name}' found in tool array!`);
            } else {
                console.log(`❌ [ManualSuite] Expected tool '${expectedResult.tool_name}' NOT found in tool array`);
            }
        } else {
            actualTool = actualResult?.tool_name;
            actualTools = actualTool ? [actualTool] : [];
            console.log(`🎯 [ManualSuite] Single tool detected: '${actualTool}'`);
        }
        
        console.log(`🎯 [ManualSuite] Final extracted tool name: '${actualTool}' (expected: '${expectedResult.tool_name}')`);        
        
        // Check if expected tool is found in the detected tools array
        if (actualTools.includes(expectedResult.tool_name)) {
            console.log(`✅ [ManualSuite] EXPECTED TOOL FOUND: '${expectedResult.tool_name}' detected in tools array`);
            evaluation.score = evaluation.maxScore; // FULL POINTS for correct tool detection
            actualTool = expectedResult.tool_name; // Set for parameter evaluation
        } else if (actualTool === expectedResult.tool_name) {
            console.log(`✅ [ManualSuite] Correct tool name detected: ${actualTool}`);
            evaluation.score = evaluation.maxScore; // Full points for correct tool
        } else {
            console.log(`❌ [ManualSuite] Tool mismatch: expected '${expectedResult.tool_name}', got '${actualTool}'`);
            console.log(`❌ [ManualSuite] Available tools were:`, actualTools);
            evaluation.errors.push(`Expected tool '${expectedResult.tool_name}' but got '${actualTool || 'none'}'. Available tools: [${actualTools.join(', ')}]`);
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
            
            // Deduct 1 point for each missing/incorrect parameter
            const missingParams = expectedKeys.length - matchingKeys.length;
            if (missingParams > 0) {
                evaluation.score = Math.max(0, evaluation.score - missingParams);
                evaluation.warnings.push(`${missingParams} parameter(s) missing or incorrect`);
            }
        }

        evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * 0.6); // 60% threshold
        return evaluation;
    }

    /**
     * Evaluate complex navigation workflow with multiple tabs and navigation
     */
    async evaluateComplexNavigationWorkflow(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 15,
            errors: [],
            warnings: [],
            details: {
                toolsExecuted: [],
                expectedSequence: expectedResult.tool_sequence || [],
                actualSequence: [],
                sequenceMatch: false
            }
        };

        console.log(`🧭 [ManualSuite] Evaluating complex navigation workflow:`, {
            testId: testResult.testId,
            expectedSequence: expectedResult.tool_sequence,
            actualResult: actualResult
        });

        if (!actualResult) {
            evaluation.errors.push('No result obtained from complex navigation workflow');
            return evaluation;
        }

        // Handle multiple tool calls in sequence
        let toolResults = [];
        if (Array.isArray(actualResult)) {
            toolResults = actualResult;
        } else if (actualResult.tool_name) {
            toolResults = [actualResult];
        }

        console.log(`🧭 [ManualSuite] Processing ${toolResults.length} tool calls in workflow`);

        // Extract actual tool sequence
        evaluation.details.actualSequence = toolResults.map(result => result?.tool_name).filter(Boolean);
        evaluation.details.toolsExecuted = evaluation.details.actualSequence;

        // Check sequence matching
        const expectedSequence = evaluation.details.expectedSequence;
        const actualSequence = evaluation.details.actualSequence;
        
        // Flexible sequence matching - allow for partial matches
        let sequenceScore = 0;
        const maxSequenceScore = 8; // 8 points for sequence matching
        
        if (actualSequence.length > 0) {
            // Award points for each correctly executed tool in sequence
            const minLength = Math.min(expectedSequence.length, actualSequence.length);
            let correctTools = 0;
            
            for (let i = 0; i < minLength; i++) {
                if (actualSequence[i] === expectedSequence[i]) {
                    correctTools++;
                }
            }
            
            sequenceScore = Math.round((correctTools / expectedSequence.length) * maxSequenceScore);
            evaluation.details.sequenceMatch = correctTools >= Math.ceil(expectedSequence.length * 0.7); // 70% match required
        }

        // Award additional points for workflow completion
        let workflowScore = 0;
        const maxWorkflowScore = 7; // 7 points for overall workflow success
        
        // Check for key workflow components
        const hasTabCreation = actualSequence.includes('open_new_tab');
        const hasTabSwitching = actualSequence.includes('switch_to_tab');
        const hasNavigation = actualSequence.includes('navigate_to_position') || actualSequence.includes('jump_to_gene');
        
        if (hasTabCreation) workflowScore += 3;
        if (hasTabSwitching) workflowScore += 2;
        if (hasNavigation) workflowScore += 2;

        evaluation.score = sequenceScore + workflowScore;
        evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * 0.6); // 60% threshold

        // Add detailed feedback
        evaluation.warnings.push(`Sequence matching: ${sequenceScore}/${maxSequenceScore} points`);
        evaluation.warnings.push(`Workflow completion: ${workflowScore}/${maxWorkflowScore} points`);
        evaluation.warnings.push(`Tools executed: ${actualSequence.join(' → ')}`);

        console.log(`🧭 [ManualSuite] Complex navigation workflow evaluation complete:`, {
            score: evaluation.score,
            maxScore: evaluation.maxScore,
            success: evaluation.success,
            sequenceMatch: evaluation.details.sequenceMatch,
            toolsExecuted: evaluation.details.toolsExecuted.length
        });

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

    async evaluateSequenceAnalysisCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // Add sequence-specific checks
        if (actualResult && actualResult.parameters && actualResult.parameters.sequence) {
            const sequence = actualResult.parameters.sequence.toUpperCase();
            const validChars = /^[ATCGN]+$/;
            
            if (validChars.test(sequence)) {
                evaluation.score += 5; // Bonus for valid DNA sequence
            } else {
                evaluation.warnings.push('Sequence contains invalid DNA characters');
            }
        }
        
        return evaluation;
    }

    async evaluateSearchFunctionCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // Add search-specific checks
        if (actualResult && actualResult.parameters) {
            const params = actualResult.parameters;
            
            // Check for case sensitivity handling
            if (params.caseSensitive === false || params.caseSensitive === true) {
                evaluation.score += 2; // Bonus for explicit case sensitivity handling
            }
        }
        
        return evaluation;
    }

    async evaluateTabSwitchCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        console.log(`🔄 [ManualSuite] Evaluating tab switch call:`, {
            testId: testResult.testId,
            expectedTool: expectedResult.tool_name,
            actualResult: actualResult
        });
        
        // Add tab switching-specific checks
        if (actualResult && actualResult.parameters) {
            const params = actualResult.parameters;
            
            // Validate tab switching parameters
            if (params.tab_id || params.tab_name || params.tab_index !== undefined) {
                evaluation.score += 1; // Bonus for providing valid tab identification
                
                // Bonus for using appropriate parameter types
                if (params.tab_index !== undefined && typeof params.tab_index === 'number') {
                    evaluation.score += 1; // Bonus for correct index type
                }
                
                if (params.tab_name && typeof params.tab_name === 'string') {
                    evaluation.score += 1; // Bonus for string tab name
                }
                
                if (params.tab_id && typeof params.tab_id === 'string') {
                    evaluation.score += 1; // Bonus for string tab ID
                }
            } else {
                evaluation.warnings.push('No valid tab identification parameter provided (tab_id, tab_name, or tab_index required)');
            }
            
            // Check for invalid combinations
            const providedParams = [params.tab_id, params.tab_name, params.tab_index].filter(p => p !== undefined && p !== null);
            if (providedParams.length > 1) {
                evaluation.warnings.push('Multiple tab identification parameters provided - tool will use the first valid one');
            }
        }
        
        // Cap the score at maxScore to prevent over-scoring
        evaluation.score = Math.min(evaluation.score, evaluation.maxScore);
        
        return evaluation;
    }

    async setup(context) {
        console.log('Setting up Manual test suite');
    }

    async cleanup(context) {
        console.log('Cleaning up Manual test suite');
    }
}

// Make the class available globally
window.ManualSuite = ManualSuite;