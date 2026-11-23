/**
 * GelRenderer Structure Tests
 *
 * GelRenderer is a Canvas-based visualization component that requires
 * a DOM environment with Canvas support. These tests validate the
 * class structure, color schemes, and non-rendering methods.
 */
import { describe, it, expect, beforeAll, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import GelRenderer from '../../src/renderer/modules/chat/services/GelRenderer.js';
import GelElectrophoresisService from '../../src/renderer/modules/chat/services/GelElectrophoresisService.js';

const SERVICE_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/GelRenderer.js');

describe('GelRenderer - structure', () => {
  let code;
  beforeAll(() => {
    code = fs.readFileSync(SERVICE_PATH, 'utf-8');
  });

  it('should be a valid JS file defining GelRenderer class', () => {
    expect(code).toContain('class GelRenderer');
  });

  it('should define 5 color schemes', () => {
    expect(code).toContain('ethidium_bromide');
    expect(code).toContain('gel_red');
    expect(code).toContain('sybr_safe');
    expect(code).toContain('methylene_blue');
    expect(code).toContain('uv_default');
  });

  it('should have a render method', () => {
    expect(code).toMatch(/render\s*\(/);
  });

  it('should have PNG export support', () => {
    expect(code).toMatch(/exportPNG|toDataURL|toBlob/);
  });

  it('should support color scheme switching', () => {
    expect(code).toMatch(/setColorScheme|colorScheme/);
  });

  it('should use text shadow/halo for readability', () => {
    expect(code).toMatch(/shadowColor|textShadow|halo/);
  });

  it('should assign to window.GelRenderer', () => {
    expect(code).toContain('window.GelRenderer = GelRenderer');
  });
});

describe('GelRenderer - fragment inspector', () => {
  const select = name => document.querySelector(`[data-gel="${name}"]`);
  let service;

  beforeEach(() => {
    const index = fs.readFileSync(path.join(process.cwd(), 'src/renderer/index.html'), 'utf-8');
    const modal = new DOMParser().parseFromString(index, 'text/html').getElementById('gelElectrophoresisModal');
    document.body.replaceChildren(modal);
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    window.GelRenderer = GelRenderer;
    service = new GelElectrophoresisService();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    document.body.replaceChildren();
  });

  it('groups same-size fragments and filters by their simulated migration status', async () => {
    const label = '<img src="x">';
    await service.simulateGelElectrophoresis({ fragments: [1000, 40, { length: 1000 }, 200000], laneLabel: label });

    expect(select('sample').textContent).toBe(label);
    expect(select('sample').querySelector('img')).toBeNull();
    expect([...select('rows').rows].map(row => [row.cells[1].textContent, row.cells[3].textContent])).toEqual([
      ['1', 'In well'],
      ['2', 'In gel'],
      ['1', 'At front'],
    ]);
    select('rows').querySelector('button[data-size="1000"]').click();
    expect(select('detail').textContent).toContain('2 fragments');

    select('filter').value = 'at_front';
    select('filter').dispatchEvent(new Event('change'));
    expect(select('rows').rows).toHaveLength(1);
    expect(select('rows').querySelector('button').dataset.size).toBe('40');
    expect(select('rows').querySelector('button').getAttribute('aria-pressed')).toBe('false');
  });

  it('resets state on each simulation and binds the sort action once', async () => {
    await service.simulateGelElectrophoresis({ fragments: Array.from({ length: 42 }, (_, index) => 1000 + index) });
    select('next').click();
    expect(select('rows').rows).toHaveLength(2);

    await service.simulateGelElectrophoresis({ fragments: [1400, 1200, 1000] });
    expect(select('rows').querySelector('button').dataset.size).toBe('1400');
    expect(select('previous').disabled).toBe(true);
    select('sort').click();
    expect(select('rows').querySelector('button').dataset.size).toBe('1000');
  });
});
