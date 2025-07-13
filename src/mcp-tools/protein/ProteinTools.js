/**
 * Protein Structure Tools Module
 * Handles protein structure retrieval, PDB searches, and AlphaFold integration
 */

const https = require('https');

class ProteinTools {
    constructor(server) {
        this.server = server;
    }

    getTools() {
        return {
            fetch_protein_structure: {
                name: 'fetch_protein_structure',
                description: 'Fetch protein 3D structure from PDB database by gene name or PDB ID',
                parameters: {
                    type: 'object',
                    properties: {
                        geneName: { type: 'string', description: 'Gene name to search for protein structure' },
                        pdbId: { type: 'string', description: 'Direct PDB ID (alternative to gene name)' },
                        organism: { type: 'string', description: 'Organism name for more specific search' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    }
                }
            },

            open_protein_viewer: {
                name: 'open_protein_viewer',
                description: 'Open 3D protein structure viewer in a separate window',
                parameters: {
                    type: 'object',
                    properties: {
                        pdbData: { type: 'string', description: 'PDB structure data' },
                        proteinName: { type: 'string', description: 'Protein name for display' },
                        pdbId: { type: 'string', description: 'PDB ID' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['pdbData', 'proteinName']
                }
            },

            search_protein_by_gene: {
                name: 'search_protein_by_gene',
                description: 'Search for protein structures associated with a gene',
                parameters: {
                    type: 'object',
                    properties: {
                        geneName: { type: 'string', description: 'Gene name to search' },
                        organism: { type: 'string', description: 'Organism name (optional)' },
                        maxResults: { type: 'number', description: 'Maximum number of results to return' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['geneName']
                }
            },

            search_alphafold_by_gene: {
                name: 'search_alphafold_by_gene',
                description: 'Search AlphaFold database for protein structures by gene name',
                parameters: {
                    type: 'object',
                    properties: {
                        geneName: { type: 'string', description: 'Gene name to search' },
                        organism: { type: 'string', description: 'Organism name (default: Homo sapiens)' },
                        maxResults: { type: 'number', description: 'Maximum number of results to return (default: 10)' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['geneName']
                }
            },

            fetch_alphafold_structure: {
                name: 'fetch_alphafold_structure',
                description: 'Fetch AlphaFold protein structure by UniProt ID',
                parameters: {
                    type: 'object',
                    properties: {
                        uniprotId: { type: 'string', description: 'UniProt ID (e.g., P53_HUMAN)' },
                        geneName: { type: 'string', description: 'Gene name for display purposes' },
                        format: { type: 'string', description: 'Structure format (pdb or cif)', default: 'pdb' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['uniprotId']
                }
            },

            search_alphafold_by_sequence: {
                name: 'search_alphafold_by_sequence',
                description: 'Search AlphaFold database by protein sequence using UniProt BLAST',
                parameters: {
                    type: 'object',
                    properties: {
                        sequence: { type: 'string', description: 'Protein sequence to search' },
                        evalue: { type: 'number', description: 'E-value threshold (default: 1e-10)' },
                        maxResults: { type: 'number', description: 'Maximum number of results to return (default: 10)' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['sequence']
                }
            },

            open_alphafold_viewer: {
                name: 'open_alphafold_viewer',
                description: 'Open AlphaFold 3D structure viewer with enhanced features',
                parameters: {
                    type: 'object',
                    properties: {
                        structureData: { type: 'string', description: 'PDB/CIF structure data' },
                        uniprotId: { type: 'string', description: 'UniProt ID' },
                        geneName: { type: 'string', description: 'Gene name for display' },
                        confidenceData: { type: 'string', description: 'AlphaFold confidence scores (PAE data)' },
                        organism: { type: 'string', description: 'Source organism' },
                        clientId: { type: 'string', description: 'Browser client ID' }
                    },
                    required: ['structureData', 'uniprotId']
                }
            }
        };
    }

    async fetchProteinStructure(parameters) {
        return await this.server.fetchProteinStructure(parameters);
    }

    async searchProteinByGene(parameters) {
        return await this.server.searchProteinByGene(parameters);
    }

    async searchAlphaFoldByGene(parameters) {
        return await this.server.searchAlphaFoldByGene(parameters);
    }

    async fetchAlphaFoldStructure(parameters) {
        return await this.server.fetchAlphaFoldStructure(parameters);
    }

    async searchAlphaFoldBySequence(parameters) {
        return await this.server.searchAlphaFoldBySequence(parameters);
    }

    async openAlphaFoldViewer(parameters, clientId) {
        return await this.server.openAlphaFoldViewer(parameters, clientId);
    }

    async executeClientTool(toolName, parameters, clientId) {
        return await this.server.executeToolOnClient(toolName, parameters, clientId);
    }

    async getPDBDetails(pdbId) {
        return await this.server.getPDBDetails(pdbId);
    }

    async downloadPDBFile(pdbId) {
        return await this.server.downloadPDBFile(pdbId);
    }

    async searchUniProtByGene(geneName, organism, maxResults) {
        return await this.server.searchUniProtByGene(geneName, organism, maxResults);
    }

    async checkAlphaFoldStructureExists(uniprotId) {
        return await this.server.checkAlphaFoldStructureExists(uniprotId);
    }

    async runUniProtBLAST(sequence, evalue, maxResults) {
        return await this.server.runUniProtBLAST(sequence, evalue, maxResults);
    }

    makeHTTPSRequest(options, postData = null) {
        return this.server.makeHTTPSRequest(options, postData);
    }
}

module.exports = ProteinTools; 