/**
 * DNAMarkerDatabase Tests
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const SERVICE_PATH = path.join(
  process.cwd(),
  'src/renderer/modules/chat/services/DNAMarkerDatabase.js'
);

function createDatabase() {
  const code = fs
    .readFileSync(SERVICE_PATH, 'utf-8')
    .replace('window.DNAMarkerDatabase = DNAMarkerDatabase;', '');
  const fn = new Function(code + '; return DNAMarkerDatabase;');
  const DNAMarkerDatabase = fn();
  return new DNAMarkerDatabase();
}

describe('DNAMarkerDatabase - core operations', () => {
  let db;
  beforeAll(() => {
    db = createDatabase();
  });

  it('should have markers after initialization', () => {
    const markers = db.getAllMarkers();
    expect(Array.isArray(markers)).toBe(true);
    expect(markers.length).toBeGreaterThan(0);
  });

  it('should include NEB markers', () => {
    const markers = db.getAllMarkers();
    const nebMarkers = markers.filter(m => m.brand === 'NEB');
    expect(nebMarkers.length).toBeGreaterThan(0);
  });

  it('should include Thermo Fisher markers', () => {
    const markers = db.getAllMarkers();
    const tfMarkers = markers.filter(m => m.brand === 'Thermo Fisher');
    expect(tfMarkers.length).toBeGreaterThan(0);
  });

  it('should include Takara markers', () => {
    const markers = db.getAllMarkers();
    const takaraMarkers = markers.filter(m => m.brand === 'Takara');
    expect(takaraMarkers.length).toBeGreaterThan(0);
  });

  it('should include Chinese domestic brand markers (TransGen, Vazyme, BioMaded, Sangon)', () => {
    const markers = db.getAllMarkers();
    const brands = markers.map(m => m.brand);
    expect(brands).toContain('TransGen');
    expect(brands).toContain('Vazyme');
    expect(brands).toContain('BioMaded');
    expect(brands).toContain('Sangon');
  });

  it('should get marker by ID', () => {
    const marker = db.getMarker('1kb_ladder');
    expect(marker).toBeDefined();
    expect(marker).not.toBeNull();
  });

  it('should return null for unknown marker ID', () => {
    const marker = db.getMarker('nonexistent_xyz');
    expect(marker).toBeNull();
  });

  it('should search markers by name', () => {
    const results = db.searchMarkers('1kb');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should filter markers by brand', () => {
    const results = db.filterByBrand('NEB');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    results.forEach(m => expect(m.brand).toBe('NEB'));
  });

  it('should have fragments/bands in each marker', () => {
    const markers = db.getAllMarkers();
    markers.forEach(m => {
      if (m.fragments) {
        expect(Array.isArray(m.fragments)).toBe(true);
        expect(m.fragments.length).toBeGreaterThan(0);
      } else if (m.bands) {
        expect(Array.isArray(m.bands)).toBe(true);
        expect(m.bands.length).toBeGreaterThan(0);
      }
    });
  });
});
