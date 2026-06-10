/**
 * Database Tools Module
 * Handles UniProt and InterPro database searches and analysis
 */

require('https');

class DatabaseTools {
  constructor(server) {
    this.server = server;
  }

  async executeClientTool(toolName, parameters, clientId) {
    return await this.server.executeToolOnClient(toolName, parameters, clientId);
  }

  getTools() {
    return {
      search_uniprot_database: {
        name: 'search_uniprot_database',
        description: 'Search UniProt database with various search types and filters',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query term' },
            searchType: {
              type: 'string',
              description:
                'Type of search: protein_name, gene_name, uniprot_id, organism, keyword, annotation, or sequence',
              enum: ['protein_name', 'gene_name', 'uniprot_id', 'organism', 'keyword', 'annotation', 'sequence'],
            },
            organism: { type: 'string', description: 'Organism filter (taxon ID or scientific name)' },
            reviewedOnly: { type: 'boolean', description: 'Only return reviewed (SwissProt) entries' },
            minLength: { type: 'number', description: 'Minimum protein sequence length' },
            maxLength: { type: 'number', description: 'Maximum protein sequence length' },
            limit: { type: 'number', description: 'Maximum number of results to return', default: 50 },
            includeSequence: { type: 'boolean', description: 'Include protein sequences in results', default: true },
            includeFeatures: { type: 'boolean', description: 'Include protein features in results', default: true },
          },
          required: ['query', 'searchType'],
        },
      },

      advanced_uniprot_search: {
        name: 'advanced_uniprot_search',
        description: 'Advanced UniProt search with multiple query fields',
        parameters: {
          type: 'object',
          properties: {
            proteinName: { type: 'string', description: 'Protein name query' },
            geneName: { type: 'string', description: 'Gene name query' },
            organism: { type: 'string', description: 'Organism filter' },
            keywords: { type: 'array', items: { type: 'string' }, description: 'Keyword filters' },
            subcellularLocation: { type: 'string', description: 'Subcellular location filter' },
            function: { type: 'string', description: 'Protein function filter' },
            reviewedOnly: { type: 'boolean', description: 'Only reviewed entries' },
            limit: { type: 'number', description: 'Maximum results', default: 25 },
          },
          required: [],
        },
      },

      get_uniprot_entry: {
        name: 'get_uniprot_entry',
        description: 'Get detailed information for a specific UniProt entry',
        parameters: {
          type: 'object',
          properties: {
            uniprotId: { type: 'string', description: 'UniProt accession ID' },
            geneName: {
              type: 'string',
              description: 'Gene name to resolve to a UniProt entry (used when uniprotId is not provided)',
            },
            organism: { type: 'string', description: 'Organism name to narrow gene name resolution' },
            includeSequence: { type: 'boolean', description: 'Include protein sequence', default: true },
            includeFeatures: { type: 'boolean', description: 'Include protein features', default: true },
            includeFunction: {
              type: 'boolean',
              description: 'Include function description and GO terms',
              default: true,
            },
            includeCrossRefs: { type: 'boolean', description: 'Include cross-references', default: false },
          },
          required: [],
        },
      },

      analyze_interpro_domains: {
        name: 'analyze_interpro_domains',
        description:
          'Analyze protein domains, families, and functional sites using InterPro database. Enhanced with multiple input methods and comprehensive analysis options.',
        parameters: {
          type: 'object',
          properties: {
            sequence: { type: 'string', description: 'Protein amino acid sequence to analyze (single-letter code)' },
            uniprot_id: { type: 'string', description: 'UniProt accession ID as alternative input' },
            geneName: { type: 'string', description: 'Gene name as alternative input' },
            organism: {
              type: 'string',
              description: 'Organism name for gene name resolution',
              default: 'Homo sapiens',
            },
            applications: {
              type: 'array',
              items: { type: 'string' },
              description: 'InterPro member databases to search',
              default: ['Pfam', 'SMART', 'PROSITE', 'PANTHER', 'Gene3D'],
            },
            analysis_type: {
              type: 'string',
              enum: ['domains', 'families', 'sites', 'repeats', 'complete'],
              description: 'Type of InterPro analysis to perform',
              default: 'complete',
            },
            include_superfamilies: {
              type: 'boolean',
              description: 'Include protein superfamily classifications',
              default: true,
            },
            confidence_threshold: { type: 'number', description: 'Minimum confidence score (0.0-1.0)', default: 0.5 },
            output_format: {
              type: 'string',
              enum: ['summary', 'detailed', 'graphical', 'json'],
              description: 'Format for analysis output',
              default: 'detailed',
            },
            goterms: { type: 'boolean', description: 'Include Gene Ontology terms', default: true },
            pathways: { type: 'boolean', description: 'Include pathway information', default: true },
            include_match_sequence: { type: 'boolean', description: 'Include matched sequence regions', default: true },
            email_notification: { type: 'string', description: 'Email for job completion notification' },
            priority: {
              type: 'string',
              enum: ['low', 'normal', 'high'],
              description: 'Job priority level',
              default: 'normal',
            },
          },
          required: [],
        },
      },

      search_interpro_entry: {
        name: 'search_interpro_entry',
        description:
          'Search InterPro database for domain families, functional sites, and protein signatures. Enhanced with batch processing and advanced filtering.',
        parameters: {
          type: 'object',
          properties: {
            search_term: { type: 'string', description: 'Single search term for InterPro entries' },
            search_terms: {
              type: 'array',
              items: { type: 'string' },
              description: 'Multiple search terms for batch processing',
            },
            search_type: {
              type: 'string',
              description: 'Type of search: name, description, keyword, signature, go_term, literature, or all',
              enum: ['name', 'description', 'keyword', 'signature', 'go_term', 'literature', 'all'],
              default: 'all',
            },
            entry_type: {
              type: 'string',
              enum: [
                'domain',
                'family',
                'repeat',
                'site',
                'homologous_superfamily',
                'conserved_site',
                'binding_site',
                'active_site',
                'all',
              ],
              description: 'Filter by InterPro entry type',
              default: 'all',
            },
            database_source: {
              type: 'array',
              items: { type: 'string' },
              description: 'Filter by member databases',
              default: [],
            },
            max_results: { type: 'number', description: 'Maximum results per search term', default: 50 },
            min_protein_count: { type: 'number', description: 'Minimum proteins containing entry', default: 0 },
            sort_by: {
              type: 'string',
              enum: ['relevance', 'name', 'type', 'protein_count', 'creation_date', 'update_date'],
              description: 'Sort order for results',
              default: 'relevance',
            },
            include_statistics: { type: 'boolean', description: 'Include search statistics', default: true },
            include_cross_references: { type: 'boolean', description: 'Include cross-references', default: false },
            organism_filter: { type: 'string', description: 'Filter by organism' },
            taxonomy_filter: {
              type: 'array',
              items: { type: 'number' },
              description: 'Filter by taxonomy IDs',
              default: [],
            },
            confidence_level: {
              type: 'string',
              enum: ['low', 'medium', 'high', 'all'],
              description: 'Confidence level filter',
              default: 'all',
            },
            fuzzy_matching: { type: 'boolean', description: 'Enable fuzzy string matching', default: false },
          },
          oneOf: [{ required: ['search_term'] }, { required: ['search_terms'] }],
        },
      },

      get_interpro_entry_details: {
        name: 'get_interpro_entry_details',
        description: 'Get detailed information for a specific InterPro entry',
        parameters: {
          type: 'object',
          properties: {
            interproId: { type: 'string', description: 'InterPro entry ID (e.g., IPR000001)' },
            includeProteins: { type: 'boolean', description: 'Include associated proteins', default: true },
            includeStructures: { type: 'boolean', description: 'Include structure information', default: true },
            includeTaxonomy: { type: 'boolean', description: 'Include taxonomic distribution', default: false },
          },
          required: ['interproId'],
        },
      },
    };
  }

  async searchUniProtDatabase(parameters) {
    // Server-side implementation - directly query UniProt API
    const {
      query,
      searchType = 'keyword',
      organism,
      reviewedOnly = false,
      limit = 20,
      includeSequence = false,
    } = parameters;

    try {
      if (!query && !organism) {
        throw new Error('Query or organism is required for UniProt search');
      }

      const queryParts = [];
      if (query) {
        if (searchType === 'gene_name') queryParts.push(`(gene:${query})`);
        else if (searchType === 'protein_name') queryParts.push(`(protein_name:${query})`);
        else if (searchType === 'uniprot_id') queryParts.push(`(accession:${query})`);
        else queryParts.push(`(${query})`);
      }

      if (organism) {
        queryParts.push(`(organism_name:"${organism}")`);
      }
      if (reviewedOnly) {
        queryParts.push(`(reviewed:true)`);
      }

      const queryString = queryParts.join(' AND ');
      const fields =
        'accession,id,protein_name,gene_names,organism_name,length,reviewed,cc_function,cc_subcellular_location' +
        (includeSequence ? ',sequence' : '');
      const searchUrl = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(queryString)}&fields=${fields}&size=${limit}&format=json`;

      console.log(`[DatabaseTools] searchUniProtDatabase: ${searchUrl}`);
      const response = await fetch(searchUrl);

      if (!response.ok) {
        throw new Error(`UniProt API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      const results = (data.results || []).map(protein => {
        let functionDescription = '';
        let subcellularLocation = '';

        if (protein.comments) {
          const fn = protein.comments.find(c => c.commentType === 'FUNCTION');
          if (fn && fn.texts && fn.texts.length > 0) functionDescription = fn.texts[0].value;

          const loc = protein.comments.find(c => c.commentType === 'SUBCELLULAR LOCATION');
          if (loc && loc.subcellularLocations && loc.subcellularLocations.length > 0) {
            subcellularLocation = loc.subcellularLocations.map(l => l.location.value).join(', ');
          }
        }

        const pruned = {
          uniprotId: protein.primaryAccession,
          entryName: protein.uniProtkbId,
          proteinName:
            protein.proteinDescription?.recommendedName?.fullName?.value ||
            protein.proteinDescription?.submissionNames?.[0]?.fullName?.value ||
            'Unknown',
          genes: (protein.genes || []).map(g => g.geneName?.value).filter(Boolean),
          organism: protein.organism?.scientificName || 'Unknown',
          length: protein.sequence?.length || 0,
          reviewed: protein.entryType === 'UniProtKB reviewed (Swiss-Prot)',
        };

        if (functionDescription) pruned.function = functionDescription.substring(0, 500);
        if (subcellularLocation) pruned.subcellularLocation = subcellularLocation;
        if (includeSequence && protein.sequence?.value) pruned.sequence = protein.sequence.value;

        return pruned;
      });

      return {
        success: true,
        tool: 'search_uniprot_database',
        count: results.length,
        results: results,
      };
    } catch (error) {
      console.error('searchUniProtDatabase error:', error);
      return {
        success: false,
        error: error.message,
        tool: 'search_uniprot_database',
      };
    }
  }

  async advancedUniProtSearch(parameters = {}) {
    // Server-side implementation - directly query UniProt API
    const {
      proteinName,
      geneName,
      organism,
      keywords,
      subcellularLocation,
      function: fnFilter,
      reviewedOnly = false,
      limit = 25,
    } = parameters;

    try {
      const queryParts = [];
      if (proteinName) queryParts.push(`(protein_name:"${proteinName}")`);
      if (geneName) queryParts.push(`(gene:"${geneName}")`);
      if (organism) queryParts.push(`(organism_name:"${organism}")`);
      if (keywords) {
        const kwList = Array.isArray(keywords) ? keywords : [keywords];
        kwList.filter(Boolean).forEach(kw => queryParts.push(`(keyword:"${kw}")`));
      }
      if (subcellularLocation) queryParts.push(`(cc_scl_term:"${subcellularLocation}")`);
      if (fnFilter) queryParts.push(`(cc_function:"${fnFilter}")`);
      if (reviewedOnly) queryParts.push(`(reviewed:true)`);

      if (queryParts.length === 0) {
        throw new Error('At least one search parameter must be provided');
      }

      const queryString = queryParts.join(' AND ');
      const fields = 'accession,id,protein_name,gene_names,organism_name,length,reviewed';
      const searchUrl = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(queryString)}&fields=${fields}&size=${limit}&format=json`;

      console.log(`[DatabaseTools] advancedUniProtSearch: ${searchUrl}`);
      const response = await fetch(searchUrl);

      if (!response.ok) {
        throw new Error(`UniProt API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      const results = (data.results || []).map(protein => ({
        uniprotId: protein.primaryAccession,
        entryName: protein.uniProtkbId,
        proteinName:
          protein.proteinDescription?.recommendedName?.fullName?.value ||
          protein.proteinDescription?.submissionNames?.[0]?.fullName?.value ||
          'Unknown',
        genes: (protein.genes || []).map(g => g.geneName?.value).filter(Boolean),
        organism: protein.organism?.scientificName || 'Unknown',
        length: protein.sequence?.length || 0,
        reviewed: protein.entryType === 'UniProtKB reviewed (Swiss-Prot)',
      }));

      return {
        success: true,
        tool: 'advanced_uniprot_search',
        count: results.length,
        results: results,
      };
    } catch (error) {
      console.error('advancedUniProtSearch error:', error);
      return {
        success: false,
        error: error.message,
        tool: 'advanced_uniprot_search',
      };
    }
  }

  async getUniProtEntry(parameters = {}) {
    // Server-side implementation - directly query UniProt API
    const { uniprotId, uniprot_id, geneName, gene_name, organism } = parameters;

    const includeSequence = parameters.includeSequence ?? parameters.include_sequence ?? true;
    const includeFeatures = parameters.includeFeatures ?? parameters.include_features ?? true;
    const includeFunction = parameters.includeFunction ?? parameters.include_function ?? true;
    const includeCrossRefs = parameters.includeCrossRefs ?? parameters.include_cross_refs ?? false;

    let accession = uniprotId || uniprot_id;
    const gene = geneName || gene_name;

    try {
      if (!accession) {
        if (!gene) {
          throw new Error('Either uniprotId or geneName is required');
        }

        const queryParts = [`(gene:${gene})`];
        if (organism) queryParts.push(`(organism_name:"${organism}")`);
        const searchUrl = `https://rest.uniprot.org/uniprotkb/search?query=${encodeURIComponent(queryParts.join(' AND '))}&fields=accession&size=1&format=json`;

        console.log(`[DatabaseTools] getUniProtEntry resolving gene: ${searchUrl}`);
        const searchResponse = await fetch(searchUrl);
        if (!searchResponse.ok) {
          throw new Error(`UniProt search error: ${searchResponse.status} ${searchResponse.statusText}`);
        }
        const searchData = await searchResponse.json();
        accession = searchData.results?.[0]?.primaryAccession;
        if (!accession) {
          throw new Error(`No UniProt entry found for gene "${gene}"${organism ? ` in ${organism}` : ''}`);
        }
      }

      const entryUrl = `https://rest.uniprot.org/uniprotkb/${encodeURIComponent(accession)}.json`;
      console.log(`[DatabaseTools] getUniProtEntry: ${entryUrl}`);
      const response = await fetch(entryUrl);
      if (!response.ok) {
        throw new Error(`UniProt API error: ${response.status} ${response.statusText}`);
      }
      const entry = await response.json();

      const functionComment = (entry.comments || []).find(c => c.commentType === 'FUNCTION');
      const functionDescription = functionComment?.texts?.[0]?.value || '';

      const result = {
        success: true,
        tool: 'get_uniprot_entry',
        entry_info: {
          uniprot_id: entry.primaryAccession,
          entry_name: entry.uniProtkbId,
          protein_name:
            entry.proteinDescription?.recommendedName?.fullName?.value ||
            entry.proteinDescription?.submissionNames?.[0]?.fullName?.value ||
            'Unknown',
          organism: entry.organism?.scientificName || 'Unknown',
          genes: (entry.genes || []).map(g => g.geneName?.value).filter(Boolean),
          status: entry.entryType === 'UniProtKB reviewed (Swiss-Prot)' ? 'reviewed' : 'unreviewed',
        },
        sequence_length: entry.sequence?.length || 0,
        message: `Retrieved UniProt entry for ${entry.primaryAccession}`,
      };

      if (includeSequence) {
        result.protein_sequence = entry.sequence?.value || '';
      }

      if (includeFeatures) {
        result.features = (entry.features || []).map(f => ({
          type: f.type,
          description: f.description || '',
          start: f.location?.start?.value,
          end: f.location?.end?.value,
        }));
      }

      if (includeFunction) {
        result.function = {
          description: functionDescription,
          go_terms: (entry.uniProtKBCrossReferences || []).filter(ref => ref.database === 'GO').map(ref => ref.id),
        };
      }

      if (includeCrossRefs) {
        result.cross_references = (entry.uniProtKBCrossReferences || []).map(ref => ({
          database: ref.database,
          id: ref.id,
        }));
      }

      return result;
    } catch (error) {
      console.error('getUniProtEntry error:', error);
      return {
        success: false,
        error: error.message,
        tool: 'get_uniprot_entry',
      };
    }
  }

  async viewMarkdownFile(parameters = {}) {
    const { filePath, title } = parameters;

    console.log(`📄 [DatabaseTools] Opening markdown file: ${filePath}`);

    if (!filePath) {
      throw new Error('File path is required');
    }

    try {
      const fs = require('fs');
      const path = require('path');

      // Read the file
      if (!fs.existsSync(filePath)) {
        throw new Error(`File not found: ${filePath}`);
      }

      fs.readFileSync(filePath, 'utf8');
      const fileName = path.basename(filePath);
      const windowTitle = title || fileName;

      return {
        success: true,
        message: `Opened markdown file: ${fileName}`,
        filePath: filePath,
        fileName: fileName,
        windowTitle: windowTitle,
        tool: 'view_markdown_file',
      };
    } catch (error) {
      console.error('❌ [DatabaseTools] Error opening markdown file:', error);
      return {
        success: false,
        error: error.message,
        tool: 'view_markdown_file',
      };
    }
  }

  async analyzeInterProDomains(parameters = {}) {
    // Server-side implementation - directly query InterProScan 5 REST API (EBI)
    const {
      sequence,
      uniprot_id,
      geneName,
      organism = null,
      applications = ['Pfam', 'SMART', 'PROSITE'],
      goterms = true,
      pathways = true,
      include_superfamilies = true,
    } = parameters;

    try {
      // Resolve a target sequence from sequence / uniprot_id / geneName
      let targetSequence = sequence;
      let proteinInfo = null;

      if (!targetSequence) {
        if (uniprot_id) {
          const uniprotResponse = await fetch(`https://rest.uniprot.org/uniprotkb/${uniprot_id}.fasta`);
          if (!uniprotResponse.ok) {
            throw new Error(`UniProt ID ${uniprot_id} not found`);
          }
          const fastaText = await uniprotResponse.text();
          const lines = fastaText.split('\n');
          targetSequence = lines.slice(1).join('').replace(/\s/g, '');
          proteinInfo = { id: uniprot_id, name: uniprot_id, organism, length: targetSequence.length };
        } else if (geneName) {
          const searchOrganism = organism || 'Homo sapiens';
          const searchUrl = `https://rest.uniprot.org/uniprotkb/search?query=gene:${geneName}+AND+organism_name:${encodeURIComponent(searchOrganism)}&format=fasta&size=1`;
          const searchResponse = await fetch(searchUrl);
          if (!searchResponse.ok) {
            throw new Error(`Gene ${geneName} not found in UniProt`);
          }
          const fastaText = await searchResponse.text();
          if (!fastaText.trim()) {
            throw new Error(`No sequence found for gene ${geneName}`);
          }
          const lines = fastaText.split('\n');
          targetSequence = lines.slice(1).join('').replace(/\s/g, '');
          const header = lines[0];
          const resolvedId = header.split('|')[1];
          const organismMatch = header.match(/OS=([^=]+?)(?:OX=|GN=|PE=|SV=|$)/);
          proteinInfo = {
            id: resolvedId,
            name: geneName,
            organism: organismMatch ? organismMatch[1].trim() : searchOrganism,
            length: targetSequence.length,
          };
        }
      }

      if (!targetSequence || targetSequence.length < 10) {
        throw new Error('No valid protein sequence provided. Please provide sequence, uniprot_id, or geneName.');
      }

      const cleanSequence = targetSequence.replace(/[^ACDEFGHIKLMNPQRSTVWY]/gi, '').toUpperCase();

      // Submit job to InterProScan 5
      // https://www.ebi.ac.uk/Tools/services/rest/iprscan5/parameterdetails/appl
      const applMapping = {
        Pfam: 'PfamA',
        SMART: 'SMART',
        PROSITE: 'PrositeProfiles',
        ProSiteProfiles: 'PrositeProfiles',
        ProSitePatterns: 'PrositePatterns',
        PANTHER: 'Panther',
        Gene3D: 'Gene3d',
        HAMAP: 'HAMAP',
        Hamap: 'HAMAP',
        PRINTS: 'PRINTS',
        PIRSF: 'PIRSF',
        PIRSR: 'PIRSR',
        SUPERFAMILY: 'SuperFamily',
        NCBIfam: 'NCBIfam',
        TIGRFAMs: 'NCBIfam',
        SFLD: 'SFLD',
        CDD: 'CDD',
        Phobius: 'Phobius',
        SignalP: 'SignalP_EUK',
        SignalP_EUK: 'SignalP_EUK',
        SignalP_GRAM_POSITIVE: 'SignalP_GRAM_POSITIVE',
        SignalP_GRAM_NEGATIVE: 'SignalP_GRAM_NEGATIVE',
        Coils: 'Coils',
        MobiDBLite: 'MobiDBLite',
        TMHMM: 'TMHMM',
        AntiFam: 'AntiFam',
        FunFam: 'FunFam',
      };

      const applCodes = applications.map(app => {
        const mappedCode = applMapping[app];
        if (mappedCode) return mappedCode;
        const key = Object.keys(applMapping).find(k => k.toLowerCase() === app.toLowerCase());
        return key ? applMapping[key] : app;
      });

      const submitUrl = 'https://www.ebi.ac.uk/Tools/services/rest/iprscan5/run';
      const formData = new URLSearchParams();
      formData.append('email', 'CodeXomics@yeah.net');
      formData.append('title', 'CodeXomics');
      formData.append('sequence', cleanSequence);
      formData.append('appl', applCodes.join(','));
      if (goterms) formData.append('goterms', 'true');
      if (pathways) formData.append('pathways', 'true');

      console.log(`[DatabaseTools] analyzeInterProDomains: submitting ${cleanSequence.length} AA to InterProScan`);
      const submitResponse = await fetch(submitUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'text/plain' },
        body: formData.toString(),
      });

      if (!submitResponse.ok) {
        const errorText = await submitResponse.text();
        throw new Error(
          `InterPro API submission failed (${submitResponse.status}): ${errorText || submitResponse.statusText}`
        );
      }

      const jobId = await submitResponse.text();
      console.log(`[DatabaseTools] InterPro job submitted: ${jobId}`);

      // Poll for results (5 minute max, 5s intervals)
      let attempts = 0;
      const maxAttempts = 60;
      let status = 'RUNNING';

      while (status === 'RUNNING' && attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 5000));
        const statusResponse = await fetch(`https://www.ebi.ac.uk/Tools/services/rest/iprscan5/status/${jobId}`);
        status = await statusResponse.text();
        attempts++;
        if (status === 'FINISHED') break;
        if (status === 'FAILED' || status === 'ERROR') {
          throw new Error('InterPro analysis failed');
        }
      }

      if (status !== 'FINISHED') {
        throw new Error('InterPro analysis timeout - sequence may be too long or service is busy');
      }

      const resultResponse = await fetch(`https://www.ebi.ac.uk/Tools/services/rest/iprscan5/result/${jobId}/json`);
      if (!resultResponse.ok) {
        throw new Error('Failed to retrieve InterPro results');
      }
      const interproData = await resultResponse.json();

      const domains = [];
      const goTerms = [];
      const pathwayData = [];

      if (interproData.results && interproData.results[0]) {
        const matches = interproData.results[0].matches || [];
        matches.forEach(match => {
          const signature = match.signature || {};
          (match.locations || []).forEach(loc => {
            domains.push({
              accession: signature.accession,
              name: signature.name || signature.description || 'Unknown',
              type: signature.type || 'Domain',
              start: loc.start,
              end: loc.end,
              evalue: loc.score || 0,
              database: signature.signatureLibraryRelease?.library || 'InterPro',
              description: signature.description || '',
              interpro_entry: match.entry?.accession || null,
            });
          });

          if (match.entry && match.entry.goXRefs) {
            match.entry.goXRefs.forEach(go => {
              goTerms.push({ id: go.id, category: go.category, name: go.name });
            });
          }

          if (match.entry && match.entry.pathwayXRefs) {
            match.entry.pathwayXRefs.forEach(pathway => {
              pathwayData.push({ id: pathway.id, name: pathway.name, database: pathway.databaseName });
            });
          }
        });
      }

      const coveredPositions = new Set();
      domains.forEach(d => {
        for (let i = d.start; i <= d.end; i++) coveredPositions.add(i);
      });
      const coverage = ((coveredPositions.size / cleanSequence.length) * 100).toFixed(2);

      return {
        success: true,
        tool: 'analyze_interpro_domains',
        job_id: jobId,
        protein_info: proteinInfo || {
          id: 'USER_PROVIDED',
          name: 'User sequence',
          organism: organism || 'Not specified',
          length: cleanSequence.length,
        },
        sequence_length: cleanSequence.length,
        analysis_parameters: {
          applications,
          include_go_terms: goterms,
          include_pathways: pathways,
          include_superfamilies,
        },
        domain_architecture: domains,
        go_terms: goTerms,
        pathways: pathwayData,
        summary: {
          total_domains: domains.length,
          domain_coverage: parseFloat(coverage),
          databases_searched: applications,
          go_terms_found: goTerms.length,
          pathways_found: pathwayData.length,
        },
        message: `Found ${domains.length} protein domains using real InterPro API`,
        api_source: 'InterProScan 5 REST API (EBI)',
      };
    } catch (error) {
      console.error('analyzeInterProDomains error:', error);
      return {
        success: false,
        tool: 'analyze_interpro_domains',
        error: error.message,
      };
    }
  }

  async searchInterProEntry(parameters = {}) {
    // Server-side implementation - directly query InterPro REST API (EBI)
    const { search_term, search_terms, entry_type, max_results = 20 } = parameters;

    try {
      let term = search_term;
      if (!term && search_terms && search_terms.length > 0) {
        term = search_terms.join(' ');
      }
      if (!term) throw new Error('search_term is required');

      let searchUrl = `https://www.ebi.ac.uk/interpro/api/entry/interpro/?search=${encodeURIComponent(term)}`;
      if (entry_type && entry_type !== 'all') searchUrl += `&type=${encodeURIComponent(entry_type.toLowerCase())}`;
      searchUrl += `&page_size=${max_results}`;

      console.log(`[DatabaseTools] searchInterProEntry: ${searchUrl}`);
      const response = await fetch(searchUrl);

      if (!response.ok) {
        throw new Error(`InterPro API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();

      const results = (data.results || []).map(entry => ({
        interproId: entry.metadata?.accession || entry.accession,
        name: entry.metadata?.name?.name || entry.metadata?.name || 'Unknown',
        type: entry.metadata?.type || 'Unknown',
        proteinCount: entry.protein_count || 0,
        integrated: entry.metadata?.integrated || null,
        description: entry.metadata?.description?.[0] || 'No description available',
      }));

      return {
        success: true,
        tool: 'search_interpro_entry',
        count: results.length,
        results: results,
      };
    } catch (error) {
      console.error('searchInterProEntry error:', error);
      return {
        success: false,
        tool: 'search_interpro_entry',
        error: error.message,
      };
    }
  }

  async getInterProEntryDetails(parameters = {}) {
    // Server-side implementation - directly query InterPro REST API (EBI)
    const interproId = parameters.interproId || parameters.interpro_id;

    try {
      if (!interproId) throw new Error('interproId is required');

      const upperId = interproId.toUpperCase();
      const detailUrl = `https://www.ebi.ac.uk/interpro/api/entry/interpro/${encodeURIComponent(upperId)}`;

      console.log(`[DatabaseTools] getInterProEntryDetails: ${detailUrl}`);
      const response = await fetch(detailUrl);

      if (!response.ok) {
        throw new Error(`InterPro API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const meta = data.metadata || data;

      const details = {
        interproId: meta.accession,
        name: meta.name?.name || meta.name || 'Unknown',
        shortName: meta.name?.short || '',
        type: meta.type || 'Unknown',
        description: (meta.description || []).map(d => d.text).join(' '),
        proteinCount: data.protein_count || 0,
        goTerms: (meta.go_terms || []).map(go => ({ id: go.identifier, name: go.name, category: go.category })),
        integratedSignatures: Object.keys(meta.member_databases || {}),
        literature: Object.values(meta.literature || {}).map(lit => ({
          pmid: lit.PMID,
          title: lit.title,
          author: lit.author,
        })),
      };

      return {
        success: true,
        tool: 'get_interpro_entry_details',
        details: details,
      };
    } catch (error) {
      console.error('getInterProEntryDetails error:', error);
      return {
        success: false,
        tool: 'get_interpro_entry_details',
        error: error.message,
      };
    }
  }
}

module.exports = DatabaseTools;
