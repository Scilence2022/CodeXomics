/**
 * Edge Case Test Suite - Tests LLM handling of edge cases and boundary conditions
 */
class EdgeCaseTestSuite {
    constructor() {
        this.suiteName = 'Edge Cases';
        this.suiteId = 'edge_cases';
        this.description = 'Tests LLM handling of edge cases and boundary conditions';
        this.framework = null;
        this.tests = this.initializeTests();
    }

    getName() { return this.suiteName; }
    getTests() { return this.tests; }
    getTestCount() { return this.tests.length; }

    initializeTests() {
        return [
            {
                id: 'edge_01',
                name: 'Empty Sequence Handling',
                type: 'function_call',
                instruction: 'Calculate GC content of an empty sequence "".',
                expectedResult: {
                    expectError: true,
                    alternativeAction: 'error_explanation'
                },
                maxScore: 100,
                evaluator: this.evaluateEdgeCase.bind(this)
            },
            {
                id: 'edge_02',
                name: 'Very Large Coordinates',
                type: 'function_call',
                instruction: 'Navigate to position 999999999 to 1000000000.',
                expectedResult: {
                    expectError: true,
                    alternativeAction: 'boundary_check'
                },
                maxScore: 100,
                evaluator: this.evaluateEdgeCase.bind(this)
            }
        ];
    }

    async evaluateEdgeCase(actualResult, expectedResult, testResult) {
        const evaluation = { success: false, score: 0, maxScore: testResult.maxScore, errors: [], warnings: [] };
        
        if (expectedResult.expectError) {
            if (actualResult?.error || this.containsErrorHandling(actualResult?.content)) {
                evaluation.score = 100;
                evaluation.success = true;
            }
        }

        return evaluation;
    }

    containsErrorHandling(content) {
        if (!content) return false;
        const errorKeywords = ['error', 'invalid', 'cannot', 'boundary', 'limit', 'range'];
        return errorKeywords.some(keyword => content.toLowerCase().includes(keyword));
    }

    async setup(context) { console.log('Setting up Edge Case test suite'); }
    async cleanup(context) { console.log('Cleaning up Edge Case test suite'); }
}

window.EdgeCaseTestSuite = EdgeCaseTestSuite;
