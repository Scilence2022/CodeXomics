// @ts-check
/**
 * BlastService - Handles BLAST operations extracted from ChatManager
 * All 16 builtInToolsMap BLAST methods are defined here with canonical
 * camelCase names matching _toCamelCase(snake_case_tool_name).
 */
class BlastService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  // --- Core search methods ---

  async blastSearch(params) {
    return this._executeBlastRequest('blastSearch', params);
  }

  async blastSearchOnline(params) {
    return this._executeBlastRequest('blastSearchOnline', params);
  }

  async blastSearchLocal(params) {
    return this._executeBlastRequest('blastSearchLocal', params);
  }

  async blastSearchBatch(params) {
    return this._executeBlastRequest('blastSearchBatch', params);
  }

  async blastSequenceFromRegion(params) {
    return this._executeBlastRequest('blastSequenceFromRegion', params);
  }

  // --- Database management methods ---

  async blastCreateDatabase(params) {
    return this._executeBlastRequest('blastCreateDatabase', params);
  }

  async blastListDatabases(params) {
    if (this.app.blastManager && typeof this.app.blastManager.getDatabases === 'function') {
      return this.app.blastManager.getDatabases(params);
    }
    return this._executeBlastRequest('blastListDatabases', params);
  }

  async blastDeleteDatabase(params) {
    return this._executeBlastRequest('blastDeleteDatabase', params);
  }

  async blastCreateDbFromGenome(params) {
    return this._executeBlastRequest('blastCreateDbFromGenome', params);
  }

  async blastCreateProteinDbFromGenome(params) {
    return this._executeBlastRequest('blastCreateProteinDbFromGenome', params);
  }

  async blastCreateQuickDbForCurrentGenome(params) {
    return this._executeBlastRequest('blastCreateQuickDbForCurrentGenome', params);
  }

  async blastValidateDatabase(params) {
    return this._executeBlastRequest('blastValidateDatabase', params);
  }

  // --- Result management methods ---

  async blastFilterResults(params) {
    return this._executeBlastRequest('blastFilterResults', params);
  }

  async blastExportResults(params) {
    return this._executeBlastRequest('blastExportResults', params);
  }

  async blastDetectSequenceType(params) {
    return this._executeBlastRequest('blastDetectSequenceType', params);
  }

  async blastGetInstallationStatus(params) {
    return this._executeBlastRequest('blastGetInstallationStatus', params);
  }

  // --- Legacy alias methods (backward compatibility) ---

  async getBlastDatabases(params) {
    return this.blastListDatabases(params);
  }

  async batchBlastSearch(params) {
    return this.blastSearchBatch(params);
  }

  async advancedBlastSearch(params) {
    return this.blastSearchOnline(params);
  }

  async localBlastDatabaseInfo(params) {
    return this.blastListDatabases(params);
  }

  // --- Internal delegation ---

  async _executeBlastRequest(methodName, params) {
    const normalizedParams = this._normalizeBlastParams(methodName, params || {});

    // Priority 1: If BlastChatManagerIntegration (BlastFunctionTools) is available, prefer that
    if (this.chatManager.blastFunctionTools && typeof this.chatManager.blastFunctionTools.executeTool === 'function') {
      const snakeName = this._toSnakeCase(methodName);
      try {
        const result = await this.chatManager.blastFunctionTools.executeTool(snakeName, normalizedParams);
        if (result !== undefined) return result;
      } catch (e) {
        console.warn(`[BlastService] BlastFunctionTools.executeTool('${snakeName}') failed, falling back:`, e.message);
      }
    }

    // Priority 2: Direct BlastManager-backed implementations for core BLAST tools
    const directResult = await this._executeDirectBlastManagerRequest(methodName, normalizedParams);
    if (directResult !== undefined) {
      return directResult;
    }

    if (methodName === 'blastSequenceFromRegion') {
      return await this._blastSequenceFromRegionDirect(normalizedParams);
    }

    // Priority 3: Direct ChatManager prototype method (from BlastChatManagerIntegration)
    if (typeof this.chatManager[methodName] === 'function') {
      try {
        return await this.chatManager[methodName](normalizedParams);
      } catch (e) {
        console.warn(`[BlastService] ChatManager.${methodName}() failed, falling back:`, e.message);
      }
    }

    // Priority 4: BlastManager direct
    if (this.app.blastManager && typeof this.app.blastManager[methodName] === 'function') {
      return await this.app.blastManager[methodName](normalizedParams);
    }

    // Priority 5: MCP blast tool fallback for search operations
    const searchMethods = [
      'blastSearch',
      'blastSearchOnline',
      'blastSearchLocal',
      'blastSearchBatch',
      'blastSequenceFromRegion',
    ];
    if (searchMethods.includes(methodName)) {
      try {
        return await this.executeMCPBlastTool(methodName, normalizedParams);
      } catch (e) {
        console.warn(`[BlastService] MCP fallback failed for ${methodName}:`, e.message);
      }
    }

    throw new Error(`BLAST function '${methodName}' not found or BLAST system not initialized`);
  }

  async _executeDirectBlastManagerRequest(methodName, params) {
    const blastManager = this.app.blastManager;
    if (!blastManager) return undefined;

    switch (methodName) {
      case 'blastSearch':
        if (typeof blastManager.executeBlastSearch === 'function') {
          return await blastManager.executeBlastSearch(params);
        }
        return undefined;
      case 'blastValidateDatabase':
        return await this._validateDatabaseDirect(params);
      case 'blastDeleteDatabase':
        return await this._deleteDatabaseDirect(params);
      case 'blastExportResults':
        return await this._exportResultsDirect(params);
      case 'blastFilterResults':
        return this._filterResultsDirect(params);
      case 'blastDetectSequenceType':
        return this._detectSequenceTypeDirect(params);
      default:
        return undefined;
    }
  }

  async _validateDatabaseDirect(params) {
    const database = this._getDatabaseName(params);
    if (!database) {
      throw new Error('dbName parameter is required');
    }
    if (typeof this.app.blastManager.validateDatabase !== 'function') return undefined;

    try {
      const databasePath = this.app.blastManager.resolveDatabasePath(database);
      const blastType = this._inferBlastType(database, params);
      const isValid = await this.app.blastManager.validateDatabase(databasePath, blastType);

      return {
        success: true,
        database,
        dbName: database,
        databasePath,
        valid: isValid,
        isValid,
        blastType,
        issues: isValid ? [] : [`Database "${database}" was not found or failed BLAST validation`],
        message: isValid ? `BLAST database "${database}" is valid` : `BLAST database "${database}" is not valid`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        database,
        dbName: database,
        valid: false,
        isValid: false,
        issues: [error.message],
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async _deleteDatabaseDirect(params) {
    const database = this._getDatabaseName(params);
    if (!database) {
      throw new Error('dbName parameter is required');
    }
    if (params.confirm !== true) {
      return {
        success: false,
        database,
        dbName: database,
        error: 'confirm must be true to delete a BLAST database',
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const customId = this._findCustomDatabaseId(database);
      if (customId && typeof this.app.blastManager.deleteCustomDatabase === 'function') {
        await this.app.blastManager.deleteCustomDatabase(customId);
        return {
          success: true,
          database,
          dbName: database,
          message: `BLAST database "${database}" deleted successfully`,
          timestamp: new Date().toISOString(),
        };
      }

      const localName = this._findLocalDatabaseName(database);
      if (localName && typeof this.app.blastManager.deleteLocalDatabase === 'function') {
        await this.app.blastManager.deleteLocalDatabase(localName);
        return {
          success: true,
          database,
          dbName: database,
          message: `BLAST database "${database}" deleted successfully`,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: false,
        database,
        dbName: database,
        error: `Database "${database}" not found`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        database,
        dbName: database,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async _exportResultsDirect(params) {
    const results = this._resolveBlastResults(params);
    const searchId = params.searchId || results?.searchId || results?.jobId || null;
    if (!results) {
      return {
        success: false,
        searchId,
        error: searchId ? `BLAST results not found for searchId "${searchId}"` : 'No BLAST results available to export',
        timestamp: new Date().toISOString(),
      };
    }

    const format = String(params.format || 'tsv').toLowerCase();
    const supportedFormats = ['tsv', 'csv', 'json', 'xml'];
    if (!supportedFormats.includes(format)) {
      return {
        success: false,
        searchId,
        error: `Unsupported BLAST export format: ${format}`,
        timestamp: new Date().toISOString(),
      };
    }

    try {
      const content = this._formatBlastResults(results, format);
      if (params.outputPath) {
        if (!window.electronAPI?.writeFile) {
          throw new Error('Main-process file write API is unavailable');
        }
        const writeResult = await window.electronAPI.writeFile(params.outputPath, content);
        if (!writeResult?.success) {
          throw new Error(writeResult?.error || `Failed to export BLAST results to ${params.outputPath}`);
        }
        return {
          success: true,
          searchId,
          filePath: writeResult.filePath || params.outputPath,
          outputPath: writeResult.filePath || params.outputPath,
          format,
          size: content.length,
          message: `BLAST results exported to ${writeResult.filePath || params.outputPath}`,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        searchId,
        content,
        format,
        size: content.length,
        message: `BLAST results exported as ${format}`,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        searchId,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  _filterResultsDirect(params) {
    const sourceResults = params.results || this._resolveBlastResults(params);
    if (!sourceResults || !Array.isArray(sourceResults.hits)) {
      throw new Error('results parameter with hits array is required');
    }

    let hits = [...sourceResults.hits];
    if (params.minIdentity !== undefined) {
      hits = hits.filter(
        hit => this._parsePercent(hit.identityPercent ?? hit.percentageIdentity ?? hit.identity) >= params.minIdentity
      );
    }
    if (params.maxEvalue !== undefined) {
      hits = hits.filter(hit => this._parseNumber(hit.evalue, Infinity) <= params.maxEvalue);
    }
    if (params.minCoverage !== undefined) {
      hits = hits.filter(
        hit => this._parsePercent(hit.coverage ?? hit.queryCoverage ?? hit.qcovs) >= params.minCoverage
      );
    }
    if (params.maxHits !== undefined) {
      hits = hits.slice(0, Number(params.maxHits));
    }

    const filteredResults = {
      ...sourceResults,
      hits,
      filtered: true,
      originalHitCount: sourceResults.hits.length,
      filters: {
        minIdentity: params.minIdentity,
        maxEvalue: params.maxEvalue,
        minCoverage: params.minCoverage,
        maxHits: params.maxHits,
      },
      timestamp: new Date().toISOString(),
    };

    if (this.app.blastManager) {
      this.app.blastManager.searchResults = filteredResults;
      this.app.blastManager.currentResults = filteredResults;
    }

    return {
      success: true,
      originalHits: sourceResults.hits.length,
      filteredHits: hits.length,
      results: filteredResults,
      timestamp: new Date().toISOString(),
    };
  }

  _detectSequenceTypeDirect(params) {
    const sequence = params.sequence;
    if (!sequence) {
      throw new Error('sequence parameter is required');
    }

    const detected = this.app.blastManager?.detectSequenceType
      ? this.app.blastManager.detectSequenceType(sequence)
      : this._detectSequenceTypeFallback(sequence);
    const type = this._normalizeSequenceType(detected);

    return {
      success: true,
      type,
      detectedType: detected,
      sequenceType: detected,
      confidence: type === 'unknown' ? 0.2 : 0.95,
      recommendedBlastType: type === 'protein' ? 'blastp' : 'blastn',
      message: `Detected ${detected} sequence`,
      timestamp: new Date().toISOString(),
    };
  }

  async _blastSequenceFromRegionDirect(params) {
    const { chromosome, start, end } = params;
    if (!chromosome || start === undefined || end === undefined) {
      throw new Error('chromosome, start, and end are required');
    }

    let sequence = '';
    if (typeof this.app.getSequenceForRegion === 'function') {
      sequence = await this.app.getSequenceForRegion(chromosome, Number(start), Number(end));
    } else {
      const chromosomeSequence = this.app.currentSequence?.[chromosome];
      if (!chromosomeSequence) {
        throw new Error(`No sequence data found for chromosome: ${chromosome}`);
      }
      sequence = chromosomeSequence.substring(Number(start) - 1, Number(end));
    }

    return this._executeBlastRequest('blastSearch', {
      ...params,
      sequence,
      blastType: params.blastType || 'blastn',
    });
  }

  async executeMCPBlastTool(toolName, params) {
    const mcpToolMap = {
      blastSearch: 'blast_search',
      blastSearchOnline: 'blast_search_online',
      blastSearchLocal: 'blast_search_local',
      blastSearchBatch: 'blast_search_batch',
      blastSequenceFromRegion: 'blast_sequence_from_region',
    };

    const mcpToolName = mcpToolMap[toolName] || this._toSnakeCase(toolName);

    if (!this.chatManager.mcpServerManager) {
      throw new Error('MCP Server Manager not initialized');
    }

    const mcpTool = this.chatManager.mcpServerManager.getAllAvailableTools().find(t => t.name === mcpToolName);
    if (mcpTool) {
      return await this.chatManager.mcpServerManager.executeToolOnServer(mcpTool.serverId, mcpToolName, params);
    }

    throw new Error(`BLAST tool '${mcpToolName}' not found in any connected MCP server`);
  }

  applyBlastFilters(hits, filters) {
    if (!filters || Object.keys(filters).length === 0) return hits;

    return hits.filter(hit => {
      if (filters.eValueThreshold !== undefined && hit.eValue > filters.eValueThreshold) {
        return false;
      }
      if (filters.identityThreshold !== undefined && hit.percentageIdentity < filters.identityThreshold) {
        return false;
      }
      if (filters.coverageThreshold !== undefined && hit.coverage < filters.coverageThreshold) {
        return false;
      }
      return true;
    });
  }

  _toSnakeCase(str) {
    return str.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  }

  _normalizeBlastParams(methodName, params) {
    const normalized = { ...params };

    if ((methodName === 'blastValidateDatabase' || methodName === 'blastDeleteDatabase') && normalized.dbName) {
      normalized.database = normalized.database || normalized.dbName;
    }
    if (methodName === 'blastValidateDatabase' && normalized.dbType && !normalized.blastType) {
      normalized.blastType = normalized.dbType === 'prot' ? 'blastp' : 'blastn';
    }

    return normalized;
  }

  _getDatabaseName(params = {}) {
    return params.database || params.dbName || params.name || null;
  }

  _inferBlastType(database, params = {}) {
    if (params.blastType) return params.blastType;
    if (params.dbType) return params.dbType === 'prot' ? 'blastp' : 'blastn';

    const localDb = this.app.blastManager?.config?.localDatabases?.get(database);
    if (localDb?.type) {
      return this._normalizeDatabaseBlastType(localDb.type);
    }

    const customId = this._findCustomDatabaseId(database);
    const customDb = customId ? this.app.blastManager?.customDatabases?.get(customId) : null;
    if (customDb?.type) {
      return this._normalizeDatabaseBlastType(customDb.type);
    }

    return 'blastn';
  }

  _normalizeDatabaseBlastType(type) {
    const normalized = String(type || '').toLowerCase();
    if (normalized === 'prot' || normalized === 'protein' || normalized === 'blastp' || normalized === 'blastx') {
      return 'blastp';
    }
    return 'blastn';
  }

  _findCustomDatabaseId(database) {
    const databases = this.app.blastManager?.customDatabases;
    if (!databases) return null;
    if (databases.has(database)) return database;

    for (const [id, db] of databases.entries()) {
      if (db?.name === database || db?.dbName === database) {
        return id;
      }
    }
    return null;
  }

  _findLocalDatabaseName(database) {
    const databases = this.app.blastManager?.config?.localDatabases;
    if (!databases) return null;
    if (databases.has(database)) return database;

    for (const [name, info] of databases.entries()) {
      if (info?.name === database || info?.dbName === database) {
        return name;
      }
    }
    return null;
  }

  _resolveBlastResults(params = {}) {
    if (params.results && Array.isArray(params.results.hits)) return params.results;
    if (params.results?.results && Array.isArray(params.results.results.hits)) return params.results.results;

    const searchId = params.searchId;
    const candidates = [
      this.app.blastManager?.searchResults,
      this.app.blastManager?.currentResults,
      this.chatManager?.lastBlastResults,
    ].filter(Boolean);

    if (!searchId) {
      return this._unwrapBlastResults(candidates[0]) || null;
    }

    const match = candidates.find(
      result =>
        result?.searchId === searchId ||
        result?.jobId === searchId ||
        result?.id === searchId ||
        result?.results?.searchId === searchId ||
        result?.results?.jobId === searchId
    );
    return this._unwrapBlastResults(match) || null;
  }

  _unwrapBlastResults(result) {
    if (!result) return null;
    if (Array.isArray(result.hits)) return result;
    if (Array.isArray(result.results?.hits)) return result.results;
    return null;
  }

  _formatBlastResults(results, format) {
    if (format === 'json') {
      return JSON.stringify(results, null, 2);
    }
    if (format === 'xml') {
      return results.rawXML || this._buildBlastXml(results);
    }

    const columns = ['id', 'accession', 'description', 'evalue', 'score', 'identity', 'coverage', 'alignmentLength'];
    const separator = format === 'csv' ? ',' : '\t';
    const rows = [columns.join(separator)];
    for (const hit of results.hits || []) {
      rows.push(columns.map(column => this._formatDelimitedValue(hit[column], format)).join(separator));
    }
    return `${rows.join('\n')}\n`;
  }

  _formatDelimitedValue(value, format) {
    const normalized = value === undefined || value === null ? '' : String(value);
    if (format === 'tsv') {
      return normalized.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
    }
    const escaped = normalized.replace(/"/g, '""').replace(/\r?\n/g, ' ');
    return /[",\n]/.test(escaped) ? `"${escaped}"` : escaped;
  }

  _buildBlastXml(results) {
    const hits = (results.hits || [])
      .map(
        hit =>
          `  <Hit><Hit_id>${this._escapeXml(hit.id || hit.accession || '')}</Hit_id><Hit_def>${this._escapeXml(
            hit.description || ''
          )}</Hit_def><Hit_evalue>${this._escapeXml(hit.evalue || '')}</Hit_evalue></Hit>`
      )
      .join('\n');
    return [
      '<BlastOutput>',
      `<BlastOutput_query-ID>${this._escapeXml(results.searchId || '')}</BlastOutput_query-ID>`,
      `<BlastOutput_iterations>\n${hits}\n</BlastOutput_iterations>`,
      '</BlastOutput>',
      '',
    ].join('\n');
  }

  _escapeXml(value) {
    return String(value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  _parsePercent(value) {
    return this._parseNumber(String(value ?? '').replace('%', ''), 0);
  }

  _parseNumber(value, fallback = 0) {
    const parsed = Number.parseFloat(value);
    return Number.isNaN(parsed) ? fallback : parsed;
  }

  _normalizeSequenceType(value) {
    const normalized = String(value || '').toLowerCase();
    if (normalized.includes('protein')) return 'protein';
    if (normalized.includes('rna')) return 'rna';
    if (normalized.includes('dna')) return 'dna';
    return 'unknown';
  }

  _detectSequenceTypeFallback(sequence) {
    const cleaned = String(sequence || '')
      .replace(/[^A-Z]/gi, '')
      .toUpperCase();
    if (!cleaned) return 'Unknown';
    if (/^[ATGCRYSWKMBDHVN]+$/.test(cleaned)) return 'DNA';
    return 'Protein';
  }
}

window.BlastService = BlastService;
