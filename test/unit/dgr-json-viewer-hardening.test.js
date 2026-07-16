import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';

const read = fileName => fs.readFileSync(path.join(process.cwd(), 'src', fileName), 'utf8');

describe('DGR JSON viewer hardening', () => {
  it('uses a local-only CSP and a dedicated one-way preload bridge', () => {
    const html = read('json-viewer.html');
    const preload = read('json-viewer-preload.js');

    expect(html).toContain("default-src 'none'");
    expect(html).toContain("script-src 'self'");
    expect(html).toContain("connect-src 'none'");
    expect(html).not.toMatch(/https?:\/\//);
    expect(preload).toContain('contextBridge.exposeInMainWorld(');
    expect(preload).toContain("'dgrJsonViewer'");
    expect(preload).toContain('onData(callback)');
    expect(preload).not.toContain('ipcRenderer.invoke');
    expect(preload).not.toContain('ipcRenderer.send(');
  });

  it('renders safely and keeps large structures lazy and paged', () => {
    const source = read('json-viewer.js');

    expect(source).toContain('const PAGE_SIZE = 100');
    expect(source).toContain('createPager(');
    expect(source).toContain('if (!hasRendered) renderPage()');
    expect(source).toContain('if (showRaw && !state.rawMaterialized)');
    expect(source).toContain('textContent');
    expect(source).not.toMatch(/\.innerHTML\s*=/);
    expect(source).not.toContain('insertAdjacentHTML');
    expect(source).not.toMatch(/\beval\s*\(/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
  });
});
