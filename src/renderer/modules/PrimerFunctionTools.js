/**
 * Primer Function Tools - AI-Integrated Primer Design and Analysis
 * Provides primer property calculation, primer design, and site analysis
 * Integrated with Dynamic Tools Registry for LLM function calling
 */

class PrimerFunctionTools {
    constructor(app) {
        this.app = app;
        this.tools = {};

        // We'll lazy load PrimerDesigner if it's not already available
        this.PrimerDesigner = null;

        this.initializeTools();
    }

    async _ensureDesigner() {
        if (this.PrimerDesigner) return;

        try {
            if (typeof window.PrimerDesigner !== 'undefined') {
                this.PrimerDesigner = window.PrimerDesigner;
                return;
            }

            // If ChatManager loaded it globally
            this.PrimerDesigner = window.PrimerDesigner;
        } catch (e) {
            console.warn('PrimerDesigner class not available, some tools may fail', e);
        }
    }

    // Initialize and register all Primer function tools
    initializeTools() {
        this.tools = {
            // 1. Calculate properties
            calculate_primer_properties: {
                name: 'calculate_primer_properties',
                description: 'Calculate biochemical properties like melting temperature (Tm), GC content, and length for a given DNA primer sequence (18-35 bp). Use this to check if a sequence is suitable as a PCR or sequencing primer.',
                parameters: {
                    type: 'object',
                    properties: {
                        sequence: {
                            type: 'string',
                            description: 'The DNA primer sequence to analyze (only containing A, T, C, G)'
                        }
                    },
                    required: ['sequence']
                },
                execute: async (params) => {
                    await this._ensureDesigner();
                    return this.PrimerDesigner.calculateProperties(params.sequence);
                }
            },

            // 2. Design primers
            design_primers: {
                name: 'design_primers',
                description: 'Design a forward and reverse primer pair to amplify a target DNA sequence. This automatically finds optimal primers matching length, GC, and melting temperature criteria. Provide at least 150bp of sequence.',
                parameters: {
                    type: 'object',
                    properties: {
                        targetSequence: {
                            type: 'string',
                            description: 'The full DNA sequence region containing the desired amplicon'
                        },
                        targetTm: {
                            type: 'number',
                            description: 'Target melting temperature (default: 60.0)'
                        },
                        minProductSize: {
                            type: 'number',
                            description: 'Minimum PCR product size (default: 100)'
                        }
                    },
                    required: ['targetSequence']
                },
                execute: async (params) => {
                    await this._ensureDesigner();
                    const options = {
                        targetTm: params.targetTm || 60.0,
                        minProductSize: params.minProductSize || 100
                    };
                    const pair = this.PrimerDesigner.designPrimerPair(params.targetSequence, options);
                    return pair || { error: 'Could not find a valid primer pair meeting the criteria in the given sequence' };
                }
            },

            // 3. Find binding sites
            find_primer_binding_sites: {
                name: 'find_primer_binding_sites',
                description: 'Search for binding sites of a specific primer sequence within a larger template (e.g. searching a gene sequence). Finds both forward and reverse occurrences.',
                parameters: {
                    type: 'object',
                    properties: {
                        primerSequence: {
                            type: 'string',
                            description: 'The short primer DNA sequence'
                        },
                        templateSequence: {
                            type: 'string',
                            description: 'The larger template DNA sequence to search within'
                        },
                        maxMismatches: {
                            type: 'number',
                            description: 'Maximum number of mismatched bases allowed (default: 0)'
                        }
                    },
                    required: ['primerSequence', 'templateSequence']
                },
                execute: async (params) => {
                    await this._ensureDesigner();
                    // PrimerDesigner.findBindingSites only requires 2 params, the return format is {start, end, strand, mismatches} but we need to match the signature.
                    // Notice: the class expects (primer, template, maxMismatches). 
                    const sites = this.PrimerDesigner.findBindingSites(params.primerSequence, params.templateSequence);

                    // We need to implement maxMismatches filtering manually if we reuse the simpler implementation, or pass it if updated.
                    // Our PrimerDesigner implementation supports maxMismatches.
                    return {
                        queryLength: params.primerSequence.length,
                        sites: this.PrimerDesigner.findBindingSites(params.primerSequence, params.templateSequence, params.maxMismatches || 0)
                    };
                }
            }
        };
    }

    // Execute a tool by name
    async executeTool(toolName, parameters) {
        if (!this.tools[toolName]) {
            throw new Error(`Primer tool '${toolName}' not found`);
        }

        try {
            const startTime = Date.now();

            const result = await this.tools[toolName].execute(parameters);

            const executionTime = Date.now() - startTime;
            console.log(`⏱️ [Primer Tools] Execution time for ${toolName}: ${executionTime}ms`);

            return result;
        } catch (error) {
            console.error(`❌ [Primer Tools] Tool execution failed for ${toolName}:`, error);
            throw error;
        }
    }

    // Get available tools list
    getAvailableTools() {
        return Object.values(this.tools).map(tool => ({
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters
        }));
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PrimerFunctionTools;
}
if (typeof window !== 'undefined') {
    window.PrimerFunctionTools = PrimerFunctionTools;
}
