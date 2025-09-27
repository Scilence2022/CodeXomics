/**
 * Workflow Test Suite - Tests multi-step workflows and task completion
 */
class WorkflowTestSuite {
    constructor() {
        this.suiteName = 'Multi-step Workflows';
        this.suiteId = 'workflow_tests';
        this.description = 'Tests LLM ability to execute complex multi-step workflows';
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
                id: 'workflow_01',
                name: 'Gene Analysis Workflow',
                type: 'workflow',
                instruction: 'Perform complete analysis of gene thrA: find it, get its sequence, translate to protein, and calculate GC content.',
                expectedResult: {
                    expectedSteps: 4,
                    expectedFunctionCalls: 4,
                    requiredFunctions: ['search_gene_by_name', 'get_coding_sequence', 'translate_dna', 'compute_gc']
                },
                maxScore: 200,
                timeout: 60000,
                evaluator: this.evaluateWorkflow.bind(this)
            },
            {
                id: 'workflow_02',
                name: 'Comparative Analysis Workflow',
                type: 'workflow',
                instruction: 'Compare genes lacZ and lacY: find both genes, get their sequences, and analyze their similarities.',
                expectedResult: {
                    expectedSteps: 5,
                    expectedFunctionCalls: 4,
                    requiredFunctions: ['search_gene_by_name', 'get_coding_sequence'],
                    comparisonRequired: true
                },
                maxScore: 220,
                timeout: 60000,
                evaluator: this.evaluateComparativeWorkflow.bind(this)
            }
        ];
    }

    async evaluateWorkflow(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.functionCalls) {
            evaluation.errors.push('No workflow detected');
            return evaluation;
        }

        // Evaluate function calls
        const functionScore = this.evaluateRequiredFunctions(
            actualResult.functionCalls, 
            expectedResult.requiredFunctions
        );
        evaluation.score += (functionScore / 100) * (evaluation.maxScore * 0.6);

        // Evaluate steps
        const stepScore = this.evaluateStepCompletion(
            actualResult.steps || [], 
            expectedResult.expectedSteps
        );
        evaluation.score += (stepScore / 100) * (evaluation.maxScore * 0.4);

        evaluation.success = evaluation.score >= (evaluation.maxScore * 0.7);
        return evaluation;
    }

    async evaluateComparativeWorkflow(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateWorkflow(actualResult, expectedResult, testResult);
        
        // Bonus for comparison content
        if (expectedResult.comparisonRequired && actualResult.content) {
            const comparisonScore = this.evaluateComparisonContent(actualResult.content);
            evaluation.score += comparisonScore;
        }

        return evaluation;
    }

    evaluateRequiredFunctions(functionCalls, requiredFunctions) {
        const calledFunctions = functionCalls.map(call => call.tool_name);
        const foundFunctions = requiredFunctions.filter(func => calledFunctions.includes(func));
        return (foundFunctions.length / requiredFunctions.length) * 100;
    }

    evaluateStepCompletion(steps, expectedSteps) {
        if (steps.length >= expectedSteps) return 100;
        return (steps.length / expectedSteps) * 100;
    }

    evaluateComparisonContent(content) {
        const comparisonKeywords = ['compare', 'similar', 'different', 'versus', 'both'];
        const found = comparisonKeywords.filter(keyword => 
            content.toLowerCase().includes(keyword)
        );
        return Math.min(20, found.length * 5);
    }

    async setup(context) {
        console.log('Setting up Workflow test suite');
    }

    async cleanup(context) {
        console.log('Cleaning up Workflow test suite');
    }
}

window.WorkflowTestSuite = WorkflowTestSuite;
