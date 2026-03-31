/**
 * BlastService - Handles BLAST operations extracted from ChatManager
 */
class BlastService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  async blastSearch(params) {
    return this._executeBlastRequest('blastSearch', params);
  }

  async blastSequenceFromRegion(params) {
    return this._executeBlastRequest('blastSequenceFromRegion', params);
  }

  getBlastDatabases(params) {
    if (this.app.blastManager) {
      return this.app.blastManager.getDatabases(params);
    }
    throw new Error('BLAST Manager not available');
  }

  async batchBlastSearch(params) {
    return this._executeBlastRequest('batchBlastSearch', params);
  }

  async localBlastDatabaseInfo(params) {
    return this._executeBlastRequest('localBlastDatabaseInfo', params);
  }

  async advancedBlastSearch(params) {
    return this._executeBlastRequest('advancedBlastSearch', params);
  }

  // Internally delegates to the existing BLAST system
  async _executeBlastRequest(methodName, params) {
    // Priority logic matches the original executeToolByName fallback logic for BLAST
    
    // 1. If a BlastChatManagerIntegration exists, prefer that
    if (this.app.blastChatManagerIntegration && typeof this.app.blastChatManagerIntegration[methodName] === 'function') {
      return await this.app.blastChatManagerIntegration[methodName](params);
    }

    // 2. Otherwise execute directly through BlastManager
    if (this.app.blastManager) {
      // Basic check to see if BlastManager has the requested method
      if (typeof this.app.blastManager[methodName] === 'function') {
        return await this.app.blastManager[methodName](params);
      }
      
      // Attempt MCP blast tool fallback
      if (['blastSearch', 'batchBlastSearch', 'advancedBlastSearch'].includes(methodName)) {
        return await this.executeMCPBlastTool(methodName, params);
      }
    }

    throw new Error(`BLAST function '${methodName}' not found or BLAST system not initialized`);
  }

  async executeMCPBlastTool(toolName, params) {
    // Convert camelCase method names back to snake_case tool names for MCP execution
    const mcpToolMap = {
      'blastSearch': 'blast_search',
      'blastSequenceFromRegion': 'blast_sequence_from_region',
      'batchBlastSearch': 'batch_blast_search',
      'advancedBlastSearch': 'advanced_blast_search'
    };
    
    const mcpToolName = mcpToolMap[toolName] || toolName;

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
      // Apply e-value filter
      if (filters.eValueThreshold !== undefined && hit.eValue > filters.eValueThreshold) {
        return false;
      }
      
      // Apply identity filter
      if (filters.identityThreshold !== undefined && hit.percentageIdentity < filters.identityThreshold) {
        return false;
      }
      
      // Apply coverage filter
      if (filters.coverageThreshold !== undefined && hit.coverage < filters.coverageThreshold) {
        return false;
      }
      
      return true;
    });
  }
}

// Make it available globally if needed by plugin system
window.BlastService = BlastService;
