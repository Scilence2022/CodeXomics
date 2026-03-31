/**
 * ToolExecutionService - Tool routing logic extracted from ChatManager
 */
class ToolExecutionService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  async execute(toolName, parameters) {
    try {
      console.log(`[ToolExecutionService] Executing: ${toolName}`, parameters);

      // --- PRIORITY 1: MULTI-AGENT SETTINGS (if handled exclusively) ---
      if (['update_agent_setting', 'get_agent_settings', 'toggle_agent_mode'].includes(toolName) && this.chatManager.agentSettingsManager) {
        const handlerName = toolName.replace(/([-_][a-z])/ig, ($1) => $1.toUpperCase().replace('-', '').replace('_', ''));
        if (typeof this.chatManager.agentSettingsManager[handlerName] === 'function') {
          return await this.chatManager.agentSettingsManager[handlerName](parameters);
        }
      }

      // --- PRIORITY 2: NEW EXTRACTED SERVICES ---
      // 1. File Operation Services
      const fileService = new window.FileOperationService(this.app, this.chatManager);
      if (typeof fileService[this._toCamelCase(toolName)] === 'function') {
        return await fileService[this._toCamelCase(toolName)](parameters);
      }

      // 2. Annotation Services
      const annotationService = new window.AnnotationService(this.app, this.chatManager);
      if (typeof annotationService[this._toCamelCase(toolName)] === 'function') {
        return await annotationService[this._toCamelCase(toolName)](parameters);
      }

      // 3. BLAST Services
      const blastService = new window.BlastService(this.app, this.chatManager);
      if (typeof blastService[this._toCamelCase(toolName)] === 'function') {
        return await blastService[this._toCamelCase(toolName)](parameters);
      }

      // 4. Protein Services
      const proteinService = new window.ProteinService(this.app, this.chatManager);
      if (typeof proteinService[this._toCamelCase(toolName)] === 'function') {
        return await proteinService[this._toCamelCase(toolName)](parameters);
      }

      // 5. Genome Analysis Services
      const analysisService = new window.GenomeAnalysisService(this.app, this.chatManager);
      if (typeof analysisService[this._toCamelCase(toolName)] === 'function') {
        return await analysisService[this._toCamelCase(toolName)](parameters);
      }

      // --- PRIORITY 3: MCP DIRECT INTERACTION STACK ---
      // Check for specifically routed tools to specific agents
      const routerResult = await this.chatManager._routeToolToAgent(toolName, parameters);
      if (routerResult && routerResult.handled) {
          return routerResult.result;
      }

      // Check if it's an MCP tool globally available
      if (this.chatManager.mcpServerManager) {
        const mcpTool = this.chatManager.mcpServerManager.getAllAvailableTools().find(t => t.name === toolName);
        if (mcpTool) {
          return await this.chatManager.mcpServerManager.executeToolOnServer(mcpTool.serverId, toolName, parameters);
        }
      }

      // --- PRIORITY 4: DYNAMIC REGISTRY TOOLS (Plugin Integrator) ---
      if (window.toolsRegistry && window.toolsRegistry[toolName]) {
        console.log(`[ToolExecutionService] Executing dynamic tool: ${toolName}`);
        
        if (this.app.toolsIntegrator) {
           return await this.app.toolsIntegrator.executeTool(toolName, parameters);
        } else if (typeof window.executeDynamicTool === 'function') {
           return await window.executeDynamicTool(toolName, parameters);
        }
      }

      // --- PRIORITY 5: LOCAL NATIVE FALLBACKS ---
      // We will map any remaining ChatManager functions manually
      const camelCaseMethod = this._toCamelCase(toolName);
      if (typeof this.chatManager[camelCaseMethod] === 'function') {
         return await this.chatManager[camelCaseMethod](parameters);
      }

      // Special cases
      switch (toolName) {
        case 'navigate_to_position':
        case 'navigate_to':
          if (this.app.uiManager) {
            this.app.uiManager.navigateTo(parameters.chromosome, parameters.start, parameters.end);
            return { success: true };
          }
          break;
        case 'zoom_in':
          if (this.app.uiManager) { this.app.uiManager.zoom('in'); return { success: true }; }
          break;
        case 'zoom_out':
          if (this.app.uiManager) { this.app.uiManager.zoom('out'); return { success: true }; }
          break;
      }

      throw new Error(`Unknown tool: ${toolName}`);
    } catch (error) {
      console.error(`[ToolExecutionService] Error executing tool: ${toolName}`, error);
      throw error;
    }
  }

  // Utility to convert snake_case (MCP format) to camelCase (JS method format)
  _toCamelCase(str) {
    return str.replace(/([-_][a-z])/ig, ($1) => {
      return $1.toUpperCase().replace('-', '').replace('_', '');
    });
  }
}

// Make it available globally if needed by plugin system
window.ToolExecutionService = ToolExecutionService;
