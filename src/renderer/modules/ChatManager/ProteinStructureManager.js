/**
 * ProteinStructureManager - Handles PDB/AlphaFold protein structure integration
 */

class ProteinStructureManager {
  constructor(chatManager) {
    this.chatManager = chatManager;
    this.app = chatManager.app;
  }

  async openProteinViewer(params) {
    const { gene_name, uniprot_id, pdb_id } = params;

    if (!gene_name && !uniprot_id && !pdb_id) {
      throw new Error('Gene name, UniProt ID, or PDB ID is required');
    }

    // Open protein viewer with specified parameters
    return {
      success: true,
      message: `Opening protein viewer for ${gene_name || uniprot_id || pdb_id}`
    };
  }

  async fetchProteinStructure(parameters) {
    const { pdb_id, uniprot_id } = parameters;

    if (pdb_id) {
      return this.fetchPDBStructure(pdb_id);
    } else if (uniprot_id) {
      return this.fetchAlphaFoldStructure({ uniprot_id });
    } else {
      throw new Error('PDB ID or UniProt ID is required');
    }
  }

  async fetchPDBStructure(pdbId) {
    try {
      const response = await fetch(`https://files.rcsb.org/download/${pdbId.toUpperCase()}.pdb`);
      
      if (!response.ok) {
        throw new Error(`Failed to fetch PDB structure: ${response.statusText}`);
      }

      const pdbData = await response.text();

      return {
        success: true,
        pdbId: pdbId.toUpperCase(),
        format: 'pdb',
        data: pdbData,
        source: 'RCSB PDB'
      };
    } catch (error) {
      throw new Error(`Error fetching PDB structure: ${error.message}`);
    }
  }

  async searchPDBStructures(parameters) {
    const { gene_name, organism = 'Escherichia coli', max_results = 10 } = parameters;

    if (!gene_name) {
      throw new Error('Gene name is required');
    }

    try {
      // Search PDB using RCSB Search API
      const searchUrl = `https://search.rcsb.org/rcsbsearch/v2/query?json=${encodeURIComponent(JSON.stringify({
        query: {
          type: 'group',
          logical_operator: 'and',
          nodes: [
            {
              type: 'terminal',
              service: 'text',
              parameters: {
                attribute: 'rcsb_entity_source_organism.taxonomy_lineage.name',
                operator: 'contains_phrase',
                value: organism
              }
            },
            {
              type: 'terminal',
              service: 'text',
              parameters: {
                attribute: 'struct.title',
                operator: 'contains_words',
                value: gene_name
              }
            }
          ]
        },
        return_type: 'entry',
        request_options: {
          paginate: {
            start: 0,
            rows: max_results
          }
        }
      }))}`;

      const response = await fetch(searchUrl);
      const data = await response.json();

      const results = (data.result_set || []).map(entry => ({
        pdbId: entry.identifier,
        title: entry.title || 'Unknown',
        resolution: entry.resolution || 'N/A',
        method: entry.experimental_method || 'Unknown'
      }));

      return {
        success: true,
        query: gene_name,
        organism: organism,
        count: results.length,
        results: results
      };
    } catch (error) {
      throw new Error(`Error searching PDB: ${error.message}`);
    }
  }

  async searchAlphaFoldByGene(parameters) {
    const { gene_name, organism = 'Escherichia coli', max_results = 10 } = parameters;

    if (!gene_name) {
      throw new Error('Gene name is required');
    }

    // First search UniProt for the gene
    const uniprotResults = await this.searchUniProt(gene_name, organism, max_results);

    // Then check AlphaFold DB for each UniProt entry
    const alphaFoldResults = [];
    for (const entry of uniprotResults) {
      const hasStructure = await this.checkAlphaFoldAvailability(entry.uniprotId);
      if (hasStructure) {
        alphaFoldResults.push({
          uniprotId: entry.uniprotId,
          geneName: entry.geneName,
          proteinName: entry.proteinName,
          organism: entry.organism,
          confidence: hasStructure.confidence,
          modelUrl: `https://alphafold.ebi.ac.uk/files/AF-${entry.uniprotId}-F1-model_v4.pdb`
        });
      }
    }

    return {
      success: true,
      query: gene_name,
      organism: organism,
      count: alphaFoldResults.length,
      results: alphaFoldResults
    };
  }

  async fetchAlphaFoldStructure(parameters) {
    const { uniprot_id } = parameters;

    if (!uniprot_id) {
      throw new Error('UniProt ID is required');
    }

    const url = `https://alphafold.ebi.ac.uk/files/AF-${uniprot_id.toUpperCase()}-F1-model_v4.pdb`;

    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`AlphaFold structure not found for ${uniprot_id}`);
      }

      const pdbData = await response.text();

      return {
        success: true,
        uniprotId: uniprot_id.toUpperCase(),
        format: 'pdb',
        data: pdbData,
        source: 'AlphaFold DB'
      };
    } catch (error) {
      throw new Error(`Error fetching AlphaFold structure: ${error.message}`);
    }
  }

  async searchUniProt(geneName, organism, maxResults) {
    const query = `gene:${geneName} AND organism:"${organism}"`;
    const url = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(query)}&format=json&size=${maxResults}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      return (data.results || []).map(entry => ({
        uniprotId: entry.primaryAccession,
        geneName: entry.genes?.[0]?.geneName?.value || geneName,
        proteinName: entry.proteinDescription?.recommendedName?.fullName?.value || 'Unknown',
        organism: entry.organisms?.[0]?.scientificName || organism
      }));
    } catch (error) {
      console.error('UniProt search error:', error);
      return [];
    }
  }

  async checkAlphaFoldAvailability(uniprotId) {
    try {
      // Check if AlphaFold structure exists by fetching metadata
      const url = `https://alphafold.ebi.ac.uk/api/prediction/${uniprotId.toUpperCase()}`;
      const response = await fetch(url);
      
      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      return {
        available: true,
        confidence: data[0]?.confidence || 'unknown'
      };
    } catch (error) {
      return null;
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProteinStructureManager;
}
