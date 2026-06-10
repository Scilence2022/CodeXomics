import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const CONFIG_MANAGER = path.join(process.cwd(), 'src/renderer/modules/ConfigManager.js');
const IPC_HANDLERS = path.join(process.cwd(), 'src/main/ipc-handlers.js');
const PRELOAD = path.join(process.cwd(), 'src/preload.js');

describe('ConfigManager IPC hardening', () => {
  it('does not use renderer filesystem modules for config persistence', () => {
    const source = fs.readFileSync(CONFIG_MANAGER, 'utf8');

    expect(source).not.toMatch(/require\(['"]fs['"]\)/);
    expect(source).not.toMatch(/window\.require\(['"]fs['"]\)/);
    expect(source).not.toMatch(/require\(['"]path['"]\)/);
    expect(source).not.toMatch(/window\.require\(['"]path['"]\)/);
    expect(source).not.toMatch(/require\(['"]os['"]\)/);
    expect(source).not.toMatch(/window\.require\(['"]os['"]\)/);
    expect(source).toContain('loadFromMainConfig');
    expect(source).toContain('saveToMainConfig');
  });

  it('exposes config persistence through preload and main IPC', () => {
    const preload = fs.readFileSync(PRELOAD, 'utf8');
    const ipcHandlers = fs.readFileSync(IPC_HANDLERS, 'utf8');

    expect(preload).toContain("'config:load'");
    expect(preload).toContain("'config:save'");
    expect(preload).toContain('loadConfigData:');
    expect(preload).toContain('saveConfigData:');
    expect(ipcHandlers).toContain("ipcMain.handle('config:load'");
    expect(ipcHandlers).toContain("ipcMain.handle('config:save'");
  });

  it('cleans the complete config object before main-process IPC save', () => {
    const source = fs.readFileSync(CONFIG_MANAGER, 'utf8');

    expect(source).toContain('const configForPersistence = this.buildPersistableConfig()');
    expect(source).toContain('const cleanConfig = this.validateAndCleanData(configForPersistence)');
    expect(source).toContain('window.electronAPI.saveConfigData(cleanConfig)');
  });
});
