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
     * Initialize automatic complex test cases
     */
    initializeTests() {
        return [
            // NAVIGATION TASKS - Automatic + Complex
            {
                id: 'nav_auto_05',
                name: 'Navigate Complex Range Analysis',
                type: 'function_call',
                category: 'navigation',
                complexity: 'complex',
                evaluation: 'automatic',
                instruction: 'Navigate to region 1130000 to 1300000 and analyze the genomic features in this range.',
                expectedResult: {
                    tool_name: 'navigate_to_position',
                    parameters: {
                        chromosome: '<current_chromosome>',
                        start: 1130000,
                        end: 1300000
                    }
                },
                maxScore: 10,
                bonusScore: 2,
                timeout: 60000,
                evaluator: this.evaluateNavigationCall.bind(this)
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
            maxScore: testResult.maxScore || 10, // Use test's actual maxScore, default to 10 for complex
            errors: [],
            warnings: []
        };

        if (!actualResult) {
            evaluation.errors.push('No result obtained from test execution');
            return evaluation;
        }

        // Check tool name - award full points for correct tool
        const actualTool = Array.isArray(actualResult) ? actualResult[0]?.tool_name : actualResult.tool_name;
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

        evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * 0.6); // 60% threshold
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

        evaluation.success = evaluation.score >= Math.ceil(evaluation.maxScore * 0.6); // 60% threshold
        return evaluation;
    }

    async setup(context) {
        console.log('Setting up Automatic Complex test suite');
    }

    async cleanup(context) {
        console.log('Cleaning up Automatic Complex test suite');
    }
}

// Make the class available globally
window.AutomaticComplexSuite = AutomaticComplexSuite;