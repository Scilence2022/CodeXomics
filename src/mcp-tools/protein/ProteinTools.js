/**
 * Protein Structure Tools Module
 * Handles protein structure retrieval, PDB searches, and AlphaFold integration
 */

require('https');

class ProteinTools {
  constructor(server) {
    this.server = server;
  }

  getTools() {
    return {
      fetch_protein_structure: {
        name: 'fetch_protein_structure',
        description:
          'Fetch a structure by PDB ID or UniProt accession. Search by gene with search_pdb_structures first.',
        parameters: {
          type: 'object',
          properties: {
            uniprot_id: { type: 'string', description: 'Alternative spelling of uniprotId.' },
            include_ligands: {
              type: 'boolean',
              description: 'PDB downloads include all deposited ligands. Only true is supported.',
              enum: [true],
              default: true,
            },
            geneName: { type: 'string', description: 'Optional gene label for a UniProt accession.' },
            pdbId: { type: 'string', description: 'Direct PDB ID (alternative to gene name)' },
            clientId: { type: 'string', description: 'Browser client ID' },
            pdb_id: {
              type: 'string',
              description: "PDB ID for the structure (e.g., '1TUP', '2BEG', '4HHB')",
              pattern: '^[0-9][A-Za-z0-9]{3}$',
            },
            uniprotId: { type: 'string', description: 'UniProt accession for an AlphaFold model.' },
          },
          anyOf: [
            { required: ['uniprot_id'] },
            { required: ['pdb_id'] },
            { required: ['pdbId'] },
            { required: ['uniprotId'] },
          ],
        },
      },

      open_protein_viewer: {
        name: 'open_protein_viewer',
        description:
          'Open a 3D protein structure viewer from cached data, a local PDB file, an online URL, a UniProt/AlphaFold accession, a PDB ID, or a gene name',
        parameters: {
          type: 'object',
          properties: {
            _dataRef: {
              type: 'string',
              description: 'Cache reference as returned by fetch_protein_structure or fetch_alphafold_structure.',
            },
            pdbData: { type: 'string', description: 'Inline PDB structure data for internal calls' },
            proteinName: { type: 'string', description: 'Optional protein name for display' },
            pdbId: { type: 'string', description: 'RCSB PDB ID, UniProt accession, or AlphaFold model ID' },
            pdb_id: { type: 'string', description: 'Snake-case alias for pdbId' },
            uniprotId: { type: 'string', description: 'UniProt accession for AlphaFold download' },
            uniprot_id: { type: 'string', description: 'Snake-case alias for uniprotId' },
            geneName: { type: 'string', description: 'Gene name to resolve through UniProt/AlphaFold' },
            organism: { type: 'string', description: 'Organism used for gene-name resolution' },
            filePath: { type: 'string', description: 'Absolute local PDB file path' },
            file_path: { type: 'string', description: 'Snake-case alias for filePath' },
            structureUrl: { type: 'string', description: 'HTTP(S) PDB URL to download and open' },
            structure_url: { type: 'string', description: 'Snake-case alias for structureUrl' },
            dataRef: { type: 'string', description: 'Cached data reference returned by a structure fetch tool' },
            data_ref: { type: 'string', description: 'Snake-case alias for dataRef' },
            representation: { type: 'string', description: 'cartoon, surface, stick, ball_stick, or ribbon' },
            color_scheme: { type: 'string', description: 'chain, secondary, atom, residue, or temperature' },
            show_ligands: { type: 'boolean', description: 'Show ligands and cofactors' },
            show_waters: { type: 'boolean', description: 'Show water molecules' },
            center_on_ligand: { type: 'boolean', description: 'Center the initial view on the largest ligand' },
            clientId: { type: 'string', description: 'Browser client ID' },
            protein_name: { type: 'string', description: 'Optional display name for the structure' },
            viewer_type: {
              type: 'string',
              enum: ['ngl', 'default'],
              description: 'Molecular viewer to use',
              default: 'default',
            },
          },
          required: [],
        },
      },

      search_pdb_structures: {
        name: 'search_pdb_structures',
        description: 'Search PDB database for experimental protein structures by gene name',
        parameters: {
          type: 'object',
          properties: {
            geneName: { type: 'string', description: 'Gene name to search for experimental structures' },
            organism: { type: 'string', description: 'Organism name (optional)' },
            maxResults: { type: 'number', description: 'Maximum number of results to return' },
            clientId: { type: 'string', description: 'Browser client ID' },
            max_results: {
              type: 'number',
              description: 'Maximum number of structures to return',
              minimum: 1,
              maximum: 50,
              default: 10,
            },
          },
          required: ['geneName'],
        },
      },

      search_alphafold_structures: {
        name: 'search_alphafold_structures',
        description: 'Search AlphaFold database for protein structures by gene name',
        parameters: {
          type: 'object',
          properties: {
            geneName: { type: 'string', description: 'Gene name to search' },
            organism: { type: 'string', description: 'Organism name (default: Escherichia coli)' },
            maxResults: { type: 'number', description: 'Maximum number of results to return (default: 10)' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['geneName'],
        },
      },

      fetch_alphafold_structure: {
        name: 'fetch_alphafold_structure',
        description: 'Fetch AlphaFold protein structure by UniProt ID',
        parameters: {
          type: 'object',
          properties: {
            gene: { type: 'string', description: 'Alternative spelling of geneName.' },
            gene_name: { type: 'string', description: 'Alternative spelling of geneName.' },
            uniprotId: { type: 'string', description: 'UniProt accession (e.g., P04637)' },
            uniprot_id: { type: 'string', description: 'Snake-case alias for uniprotId (e.g., P04637)' },
            geneName: { type: 'string', description: 'Gene name to resolve to a UniProt accession' },
            format: { type: 'string', description: 'Structure format (pdb or cif)', default: 'pdb' },
            include_confidence: {
              type: 'boolean',
              description: 'Return summary and per-residue pLDDT confidence scores',
              default: true,
            },
            clientId: { type: 'string', description: 'Browser client ID' },
            organism: {
              type: 'string',
              description: 'Organism name for gene name resolution',
              default: 'Homo sapiens',
            },
            cache_locally: {
              type: 'boolean',
              description: 'Cache structure file locally for faster access',
              default: true,
            },
          },
          required: [],
          anyOf: [
            { required: ['gene'] },
            { required: ['gene_name'] },
            { required: ['uniprot_id'] },
            { required: ['uniprotId'] },
            { required: ['geneName'] },
          ],
        },
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
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['sequence'],
        },
      },

      render_protein_structure_results: {
        name: 'render_protein_structure_results',
        description: 'Render protein search results (PDB or AlphaFold) in a visualization panel in the sidebar',
        parameters: {
          type: 'object',
          properties: {
            results: { type: 'array', description: 'Array of search results to display' },
            searchType: { type: 'string', description: 'Type of search (PDB or AlphaFold)' },
            geneName: { type: 'string', description: 'Gene name that was searched for' },
            clientId: { type: 'string', description: 'Browser client ID' },
          },
          required: ['results', 'searchType', 'geneName'],
        },
      },
    };
  }

  async fetchProteinStructure(parameters) {
    return await this.server.fetchProteinStructure(parameters);
  }

  async searchPDBStructures(parameters) {
    return await this.server.searchPDBStructures(parameters);
  }

  async searchAlphaFoldStructures(parameters) {
    return await this.server.executeToolOnClient('search_alphafold_structures', parameters, parameters.clientId);
  }

  async searchAlphaFoldByGene(parameters) {
    return await this.searchAlphaFoldStructures(parameters);
  }

  async fetchAlphaFoldStructure(parameters) {
    return await this.server.fetchAlphaFoldStructure(parameters);
  }

  async searchAlphaFoldBySequence(parameters) {
    return await this.server.searchAlphaFoldBySequence(parameters);
  }

  async renderProteinStructureResults(parameters, clientId) {
    return await this.server.renderProteinStructureResults(parameters, clientId);
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
