/**
 * Edit Operations Test Suite - Comprehensive tests for Edit menu operations
 */
class EditOperationsSuite {
    constructor() {
        this.suiteName = 'Edit Operations';
        this.suiteId = 'edit_operations';
        this.description = 'Comprehensive tests for Edit menu operations including Copy, Paste, Cut, Select All, Undo, Redo, Find, Replace';
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
     * Initialize comprehensive edit operations test cases
     */
    initializeTests() {
        return [
            // Standard Edit Operations
            {
                id: 'edit_copy_01',
                name: 'Copy - Standard Text Selection',
                type: 'function_call',
                instruction: 'Copy the selected text to clipboard.',
                expectedResult: {
                    tool_name: 'copy_selection',
                    parameters: {}
                },
                maxScore: 80,
                evaluator: this.evaluateEditOperation.bind(this)
            },
            {
                id: 'edit_copy_02',
                name: 'Copy - Specific Sequence Range',
                type: 'function_call',
                instruction: 'Copy the sequence from position 1000 to 2000.',
                expectedResult: {
                    tool_name: 'copy_sequence',
                    parameters: {
                        start: 1000,
                        end: 2000
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateEditOperation.bind(this)
            },
            {
                id: 'edit_cut_01',
                name: 'Cut - Remove and Copy to Clipboard',
                type: 'function_call',
                instruction: 'Cut the selected sequence (remove it and copy to clipboard).',
                expectedResult: {
                    tool_name: 'cut_selection',
                    parameters: {}
                },
                maxScore: 80,
                evaluator: this.evaluateEditOperation.bind(this)
            },
            {
                id: 'edit_paste_01',
                name: 'Paste - Insert from Clipboard',
                type: 'function_call',
                instruction: 'Paste the clipboard content at the current cursor position.',
                expectedResult: {
                    tool_name: 'paste_selection',
                    parameters: {}
                },
                maxScore: 80,
                evaluator: this.evaluateEditOperation.bind(this)
            },
            {
                id: 'edit_paste_02',
                name: 'Paste - Insert at Specific Position',
                type: 'function_call',
                instruction: 'Paste the clipboard content at position 5000.',
                expectedResult: {
                    tool_name: 'paste_sequence',
                    parameters: {
                        position: 5000
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateEditOperation.bind(this)
            },

            // Select Operations
            {
                id: 'edit_select_01',
                name: 'Select All - Entire Sequence',
                type: 'function_call',
                instruction: 'Select all content in the current view.',
                expectedResult: {
                    tool_name: 'select_all',
                    parameters: {}
                },
                maxScore: 80,
                evaluator: this.evaluateEditOperation.bind(this)
            },
            {
                id: 'edit_select_02',
                name: 'Select All - Specific Feature Type',
                type: 'function_call',
                instruction: 'Select all genes in the current view.',
                expectedResult: {
                    tool_name: 'select_features',
                    parameters: {
                        featureType: 'gene'
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateEditOperation.bind(this)
            },
            {
                id: 'edit_select_03',
                name: 'Select Range',
                type: 'function_call',
                instruction: 'Select the sequence range from position 3000 to 4000.',
                expectedResult: {
                    tool_name: 'select_range',
                    parameters: {
                        start: 3000,
                        end: 4000
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateEditOperation.bind(this)
            },

            // Undo/Redo Operations
            {
                id: 'edit_undo_01',
                name: 'Undo - Reverse Last Action',
                type: 'function_call',
                instruction: 'Undo the last editing action.',
                expectedResult: {
                    tool_name: 'undo',
                    parameters: {}
                },
                maxScore: 90,
                evaluator: this.evaluateEditOperation.bind(this)
            },
            {
                id: 'edit_undo_02',
                name: 'Undo - Multiple Steps',
                type: 'function_call',
                instruction: 'Undo the last 3 editing actions.',
                expectedResult: {
                    tool_name: 'undo',
                    parameters: {
                        steps: 3
                    }
                },
                maxScore: 110,
                evaluator: this.evaluateEditOperation.bind(this)
            },
            {
                id: 'edit_redo_01',
                name: 'Redo - Restore Undone Action',
                type: 'function_call',
                instruction: 'Redo the last undone action.',
                expectedResult: {
                    tool_name: 'redo',
                    parameters: {}
                },
                maxScore: 90,
                evaluator: this.evaluateEditOperation.bind(this)
            },

            // Find Operations
            {
                id: 'edit_find_01',
                name: 'Find - Text Search',
                type: 'function_call',
                instruction: 'Find all occurrences of "ribosomal" in gene annotations.',
                expectedResult: {
                    tool_name: 'search_features',
                    parameters: {
                        query: 'ribosomal',
                        caseSensitive: false
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateFindOperation.bind(this)
            },
            {
                id: 'edit_find_02',
                name: 'Find - Sequence Pattern',
                type: 'function_call',
                instruction: 'Find the sequence pattern "ATGCGC" in the genome.',
                expectedResult: {
                    tool_name: 'search_sequence_motif',
                    parameters: {
                        pattern: 'ATGCGC'
                    }
                },
                maxScore: 120,
                evaluator: this.evaluateFindOperation.bind(this)
            },
            {
                id: 'edit_find_03',
                name: 'Find - Case Sensitive Search',
                type: 'function_call',
                instruction: 'Find "DNA" with case-sensitive matching enabled.',
                expectedResult: {
                    tool_name: 'search_features',
                    parameters: {
                        query: 'DNA',
                        caseSensitive: true
                    }
                },
                maxScore: 110,
                evaluator: this.evaluateFindOperation.bind(this)
            },

            // Replace Operations
            {
                id: 'edit_replace_01',
                name: 'Replace - Simple Text Replace',
                type: 'function_call',
                instruction: 'Replace the sequence "ATGCGC" with "GCGCAT".',
                expectedResult: {
                    tool_name: 'replace_sequence_pattern',
                    parameters: {
                        find: 'ATGCGC',
                        replace: 'GCGCAT'
                    }
                },
                maxScore: 130,
                evaluator: this.evaluateReplaceOperation.bind(this)
            },
            {
                id: 'edit_replace_02',
                name: 'Replace - Region Replace',
                type: 'function_call',
                instruction: 'Replace the sequence in region 2000-2100 with "ATGAAATAG".',
                expectedResult: {
                    tool_name: 'replace_sequence',
                    parameters: {
                        start: 2000,
                        end: 2100,
                        sequence: 'ATGAAATAG'
                    }
                },
                maxScore: 130,
                evaluator: this.evaluateReplaceOperation.bind(this)
            },

            // Complex Edit Workflows
            {
                id: 'edit_workflow_01',
                name: 'Copy-Paste Workflow',
                type: 'workflow',
                instruction: 'Copy gene lacZ and paste it at position 100000.',
                expectedResult: {
                    expectedSteps: 3,
                    expectedFunctionCalls: 3,
                    requiredFunctions: ['search_gene_by_name', 'copy_sequence', 'paste_sequence']
                },
                maxScore: 180,
                timeout: 40000,
                evaluator: this.evaluateEditWorkflow.bind(this)
            },
            {
                id: 'edit_workflow_02',
                name: 'Cut-Paste Move Workflow',
                type: 'workflow',
                instruction: 'Move the sequence from position 1000-1500 to position 8000 (cut and paste).',
                expectedResult: {
                    expectedSteps: 2,
                    expectedFunctionCalls: 2,
                    requiredFunctions: ['cut_sequence', 'paste_sequence']
                },
                maxScore: 160,
                timeout: 35000,
                evaluator: this.evaluateEditWorkflow.bind(this)
            },
            {
                id: 'edit_workflow_03',
                name: 'Find-Replace Workflow',
                type: 'workflow',
                instruction: 'Find all occurrences of "ATGCGC" and replace them with "GCGCAT".',
                expectedResult: {
                    expectedSteps: 2,
                    expectedFunctionCalls: 2,
                    requiredFunctions: ['search_sequence_motif', 'replace_sequence_pattern']
                },
                maxScore: 170,
                timeout: 35000,
                evaluator: this.evaluateEditWorkflow.bind(this)
            },
            {
                id: 'edit_workflow_04',
                name: 'Select-Copy-Paste Workflow',
                type: 'workflow',
                instruction: 'Select gene thrA, copy it, and paste it after gene thrB.',
                expectedResult: {
                    expectedSteps: 4,
                    expectedFunctionCalls: 4,
                    requiredFunctions: ['search_gene_by_name', 'select_gene', 'copy_selection', 'paste_sequence']
                },
                maxScore: 200,
                timeout: 45000,
                evaluator: this.evaluateEditWorkflow.bind(this)
            },

            // Advanced Edit Operations
            {
                id: 'edit_advanced_01',
                name: 'Duplicate with Modification',
                type: 'workflow',
                instruction: 'Copy gene lacZ, modify its sequence by replacing ATG with GTG, and insert the modified version.',
                expectedResult: {
                    expectedSteps: 4,
                    expectedFunctionCalls: 4,
                    requiredFunctions: ['copy_sequence', 'replace_sequence_pattern', 'paste_sequence']
                },
                maxScore: 220,
                timeout: 50000,
                evaluator: this.evaluateAdvancedEditWorkflow.bind(this)
            },
            {
                id: 'edit_advanced_02',
                name: 'Multi-Region Selection and Copy',
                type: 'workflow',
                instruction: 'Select multiple genes (lacZ, lacY, lacA) and copy them all to clipboard.',
                expectedResult: {
                    expectedSteps: 4,
                    expectedFunctionCalls: 4,
                    requiredFunctions: ['search_gene_by_name', 'select_features', 'copy_selection']
                },
                maxScore: 200,
                timeout: 45000,
                evaluator: this.evaluateAdvancedEditWorkflow.bind(this)
            },

            // Error Handling in Edit Operations
            {
                id: 'edit_error_01',
                name: 'Copy Empty Selection',
                type: 'text_analysis',
                instruction: 'Copy to clipboard when nothing is selected.',
                expectedResult: {
                    minWords: 10,
                    requiredKeywords: ['nothing selected', 'no selection', 'select first', 'empty'],
                    expectsGracefulHandling: true
                },
                maxScore: 100,
                evaluator: this.evaluateEditErrorHandling.bind(this)
            },
            {
                id: 'edit_error_02',
                name: 'Paste Empty Clipboard',
                type: 'text_analysis',
                instruction: 'Paste from clipboard when clipboard is empty.',
                expectedResult: {
                    minWords: 10,
                    requiredKeywords: ['clipboard empty', 'nothing to paste', 'copy first'],
                    expectsGracefulHandling: true
                },
                maxScore: 100,
                evaluator: this.evaluateEditErrorHandling.bind(this)
            },
            {
                id: 'edit_error_03',
                name: 'Undo When No Actions Available',
                type: 'text_analysis',
                instruction: 'Undo when there are no actions to undo.',
                expectedResult: {
                    minWords: 10,
                    requiredKeywords: ['nothing to undo', 'no actions', 'no history'],
                    expectsGracefulHandling: true
                },
                maxScore: 100,
                evaluator: this.evaluateEditErrorHandling.bind(this)
            }
        ];
    }

    /**
     * Evaluate basic edit operations
     */
    async evaluateEditOperation(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 100,
            errors: [],
            warnings: []
        };

        if (!actualResult) {
            evaluation.errors.push('No edit operation detected');
            return evaluation;
        }

        // Handle both function calls and text responses
        if (actualResult.functionCalls && actualResult.functionCalls.length > 0) {
            const call = actualResult.functionCalls[0];
            
            // Check function name (60 points)
            if (call.tool_name === expectedResult.tool_name) {
                evaluation.score += 60;
            } else {
                // Check for alternative edit operations
                const alternatives = this.getAlternativeEditOperations(expectedResult.tool_name);
                if (alternatives.includes(call.tool_name)) {
                    evaluation.score += 40;
                    evaluation.warnings.push(`Alternative operation: ${call.tool_name}`);
                } else {
                    evaluation.errors.push(`Expected ${expectedResult.tool_name}, got ${call.tool_name}`);
                }
            }

            // Check parameters (40 points)
            if (expectedResult.parameters && Object.keys(expectedResult.parameters).length > 0) {
                const paramScore = this.evaluateEditParameters(call.parameters, expectedResult.parameters);
                evaluation.score += (paramScore / 100) * 40;
            } else {
                evaluation.score += 40; // No parameters expected
            }

        } else if (actualResult.content) {
            // Text response - check for appropriate explanation
            evaluation.score += 30;
            evaluation.warnings.push('Text response instead of function call');
        }

        evaluation.success = evaluation.score >= 60;
        return evaluation;
    }

    /**
     * Evaluate find operations
     */
    async evaluateFindOperation(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateEditOperation(actualResult, expectedResult, testResult);
        
        // Additional validation for find operations
        if (actualResult.functionCalls && actualResult.functionCalls.length > 0) {
            const call = actualResult.functionCalls[0];
            
            if (call.parameters) {
                // Validate search query
                if (call.parameters.query || call.parameters.pattern) {
                    evaluation.score += 10;
                }
                
                // Validate case sensitivity handling
                if (call.parameters.caseSensitive !== undefined) {
                    evaluation.score += 5;
                }
                
                // Validate sequence pattern format
                if (call.parameters.pattern) {
                    const pattern = call.parameters.pattern.toUpperCase();
                    if (/^[ATCGN]+$/.test(pattern)) {
                        evaluation.score += 10;
                    }
                }
            }
        }

        return evaluation;
    }

    /**
     * Evaluate replace operations
     */
    async evaluateReplaceOperation(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateEditOperation(actualResult, expectedResult, testResult);
        
        // Additional validation for replace operations
        if (actualResult.functionCalls && actualResult.functionCalls.length > 0) {
            const call = actualResult.functionCalls[0];
            
            if (call.parameters) {
                // Validate find/replace parameters
                if (call.parameters.find && call.parameters.replace) {
                    evaluation.score += 15;
                }
                
                // Validate sequence parameters
                if (call.parameters.sequence) {
                    const sequence = call.parameters.sequence.toUpperCase();
                    if (/^[ATCGN]+$/.test(sequence)) {
                        evaluation.score += 10;
                    }
                }
                
                // Validate coordinate parameters
                if (call.parameters.start && call.parameters.end) {
                    if (call.parameters.start < call.parameters.end) {
                        evaluation.score += 10;
                    }
                }
            }
        }

        return evaluation;
    }

    /**
     * Evaluate edit workflows
     */
    async evaluateEditWorkflow(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 180,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.functionCalls) {
            evaluation.errors.push('No edit workflow detected');
            return evaluation;
        }

        const functionCalls = actualResult.functionCalls || [];
        
        // Check required functions (70% of score)
        const requiredScore = this.evaluateRequiredFunctions(functionCalls, expectedResult.requiredFunctions);
        evaluation.score += (requiredScore / 100) * (evaluation.maxScore * 0.7);

        // Check workflow logic (30% of score)
        const logicScore = this.evaluateWorkflowLogic(functionCalls, expectedResult);
        evaluation.score += (logicScore / 100) * (evaluation.maxScore * 0.3);

        evaluation.success = evaluation.score >= (evaluation.maxScore * 0.6);
        return evaluation;
    }

    /**
     * Evaluate advanced edit workflows
     */
    async evaluateAdvancedEditWorkflow(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateEditWorkflow(actualResult, expectedResult, testResult);
        
        // Additional scoring for advanced operations
        if (actualResult.functionCalls) {
            const hasModification = actualResult.functionCalls.some(call => 
                call.tool_name.includes('replace') || call.tool_name.includes('modify')
            );
            
            if (hasModification) {
                evaluation.score += 20; // Bonus for modification operations
            }
        }

        return evaluation;
    }

    /**
     * Evaluate edit error handling
     */
    async evaluateEditErrorHandling(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 100,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.content) {
            evaluation.errors.push('No error handling response');
            return evaluation;
        }

        // Check for appropriate error handling
        const content = actualResult.content.toLowerCase();
        
        // Check word count (30 points)
        const wordCount = actualResult.content.split(/\s+/).length;
        if (wordCount >= expectedResult.minWords) {
            evaluation.score += 30;
        }

        // Check for required keywords (50 points)
        const foundKeywords = expectedResult.requiredKeywords.filter(keyword =>
            content.includes(keyword.toLowerCase())
        );
        evaluation.score += (foundKeywords.length / expectedResult.requiredKeywords.length) * 50;

        // Check for helpful suggestions (20 points)
        if (this.hasHelpfulSuggestions(content)) {
            evaluation.score += 20;
        }

        evaluation.success = evaluation.score >= 70;
        return evaluation;
    }

    // Helper methods

    evaluateEditParameters(actualParams, expectedParams) {
        if (!expectedParams || Object.keys(expectedParams).length === 0) {
            return 100;
        }

        let matchingParams = 0;
        const totalParams = Object.keys(expectedParams).length;

        for (const [key, expectedValue] of Object.entries(expectedParams)) {
            if (actualParams && actualParams[key] !== undefined) {
                if (this.compareEditParameterValues(actualParams[key], expectedValue)) {
                    matchingParams++;
                } else {
                    matchingParams += 0.5;
                }
            }
        }

        return (matchingParams / totalParams) * 100;
    }

    compareEditParameterValues(actual, expected) {
        if (actual === expected) return true;
        
        if (typeof actual === 'string' && typeof expected === 'string') {
            return actual.toLowerCase() === expected.toLowerCase();
        }
        
        if (typeof actual === 'number' && typeof expected === 'number') {
            return Math.abs(actual - expected) <= Math.max(1, expected * 0.05);
        }
        
        return false;
    }

    getAlternativeEditOperations(operation) {
        const alternatives = {
            'copy_selection': ['copy_sequence', 'get_sequence'],
            'cut_selection': ['cut_sequence', 'delete_sequence'],
            'paste_selection': ['paste_sequence', 'insert_sequence'],
            'select_all': ['select_features', 'select_range'],
            'select_features': ['search_features', 'select_all'],
            'select_range': ['select_region', 'navigate_to_position'],
            'undo': ['undo_action', 'revert'],
            'redo': ['redo_action', 'repeat'],
            'search_features': ['find_features', 'search_annotations'],
            'search_sequence_motif': ['find_motif', 'find_pattern'],
            'replace_sequence_pattern': ['replace_motif', 'substitute_sequence'],
            'replace_sequence': ['modify_sequence', 'update_sequence']
        };
        
        return alternatives[operation] || [];
    }

    evaluateRequiredFunctions(functionCalls, requiredFunctions) {
        if (!requiredFunctions) return 100;
        
        const calledFunctions = functionCalls.map(call => call.tool_name);
        const foundFunctions = requiredFunctions.filter(func => calledFunctions.includes(func));
        
        return (foundFunctions.length / requiredFunctions.length) * 100;
    }

    evaluateWorkflowLogic(functionCalls, expectedResult) {
        let logicScore = 0;
        
        // Check for logical sequence of operations
        if (expectedResult.requiredFunctions.includes('copy_sequence') && 
            expectedResult.requiredFunctions.includes('paste_sequence')) {
            
            const copyIndex = functionCalls.findIndex(call => 
                call.tool_name === 'copy_sequence' || call.tool_name === 'copy_selection'
            );
            const pasteIndex = functionCalls.findIndex(call => 
                call.tool_name === 'paste_sequence' || call.tool_name === 'paste_selection'
            );
            
            if (copyIndex !== -1 && pasteIndex !== -1 && copyIndex < pasteIndex) {
                logicScore += 50; // Correct order
            }
        }
        
        // Check for search before selection/copy
        if (expectedResult.requiredFunctions.includes('search_gene_by_name')) {
            const searchIndex = functionCalls.findIndex(call => 
                call.tool_name === 'search_gene_by_name'
            );
            const operationIndex = functionCalls.findIndex(call => 
                call.tool_name.includes('copy') || call.tool_name.includes('select')
            );
            
            if (searchIndex !== -1 && operationIndex !== -1 && searchIndex < operationIndex) {
                logicScore += 50; // Correct order
            }
        }
        
        return logicScore;
    }

    hasHelpfulSuggestions(content) {
        const suggestionKeywords = [
            'try', 'instead', 'first', 'before', 'after', 'suggest', 'recommend',
            'alternative', 'option', 'could', 'might', 'consider'
        ];
        
        return suggestionKeywords.some(keyword => content.includes(keyword));
    }

    /**
     * Setup method
     */
    async setup(context) {
        console.log('Setting up Edit Operations test suite');
    }

    /**
     * Cleanup method
     */
    async cleanup(context) {
        console.log('Cleaning up Edit Operations test suite');
    }
}

// Make available globally
window.EditOperationsSuite = EditOperationsSuite;
