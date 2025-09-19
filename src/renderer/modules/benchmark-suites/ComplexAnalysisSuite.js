/**
 * Complex Analysis Test Suite - Tests advanced LLM analysis capabilities
 */
class ComplexAnalysisSuite {
    constructor() {
        this.suiteName = 'Complex Analysis';
        this.suiteId = 'complex_analysis';
        this.description = 'Tests advanced analysis capabilities requiring multi-step reasoning';
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
     * Initialize complex analysis test cases
     */
    initializeTests() {
        return [
            // Multi-step Gene Analysis
            {
                id: 'complex_analysis_01',
                name: 'Complete Gene Analysis Workflow',
                type: 'workflow',
                instruction: 'Perform a complete analysis of gene lacZ: find the gene, get its sequence, translate it to protein, and calculate GC content.',
                expectedResult: {
                    expectedSteps: 4,
                    expectedFunctionCalls: 4,
                    requiredFunctions: ['search_gene_by_name', 'get_coding_sequence', 'translate_dna', 'compute_gc']
                },
                maxScore: 150,
                timeout: 30000,
                evaluator: this.evaluateWorkflowTest.bind(this)
            },
            {
                id: 'complex_analysis_02',
                name: 'Comparative Gene Analysis',
                type: 'workflow',
                instruction: 'Compare the GC content and length of genes thrA and thrB. Find both genes, get their sequences, and analyze their composition.',
                expectedResult: {
                    expectedSteps: 6,
                    expectedFunctionCalls: 6,
                    requiredFunctions: ['search_gene_by_name', 'get_coding_sequence', 'compute_gc'],
                    comparisonRequired: true
                },
                maxScore: 200,
                timeout: 45000,
                evaluator: this.evaluateComparativeAnalysis.bind(this)
            },

            // Region Analysis
            {
                id: 'complex_analysis_03',
                name: 'Genomic Region Comprehensive Analysis',
                type: 'workflow',
                instruction: 'Analyze the genomic region from position 50000 to 60000 on COLI-K12. Get the sequence, find all genes in the region, calculate GC content, and identify ORFs.',
                expectedResult: {
                    expectedSteps: 4,
                    expectedFunctionCalls: 4,
                    requiredFunctions: ['get_sequence', 'get_nearby_features', 'compute_gc', 'find_orfs']
                },
                maxScore: 175,
                timeout: 40000,
                evaluator: this.evaluateRegionAnalysis.bind(this)
            },

            // Pathway Analysis
            {
                id: 'complex_analysis_04',
                name: 'Metabolic Pathway Gene Analysis',
                type: 'workflow',
                instruction: 'Find all genes related to "glycolysis" and analyze their distribution across the genome. Search for glycolysis genes, get their positions, and create annotations for the pathway.',
                expectedResult: {
                    expectedSteps: 3,
                    expectedFunctionCalls: 3,
                    requiredFunctions: ['search_features', 'create_annotation'],
                    pathwayAnalysis: true
                },
                maxScore: 150,
                timeout: 35000,
                evaluator: this.evaluatePathwayAnalysis.bind(this)
            },

            // Protein Structure and Function Analysis
            {
                id: 'complex_analysis_05',
                name: 'Protein Structure-Function Analysis',
                type: 'workflow',
                instruction: 'For gene recA: find the gene, get its protein sequence, search for its 3D structure in PDB, and also look for AlphaFold predictions.',
                expectedResult: {
                    expectedSteps: 4,
                    expectedFunctionCalls: 4,
                    requiredFunctions: ['search_gene_by_name', 'get_coding_sequence', 'search_protein_by_gene', 'search_alphafold_by_gene']
                },
                maxScore: 175,
                timeout: 40000,
                evaluator: this.evaluateProteinAnalysis.bind(this)
            },

            // BLAST and Homology Analysis
            {
                id: 'complex_analysis_06',
                name: 'Homology Search and Analysis',
                type: 'workflow',
                instruction: 'Get the sequence of gene dnaA, perform a BLAST search to find homologs, and analyze the conservation of this essential gene.',
                expectedResult: {
                    expectedSteps: 3,
                    expectedFunctionCalls: 3,
                    requiredFunctions: ['get_coding_sequence', 'blast_search'],
                    homologyAnalysis: true
                },
                maxScore: 150,
                timeout: 45000,
                evaluator: this.evaluateHomologyAnalysis.bind(this)
            },

            // Codon Usage Analysis
            {
                id: 'complex_analysis_07',
                name: 'Codon Usage Pattern Analysis',
                type: 'workflow',
                instruction: 'Analyze codon usage patterns in highly expressed genes. Find ribosomal protein genes, get their sequences, and perform codon usage analysis.',
                expectedResult: {
                    expectedSteps: 3,
                    expectedFunctionCalls: 3,
                    requiredFunctions: ['search_features', 'get_coding_sequence', 'codon_usage_analysis'],
                    codonAnalysis: true
                },
                maxScore: 175,
                timeout: 40000,
                evaluator: this.evaluateCodonAnalysis.bind(this)
            },

            // Regulatory Element Analysis
            {
                id: 'complex_analysis_08',
                name: 'Regulatory Element Prediction',
                type: 'workflow',
                instruction: 'For the lac operon genes (lacZ, lacY, lacA): find each gene, get upstream sequences, and predict promoter and ribosome binding sites.',
                expectedResult: {
                    expectedSteps: 9,
                    expectedFunctionCalls: 9,
                    requiredFunctions: ['search_gene_by_name', 'get_sequence', 'predict_promoter', 'predict_rbs'],
                    operonAnalysis: true
                },
                maxScore: 225,
                timeout: 60000,
                evaluator: this.evaluateRegulatoryAnalysis.bind(this)
            },

            // Restriction Analysis
            {
                id: 'complex_analysis_09',
                name: 'Restriction Enzyme Cloning Strategy',
                type: 'workflow',
                instruction: 'Design a cloning strategy for gene lacZ. Get the gene sequence, find restriction sites, and suggest suitable enzymes for cloning.',
                expectedResult: {
                    expectedSteps: 3,
                    expectedFunctionCalls: 3,
                    requiredFunctions: ['get_coding_sequence', 'find_restriction_sites'],
                    cloningStrategy: true
                },
                maxScore: 150,
                timeout: 35000,
                evaluator: this.evaluateCloningStrategy.bind(this)
            },

            // Genome Editing Analysis
            {
                id: 'complex_analysis_10',
                name: 'Gene Deletion Impact Analysis',
                type: 'workflow',
                instruction: 'Analyze the impact of deleting gene yaaJ. Find the gene, check nearby genes, predict the impact on neighboring operons, and suggest the deletion strategy.',
                expectedResult: {
                    expectedSteps: 4,
                    expectedFunctionCalls: 4,
                    requiredFunctions: ['search_gene_by_name', 'get_nearby_features'],
                    deletionAnalysis: true
                },
                maxScore: 175,
                timeout: 40000,
                evaluator: this.evaluateDeletionAnalysis.bind(this)
            },

            // Phylogenetic Analysis
            {
                id: 'complex_analysis_11',
                name: 'Evolutionary Conservation Analysis',
                type: 'workflow',
                instruction: 'Analyze the evolutionary conservation of the rpoB gene (RNA polymerase beta subunit). Get the sequence, perform BLAST search, and analyze conservation patterns.',
                expectedResult: {
                    expectedSteps: 3,
                    expectedFunctionCalls: 3,
                    requiredFunctions: ['get_coding_sequence', 'blast_search'],
                    conservationAnalysis: true
                },
                maxScore: 150,
                timeout: 45000,
                evaluator: this.evaluateConservationAnalysis.bind(this)
            },

            // Multi-genome Comparison
            {
                id: 'complex_analysis_12',
                name: 'Comparative Genomics Analysis',
                type: 'workflow',
                instruction: 'Compare the organization of the trp operon across different regions. Search for trp genes, analyze their clustering, and compare gene order.',
                expectedResult: {
                    expectedSteps: 3,
                    expectedFunctionCalls: 3,
                    requiredFunctions: ['search_features', 'get_nearby_features'],
                    comparativeGenomics: true
                },
                maxScore: 175,
                timeout: 40000,
                evaluator: this.evaluateComparativeGenomics.bind(this)
            },

            // Functional Annotation
            {
                id: 'complex_analysis_13',
                name: 'Comprehensive Gene Annotation',
                type: 'workflow',
                instruction: 'Provide comprehensive functional annotation for gene ftsZ. Find the gene, get its sequence, search for protein domains, find homologs, and predict function.',
                expectedResult: {
                    expectedSteps: 4,
                    expectedFunctionCalls: 4,
                    requiredFunctions: ['search_gene_by_name', 'get_coding_sequence', 'blast_search'],
                    functionalAnnotation: true
                },
                maxScore: 200,
                timeout: 50000,
                evaluator: this.evaluateFunctionalAnnotation.bind(this)
            },

            // Systems Biology Analysis
            {
                id: 'complex_analysis_14',
                name: 'Gene Network Analysis',
                type: 'workflow',
                instruction: 'Analyze the gene regulatory network around the ara operon. Find ara genes, identify their regulators, and map regulatory interactions.',
                expectedResult: {
                    expectedSteps: 3,
                    expectedFunctionCalls: 3,
                    requiredFunctions: ['search_features', 'get_nearby_features'],
                    networkAnalysis: true
                },
                maxScore: 175,
                timeout: 45000,
                evaluator: this.evaluateNetworkAnalysis.bind(this)
            },

            // Quality Control Analysis
            {
                id: 'complex_analysis_15',
                name: 'Genome Quality Assessment',
                type: 'workflow',
                instruction: 'Assess the quality of genome annotation in a specific region (100000-200000). Get the region sequence, find all features, calculate gene density, and identify potential annotation gaps.',
                expectedResult: {
                    expectedSteps: 4,
                    expectedFunctionCalls: 4,
                    requiredFunctions: ['get_sequence', 'get_nearby_features', 'analyze_region'],
                    qualityAssessment: true
                },
                maxScore: 175,
                timeout: 40000,
                evaluator: this.evaluateQualityAssessment.bind(this)
            }
        ];
    }

    /**
     * Evaluate workflow test with multiple steps
     */
    async evaluateWorkflowTest(actualResult, expectedResult, testResult) {
        const evaluation = {
            success: false,
            score: 0,
            maxScore: testResult.maxScore || 150,
            errors: [],
            warnings: []
        };

        if (!actualResult || !actualResult.functionCalls) {
            evaluation.errors.push('No function calls detected in workflow');
            return evaluation;
        }

        const functionCalls = actualResult.functionCalls || [];
        const steps = actualResult.steps || [];
        
        // Score breakdown:
        // 30% - Correct number of steps/function calls
        // 50% - Required functions are called
        // 20% - Logical sequence and completion

        // Check step count (30 points)
        const stepScore = this.evaluateStepCount(steps.length, expectedResult.expectedSteps);
        evaluation.score += (stepScore / 100) * (evaluation.maxScore * 0.3);

        // Check function calls (50 points)
        const functionScore = this.evaluateRequiredFunctions(functionCalls, expectedResult.requiredFunctions);
        evaluation.score += (functionScore / 100) * (evaluation.maxScore * 0.5);

        // Check completion and logic (20 points)
        const completionScore = this.evaluateWorkflowCompletion(actualResult, expectedResult);
        evaluation.score += (completionScore / 100) * (evaluation.maxScore * 0.2);

        evaluation.score = Math.round(evaluation.score);
        evaluation.success = evaluation.score >= (evaluation.maxScore * 0.6);

        return evaluation;
    }

    /**
     * Evaluate comparative analysis
     */
    async evaluateComparativeAnalysis(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateWorkflowTest(actualResult, expectedResult, testResult);
        
        // Additional scoring for comparison aspects
        if (expectedResult.comparisonRequired) {
            const comparisonScore = this.evaluateComparisonContent(actualResult.content);
            evaluation.score += comparisonScore;
            
            if (comparisonScore < 10) {
                evaluation.warnings.push('Comparison analysis could be more detailed');
            }
        }

        return evaluation;
    }

    /**
     * Evaluate region analysis
     */
    async evaluateRegionAnalysis(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateWorkflowTest(actualResult, expectedResult, testResult);
        
        // Check if region coordinates are properly handled
        const regionScore = this.evaluateRegionHandling(actualResult.functionCalls);
        evaluation.score += regionScore;

        return evaluation;
    }

    /**
     * Evaluate pathway analysis
     */
    async evaluatePathwayAnalysis(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateWorkflowTest(actualResult, expectedResult, testResult);
        
        if (expectedResult.pathwayAnalysis) {
            const pathwayScore = this.evaluatePathwayContent(actualResult.content);
            evaluation.score += pathwayScore;
        }

        return evaluation;
    }

    /**
     * Evaluate protein analysis
     */
    async evaluateProteinAnalysis(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateWorkflowTest(actualResult, expectedResult, testResult);
        
        // Check for both PDB and AlphaFold searches
        const structureScore = this.evaluateStructureSearches(actualResult.functionCalls);
        evaluation.score += structureScore;

        return evaluation;
    }

    /**
     * Evaluate homology analysis
     */
    async evaluateHomologyAnalysis(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateWorkflowTest(actualResult, expectedResult, testResult);
        
        if (expectedResult.homologyAnalysis) {
            const homologyScore = this.evaluateHomologyContent(actualResult.content);
            evaluation.score += homologyScore;
        }

        return evaluation;
    }

    /**
     * Evaluate codon analysis
     */
    async evaluateCodonAnalysis(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateWorkflowTest(actualResult, expectedResult, testResult);
        
        if (expectedResult.codonAnalysis) {
            const codonScore = this.evaluateCodonContent(actualResult.content);
            evaluation.score += codonScore;
        }

        return evaluation;
    }

    /**
     * Evaluate regulatory analysis
     */
    async evaluateRegulatoryAnalysis(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateWorkflowTest(actualResult, expectedResult, testResult);
        
        if (expectedResult.operonAnalysis) {
            const operonScore = this.evaluateOperonAnalysis(actualResult.functionCalls);
            evaluation.score += operonScore;
        }

        return evaluation;
    }

    /**
     * Evaluate cloning strategy
     */
    async evaluateCloningStrategy(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateWorkflowTest(actualResult, expectedResult, testResult);
        
        if (expectedResult.cloningStrategy) {
            const cloningScore = this.evaluateCloningContent(actualResult.content);
            evaluation.score += cloningScore;
        }

        return evaluation;
    }

    /**
     * Evaluate deletion analysis
     */
    async evaluateDeletionAnalysis(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateWorkflowTest(actualResult, expectedResult, testResult);
        
        if (expectedResult.deletionAnalysis) {
            const deletionScore = this.evaluateDeletionContent(actualResult.content);
            evaluation.score += deletionScore;
        }

        return evaluation;
    }

    /**
     * Evaluate conservation analysis
     */
    async evaluateConservationAnalysis(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateWorkflowTest(actualResult, expectedResult, testResult);
        
        if (expectedResult.conservationAnalysis) {
            const conservationScore = this.evaluateConservationContent(actualResult.content);
            evaluation.score += conservationScore;
        }

        return evaluation;
    }

    /**
     * Evaluate comparative genomics
     */
    async evaluateComparativeGenomics(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateWorkflowTest(actualResult, expectedResult, testResult);
        
        if (expectedResult.comparativeGenomics) {
            const comparativeScore = this.evaluateComparativeContent(actualResult.content);
            evaluation.score += comparativeScore;
        }

        return evaluation;
    }

    /**
     * Evaluate functional annotation
     */
    async evaluateFunctionalAnnotation(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateWorkflowTest(actualResult, expectedResult, testResult);
        
        if (expectedResult.functionalAnnotation) {
            const annotationScore = this.evaluateAnnotationContent(actualResult.content);
            evaluation.score += annotationScore;
        }

        return evaluation;
    }

    /**
     * Evaluate network analysis
     */
    async evaluateNetworkAnalysis(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateWorkflowTest(actualResult, expectedResult, testResult);
        
        if (expectedResult.networkAnalysis) {
            const networkScore = this.evaluateNetworkContent(actualResult.content);
            evaluation.score += networkScore;
        }

        return evaluation;
    }

    /**
     * Evaluate quality assessment
     */
    async evaluateQualityAssessment(actualResult, expectedResult, testResult) {
        const evaluation = await this.evaluateWorkflowTest(actualResult, expectedResult, testResult);
        
        if (expectedResult.qualityAssessment) {
            const qualityScore = this.evaluateQualityContent(actualResult.content);
            evaluation.score += qualityScore;
        }

        return evaluation;
    }

    // Helper methods for evaluation

    evaluateStepCount(actualSteps, expectedSteps) {
        if (actualSteps === expectedSteps) return 100;
        if (actualSteps >= expectedSteps * 0.8) return 80;
        if (actualSteps >= expectedSteps * 0.6) return 60;
        return 30;
    }

    evaluateRequiredFunctions(functionCalls, requiredFunctions) {
        if (!functionCalls || !requiredFunctions) return 0;
        
        const calledFunctions = functionCalls.map(call => call.tool_name);
        const foundFunctions = requiredFunctions.filter(func => calledFunctions.includes(func));
        
        return (foundFunctions.length / requiredFunctions.length) * 100;
    }

    evaluateWorkflowCompletion(actualResult, expectedResult) {
        let score = 0;
        
        // Check for completion indicators
        if (actualResult.completionIndicators && actualResult.completionIndicators.length > 0) {
            score += 50;
        }
        
        // Check for logical flow in content
        if (actualResult.content && this.hasLogicalFlow(actualResult.content)) {
            score += 30;
        }
        
        // Check for summary or conclusion
        if (actualResult.content && this.hasSummary(actualResult.content)) {
            score += 20;
        }
        
        return score;
    }

    evaluateComparisonContent(content) {
        if (!content) return 0;
        
        const comparisonKeywords = ['compare', 'comparison', 'versus', 'vs', 'different', 'similar', 'higher', 'lower'];
        const foundKeywords = comparisonKeywords.filter(keyword => 
            content.toLowerCase().includes(keyword)
        );
        
        return Math.min(15, foundKeywords.length * 3);
    }

    evaluateRegionHandling(functionCalls) {
        if (!functionCalls) return 0;
        
        const regionFunctions = functionCalls.filter(call => 
            call.parameters && (call.parameters.start || call.parameters.position)
        );
        
        return regionFunctions.length > 0 ? 10 : 0;
    }

    evaluatePathwayContent(content) {
        if (!content) return 0;
        
        const pathwayKeywords = ['pathway', 'metabolic', 'enzyme', 'reaction', 'substrate', 'product'];
        const foundKeywords = pathwayKeywords.filter(keyword => 
            content.toLowerCase().includes(keyword)
        );
        
        return Math.min(15, foundKeywords.length * 2.5);
    }

    evaluateStructureSearches(functionCalls) {
        if (!functionCalls) return 0;
        
        const hasPDB = functionCalls.some(call => call.tool_name === 'search_protein_by_gene');
        const hasAlphaFold = functionCalls.some(call => call.tool_name === 'search_alphafold_by_gene');
        
        if (hasPDB && hasAlphaFold) return 15;
        if (hasPDB || hasAlphaFold) return 8;
        return 0;
    }

    evaluateHomologyContent(content) {
        if (!content) return 0;
        
        const homologyKeywords = ['homolog', 'similarity', 'identity', 'conservation', 'ortholog', 'paralog'];
        const foundKeywords = homologyKeywords.filter(keyword => 
            content.toLowerCase().includes(keyword)
        );
        
        return Math.min(15, foundKeywords.length * 2.5);
    }

    evaluateCodonContent(content) {
        if (!content) return 0;
        
        const codonKeywords = ['codon', 'usage', 'bias', 'frequency', 'optimization', 'expression'];
        const foundKeywords = codonKeywords.filter(keyword => 
            content.toLowerCase().includes(keyword)
        );
        
        return Math.min(15, foundKeywords.length * 2.5);
    }

    evaluateOperonAnalysis(functionCalls) {
        if (!functionCalls) return 0;
        
        const operonGenes = ['lacZ', 'lacY', 'lacA'];
        const searchedGenes = functionCalls
            .filter(call => call.tool_name === 'search_gene_by_name')
            .map(call => call.parameters?.name || call.parameters?.geneName)
            .filter(name => name);
        
        const foundOperonGenes = operonGenes.filter(gene => 
            searchedGenes.some(searched => searched.toLowerCase() === gene.toLowerCase())
        );
        
        return (foundOperonGenes.length / operonGenes.length) * 15;
    }

    evaluateCloningContent(content) {
        if (!content) return 0;
        
        const cloningKeywords = ['restriction', 'enzyme', 'cloning', 'vector', 'site', 'digest'];
        const foundKeywords = cloningKeywords.filter(keyword => 
            content.toLowerCase().includes(keyword)
        );
        
        return Math.min(15, foundKeywords.length * 2.5);
    }

    evaluateDeletionContent(content) {
        if (!content) return 0;
        
        const deletionKeywords = ['deletion', 'impact', 'essential', 'lethal', 'knockout', 'disruption'];
        const foundKeywords = deletionKeywords.filter(keyword => 
            content.toLowerCase().includes(keyword)
        );
        
        return Math.min(15, foundKeywords.length * 2.5);
    }

    evaluateConservationContent(content) {
        if (!content) return 0;
        
        const conservationKeywords = ['conservation', 'conserved', 'evolution', 'phylogeny', 'divergence'];
        const foundKeywords = conservationKeywords.filter(keyword => 
            content.toLowerCase().includes(keyword)
        );
        
        return Math.min(15, foundKeywords.length * 3);
    }

    evaluateComparativeContent(content) {
        if (!content) return 0;
        
        const comparativeKeywords = ['comparative', 'genomics', 'synteny', 'organization', 'arrangement'];
        const foundKeywords = comparativeKeywords.filter(keyword => 
            content.toLowerCase().includes(keyword)
        );
        
        return Math.min(15, foundKeywords.length * 3);
    }

    evaluateAnnotationContent(content) {
        if (!content) return 0;
        
        const annotationKeywords = ['function', 'annotation', 'domain', 'motif', 'family', 'classification'];
        const foundKeywords = annotationKeywords.filter(keyword => 
            content.toLowerCase().includes(keyword)
        );
        
        return Math.min(15, foundKeywords.length * 2.5);
    }

    evaluateNetworkContent(content) {
        if (!content) return 0;
        
        const networkKeywords = ['network', 'regulation', 'regulator', 'interaction', 'pathway', 'system'];
        const foundKeywords = networkKeywords.filter(keyword => 
            content.toLowerCase().includes(keyword)
        );
        
        return Math.min(15, foundKeywords.length * 2.5);
    }

    evaluateQualityContent(content) {
        if (!content) return 0;
        
        const qualityKeywords = ['quality', 'density', 'coverage', 'gap', 'annotation', 'completeness'];
        const foundKeywords = qualityKeywords.filter(keyword => 
            content.toLowerCase().includes(keyword)
        );
        
        return Math.min(15, foundKeywords.length * 2.5);
    }

    hasLogicalFlow(content) {
        // Check for sequential indicators
        const flowIndicators = ['first', 'second', 'then', 'next', 'finally', 'step', 'after'];
        return flowIndicators.some(indicator => content.toLowerCase().includes(indicator));
    }

    hasSummary(content) {
        // Check for summary indicators
        const summaryIndicators = ['summary', 'conclusion', 'in summary', 'overall', 'result', 'findings'];
        return summaryIndicators.some(indicator => content.toLowerCase().includes(indicator));
    }

    /**
     * Setup method
     */
    async setup(context) {
        console.log('Setting up Complex Analysis test suite');
    }

    /**
     * Cleanup method
     */
    async cleanup(context) {
        console.log('Cleaning up Complex Analysis test suite');
    }
}

// Make available globally
window.ComplexAnalysisSuite = ComplexAnalysisSuite;
