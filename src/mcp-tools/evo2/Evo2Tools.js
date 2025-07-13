/**
 * EVO2 Tools Module
 * Handles NVIDIA EVO2 AI-powered DNA generation and analysis tools
 */

const https = require('https');

class Evo2Tools {
    constructor(server) {
        this.server = server;
    }

    getTools() {
        return {
            evo2_generate_sequence: {
                name: 'evo2_generate_sequence',
                description: 'Generate DNA sequences using NVIDIA Evo2 model. Can perform zero-shot function prediction, CRISPR-Cas complex design, and generate coding-rich sequences up to 1M bp.',
                parameters: {
                    type: 'object',
                    properties: {
                        prompt: { type: 'string', description: 'Input DNA sequence as starting prompt or empty for de novo generation', default: '' },
                        maxTokens: { type: 'number', description: 'Maximum length of generated sequence (up to 1048576)', default: 1000 },
                        temperature: { type: 'number', description: 'Generation temperature (0.0-2.0)', default: 1.0 },
                        topP: { type: 'number', description: 'Top-p sampling (0.0-1.0)', default: 0.9 },
                        seed: { type: 'number', description: 'Random seed for reproducible generation', default: null },
                        taxonomy: { type: 'string', description: 'Target organism taxonomy in format: |k__[kingdom];p__[phylum];c__[class];o__[order];g__[genus];s__[species]|', default: null },
                        stopSequences: { type: 'array', items: { type: 'string' }, description: 'Stop generation at these sequences', default: [] },
                        stream: { type: 'boolean', description: 'Stream the response', default: false }
                    },
                    required: []
                }
            },

            evo2_predict_function: {
                name: 'evo2_predict_function',
                description: 'Predict gene function from DNA sequence using Evo2 zero-shot capabilities',
                parameters: {
                    type: 'object',
                    properties: {
                        sequence: { type: 'string', description: 'DNA sequence for function prediction' },
                        taxonomy: { type: 'string', description: 'Organism taxonomy context', default: null },
                        analysisType: { type: 'string', enum: ['function', 'essentiality', 'regulation'], description: 'Type of functional analysis', default: 'function' }
                    },
                    required: ['sequence']
                }
            },

            evo2_design_crispr: {
                name: 'evo2_design_crispr',
                description: 'Design CRISPR-Cas molecular complexes using Evo2 multi-element generation',
                parameters: {
                    type: 'object',
                    properties: {
                        targetSequence: { type: 'string', description: 'Target DNA sequence for CRISPR design' },
                        casType: { type: 'string', enum: ['Cas9', 'Cas12', 'Cas13', 'Auto'], description: 'CRISPR-Cas system type', default: 'Auto' },
                        pamSequence: { type: 'string', description: 'Preferred PAM sequence motif', default: null },
                        guideLength: { type: 'number', description: 'Guide RNA length (15-25)', default: 20 },
                        organism: { type: 'string', description: 'Target organism for optimization', default: null }
                    },
                    required: ['targetSequence']
                }
            },

            evo2_optimize_sequence: {
                name: 'evo2_optimize_sequence',
                description: 'Optimize DNA sequences for specific properties using Evo2',
                parameters: {
                    type: 'object',
                    properties: {
                        sequence: { type: 'string', description: 'Input DNA sequence to optimize' },
                        optimizationGoal: { type: 'string', enum: ['expression', 'stability', 'codingDensity', 'gc_content'], description: 'Optimization objective' },
                        constraints: { type: 'object', description: 'Optimization constraints (GC content, codon usage, etc.)' },
                        targetOrganism: { type: 'string', description: 'Target organism for optimization' },
                        preserveFunction: { type: 'boolean', description: 'Preserve original function during optimization', default: true }
                    },
                    required: ['sequence', 'optimizationGoal']
                }
            },

            evo2_analyze_essentiality: {
                name: 'evo2_analyze_essentiality',
                description: 'Analyze gene essentiality at nucleotide resolution using Evo2',
                parameters: {
                    type: 'object',
                    properties: {
                        sequence: { type: 'string', description: 'DNA sequence for essentiality analysis' },
                        organism: { type: 'string', description: 'Target organism context' },
                        resolution: { type: 'string', enum: ['nucleotide', 'codon', 'domain'], description: 'Analysis resolution', default: 'nucleotide' },
                        includeVisualization: { type: 'boolean', description: 'Include visualization data', default: true }
                    },
                    required: ['sequence']
                }
            }
        };
    }

    async evo2GenerateSequence(parameters) {
        return await this.server.evo2GenerateSequence(parameters);
    }

    async evo2PredictFunction(parameters) {
        return await this.server.evo2PredictFunction(parameters);
    }

    async evo2DesignCrispr(parameters) {
        return await this.server.evo2DesignCrispr(parameters);
    }

    async evo2OptimizeSequence(parameters) {
        return await this.server.evo2OptimizeSequence(parameters);
    }

    async evo2AnalyzeEssentiality(parameters) {
        return await this.server.evo2AnalyzeEssentiality(parameters);
    }

    async callEvo2API(endpoint, requestBody, apiConfig = null) {
        return await this.server.callEvo2API(endpoint, requestBody, apiConfig);
    }

    getEvo2Config() {
        return this.server.getEvo2Config();
    }

    getSimulatedEvo2Response(requestBody) {
        return this.server.getSimulatedEvo2Response(requestBody);
    }

    generateSimulatedSequence(prompt, maxLength) {
        return this.server.generateSimulatedSequence(prompt, maxLength);
    }

    estimateConfidence(prediction) {
        return this.server.estimateConfidence(prediction);
    }

    parseCrisprDesign(design, targetSequence, guideLength) {
        return this.server.parseCrisprDesign(design, targetSequence, guideLength);
    }

    extractGuideRNA(design, targetSequence, length) {
        return this.server.extractGuideRNA(design, targetSequence, length);
    }

    findPAMSite(sequence) {
        return this.server.findPAMSite(sequence);
    }

    estimateEfficiency(guideRNA, pamSite) {
        return this.server.estimateEfficiency(guideRNA, pamSite);
    }

    extractSequenceFromResponse(response) {
        return this.server.extractSequenceFromResponse(response);
    }

    analyzeOptimization(original, optimized, goal) {
        return this.server.analyzeOptimization(original, optimized, goal);
    }

    calculateGCContent(sequence) {
        return this.server.calculateGCContent(sequence);
    }

    parseEssentialityAnalysis(analysis, sequence, resolution) {
        return this.server.parseEssentialityAnalysis(analysis, sequence, resolution);
    }

    extractEssentialityScore(analysis) {
        return this.server.extractEssentialityScore(analysis);
    }

    identifyCriticalRegions(sequence, analysis) {
        return this.server.identifyCriticalRegions(sequence, analysis);
    }
}

module.exports = Evo2Tools; 