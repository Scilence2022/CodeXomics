import { expect, it, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { createRequire } from 'node:module';
import path from 'node:path';
import { loadScript } from '../helpers/load-script';

const require = createRequire(import.meta.url);
const ToolsIntegrator = require('../../src/mcp-tools/ToolsIntegrator');
const ToolsIntegration = require('../../tools_registry/builtin_tools_integration');

const requests = [
  ['toggle_gel_electrophoresis', 'Show me the Gel Electrophoresis window'],
  ['toggle_dna_marker_browser', '关闭 DNA Marker Browser'],
  ['toggle_restriction_enzyme_browser', 'Open the restriction enzyme browser'],
  ['toggle_circos_genome_plotter', 'Close the Circos Genome Plotter'],
];

it('retrieves the four visibility controls and distinguishes a gel simulation', () => {
  const integration = new ToolsIntegration();
  const relevant = query => integration.analyzeBuiltInToolRelevance(query).map(tool => tool.name);
  for (const [tool, request] of requests) {
    expect(relevant(request)).toContain(tool);
  }
  expect(relevant(requests[0][1])).not.toContain('simulate_gel_electrophoresis');
  expect(relevant('Simulate a gel with 500 and 1000 bp fragments')).not.toContain('toggle_gel_electrophoresis');
});

it('delegates each MCP window control to the canonical renderer tool', async () => {
  const executeToolOnClient = vi.fn().mockResolvedValue({ success: true, new_state: 'closed' });
  const integrator = new ToolsIntegrator({ mode: 'tools', executeToolOnClient });

  for (const [tool] of requests) {
    expect(integrator.getToolByName(tool).parameters.required).toEqual(['action']);
    const parameters = { action: 'close', windowId: 'target' };
    await expect(integrator.executeTool(tool, parameters, 'client')).resolves.toMatchObject({ new_state: 'closed' });
    expect(executeToolOnClient).toHaveBeenLastCalledWith(tool, parameters, 'client');
  }
});

it('resolves analysis window tools locally ahead of MCP and agents', async () => {
  const { exported: ToolExecutionService } = loadScript('src/renderer/modules/chat/services/ToolExecutionService.js');
  const manager = {
    executeLocalTool: vi.fn().mockResolvedValue({ success: true, new_state: 'open' }),
    agentSystemEnabled: true,
    multiAgentSystem: { executeTool: vi.fn() },
    mcpServerManager: { getAllAvailableTools: vi.fn(() => requests.map(([name]) => ({ name }))) },
  };
  const execution = new ToolExecutionService({}, manager);

  for (const [tool] of requests) {
    await expect(execution.execute(tool, { action: 'open' })).resolves.toMatchObject({ new_state: 'open' });
    expect(manager.executeLocalTool).toHaveBeenLastCalledWith(tool, { action: 'open' });
  }
  expect(manager.multiAgentSystem.executeTool).not.toHaveBeenCalled();
  expect(manager.mcpServerManager.getAllAvailableTools).not.toHaveBeenCalled();
});

it('reuses the Circos window for its source and closes only the addressed window', async () => {
  const windows = [];
  class BrowserWindow extends EventEmitter {
    constructor() {
      super();
      windows.push(this);
      this.destroyed = false;
    }
    loadFile = vi.fn().mockResolvedValue(undefined);
    show = vi.fn();
    focus = vi.fn();
    isMinimized = vi.fn(() => false);
    isDestroyed = () => this.destroyed;
    close = vi.fn(() => this.destroy());
    destroy = () => {
      this.destroyed = true;
      this.emit('closed');
    };
  }

  const { exported: manager } = loadScript('src/main/window-management.js', {
    __dirname: path.resolve('src/main'),
    process,
    require: name => {
      if (name === 'electron') return { BrowserWindow, ipcMain: { on: vi.fn() } };
      if (name === './security-utils') return { createSecureWebPreferences: () => ({}) };
      if (name === './circos-ipc') return { bindCircosSource: vi.fn() };
      if (name === './workspace-host-manager') return {};
      return require(name);
    },
  });
  const makeSource = () => ({
    isDestroyed: () => false,
    webContents: Object.assign(new EventEmitter(), { isDestroyed: () => false }),
  });
  const primary = makeSource();
  const other = makeSource();
  await Promise.all([
    manager.setCircosWindowVisibility(primary, 'open'),
    manager.setCircosWindowVisibility(primary, 'open'),
    manager.setCircosWindowVisibility(other, 'open'),
  ]);
  expect(windows).toHaveLength(2);
  expect(windows[0].focus).toHaveBeenCalledTimes(2);
  await expect(manager.setCircosWindowVisibility(primary, 'close')).resolves.toMatchObject({ new_state: 'closed' });
  await expect(manager.setCircosWindowVisibility(primary, 'close')).resolves.toMatchObject({ new_state: 'closed' });
  expect(windows[0].close).toHaveBeenCalledOnce();
  expect(windows[1].close).not.toHaveBeenCalled();
  await expect(manager.setCircosWindowVisibility(primary, 'toggle')).resolves.toMatchObject({ new_state: 'open' });
  expect(windows).toHaveLength(3);
  primary.webContents.emit('destroyed');
  expect(windows[2].isDestroyed()).toBe(true);
  expect(windows[1].isDestroyed()).toBe(false);
});
