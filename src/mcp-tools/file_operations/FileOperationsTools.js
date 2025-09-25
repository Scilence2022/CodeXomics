/**
 * File Operations Tools for MCP Server
 * Handles loading and exporting various genomic file formats
 */

class FileOperationsTools {
    constructor(server) {
        this.server = server;
    }

    getTools() {
        return {
            // Load File Tools
            load_genome_file: {
                name: 'load_genome_file',
                description: 'Load genome files in FASTA or GenBank format directly by file path',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Absolute path to the genome file (FASTA or GenBank format)'
                        },
                        fileFormat: {
                            type: 'string',
                            description: 'Format of the genome file',
                            enum: ['auto', 'fasta', 'genbank'],
                            default: 'auto'
                        },
                        replaceCurrent: {
                            type: 'boolean',
                            description: 'Whether to replace currently loaded genome data',
                            default: true
                        },
                        validateFile: {
                            type: 'boolean',
                            description: 'Whether to validate file format before loading',
                            default: true
                        },
                        clientId: {
                            type: 'string',
                            description: 'Browser client ID for multi-window support',
                            default: 'default'
                        }
                    },
                    required: ['filePath']
                }
            },

            load_annotation_file: {
                name: 'load_annotation_file',
                description: 'Load annotation files in GFF or BED format directly by file path',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Absolute path to the annotation file (GFF or BED format)'
                        },
                        fileFormat: {
                            type: 'string',
                            description: 'Format of the annotation file',
                            enum: ['auto', 'gff', 'gff3', 'gtf', 'bed'],
                            default: 'auto'
                        },
                        mergeWithExisting: {
                            type: 'boolean',
                            description: 'Whether to merge with existing annotations or replace them',
                            default: false
                        },
                        chromosome: {
                            type: 'string',
                            description: 'Target chromosome for the annotations (optional)'
                        },
                        validateFeatures: {
                            type: 'boolean',
                            description: 'Whether to validate feature coordinates against genome',
                            default: true
                        },
                        clientId: {
                            type: 'string',
                            description: 'Browser client ID for multi-window support',
                            default: 'default'
                        }
                    },
                    required: ['filePath']
                }
            },

            load_variant_file: {
                name: 'load_variant_file',
                description: 'Load variant files in VCF format directly by file path',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Absolute path to the VCF file'
                        },
                        filterQuality: {
                            type: 'number',
                            description: 'Minimum quality score for variants (QUAL field)',
                            default: 0,
                            minimum: 0
                        },
                        filterDepth: {
                            type: 'number',
                            description: 'Minimum read depth for variants (DP field)',
                            default: 0,
                            minimum: 0
                        },
                        chromosome: {
                            type: 'string',
                            description: 'Load variants only for specific chromosome'
                        },
                        startPosition: {
                            type: 'number',
                            description: 'Start position for loading variants (1-based)',
                            minimum: 1
                        },
                        endPosition: {
                            type: 'number',
                            description: 'End position for loading variants (1-based)',
                            minimum: 1
                        },
                        showAsTrack: {
                            type: 'boolean',
                            description: 'Whether to display variants as a track in genome browser',
                            default: true
                        },
                        mergeWithExisting: {
                            type: 'boolean',
                            description: 'Whether to merge with existing variant data',
                            default: false
                        },
                        clientId: {
                            type: 'string',
                            description: 'Browser client ID for multi-window support',
                            default: 'default'
                        }
                    },
                    required: ['filePath']
                }
            },

            // Export File Tools
            export_fasta_sequence: {
                name: 'export_fasta_sequence',
                description: 'Export genome sequences in FASTA format to specified file path',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Absolute path where to save the FASTA file'
                        },
                        chromosome: {
                            type: 'string',
                            description: 'Specific chromosome to export (optional, exports all if not specified)'
                        },
                        startPosition: {
                            type: 'number',
                            description: 'Start position for sequence export (1-based, optional)',
                            minimum: 1
                        },
                        endPosition: {
                            type: 'number',
                            description: 'End position for sequence export (1-based, optional)',
                            minimum: 1
                        },
                        lineLength: {
                            type: 'number',
                            description: 'Number of characters per line in FASTA output',
                            default: 80,
                            minimum: 1,
                            maximum: 1000
                        },
                        includeDescription: {
                            type: 'boolean',
                            description: 'Whether to include sequence descriptions in headers',
                            default: true
                        },
                        upperCase: {
                            type: 'boolean',
                            description: 'Whether to output sequences in uppercase',
                            default: false
                        },
                        removeGaps: {
                            type: 'boolean',
                            description: 'Whether to remove gap characters (N, -, etc.)',
                            default: false
                        },
                        overwrite: {
                            type: 'boolean',
                            description: 'Whether to overwrite existing file',
                            default: false
                        },
                        clientId: {
                            type: 'string',
                            description: 'Browser client ID for multi-window support',
                            default: 'default'
                        }
                    },
                    required: ['filePath']
                }
            },

            export_genbank_format: {
                name: 'export_genbank_format',
                description: 'Export genome data in GenBank format to specified file path',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Absolute path where to save the GenBank file'
                        },
                        chromosome: {
                            type: 'string',
                            description: 'Specific chromosome to export (optional, exports all if not specified)'
                        },
                        startPosition: {
                            type: 'number',
                            description: 'Start position for export (1-based, optional)',
                            minimum: 1
                        },
                        endPosition: {
                            type: 'number',
                            description: 'End position for export (1-based, optional)',
                            minimum: 1
                        },
                        includeSequence: {
                            type: 'boolean',
                            description: 'Whether to include sequence data in GenBank file',
                            default: true
                        },
                        includeAnnotations: {
                            type: 'boolean',
                            description: 'Whether to include feature annotations',
                            default: true
                        },
                        organism: {
                            type: 'string',
                            description: 'Organism name for GenBank header'
                        },
                        overwrite: {
                            type: 'boolean',
                            description: 'Whether to overwrite existing file',
                            default: false
                        },
                        clientId: {
                            type: 'string',
                            description: 'Browser client ID for multi-window support',
                            default: 'default'
                        }
                    },
                    required: ['filePath']
                }
            }
        };
    }

    async executeTool(toolName, parameters, clientId = 'default') {
        console.log(`🗂️ Executing file operations tool: ${toolName}`);
        
        try {
            // All file operations tools are executed on the client side
            return await this.executeClientTool(toolName, parameters, clientId);
        } catch (error) {
            console.error(`❌ File operations tool execution failed: ${toolName}`, error);
            throw new Error(`File operations tool execution failed: ${error.message}`);
        }
    }

    async executeClientTool(toolName, parameters, clientId) {
        console.log(`🖥️ Executing client-side file operations tool: ${toolName}`, parameters);
        
        if (!this.server || typeof this.server.executeToolOnClient !== 'function') {
            throw new Error('Server instance not available or missing executeToolOnClient method');
        }
        
        return await this.server.executeToolOnClient(toolName, parameters, clientId);
    }

    getToolExamples(toolName) {
        const examples = {
            load_genome_file: {
                description: 'Load E. coli genome file',
                example: {
                    filePath: "/Users/song/Documents/Genome-AI-Studio-Projects/test_data/ECOLI.gbk",
                    fileFormat: "genbank",
                    replaceCurrent: true
                }
            },
            load_annotation_file: {
                description: 'Load GFF annotation file',
                example: {
                    filePath: "/data/annotations.gff",
                    fileFormat: "gff3",
                    mergeWithExisting: false
                }
            },
            load_variant_file: {
                description: 'Load VCF variant file',
                example: {
                    filePath: "/data/variants.vcf",
                    filterQuality: 30,
                    showAsTrack: true
                }
            },
            export_fasta_sequence: {
                description: 'Export genome as FASTA',
                example: {
                    filePath: "/output/genome.fasta",
                    lineLength: 80,
                    upperCase: false
                }
            },
            export_genbank_format: {
                description: 'Export genome as GenBank',
                example: {
                    filePath: "/output/genome.gb",
                    includeAnnotations: true,
                    organism: "Escherichia coli"
                }
            }
        };
        
        return examples[toolName] || { description: 'No examples available', example: {} };
    }
}

module.exports = FileOperationsTools;