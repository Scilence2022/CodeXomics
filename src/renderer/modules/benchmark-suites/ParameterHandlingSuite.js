/**
 * Parameter Handling Test Suite - Tests LLM parameter parsing and validation
 */
class ParameterHandlingSuite {
    constructor() {
        this.suiteName = 'Parameter Handling';
        this.suiteId = 'parameter_handling';
        this.description = 'Tests LLM ability to correctly parse and handle function parameters';
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

    initializeTests() {
        return [
            // Basic Parameter Types
            {
                id: 'param_basic_01',
                name: 'String Parameter Handling',
                type: 'function_call',
                instruction: 'Search for gene "lacZ" (note the quotes around the gene name).',
                expectedResult: {
                    tool_name: 'search_gene_by_name',
                    parameters: {
                        name: 'lacZ'
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateStringParameter.bind(this)
            },
            {
                id: 'param_basic_02',
                name: 'Numeric Parameter Handling',
                type: 'function_call',
                instruction: 'Navigate to position 100000 on chromosome COLI-K12.',
                expectedResult: {
                    tool_name: 'navigate_to_position',
                    parameters: {
                        chromosome: 'COLI-K12',
                        start: 100000,
                        end: 100000
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateNumericParameter.bind(this)
            },
            {
                id: 'param_basic_03',
                name: 'Boolean Parameter Handling',
                type: 'function_call',
                instruction: 'Search for "ribosomal" with case-sensitive matching enabled.',
                expectedResult: {
                    tool_name: 'search_features',
                    parameters: {
                        query: 'ribosomal',
                        caseSensitive: true
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateBooleanParameter.bind(this)
            },

            // Complex Parameter Structures
            {
                id: 'param_complex_01',
                name: 'Range Parameter Handling',
                type: 'function_call',
                instruction: 'Get sequence from position 50000 to 60000 on chromosome COLI-K12.',
                expectedResult: {
                    tool_name: 'get_sequence',
                    parameters: {
                        chromosome: 'COLI-K12',
                        start: 50000,
                        end: 60000
                    }
                },
                maxScore: 120,
                evaluator: this.evaluateRangeParameter.bind(this)
            },
            {
                id: 'param_complex_02',
                name: 'Optional Parameter Handling',
                type: 'function_call',
                instruction: 'Get sequence from position 10000 to 20000 on the plus strand of chromosome COLI-K12.',
                expectedResult: {
                    tool_name: 'get_sequence',
                    parameters: {
                        chromosome: 'COLI-K12',
                        start: 10000,
                        end: 20000,
                        strand: '+'
                    }
                },
                maxScore: 120,
                evaluator: this.evaluateOptionalParameter.bind(this)
            },

            // Parameter Inference Tests
            {
                id: 'param_inference_01',
                name: 'Chromosome Inference',
                type: 'function_call',
                instruction: 'Get sequence from position 1000 to 2000 (use the current genome chromosome).',
                expectedResult: {
                    tool_name: 'get_sequence',
                    parameters: {
                        chromosome: 'COLI-K12',
                        start: 1000,
                        end: 2000
                    }
                },
                maxScore: 110,
                evaluator: this.evaluateInferredParameter.bind(this)
            },
            {
                id: 'param_inference_02',
                name: 'Default Value Handling',
                type: 'function_call',
                instruction: 'Zoom in the view (use default zoom factor).',
                expectedResult: {
                    tool_name: 'zoom_in',
                    parameters: {}
                },
                maxScore: 100,
                evaluator: this.evaluateDefaultParameter.bind(this)
            },

            // Parameter Validation Tests
            {
                id: 'param_validation_01',
                name: 'Coordinate Validation',
                type: 'function_call',
                instruction: 'Navigate to position 150000 to 140000 on chromosome COLI-K12 (note: end before start).',
                expectedResult: {
                    tool_name: 'navigate_to_position',
                    parameters: {
                        chromosome: 'COLI-K12',
                        start: 140000,
                        end: 150000
                    }
                },
                maxScore: 120,
                evaluator: this.evaluateCoordinateValidation.bind(this)
            },
            {
                id: 'param_validation_02',
                name: 'Strand Validation',
                type: 'function_call',
                instruction: 'Create annotation on the forward strand (use +1 or + format).',
                expectedResult: {
                    tool_name: 'create_annotation',
                    parameters: {
                        type: 'gene',
                        name: 'test',
                        chromosome: 'COLI-K12',
                        start: 1000,
                        end: 2000,
                        strand: 1
                    }
                },
                maxScore: 120,
                evaluator: this.evaluateStrandValidation.bind(this)
            },

            // Multiple Parameter Sets
            {
                id: 'param_multiple_01',
                name: 'Multiple Function Parameters',
                type: 'function_call',
                instruction: 'Export data in FASTA format for chromosome COLI-K12 from position 1000 to 5000.',
                expectedResult: {
                    tool_name: 'export_data',
                    parameters: {
                        format: 'fasta',
                        chromosome: 'COLI-K12',
                        start: 1000,
                        end: 5000
                    }
                },
                maxScore: 130,
                evaluator: this.evaluateMultipleParameters.bind(this)
            },

            // Parameter Format Tests
            {
                id: 'param_format_01',
                name: 'Sequence Format Validation',
                type: 'function_call',
                instruction: 'Translate DNA sequence "ATGAAATTTAAATAG" to protein.',
                expectedResult: {
                    tool_name: 'translate_dna',
                    parameters: {
                        sequence: 'ATGAAATTTAAATAG'
                    }
                },
                maxScore: 110,
                evaluator: this.evaluateSequenceFormat.bind(this)
            },
            {
                id: 'param_format_02',
                name: 'Case Insensitive Parameter',
                type: 'function_call',
                instruction: 'Search for gene "LacZ" (mixed case).',
                expectedResult: {
                    tool_name: 'search_gene_by_name',
                    parameters: {
                        name: 'LacZ'
                    }
                },
                maxScore: 100,
                evaluator: this.evaluateCaseHandling.bind(this)
            },

            // Error-prone Parameter Tests
            {
                id: 'param_error_01',
                name: 'Missing Required Parameter',
                type: 'function_call',
                instruction: 'Get sequence from chromosome COLI-K12 (missing position information).',
                expectedResult: {
                    expectError: true,
                    alternativeAction: 'request_clarification'
                },
                maxScore: 100,
                evaluator: this.evaluateMissingParameter.bind(this)
            },
            {
                id: 'param_error_02',
                name: 'Invalid Parameter Type',
                type: 'function_call',
                instruction: 'Navigate to position "abc" to "def" (non-numeric coordinates).',
                expectedResult: {
                    expectError: true,
                    alternativeAction: 'request_clarification'
                },
                maxScore: 100,
                evaluator: this.evaluateInvalidParameterType.bind(this)
            },

            // Complex Parsing Tests
            {
                id: 'param_parsing_01',
                name: 'Natural Language to Parameters',
                type: 'function_call',
                instruction: 'Find genes in the region around position one hundred thousand, plus or minus five thousand bases.',
                expectedResult: {
                    tool_name: 'get_nearby_features',
                    parameters: {
                        position: 100000,
                        distance: 5000
                    }
                },
                maxScore: 140,
                evaluator: this.evaluateNaturalLanguageParsing.bind(this)
            },
            {
                id: 'param_parsing_02',
                name: 'Scientific Notation Parsing',
                type: 'function_call',
                instruction: 'Navigate to position 1e5 to 1.1e5 on chromosome COLI-K12.',
                expectedResult: {
                    tool_name: 'navigate_to_position',
                    parameters: {
                        chromosome: 'COLI-K12',
                        start: 100000,
                        end: 110000
                    }
                },
                maxScore: 130,
                evaluator: this.evaluateScientificNotation.bind(this)
            },

            // Context-dependent Parameters
            {
                id: 'param_context_01',
                name: 'Context-dependent Parameter Resolution',
                type: 'function_call',
                instruction: 'Get the upstream region of gene lacZ (500 bp upstream).',
                expectedResult: {
                    tool_name: 'get_sequence',
                    parameters: {
                        geneName: 'lacZ',
                        upstream: 500
                    }
                },
                maxScore: 130,
                evaluator: this.evaluateContextDependentParameter.bind(this)
            }
        ];
    }

    // Evaluator methods

    async evaluateStringParameter(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.tool_name) {
            evaluation.errors.push('No function call detected');
            return evaluation;
        }

        const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
        
        // Function name (50 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 50;
        }

        // String parameter handling (50 points)
        if (call.parameters && call.parameters.name) {
            if (typeof call.parameters.name === 'string') {
                evaluation.score += 25;
                if (call.parameters.name === expectedResult.parameters.name) {
                    evaluation.score += 25;
                } else {
                    evaluation.warnings.push('String parameter value mismatch');
                }
            } else {
                evaluation.errors.push('Parameter should be string type');
            }
        } else {
            evaluation.errors.push('Missing string parameter');
        }

        evaluation.success = evaluation.score >= 70;
        return evaluation;
    }

    async evaluateNumericParameter(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.tool_name) {
            evaluation.errors.push('No function call detected');
            return evaluation;
        }

        const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
        
        // Function name (40 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 40;
        }

        // Numeric parameters (60 points)
        if (call.parameters) {
            if (typeof call.parameters.start === 'number') {
                evaluation.score += 30;
                if (Math.abs(call.parameters.start - expectedResult.parameters.start) <= 1000) {
                    evaluation.score += 30;
                }
            } else {
                evaluation.errors.push('Start parameter should be numeric');
            }
        }

        evaluation.success = evaluation.score >= 70;
        return evaluation;
    }

    async evaluateBooleanParameter(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.tool_name) {
            evaluation.errors.push('No function call detected');
            return evaluation;
        }

        const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
        
        // Function name (50 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 50;
        }

        // Boolean parameter (50 points)
        if (call.parameters) {
            if (typeof call.parameters.caseSensitive === 'boolean') {
                evaluation.score += 25;
                if (call.parameters.caseSensitive === expectedResult.parameters.caseSensitive) {
                    evaluation.score += 25;
                }
            } else {
                evaluation.errors.push('caseSensitive parameter should be boolean');
            }
        }

        evaluation.success = evaluation.score >= 70;
        return evaluation;
    }

    async evaluateRangeParameter(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.tool_name) {
            evaluation.errors.push('No function call detected');
            return evaluation;
        }

        const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
        
        // Function name (40 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 40;
        }

        // Range validation (80 points)
        if (call.parameters && call.parameters.start && call.parameters.end) {
            if (call.parameters.start < call.parameters.end) {
                evaluation.score += 40; // Correct range order
                
                // Check values
                const startDiff = Math.abs(call.parameters.start - expectedResult.parameters.start);
                const endDiff = Math.abs(call.parameters.end - expectedResult.parameters.end);
                
                if (startDiff <= 1000 && endDiff <= 1000) {
                    evaluation.score += 40;
                } else {
                    evaluation.score += 20;
                    evaluation.warnings.push('Range values are approximate');
                }
            } else {
                evaluation.errors.push('Start should be less than end');
            }
        } else {
            evaluation.errors.push('Missing range parameters');
        }

        evaluation.success = evaluation.score >= 85;
        return evaluation;
    }

    async evaluateOptionalParameter(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.tool_name) {
            evaluation.errors.push('No function call detected');
            return evaluation;
        }

        const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
        
        // Function name (40 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 40;
        }

        // Required parameters (50 points)
        if (call.parameters && call.parameters.start && call.parameters.end) {
            evaluation.score += 50;
        }

        // Optional parameter handling (30 points)
        if (call.parameters && call.parameters.strand) {
            if (call.parameters.strand === '+' || call.parameters.strand === 1) {
                evaluation.score += 30;
            } else {
                evaluation.score += 15;
                evaluation.warnings.push('Strand parameter format could be improved');
            }
        } else {
            evaluation.score += 10; // Partial credit for not including optional param
            evaluation.warnings.push('Optional strand parameter not specified');
        }

        evaluation.success = evaluation.score >= 85;
        return evaluation;
    }

    async evaluateInferredParameter(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.tool_name) {
            evaluation.errors.push('No function call detected');
            return evaluation;
        }

        const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
        
        // Function name (40 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 40;
        }

        // Parameter inference (70 points)
        if (call.parameters) {
            if (call.parameters.chromosome) {
                evaluation.score += 35; // Inferred chromosome
                if (call.parameters.chromosome === expectedResult.parameters.chromosome) {
                    evaluation.score += 35; // Correct inference
                }
            } else {
                evaluation.warnings.push('Chromosome parameter should be inferred from context');
            }
        }

        evaluation.success = evaluation.score >= 75;
        return evaluation;
    }

    async evaluateDefaultParameter(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.tool_name) {
            evaluation.errors.push('No function call detected');
            return evaluation;
        }

        const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
        
        // Function name (60 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 60;
        }

        // Default parameter handling (40 points)
        if (!call.parameters || Object.keys(call.parameters).length === 0) {
            evaluation.score += 40; // Correctly omitted optional parameters
        } else if (call.parameters.factor === undefined || call.parameters.factor === 2) {
            evaluation.score += 30; // Used default or reasonable value
        } else {
            evaluation.score += 20;
            evaluation.warnings.push('Non-default factor specified when default was requested');
        }

        evaluation.success = evaluation.score >= 70;
        return evaluation;
    }

    async evaluateCoordinateValidation(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.tool_name) {
            evaluation.errors.push('No function call detected');
            return evaluation;
        }

        const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
        
        // Function name (40 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 40;
        }

        // Coordinate correction (80 points)
        if (call.parameters && call.parameters.start && call.parameters.end) {
            if (call.parameters.start < call.parameters.end) {
                evaluation.score += 80; // Correctly fixed the coordinate order
            } else if (call.parameters.start === 150000 && call.parameters.end === 140000) {
                evaluation.score += 20; // Used original incorrect order
                evaluation.errors.push('Coordinates not corrected (start > end)');
            } else {
                evaluation.score += 40; // Partial correction
            }
        }

        evaluation.success = evaluation.score >= 80;
        return evaluation;
    }

    async evaluateStrandValidation(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.tool_name) {
            evaluation.errors.push('No function call detected');
            return evaluation;
        }

        const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
        
        // Function name (40 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 40;
        }

        // Strand format validation (80 points)
        if (call.parameters && call.parameters.strand !== undefined) {
            if (call.parameters.strand === 1 || call.parameters.strand === '+') {
                evaluation.score += 80; // Correct strand format
            } else if (call.parameters.strand === -1 || call.parameters.strand === '-') {
                evaluation.score += 60; // Wrong strand but correct format
                evaluation.warnings.push('Specified reverse strand instead of forward');
            } else {
                evaluation.score += 20; // Invalid strand format
                evaluation.errors.push('Invalid strand format');
            }
        } else {
            evaluation.warnings.push('Strand parameter not specified');
        }

        evaluation.success = evaluation.score >= 80;
        return evaluation;
    }

    async evaluateMultipleParameters(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.tool_name) {
            evaluation.errors.push('No function call detected');
            return evaluation;
        }

        const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
        
        // Function name (30 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 30;
        }

        // Multiple parameter validation (100 points total)
        const requiredParams = ['format', 'chromosome', 'start', 'end'];
        let paramScore = 0;
        
        for (const param of requiredParams) {
            if (call.parameters && call.parameters[param] !== undefined) {
                paramScore += 25;
            }
        }
        
        evaluation.score += paramScore;

        evaluation.success = evaluation.score >= 90;
        return evaluation;
    }

    async evaluateSequenceFormat(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.tool_name) {
            evaluation.errors.push('No function call detected');
            return evaluation;
        }

        const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
        
        // Function name (50 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 50;
        }

        // Sequence format validation (60 points)
        if (call.parameters && call.parameters.sequence) {
            const sequence = call.parameters.sequence.toUpperCase();
            if (/^[ATCGN]+$/.test(sequence)) {
                evaluation.score += 60; // Valid DNA sequence
            } else {
                evaluation.score += 20;
                evaluation.errors.push('Invalid DNA sequence characters');
            }
        } else {
            evaluation.errors.push('Missing sequence parameter');
        }

        evaluation.success = evaluation.score >= 80;
        return evaluation;
    }

    async evaluateCaseHandling(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.tool_name) {
            evaluation.errors.push('No function call detected');
            return evaluation;
        }

        const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
        
        // Function name (50 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 50;
        }

        // Case handling (50 points)
        if (call.parameters && call.parameters.name) {
            if (call.parameters.name.toLowerCase() === expectedResult.parameters.name.toLowerCase()) {
                evaluation.score += 50; // Correct case handling
            } else {
                evaluation.errors.push('Gene name mismatch');
            }
        }

        evaluation.success = evaluation.score >= 70;
        return evaluation;
    }

    async evaluateMissingParameter(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        // For missing parameter tests, success means NOT making the function call
        // or requesting clarification
        
        if (!actualResult || actualResult.error) {
            evaluation.score += 100; // Correctly identified missing parameters
            evaluation.success = true;
        } else if (actualResult.content && this.containsClarificationRequest(actualResult.content)) {
            evaluation.score += 90; // Asked for clarification
            evaluation.success = true;
        } else if (actualResult.tool_name) {
            evaluation.score += 20; // Made function call despite missing params
            evaluation.warnings.push('Function called with insufficient parameters');
        }

        return evaluation;
    }

    async evaluateInvalidParameterType(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        // Success means recognizing invalid parameter types
        
        if (!actualResult || actualResult.error) {
            evaluation.score += 100;
            evaluation.success = true;
        } else if (actualResult.content && this.containsErrorRecognition(actualResult.content)) {
            evaluation.score += 90;
            evaluation.success = true;
        } else if (actualResult.tool_name && actualResult.parameters) {
            // Check if parameters were converted to valid types
            if (typeof actualResult.parameters.start === 'number') {
                evaluation.score += 50; // Attempted conversion
                evaluation.warnings.push('Attempted to convert invalid parameters');
            }
        }

        return evaluation;
    }

    async evaluateNaturalLanguageParsing(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.tool_name) {
            evaluation.errors.push('No function call detected');
            return evaluation;
        }

        const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
        
        // Function name (40 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 40;
        }

        // Natural language parsing (100 points)
        if (call.parameters) {
            // Check position parsing
            if (call.parameters.position && 
                Math.abs(call.parameters.position - expectedResult.parameters.position) <= 5000) {
                evaluation.score += 50;
            }
            
            // Check distance parsing
            if (call.parameters.distance && 
                Math.abs(call.parameters.distance - expectedResult.parameters.distance) <= 1000) {
                evaluation.score += 50;
            }
        }

        evaluation.success = evaluation.score >= 100;
        return evaluation;
    }

    async evaluateScientificNotation(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.tool_name) {
            evaluation.errors.push('No function call detected');
            return evaluation;
        }

        const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
        
        // Function name (40 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 40;
        }

        // Scientific notation parsing (90 points)
        if (call.parameters && call.parameters.start && call.parameters.end) {
            if (call.parameters.start === expectedResult.parameters.start) {
                evaluation.score += 45;
            }
            if (call.parameters.end === expectedResult.parameters.end) {
                evaluation.score += 45;
            }
        }

        evaluation.success = evaluation.score >= 90;
        return evaluation;
    }

    async evaluateContextDependentParameter(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.tool_name) {
            evaluation.errors.push('No function call detected');
            return evaluation;
        }

        const call = Array.isArray(actualResult) ? actualResult[0] : actualResult;
        
        // Function name (40 points)
        if (call.tool_name === expectedResult.tool_name) {
            evaluation.score += 40;
        }

        // Context-dependent parameter resolution (90 points)
        if (call.parameters) {
            if (call.parameters.geneName === 'lacZ') {
                evaluation.score += 45;
            }
            if (call.parameters.upstream === 500 || 
                (call.parameters.start && call.parameters.end && 
                 Math.abs((call.parameters.end - call.parameters.start) - 500) <= 50)) {
                evaluation.score += 45;
            }
        }

        evaluation.success = evaluation.score >= 90;
        return evaluation;
    }

    // Helper methods

    containsClarificationRequest(content) {
        const clarificationKeywords = [
            'clarification', 'specify', 'which position', 'missing', 'need more information',
            'please provide', 'what position', 'start and end'
        ];
        return clarificationKeywords.some(keyword => 
            content.toLowerCase().includes(keyword)
        );
    }

    containsErrorRecognition(content) {
        const errorKeywords = [
            'invalid', 'error', 'cannot parse', 'not numeric', 'invalid coordinates',
            'should be number', 'position must be'
        ];
        return errorKeywords.some(keyword => 
            content.toLowerCase().includes(keyword)
        );
    }

    /**
     * Setup method
     */
    async setup(context) {
        console.log('Setting up Parameter Handling test suite');
    }

    /**
     * Cleanup method
     */
    async cleanup(context) {
        console.log('Cleaning up Parameter Handling test suite');
    }
}

// Make available globally
window.ParameterHandlingSuite = ParameterHandlingSuite;
