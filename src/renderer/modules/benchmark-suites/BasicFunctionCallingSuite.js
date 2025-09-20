/**
 * Basic Function Calling Test Suite - Tests fundamental LLM function calling capabilities
 */
class BasicFunctionCallingSuite {
    constructor() {
        this.suiteName = 'Basic Function Calling';
        this.suiteId = 'basic_functions';
        this.description = 'Tests basic LLM function calling capabilities with simple instructions';
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
     * Initialize all test cases for basic function calling
     */
    initializeTests() {
        return [
            // Gene Search Tests
            {
                id: 'basic_gene_search_01',
                name: 'Simple Gene Search by Name',
                type: 'function_call',
                instruction: 'Search for the gene "lacZ" in the current genome.',
                expectedResult: {
                    tool_name: 'search_gene_by_name',
                    parameters: {
                        name: 'lacZ'
                    }
                },
                maxScore: 100,
                timeout: 15000,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },
            {
                id: 'basic_gene_search_02',
                name: 'Gene Search with Product Description',
                type: 'function_call',
                instruction: 'Find genes related to "DNA polymerase" in the genome.',
                expectedResult: {
                    tool_name: 'search_features',
                    parameters: {
                        query: 'DNA polymerase',
                        caseSensitive: false
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateSearchFunctionCall.bind(this)
            },
            {
                id: 'basic_gene_search_03',
                name: 'Locus Tag Search',
                type: 'function_call',
                instruction: 'Search for the gene with locus tag "b0344".',
                expectedResult: {
                    tool_name: 'search_gene_by_name',
                    parameters: {
                        name: 'b0344'
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },

            // Navigation Tests
            {
                id: 'basic_navigation_01',
                name: 'Navigate to Specific Position',
                type: 'function_call',
                instruction: 'Navigate to position 100000 to 110000 on chromosome COLI-K12.',
                expectedResult: {
                    tool_name: 'navigate_to_position',
                    parameters: {
                        chromosome: 'COLI-K12',
                        start: 100000,
                        end: 110000
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateNavigationCall.bind(this)
            },
            {
                id: 'basic_navigation_02',
                name: 'Jump to Gene Location',
                type: 'function_call',
                instruction: 'Jump to the location of gene thrC.',
                expectedResult: {
                    tool_name: 'jump_to_gene',
                    parameters: {
                        geneName: 'thrC'
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },

            // Sequence Analysis Tests
            {
                id: 'basic_sequence_01',
                name: 'Get DNA Sequence',
                type: 'function_call',
                instruction: 'Get the DNA sequence from position 1000 to 2000 on chromosome COLI-K12.',
                expectedResult: {
                    tool_name: 'get_sequence',
                    parameters: {
                        chromosome: 'COLI-K12',
                        start: 1000,
                        end: 2000
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateSequenceCall.bind(this)
            },
            {
                id: 'basic_sequence_02',
                name: 'Get Coding Sequence',
                type: 'function_call',
                instruction: 'Get the coding sequence for gene lacZ.',
                expectedResult: {
                    tool_name: 'get_coding_sequence',
                    parameters: {
                        identifier: 'lacZ'
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },
            {
                id: 'basic_sequence_03',
                name: 'Translate DNA Sequence',
                type: 'function_call',
                instruction: 'Translate the DNA sequence "ATGCGATCGTAGC" to protein.',
                expectedResult: {
                    tool_name: 'translate_dna',
                    parameters: {
                        sequence: 'ATGCGATCGTAGC'
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },

            // Analysis Tests
            {
                id: 'basic_analysis_01',
                name: 'Calculate GC Content',
                type: 'function_call',
                instruction: 'Calculate the GC content of the sequence "ATGCGCATGCGC".',
                expectedResult: {
                    tool_name: 'compute_gc',
                    parameters: {
                        sequence: 'ATGCGCATGCGC'
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },
            {
                id: 'basic_analysis_02',
                name: 'Find ORFs',
                type: 'function_call',
                instruction: 'Find open reading frames in the sequence "ATGAAATTTAAATAG".',
                expectedResult: {
                    tool_name: 'find_orfs',
                    parameters: {
                        sequence: 'ATGAAATTTAAATAG'
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },
            {
                id: 'basic_analysis_03',
                name: 'Reverse Complement',
                type: 'function_call',
                instruction: 'Get the reverse complement of sequence "ATGCGC".',
                expectedResult: {
                    tool_name: 'reverse_complement',
                    parameters: {
                        sequence: 'ATGCGC'
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },

            // BLAST Search Tests
            {
                id: 'basic_blast_01',
                name: 'Basic BLAST Search',
                type: 'function_call',
                instruction: 'Perform a BLAST search with the sequence "ATGCGCATGCGCATGC".',
                expectedResult: {
                    tool_name: 'blast_search',
                    parameters: {
                        sequence: 'ATGCGCATGCGCATGC'
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBlastCall.bind(this)
            },

            // Protein Structure Tests
            {
                id: 'basic_protein_01',
                name: 'Search PDB Protein Structure',
                type: 'function_call',
                instruction: 'Search for PDB protein structure for gene lysC.',
                expectedResult: {
                    tool_name: 'search_protein_by_gene',
                    parameters: {
                        geneName: 'lysC'
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },
            {
                id: 'basic_protein_02',
                name: 'Search AlphaFold Structure',
                type: 'function_call',
                instruction: 'Find AlphaFold structure prediction for gene recA.',
                expectedResult: {
                    tool_name: 'search_alphafold_by_gene',
                    parameters: {
                        geneName: 'recA'
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },

            // Zoom and View Control Tests
            {
                id: 'basic_view_01',
                name: 'Zoom In',
                type: 'function_call',
                instruction: 'Zoom in by a factor of 2.',
                expectedResult: {
                    tool_name: 'zoom_in',
                    parameters: {
                        factor: 2
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateViewCall.bind(this)
            },
            {
                id: 'basic_view_02',
                name: 'Zoom Out',
                type: 'function_call',
                instruction: 'Zoom out by a factor of 3.',
                expectedResult: {
                    tool_name: 'zoom_out',
                    parameters: {
                        factor: 3
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateViewCall.bind(this)
            },

            // Track Control Tests
            {
                id: 'basic_track_01',
                name: 'Toggle Track Visibility',
                type: 'function_call',
                instruction: 'Hide the genes track.',
                expectedResult: {
                    tool_name: 'toggle_track',
                    parameters: {
                        trackName: 'genes',
                        visible: false
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateTrackCall.bind(this)
            },

            // Tab Management Tests
            {
                id: 'basic_tab_01',
                name: 'Open New Tab',
                type: 'function_call',
                instruction: 'Open a new tab for parallel analysis.',
                expectedResult: {
                    tool_name: 'open_new_tab',
                    parameters: {}
                },
                maxScore: 100,
                evaluator: this.evaluateBasicFunctionCall.bind(this)
            },

            // Export Tests
            {
                id: 'basic_export_01',
                name: 'Export Sequence Data',
                type: 'function_call',
                instruction: 'Export the current genome data in FASTA format.',
                expectedResult: {
                    tool_name: 'export_data',
                    parameters: {
                        format: 'fasta'
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateExportCall.bind(this)
            },

            // Annotation Tests
            {
                id: 'basic_annotation_01',
                name: 'Create Annotation',
                type: 'function_call',
                instruction: 'Create a gene annotation named "test_gene" from position 5000 to 6000 on the plus strand of chromosome COLI-K12.',
                expectedResult: {
                    tool_name: 'create_annotation',
                    parameters: {
                        type: 'gene',
                        name: 'test_gene',
                        chromosome: 'COLI-K12',
                        start: 5000,
                        end: 6000,
                        strand: 1
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateAnnotationCall.bind(this)
            }
        ];
    }

    /**
     * Basic function call evaluator
     */
    async evaluateBasicFunctionCall(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: 100,
            errors: [],
            warnings: []
        };

        console.log('🔍 DEEP DEBUG - evaluateBasicFunctionCall called with:', {
            actualResult: actualResult,
            expectedResult: expectedResult,
            testResult: testResult
        });

        if (!actualResult) {
            evaluation.errors.push('No function call detected in response');
            console.log('❌ No actualResult provided');
            return evaluation;
        }

        if (actualResult.error) {
            evaluation.errors.push(`Function call error: ${actualResult.error}`);
            console.log('❌ ActualResult contains error:', actualResult.error);
            return evaluation;
        }

        // CRITICAL FIX: Handle inferred function calls with proper confidence validation
        if (actualResult.inferred) {
            console.log('🧠 Processing inferred function call:', actualResult);
            
            // IMPORTANT: Check confidence level - low confidence should result in lower scores
            const confidence = actualResult.confidence || 0;
            const isLowConfidence = confidence < 70;
            
            if (isLowConfidence) {
                console.log(`⚠️ Low confidence inference (${confidence}%), applying penalties`);
                evaluation.warnings.push(`Low confidence inference (${confidence}%)`);
            }
            
            const call = actualResult;
            
            // Check function name (50 points, reduced for low confidence)
            if (call.tool_name === expectedResult.tool_name) {
                const nameScore = isLowConfidence ? 30 : 50; // Reduce score for low confidence
                evaluation.score += nameScore;
                console.log(`✅ Inferred function name matches (${nameScore} points)`);
            } else {
                evaluation.errors.push(`Expected function ${expectedResult.tool_name}, got ${call.tool_name} (inferred)`);
                console.log('❌ Inferred function name mismatch');
            }

            // Check parameters (50 points) - be more strict for low confidence calls
            if (call.parameters && expectedResult.parameters) {
                const paramScore = this.evaluateParameters(call.parameters, expectedResult.parameters);
                const adjustedParamScore = isLowConfidence ? Math.min(paramScore, 20) : Math.max(paramScore, 30);
                evaluation.score += adjustedParamScore;
                
                if (paramScore < 40 || isLowConfidence) {
                    evaluation.warnings.push('Parameters inferred from response context with limited accuracy');
                }
            } else if (!expectedResult.parameters) {
                // No parameters expected
                const noParamScore = isLowConfidence ? 30 : 50;
                evaluation.score += noParamScore;
            } else {
                // Give minimal credit for low confidence inferred calls without params
                const partialScore = isLowConfidence ? 10 : 25;
                evaluation.score += partialScore;
                evaluation.warnings.push('Parameters inferred with limited accuracy');
            }

            // Apply overall confidence penalty
            if (isLowConfidence) {
                evaluation.score = Math.max(0, evaluation.score * 0.7); // 30% penalty for low confidence
                evaluation.errors.push(`Low confidence inference (${confidence}%) - likely due to LLM error or unclear response`);
            }

            evaluation.success = evaluation.score >= 70;
            console.log('📊 Inferred function call evaluation:', evaluation);
            return evaluation;
        }

        // Check if it's an array of function calls
        const calls = Array.isArray(actualResult) ? actualResult : [actualResult];
        const call = calls[0]; // Take the first call for basic tests

        if (!call || !call.tool_name) {
            evaluation.errors.push('Invalid function call format');
            return evaluation;
        }

        // Check function name (50 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 50;
        } else {
            evaluation.errors.push(`Expected function ${expectedResult.tool_name}, got ${call.tool_name}`);
        }

        // Check parameters (50 points)
        if (call.parameters && expectedResult.parameters) {
            const paramScore = this.evaluateParameters(call.parameters, expectedResult.parameters);
            evaluation.score += paramScore;
            
            if (paramScore < 40) {
                evaluation.warnings.push('Parameters partially match expected values');
            }
        } else if (!expectedResult.parameters) {
            // No parameters expected
            evaluation.score += 50;
        } else {
            evaluation.errors.push('Missing required parameters');
        }

        evaluation.success = evaluation.score >= 70;
        return evaluation;
    }

    /**
     * Search function call evaluator (more flexible for search queries)
     */
    async evaluateSearchFunctionCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // For search functions, be more flexible with query parameters
        if (evaluation.score < 70 && actualResult && actualResult.tool_name) {
            const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
            
            // Check if it's a valid search function
            const validSearchFunctions = ['search_features', 'search_gene_by_name', 'search_by_position'];
            if (validSearchFunctions.includes(call.tool_name)) {
                evaluation.score = Math.max(evaluation.score, 60);
                evaluation.warnings.push('Alternative search function used');
            }
        }
        
        return evaluation;
    }

    /**
     * Navigation function call evaluator
     */
    async evaluateNavigationCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // For navigation, allow some flexibility in coordinates
        if (actualResult && actualResult.parameters) {
            const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
            if (call.tool_name === expectedResult.tool_name) {
                const actualParams = call.parameters;
                const expectedParams = expectedResult.parameters;
                
                // Check chromosome
                if (actualParams.chromosome === expectedParams.chromosome) {
                    // Allow ±10% variation in coordinates
                    const startDiff = Math.abs(actualParams.start - expectedParams.start) / expectedParams.start;
                    const endDiff = Math.abs(actualParams.end - expectedParams.end) / expectedParams.end;
                    
                    if (startDiff <= 0.1 && endDiff <= 0.1) {
                        evaluation.score = Math.max(evaluation.score, 85);
                        evaluation.success = true;
                    }
                }
            }
        }
        
        return evaluation;
    }

    /**
     * Sequence function call evaluator
     */
    async evaluateSequenceCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // For sequence functions, check that coordinates are reasonable
        if (actualResult && actualResult.parameters) {
            const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
            if (call.parameters.start && call.parameters.end) {
                if (call.parameters.start < call.parameters.end) {
                    evaluation.score += 5; // Bonus for correct coordinate order
                } else {
                    evaluation.warnings.push('Start coordinate should be less than end coordinate');
                }
            }
        }
        
        return evaluation;
    }

    /**
     * BLAST function call evaluator
     */
    async evaluateBlastCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // For BLAST, check sequence format
        if (actualResult && actualResult.parameters && actualResult.parameters.sequence) {
            const sequence = actualResult.parameters.sequence.toUpperCase();
            const validChars = /^[ATCGN]+$/;
            
            if (validChars.test(sequence)) {
                evaluation.score += 5; // Bonus for valid DNA sequence
            } else {
                evaluation.warnings.push('Sequence contains invalid characters');
            }
        }
        
        return evaluation;
    }

    /**
     * View control function call evaluator
     */
    async evaluateViewCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // For zoom functions, check factor is reasonable
        if (actualResult && actualResult.parameters && actualResult.parameters.factor) {
            const factor = actualResult.parameters.factor;
            if (factor > 0 && factor <= 10) {
                evaluation.score += 5; // Bonus for reasonable zoom factor
            } else {
                evaluation.warnings.push('Zoom factor should be between 0 and 10');
            }
        }
        
        return evaluation;
    }

    /**
     * Track control function call evaluator
     */
    async evaluateTrackCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // For track functions, check track name is valid
        if (actualResult && actualResult.parameters && actualResult.parameters.trackName) {
            const validTracks = ['genes', 'features', 'annotations', 'reads', 'coverage'];
            if (validTracks.includes(actualResult.parameters.trackName)) {
                evaluation.score += 5; // Bonus for valid track name
            }
        }
        
        return evaluation;
    }

    /**
     * Export function call evaluator
     */
    async evaluateExportCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // For export functions, check format is valid
        if (actualResult && actualResult.parameters && actualResult.parameters.format) {
            const validFormats = ['fasta', 'genbank', 'gff', 'csv', 'json'];
            if (validFormats.includes(actualResult.parameters.format.toLowerCase())) {
                evaluation.score += 5; // Bonus for valid format
            }
        }
        
        return evaluation;
    }

    /**
     * Annotation function call evaluator
     */
    async evaluateAnnotationCall(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateBasicFunctionCall(actualResult, expectedResult, testResult);
        
        // For annotation functions, check required fields
        if (actualResult && actualResult.parameters) {
            const params = actualResult.parameters;
            const requiredFields = ['type', 'name', 'chromosome', 'start', 'end'];
            const missingFields = requiredFields.filter(field => !params[field]);
            
            if (missingFields.length === 0) {
                evaluation.score += 10; // Bonus for all required fields
            } else {
                evaluation.warnings.push(`Missing fields: ${missingFields.join(', ')}`);
            }
            
            // Check strand value
            if (params.strand && (params.strand === 1 || params.strand === -1 || params.strand === '+' || params.strand === '-')) {
                evaluation.score += 5; // Bonus for valid strand
            }
        }
        
        return evaluation;
    }

    /**
     * Evaluate function parameters
     */
    evaluateParameters(actualParams, expectedParams) {
        let score = 0;
        const totalParams = Object.keys(expectedParams).length;
        
        if (totalParams === 0) return 50; // No parameters expected
        
        let matchingParams = 0;
        
        for (const [key, expectedValue] of Object.entries(expectedParams)) {
            if (actualParams.hasOwnProperty(key)) {
                const actualValue = actualParams[key];
                
                if (this.compareParameterValues(actualValue, expectedValue)) {
                    matchingParams++;
                } else {
                    // Partial credit for having the parameter but wrong value
                    matchingParams += 0.5;
                }
            }
        }
        
        score = (matchingParams / totalParams) * 50;
        return Math.round(score);
    }

    /**
     * Compare parameter values with some flexibility
     */
    compareParameterValues(actual, expected) {
        // Exact match
        if (actual === expected) return true;
        
        // String comparison (case insensitive)
        if (typeof actual === 'string' && typeof expected === 'string') {
            return actual.toLowerCase() === expected.toLowerCase();
        }
        
        // Number comparison (allow small differences for coordinates)
        if (typeof actual === 'number' && typeof expected === 'number') {
            const diff = Math.abs(actual - expected);
            const tolerance = Math.max(1, expected * 0.01); // 1% tolerance or minimum 1
            return diff <= tolerance;
        }
        
        // Boolean comparison
        if (typeof actual === 'boolean' && typeof expected === 'boolean') {
            return actual === expected;
        }
        
        return false;
    }

    /**
     * Setup method called before running tests
     */
    async setup(context) {
        console.log('Setting up Basic Function Calling test suite');
        // Any suite-specific setup can be done here
    }

    /**
     * Cleanup method called after running tests
     */
    async cleanup(context) {
        console.log('Cleaning up Basic Function Calling test suite');
        // Any suite-specific cleanup can be done here
    }
}

// Make available globally
window.BasicFunctionCallingSuite = BasicFunctionCallingSuite;
