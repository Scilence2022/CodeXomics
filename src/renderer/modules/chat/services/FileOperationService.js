/**
 * FileOperationService - Extracted from ChatManager
 */
class FileOperationService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  convertMCPDownloadUrls(text) {
    if (!text || typeof text !== 'string') {
      return text;
    }

    try {
      // Get the MCP server base URL from MCPServerManager
      let baseUrl = 'http://localhost:3000'; // Default fallback

      if (this.mcpServerManager) {
        // Try to get Deep Gene Research server URL
        const deepGeneServer = this.mcpServerManager.servers?.get('deep-gene-research');
        if (deepGeneServer && deepGeneServer.url) {
          // Extract base URL from the MCP endpoint URL (e.g., http://localhost:3000/api/mcp -> http://localhost:3000)
          try {
            const urlObj = new URL(deepGeneServer.url);
            baseUrl = `${urlObj.protocol}//${urlObj.host}`;
          } catch (e) {
            console.warn('Failed to parse MCP server URL:', e);
          }
        }
      }

      // Pattern 1: Convert plain text URLs with 🔗 prefix
      // Match: 🔗 /api/mcp/download/...
      text = text.replace(/🔗\s*(\/api\/mcp\/download\/[^\s\n`"<>]+)/g, (match, path) => {
        const fullUrl = `${baseUrl}${path}`;
        return `🔗 [Download](${fullUrl})`;
      });

      // Pattern 2: Convert standalone /api/mcp/download paths to markdown links
      // Negative lookbehind to not match if preceded by ( or [ or "
      text = text.replace(/(?<!\(|\[|")(\/api\/mcp\/download\/[^\s\n\)`"<>]+)/g, (match, path) => {
        const fullUrl = `${baseUrl}${path}`;
        return `[${path}](${fullUrl})`;
      });

      // Pattern 3: Fix existing markdown links with relative paths
      text = text.replace(/\[([^\]]+)\]\((\/api\/mcp\/[^\s\n\)]+)\)/g, (match, label, path) => {
        const fullUrl = `${baseUrl}${path}`;
        return `[${label}](${fullUrl})`;
      });

      return text;
    } catch (error) {
      console.error('Error converting MCP download URLs:', error);
      return text;
    }
  }
}

window.FileOperationService = FileOperationService;
