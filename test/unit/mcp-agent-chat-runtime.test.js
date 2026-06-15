/* eslint-disable no-new-func */
/**
 * Regression coverage for MCP agent-mode chat dispatch.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

const INTERNAL_MCP_PATH = path.join(process.cwd(), 'src/renderer/modules/InternalMCPServer.js');
const RENDERER_MODULAR_PATH = path.join(process.cwd(), 'src/renderer/renderer-modular.js');
const TOOL_EXECUTION_SERVICE_PATH = path.join(
  process.cwd(),
  'src/renderer/modules/chat/services/ToolExecutionService.js'
);

function loadInternalMCPServer() {
  const content = fs
    .readFileSync(INTERNAL_MCP_PATH, 'utf-8')
    .replace('window.InternalMCPServer = InternalMCPServer;', '')
    .replace('module.exports = InternalMCPServer;', '');

  const context = {
    window: {
      ipcRenderer: {
        on: vi.fn(),
        send: vi.fn(),
        invoke: vi.fn(),
      },
    },
    console,
    Date,
  };

  const evaluator = new Function(
    'global',
    'window',
    'console',
    'Date',
    `${content}; global.InternalMCPServer = InternalMCPServer;`
  );
  evaluator(context, context.window, context.console, context.Date);
  return { InternalMCPServer: context.InternalMCPServer, ipcRenderer: context.window.ipcRenderer };
}

function loadToolExecutionService() {
  const content = fs
    .readFileSync(TOOL_EXECUTION_SERVICE_PATH, 'utf-8')
    .replace('window.ToolExecutionService = ToolExecutionService;', '');

  const context = {
    window: {},
    console,
  };

  const evaluator = new Function(
    'global',
    'window',
    'console',
    `${content}; global.ToolExecutionService = ToolExecutionService;`
  );
  evaluator(context, context.window, context.console);
  return context.ToolExecutionService;
}

describe('MCP agent chat runtime dispatch', () => {
  let InternalMCPServer;
  let ipcRenderer;
  let ToolExecutionService;

  beforeEach(() => {
    const loaded = loadInternalMCPServer();
    InternalMCPServer = loaded.InternalMCPServer;
    ipcRenderer = loaded.ipcRenderer;
    ToolExecutionService = loadToolExecutionService();
  });

  it('handles codexomics_chat snake_case method names', async () => {
    const processAgentPrompt = vi.fn().mockResolvedValue({ success: true, response: 'ok' });
    const server = new InternalMCPServer();
    server.initialize({
      chatManager: {
        processAgentPrompt,
      },
    });

    const result = await server.executeMethod('codexomics_chat', {
      prompt: 'Summarize the loaded genome',
      activate_multi_agent: true,
      context: { genome_name: 'demo' },
    });

    expect(result).toEqual({ success: true, response: 'ok' });
    expect(processAgentPrompt).toHaveBeenCalledWith(
      'Summarize the loaded genome',
      expect.objectContaining({
        activateMultiAgent: true,
        context: { genome_name: 'demo' },
      })
    );
    expect(ipcRenderer.on).toHaveBeenCalledWith('mcp-tool-call', expect.any(Function));
  });

  it('handles codexomicsChat camelCase method names', async () => {
    const processAgentPrompt = vi.fn().mockResolvedValue({ success: true, response: 'ok' });
    const server = new InternalMCPServer();
    server.initialize({
      chatManager: {
        processAgentPrompt,
      },
    });

    const result = await server.executeMethod('codexomicsChat', {
      prompt: 'List open windows',
    });

    expect(result.success).toBe(true);
    expect(processAgentPrompt).toHaveBeenCalledWith(
      'List open windows',
      expect.objectContaining({
        activateMultiAgent: false,
        context: {},
      })
    );
  });

  it('does not route codexomics_chat through generic executeToolByName after agent handling', () => {
    const rendererContent = fs.readFileSync(RENDERER_MODULAR_PATH, 'utf-8');
    expect(rendererContent).toContain("if (toolName === 'codexomics_chat' || toolName === 'codexomicsChat')");
    expect(rendererContent).toContain("method === 'codexomics_chat' || method === 'codexomicsChat'");
    expect(rendererContent).toContain('Letting InternalMCPServer handle codexomics_chat');
    expect(rendererContent).toContain('} else if (window.genomeBrowser && window.genomeBrowser.chatManager) {');
  });

  it('routes direct ToolExecutionService codexomics_chat calls to processAgentPrompt', async () => {
    const processAgentPrompt = vi.fn().mockResolvedValue({ success: true, response: 'navigated' });
    const service = new ToolExecutionService({}, { processAgentPrompt });

    const result = await service.execute('codexomics_chat', {
      prompt: 'Navigate to 3M',
      activate_multi_agent: false,
      context: { current_region: 'chr1:1-1000' },
    });

    expect(result).toEqual({ success: true, response: 'navigated' });
    expect(processAgentPrompt).toHaveBeenCalledWith('Navigate to 3M', {
      activateMultiAgent: false,
      context: { current_region: 'chr1:1-1000' },
    });
  });
});
