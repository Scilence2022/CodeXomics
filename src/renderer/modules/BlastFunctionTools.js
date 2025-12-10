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
            'blast_search_online': this.executeOnlineBlastSearch.bind(this),
            'blast_search_local': this.executeLocalBlastSearch.bind(this),
            'blast_search_batch': this.executeBatchBlastSearch.bind(this),
            
            // Database management
            'blast_create_database': this.createBlastDatabase.bind(this),
            'blast_list_databases': this.listBlastDatabases.bind(this),
            'blast_database_info': this.getBlastDatabaseInfo.bind(this),
            'blast_delete_database': this.deleteBlastDatabase.bind(this),
            
            // Database from loaded genomes
            'blast_create_db_from_genome': this.createDatabaseFromGenome.bind(this),
            'blast_create_protein_db_from_genome': this.createProteinDatabaseFromGenome.bind(this),
            
            // Search result analysis
            'blast_parse_results': this.parseBlastResults.bind(this),
            'blast_filter_results': this.filterBlastResults.bind(this),
            'blast_export_results': this.exportBlastResults.bind(this),
            
            // Utility tools
            'blast_detect_sequence_type': this.detectSequenceType.bind(this),
            'blast_validate_database': this.validateDatabase.bind(this),
            'blast_get_installation_status': this.getInstallationStatus.bind(this)
        };
        
        this.initialized = true;
        console.log(`✅ [BlastFunctionTools] Initialized ${Object.keys(this.toolMappings).length} BLAST tools`);
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
                maxTargets
            });
            
            return {
                success: true,
                source: 'NCBI Online',
                searchId: results.searchId || `NCBI_${Date.now()}`,
                results: results,
                parameters: { sequence, blastType, database, evalue, maxTargets },
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                source: 'NCBI Online',
                parameters: { sequence, blastType, database, evalue, maxTargets },
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Execute local BLAST search
     */
    async executeLocalBlastSearch(params) {
        const { sequence, blastType, database, evalue = '0.01', maxTargets = 50, wordSize, matrix } = params;
        
        if (!sequence) {
            throw new Error('Sequence parameter is required');
        }
        
        if (!blastType) {
            throw new Error('blastType parameter is required');
        }
        
        if (!database) {
            throw new Error('database parameter is required');
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
                matrix: matrix || (blastType === 'blastp' ? 'BLOSUM62' : undefined)
            });
            
            return {
                success: true,
                source: 'Local BLAST+',
                isRealResults: results.isRealResults || false,
                results: results,
                parameters: { sequence, blastType, database, evalue, maxTargets },
                databasePath: this.blastManager.resolveDatabasePath(database),
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                source: 'Local BLAST+',
                parameters: { sequence, blastType, database, evalue, maxTargets },
                timestamp: new Date().toISOString()
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
                    maxTargets
                };
                
                const result = searchType === 'online' 
                    ? await this.executeOnlineBlastSearch(searchParams)
                    : await this.executeLocalBlastSearch(searchParams);
                
                results.push({
                    sequenceId: seqData.id || `seq_${i + 1}`,
                    sequenceName: seqData.name || seqData.id || `Sequence ${i + 1}`,
                    ...result
                });
                
            } catch (error) {
                errors.push({
                    sequenceId: seqData.id || `seq_${i + 1}`,
                    error: error.message
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
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Create BLAST database from FASTA file
     */
    async createBlastDatabase(params) {
        const { inputFile, dbName, dbType, title, parseSeqids = true, outputDir } = params;
        
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
            await this.blastManager.createLocalDatabase({
                inputFile,
                dbName,
                dbType,
                title: title || `${dbName} database`,
                parseSeqids,
                outputDir: outputDir || this.blastManager.config.localDbPath
            });
            
            // Reload databases
            await this.blastManager.loadLocalDatabases();
            
            return {
                success: true,
                database: {
                    name: dbName,
                    type: dbType,
                    title: title || `${dbName} database`,
                    path: outputDir || this.blastManager.config.localDbPath
                },
                message: `BLAST database "${dbName}" created successfully`,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                parameters: { inputFile, dbName, dbType },
                timestamp: new Date().toISOString()
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
            custom: []
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
                { name: 'est', type: 'nucleotide', description: 'Expressed Sequence Tags' }
            ];
        }
        
        // Local databases
        if (includeLocal && this.blastManager.config.localDatabases) {
            for (const [name, info] of this.blastManager.config.localDatabases) {
                databases.local.push({
                    name: name,
                    type: info.type,
                    description: info.description || `Local ${info.type} database`,
                    path: info.path
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
                        created: db.created
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
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Get detailed information about a BLAST database
     */
    async getBlastDatabaseInfo(params) {
        const { database, databaseType = 'auto' } = params;
        
        if (!database) {
            throw new Error('database parameter is required');
        }
        
        try {
            // Try to get local database info
            if (this.blastManager.config.localDatabases.has(database)) {
                const dbInfo = this.blastManager.config.localDatabases.get(database);
                return {
                    success: true,
                    database: database,
                    type: dbInfo.type,
                    source: 'local',
                    info: dbInfo,
                    timestamp: new Date().toISOString()
                };
            }
            
            // Check custom databases
            for (const [id, db] of this.blastManager.customDatabases) {
                if (db.name === database || `custom_${id}` === database) {
                    return {
                        success: true,
                        database: database,
                        type: db.type,
                        source: 'custom',
                        info: db,
                        timestamp: new Date().toISOString()
                    };
                }
            }
            
            // Online database info
            const onlineInfo = this.blastManager.getDatabaseInfo(database);
            return {
                success: true,
                database: database,
                type: onlineInfo.type,
                source: 'online',
                info: onlineInfo,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                database: database,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Delete a BLAST database
     */
    async deleteBlastDatabase(params) {
        const { database } = params;
        
        if (!database) {
            throw new Error('database parameter is required');
        }
        
        try {
            // Only custom databases can be deleted
            let deleted = false;
            
            for (const [id, db] of this.blastManager.customDatabases) {
                if (db.name === database || `custom_${id}` === database) {
                    this.blastManager.customDatabases.delete(id);
                    deleted = true;
                    break;
                }
            }
            
            if (!deleted) {
                throw new Error(`Database "${database}" not found or cannot be deleted (only custom databases can be deleted)`);
            }
            
            // Update UI if available
            if (this.blastManager.updateExistingLocalDatabases) {
                this.blastManager.updateExistingLocalDatabases();
            }
            if (this.blastManager.updateDatabaseOptions) {
                this.blastManager.updateDatabaseOptions();
            }
            
            return {
                success: true,
                database: database,
                message: `Database "${database}" deleted successfully`,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                database: database,
                timestamp: new Date().toISOString()
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
            const genomeBrowser = this.blastManager.app?.genomeBrowser;
            if (!genomeBrowser) {
                throw new Error('Genome browser not available');
            }
            
            const genomeData = genomeBrowser.getChromosomeData(chromosome);
            if (!genomeData || !genomeData.sequence) {
                throw new Error(`No sequence data found for chromosome: ${chromosome}`);
            }
            
            // Generate database name if not provided
            const finalDbName = dbName || `${chromosome}_${dbType}_db`;
            
            // Create FASTA content
            const fastaContent = `>${chromosome}\n${genomeData.sequence}\n`;
            
            // Write to temporary file
            const tempFile = await this.blastManager.writeSequenceToFile(fastaContent, finalDbName, dbType);
            
            // Create database
            const result = await this.createBlastDatabase({
                inputFile: tempFile,
                dbName: finalDbName,
                dbType: dbType,
                title: `${finalDbName} - ${chromosome}`,
                parseSeqids: true
            });
            
            // Clean up temp file
            await this.blastManager.cleanupTempFile(tempFile);
            
            return result;
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                parameters: { chromosome, dbName, dbType },
                timestamp: new Date().toISOString()
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
            const genomeBrowser = this.blastManager.app?.genomeBrowser;
            if (!genomeBrowser) {
                throw new Error('Genome browser not available');
            }
            
            const genomeData = genomeBrowser.getChromosomeData(chromosome);
            if (!genomeData || !genomeData.sequence) {
                throw new Error(`No sequence data found for chromosome: ${chromosome}`);
            }
            
            // Generate database name if not provided
            const finalDbName = dbName || `${chromosome}_protein_db`;
            
            // Translate DNA to proteins (6-frame translation)
            const fastaContent = this.blastManager.translateDNAToProteins(genomeData.sequence, chromosome);
            
            // Write to temporary file
            const tempFile = await this.blastManager.writeSequenceToFile(fastaContent, finalDbName, 'prot');
            
            // Create protein database
            const result = await this.createBlastDatabase({
                inputFile: tempFile,
                dbName: finalDbName,
                dbType: 'prot',
                title: `${finalDbName} - ${chromosome} proteins`,
                parseSeqids: true
            });
            
            // Clean up temp file
            await this.blastManager.cleanupTempFile(tempFile);
            
            return result;
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                parameters: { chromosome, dbName },
                timestamp: new Date().toISOString()
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
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
    }

    /**
     * Filter BLAST results based on criteria
     */
    async filterBlastResults(params) {
        const { results, minIdentity, maxEvalue, minCoverage, maxHits } = params;
        
        if (!results || !results.hits) {
            throw new Error('results parameter with hits array is required');
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
        
        return {
            success: true,
            originalHits: results.hits.length,
            filteredHits: filteredHits.length,
            results: {
                ...results,
                hits: filteredHits
            },
            filters: { minIdentity, maxEvalue, minCoverage, maxHits },
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Export BLAST results to file
     */
    async exportBlastResults(params) {
        const { results, format = 'text', outputPath } = params;
        
        if (!results) {
            throw new Error('results parameter is required');
        }
        
        try {
            let content = '';
            
            if (format === 'text') {
                content = results.rawText || results.rawOutput || 'No raw output available';
            } else if (format === 'json') {
                content = JSON.stringify(results, null, 2);
            } else if (format === 'csv') {
                // Generate CSV format
                const hits = results.hits || [];
                content = 'Hit ID,Accession,Description,E-value,Score,Identity,Coverage\n';
                hits.forEach(hit => {
                    content += `"${hit.id}","${hit.accession}","${hit.description}","${hit.evalue}","${hit.score}","${hit.identity}","${hit.coverage}"\n`;
                });
            }
            
            if (outputPath) {
                const fs = require('fs').promises;
                await fs.writeFile(outputPath, content);
                
                return {
                    success: true,
                    outputPath: outputPath,
                    format: format,
                    size: content.length,
                    timestamp: new Date().toISOString()
                };
            } else {
                return {
                    success: true,
                    content: content,
                    format: format,
                    size: content.length,
                    timestamp: new Date().toISOString()
                };
            }
            
        } catch (error) {
            return {
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            };
        }
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
        
        return {
            success: true,
            sequence: sequence.substring(0, 100) + (sequence.length > 100 ? '...' : ''),
            sequenceLength: sequence.length,
            detectedType: type,
            recommendedBlastType: type === 'protein' ? 'blastp' : 'blastn',
            timestamp: new Date().toISOString()
        };
    }

    /**
     * Validate BLAST database exists and is accessible
     */
    async validateDatabase(params) {
        const { database, blastType } = params;
        
        if (!database) {
            throw new Error('database parameter is required');
        }
        
        try {
            const databasePath = this.blastManager.resolveDatabasePath(database);
            const isValid = await this.blastManager.validateDatabase(databasePath, blastType || 'blastn');
            
            return {
                success: true,
                database: database,
                databasePath: databasePath,
                isValid: isValid,
                blastType: blastType,
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                success: false,
                database: database,
                error: error.message,
                isValid: false,
                timestamp: new Date().toISOString()
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
                timestamp: new Date().toISOString()
            };
            
        } catch (error) {
            return {
                success: false,
                isInstalled: false,
                error: error.message,
                timestamp: new Date().toISOString()
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
            timestamp: new Date().toISOString()
        };
        
        this.executionHistory.push(record);
        
        // Update performance metrics
        if (!this.performanceMetrics.has(toolName)) {
            this.performanceMetrics.set(toolName, {
                totalExecutions: 0,
                successfulExecutions: 0,
                failedExecutions: 0,
                totalExecutionTime: 0,
                averageExecutionTime: 0
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

    /**
     * Get execution statistics
     */
    getExecutionStats() {
        const stats = {
            totalExecutions: this.executionHistory.length,
            toolMetrics: {}
        };
        
        for (const [toolName, metrics] of this.performanceMetrics) {
            stats.toolMetrics[toolName] = {
                ...metrics,
                successRate: metrics.totalExecutions > 0 
                    ? (metrics.successfulExecutions / metrics.totalExecutions * 100).toFixed(2) + '%'
                    : '0%'
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
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BlastFunctionTools;
}
