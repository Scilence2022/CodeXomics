/**
 * Navigation Tools Module
 * Handles genome navigation, state management, and track control
 */

class NavigationTools {
    constructor(server) {
        this.server = server;
    }

    getTools() {
        return {
            navigate_to_position: {
                name: 'navigate_to_position',
                description: 'Navigate to a specific genomic position. If only position is provided, defaults to 2000bp range centered on that position.',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { type: 'string', description: 'Chromosome name' },
                        start: { type: 'number', description: 'Start position (optional if position provided)' },
                        end: { type: 'number', description: 'End position (optional if position provided)' },
                        position: { type: 'number', description: 'Center position (creates 2000bp range if start/end not provided)' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['chromosome']
                }
            },

            open_new_tab: {
                name: 'open_new_tab',
                description: 'Open a new tab window for parallel genome analysis. Can open tab for specific position, gene, or current state.',
                parameters: {
                    type: 'object',
                    properties: {
                        chromosome: { type: 'string', description: 'Chromosome name (optional if geneName provided)' },
                        start: { type: 'number', description: 'Start position (optional if position or geneName provided)' },
                        end: { type: 'number', description: 'End position (optional if position or geneName provided)' },
                        position: { type: 'number', description: 'Center position (creates 2000bp range if start/end not provided)' },
                        geneName: { type: 'string', description: 'Gene name to open tab for (searches and focuses on gene)' },
                        title: { type: 'string', description: 'Custom title for the new tab (optional)' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    }
                }
            },

            search_features: {
                name: 'search_features',
                description: 'Search for genomic features',
                parameters: {
                    type: 'object',
                    properties: {
                        query: { type: 'string', description: 'Search query' },
                        featureType: { type: 'string', description: 'Type of feature to search for' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['query']
                }
            },

            get_current_state: {
                name: 'get_current_state',
                description: 'Get current state of the Genome AI Studio',
                parameters: {
                    type: 'object',
                    properties: {
                        clientId: { type: 'string', description: 'Browser client ID' }
                    }
                }
            },

            jump_to_gene: {
                name: 'jump_to_gene',
                description: 'Jump directly to a gene location by name or locus tag',
                parameters: {
                    type: 'object',
                    properties: {
                        geneName: { type: 'string', description: 'Gene name or locus tag to search for' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['geneName']
                }
            },

            get_genome_info: {
                name: 'get_genome_info',
                description: 'Get comprehensive information about the loaded genome',
                parameters: {
                    type: 'object',
                    properties: {
                        clientId: { type: 'string', description: 'Browser client ID' }
                    }
                }
            },

            search_gene_by_name: {
                name: 'search_gene_by_name',
                description: 'Search for a specific gene by name or locus tag',
                parameters: {
                    type: 'object',
                    properties: {
                        name: { type: 'string', description: 'Gene name or locus tag' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['name']
                }
            },

            toggle_track: {
                name: 'toggle_track',
                description: 'Show or hide a specific track',
                parameters: {
                    type: 'object',
                    properties: {
                        trackName: { type: 'string', description: 'Track name (genes, gc, variants, reads, proteins)' },
                        visible: { type: 'boolean', description: 'Whether to show or hide the track' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['trackName', 'visible']
                }
            }
        };
    }

    async executeClientTool(toolName, parameters, clientId) {
        return await this.server.executeToolOnClient(toolName, parameters, clientId);
    }
}

module.exports = NavigationTools; 