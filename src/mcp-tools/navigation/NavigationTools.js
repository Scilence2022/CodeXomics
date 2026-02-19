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

            switch_to_tab: {
                name: 'switch_to_tab',
                description: 'Switch to a specific tab by ID, name, or index. Use this to navigate between different analysis tabs.',
                parameters: {
                    type: 'object',
                    properties: {
                        tab_id: { type: 'string', description: 'Specific tab ID to switch to (e.g. "tab1", "tab2")' },
                        tab_name: { type: 'string', description: 'Tab name/title to search for and switch to' },
                        tab_index: { type: 'number', description: 'Tab index (0-based) to switch to', minimum: 0 },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    anyOf: [
                        { required: ['tab_id'] },
                        { required: ['tab_name'] },
                        { required: ['tab_index'] }
                    ]
                }
            },

            close_tab: {
                name: 'close_tab',
                description: 'Close a specific tab by ID, name, or index. Cannot close the last remaining tab.',
                parameters: {
                    type: 'object',
                    properties: {
                        tab_id: { type: 'string', description: 'Specific tab ID to close (e.g. "tab1", "tab2")' },
                        tab_name: { type: 'string', description: 'Tab name/title to search for and close' },
                        tab_index: { type: 'number', description: 'Tab index (0-based) to close', minimum: 0 },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    anyOf: [
                        { required: ['tab_id'] },
                        { required: ['tab_name'] },
                        { required: ['tab_index'] }
                    ]
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
                description: 'Get current state of the CodeXomics',
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
                        trackName: { type: 'string', description: 'Track name (genes, gc, variants, reads, proteins, sequence, actions)' },
                        track_name: { type: 'string', description: 'Track name (alternative to trackName) (genes, gc, variants, reads, proteins, sequence, actions)' },
                        visible: { type: 'boolean', description: 'Whether to show or hide the track' },
                        action: { type: 'string', description: 'Action to perform (show or hide)', enum: ['show', 'hide'] },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    anyOf: [
                        { required: ['trackName', 'visible'] },
                        { required: ['track_name', 'visible'] },
                        { required: ['trackName', 'action'] },
                        { required: ['track_name', 'action'] }
                    ]
                }
            },

            zoom_in: {
                name: 'zoom_in',
                description: 'Zoom in the current genome view by a specified factor to see more sequence detail.',
                parameters: {
                    type: 'object',
                    properties: {
                        factor: { type: 'number', description: 'Zoom factor to apply (default 2x, range 1.1–10)', default: 2, minimum: 1.1, maximum: 10 },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: []
                }
            },

            zoom_out: {
                name: 'zoom_out',
                description: 'Zoom out the current genome view by a specified factor to see broader genomic context.',
                parameters: {
                    type: 'object',
                    properties: {
                        factor: { type: 'number', description: 'Zoom factor to apply (default 2x, range 1.1–10)', default: 2, minimum: 1.1, maximum: 10 },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: []
                }
            },

            pan_left: {
                name: 'pan_left',
                description: 'Pan the genome view to the left (towards earlier positions).',
                parameters: {
                    type: 'object',
                    properties: {
                        amount: { type: 'number', description: 'Number of base pairs to pan left (default: 10% of current view width)' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: []
                }
            },

            pan_right: {
                name: 'pan_right',
                description: 'Pan the genome view to the right (towards later positions).',
                parameters: {
                    type: 'object',
                    properties: {
                        amount: { type: 'number', description: 'Number of base pairs to pan right (default: 10% of current view width)' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: []
                }
            }
        };
    }

    async executeClientTool(toolName, parameters, clientId) {
        return await this.server.executeToolOnClient(toolName, parameters, clientId);
    }
}

module.exports = NavigationTools; 