/**
 * UtilityTools Module
 * Provides utility tools for file operations including downloading and viewing files
 */

class UtilityTools {
    constructor(server) {
        this.server = server;
        this.tools = this.defineTools();
    }

    defineTools() {
        return {
            download_internet_file: {
                name: 'download_internet_file',
                description: 'Download a file from the internet (URL) to a local path. Useful for downloading data files, reports, or any web-accessible resources.',
                parameters: {
                    type: 'object',
                    properties: {
                        url: {
                            type: 'string',
                            description: 'The URL of the file to download (e.g., https://example.com/file.txt)'
                        },
                        destinationPath: {
                            type: 'string',
                            description: 'Local directory path where the file should be saved. If not provided, saves to the current workspace downloads folder.'
                        },
                        filename: {
                            type: 'string',
                            description: 'Filename to save the downloaded file as. If not provided, the filename is extracted from the URL.'
                        }
                    },
                    required: ['url']
                }
            },

            view_markdown_file: {
                name: 'view_markdown_file',
                description: 'Open and view a markdown (.md) file in a dedicated viewer window with proper rendering. Use this to display markdown reports, documentation, or any .md files.',
                parameters: {
                    type: 'object',
                    properties: {
                        filePath: {
                            type: 'string',
                            description: 'Absolute path to the markdown file to view'
                        },
                        title: {
                            type: 'string',
                            description: 'Custom window title for the viewer. If not provided, uses the filename.'
                        }
                    },
                    required: ['filePath']
                }
            }
        };
    }

    getTools() {
        return this.tools;
    }

    async executeClientTool(toolName, parameters, clientId) {
        console.log(`🔧 [UtilityTools] Executing client tool: ${toolName}`, parameters);

        try {
            // Send request to client and wait for response
            const response = await this.server.executeToolOnClient(
                `utility_${toolName}`,
                parameters,
                clientId
            );

            console.log(`✅ [UtilityTools] Tool ${toolName} executed successfully`);
            return response;

        } catch (error) {
            console.error(`❌ [UtilityTools] Tool ${toolName} failed:`, error);
            throw error;
        }
    }

    // Tool execution methods
    async download_internet_file(params, clientId) {
        return await this.executeClientTool('download_internet_file', params, clientId);
    }

    async view_markdown_file(params, clientId) {
        return await this.executeClientTool('view_markdown_file', params, clientId);
    }
}

module.exports = UtilityTools;
