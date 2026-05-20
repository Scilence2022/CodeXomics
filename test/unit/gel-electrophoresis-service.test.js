/* eslint-disable no-new-func */
/**
 * GelElectrophoresisService Tests
 */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const SERVICE_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/GelElectrophoresisService.js');

const DB_PATH = path.join(process.cwd(), 'src/renderer/modules/chat/services/DNAMarkerDatabase.js');

function createService() {
  const code = fs
    .readFileSync(SERVICE_PATH, 'utf-8')
    .replace('window.GelElectrophoresisService = GelElectrophoresisService;', '');
  const fn = new Function(code + '; return GelElectrophoresisService;');
  const GelElectrophoresisService = fn();
  return new GelElectrophoresisService();
}

function loadDNAMarkerDatabase() {
  const code = fs.readFileSync(DB_PATH, 'utf-8').replace('window.DNAMarkerDatabase = DNAMarkerDatabase;', '');
  const fn = new Function(code + '; return DNAMarkerDatabase;');
  return fn();
}

describe('GelElectrophoresisService - simulateGelElectrophoresis', () => {
  let service;
  beforeAll(() => {
    const DNAMarkerDatabase = loadDNAMarkerDatabase();
    global.window = { DNAMarkerDatabase };
    global.document = {
      querySelector: () => null,
      getElementById: () => null,
      querySelectorAll: () => [],
    };
    service = createService();
  });

  it('should simulate gel with basic fragments', async () => {
    const result = await service.simulateGelElectrophoresis({
      fragments: [1000, 500, 200],
    });
    expect(result).toBeDefined();
    expect(result.bands).toBeDefined();
    expect(result.bands.length).toBe(3);
  });

  it('should include a marker/ladder lane when marker/ladder is specified', async () => {
    const result = await service.simulateGelElectrophoresis({
      fragments: [1000],
      ladderType: '1kb',
      showLadder: true,
    });
    expect(result.ladderBands).toBeDefined();
    expect(result.ladderBands.length).toBeGreaterThan(0);
  });

  it('should respect gelPercentage parameter', async () => {
    const result1 = await service.simulateGelElectrophoresis({
      fragments: [1000],
      gelPercentage: 0.8,
    });
    const result2 = await service.simulateGelElectrophoresis({
      fragments: [1000],
      gelPercentage: 2.0,
    });
    expect(result1).toBeDefined();
    expect(result2).toBeDefined();
    expect(result1.gelPercentage).toBe(0.8);
    expect(result2.gelPercentage).toBe(2.0);
  });

  it('should return error object when fragments is missing (not throw)', async () => {
    const result = await service.simulateGelElectrophoresis({});
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.hint).toBeDefined();
  });

  it('should support bandColorScheme parameter', async () => {
    const result = await service.simulateGelElectrophoresis({
      fragments: [1000],
      bandColorScheme: 'sybr_safe',
    });
    expect(result).toBeDefined();
    expect(result.bandColorScheme).toBe('sybr_safe');
  });
});

describe('GelElectrophoresisService - listMarkers', () => {
  let service;
  beforeAll(() => {
    const DNAMarkerDatabase = loadDNAMarkerDatabase();
    global.window = { DNAMarkerDatabase };
    service = createService();
  });

  it('should return a non-empty list of markers', () => {
    const result = service.listMarkers();
    expect(result).toBeDefined();
    expect(Array.isArray(result.markers)).toBe(true);
    expect(result.markers.length).toBeGreaterThan(0);
  });

  it('should include NEB markers', () => {
    const result = service.listMarkers();
    const hasNEB = result.markers.some(m => m.brand === 'NEB' || (m.id && m.id.toLowerCase().includes('neb')));
    expect(hasNEB).toBe(true);
  });
});

describe('GelElectrophoresisService - getMarkerInfo', () => {
  let service;
  beforeAll(() => {
    const DNAMarkerDatabase = loadDNAMarkerDatabase();
    global.window = { DNAMarkerDatabase };
    service = createService();
  });

  it('should return info for a known marker', () => {
    const info = service.getMarkerInfo({ markerId: 'neb_1kb_ladder' });
    expect(info).toBeDefined();
    expect(info.error).toBeUndefined();
    expect(info.sizes).toBeDefined();
  });

  it('should return error for unknown marker', () => {
    const info = service.getMarkerInfo({ markerId: 'nonexistent_marker' });
    expect(info.error).toBeDefined();
  });
});
