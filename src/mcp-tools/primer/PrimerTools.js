const PrimerDesigner = require('../../renderer/modules/PrimerDesigner');
const PRIMER_TOOL_SCHEMAS = require('../../renderer/modules/PrimerToolSchemas');

class PrimerTools {
  constructor(server) {
    this.server = server;
  }

  getTools() {
    const tools = {};
    for (const [name, schema] of Object.entries(PRIMER_TOOL_SCHEMAS)) {
      tools[name] = {
        name: schema.name,
        description: schema.description,
        inputSchema: schema.parameters,
      };
    }
    return tools;
  }

  calculateProperties(sequence) {
    return PrimerDesigner.calculateProperties(sequence);
  }

  designPrimers(targetSequence, options) {
    if (!targetSequence) {
      return {
        error:
          'targetSequence is required for MCP server primer design. Use geneName or chromosome/start/end with the ChatBox instead, or fetch a strand-aware sequence first via sequence tools. For gene upstream/RBS designs, pass requiredAmpliconStart and requiredAmpliconEnd so the product is forced to include the requested upstream interval.',
      };
    }
    const pair = PrimerDesigner.designPrimerPair(targetSequence, options);
    return pair || { error: 'Could not find a valid primer pair meeting the criteria in the given sequence' };
  }

  findBindingSites(primer, template, maxMismatches, options = {}) {
    return {
      queryLength: primer.length,
      sites: PrimerDesigner.findBindingSites(
        primer,
        template,
        maxMismatches !== undefined ? maxMismatches : 3,
        options
      ),
    };
  }

  async executeClientTool(toolName, parameters, clientId) {
    return await this.server.executeToolOnClient(toolName, parameters, clientId);
  }
}

module.exports = PrimerTools;
