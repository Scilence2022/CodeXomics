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
                inputSchema: schema.parameters
            };
        }
        return tools;
    }

    calculateProperties(sequence) {
        return PrimerDesigner.calculateProperties(sequence);
    }

    designPrimers(targetSequence, options) {
        if (!targetSequence) {
            return { error: 'targetSequence is required for MCP server primer design. Use geneName or chromosome/start/end with the ChatBox instead, or fetch the sequence first via sequence tools.' };
        }
        const pair = PrimerDesigner.designPrimerPair(targetSequence, options);
        return pair || { error: 'Could not find a valid primer pair meeting the criteria in the given sequence' };
    }

    findBindingSites(primer, template, maxMismatches) {
        return {
            queryLength: primer.length,
            sites: PrimerDesigner.findBindingSites(primer, template, maxMismatches || 0)
        };
    }

    async executeClientTool(toolName, parameters, clientId) {
        return await this.server.executeToolOnClient(toolName, parameters, clientId);
    }
}

module.exports = PrimerTools;
