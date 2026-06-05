import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const I18N_MANAGER = path.join(process.cwd(), 'src/renderer/modules/I18nManager.js');
const IPC_HANDLERS = path.join(process.cwd(), 'src/main/ipc-handlers.js');
const PRELOAD = path.join(process.cwd(), 'src/preload.js');

describe('i18n IPC hardening', () => {
  it('loads renderer locale data through preload IPC instead of renderer filesystem require', () => {
    const source = fs.readFileSync(I18N_MANAGER, 'utf8');

    expect(source).not.toMatch(/require\(['"]fs['"]\)/);
    expect(source).not.toMatch(/require\(['"]path['"]\)/);
    expect(source).toContain('window.electronAPI.getLocaleData');
  });

  it('exposes locale IPC channels through preload and handles them in main', () => {
    const preload = fs.readFileSync(PRELOAD, 'utf8');
    const ipcHandlers = fs.readFileSync(IPC_HANDLERS, 'utf8');

    expect(preload).toContain("'get-locale-data'");
    expect(preload).toContain('getLocaleData:');
    expect(ipcHandlers).toContain("ipcMain.handle('get-locale-data'");
    expect(ipcHandlers).toContain("ipcMain.handle('get-locale-languages'");
  });
});
