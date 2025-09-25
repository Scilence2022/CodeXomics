/**
 * Performance Test Suite - Tests LLM performance and efficiency
 */
class PerformanceTestSuite {
    constructor() {
        this.suiteName = 'Performance Tests';
        this.suiteId = 'performance_tests';
        this.description = 'Tests LLM performance and response efficiency';
        this.framework = null;
        this.tests = this.initializeTests();
    }

    getName() { return this.suiteName; }
    getTests() { return this.tests; }
    getTestCount() { return this.tests.length; }

    initializeTests() {
        return [
            {
                id: 'perf_01',
                name: 'Quick Response Test',
                type: 'function_call',
                instruction: 'Search for gene lacZ.',
                expectedResult: {
                    tool_name: 'search_gene_by_name',
                    parameters: { name: 'lacZ' },
                    maxResponseTime: 5000
                },
                maxScore: 100,
                timeout: 300000, // 5 minutes to allow for longer LLM response times
                evaluator: this.evaluatePerformance.bind(this)
            }
        ];
    }

    async evaluatePerformance(actualResult, expectedResult, testResult) {
        const evaluation = { success: false, score: 0, maxScore: testResult.maxScore, errors: [], warnings: [] };
        
        // Check function call correctness (70 points)
        if (actualResult?.tool_name === expectedResult.tool_name) {
            evaluation.score += 70;
        }

        // Check response time (30 points)
        const responseTime = testResult.metrics?.responseTime || testResult.duration;
        if (responseTime && responseTime <= expectedResult.maxResponseTime) {
            evaluation.score += 30;
        } else if (responseTime) {
            const timeScore = Math.max(0, 30 - ((responseTime - expectedResult.maxResponseTime) / 1000) * 5);
            evaluation.score += timeScore;
        }

        evaluation.success = evaluation.score >= 70;
        return evaluation;
    }

    async setup(context) { console.log('Setting up Performance test suite'); }
    async cleanup(context) { console.log('Cleaning up Performance test suite'); }
}

window.PerformanceTestSuite = PerformanceTestSuite;
