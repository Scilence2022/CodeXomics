import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const FILE_MANAGER = path.join(process.cwd(), 'src/renderer/modules/FileManager.js');
const FILE_OPERATION_SERVICE = path.join(process.cwd(), 'src/renderer/modules/chat/services/FileOperationService.js');

describe('file operation IPC hardening', () => {
  it('does not use renderer fs/path require in FileManager load notifications', () => {
    const source = fs.readFileSync(FILE_MANAGER, 'utf8');

    expect(source).toContain('getPathModule()');
    expect(source).not.toMatch(/\brequire\(['"]path['"]\)/);
    expect(source).not.toMatch(/\brequire\(['"]fs['"]\)/);
  });

  it('exports files through preload writeFile instead of renderer fs fallback', () => {
    const source = fs.readFileSync(FILE_OPERATION_SERVICE, 'utf8');
    const methodStart = source.indexOf('async writeFileDirectly');
    const methodEnd = source.indexOf('\n  getCurrentWorkingDirectory()', methodStart);
    const methodSource = source.slice(methodStart, methodEnd);

    expect(source).toContain('getPathModule()');
    expect(methodSource).toContain('electronAPI?.writeFile');
    expect(methodSource).toContain('electronAPI.writeFile is unavailable in the hardened renderer');
    expect(methodSource).not.toMatch(/\brequire\(['"]fs['"]\)/);
    expect(methodSource).not.toMatch(/\brequire\(['"]path['"]\)/);
  });

  it('validates explicit file paths through preload file info in the renderer', () => {
    const source = fs.readFileSync(FILE_OPERATION_SERVICE, 'utf8');
    const methodStart = source.indexOf('async validateFilePath');
    const methodEnd = source.indexOf('// 1. FILE LOADING OPERATIONS', methodStart);
    const methodSource = source.slice(methodStart, methodEnd);

    expect(methodSource).toContain('window.electronAPI?.getSelectedFileInfo');
    expect(methodSource).toContain('electronAPI.getSelectedFileInfo is unavailable');
    expect(methodSource).not.toMatch(/\brequire\(['"]fs['"]\)/);
  });
});
