import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const GENE_ATTACHMENTS_MANAGER = path.join(process.cwd(), 'src/renderer/modules/GeneAttachmentsManager.js');
const PRELOAD = path.join(process.cwd(), 'src/preload.js');

describe('GeneAttachmentsManager IPC hardening', () => {
  it('routes attachment file operations through preload IPC', () => {
    const source = fs.readFileSync(GENE_ATTACHMENTS_MANAGER, 'utf8');
    const preload = fs.readFileSync(PRELOAD, 'utf8');

    expect(source).toContain('getPathModule()');
    expect(source).toContain('window.electronAPI.copyAttachmentFile');
    expect(source).toContain('window.electronAPI.deleteAttachmentFile');
    expect(source).toContain('window.electronAPI.openAttachmentFile');
    expect(source).toContain('window.electronAPI.openDgrJsonViewer');
    expect(source).toContain('window.electronAPI.checkFileExists');
    expect(preload).toContain('copyAttachmentFile:');
    expect(preload).toContain('deleteAttachmentFile:');
    expect(preload).toContain('openAttachmentFile:');
    expect(preload).toContain('archiveDgrTaskResult:');
    expect(preload).toContain('openDgrJsonViewer:');
    expect(source).not.toMatch(/\brequire\(['"]fs['"]\)/);
    expect(source).not.toMatch(/\brequire\(['"]path['"]\)/);
    expect(source).not.toMatch(/\brequire\(['"]electron['"]\)/);
  });
});
