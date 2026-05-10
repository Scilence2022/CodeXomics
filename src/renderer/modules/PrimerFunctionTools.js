/**
 * Primer Function Tools - AI-Integrated Primer Design and Analysis
 * Provides primer property calculation, primer design, and site analysis
 * Integrated with Dynamic Tools Registry for LLM function calling
 * Schemas sourced from PrimerToolSchemas.js (single source of truth)
 */

class PrimerFunctionTools {
  constructor(app) {
    this.app = app;
    this.tools = {};
    this.PrimerDesigner = null;

    this._resolveDesigner();

    this.initializeTools();
  }

  _resolveDesigner() {
    if (typeof window !== 'undefined' && typeof window.PrimerDesigner !== 'undefined') {
      this.PrimerDesigner = window.PrimerDesigner;
    }
  }

  async _ensureDesigner() {
    if (this.PrimerDesigner) return;

    this._resolveDesigner();

    if (!this.PrimerDesigner) {
      throw new Error('PrimerDesigner is not available. Ensure PrimerDesigner.js is loaded before calling primer tools.');
    }
  }

  _getSchemas() {
    if (typeof window !== 'undefined' && window.PRIMER_TOOL_SCHEMAS) {
      return window.PRIMER_TOOL_SCHEMAS;
    }
    try {
      return require('./PrimerToolSchemas');
    } catch (e) {
      return null;
    }
  }

  initializeTools() {
    const schemas = this._getSchemas();

    const buildTool = (name, executeFn) => {
      const schema = schemas ? schemas[name] : null;
      return {
        name: schema ? schema.name : name,
        description: schema ? schema.description : name,
        parameters: schema ? schema.parameters : {type: 'object', properties: {}},
        execute: executeFn,
      };
    };

    this.tools = {
      calculate_primer_properties: buildTool('calculate_primer_properties', async (params) => {
        await this._ensureDesigner();
        return this.PrimerDesigner.calculateProperties(params.sequence);
      }),

      design_primers: buildTool('design_primers', async (params) => {
        await this._ensureDesigner();
        const options = {
          targetTm: params.targetTm || 60.0,
          minProductSize: params.minProductSize || 100,
        };
        const pair = this.PrimerDesigner.designPrimerPair(params.targetSequence, options);
        return pair || {error: 'Could not find a valid primer pair meeting the criteria in the given sequence'};
      }),

      find_primer_binding_sites: buildTool('find_primer_binding_sites', async (params) => {
        await this._ensureDesigner();
        return {
          queryLength: params.primerSequence.length,
          sites: this.PrimerDesigner.findBindingSites(
              params.primerSequence,
              params.templateSequence,
              params.maxMismatches || 0,
          ),
        };
      }),

      add_primer_annotation: buildTool('add_primer_annotation', async (params) => {
        throw new Error('add_primer_annotation requires UI interaction — use PrimerChatManagerIntegration.primerAddAnnotation instead');
      }),
    };
  }

  async executeTool(toolName, parameters) {
    if (!this.tools[toolName]) {
      throw new Error(`Primer tool '${toolName}' not found`);
    }

    try {
      const startTime = Date.now();
      const result = await this.tools[toolName].execute(parameters);
      const executionTime = Date.now() - startTime;
      console.log(`🧬 [Primer Tools] Execution time for ${toolName}: ${executionTime}ms`);
      return result;
    } catch (error) {
      console.error(`❌ [Primer Tools] Tool execution failed for ${toolName}:`, error);
      throw error;
    }
  }

  getAvailableTools() {
    return Object.values(this.tools).map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: tool.parameters,
    }));
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrimerFunctionTools;
}
if (typeof window !== 'undefined') {
  window.PrimerFunctionTools = PrimerFunctionTools;
}
