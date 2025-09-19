/**
 * Error Recovery Test Suite - Tests LLM error handling and recovery capabilities
 */
class ErrorRecoverySuite {
    constructor() {
        this.suiteName = 'Error Recovery';
        this.suiteId = 'error_recovery';
        this.description = 'Tests LLM ability to handle errors and recover gracefully';
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
            {
                id: 'error_recovery_01',
                name: 'Invalid Gene Name Recovery',
                type: 'text_analysis',
                instruction: 'Search for gene "nonExistentGene123" and handle the case where it is not found.',
                expectedResult: {
                    minWords: 20,
                    requiredKeywords: ['not found', 'does not exist', 'alternative', 'suggestion'],
                    expectsGracefulHandling: true
                },
                maxScore: 120,
                timeout: 20000,
                evaluator: this.evaluateErrorRecovery.bind(this)
            },
            {
                id: 'error_recovery_02',
                name: 'Invalid Coordinates Recovery',
                type: 'text_analysis',
                instruction: 'Navigate to position -1000 to -500 (invalid negative coordinates) and handle the error.',
                expectedResult: {
                    minWords: 15,
                    requiredKeywords: ['invalid', 'coordinates', 'positive', 'valid range'],
                    expectsGracefulHandling: true
                },
                maxScore: 120,
                evaluator: this.evaluateErrorRecovery.bind(this)
            },
            {
                id: 'error_recovery_03',
                name: 'Function Call Timeout Recovery',
                type: 'text_analysis',
                instruction: 'Perform a BLAST search that might timeout and explain how to handle such situations.',
                expectedResult: {
                    minWords: 25,
                    requiredKeywords: ['timeout', 'try again', 'network', 'patience'],
                    expectsGracefulHandling: true
                },
                maxScore: 120,
                evaluator: this.evaluateErrorRecovery.bind(this)
            }
        ];
    }

    async evaluateErrorRecovery(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.content) {
            evaluation.errors.push('No error handling response provided');
            return evaluation;
        }

        // Check word count (30 points)
        const wordCount = actualResult.content.split(/\s+/).length;
        if (wordCount >= expectedResult.minWords) {
            evaluation.score += 30;
        } else {
            evaluation.score += Math.round((wordCount / expectedResult.minWords) * 30);
        }

        // Check for required keywords (50 points)
        const foundKeywords = expectedResult.requiredKeywords.filter(keyword =>
            actualResult.content.toLowerCase().includes(keyword.toLowerCase())
        );
        evaluation.score += (foundKeywords.length / expectedResult.requiredKeywords.length) * 50;

        // Check for graceful handling (40 points)
        if (this.hasGracefulHandling(actualResult.content)) {
            evaluation.score += 40;
        }

        evaluation.success = evaluation.score >= 80;
        return evaluation;
    }

    hasGracefulHandling(content) {
        const gracefulKeywords = ['alternative', 'suggestion', 'try', 'instead', 'recommend', 'option'];
        return gracefulKeywords.some(keyword => content.toLowerCase().includes(keyword));
    }

    async setup(context) {
        console.log('Setting up Error Recovery test suite');
    }

    async cleanup(context) {
        console.log('Cleaning up Error Recovery test suite');
    }
}

window.ErrorRecoverySuite = ErrorRecoverySuite;
