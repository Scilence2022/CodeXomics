/**
 * GelElectrophoresisService Tests
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const SERVICE_PATH = path.join(
  process.cwd(),
  'src/renderer/modules/chat/services/GelElectrophoresisService.js'
);

function createService() {
  const code = fs
    .readFileSync(SERVICE_PATH, 'utf-8')
    .replace('window.GelElectrophoresisService = GelElectrophoresisService;', '');
  const fn = new Function(code + '; return GelElectrophoresisService;');
  const GelElectrophoresisService = fn();
  return new GelElectrophoresisService();
}

describe('GelElectrophoresisService - simulateGelElectrophoresis', () => {
  let service;
  beforeAll(() => {
    service = createService();
  });

  it('should simulate gel with basic fragments', () => {
    const result = service.simulateGelElectrophoresis({
      fragments: [{ name: 'Sample', sizes: [1000, 500, 200] }],
    });
    expect(result).toBeDefined();
    expect(result.lanes).toBeDefined();
    expect(result.lanes.length).toBeGreaterThanOrEqual(1);
  });

  it('should include a marker/ladder lane when marker is specified', () => {
    const result = service.simulateGelElectrophoresis({
      fragments: [{ name: 'Sample', sizes: [1000] }],
      marker: '1kb_ladder',
    });
    expect(result.lanes.length).toBeGreaterThanOrEqual(2);
  });

  it('should respect gel_percent parameter', () => {
    const result1 = service.simulateGelElectrophoresis({
      fragments: [{ name: 'S1', sizes: [1000] }],
      gel_percent: 0.8,
    });
    const result2 = service.simulateGelElectrophoresis({
      fragments: [{ name: 'S2', sizes: [1000] }],
      gel_percent: 2.0,
    });
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result1.gelPercent).toBe(0.8);
    expect(result2.gelPercent).toBe(2.0);
  });

  it('should require fragments parameter', () => {
    expect(() => {
      service.simulateGelElectrophoresis({});
    }).toThrow();
  });

  it('should NOT accept enzymes parameter (visualization-only)', () => {
    const result = service.simulateGelElectrophoresis({
      fragments: [{ name: 'Sample', sizes: [1000, 500] }],
      enzymes: ['EcoRI'],
    });
    expect(result).toBeDefined();
    expect(result.lanes).toBeDefined();
  });

  it('should support color_scheme parameter', () => {
    const result = service.simulateGelElectrophoresis({
      fragments: [{ name: 'Sample', sizes: [1000] }],
      color_scheme: 'sybr_safe',
    });
    expect(result).toBeDefined();
    expect(result.colorScheme).toBe('sybr_safe');
  });
});

describe('GelElectrophoresisService - listMarkers', () => {
  let service;
  beforeAll(() => {
    service = createService();
  });

  it('should return a non-empty list of markers', () => {
    const markers = service.listMarkers();
    expect(Array.isArray(markers)).toBe(true);
    expect(markers.length).toBeGreaterThan(0);
  });

  it('should include NEB markers', () => {
    const markers = service.listMarkers();
    const hasNEB = markers.some(m => m.brand === 'NEB' || (m.id && m.id.toLowerCase().includes('neb')));
    expect(hasNEB).toBe(true);
  });
});

describe('GelElectrophoresisService - getMarkerInfo', () => {
  let service;
  beforeAll(() => {
    service = createService();
  });

  it('should return info for a known marker', () => {
    const info = service.getMarkerInfo('1kb_ladder');
    expect(info).toBeDefined();
  });

  it('should return null for unknown marker', () => {
    const info = service.getMarkerInfo('nonexistent_marker');
    expect(info).toBeNull();
  });
});
