/**
 * Contextual Understanding Test Suite - Tests LLM contextual awareness
 */
class ContextualUnderstandingSuite {
    constructor() {
        this.suiteName = 'Contextual Understanding';
        this.suiteId = 'contextual_understanding';
        this.description = 'Tests LLM ability to understand context and domain knowledge';
        this.framework = null;
        this.tests = this.initializeTests();
    }

    getName() { return this.suiteName; }
    getTests() { return this.tests; }
    getTestCount() { return this.tests.length; }

    initializeTests() {
        return [
            {
                id: 'context_01',
                name: 'Domain Knowledge Test',
                type: 'text_analysis',
                instruction: 'Explain what the lac operon is and why it\'s important in molecular biology.',
                expectedResult: {
                    minWords: 50,
                    requiredKeywords: ['lac operon', 'regulation', 'lactose', 'genes', 'expression']
                },
                maxScore: 150,
                evaluator: this.evaluateContextualResponse.bind(this)
            }
        ];
    }

    async evaluateContextualResponse(actualResult, expectedResult, testResult) {
        const evaluation = { success: false, score: 0, maxScore: testResult.maxScore, errors: [], warnings: [] };
        
        if (!actualResult?.content) {
            evaluation.errors.push('No contextual response provided');
            return evaluation;
        }

        const wordCount = actualResult.content.split(/\s+/).length;
        if (wordCount >= expectedResult.minWords) evaluation.score += 50;

        const foundKeywords = expectedResult.requiredKeywords.filter(keyword =>
            actualResult.content.toLowerCase().includes(keyword.toLowerCase())
        );
        evaluation.score += (foundKeywords.length / expectedResult.requiredKeywords.length) * 100;

        evaluation.success = evaluation.score >= 100;
        return evaluation;
    }

    async setup(context) { console.log('Setting up Contextual Understanding test suite'); }
    async cleanup(context) { console.log('Cleaning up Contextual Understanding test suite'); }
}

window.ContextualUnderstandingSuite = ContextualUnderstandingSuite;
