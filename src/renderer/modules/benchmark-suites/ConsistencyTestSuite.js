/**
 * Consistency Test Suite - Tests LLM consistency across similar tasks
 */
class ConsistencyTestSuite {
    constructor() {
        this.suiteName = 'Consistency Tests';
        this.suiteId = 'consistency_tests';
        this.description = 'Tests LLM consistency across similar instructions';
        this.framework = null;
        this.tests = this.initializeTests();
    }

    getName() { return this.suiteName; }
    getTests() { return this.tests; }
    getTestCount() { return this.tests.length; }

    initializeTests() {
        return [
            {
                id: 'consistency_01a',
                name: 'Gene Search Consistency A',
                type: 'function_call',
                instruction: 'Find gene lacZ.',
                expectedResult: {
                    tool_name: 'search_gene_by_name',
                    parameters: { name: 'lacZ' }
                },
                maxScore: 100,
                evaluator: this.evaluateConsistency.bind(this)
            },
            {
                id: 'consistency_01b',
                name: 'Gene Search Consistency B',
                type: 'function_call',
                instruction: 'Search for gene lacZ.',
                expectedResult: {
                    tool_name: 'search_gene_by_name',
                    parameters: { name: 'lacZ' }
                },
                maxScore: 100,
                evaluator: this.evaluateConsistency.bind(this)
            }
        ];
    }

    async evaluateConsistency(actualResult, expectedResult, testResult) {
        const evaluation = { success: false, score: 0, maxScore: testResult.maxScore, errors: [], warnings: [] };
        
        if (actualResult?.tool_name === expectedResult.tool_name) {
            evaluation.score += 60;
            
            if (actualResult.parameters?.name === expectedResult.parameters.name) {
                evaluation.score += 40;
            }
        }

        evaluation.success = evaluation.score >= 80;
        return evaluation;
    }

    async setup(context) { console.log('Setting up Consistency test suite'); }
    async cleanup(context) { console.log('Cleaning up Consistency test suite'); }
}

window.ConsistencyTestSuite = ConsistencyTestSuite;
