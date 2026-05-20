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
    // Priority 1: If BlastChatManagerIntegration (BlastFunctionTools) is available, prefer that
    if (this.chatManager.blastFunctionTools && typeof this.chatManager.blastFunctionTools.executeTool === 'function') {
      const snakeName = this._toSnakeCase(methodName);
      try {
        const result = await this.chatManager.blastFunctionTools.executeTool(snakeName, params);
        if (result !== undefined) return result;
      } catch (e) {
        console.warn(`[BlastService] BlastFunctionTools.executeTool('${snakeName}') failed, falling back:`, e.message);
      }
    }

    // Priority 2: Direct ChatManager prototype method (from BlastChatManagerIntegration)
    if (typeof this.chatManager[methodName] === 'function') {
      try {
        return await this.chatManager[methodName](params);
      } catch (e) {
        console.warn(`[BlastService] ChatManager.${methodName}() failed, falling back:`, e.message);
      }
    }

    // Priority 3: BlastManager direct
    if (this.app.blastManager && typeof this.app.blastManager[methodName] === 'function') {
      return await this.app.blastManager[methodName](params);
    }

    // Priority 4: MCP blast tool fallback for search operations
    const searchMethods = [
      'blastSearch',
      'blastSearchOnline',
      'blastSearchLocal',
      'blastSearchBatch',
      'blastSequenceFromRegion',
    ];
    if (searchMethods.includes(methodName)) {
      try {
        return await this.executeMCPBlastTool(methodName, params);
      } catch (e) {
        console.warn(`[BlastService] MCP fallback failed for ${methodName}:`, e.message);
      }
    }

    throw new Error(`BLAST function '${methodName}' not found or BLAST system not initialized`);
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
}

window.BlastService = BlastService;
