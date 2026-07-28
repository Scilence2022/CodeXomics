// @ts-check
/**
 * BLAST Function Tools - AI-Integrated BLAST Functionality
 * Provides comprehensive BLAST search, database management, and analysis tools
 * Integrated with Dynamic Tools Registry for LLM function calling
 */
class BlastFunctionTools {
  constructor(blastManager) {
    this.blastManager = blastManager;
    this.initialized = false;

    // Tool execution tracking
    this.executionHistory = [];
    this.performanceMetrics = new Map();

    // Genome-database association tracking
    this.genomeDbAssociations = new Map(); // Maps genomeId -> { nucleotide: dbName, protein: dbName }
    this.loadGenomeDbAssociations(); // Load saved associations

    this.initializeTools();
  }

  /**
   * Initialize and register all BLAST function tools
   */
  initializeTools() {
    console.log('🔬 [BlastFunctionTools] Initializing BLAST function tools...');

    // Register built-in tool mappings
    this.toolMappings = {
      // Search tools
      blast_search: this.executeBlastSearch.bind(this),
      blast_search_online: this.executeOnlineBlastSearch.bind(this),
      blast_search_local: this.executeLocalBlastSearch.bind(this),
      blast_search_batch: this.executeBatchBlastSearch.bind(this),
      blast_sequence_from_region: this.blastSequenceFromRegion.bind(this),

      // Database management
      blast_create_database: this.createBlastDatabase.bind(this),
      blast_list_databases: this.listBlastDatabases.bind(this),
      blast_delete_database: this.deleteBlastDatabase.bind(this),

      // Database from loaded genomes
      blast_create_db_from_genome: this.createDatabaseFromGenome.bind(this),
      blast_create_protein_db_from_genome: this.createProteinDatabaseFromGenome.bind(this),

      // Quick database creation for current genome
      blast_create_quick_db_for_current_genome: this.createQuickDbForCurrentGenome.bind(this),

      // Search result analysis
      blast_parse_results: this.parseBlastResults.bind(this),
      blast_filter_results: this.filterBlastResults.bind(this),
      blast_export_results: this.exportBlastResults.bind(this),

      // Utility tools
      blast_detect_sequence_type: this.detectSequenceType.bind(this),
      blast_validate_database: this.validateDatabase.bind(this),
      blast_get_installation_status: this.getInstallationStatus.bind(this),
    };

    this.initialized = true;
    console.log(`✅ [BlastFunctionTools] Initialized ${Object.keys(this.toolMappings).length} BLAST tools`);
  }

  /**
   * Execute generic BLAST search by routing to the requested service.
   */
  async executeBlastSearch(params) {
    const service = String(params.service || params.searchType || params.search_type || 'online').toLowerCase();
    if (service === 'local' || service === 'blast+') {
      return this.executeLocalBlastSearch(params);
    }
    if (service === 'ncbi' || service === 'online' || service === 'remote') {
      return this.executeOnlineBlastSearch(params);
    }
    throw new Error('service/searchType must be one of: online, ncbi, remote, local, blast+');
  }

  /**
   * Execute a BLAST function tool by name
   */
  async executeTool(toolName, parameters) {
    const startTime = Date.now();

    try {
      console.log(`🔬 [BlastFunctionTools] Executing tool: ${toolName}`);
      console.log(`📋 [BlastFunctionTools] Parameters:`, parameters);

      if (!this.toolMappings[toolName]) {
        throw new Error(`Unknown BLAST tool: ${toolName}`);
      }

      const result = await this.toolMappings[toolName](parameters);

      const executionTime = Date.now() - startTime;
      this.recordExecution(toolName, parameters, result, executionTime, true);

      console.log(`✅ [BlastFunctionTools] Tool ${toolName} completed in ${executionTime}ms`);
      return result;
    } catch (error) {
      const executionTime = Date.now() - startTime;
      this.recordExecution(toolName, parameters, { error: error.message }, executionTime, false);

      console.error(`❌ [BlastFunctionTools] Tool ${toolName} failed:`, error);
      throw error;
    }
  }

  /**
   * Execute online BLAST search (NCBI)
   */
  async executeOnlineBlastSearch(params) {
    const { sequence, blastType, database, evalue = '0.01', maxTargets = 50 } = params;

    if (!sequence) {
      throw new Error('Sequence parameter is required');
    }

    if (!blastType) {
      throw new Error('blastType parameter is required (blastn, blastp, blastx, tblastn, tblastx)');
    }

    if (!database) {
      throw new Error('database parameter is required');
    }

    try {
      // Execute NCBI BLAST search
      const results = await this.blastManager.executeNCBIBlast({
        sequence,
        blastType,
        database,
        evalue,
        maxTargets,
      });

      if (results?.isError) {
        return {
          success: false,
          error: results.errorMessage || 'NCBI BLAST failed',
          source: 'NCBI Online',
          results: results,
          parameters: { sequence, blastType, database, evalue, maxTargets },
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        source: 'NCBI Online',
        searchId: results.searchId || `NCBI_${Date.now()}`,
        results: results,
        parameters: { sequence, blastType, database, evalue, maxTargets },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        source: 'NCBI Online',
        parameters: { sequence, blastType, database, evalue, maxTargets },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute local BLAST search
   */
  async executeLocalBlastSearch(params) {
    let { sequence, blastType, database, evalue = '0.01', maxTargets = 50, wordSize, matrix } = params;

    if (!sequence) {
      throw new Error('Sequence parameter is required');
    }

    if (!blastType) {
      throw new Error('blastType parameter is required');
    }

    // Smart database selection: if database not specified, use current genome's associated database
    if (!database) {
      const genomeId = this.getCurrentGenomeId();
      if (genomeId) {
        // Get associated database based on BLAST type
        const dbType = this.getDatabaseTypeForBlastType(blastType);

        const associatedDb = this.getAssociatedDatabase(genomeId, dbType);
        if (associatedDb) {
          database = associatedDb;
          console.log(`🎯 [BlastFunctionTools] Auto-selected ${dbType} database: ${database} for genome: ${genomeId}`);
        } else {
          console.warn(`⚠️ [BlastFunctionTools] No ${dbType} database associated with genome: ${genomeId}`);
          throw new Error(
            `No ${dbType} database found for current genome. Please create a database first using blast_create_quick_db_for_current_genome.`
          );
        }
      } else {
        throw new Error('database parameter is required when no genome is loaded');
      }
    }

    try {
      // Execute local BLAST search
      const results = await this.blastManager.executeLocalBlast({
        sequence,
        blastType,
        database,
        evalue,
        maxTargets,
        wordSize: wordSize || (blastType === 'blastn' ? '11' : undefined),
        matrix: matrix || (blastType === 'blastp' ? 'BLOSUM62' : undefined),
      });

      return {
        success: true,
        source: 'Local BLAST+',
        isRealResults: results.isRealResults || false,
        results: results,
        parameters: { sequence, blastType, database, evalue, maxTargets },
        databasePath: this.blastManager.resolveDatabasePath(database),
        autoSelectedDatabase: !params.database, // Indicate if database was auto-selected
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        source: 'Local BLAST+',
        parameters: { sequence, blastType, database, evalue, maxTargets },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Execute batch BLAST search with multiple sequences
   */
  async executeBatchBlastSearch(params) {
    const { sequences, blastType, database, maxTargets = 10, searchType = 'local' } = params;

    if (!sequences || !Array.isArray(sequences) || sequences.length === 0) {
      throw new Error('sequences parameter must be a non-empty array');
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < sequences.length; i++) {
      const seq = sequences[i];
      const seqData = typeof seq === 'string' ? { sequence: seq, id: `seq_${i + 1}` } : seq;

      try {
        const searchParams = {
          sequence: seqData.sequence,
          blastType,
          database,
          maxTargets,
        };

        const result =
          searchType === 'online'
            ? await this.executeOnlineBlastSearch(searchParams)
            : await this.executeLocalBlastSearch(searchParams);

        results.push({
          sequenceId: seqData.id || `seq_${i + 1}`,
          sequenceName: seqData.name || seqData.id || `Sequence ${i + 1}`,
          ...result,
        });
      } catch (error) {
        errors.push({
          sequenceId: seqData.id || `seq_${i + 1}`,
          error: error.message,
        });
      }
    }

    return {
      success: errors.length === 0,
      totalSequences: sequences.length,
      successfulSearches: results.length,
      failedSearches: errors.length,
      results: results,
      errors: errors,
      searchType: searchType,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * BLAST a region from the loaded genome.
   */
  async blastSequenceFromRegion(params) {
    const { chromosome, start, end } = params;
    if (!chromosome || start === undefined || end === undefined) {
      throw new Error('chromosome, start, and end are required');
    }

    const genomeBrowser = this.getGenomeBrowser();
    if (!genomeBrowser) {
      throw new Error('Genome browser not available');
    }

    let sequence = '';
    if (typeof genomeBrowser.getSequenceForRegion === 'function') {
      sequence = await genomeBrowser.getSequenceForRegion(chromosome, Number(start), Number(end));
    } else {
      const chromosomeSequence = genomeBrowser.currentSequence?.[chromosome];
      if (!chromosomeSequence) {
        throw new Error(`No sequence data found for chromosome: ${chromosome}`);
      }
      sequence = chromosomeSequence.substring(Number(start) - 1, Number(end));
    }

    return this.executeBlastSearch({
      ...params,
      sequence,
      blastType: params.blastType || 'blastn',
    });
  }

  /**
   * Create BLAST database from FASTA file
   */
  async createBlastDatabase(params) {
    const { inputFile, dbName, dbType, title, parseSeqids = true, outputDir, requireApproval = true } = params;

    if (!inputFile) {
      throw new Error('inputFile parameter is required');
    }

    if (!dbName) {
      throw new Error('dbName parameter is required');
    }

    if (!dbType || !['nucl', 'prot'].includes(dbType)) {
      throw new Error('dbType must be either "nucl" or "prot"');
    }

    try {
      // Resolve where the database is written.
      //  - No outputDir: default to the directory of the currently loaded genome
      //    file. createLocalDatabase transparently falls back to the app temp
      //    directory if that location is blocked by the file-access policy.
      //  - Explicit outputDir: this is a deliberate, possibly out-of-sandbox
      //    location, so it requires additional permission approval (which may
      //    prompt the user with a folder picker). Internal genome tools that pass
      //    a pre-validated outputDir set requireApproval:false to skip the prompt.
      let resolvedOutputDir;
      if (outputDir) {
        if (requireApproval) {
          const approval = await this.blastManager.approveDatabaseDirectory(outputDir, { promptIfNeeded: true });
          if (!approval.approved) {
            return {
              success: false,
              error: approval.cancelled
                ? `Permission not granted: database directory selection was cancelled (${outputDir})`
                : `Permission denied for database directory: ${outputDir}`,
              parameters: { inputFile, dbName, dbType, outputDir },
              timestamp: new Date().toISOString(),
            };
          }
          resolvedOutputDir = approval.path;
        } else {
          resolvedOutputDir = outputDir;
        }
      } else {
        resolvedOutputDir = this.blastManager.getCurrentFileDirectory() || this.blastManager.config.localDbPath;
      }

      await this.blastManager.createLocalDatabase({
        inputFile,
        dbName,
        dbType,
        title: title || `${dbName} database`,
        parseSeqids,
        outputDir: resolvedOutputDir,
      });

      // Reload databases
      await this.blastManager.loadLocalDatabases();

      return {
        success: true,
        database: {
          name: dbName,
          type: dbType,
          title: title || `${dbName} database`,
          path: resolvedOutputDir,
        },
        message: `BLAST database "${dbName}" created successfully`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        parameters: { inputFile, dbName, dbType },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * List all available BLAST databases
   */
  async listBlastDatabases(params = {}) {
    const { includeOnline = true, includeLocal = true, includeCustom = true } = params;

    const databases = {
      online: [],
      local: [],
      custom: [],
    };

    // Online databases
    if (includeOnline) {
      databases.online = [
        { name: 'nt', type: 'nucleotide', description: 'Nucleotide collection (GenBank+EMBL+DDBJ+PDB)' },
        { name: 'nr', type: 'protein', description: 'Non-redundant protein sequences' },
        { name: 'refseq_rna', type: 'nucleotide', description: 'RefSeq RNA sequences' },
        { name: 'refseq_genomic', type: 'nucleotide', description: 'RefSeq Genome sequences' },
        { name: 'refseq_protein', type: 'protein', description: 'RefSeq Protein Database' },
        { name: 'swissprot', type: 'protein', description: 'UniProtKB/Swiss-Prot' },
        { name: 'pdb', type: 'protein', description: 'Protein Data Bank proteins' },
        { name: 'est', type: 'nucleotide', description: 'Expressed Sequence Tags' },
      ];
    }

    // Local databases
    if (includeLocal && this.blastManager.config.localDatabases) {
      for (const [name, info] of this.blastManager.config.localDatabases) {
        databases.local.push({
          name: name,
          type: info.type,
          description: info.description || `Local ${info.type} database`,
          path: info.path,
        });
      }
    }

    // Custom databases
    if (includeCustom && this.blastManager.customDatabases) {
      for (const [id, db] of this.blastManager.customDatabases) {
        if (db.status === 'ready') {
          databases.custom.push({
            id: id,
            name: db.name,
            type: db.type,
            description: db.description || `Custom ${db.type} database`,
            source: db.source,
            created: db.created,
          });
        }
      }
    }

    return {
      success: true,
      databases: databases,
      totalOnline: databases.online.length,
      totalLocal: databases.local.length,
      totalCustom: databases.custom.length,
      total: databases.online.length + databases.local.length + databases.custom.length,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get detailed information about a BLAST database
   */
  /**
   * Delete a BLAST database
   */
  async deleteBlastDatabase(params) {
    const database = params.database || params.dbName;

    if (!database) {
      throw new Error('dbName parameter is required');
    }

    if (params.confirm !== true) {
      return {
        success: false,
        error: 'confirm must be true to delete a BLAST database',
        database: database,
        dbName: database,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const customDbId = this.findCustomDatabaseId(database);
      if (customDbId && typeof this.blastManager.deleteCustomDatabase === 'function') {
        await this.blastManager.deleteCustomDatabase(customDbId);

        return {
          success: true,
          database: database,
          dbName: database,
          message: `Database "${database}" deleted successfully`,
          timestamp: new Date().toISOString(),
        };
      }

      const localDbName = this.findLocalDatabaseName(database);
      if (localDbName && typeof this.blastManager.deleteLocalDatabase === 'function') {
        await this.blastManager.deleteLocalDatabase(localDbName);

        return {
          success: true,
          database: database,
          dbName: database,
          message: `Database "${database}" deleted successfully`,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: false,
        error: `Database "${database}" not found`,
        database: database,
        dbName: database,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        database: database,
        dbName: database,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Create nucleotide database from loaded genome
   */
  async createDatabaseFromGenome(params) {
    const { chromosome, dbName, dbType = 'nucl' } = params;

    if (!chromosome) {
      throw new Error('chromosome parameter is required');
    }

    try {
      // Get genome data
      const genomeBrowser = this.getGenomeBrowser();
      if (!genomeBrowser) {
        throw new Error('Genome browser not available');
      }

      const genomeData = this.getChromosomeData(genomeBrowser, chromosome);
      if (!genomeData || !genomeData.sequence) {
        throw new Error(`No sequence data found for chromosome: ${chromosome}`);
      }

      // Generate database name if not provided
      const finalDbName = dbName || `${chromosome}_${dbType}_db`;

      // Create FASTA content
      const fastaContent = `>${chromosome}\n${genomeData.sequence}\n`;

      // Write to temporary file (genome directory, or approved temp fallback)
      const tempFile = await this.blastManager.writeSequenceToFile(fastaContent, finalDbName, dbType);

      // Co-locate the database with the already-approved temp FASTA. The directory
      // is pre-validated, so skip the explicit-directory approval prompt.
      const path = this.blastManager.getPathModule();
      const outputDir = path.dirname(tempFile);

      // Create database
      const result = await this.createBlastDatabase({
        inputFile: tempFile,
        dbName: finalDbName,
        dbType: dbType,
        title: `${finalDbName} - ${chromosome}`,
        parseSeqids: true,
        outputDir,
        requireApproval: false,
      });

      // Clean up temp file
      await this.blastManager.cleanupTempFile(tempFile);

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        parameters: { chromosome, dbName, dbType },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Create protein database from loaded genome (6-frame translation)
   */
  async createProteinDatabaseFromGenome(params) {
    const { chromosome, dbName } = params;

    if (!chromosome) {
      throw new Error('chromosome parameter is required');
    }

    try {
      // Get genome data
      const genomeBrowser = this.getGenomeBrowser();
      if (!genomeBrowser) {
        throw new Error('Genome browser not available');
      }

      const genomeData = this.getChromosomeData(genomeBrowser, chromosome);
      if (!genomeData || !genomeData.sequence) {
        throw new Error(`No sequence data found for chromosome: ${chromosome}`);
      }

      // Generate database name if not provided
      const finalDbName = dbName || `${chromosome}_protein_db`;

      // Translate DNA to proteins (6-frame translation)
      const fastaContent = this.blastManager.translateDNAToProteins(genomeData.sequence, chromosome);

      // Write to temporary file. writeSequenceToFile targets the genome directory
      // and transparently falls back to the app temp directory when the genome
      // directory is blocked by the CodeXomics file-access policy, so the returned
      // path is always inside a writable, approved location.
      const tempFile = await this.blastManager.writeSequenceToFile(fastaContent, finalDbName, 'prot');

      // Co-locate the BLAST database with the temp FASTA so makeblastdb writes to
      // the same approved directory. Without this, createBlastDatabase falls back to
      // config.localDbPath (e.g. <genome_dir>/blast_db), which is frequently outside
      // the approved roots and fails with a directory-permission error — the very
      // failure that blast_create_quick_db_for_current_genome avoids by passing an
      // explicit outputDir derived from the temp file.
      const path = this.blastManager.getPathModule();
      const outputDir = path.dirname(tempFile);

      // Create protein database
      const result = await this.createBlastDatabase({
        inputFile: tempFile,
        dbName: finalDbName,
        dbType: 'prot',
        title: `${finalDbName} - ${chromosome} proteins`,
        parseSeqids: true,
        outputDir,
        requireApproval: false,
      });

      // Clean up temp file
      await this.blastManager.cleanupTempFile(tempFile);

      return result;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        parameters: { chromosome, dbName },
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Parse BLAST results
   */
  async parseBlastResults(params) {
    const { resultsText, format = 'auto' } = params;

    if (!resultsText) {
      throw new Error('resultsText parameter is required');
    }

    try {
      const parsed = this.blastManager.parseBlastOutput(resultsText, { format });

      return {
        success: true,
        parsed: parsed,
        hitCount: parsed.hits?.length || 0,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Resolve the BLAST results a follow-up tool should act on.
   *
   * The published schemas let callers name a search by `searchId` (export) or hand back a
   * results object (filter), but an LLM cannot echo a whole result payload, so both tools
   * fall back to the search this session just ran - the one the caller is referring to.
   */
  resolveBlastResults(params = {}) {
    const requestedId = params.searchId || params.search_id || null;
    const passedResults = this.normalizeBlastResultsShape(params.results);
    if (passedResults) return passedResults;

    for (const candidate of [this.blastManager?.currentResults, this.blastManager?.searchResults]) {
      const normalized = this.normalizeBlastResultsShape(candidate);
      if (!normalized) continue;
      if (requestedId && normalized.searchId && String(normalized.searchId) !== String(requestedId)) {
        throw new Error(
          `No BLAST results found for searchId "${requestedId}"; the most recent search is "${normalized.searchId}".`
        );
      }
      return normalized;
    }
    return null;
  }

  /**
   * Reduce either shape a BLAST search returns - the raw results or the tool envelope that
   * wraps them - to a single results object that always exposes a hits array.
   */
  normalizeBlastResultsShape(candidate) {
    if (!candidate || typeof candidate !== 'object' || Array.isArray(candidate)) return null;

    const inner = candidate.results && typeof candidate.results === 'object' ? candidate.results : null;
    const source = Array.isArray(candidate.hits) ? candidate : inner || candidate;
    if (!source || typeof source !== 'object') return null;

    const searchId = source.searchId || candidate.searchId || null;
    if (Array.isArray(source.hits)) return { ...source, searchId };

    // A completed search with no matches still carries its query and parameter metadata.
    const looksLikeResults = ['queryInfo', 'parameters', 'searchId', 'rawText', 'rawOutput'].some(key => key in source);
    return looksLikeResults ? { ...source, hits: [], searchId } : null;
  }

  /**
   * Filter BLAST results based on criteria
   */
  async filterBlastResults(params) {
    const { minIdentity, maxEvalue, minCoverage, maxHits } = params;
    const results = this.resolveBlastResults(params);

    if (!results || !Array.isArray(results.hits)) {
      throw new Error(
        'No BLAST results to filter. Run a BLAST search first, or pass results (or searchId) from a previous search.'
      );
    }

    let filteredHits = results.hits;

    // Filter by identity
    if (minIdentity !== undefined) {
      filteredHits = filteredHits.filter(hit => {
        const identity = parseFloat(hit.identity) || 0;
        return identity >= minIdentity;
      });
    }

    // Filter by E-value
    if (maxEvalue !== undefined) {
      filteredHits = filteredHits.filter(hit => {
        const evalue = parseFloat(hit.evalue) || Infinity;
        return evalue <= maxEvalue;
      });
    }

    // Filter by coverage
    if (minCoverage !== undefined) {
      filteredHits = filteredHits.filter(hit => {
        const coverage = parseFloat(hit.coverage) || 0;
        return coverage >= minCoverage;
      });
    }

    // Limit number of hits
    if (maxHits !== undefined) {
      filteredHits = filteredHits.slice(0, maxHits);
    }

    const filteredResults = {
      ...results,
      hits: filteredHits,
      filtered: true,
      originalHitCount: results.hits.length,
      filters: { minIdentity, maxEvalue, minCoverage, maxHits },
      timestamp: new Date().toISOString(),
    };

    if (this.blastManager) {
      this.blastManager.searchResults = filteredResults;
      this.blastManager.currentResults = filteredResults;
    }

    return {
      success: true,
      originalHits: results.hits.length,
      filteredHits: filteredHits.length,
      results: filteredResults,
      filters: { minIdentity, maxEvalue, minCoverage, maxHits },
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Export BLAST results to file
   */
  async exportBlastResults(params) {
    const { format = 'tsv', outputPath } = params;
    const results = this.resolveBlastResults(params);

    if (!results) {
      throw new Error(
        'No BLAST results to export. Run a BLAST search first, or pass searchId (or results) from a previous search.'
      );
    }

    try {
      // Every advertised format now produces content: an unhandled one used to write an
      // empty file and report success.
      const content = this.formatBlastResultsForExport(results, format);

      if (outputPath) {
        if (!window.electronAPI?.writeFile) {
          throw new Error('Main-process file write API is unavailable');
        }
        const writeResult = await window.electronAPI.writeFile(outputPath, content);
        if (!writeResult?.success) {
          throw new Error(writeResult?.error || `Failed to export BLAST results to ${outputPath}`);
        }

        return {
          success: true,
          outputPath: writeResult.filePath || outputPath,
          format: format,
          searchId: results.searchId || null,
          hitCount: results.hits.length,
          size: content.length,
          timestamp: new Date().toISOString(),
        };
      } else {
        return {
          success: true,
          content: content,
          format: format,
          searchId: results.searchId || null,
          hitCount: results.hits.length,
          size: content.length,
          timestamp: new Date().toISOString(),
        };
      }
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Render BLAST results in one of the formats the export tool advertises.
   *
   * A search that matched nothing exports its header row or empty container rather than
   * failing: an empty result set is a real answer, and callers chain export unconditionally.
   */
  formatBlastResultsForExport(results, format) {
    const normalizedFormat = String(format || 'tsv').toLowerCase();
    const hits = Array.isArray(results.hits) ? results.hits : [];
    const columns = ['Hit ID', 'Accession', 'Description', 'E-value', 'Score', 'Identity', 'Coverage'];
    const fields = ['id', 'accession', 'description', 'evalue', 'score', 'identity', 'coverage'];
    const cell = hit => fields.map(field => (hit?.[field] === undefined || hit?.[field] === null ? '' : hit[field]));

    if (normalizedFormat === 'csv') {
      const escape = value => `"${String(value).replace(/"/g, '""')}"`;
      return [columns.map(escape).join(','), ...hits.map(hit => cell(hit).map(escape).join(','))].join('\n') + '\n';
    }

    if (normalizedFormat === 'tsv') {
      const escape = value => String(value).replace(/[\t\r\n]+/g, ' ');
      return [columns.map(escape).join('\t'), ...hits.map(hit => cell(hit).map(escape).join('\t'))].join('\n') + '\n';
    }

    if (normalizedFormat === 'json') {
      return JSON.stringify(results, null, 2);
    }

    if (normalizedFormat === 'xml') {
      const escape = value =>
        String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
      const hitXml = hits
        .map(hit => {
          const inner = fields.map(field => `      <${field}>${escape(hit?.[field] ?? '')}</${field}>`);
          return `    <Hit>\n${inner.join('\n')}\n    </Hit>`;
        })
        .join('\n');
      return `<?xml version="1.0"?>\n<BlastOutput>\n  <SearchId>${escape(results.searchId || '')}</SearchId>\n  <Hits>\n${hitXml}${hitXml ? '\n' : ''}  </Hits>\n</BlastOutput>\n`;
    }

    if (normalizedFormat === 'text') {
      return results.rawText || results.rawOutput || this.formatBlastResultsForExport(results, 'tsv');
    }

    throw new Error(`Unsupported export format "${format}". Supported formats: tsv, csv, json, xml, text.`);
  }

  /**
   * Detect sequence type (DNA/RNA/Protein)
   */
  async detectSequenceType(params) {
    const { sequence } = params;

    if (!sequence) {
      throw new Error('sequence parameter is required');
    }

    const type = this.blastManager.detectSequenceType(sequence);
    const normalizedType = String(type).toLowerCase();

    return {
      success: true,
      sequence: sequence.substring(0, 100) + (sequence.length > 100 ? '...' : ''),
      sequenceLength: sequence.length,
      detectedType: type,
      sequenceType: type,
      recommendedBlastType: normalizedType === 'protein' ? 'blastp' : 'blastn',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Validate BLAST database exists and is accessible
   */
  async validateDatabase(params) {
    const database = params.database || params.dbName;

    if (!database) {
      throw new Error('dbName parameter is required');
    }

    try {
      const blastType = params.blastType || this.getBlastTypeForDatabase(database, params.dbType);
      const databasePath = this.blastManager.resolveDatabasePath(database);
      const isValid = await this.blastManager.validateDatabase(databasePath, blastType);

      return {
        success: true,
        database: database,
        dbName: database,
        databasePath: databasePath,
        valid: isValid,
        isValid: isValid,
        blastType: blastType,
        issues: isValid ? [] : [`Database "${database}" was not found or failed BLAST validation`],
        message: isValid ? `BLAST database "${database}" is valid` : `BLAST database "${database}" is not valid`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        database: database,
        dbName: database,
        error: error.message,
        valid: false,
        isValid: false,
        issues: [error.message],
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Get BLAST+ installation status
   */
  async getInstallationStatus(params = {}) {
    try {
      const isInstalled = await this.blastManager.checkBlastInstallation();

      return {
        success: true,
        isInstalled: isInstalled,
        blastPath: this.blastManager.config.localBlastPath,
        databasePath: this.blastManager.config.localDbPath,
        version: this.blastManager.config.installedBlastVersion || 'Unknown',
        executablePath: this.blastManager.config.blastExecutablePath || null,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        isInstalled: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * Record tool execution for analytics
   */
  recordExecution(toolName, parameters, result, executionTime, success) {
    const record = {
      toolName,
      parameters,
      result: success ? { success: true } : { success: false, error: result.error },
      executionTime,
      success,
      timestamp: new Date().toISOString(),
    };

    this.executionHistory.push(record);

    // Update performance metrics
    if (!this.performanceMetrics.has(toolName)) {
      this.performanceMetrics.set(toolName, {
        totalExecutions: 0,
        successfulExecutions: 0,
        failedExecutions: 0,
        totalExecutionTime: 0,
        averageExecutionTime: 0,
      });
    }

    const metrics = this.performanceMetrics.get(toolName);
    metrics.totalExecutions++;
    if (success) {
      metrics.successfulExecutions++;
    } else {
      metrics.failedExecutions++;
    }
    metrics.totalExecutionTime += executionTime;
    metrics.averageExecutionTime = metrics.totalExecutionTime / metrics.totalExecutions;
  }

  findCustomDatabaseId(database) {
    if (!this.blastManager?.customDatabases) return null;
    if (this.blastManager.customDatabases.has(database)) return database;

    for (const [id, db] of this.blastManager.customDatabases.entries()) {
      if (db?.name === database || db?.dbName === database) {
        return id;
      }
    }
    return null;
  }

  findLocalDatabaseName(database) {
    if (!this.blastManager?.config?.localDatabases) return null;
    if (this.blastManager.config.localDatabases.has(database)) return database;

    for (const [name, db] of this.blastManager.config.localDatabases.entries()) {
      if (db?.name === database || db?.dbName === database) {
        return name;
      }
    }
    return null;
  }

  getBlastTypeForDatabase(database, dbType) {
    if (dbType) return this.normalizeDatabaseBlastType(dbType);

    const localDbName = this.findLocalDatabaseName(database);
    const localDb = localDbName ? this.blastManager.config.localDatabases.get(localDbName) : null;
    if (localDb?.type) return this.normalizeDatabaseBlastType(localDb.type);

    const customDbId = this.findCustomDatabaseId(database);
    const customDb = customDbId ? this.blastManager.customDatabases.get(customDbId) : null;
    if (customDb?.type) return this.normalizeDatabaseBlastType(customDb.type);

    return 'blastn';
  }

  normalizeDatabaseBlastType(type) {
    const normalized = String(type || '').toLowerCase();
    if (normalized === 'prot' || normalized === 'protein' || normalized === 'blastp' || normalized === 'blastx') {
      return 'blastp';
    }
    return 'blastn';
  }

  /**
   * Get execution statistics
   */
  getExecutionStats() {
    const stats = {
      totalExecutions: this.executionHistory.length,
      toolMetrics: {},
    };

    for (const [toolName, metrics] of this.performanceMetrics) {
      stats.toolMetrics[toolName] = {
        ...metrics,
        successRate:
          metrics.totalExecutions > 0
            ? ((metrics.successfulExecutions / metrics.totalExecutions) * 100).toFixed(2) + '%'
            : '0%',
      };
    }

    return stats;
  }

  /**
   * Get available tools list
   */
  getAvailableTools() {
    return Object.keys(this.toolMappings);
  }

  /**
   * Load genome-database associations from storage
   */
  loadGenomeDbAssociations() {
    try {
      const stored = localStorage.getItem('blast_genome_db_associations');
      if (stored) {
        const data = JSON.parse(stored);
        this.genomeDbAssociations = new Map(data);
        console.log(`🔗 [BlastFunctionTools] Loaded ${this.genomeDbAssociations.size} genome-database associations`);
      }
    } catch (error) {
      console.warn('⚠️ [BlastFunctionTools] Failed to load genome-database associations:', error);
      this.genomeDbAssociations = new Map();
    }
  }

  /**
   * Save genome-database associations to storage
   */
  saveGenomeDbAssociations() {
    try {
      const data = Array.from(this.genomeDbAssociations.entries());
      localStorage.setItem('blast_genome_db_associations', JSON.stringify(data));
      console.log(`💾 [BlastFunctionTools] Saved ${this.genomeDbAssociations.size} genome-database associations`);
    } catch (error) {
      console.error('❌ [BlastFunctionTools] Failed to save genome-database associations:', error);
    }
  }

  /**
   * Associate a database with a genome
   */
  associateDatabaseWithGenome(genomeId, dbName, dbType) {
    if (!this.genomeDbAssociations.has(genomeId)) {
      this.genomeDbAssociations.set(genomeId, {});
    }

    const associations = this.genomeDbAssociations.get(genomeId);
    if (dbType === 'nucl' || dbType === 'nucleotide') {
      associations.nucleotide = dbName;
    } else if (dbType === 'prot' || dbType === 'protein') {
      associations.protein = dbName;
    }

    this.saveGenomeDbAssociations();
    console.log(`🔗 [BlastFunctionTools] Associated ${dbType} database "${dbName}" with genome "${genomeId}"`);
  }

  /**
   * Get associated database for a genome
   */
  getAssociatedDatabase(genomeId, sequenceType = 'nucleotide') {
    const associations = this.genomeDbAssociations.get(genomeId);
    if (!associations) {
      return null;
    }

    if (sequenceType === 'nucleotide' || sequenceType === 'nucl') {
      return associations.nucleotide || null;
    } else if (sequenceType === 'protein' || sequenceType === 'prot') {
      return associations.protein || null;
    }

    return null;
  }

  getDatabaseTypeForBlastType(blastType) {
    const normalized = String(blastType || '').toLowerCase();
    if (normalized === 'blastp' || normalized === 'blastx') {
      return 'protein';
    }
    return 'nucleotide';
  }

  getGenomeBrowser() {
    return this.blastManager.app?.genomeBrowser || this.blastManager.app || null;
  }

  getChromosomeData(genomeBrowser, chromosome) {
    if (typeof genomeBrowser.getChromosomeData === 'function') {
      return genomeBrowser.getChromosomeData(chromosome);
    }

    const sequence = genomeBrowser.currentSequence?.[chromosome];
    if (!sequence) return null;
    return {
      chromosome,
      sequence,
      annotations: genomeBrowser.currentAnnotations?.[chromosome] || [],
    };
  }

  /**
   * Get current genome ID
   */
  getCurrentGenomeId() {
    // Resolve from the genome source rather than fileManager.currentFile, which
    // tracks the most recently loaded file of any type. A WIG track loaded after
    // the genome would otherwise re-key the genome-to-database associations.
    const genomeFilePath = this.blastManager.getCurrentGenomeFilePath?.();
    if (genomeFilePath) {
      const fileName = String(genomeFilePath).replace(/\\/g, '/').split('/').filter(Boolean).pop();
      return this.blastManager.stripGenomeFileExtension(fileName) || fileName;
    }

    // Fallback to current chromosome
    if (this.blastManager.app?.currentChromosome) {
      return this.blastManager.app.currentChromosome;
    }

    // Fallback to first sequence key
    const sequences = this.blastManager.app?.currentSequence;
    if (sequences && Object.keys(sequences).length > 0) {
      return Object.keys(sequences)[0];
    }

    return null;
  }

  /**
   * Create quick BLAST database for current genome (both nucleotide and protein)
   */
  async createQuickDbForCurrentGenome(params = {}) {
    const { createNucleotide = true, createProtein = true, genomeName } = params;

    try {
      // Check if there's a currently loaded genome
      if (!this.blastManager.app?.currentSequence || Object.keys(this.blastManager.app.currentSequence).length === 0) {
        throw new Error('No genome data loaded. Please load a genome first.');
      }

      const genomeId = genomeName || this.getCurrentGenomeId() || 'current_genome';
      const results = {
        success: true,
        genomeId: genomeId,
        databases: {},
        messages: [],
      };

      // Create nucleotide database
      if (createNucleotide) {
        try {
          const nuclResult = await this.blastManager.createQuickDatabase('nucl');
          if (nuclResult?.success) {
            const nuclDb = nuclResult.database;
            if (nuclDb?.id) {
              results.databases.nucleotide = {
                name: nuclDb.id,
                displayName: nuclDb.name,
                type: 'nucl',
                status: 'ready',
              };
              // Associate with genome
              this.associateDatabaseWithGenome(genomeId, nuclDb.id, 'nucl');
              results.messages.push(`Created nucleotide database: ${nuclDb.name}`);
            }
          }
        } catch (error) {
          results.messages.push(`Failed to create nucleotide database: ${error.message}`);
        }
      }

      // Create protein database
      if (createProtein) {
        try {
          const protResult = await this.blastManager.createQuickDatabase('prot');
          if (protResult?.success) {
            const protDb = protResult.database;
            if (protDb?.id) {
              results.databases.protein = {
                name: protDb.id,
                displayName: protDb.name,
                type: 'prot',
                status: 'ready',
              };
              // Associate with genome
              this.associateDatabaseWithGenome(genomeId, protDb.id, 'prot');
              results.messages.push(`Created protein database: ${protDb.name}`);
            }
          }
        } catch (error) {
          results.messages.push(`Failed to create protein database: ${error.message}`);
        }
      }

      const preferredBlastType = results.databases.nucleotide ? 'blastn' : results.databases.protein ? 'blastp' : null;
      if (preferredBlastType && typeof this.blastManager.refreshDatabaseUi === 'function') {
        this.blastManager.refreshDatabaseUi({ service: 'local', blastType: preferredBlastType });
      }

      results.timestamp = new Date().toISOString();
      return results;
    } catch (error) {
      return {
        success: false,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = BlastFunctionTools;
}
