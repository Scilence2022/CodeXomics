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
            copy_sequence: {
                name: 'copy_sequence',
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

            cut_sequence: {
                name: 'cut_sequence',
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

            paste_sequence: {
                name: 'paste_sequence',
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

            delete_sequence: {
                name: 'delete_sequence',
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

            insert_sequence: {
                name: 'insert_sequence',
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

            replace_sequence: {
                name: 'replace_sequence',
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

            get_action_list: {
                name: 'get_action_list',
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

            execute_actions: {
                name: 'execute_actions',
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

            clear_actions: {
                name: 'clear_actions',
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

            get_clipboard_content: {
                name: 'get_clipboard_content',
                description: 'Get current clipboard content information',
                parameters: {
                    type: 'object',
                    properties: {}
                }
            },

            undo_last_action: {
                name: 'undo_last_action',
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
    async copy_sequence(params, clientId) {
        return await this.executeClientTool('copy_sequence', params, clientId);
    }

    async cut_sequence(params, clientId) {
        return await this.executeClientTool('cut_sequence', params, clientId);
    }

    async paste_sequence(params, clientId) {
        return await this.executeClientTool('paste_sequence', params, clientId);
    }

    async delete_sequence(params, clientId) {
        return await this.executeClientTool('delete_sequence', params, clientId);
    }

    async insert_sequence(params, clientId) {
        return await this.executeClientTool('insert_sequence', params, clientId);
    }

    async replace_sequence(params, clientId) {
        return await this.executeClientTool('replace_sequence', params, clientId);
    }

    async get_action_list(params, clientId) {
        return await this.executeClientTool('get_action_list', params, clientId);
    }

    async execute_actions(params, clientId) {
        return await this.executeClientTool('execute_actions', params, clientId);
    }

    async clear_actions(params, clientId) {
        return await this.executeClientTool('clear_actions', params, clientId);
    }

    async get_clipboard_content(params, clientId) {
        return await this.executeClientTool('get_clipboard_content', params, clientId);
    }

    async undo_last_action(params, clientId) {
        return await this.executeClientTool('undo_last_action', params, clientId);
    }
}

module.exports = ActionTools;