/**
 * Annotation Tools Module
 * Provides full CRUD operations for genome annotations via MCP.
 * Designed for both interactive (ChatBox) and programmatic (AI agent) access.
 *
 * All tools delegate to the browser client where genome data lives in memory,
 * following the same pattern as NavigationTools, DataTools, etc.
 */

class AnnotationTools {
    constructor(server) {
        this.server = server;
    }

    getTools() {
        return {
            list_annotations: {
                name: 'list_annotations',
                description:
                    'List genome annotations in a specified region or chromosome. Supports filtering by feature type (CDS, gene, rRNA, tRNA, etc.). Returns annotation details including locus_tag, gene name, product, position, and strand.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        chromosome: {
                            type: 'string',
                            description:
                                'Chromosome/replicon name to list annotations from. If omitted, uses the currently selected chromosome.',
                        },
                        start: {
                            type: 'number',
                            description: 'Start position to filter annotations (optional). If omitted, lists from the beginning.',
                        },
                        end: {
                            type: 'number',
                            description: 'End position to filter annotations (optional). If omitted, lists to the end.',
                        },
                        type: {
                            type: 'string',
                            description:
                                'Feature type filter (e.g., "CDS", "gene", "rRNA", "tRNA", "misc_feature"). If omitted, returns all types.',
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum number of annotations to return (default: 100). Use 0 for no limit.',
                            default: 100,
                        },
                        offset: {
                            type: 'number',
                            description: 'Number of annotations to skip for pagination (default: 0).',
                            default: 0,
                        },
                        clientId: {
                            type: 'string',
                            description: 'Browser client ID for multi-window support',
                        },
                    },
                    required: [],
                },
            },

            get_annotation: {
                name: 'get_annotation',
                description:
                    'Get detailed information about a specific annotation by its locus_tag, gene name, or feature index. Returns all qualifier fields including product, note, db_xref, EC_number, GO terms, etc.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        identifier: {
                            type: 'string',
                            description:
                                'The locus_tag, gene name, or protein_id of the annotation to retrieve.',
                        },
                        chromosome: {
                            type: 'string',
                            description: 'Chromosome name (optional, searches all if omitted).',
                        },
                        full_details: {
                            type: 'boolean',
                            description: 'If true, returns the complete raw annotation object. Defaults to false.',
                            default: false,
                        },
                        clientId: {
                            type: 'string',
                            description: 'Browser client ID for multi-window support',
                        },
                    },
                    required: ['identifier'],
                },
            },

            update_annotation: {
                name: 'update_annotation',
                description:
                    'Update fields of an existing genome annotation. Can modify product name, gene name, note, db_xref, EC_number, and other qualifier fields. Changes are tracked with agent identity and timestamps for audit purposes.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        identifier: {
                            type: 'string',
                            description:
                                'The locus_tag, gene name, or protein_id identifying the annotation to update.',
                        },
                        chromosome: {
                            type: 'string',
                            description: 'Chromosome name (optional, searches all if omitted).',
                        },
                        updates: {
                            type: 'object',
                            description:
                                'Object of fields to update. Keys are qualifier names (e.g., "product", "gene", "note", "EC_number", "db_xref"), values are the new values. Example: {"product": "ATP synthase subunit alpha", "EC_number": "3.6.3.14"}',
                        },
                        agent: {
                            type: 'string',
                            description:
                                'Identity of the agent making this change (e.g., "openclaw/genome-annotator", "user"). Used for change tracking.',
                            default: 'mcp-agent',
                        },
                        evidence: {
                            type: 'array',
                            description:
                                'Optional list of evidence references supporting this change (e.g., ["UniProt:P0ABB4", "PMID:12345678"]).',
                            items: { type: 'string' },
                        },
                        clientId: {
                            type: 'string',
                            description: 'Browser client ID for multi-window support',
                        },
                    },
                    required: ['identifier', 'updates'],
                },
            },

            delete_annotation: {
                name: 'delete_annotation',
                description:
                    'Delete a genome annotation by its locus_tag, gene name, or feature index. The deletion is tracked in the change history for audit purposes.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        identifier: {
                            type: 'string',
                            description:
                                'The locus_tag, gene name, or protein_id of the annotation to delete.',
                        },
                        chromosome: {
                            type: 'string',
                            description: 'Chromosome name (optional, searches all if omitted).',
                        },
                        agent: {
                            type: 'string',
                            description: 'Identity of the agent making this deletion.',
                            default: 'mcp-agent',
                        },
                        clientId: {
                            type: 'string',
                            description: 'Browser client ID for multi-window support',
                        },
                    },
                    required: ['identifier'],
                },
            },

            search_annotations: {
                name: 'search_annotations',
                description:
                    'Full-text search across all annotation fields (product, gene, note, locus_tag, db_xref, etc.). Useful for finding hypothetical proteins, specific enzymes, or annotations with particular keywords.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        query: {
                            type: 'string',
                            description:
                                'Search query string. Searches across product, gene, note, locus_tag, and other qualifier fields. Case-insensitive.',
                        },
                        chromosome: {
                            type: 'string',
                            description: 'Limit search to a specific chromosome (optional).',
                        },
                        type: {
                            type: 'string',
                            description: 'Filter by feature type (e.g., "CDS"). Optional.',
                        },
                        fields: {
                            type: 'array',
                            description:
                                'Specific qualifier fields to search in (e.g., ["product", "note"]). If omitted, searches all fields.',
                            items: { type: 'string' },
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum number of results to return (default: 50).',
                            default: 50,
                        },
                        clientId: {
                            type: 'string',
                            description: 'Browser client ID for multi-window support',
                        },
                    },
                    required: ['query'],
                },
            },

            bulk_update_annotations: {
                name: 'bulk_update_annotations',
                description:
                    'Update multiple annotations in a single operation. Each update specifies an identifier and the fields to change. All changes are tracked. Useful for batch operations like renaming hypothetical proteins or adding cross-references.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        updates: {
                            type: 'array',
                            description:
                                'Array of update objects. Each object must have "identifier" (locus_tag or gene name) and "updates" (object of field:value pairs). Example: [{"identifier": "gene1", "updates": {"product": "new name"}}, {"identifier": "gene2", "updates": {"note": "updated"}}]',
                            items: {
                                type: 'object',
                                properties: {
                                    identifier: {
                                        type: 'string',
                                        description: 'The locus_tag or gene name of the annotation to update.',
                                    },
                                    chromosome: {
                                        type: 'string',
                                        description: 'Chromosome name (optional).',
                                    },
                                    updates: {
                                        type: 'object',
                                        description: 'Object of fields to update.',
                                    },
                                },
                                required: ['identifier', 'updates'],
                            },
                        },
                        agent: {
                            type: 'string',
                            description: 'Identity of the agent making these changes.',
                            default: 'mcp-agent',
                        },
                        evidence: {
                            type: 'array',
                            description: 'Optional evidence references for all updates in this batch.',
                            items: { type: 'string' },
                        },
                        clientId: {
                            type: 'string',
                            description: 'Browser client ID for multi-window support',
                        },
                    },
                    required: ['updates'],
                },
            },

            get_annotation_history: {
                name: 'get_annotation_history',
                description:
                    'Retrieve the change history for a specific annotation or the entire genome. Returns all tracked modifications with timestamps, old/new values, and agent identity. Useful for auditing changes made by AI agents.',
                inputSchema: {
                    type: 'object',
                    properties: {
                        identifier: {
                            type: 'string',
                            description:
                                'The locus_tag or gene name to get history for. If omitted, returns history for all annotations.',
                        },
                        limit: {
                            type: 'number',
                            description: 'Maximum number of history records to return (default: 50).',
                            default: 50,
                        },
                        clientId: {
                            type: 'string',
                            description: 'Browser client ID for multi-window support',
                        },
                    },
                    required: [],
                },
            },
        };
    }

    /**
     * All annotation tools delegate to the browser client because genome
     * annotation data lives in-memory on the renderer side (GenomeDataProxy).
     */
    async executeClientTool(toolName, parameters, clientId) {
        return await this.server.executeToolOnClient(toolName, parameters, clientId);
    }
}

module.exports = AnnotationTools;
