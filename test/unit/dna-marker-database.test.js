/* eslint-disable no-new-func */
/**
 * DNAMarkerDatabase Tests
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const SERVICE_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/DNAMarkerDatabase.js');

function createDatabase() {
  const code = fs.readFileSync(SERVICE_PATH, 'utf-8').replace('window.DNAMarkerDatabase = DNAMarkerDatabase;', '');
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
    const markers = db.getAll();
    expect(Array.isArray(markers)).toBe(true);
    expect(markers.length).toBeGreaterThan(0);
  });

  it('should include NEB markers', () => {
    const markers = db.getAll();
    const nebMarkers = markers.filter(m => m.brand === 'NEB');
    expect(nebMarkers.length).toBeGreaterThan(0);
  });

  it('should include Thermo Fisher markers', () => {
    const markers = db.getAll();
    const tfMarkers = markers.filter(m => m.brand === 'Thermo Fisher');
    expect(tfMarkers.length).toBeGreaterThan(0);
  });

  it('should include Takara markers', () => {
    const markers = db.getAll();
    const takaraMarkers = markers.filter(m => m.brand === 'Takara');
    expect(takaraMarkers.length).toBeGreaterThan(0);
  });

  it('should include Chinese domestic brand markers (TransGen, Vazyme, BioMaded, Sangon)', () => {
    const markers = db.getAll();
    const brands = markers.map(m => m.brand);
    expect(brands.some(b => b.includes('TransGen'))).toBe(true);
    expect(brands.some(b => b.includes('Vazyme'))).toBe(true);
    expect(brands.some(b => b.includes('BioMaded'))).toBe(true);
    expect(brands.some(b => b.includes('Sangon'))).toBe(true);
  });

  it('should get marker by ID', () => {
    const marker = db.get('neb_1kb_ladder');
    expect(marker).toBeDefined();
    expect(marker).not.toBeNull();
    expect(marker.id).toBe('neb_1kb_ladder');
  });

  it('should return null for unknown marker ID', () => {
    const marker = db.get('nonexistent_xyz');
    expect(marker).toBeNull();
  });

  it('should search markers by name', () => {
    const results = db.search('1kb');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
  });

  it('should filter markers by brand', () => {
    const results = db.getByBrand('NEB');
    expect(Array.isArray(results)).toBe(true);
    expect(results.length).toBeGreaterThan(0);
    results.forEach(m => expect(m.brand).toBe('NEB'));
  });

  it('should have fragments/bands in each marker', () => {
    const markers = db.getAll();
    markers.forEach(m => {
      expect(Array.isArray(m.sizes)).toBe(true);
      expect(m.sizes.length).toBeGreaterThan(0);
    });
  });
});
