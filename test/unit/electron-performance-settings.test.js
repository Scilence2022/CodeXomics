import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const ROOT = process.cwd();
const MAIN_PATH = path.join(ROOT, 'src/main.js');
const WINDOW_MANAGEMENT_PATH = path.join(ROOT, 'src/main/window-management.js');
const PROJECT_IPC_PATH = path.join(ROOT, 'src/main/project-ipc.js');
const LOGGING_PATH = path.join(ROOT, 'src/main/logging.js');
const RENDERER_PATH = path.join(ROOT, 'src/renderer/renderer-modular.js');
const INDEX_PATH = path.join(ROOT, 'src/renderer/index.html');
const MCP_LIFECYCLE_PATH = path.join(ROOT, 'src/main/mcp-lifecycle.js');
const IPC_HANDLERS_PATH = path.join(ROOT, 'src/main/ipc-handlers.js');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

describe('Electron performance settings', () => {
  it('lets Electron select the platform GPU backend', () => {
    const main = read(MAIN_PATH);

    expect(main).not.toContain("appendSwitch('use-angle'");
    expect(main).not.toContain("appendSwitch('ignore-gpu-blacklist'");
    expect(main).not.toContain("appendSwitch('enable-gpu-rasterization'");
  });

  it('does not clear shared session data or reload a new genome window', () => {
    const projectIpc = read(PROJECT_IPC_PATH);

    expect(projectIpc).not.toContain('.session.clearCache()');
    expect(projectIpc).not.toContain('.session.clearStorageData()');
    expect(projectIpc).not.toContain('webContents.reload()');
    expect(projectIpc).not.toContain('createSecureWebPreferences({ cache: false })');
  });

  it('opens DevTools only through the development guard', () => {
    const windowManagement = read(WINDOW_MANAGEMENT_PATH);

    expect(windowManagement).toContain('function openDevToolsInDevelopment(browserWindow)');
    expect(windowManagement.match(/\.openDevTools\(/g) || []).toHaveLength(1);
    // DevTools opening is centralized in window-management.js; the single
    // openDevTools call is wrapped by the --dev guard inside that helper.
    expect(windowManagement).toContain("if (process.argv.includes('--dev'))");
  });

  it('uses asynchronous production logging', () => {
    const logging = read(LOGGING_PATH);

    expect(logging).toContain("log.transports.file.level = isDevelopment ? 'info' : 'warn'");
    expect(logging).toContain('log.transports.file.sync = false');
  });
});

describe('Renderer startup loading', () => {
  it('keeps benchmark and plugin test modules out of the initial HTML', () => {
    const index = read(INDEX_PATH);
    const deferredModules = [
      'modules/BenchmarkManager.js',
      'modules/LLMBenchmarkFramework.js',
      'modules/benchmark-suites/AutomaticComplexSuite.js',
      'modules/PluginTestManager.js',
      'modules/PluginRealTestDemonstrator.js',
    ];

    for (const modulePath of deferredModules) {
      expect(index).not.toContain(`src="${modulePath}"`);
    }
  });

  it('defers every application script so file:// fetches run in parallel', () => {
    // Chromium's preload scanner does not prefetch file:// resources, so a
    // parser-blocking <script src> is only requested once the previous one has
    // run. With ~135 modules that serial chain cost ~250 ms before
    // DOMContentLoaded. `defer` lets the parser issue every request up front
    // while still executing the scripts in document order.
    const index = read(INDEX_PATH);
    const scriptTags = index.match(/<script\b[^>]*\bsrc="[^"]+"[^>]*>/g) || [];
    const blocking = scriptTags.filter(tag => !/\sdefer\b/.test(tag));

    expect(scriptTags.length).toBeGreaterThan(100);
    // DebugLogger stays parser-blocking in <head> so it gates console output
    // before any other script runs.
    expect(blocking).toEqual(['<script src="modules/DebugLogger.js">']);
    expect(index).not.toMatch(/<script\b[^>]*\basync\b[^>]*\bsrc=/);
  });

  it('retains ordered on-demand loaders for deferred modules', () => {
    const renderer = read(RENDERER_PATH);

    expect(renderer).toContain("'modules/benchmark-suites/BenchmarkEvaluatorBase.js'");
    expect(renderer).toContain("'modules/benchmark-suites/AutomaticComplexSuite.js'");
    expect(renderer).toContain("'modules/BenchmarkManager.js'");
    expect(renderer).toContain('async loadPluginDevelopmentModules()');
    expect(renderer).toContain("'modules/PluginTestManager.js'");
  });

  it('loads the MCP server module only when a server is started', () => {
    const lifecycle = read(MCP_LIFECYCLE_PATH);
    const topLevel = lifecycle.slice(0, lifecycle.indexOf('function loadUnifiedMCPServer'));

    expect(topLevel).not.toContain("require('../mcp-server')");
    expect(lifecycle).toContain("UnifiedMCPServer = require('../mcp-server');");
    expect(lifecycle).toContain('const MCPServer = loadUnifiedMCPServer();');
  });

  it('prewarms the tool registry snapshot after the first window is created', () => {
    const main = read(MAIN_PATH);
    const ipcHandlers = read(IPC_HANDLERS_PATH);
    const createIndex = main.indexOf('mainWindow = wm.createWindow();');
    const prewarmIndex = main.indexOf('ipcHandlers.prewarmStartupCaches();');

    expect(ipcHandlers).toContain('prewarmStartupCaches()');
    expect(createIndex).toBeGreaterThan(-1);
    expect(prewarmIndex).toBeGreaterThan(createIndex);
  });

  it('loads bundled D3 and Marked assets instead of startup CDN requests', () => {
    const index = read(INDEX_PATH);

    expect(index).toContain('../../node_modules/d3/dist/d3.min.js');
    expect(index).toContain('../../node_modules/marked/marked.min.js');
    expect(index).not.toContain('https://d3js.org/');
    expect(index).not.toContain('cdn.jsdelivr.net/npm/marked');
  });
});
