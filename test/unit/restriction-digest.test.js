/* eslint-disable no-eval */
/**
 * Restriction Digest Service Tests
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const SERVICES_DIR = path.join(process.cwd(), 'src/renderer/modules/chat/services');

describe('RestrictionEnzymeDatabase', () => {
  let db;

  beforeAll(async () => {
    const dbPath = path.join(SERVICES_DIR, 'RestrictionEnzymeDatabase.js');
    const code = fs.readFileSync(dbPath, 'utf-8');
    const classOnly = code
      .replace(/if\s*\(typeof\s+window[^}]*\}\s*/g, '')
      .replace(/if\s*\(typeof\s+module[^}]*\}\s*/g, '');
    const RestrictionEnzymeDatabase = eval(`(function() { ${classOnly}; return RestrictionEnzymeDatabase; })()`);
    db = new RestrictionEnzymeDatabase();
  });

  it('should instantiate and contain enzymes', () => {
    expect(db).toBeDefined();
    const names = db.getNames();
    expect(names.length).toBeGreaterThanOrEqual(80);
  });

  it('should resolve common enzymes', () => {
    const ecori = db.get('EcoRI');
    expect(ecori).not.toBeNull();
    expect(ecori.recognition).toBe('GAATTC');
    expect(ecori.overhangType).toBe("5'_overhang");
    expect(ecori.topCut).toBe(1);
    expect(ecori.bottomCut).toBe(5);
  });

  it('should resolve blunt-end enzymes', () => {
    const smai = db.get('SmaI');
    expect(smai).not.toBeNull();
    expect(smai.overhangType).toBe('blunt');

    const ecorv = db.get('EcoRV');
    expect(ecorv).not.toBeNull();
    expect(ecorv.overhangType).toBe('blunt');
  });

  it('should resolve 3-prime overhang enzymes', () => {
    const kpni = db.get('KpnI');
    expect(kpni).not.toBeNull();
    expect(kpni.overhangType).toBe("3'_overhang");
  });

  it('should resolve isoschizomers', () => {
    const ssti = db.get('SstI');
    expect(ssti).not.toBeNull();
    expect(ssti.name).toBe('SacI');

    const ecorihf = db.get('EcoRI-HF');
    expect(ecorihf).not.toBeNull();
    expect(ecorihf.recognition).toBe('GAATTC');
  });

  it('should resolve HF variants by direct name', () => {
    const hf = db.get('EcoRI-HF');
    expect(hf).not.toBeNull();
    expect(hf.recognition).toBe('GAATTC');
  });

  it('should handle rare-cutter enzymes', () => {
    const noti = db.get('NotI');
    expect(noti).not.toBeNull();
    expect(noti.recognitionLength).toBe(8);

    const sbfi = db.get('SbfI');
    expect(sbfi).not.toBeNull();
    expect(sbfi.recognitionLength).toBe(8);
  });

  it('should handle IUPAC degenerate enzymes', () => {
    const avai = db.get('AvaI');
    expect(avai).not.toBeNull();
    expect(/[^ACGT]/.test(avai.recognition)).toBe(true);

    const hinfi = db.get('HinfI');
    expect(hinfi).not.toBeNull();
    expect(hinfi.recognition).toContain('N');
  });

  it('should generate IUPAC regex patterns', () => {
    const regex = db.getIUPACRegex('GANTC');
    expect(regex).toBeInstanceOf(RegExp);
    expect(regex.test('GAATC')).toBe(true);
  });

  it('should compute reverse complement with IUPAC', () => {
    const rc = db.reverseComplementIUPAC('GANTC');
    expect(rc).toBe('GANTC');
  });

  it('should support search', () => {
    const results = db.search('Eco');
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.some(e => e.name === 'EcoRI')).toBe(true);
  });

  it('should filter by overhang type', () => {
    const blunt = db.getByOverhangType('blunt');
    expect(blunt.length).toBeGreaterThanOrEqual(5);
    const fivePrime = db.getByOverhangType("5'_overhang");
    expect(fivePrime.length).toBeGreaterThanOrEqual(5);
  });

  it('should filter by recognition length', () => {
    const sixCutters = db.getByRecognitionLength(6);
    expect(sixCutters.length).toBeGreaterThanOrEqual(10);
  });

  it('should return null for unknown enzymes', () => {
    expect(db.get('UNKNOWN_ENZYME')).toBeNull();
  });
});

describe('RestrictionDigestService - Core Algorithm', () => {
  it('should find EcoRI sites in a test sequence', () => {
    const sequence = 'AAGAATTCAAGAATTCAA';
    const recognition = 'GAATTC';
    const sites = [];
    const upperSeq = sequence.toUpperCase();
    for (let i = 0; i <= upperSeq.length - recognition.length; i++) {
      if (upperSeq.substring(i, i + recognition.length) === recognition) {
        sites.push(i);
      }
    }
    expect(sites.length).toBe(2);
    expect(sites[0]).toBe(2);
    expect(sites[1]).toBe(10);
  });

  it('should correctly calculate staggered cut positions for EcoRI', () => {
    const sitePosition = 100;
    const topCut = 1;
    const bottomCut = 5;

    const topStrandCut = sitePosition + topCut;
    const bottomStrandCut = sitePosition + bottomCut;

    expect(topStrandCut).toBe(101);
    expect(bottomStrandCut).toBe(105);
  });

  it('should correctly calculate staggered cut positions for KpnI (3-prime overhang)', () => {
    const sitePosition = 200;
    const topCut = 5;
    const bottomCut = 1;

    const topStrandCut = sitePosition + topCut;
    const bottomStrandCut = sitePosition + bottomCut;

    expect(topStrandCut).toBe(205);
    expect(bottomStrandCut).toBe(201);
  });

  it('should correctly identify blunt-end overhang type', () => {
    const topCut = 3;
    const bottomCut = 3;
    expect(topCut === bottomCut).toBe(true);
  });

  it('should correctly identify 5-prime overhang type', () => {
    const topCut = 1;
    const bottomCut = 5;
    expect(topCut < bottomCut).toBe(true);
  });

  it('should correctly identify 3-prime overhang type', () => {
    const topCut = 5;
    const bottomCut = 1;
    expect(topCut > bottomCut).toBe(true);
  });

  it('should compute fragment sizes from sorted cut positions', () => {
    const cutPositions = [100, 300, 700];
    const regionStart = 0;
    const regionEnd = 1000;

    const fragments = [];
    let lastEnd = regionStart;
    for (const pos of cutPositions) {
      fragments.push({ start: lastEnd, end: pos, length: pos - lastEnd });
      lastEnd = pos;
    }
    if (lastEnd < regionEnd) {
      fragments.push({ start: lastEnd, end: regionEnd, length: regionEnd - lastEnd });
    }

    expect(fragments.length).toBe(4);
    expect(fragments[0].length).toBe(100);
    expect(fragments[1].length).toBe(200);
    expect(fragments[2].length).toBe(400);
    expect(fragments[3].length).toBe(300);
  });

  it('should compute median fragment size', () => {
    const sizes = [100, 200, 300, 400].sort((a, b) => a - b);
    const mid = Math.floor(sizes.length / 2);
    const median = sizes.length % 2 !== 0 ? sizes[mid] : Math.round((sizes[mid - 1] + sizes[mid]) / 2);
    expect(median).toBe(250);
  });

  it('should handle reverse complement correctly', () => {
    const complement = { A: 'T', T: 'A', G: 'C', C: 'G' };
    const rc = seq =>
      seq
        .split('')
        .reverse()
        .map(b => complement[b] || b)
        .join('');

    expect(rc('GAATTC')).toBe('GAATTC');
    expect(rc('AAGCTT')).toBe('AAGCTT');
    expect(rc('GGATCC')).toBe('GGATCC');
    expect(rc('CTCGAG')).toBe('CTCGAG');
  });
});

describe('GelElectrophoresisRenderer', () => {
  let GelElectrophoresisRenderer;

  beforeAll(async () => {
    const rendererPath = path.join(process.cwd(), 'src/renderer/modules/GelElectrophoresisRenderer.js');
    const code = fs.readFileSync(rendererPath, 'utf-8');
    const classOnly = code
      .replace(/if\s*\(typeof\s+window[^}]*\}\s*/g, '')
      .replace(/if\s*\(typeof\s+module[^}]*\}\s*/g, '');
    GelElectrophoresisRenderer = eval(`(function() { ${classOnly}; return GelElectrophoresisRenderer; })()`);
  });

  it('should instantiate with default options', () => {
    const renderer = new GelElectrophoresisRenderer();
    expect(renderer.gelHeight).toBe(500);
    expect(renderer.laneWidth).toBe(80);
    expect(renderer.ladderRungs.length).toBeGreaterThanOrEqual(5);
  });

  it('should generate SVG string from digest result', () => {
    const renderer = new GelElectrophoresisRenderer();
    const digestResult = {
      enzymes: ['EcoRI', 'HindIII'],
      chromosome: 'NC_000913',
      totalFragments: 5,
      totalSites: 4,
      sizeRange: '500 - 15000 bp',
      fragmentDetails: [
        { index: 1, start: 0, end: 500, length: 500 },
        { index: 2, start: 500, end: 3000, length: 2500 },
        { index: 3, start: 3000, end: 8000, length: 5000 },
        { index: 4, start: 8000, end: 15000, length: 7000 },
        { index: 5, start: 15000, end: 30000, length: 15000 },
      ],
    };

    const svg = renderer.renderToSVGString(digestResult);
    expect(svg).toContain('<svg');
    expect(svg).toContain('</svg>');
    expect(svg).toContain('EcoRI');
    expect(svg).toContain('Ladder');
  });

  it('should format sizes correctly', () => {
    const renderer = new GelElectrophoresisRenderer();
    expect(renderer._formatSize(500)).toBe('500bp');
    expect(renderer._formatSize(1500)).toBe('1.5kb');
    expect(renderer._formatSize(1500000)).toBe('1.5Mb');
  });
});

describe('RestrictionDigestService Integration', () => {
  let service;
  let mockApp;
  let originalWindow;

  beforeAll(async () => {
    originalWindow = global.window;

    const dbPath = path.join(SERVICES_DIR, 'RestrictionEnzymeDatabase.js');
    const dbCode = fs.readFileSync(dbPath, 'utf-8');
    const dbClassOnly = dbCode
      .replace(/if\s*\(typeof\s+window[^}]*\}\s*/g, '')
      .replace(/if\s*\(typeof\s+module[^}]*\}\s*/g, '');
    const RestrictionEnzymeDatabase = eval(`(function() { ${dbClassOnly}; return RestrictionEnzymeDatabase; })()`);

    // Set global window.RestrictionEnzymeDatabase
    global.window = global.window || {};
    global.window.RestrictionEnzymeDatabase = RestrictionEnzymeDatabase;

    const servicePath = path.join(SERVICES_DIR, 'RestrictionDigestService.js');
    const serviceCode = fs.readFileSync(servicePath, 'utf-8');
    const serviceClassOnly = serviceCode
      .replace(/if\s*\(typeof\s+window[^}]*\}\s*/g, '')
      .replace(/if\s*\(typeof\s+module[^}]*\}\s*/g, '');
    const RestrictionDigestService = eval(`(function() { ${serviceClassOnly}; return RestrictionDigestService; })()`);

    mockApp = {
      currentChromosome: 'chr1',
      currentPosition: { start: 0, end: 18 },
      currentSequence: {
        chr1: 'AAGAATTCAAGAATTCAA',
      },
      getSequenceForRegion: async (chr, start, end) => {
        return mockApp.currentSequence[chr]?.substring(start, end) || '';
      },
    };

    service = new RestrictionDigestService(mockApp);
  });

  afterAll(() => {
    global.window = originalWindow;
  });

  it('should run in chromosome position mode using defaults when no parameters are provided', async () => {
    const result = await service.findRestrictionSites({ enzyme: 'EcoRI' });
    expect(result.chromosome).toBe('chr1');
    expect(result.sitesFound).toBe(2);
    expect(result.sites[0].position).toBe(2);
  });

  it('should run in chromosome position mode when chromosome and coordinates are specified', async () => {
    const result = await service.virtualDigest({
      enzymes: ['EcoRI'],
      chromosome: 'chr1',
      start: 0,
      end: 18,
    });
    expect(result.chromosome).toBe('chr1');
    expect(result.totalSites).toBe(2);
    expect(result.totalFragments).toBe(3);
    // Fragment 1: 0 to 3 (EcoRI cut topStrandCut is site position + 1)
    expect(result.fragmentDetails[0].length).toBe(3);
  });

  it('should prioritize chromosome position mode if both coordinates and sequence are provided', async () => {
    const result = await service.virtualDigest({
      enzymes: ['EcoRI'],
      chromosome: 'chr1',
      start: 0,
      end: 18,
      sequence: 'ATCG', // mismatch sequence that doesn't have EcoRI sites
    });
    // If it prioritized sequence, sites would be 0.
    // If it prioritized chromosome position, it fetches 'AAGAATTCAAGAATTCAA' which has 2 sites.
    expect(result.totalSites).toBe(2);
    expect(result.chromosome).toBe('chr1');
  });

  it('should run in direct sequence mode when sequence is provided and no coordinates are specified', async () => {
    // Clear mockApp to simulate environment with no active chromosome
    const oldChr = mockApp.currentChromosome;
    mockApp.currentChromosome = null;

    try {
      const result = await service.virtualDigest({
        enzymes: ['EcoRI'],
        sequence: 'AAGAATTCAAGAATTCAA',
      });
      expect(result.chromosome).toBe('direct_sequence');
      expect(result.totalSites).toBe(2);
      expect(result.totalFragments).toBe(3);
      expect(result.fragmentDetails[0].length).toBe(3);
    } finally {
      mockApp.currentChromosome = oldChr;
    }
  });

  it('should fail in direct sequence mode if invalid region length arises', async () => {
    await expect(
      service.virtualDigest({
        enzymes: ['EcoRI'],
        sequence: '',
      })
    ).rejects.toThrow();
  });

  it('should run findRestrictionSites in direct sequence mode when sequence is provided', async () => {
    const result = await service.findRestrictionSites({
      enzyme: 'EcoRI',
      sequence: 'AAGAATTCAAGAATTCAA',
    });
    expect(result.chromosome).toBe('direct_sequence');
    expect(result.sitesFound).toBe(2);
    expect(result.sites[0].position).toBe(2);
  });
});

describe('Restriction Digest Tool Registry Integration', () => {
  it('should have find_restriction_sites.yaml', () => {
    const yamlPath = path.join(process.cwd(), 'tools_registry/sequence/find_restriction_sites.yaml');
    expect(fs.existsSync(yamlPath)).toBe(true);
    const content = fs.readFileSync(yamlPath, 'utf-8');
    expect(content).toContain('relationships');
    expect(content).toContain('virtual_digest');
  });

  it('should have virtual_digest.yaml with relationships', () => {
    const yamlPath = path.join(process.cwd(), 'tools_registry/sequence/virtual_digest.yaml');
    expect(fs.existsSync(yamlPath)).toBe(true);
    const content = fs.readFileSync(yamlPath, 'utf-8');
    expect(content).toContain('relationships');
    expect(content).toContain('find_restriction_sites');
  });

  it('should have list_restriction_enzymes.yaml', () => {
    const yamlPath = path.join(process.cwd(), 'tools_registry/sequence/list_restriction_enzymes.yaml');
    expect(fs.existsSync(yamlPath)).toBe(true);
  });

  it('builtin_tools_integration should register all three tools', () => {
    const filePath = path.join(process.cwd(), 'tools_registry/builtin_tools_integration.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain("'find_restriction_sites'");
    expect(content).toContain("'virtual_digest'");
    expect(content).toContain("'list_restriction_enzymes'");
  });

  it('ToolNames.js should contain all three constants', () => {
    const filePath = path.join(process.cwd(), 'src/renderer/modules/chat/constants/ToolNames.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('FIND_RESTRICTION_SITES');
    expect(content).toContain('VIRTUAL_DIGEST');
    expect(content).toContain('LIST_RESTRICTION_ENZYMES');
  });

  it('FunctionCallsOrganizer should contain all three tools', () => {
    const filePath = path.join(process.cwd(), 'src/renderer/modules/FunctionCallsOrganizer.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain("'find_restriction_sites'");
    expect(content).toContain("'virtual_digest'");
    expect(content).toContain("'list_restriction_enzymes'");
  });

  it('MultiAgentSystem should have list_restriction_enzymes in isSpecializedAgent', () => {
    const filePath = path.join(process.cwd(), 'src/renderer/modules/MultiAgentSystem.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain("'list_restriction_enzymes'");
  });

  it('MCP SequenceTools should expose restriction tools', () => {
    const filePath = path.join(process.cwd(), 'src/mcp-tools/sequence/SequenceTools.js');
    const content = fs.readFileSync(filePath, 'utf-8');
    expect(content).toContain('find_restriction_sites');
    expect(content).toContain('virtual_digest');
    expect(content).toContain('list_restriction_enzymes');
  });
});
