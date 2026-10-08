import { describe, it, expect, vi } from 'vitest';
import path from 'path';
import { createRequire } from 'module';
import { loadScript } from '../helpers/load-script';
const require = createRequire(import.meta.url);
describe('genomic download menu window', () => {
  it('exports the menu factory and loads the shipped document with project data', () => {
    const events = {};
    const win = {
      loadFile: vi.fn(),
      once: (event, callback) => (events[event] = callback),
      on: vi.fn(),
      show: vi.fn(),
      webContents: { send: vi.fn() },
    };
    function BrowserWindow() {
      return win;
    }
    BrowserWindow.getAllWindows = () => [];
    const project = { name: 'actual project' };
    const { exported: wm } = loadScript('src/main/window-management.js', {
      __dirname: path.resolve('src/main'),
      process,
      require: name =>
        name === 'electron'
          ? { BrowserWindow, ipcMain: { on: vi.fn() }, dialog: {} }
          : name === './project-ipc'
            ? { getCurrentProjectInfo: () => project, setActiveProject: vi.fn() }
            : name === './workspace-host-manager'
              ? {}
              : name === './security-utils'
                ? {}
                : require(name),
    });
    wm.setWindowMgmtDependencies({ createToolWindowMenu: vi.fn() });
    expect(wm.createGenomicDownloadWindow('complete-genome')).toBe(win);
    expect(win.loadFile).toHaveBeenCalledWith(path.resolve('src/genomic-data-download.html'));
    events['ready-to-show']();
    expect(win.webContents.send).toHaveBeenCalledWith('set-download-type', 'complete-genome');
    expect(win.webContents.send).toHaveBeenCalledWith('set-active-project', project);
  });
});
