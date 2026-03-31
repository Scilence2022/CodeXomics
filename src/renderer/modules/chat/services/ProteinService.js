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
    const uniprotId = parameters.uniprotId || parameters.uniprot_id;
    const geneName = parameters.geneName || parameters.gene_name;

    // If UniProt ID provided (no PDB ID), route to AlphaFold
    if (!pdbId && uniprotId) {
      return await this.fetchAlphaFoldStructure({ uniprotId, geneName });
    }

    // If only gene name provided, search first then load
    if (!pdbId && !uniprotId && geneName) {
      return await this.searchAlphaFoldByGene({ geneName });
    }

    if (!pdbId) {
      throw new Error('PDB ID, UniProt ID, or gene name is required for protein structure fetch');
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

  // Alias: search_protein_by_gene → delegates to searchAlphaFoldByGene
  async searchProteinByGene(parameters) {
    return await this.searchAlphaFoldByGene(parameters);
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

      const searchData = {
        query: {
          type: 'group',
          logical_operator: 'and',
          nodes: [
            {
              type: 'terminal',
              service: 'text',
              parameters: {
                attribute: 'rcsb_entity_source_organism.taxonomy_lineage.name',
                operator: 'contains_words',
                value: organism
              }
            },
            {
              type: 'terminal',
              service: 'text',
              parameters: {
                attribute: 'struct.title',
                operator: 'contains_words',
                value: geneName
              }
            }
          ]
        },
        request_options: {
          paginate: { start: 0, rows: limit },
          return_all_hits: true
        },
        return_type: 'entry'
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
      const pdbIds = (data.result_set || []).map(r => r.identifier);

      if (pdbIds.length === 0) {
        return {
          success: true,
          query: geneName,
          organism,
          count: 0,
          results: [],
          message: `No PDB structures found for ${geneName} in ${organism}.`
        };
      }

      // Fetch detailed metadata for each PDB entry in parallel
      const detailsPromises = pdbIds.map(async pdbId => {
        try {
          const details = await this.getPDBDetails(pdbId);
          return {
            pdbId,
            title: details.title || 'Unknown structure',
            geneName: geneName,
            organism: details.organism || organism,
            method: details.method || 'N/A',
            resolution: details.resolution || null,
            releaseDate: details.date || 'N/A',
            pdbUrl: `https://www.rcsb.org/structure/${pdbId}`,
            downloadUrl: `https://files.rcsb.org/download/${pdbId}.pdb`,
          };
        } catch (err) {
          console.warn(`[ProteinService] Failed to get details for ${pdbId}:`, err.message);
          return {
            pdbId,
            title: pdbId,
            geneName: geneName,
            organism: organism,
            method: 'N/A',
            resolution: null,
            releaseDate: 'N/A',
            pdbUrl: `https://www.rcsb.org/structure/${pdbId}`,
            downloadUrl: `https://files.rcsb.org/download/${pdbId}.pdb`,
          };
        }
      });

      const results = await Promise.all(detailsPromises);

      // Display in sidebar
      if (results.length > 0 && typeof this.chatManager.displayPDBResultsInSidebar === 'function') {
        setTimeout(() => this.chatManager.displayPDBResultsInSidebar(results, geneName), 100);
      }

      return {
        success: true,
        query: geneName,
        organism,
        count: results.length,
        results,
        message: `Found ${results.length} PDB structure(s) for ${geneName}. Results displayed in sidebar.`
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
      
      // Query UniProt for multiple candidates (organism-scoped first, then broad)
      let uniprotResults = await this.searchUniProtDatabase({
        query: `gene:${geneName} AND organism_name:"${organism}"`,
        limit: 10
      });

      if (!uniprotResults.success || !uniprotResults.results || uniprotResults.results.length === 0) {
        console.log(`[ProteinService] Organism-scoped query returned no results, retrying with gene name only`);
        uniprotResults = await this.searchUniProtDatabase({
          query: `gene:${geneName}`,
          limit: 10
        });
      }

      if (!uniprotResults.success || !uniprotResults.results || uniprotResults.results.length === 0) {
        return {
          success: false,
          message: `No UniProt entries found for ${geneName}. AlphaFold requires a UniProt ID.`
        };
      }

      // Check AlphaFold availability for all results in parallel
      const availabilityChecks = await Promise.all(
        uniprotResults.results.map(async entry => {
          const available = await this.checkAlphaFoldAvailability(entry.id);
          return available ? entry : null;
        })
      );
      const availableEntries = availabilityChecks.filter(Boolean);

      if (availableEntries.length === 0) {
        return {
          success: false,
          geneName,
          message: `No AlphaFold structures found for ${geneName}. Searched ${uniprotResults.results.length} UniProt entries.`
        };
      }

      // Build result objects for sidebar display
      // Format must match ChatManager.createAlphaFoldResultElement expectations
      this._alphaFoldCache = this._alphaFoldCache || {};
      const sidebarResults = availableEntries.map(entry => {
        const cached = this._alphaFoldCache[entry.id] || {};
        // geneNames must be an array for the existing sidebar template
        const geneNames = entry.genes ? entry.genes.split(',').map(g => g.trim()).filter(Boolean) : [];
        return {
          uniprotId: entry.id,
          entryName: entry.entryName,
          proteinName: entry.proteinName,
          geneNames: geneNames,
          organism: entry.organism,
          length: entry.length,
          reviewed: entry.reviewed !== false,
          downloadUrl: cached.pdbUrl ||
            `https://alphafold.ebi.ac.uk/files/AF-${entry.id}-F1-model_v4.pdb`,
          alphaFoldUrl: `https://alphafold.ebi.ac.uk/entry/${entry.id}`,
        };
      });

      // Display in sidebar (calls ChatManager.displayAlphaFoldResultsInSidebar)
      if (typeof this.chatManager.displayAlphaFoldResultsInSidebar === 'function') {
        setTimeout(() => this.chatManager.displayAlphaFoldResultsInSidebar(sidebarResults, geneName), 100);
      }

      return {
        success: true,
        geneName,
        count: sidebarResults.length,
        results: sidebarResults,
        message: `Found ${sidebarResults.length} AlphaFold structure(s) for ${geneName}. Results displayed in sidebar.`
      };
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

      // Retrieve the actual PDB URL from the cached API response
      this._alphaFoldCache = this._alphaFoldCache || {};
      const entry = this._alphaFoldCache[uniprotId];
      const pdbUrl = entry?.pdbUrl ||
        `https://alphafold.ebi.ac.uk/files/AF-${uniprotId}-F1-model_v4.pdb`;

      if (this.app.proteinStructureViewer) {
        await this.app.proteinStructureViewer.loadAlphaFold(uniprotId, pdbUrl);
        return {
          success: true,
          message: `AlphaFold structure ${uniprotId} loaded successfully`,
          uniprotId,
          pdbUrl
        };
      }

      // Fallback NGL logic
      if (window.viewer) {
        try {
          window.viewer.removeAllComponents();
          await window.viewer.loadFile(pdbUrl, { defaultRepresentation: true });
          return {
            success: true,
            message: `Loaded AlphaFold structure ${uniprotId}`,
            uniprotId,
            pdbUrl,
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
      // Use the AlphaFold EBI REST API to check availability
      // This is more reliable than guessing the file URL version
      const response = await fetch(
        `https://alphafold.ebi.ac.uk/api/prediction/${uniprotId}`,
        { headers: { 'Accept': 'application/json' } }
      );
      if (!response.ok) return false;
      const data = await response.json();
      // Cache the entry so fetchAlphaFoldStructure can reuse it
      this._alphaFoldCache = this._alphaFoldCache || {};
      if (Array.isArray(data) && data.length > 0) {
        this._alphaFoldCache[uniprotId] = data[0];
        return true;
      }
      return false;
    } catch (error) {
      console.warn(`[ProteinService] AlphaFold API check failed for ${uniprotId}:`, error);
      return false;
    }
  }

  async openAlphaFoldViewer(parameters) {
    // Alias to fetchAlphaFoldStructure for backwards compatibility
    return this.fetchAlphaFoldStructure(parameters);
  }

  // 3. UNIPROT / INTERPRO OPERATIONS
  async searchUniProtDatabase(parameters) {
    // Accept many LLM-style parameter variants and auto-build a query if needed
    let query = parameters.query || parameters.queryString || parameters.search_query || parameters.searchQuery;
    const limit = parameters.limit || parameters.maxResults || parameters.max_results || 10;

    // Auto-build query from structured parameters if no raw query string was given
    if (!query) {
      const parts = [];
      const geneName = parameters.geneName || parameters.gene_name || parameters.name || parameters.gene;
      const organism = parameters.organism || parameters.species || parameters.organism_name;
      const accession = parameters.accession || parameters.uniprot_id || parameters.uniprotId;
      const protein = parameters.proteinName || parameters.protein_name || parameters.protein;

      if (accession) { parts.push(accession); }
      if (geneName)  { parts.push(`gene:${geneName}`); }
      if (protein)   { parts.push(`protein_name:${protein}`); }
      if (organism)  { parts.push(`organism_name:"${organism}"`); }

      if (parts.length > 0) {
        query = parts.join(' AND ');
        console.log(`[ProteinService] Auto-built UniProt query: ${query}`);
      }
    }

    if (!query) {
      throw new Error('Query is required for UniProt search. Provide query, gene_name, accession, or similar parameter.');
    }

    try {
      const url = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(query)}&size=${limit}&fields=accession,id,protein_name,gene_names,organism_name,length&format=json`;
      
      const response = await fetch(url);
      
      if (!response.ok) {
        console.warn(`[ProteinService] UniProt API returned ${response.status} for query: ${query}`);
        return { success: false, query, count: 0, results: [], error: `UniProt API returned ${response.status}` };
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
