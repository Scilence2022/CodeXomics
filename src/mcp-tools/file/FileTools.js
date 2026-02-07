/**
 * File Loading Tools Module
 * Handles loading genome files, variants, alignments, and tracks via MCP
 */

class FileTools {
    constructor(server) {
        this.server = server;
    }

    getTools() {
        return {
            load_genome_file: {
                name: 'load_genome_file',
                description: 'Load a genome file (GenBank, FASTA, EMBL) into the browser. Use showFileDialog=true to open file picker.',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Absolute path to genome file (.gbk, .gb, .fasta, .fa, .embl)'
                        },
                        showFileDialog: {
                            type: 'boolean',
                            description: 'Open file dialog instead of using filePath',
                            default: false
                        },
                        fileType: {
                            type: 'string',
                            description: 'File type hint (auto, genbank, fasta, embl)',
                            default: 'auto'
                        }
                    }
                }
            },

            load_annotation_file: {
                name: 'load_annotation_file',
                description: 'Load annotation file (GFF, GTF, BED) to add gene/feature annotations',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Absolute path to annotation file (.gff, .gff3, .gtf, .bed)'
                        },
                        showFileDialog: {
                            type: 'boolean',
                            description: 'Open file dialog instead of using filePath',
                            default: false
                        }
                    }
                }
            },

            load_variant_file: {
                name: 'load_variant_file',
                description: 'Load variant file (VCF) to display SNPs, indels, and other variants',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Absolute path to variant file (.vcf, .vcf.gz)'
                        },
                        showFileDialog: {
                            type: 'boolean',
                            description: 'Open file dialog instead of using filePath',
                            default: false
                        }
                    }
                }
            },

            load_reads_file: {
                name: 'load_reads_file',
                description: 'Load aligned reads file (BAM, SAM) to display read alignments',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Absolute path to reads file (.bam, .sam). BAM files should have .bai index.'
                        },
                        showFileDialog: {
                            type: 'boolean',
                            description: 'Open file dialog instead of using filePath',
                            default: false
                        }
                    }
                }
            },

            load_wig_tracks: {
                name: 'load_wig_tracks',
                description: 'Load WIG/BigWig track files for quantitative data visualization (coverage, expression)',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Absolute path to track file (.wig, .bw, .bigwig)'
                        },
                        filePaths: {
                            type: 'array',
                            items: { type: 'string' },
                            description: 'Array of paths to load multiple WIG files at once'
                        },
                        showFileDialog: {
                            type: 'boolean',
                            description: 'Open file dialog instead of using filePath',
                            default: false
                        }
                    }
                }
            },

            load_operon_file: {
                name: 'load_operon_file',
                description: 'Load operon annotation file to display operon structures',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Absolute path to operon file'
                        },
                        showFileDialog: {
                            type: 'boolean',
                            description: 'Open file dialog instead of using filePath',
                            default: false
                        }
                    }
                }
            }
        };
    }

    async executeClientTool(toolName, parameters, clientId) {
        return await this.server.executeToolOnClient(toolName, parameters, clientId);
    }
}

module.exports = FileTools;
