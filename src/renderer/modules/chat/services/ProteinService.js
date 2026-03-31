/**
 * ProteinService - Handles protein structure fetching and viewing extracted from ChatManager
 */
class ProteinService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
    
    // Internal cache for protein structures
    this.structureCache = new Map();
  }

  // 1. PDB OPERATIONS
  async fetchProteinStructure(parameters) {
    const pdbId = parameters.pdbId || parameters.pdb_id;
    if (!pdbId) {
      throw new Error('PDB ID is required');
    }

    try {
      if (this.app.proteinStructureViewer) {
        await this.app.proteinStructureViewer.loadPDB(pdbId);
        return {
          success: true,
          message: `Protein structure ${pdbId} loaded successfully`,
          pdbId,
        };
      }

      // Check if window object has the required viewer
      if (window.viewer) {
        try {
          // If structure is already loaded, clear it
          window.viewer.removeAllComponents();
          
          await window.viewer.loadFile(`rcsb://${pdbId}.mmtf`, { defaultRepresentation: true });
          
          return {
            success: true,
            message: `Loaded structure ${pdbId}`,
            pdbId,
            viewer: 'NGL'
          };
        } catch (nglError) {
          console.error('[ProteinService] NGL viewer error:', nglError);
        }
      }

      throw new Error('Protein Structure Viewer is not properly initialized.');
    } catch (error) {
      console.error(`[ProteinService] Error loading PDB ${pdbId}:`, error);
      throw error;
    }
  }

  async searchPDBStructures(parameters) {
    const geneName = parameters.geneName || parameters.gene_name || parameters.name;
    const organism = parameters.organism || parameters.species || 'E. coli';
    const limit = parameters.limit || parameters.maxResults || 10;

    if (!geneName) {
      throw new Error('Gene name is required for PDB search');
    }

    try {
      console.log(`[ProteinService] Searching PDB for ${geneName} in ${organism}`);
      // Send message to LLM to search for PDB IDs, or perform an API call to RCSB PDB
      // For now, return a placeholder that the LLM can interpret
      
      const searchData = {
        query: {
          type: "group",
          logical_operator: "and",
          nodes: [
            {
              type: "terminal",
              service: "text",
              parameters: {
                attribute: "rcsb_entity_source_organism.taxonomy_lineage.name",
                operator: "contains_words",
                value: organism
              }
            },
            {
              type: "terminal",
              service: "text",
              parameters: {
                attribute: "struct.title",
                operator: "contains_words",
                value: geneName
              }
            }
          ]
        },
        request_options: {
          paginate: {
            start: 0,
            rows: limit
          },
          return_all_hits: true
        },
        return_type: "entry"
      };

      const response = await fetch('https://search.rcsb.org/rcsbsearch/v2/query', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchData)
      });

      if (!response.ok) {
        throw new Error(`RCSB API returned ${response.status}`);
      }

      const data = await response.json();
      
      const results = (data.result_set || []).map(r => ({
        pdbId: r.identifier,
        score: r.score
      }));

      // In the real system, this would call processPDBResults and display in sidebar
      if (results.length > 0 && typeof this.chatManager.displayPDBResultsInSidebar === 'function') {
        setTimeout(() => this.chatManager.displayPDBResultsInSidebar(results, geneName), 100);
      }

      return {
        success: true,
        query: geneName,
        organism,
        count: results.length,
        results
      };
    } catch (error) {
      console.error(`[ProteinService] Error searching PDB for ${geneName}:`, error);
      throw error;
    }
  }

  async getPDBDetails(pdbId) {
    if (!pdbId) {
      throw new Error('PDB ID is required');
    }

    try {
      const response = await fetch(`https://data.rcsb.org/rest/v1/core/entry/${pdbId}`);
      
      if (!response.ok) {
        throw new Error(`PDB entry ${pdbId} not found`);
      }

      const data = await response.json();
      
      return {
        success: true,
        pdbId,
        title: data.struct?.title || 'Unknown',
        organism: data.rcsb_entity_source_organism?.[0]?.ncbi_scientific_name || 'Unknown',
        resolution: data.exptl?.[0]?.resolution || 'Unknown',
        method: data.exptl?.[0]?.method || 'Unknown',
        date: data.rcsb_accession_info?.initial_release_date || 'Unknown'
      };
    } catch (error) {
      console.error(`[ProteinService] Error getting PDB details for ${pdbId}:`, error);
      throw error;
    }
  }

  // 2. ALPHAFOLD OPERATIONS
  async searchAlphaFoldByGene(parameters) {
    const geneName = parameters.geneName || parameters.gene_name || parameters.name;
    const organism = parameters.organism || parameters.species || 'Escherichia coli';
    
    if (!geneName) {
      throw new Error('Gene name is required for AlphaFold search');
    }

    try {
      console.log(`[ProteinService] Searching AlphaFold for ${geneName} in ${organism}`);
      
      // Attempt UniProt search first
      const uniprotResults = await this.searchUniProtDatabase({
        query: `${geneName} AND organism:"${organism}"`,
        limit: 5
      });

      if (!uniprotResults.success || !uniprotResults.results || uniprotResults.results.length === 0) {
        return {
          success: false,
          message: `No UniProt entries found for ${geneName} in ${organism}. AlphaFold requires a UniProt ID.`
        };
      }

      const topResult = uniprotResults.results[0];
      const uniprotId = topResult.id;

      // Check AlphaFold availability
      const isAvailable = await this.checkAlphaFoldAvailability(uniprotId);

      if (isAvailable) {
        return {
          success: true,
          geneName,
          uniprotId,
          proteinName: topResult.proteinName,
          message: `AlphaFold structure available for ${uniprotId} (${geneName}). Use fetch_alphafold_structure to view it.`
        };
      } else {
        return {
          success: false,
          geneName,
          uniprotId,
          message: `No AlphaFold structure available for UniProt ID ${uniprotId}`
        };
      }
    } catch (error) {
      console.error(`[ProteinService] Error searching AlphaFold for ${geneName}:`, error);
      throw error;
    }
  }

  async fetchAlphaFoldStructure(parameters) {
    const uniprotId = parameters.uniprotId || parameters.uniprot_id;
    
    if (!uniprotId) {
      throw new Error('UniProt ID is required to fetch AlphaFold structure');
    }

    try {
      const isAvailable = await this.checkAlphaFoldAvailability(uniprotId);
      
      if (!isAvailable) {
        throw new Error(`AlphaFold structure not found for ${uniprotId}`);
      }

      if (this.app.proteinStructureViewer) {
        await this.app.proteinStructureViewer.loadAlphaFold(uniprotId);
        return {
          success: true,
          message: `AlphaFold structure ${uniprotId} loaded successfully`,
          uniprotId
        };
      }

      // Fallback NGL logic
      if (window.viewer) {
        try {
          window.viewer.removeAllComponents();
          
          // Construct AlphaFold URL
          const url = `https://alphafold.ebi.ac.uk/files/AF-${uniprotId}-F1-model_v4.pdb`;
          
          await window.viewer.loadFile(url, { defaultRepresentation: true });
          
          return {
            success: true,
            message: `Loaded AlphaFold structure ${uniprotId}`,
            uniprotId,
            source: 'AlphaFold DB'
          };
        } catch (nglError) {
          console.error('[ProteinService] NGL viewer error with AlphaFold:', nglError);
        }
      }

      throw new Error('Protein Structure Viewer is not properly initialized.');
    } catch (error) {
      console.error(`[ProteinService] Error loading AlphaFold ${uniprotId}:`, error);
      throw error;
    }
  }

  async checkAlphaFoldAvailability(uniprotId) {
    try {
      // Fast HEAD request to check if file exists without downloading
      const url = `https://alphafold.ebi.ac.uk/files/AF-${uniprotId}-F1-model_v4.pdb`;
      const response = await fetch(url, { method: 'HEAD' });
      return response.ok;
    } catch (error) {
      console.warn(`[ProteinService] AlphaFold check failed for ${uniprotId}:`, error);
      return false;
    }
  }

  async openAlphaFoldViewer(parameters) {
    // Alias to fetchAlphaFoldStructure for backwards compatibility
    return this.fetchAlphaFoldStructure(parameters);
  }

  // 3. UNIPROT / INTERPRO OPERATIONS
  async searchUniProtDatabase(parameters) {
    const query = parameters.query || parameters.queryString;
    const limit = parameters.limit || parameters.maxResults || 10;
    
    if (!query) {
      throw new Error('Query is required for UniProt search');
    }

    try {
      const url = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(query)}&size=${limit}&fields=accession,id,protein_name,gene_names,organism_name,length`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        throw new Error(`UniProt API returned ${response.status}`);
      }
      
      const data = await response.json();
      
      const results = (data.results || []).map(entry => ({
        id: entry.primaryAccession,
        entryName: entry.uniProtkbId,
        proteinName: entry.proteinDescription?.recommendedName?.fullName?.value || 'Unknown',
        genes: entry.genes?.map(g => g.geneName?.value).filter(Boolean).join(', ') || '',
        organism: entry.organism?.scientificName || 'Unknown',
        length: entry.sequence?.length || 0
      }));
      
      return {
        success: true,
        query,
        count: results.length,
        results
      };
    } catch (error) {
      console.error(`[ProteinService] Error searching UniProt for ${query}:`, error);
      throw error;
    }
  }
  // Aliases for camelCase conversion compatibility
  // _toCamelCase converts search_alphafold_by_gene → searchAlphafoldByGene (lowercase 'f')
  // but the actual method is searchAlphaFoldByGene (uppercase 'F')
  async searchAlphafoldByGene(parameters) { return this.searchAlphaFoldByGene(parameters); }
  async fetchAlphafoldStructure(parameters) { return this.fetchAlphaFoldStructure(parameters); }
  async searchAlphafoldBySequence(parameters) {
    if (typeof this.searchAlphaFoldBySequence === 'function') {
      return this.searchAlphaFoldBySequence(parameters);
    }
    throw new Error('searchAlphaFoldBySequence not implemented');
  }
}

// Make it available globally if needed by plugin system
window.ProteinService = ProteinService;
