/**
 * Basic Operations Test Suite - Tests fundamental Edit operations (Copy, Paste, Select All, etc.)
 */
class BasicOperationsSuite {
    constructor() {
        this.suiteName = 'Basic Operations';
        this.suiteId = 'basic_operations';
        this.description = 'Tests basic Edit menu operations like Copy, Paste, Select All, Undo, Redo';
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
     * Initialize all test cases for basic operations
     */
    initializeTests() {
        return [
            // Copy Operations
            {
                id: 'basic_copy_01',
                name: 'Copy DNA Sequence',
                type: 'function_call',
                instruction: 'Copy the DNA sequence from position 1000 to 2000 on chromosome COLI-K12 to clipboard.',
                expectedResult: {
                    tool_name: 'copy_sequence',
                    parameters: {
                        chromosome: 'COLI-K12',
                        start: 1000,
                        end: 2000
                    }
                },
                maxScore: 100,
                timeout: 15000,
                evaluator: this.evaluateBasicOperation.bind(this)
            },
            {
                id: 'basic_copy_02',
                name: 'Copy Gene Sequence',
                type: 'function_call',
                instruction: 'Copy the sequence of gene lacZ to clipboard.',
                expectedResult: {
                    tool_name: 'copy_sequence',
                    parameters: {
                        geneName: 'lacZ'
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBasicOperation.bind(this)
            },
            {
                id: 'basic_copy_03',
                name: 'Copy with Strand Specification',
                type: 'function_call',
                instruction: 'Copy the sequence from position 5000 to 6000 on the reverse strand of chromosome COLI-K12.',
                expectedResult: {
                    tool_name: 'copy_sequence',
                    parameters: {
                        chromosome: 'COLI-K12',
                        start: 5000,
                        end: 6000,
                        strand: '-'
                    }
                },
                maxScore: 120,
                evaluator: this.evaluateStrandOperation.bind(this)
            },

            // Cut Operations
            {
                id: 'basic_cut_01',
                name: 'Cut DNA Sequence',
                type: 'function_call',
                instruction: 'Cut the DNA sequence from position 3000 to 3500 on chromosome COLI-K12.',
                expectedResult: {
                    tool_name: 'cut_sequence',
                    parameters: {
                        chromosome: 'COLI-K12',
                        start: 3000,
                        end: 3500
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBasicOperation.bind(this)
            },
            {
                id: 'basic_cut_02',
                name: 'Cut Gene Sequence',
                type: 'function_call',
                instruction: 'Cut the sequence of gene yaaJ and copy it to clipboard.',
                expectedResult: {
                    tool_name: 'cut_sequence',
                    parameters: {
                        geneName: 'yaaJ'
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBasicOperation.bind(this)
            },

            // Paste Operations
            {
                id: 'basic_paste_01',
                name: 'Paste Sequence at Position',
                type: 'function_call',
                instruction: 'Paste the clipboard content at position 10000 on chromosome COLI-K12.',
                expectedResult: {
                    tool_name: 'paste_sequence',
                    parameters: {
                        chromosome: 'COLI-K12',
                        position: 10000
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBasicOperation.bind(this)
            },
            {
                id: 'basic_paste_02',
                name: 'Paste After Gene',
                type: 'function_call',
                instruction: 'Paste the clipboard content after gene thrA.',
                expectedResult: {
                    tool_name: 'paste_sequence',
                    parameters: {
                        afterGene: 'thrA'
                    }
                },
                maxScore: 110,
                evaluator: this.evaluateBasicOperation.bind(this)
            },

            // Select All Operations
            {
                id: 'basic_select_01',
                name: 'Select All in Region',
                type: 'function_call',
                instruction: 'Select all features in the region from 50000 to 100000.',
                expectedResult: {
                    tool_name: 'select_region',
                    parameters: {
                        chromosome: 'COLI-K12',
                        start: 50000,
                        end: 100000
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBasicOperation.bind(this)
            },
            {
                id: 'basic_select_02',
                name: 'Select All Genes of Type',
                type: 'function_call',
                instruction: 'Select all ribosomal protein genes.',
                expectedResult: {
                    tool_name: 'select_features',
                    parameters: {
                        featureType: 'gene',
                        query: 'ribosomal protein'
                    }
                },
                maxScore: 110,
                evaluator: this.evaluateBasicOperation.bind(this)
            },

            // Undo/Redo Operations
            {
                id: 'basic_undo_01',
                name: 'Undo Last Action',
                type: 'function_call',
                instruction: 'Undo the last editing action.',
                expectedResult: {
                    tool_name: 'undo_action',
                    parameters: {}
                },
                maxScore: 80,
                evaluator: this.evaluateBasicOperation.bind(this)
            },
            {
                id: 'basic_redo_01',
                name: 'Redo Last Undone Action',
                type: 'function_call',
                instruction: 'Redo the last undone action.',
                expectedResult: {
                    tool_name: 'redo_action',
                    parameters: {}
                },
                maxScore: 80,
                evaluator: this.evaluateBasicOperation.bind(this)
            },

            // Find and Replace Operations
            {
                id: 'basic_find_01',
                name: 'Find Sequence Pattern',
                type: 'function_call',
                instruction: 'Find all occurrences of the sequence pattern "ATGCGC" in the current genome.',
                expectedResult: {
                    tool_name: 'search_sequence_motif',
                    parameters: {
                        pattern: 'ATGCGC',
                        chromosome: 'COLI-K12'
                    }
                },
                maxScore: 120,
                evaluator: this.evaluateFindOperation.bind(this)
            },
            {
                id: 'basic_find_02',
                name: 'Find and Highlight Features',
                type: 'function_call',
                instruction: 'Find and highlight all genes containing "DNA" in their name or description.',
                expectedResult: {
                    tool_name: 'search_features',
                    parameters: {
                        query: 'DNA',
                        caseSensitive: false
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBasicOperation.bind(this)
            },

            // Replace Operations
            {
                id: 'basic_replace_01',
                name: 'Replace Sequence Region',
                type: 'function_call',
                instruction: 'Replace the sequence from position 1500 to 1600 with "ATGCGCATGCGC".',
                expectedResult: {
                    tool_name: 'replace_sequence',
                    parameters: {
                        chromosome: 'COLI-K12',
                        start: 1500,
                        end: 1600,
                        sequence: 'ATGCGCATGCGC'
                    }
                },
                maxScore: 130,
                evaluator: this.evaluateReplaceOperation.bind(this)
            },

            // Selection Operations
            {
                id: 'basic_selection_01',
                name: 'Clear Current Selection',
                type: 'function_call',
                instruction: 'Clear the current sequence selection.',
                expectedResult: {
                    tool_name: 'clear_selection',
                    parameters: {}
                },
                maxScore: 80,
                evaluator: this.evaluateBasicOperation.bind(this)
            },
            {
                id: 'basic_selection_02',
                name: 'Select Gene by Name',
                type: 'function_call',
                instruction: 'Select gene lacZ and highlight it in the viewer.',
                expectedResult: {
                    tool_name: 'select_gene',
                    parameters: {
                        geneName: 'lacZ'
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBasicOperation.bind(this)
            },

            // Clipboard Operations with Context
            {
                id: 'basic_clipboard_01',
                name: 'Copy Current Selection',
                type: 'function_call',
                instruction: 'Copy whatever is currently selected to clipboard.',
                expectedResult: {
                    tool_name: 'copy_selection',
                    parameters: {}
                },
                maxScore: 90,
                evaluator: this.evaluateBasicOperation.bind(this)
            },
            {
                id: 'basic_clipboard_02',
                name: 'Copy with Format',
                type: 'function_call',
                instruction: 'Copy the sequence of gene thrA in FASTA format.',
                expectedResult: {
                    tool_name: 'copy_sequence',
                    parameters: {
                        geneName: 'thrA',
                        format: 'fasta'
                    }
                },
                maxScore: 120,
                evaluator: this.evaluateFormatOperation.bind(this)
            },

            // Multi-step Copy-Paste Workflow
            {
                id: 'basic_workflow_01',
                name: 'Copy-Paste Workflow',
                type: 'workflow',
                instruction: 'Copy the sequence from position 2000 to 3000, then paste it at position 8000.',
                expectedResult: {
                    expectedSteps: 2,
                    expectedFunctionCalls: 2,
                    requiredFunctions: ['copy_sequence', 'paste_sequence']
                },
                maxScore: 150,
                timeout: 30000,
                evaluator: this.evaluateCopyPasteWorkflow.bind(this)
            },
            {
                id: 'basic_workflow_02',
                name: 'Cut-Paste Workflow',
                type: 'workflow',
                instruction: 'Cut the sequence from position 4000 to 4500 and paste it at position 9000.',
                expectedResult: {
                    expectedSteps: 2,
                    expectedFunctionCalls: 2,
                    requiredFunctions: ['cut_sequence', 'paste_sequence']
                },
                maxScore: 150,
                timeout: 30000,
                evaluator: this.evaluateCutPasteWorkflow.bind(this)
            },

            // Advanced Edit Operations
            {
                id: 'basic_advanced_01',
                name: 'Duplicate Sequence',
                type: 'workflow',
                instruction: 'Duplicate gene lacZ by copying it and pasting it at the end of the genome.',
                expectedResult: {
                    expectedSteps: 3,
                    expectedFunctionCalls: 3,
                    requiredFunctions: ['search_gene_by_name', 'copy_sequence', 'paste_sequence']
                },
                maxScore: 180,
                timeout: 40000,
                evaluator: this.evaluateDuplicationWorkflow.bind(this)
            },
            {
                id: 'basic_advanced_02',
                name: 'Move Sequence Region',
                type: 'workflow',
                instruction: 'Move the sequence from position 1000-1500 to position 5000 (cut from original location and paste at new location).',
                expectedResult: {
                    expectedSteps: 2,
                    expectedFunctionCalls: 2,
                    requiredFunctions: ['cut_sequence', 'paste_sequence']
                },
                maxScore: 160,
                timeout: 35000,
                evaluator: this.evaluateMoveWorkflow.bind(this)
            }
        ];
    }

    /**
     * Basic operation evaluator
     */
    async evaluateBasicOperation(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 100,
            errors: [],
            warnings: []
        };

        if (!actualResult) {
            evaluation.errors.push('No operation detected in response');
            return evaluation;
        }

        if (actualResult.error) {
            evaluation.errors.push(`Operation error: ${actualResult.error}`);
            return evaluation;
        }

        // Handle both direct function calls and extracted function calls
        const calls = actualResult.functionCalls || (Array.isArray(actualResult) ? actualResult : [actualResult]);
        const call = calls[0];

        if (!call || !call.tool_name) {
            evaluation.errors.push('Invalid operation format');
            return evaluation;
        }

        // Check function name (60 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 60;
        } else {
            // Check for alternative valid operations
            const alternativeOps = this.getAlternativeOperations(expectedResult.tool_name);
            if (alternativeOps.includes(call.tool_name)) {
                evaluation.score += 40;
                evaluation.warnings.push(`Alternative operation used: ${call.tool_name} instead of ${expectedResult.tool_name}`);
            } else {
                evaluation.errors.push(`Expected operation ${expectedResult.tool_name}, got ${call.tool_name}`);
            }
        }

        // Check parameters (40 points)
        if (call.parameters && expectedResult.parameters) {
            const paramScore = this.evaluateOperationParameters(call.parameters, expectedResult.parameters);
            evaluation.score += (paramScore / 100) * 40;
        } else if (!expectedResult.parameters || Object.keys(expectedResult.parameters).length === 0) {
            evaluation.score += 40; // No parameters expected
        } else {
            evaluation.errors.push('Missing required operation parameters');
        }

        evaluation.success = evaluation.score >= 70;
        return evaluation;
    }

    /**
     * Strand operation evaluator
     */
    async evaluateStrandOperation(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicOperation(actualResult, expectedResult, testResult);
        
        // Additional validation for strand operations
        if (actualResult && actualResult.parameters) {
            const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
            if (call.parameters && call.parameters.strand) {
                const strand = call.parameters.strand;
                if (strand === '-' || strand === -1 || strand === 'reverse') {
                    evaluation.score += 5; // Bonus for correct strand specification
                } else if (strand === '+' || strand === 1 || strand === 'forward') {
                    evaluation.warnings.push('Specified forward strand instead of reverse');
                }
            }
        }

        return evaluation;
    }

    /**
     * Find operation evaluator
     */
    async evaluateFindOperation(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicOperation(actualResult, expectedResult, testResult);
        
        // Additional validation for find operations
        if (actualResult && actualResult.parameters) {
            const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
            if (call.parameters && call.parameters.pattern) {
                const pattern = call.parameters.pattern.toUpperCase();
                if (/^[ATCGN]+$/.test(pattern)) {
                    evaluation.score += 10; // Bonus for valid DNA pattern
                } else {
                    evaluation.warnings.push('Pattern contains non-DNA characters');
                }
            }
        }

        return evaluation;
    }

    /**
     * Replace operation evaluator
     */
    async evaluateReplaceOperation(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicOperation(actualResult, expectedResult, testResult);
        
        // Additional validation for replace operations
        if (actualResult && actualResult.parameters) {
            const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
            if (call.parameters) {
                // Check sequence format
                if (call.parameters.sequence) {
                    const sequence = call.parameters.sequence.toUpperCase();
                    if (/^[ATCGN]+$/.test(sequence)) {
                        evaluation.score += 10; // Bonus for valid replacement sequence
                    } else {
                        evaluation.warnings.push('Replacement sequence contains invalid characters');
                    }
                }
                
                // Check coordinate order
                if (call.parameters.start && call.parameters.end) {
                    if (call.parameters.start < call.parameters.end) {
                        evaluation.score += 5; // Bonus for correct coordinate order
                    } else {
                        evaluation.errors.push('Start coordinate should be less than end coordinate');
                    }
                }
            }
        }

        return evaluation;
    }

    /**
     * Format operation evaluator
     */
    async evaluateFormatOperation(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicOperation(actualResult, expectedResult, testResult);
        
        // Additional validation for format operations
        if (actualResult && actualResult.parameters) {
            const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
            if (call.parameters && call.parameters.format) {
                const validFormats = ['fasta', 'genbank', 'raw', 'formatted'];
                if (validFormats.includes(call.parameters.format.toLowerCase())) {
                    evaluation.score += 10; // Bonus for valid format
                } else {
                    evaluation.warnings.push('Non-standard format specified');
                }
            }
        }

        return evaluation;
    }

    /**
     * Copy-Paste workflow evaluator
     */
    async evaluateCopyPasteWorkflow(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 150,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.functionCalls) {
            evaluation.errors.push('No workflow detected');
            return evaluation;
        }

        const functionCalls = actualResult.functionCalls || [];
        
        // Check for copy operation (50 points)
        const hasCopy = functionCalls.some(call => 
            call.tool_name === 'copy_sequence' || call.tool_name === 'copy_selection'
        );
        if (hasCopy) {
            evaluation.score += 50;
        } else {
            evaluation.errors.push('Copy operation not found in workflow');
        }

        // Check for paste operation (50 points)
        const hasPaste = functionCalls.some(call => 
            call.tool_name === 'paste_sequence' || call.tool_name === 'paste_selection'
        );
        if (hasPaste) {
            evaluation.score += 50;
        } else {
            evaluation.errors.push('Paste operation not found in workflow');
        }

        // Check logical sequence (50 points)
        if (hasCopy && hasPaste) {
            const copyIndex = functionCalls.findIndex(call => 
                call.tool_name === 'copy_sequence' || call.tool_name === 'copy_selection'
            );
            const pasteIndex = functionCalls.findIndex(call => 
                call.tool_name === 'paste_sequence' || call.tool_name === 'paste_selection'
            );
            
            if (copyIndex < pasteIndex) {
                evaluation.score += 50; // Correct order
            } else {
                evaluation.score += 25; // Both operations present but wrong order
                evaluation.warnings.push('Copy should come before paste in workflow');
            }
        }

        evaluation.success = evaluation.score >= (evaluation.maxScore * 0.7);
        return evaluation;
    }

    /**
     * Cut-Paste workflow evaluator
     */
    async evaluateCutPasteWorkflow(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 150,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.functionCalls) {
            evaluation.errors.push('No workflow detected');
            return evaluation;
        }

        const functionCalls = actualResult.functionCalls || [];
        
        // Check for cut operation (75 points)
        const hasCut = functionCalls.some(call => 
            call.tool_name === 'cut_sequence' || call.tool_name === 'cut_selection'
        );
        if (hasCut) {
            evaluation.score += 75;
        } else {
            evaluation.errors.push('Cut operation not found in workflow');
        }

        // Check for paste operation (75 points)
        const hasPaste = functionCalls.some(call => 
            call.tool_name === 'paste_sequence' || call.tool_name === 'paste_selection'
        );
        if (hasPaste) {
            evaluation.score += 75;
        } else {
            evaluation.errors.push('Paste operation not found in workflow');
        }

        evaluation.success = evaluation.score >= (evaluation.maxScore * 0.7);
        return evaluation;
    }

    /**
     * Duplication workflow evaluator
     */
    async evaluateDuplicationWorkflow(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 180,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.functionCalls) {
            evaluation.errors.push('No duplication workflow detected');
            return evaluation;
        }

        const functionCalls = actualResult.functionCalls || [];
        
        // Check for gene search (60 points)
        const hasSearch = functionCalls.some(call => 
            call.tool_name === 'search_gene_by_name' || call.tool_name === 'search_features'
        );
        if (hasSearch) {
            evaluation.score += 60;
        }

        // Check for copy operation (60 points)
        const hasCopy = functionCalls.some(call => 
            call.tool_name === 'copy_sequence' || call.tool_name === 'get_coding_sequence'
        );
        if (hasCopy) {
            evaluation.score += 60;
        }

        // Check for paste operation (60 points)
        const hasPaste = functionCalls.some(call => 
            call.tool_name === 'paste_sequence' || call.tool_name === 'insert_sequence'
        );
        if (hasPaste) {
            evaluation.score += 60;
        }

        evaluation.success = evaluation.score >= (evaluation.maxScore * 0.6);
        return evaluation;
    }

    /**
     * Move workflow evaluator
     */
    async evaluateMoveWorkflow(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 160,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.functionCalls) {
            evaluation.errors.push('No move workflow detected');
            return evaluation;
        }

        const functionCalls = actualResult.functionCalls || [];
        
        // Check for cut operation (80 points)
        const hasCut = functionCalls.some(call => 
            call.tool_name === 'cut_sequence'
        );
        if (hasCut) {
            evaluation.score += 80;
        } else {
            evaluation.errors.push('Cut operation not found - sequence should be removed from original location');
        }

        // Check for paste operation (80 points)
        const hasPaste = functionCalls.some(call => 
            call.tool_name === 'paste_sequence'
        );
        if (hasPaste) {
            evaluation.score += 80;
        } else {
            evaluation.errors.push('Paste operation not found - sequence should be inserted at new location');
        }

        evaluation.success = evaluation.score >= (evaluation.maxScore * 0.7);
        return evaluation;
    }

    // Helper methods

    evaluateOperationParameters(actualParams, expectedParams) {
        let score = 0;
        const totalParams = Object.keys(expectedParams).length;
        
        if (totalParams === 0) return 100;
        
        let matchingParams = 0;
        
        for (const [key, expectedValue] of Object.entries(expectedParams)) {
            if (actualParams.hasOwnProperty(key)) {
                if (this.compareParameterValues(actualParams[key], expectedValue)) {
                    matchingParams++;
                } else {
                    matchingParams += 0.5; // Partial credit
                }
            }
        }
        
        return (matchingParams / totalParams) * 100;
    }

    compareParameterValues(actual, expected) {
        // Exact match
        if (actual === expected) return true;
        
        // String comparison (case insensitive for gene names)
        if (typeof actual === 'string' && typeof expected === 'string') {
            return actual.toLowerCase() === expected.toLowerCase();
        }
        
        // Number comparison (allow small differences for coordinates)
        if (typeof actual === 'number' && typeof expected === 'number') {
            const diff = Math.abs(actual - expected);
            const tolerance = Math.max(1, expected * 0.01);
            return diff <= tolerance;
        }
        
        return false;
    }

    getAlternativeOperations(operation) {
        const alternatives = {
            'copy_sequence': ['copy_selection', 'get_sequence'],
            'cut_sequence': ['cut_selection', 'delete_sequence'],
            'paste_sequence': ['paste_selection', 'insert_sequence'],
            'select_region': ['select_features', 'navigate_to_position'],
            'select_features': ['search_features', 'select_region'],
            'undo_action': ['undo', 'revert'],
            'redo_action': ['redo', 'repeat'],
            'clear_selection': ['deselect', 'clear_highlight'],
            'select_gene': ['search_gene_by_name', 'jump_to_gene']
        };
        
        return alternatives[operation] || [];
    }

    /**
     * Setup method
     */
    async setup(context) {
        console.log('Setting up Basic Operations test suite');
    }

    /**
     * Cleanup method
     */
    async cleanup(context) {
        console.log('Cleaning up Basic Operations test suite');
    }
}

// Make available globally
window.BasicOperationsSuite = BasicOperationsSuite;
