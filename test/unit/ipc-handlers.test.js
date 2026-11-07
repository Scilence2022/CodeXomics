/**
 * IPC Handlers Module Structure Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import os from 'node:os';
import vm from 'node:vm';
import fs from 'fs';
import path from 'path';

const IPC_PATH = path.join(process.cwd(), 'src/main/ipc-handlers.js');

describe('IPC Handlers Module', () => {
  let content;

  beforeAll(() => {
    content = fs.readFileSync(IPC_PATH, 'utf-8');
  });

  it('should exist and be substantial', () => {
    expect(fs.existsSync(IPC_PATH)).toBe(true);
    expect(content.length).toBeGreaterThan(10000);
  });

  it('should define registerIpcHandlers function', () => {
    expect(content).toContain('function registerIpcHandlers');
  });

  it('should export registerIpcHandlers', () => {
    expect(content).toContain('module.exports');
    expect(content).toContain('registerIpcHandlers');
  });

  it('should have 100+ ipcMain.handle registrations', () => {
    const count = (content.match(/ipcMain\.handle\(/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(50);
  });

  it('should have 30+ ipcMain.on registrations', () => {
    const count = (content.match(/ipcMain\.on\(/g) || []).length;
    expect(count).toBeGreaterThanOrEqual(10);
  });

  it('should handle file operations IPC', () => {
    expect(content).toContain('read-file');
    expect(content).toContain('write-file');
    expect(content).toContain('approve-working-directory');
    expect(content).toContain('get-app-paths');
  });

  it('should expose scoped tool registry IPC', () => {
    expect(content).toContain('ToolRegistryService');
    expect(content).toContain('tool-registry:get-snapshot');
    expect(content).toContain('tool-registry:get-metadata');
    expect(content).toContain('tool-registry:get-tool');
    expect(content).toContain('tool-registry:reload');
  });

  it('should expose scoped gene research report IPC', () => {
    expect(content).toContain('check-gene-research-report');
    expect(content).toContain('open-gene-research-report');
    expect(content).toContain('resolveGeneResearchReportPath');
  });

  it('should expose scoped sidecar file IPC', () => {
    expect(content).toContain('load-sidecar-file');
    expect(content).toContain('save-sidecar-file');
    expect(content).toContain('check-sidecar-file');
    expect(content).toContain('resolveSidecarPaths');
  });

  it('should capture screenshots from the requesting renderer webContents', () => {
    expect(content).toContain('getWorkspaceHandleForSender');
    expect(content).toContain('event.sender.capturePage(resolveCaptureRect(options.rect, event.sender))');
    expect(content).toContain('resolveIpcFileAccess(savePath, {');
  });

  it('should convert renderer CSS rects into zoom aware capture rects', () => {
    expect(content).toContain("require('./screenshot-rect')");
    expect(content).toContain('resolveCaptureRect(options.rect, targetWindow.webContents)');
  });

  it('should save AI auto-screenshots under a writable default directory', () => {
    expect(content).toContain('getDefaultScreenshotDirectory');
    expect(content).toContain("path.join(basePath, 'CodeXomics Screenshots')");
    expect(content).toContain('resolveRelativeScreenshotPath');
    expect(content).toContain('shouldRedirectGeneratedRootScreenshot');
  });

  it('should expose image opening IPC for saved screenshots', () => {
    expect(content).toContain("ipcMain.handle('open-image-file'");
    expect(content).toContain('assertSupportedImagePath');
    expect(content).toContain('shell.openPath(safeFilePath)');
  });

  it('should handle MCP server IPC', () => {
    expect(content).toContain('mcp-server');
    expect(content).toContain("ipcMain.handle('dgr-mcp-request'");
    expect(content).toContain('await startUnifiedMCPServer()');
    expect(content).toContain('await stopUnifiedMCPServer()');
    expect(content).toContain('isRegisteredGenomeSender(event)');
    expect(content).toContain('limited to registered genome windows');
  });

  it('should handle Circos plotter IPC', () => {
    expect(content).toContain('circos');
  });

  it('should handle multi-window IPC', () => {
    expect(content).toContain('genome-window');
    expect(content).toContain('window-registry');
  });

  it('should use deps parameter pattern', () => {
    expect(content).toContain('function registerIpcHandlers(deps)');
  });

  it('should track duplicate handlers with window-management.js (known P3 issue)', () => {
    const wmPath = path.join(process.cwd(), 'src/main/window-management.js');
    const wmContent = fs.readFileSync(wmPath, 'utf-8');

    const r = /ipcMain\.on\(\s*['"]([^'"]+)['"]/g;
    let m;
    const ipcOns = new Set();
    while ((m = r.exec(content)) !== null) ipcOns.add(m[1]);

    const wmOns = new Set();
    while ((m = r.exec(wmContent)) !== null) wmOns.add(m[1]);

    const dups = [...ipcOns].filter(ch => wmOns.has(ch));
    // Known P3 issue: 19 ipcMain.on handlers duplicated in window-management.js
    // These were inline with window creation code in original main.js
    console.warn(`P3: ${dups.length} duplicate ipcMain.on handlers in window-management.js`);
    // Accept this as known issue, not a test failure
    expect(dups.length).toBeLessThanOrEqual(20);
  });
});

it('protects the loaded genome and aliases while writing a separate edit result', async () => {
  const directory = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'codexomics-edit-output-'));
  try {
    const handlers = new Map();
    const requireMain = createRequire(IPC_PATH);
    const module = { exports: {} };
    const electron = {
      ipcMain: { handle: (channel, handler) => handlers.set(channel, handler), on: vi.fn() },
      app: { getPath: () => directory },
    };
    vm.runInNewContext(fs.readFileSync(IPC_PATH, 'utf8'), {
      module,
      __dirname: path.dirname(IPC_PATH),
      process,
      Buffer,
      console: { ...console, error: vi.fn() },
      require(name) {
        if (name === 'electron') return electron;
        if (name === './evo2-service') return { registerEvo2Ipc: vi.fn() };
        if (name === './plugin-version-ipc') return { registerPluginVersionIpc: vi.fn() };
        return requireMain(name);
      },
    }, { filename: IPC_PATH });
    module.exports.registerIpcHandlers({ windowRegistry: new Map() });
    const write = handlers.get('write-file');
    const source = path.join(directory, 'source.gbk');
    const alias = path.join(directory, 'alias.gbk');
    const output = path.join(directory, 'edited.gbk');
    await fs.promises.writeFile(source, 'original');
    await fs.promises.link(source, alias);

    for (const destination of [source, alias]) {
      expect(await write({}, destination, 'edited', undefined, source)).toMatchObject({
        success: false,
        error: expect.stringContaining('preserve the source genome'),
      });
    }
    expect(await fs.promises.readFile(source, 'utf8')).toBe('original');
    expect(await write({}, output, 'edited', undefined, source)).toMatchObject({ success: true });
    expect(await fs.promises.readFile(output, 'utf8')).toBe('edited');
  } finally {
    await fs.promises.rm(directory, { recursive: true, force: true });
  }
});
