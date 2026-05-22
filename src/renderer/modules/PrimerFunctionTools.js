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
      throw new Error(
        'PrimerDesigner is not available. Ensure PrimerDesigner.js is loaded before calling primer tools.'
      );
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
        parameters: schema ? schema.parameters : { type: 'object', properties: {} },
        execute: executeFn,
      };
    };

    this.tools = {
      calculate_primer_properties: buildTool('calculate_primer_properties', async params => {
        await this._ensureDesigner();
        return this.PrimerDesigner.calculateProperties(params.sequence);
      }),

      design_primers: buildTool('design_primers', async params => {
        await this._ensureDesigner();
        const options = this._getDesignOptions(params);
        const pair = this.PrimerDesigner.designPrimerPair(params.targetSequence, options);
        return pair || { error: 'Could not find a valid primer pair meeting the criteria in the given sequence' };
      }),

      find_primer_binding_sites: buildTool('find_primer_binding_sites', async params => {
        await this._ensureDesigner();
        const primerSeq = params.primerSequence || params.sequence || params.primer;
        if (!primerSeq) {
          throw new Error('primerSequence or sequence parameter is required');
        }
        return {
          queryLength: primerSeq.length,
          sites: this.PrimerDesigner.findBindingSites(
            primerSeq,
            params.templateSequence,
            params.maxMismatches !== undefined ? params.maxMismatches : 3,
            {
              max3PrimeMismatches: params.max3PrimeMismatches,
              minBindingTm: params.minBindingTm,
              scoringMode: params.scoringMode || 'fast',
              naConcentration: params.naConcentration,
              primerConcentration: params.primerConcentration,
            }
          ),
        };
      }),

      add_primer_annotation: buildTool('add_primer_annotation', async params => {
        throw new Error(
          'add_primer_annotation requires UI interaction — use PrimerChatManagerIntegration.primerAddAnnotation instead'
        );
      }),

      list_primer_annotations: buildTool('list_primer_annotations', async params => {
        throw new Error(
          'list_primer_annotations requires UI state — use PrimerService through ChatBox or MCP client routing'
        );
      }),

      clear_primer_annotations: buildTool('clear_primer_annotations', async params => {
        throw new Error(
          'clear_primer_annotations requires UI state — use PrimerService through ChatBox or MCP client routing'
        );
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

  _getDesignOptions(params) {
    const toNumber = value => {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : undefined;
    };
    const exactPrimerLength = toNumber(params.primerLength ?? params.primerLengthBp ?? params.primerSize);

    return {
      targetTm: toNumber(params.targetTm) ?? 60.0,
      tmTolerance: toNumber(params.tmTolerance),
      minLen: toNumber(params.minPrimerLength ?? params.minLen ?? params.minLength) ?? exactPrimerLength,
      maxLen: toNumber(params.maxPrimerLength ?? params.maxLen ?? params.maxLength) ?? exactPrimerLength,
      minProductSize: toNumber(params.minProductSize) ?? 100,
      maxProductSize: toNumber(params.maxProductSize),
      minGcContent: toNumber(params.minGcContent ?? params.minGc),
      maxGcContent: toNumber(params.maxGcContent ?? params.maxGc),
      requireGcClamp: typeof params.requireGcClamp === 'boolean' ? params.requireGcClamp : undefined,
      avoidHairpin: typeof params.avoidHairpin === 'boolean' ? params.avoidHairpin : undefined,
      requiredAmpliconStart: params.requiredAmpliconStart,
      requiredAmpliconEnd: params.requiredAmpliconEnd,
    };
  }

  getAvailableTools() {
    return Object.values(this.tools).map(tool => ({
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
