/**
 * ActionTools Module
 * Provides sequence editing and action management tools for MCP Server
 */

class ActionTools {
    constructor(server) {
        this.server = server;
        this.tools = this.defineTools();
    }

    defineTools() {
        return {
            copySequence: {
                name: 'copySequence',
                description: 'Copy a sequence region to clipboard for later use',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { 
                            type: 'string', 
                            description: 'Chromosome identifier (e.g., "chr1", "chromosome1")' 
                        },
                        start: { 
                            type: 'number', 
                            description: 'Start position (1-based genomic coordinate)' 
                        },
                        end: { 
                            type: 'number', 
                            description: 'End position (1-based genomic coordinate)' 
                        },
                        strand: { 
                            type: 'string', 
                            enum: ['+', '-'], 
                            description: 'Strand direction (+ for forward, - for reverse)', 
                            default: '+' 
                        }
                    },
                    required: ['chromosome', 'start', 'end']
                }
            },

            cutSequence: {
                name: 'cutSequence',
                description: 'Cut a sequence region (copy to clipboard and mark for deletion)',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { 
                            type: 'string', 
                            description: 'Chromosome identifier (e.g., "chr1", "chromosome1")' 
                        },
                        start: { 
                            type: 'number', 
                            description: 'Start position (1-based genomic coordinate)' 
                        },
                        end: { 
                            type: 'number', 
                            description: 'End position (1-based genomic coordinate)' 
                        },
                        strand: { 
                            type: 'string', 
                            enum: ['+', '-'], 
                            description: 'Strand direction (+ for forward, - for reverse)', 
                            default: '+' 
                        }
                    },
                    required: ['chromosome', 'start', 'end']
                }
            },

            pasteSequence: {
                name: 'pasteSequence',
                description: 'Paste sequence from clipboard at specified position',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { 
                            type: 'string', 
                            description: 'Chromosome identifier (e.g., "chr1", "chromosome1")' 
                        },
                        position: { 
                            type: 'number', 
                            description: 'Insert position (1-based genomic coordinate)' 
                        }
                    },
                    required: ['chromosome', 'position']
                }
            },

            deleteSequence: {
                name: 'deleteSequence',
                description: 'Delete a sequence region',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { 
                            type: 'string', 
                            description: 'Chromosome identifier (e.g., "chr1", "chromosome1")' 
                        },
                        start: { 
                            type: 'number', 
                            description: 'Start position (1-based genomic coordinate)' 
                        },
                        end: { 
                            type: 'number', 
                            description: 'End position (1-based genomic coordinate)' 
                        },
                        strand: { 
                            type: 'string', 
                            enum: ['+', '-'], 
                            description: 'Strand direction (+ for forward, - for reverse)', 
                            default: '+' 
                        }
                    },
                    required: ['chromosome', 'start', 'end']
                }
            },

            insertSequence: {
                name: 'insertSequence',
                description: 'Insert a DNA sequence at specified position',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { 
                            type: 'string', 
                            description: 'Chromosome identifier (e.g., "chr1", "chromosome1")' 
                        },
                        position: { 
                            type: 'number', 
                            description: 'Insert position (1-based genomic coordinate)' 
                        },
                        sequence: { 
                            type: 'string', 
                            description: 'DNA sequence to insert (A, T, C, G, N allowed)' 
                        }
                    },
                    required: ['chromosome', 'position', 'sequence']
                }
            },

            replaceSequence: {
                name: 'replaceSequence',
                description: 'Replace sequence in specified region with new sequence',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { 
                            type: 'string', 
                            description: 'Chromosome identifier (e.g., "chr1", "chromosome1")' 
                        },
                        start: { 
                            type: 'number', 
                            description: 'Start position (1-based genomic coordinate)' 
                        },
                        end: { 
                            type: 'number', 
                            description: 'End position (1-based genomic coordinate)' 
                        },
                        sequence: { 
                            type: 'string', 
                            description: 'Replacement DNA sequence (A, T, C, G, N allowed)' 
                        },
                        strand: { 
                            type: 'string', 
                            enum: ['+', '-'], 
                            description: 'Strand direction (+ for forward, - for reverse)', 
                            default: '+' 
                        }
                    },
                    required: ['chromosome', 'start', 'end', 'sequence']
                }
            },

            getActionList: {
                name: 'getActionList',
                description: 'Get current list of pending and completed sequence actions',
                parameters: {
                    type: 'object',
                    properties: {
                        status: { 
                            type: 'string', 
                            enum: ['pending', 'completed', 'failed', 'all'], 
                            description: 'Filter actions by status', 
                            default: 'all' 
                        }
                    }
                }
            },

            executeActions: {
                name: 'executeActions',
                description: 'Execute all pending sequence actions',
                parameters: {
                    type: 'object',
                    properties: {
                        confirm: { 
                            type: 'boolean', 
                            description: 'Confirm execution without additional user prompt', 
                            default: false 
                        }
                    }
                }
            },

            clearActions: {
                name: 'clearActions',
                description: 'Clear actions from the queue',
                parameters: {
                    type: 'object',
                    properties: {
                        status: { 
                            type: 'string', 
                            enum: ['pending', 'completed', 'failed', 'all'], 
                            description: 'Clear actions by status', 
                            default: 'all' 
                        }
                    }
                }
            },

            getClipboardContent: {
                name: 'getClipboardContent',
                description: 'Get current clipboard content information',
                parameters: {
                    type: 'object',
                    properties: {}
                }
            },

            undoLastAction: {
                name: 'undoLastAction',
                description: 'Attempt to undo the last completed action',
                parameters: {
                    type: 'object',
                    properties: {}
                }
            }
        };
    }

    getTools() {
        return this.tools;
    }

    async executeClientTool(toolName, parameters, clientId) {
        console.log(`🔧 [ActionTools] Executing client tool: ${toolName}`, parameters);

        try {
            // Send request to client and wait for response
            const response = await this.server.executeToolOnClient(
                `action_${toolName}`,
                parameters,
                clientId
            );

            console.log(`✅ [ActionTools] Tool ${toolName} executed successfully`);
            return response;

        } catch (error) {
            console.error(`❌ [ActionTools] Tool ${toolName} failed:`, error);
            throw error;
        }
    }

    // Direct execution methods for server-side processing
    async copySequence(params, clientId) {
        return await this.executeClientTool('copySequence', params, clientId);
    }

    async cutSequence(params, clientId) {
        return await this.executeClientTool('cutSequence', params, clientId);
    }

    async pasteSequence(params, clientId) {
        return await this.executeClientTool('pasteSequence', params, clientId);
    }

    async deleteSequence(params, clientId) {
        return await this.executeClientTool('deleteSequence', params, clientId);
    }

    async insertSequence(params, clientId) {
        return await this.executeClientTool('insertSequence', params, clientId);
    }

    async replaceSequence(params, clientId) {
        return await this.executeClientTool('replaceSequence', params, clientId);
    }

    async getActionList(params, clientId) {
        return await this.executeClientTool('getActionList', params, clientId);
    }

    async executeActions(params, clientId) {
        return await this.executeClientTool('executeActions', params, clientId);
    }

    async clearActions(params, clientId) {
        return await this.executeClientTool('clearActions', params, clientId);
    }

    async getClipboardContent(params, clientId) {
        return await this.executeClientTool('getClipboardContent', params, clientId);
    }

    async undoLastAction(params, clientId) {
        return await this.executeClientTool('undoLastAction', params, clientId);
    }
}

module.exports = ActionTools;