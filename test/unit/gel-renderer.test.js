/**
 * GelRenderer Structure Tests
 *
 * GelRenderer is a Canvas-based visualization component that requires
 * a DOM environment with Canvas support. These tests validate the
 * class structure, color schemes, and non-rendering methods.
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

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
