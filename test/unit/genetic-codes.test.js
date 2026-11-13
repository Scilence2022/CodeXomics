import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const GeneticCodes = require('../../src/renderer/modules/GeneticCodes');
const Translation = require('../../src/renderer/modules/UnifiedDNATranslation');
const Microbe = require('../../src/renderer/modules/MicrobeGenomicsFunctions');
const SequenceTools = require('../../src/mcp-tools/sequence/SequenceTools');
const ExportManager = require('../../src/renderer/modules/ExportManager');

describe('NCBI genetic code tables', () => {
  it('builds 64 codons for every table and keeps the standard assignments', () => {
    for (const { id } of GeneticCodes.list()) {
      expect(Object.keys(GeneticCodes.resolve(id).codons)).toHaveLength(64);
    }
    const standard = GeneticCodes.resolve(1);
    expect(standard.codons.ATG).toBe('M');
    expect(standard.codons.TGG).toBe('W');
    expect(standard.stopCodons).toEqual(['TAA', 'TAG', 'TGA']);
    expect(standard.startCodons).toEqual(['TTG', 'CTG', 'ATG']);
  });

  it('carries the reassignments that distinguish the non-standard tables', () => {
    expect(GeneticCodes.resolve(2).codons).toMatchObject({ TGA: 'W', ATA: 'M', AGA: '*', AGG: '*' });
    expect(GeneticCodes.resolve(3).codons).toMatchObject({ CTG: 'T', TGA: 'W', ATA: 'M' });
    expect(GeneticCodes.resolve(4).codons.TGA).toBe('W');
    expect(GeneticCodes.resolve(6).codons).toMatchObject({ TAA: 'Q', TAG: 'Q' });
    expect(GeneticCodes.resolve(12).codons.CTG).toBe('S');
    expect(GeneticCodes.resolve(25).codons.TGA).toBe('G');
    // Table 11 assigns residues exactly as table 1 and differs only in its start codons.
    expect(GeneticCodes.resolve(11).codons).toEqual(GeneticCodes.resolve(1).codons);
    expect(GeneticCodes.resolve(11).startCodons).toEqual(['TTG', 'CTG', 'ATT', 'ATC', 'ATA', 'ATG', 'GTG']);
  });

  it.each([
    [undefined, 1],
    ['', 1],
    ['standard', 1],
    [11, 11],
    ['11', 11],
    ['table 11', 11],
    ['transl_table=4', 4],
    ['bacterial', 11],
    ['Archaeal', 11],
    ['vertebrate_mitochondrial', 2],
    ['Vertebrate Mitochondrial', 2],
    ['mitochondrial', 2],
    ['mycoplasma', 4],
    ['yeast mitochondrial code', 3],
  ])('resolves %s to table %s', (code, id) => {
    expect(GeneticCodes.resolve(code).id).toBe(id);
  });

  it('returns null for an unknown code and names the choices when one is required', () => {
    expect(GeneticCodes.resolve('klingon')).toBeNull();
    expect(GeneticCodes.resolve(7)).toBeNull();
    expect(() => GeneticCodes.require('klingon')).toThrow(/Unknown genetic code "klingon".*11/);
  });

  it('translates an ambiguous codon only when every reading agrees', () => {
    const standard = GeneticCodes.resolve(1);
    expect(GeneticCodes.translateCodon('GCN', standard)).toBe('A');
    expect(GeneticCodes.translateCodon('CTN', standard)).toBe('L');
    expect(GeneticCodes.translateCodon('YTA', standard)).toBe('L');
    expect(GeneticCodes.translateCodon('TAR', standard)).toBe('*');
    expect(GeneticCodes.translateCodon('ATN', standard)).toBe('X');
    expect(GeneticCodes.translateCodon('NNN', standard)).toBe('X');
    expect(GeneticCodes.translateCodon('AT-', standard)).toBe('X');
    // TGR is a stop or Trp in the standard code but always Trp in table 4.
    expect(GeneticCodes.translateCodon('TGR', standard)).toBe('X');
    expect(GeneticCodes.translateCodon('TGR', GeneticCodes.resolve(4))).toBe('W');
  });
});

describe('translation honours the requested genetic code', () => {
  const translate = parameters => Translation.translateDNA({ includeStops: true, ...parameters });

  it('translates TGA as Trp under table 4 and as a stop under the standard code', () => {
    expect(translate({ sequence: 'ATGTGAAAATAA' }).protein).toBe('M*K*');
    expect(translate({ sequence: 'ATGTGAAAATAA', geneticCode: 'mycoplasma' }).protein).toBe('MWK*');
    expect(translate({ sequence: 'ATGTGAAAATAA', geneticCode: 4 }).translationTable).toBe(4);
  });

  it('uses the vertebrate mitochondrial code under the name the tool schema advertises', () => {
    const result = translate({ sequence: 'ATGATATGAAGA', geneticCode: 'vertebrate_mitochondrial' });
    expect(result.success).toBe(true);
    expect(result.protein).toBe('MMW*');
  });

  it('fails on an unknown genetic code instead of falling back to the standard code', () => {
    const result = translate({ sequence: 'ATGTGAAAATAA', geneticCode: 'klingon' });
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Unknown genetic code/);
    expect(result.protein).toBe('');
    expect(() => Translation.getGeneticCodeTable('klingon')).toThrow(/Unknown genetic code/);
  });

  it('reads RNA as its DNA equivalent on both strands', () => {
    expect(translate({ sequence: 'AUGGCCUAA' }).protein).toBe('MA*');
    expect(translate({ sequence: 'UUAGGCCAU', strand: -1 }).protein).toBe('MA*');
  });

  it('translates an alternative initiation codon as Met only for a complete CDS', () => {
    expect(translate({ sequence: 'GTGAAATAA', geneticCode: 11 }).protein).toBe('VK*');
    expect(translate({ sequence: 'GTGAAATAA', geneticCode: 11, cds: true }).protein).toBe('MK*');
    expect(translate({ sequence: 'TTGGTGTAA', geneticCode: 11, cds: true }).protein).toBe('MV*');
    // GTG does not initiate under the standard code.
    expect(translate({ sequence: 'GTGAAATAA', geneticCode: 1, cds: true }).protein).toBe('VK*');
  });

  it('lists every supported table', () => {
    const codes = Translation.getAvailableGeneticCodes();
    expect(codes.map(code => code.id)).toEqual(GeneticCodes.supportedIds());
    expect(codes[0]).toMatchObject({ id: 1, name: 'standard', codonCount: 64 });
  });
});

describe('translate_dna tool arguments', () => {
  it('reads the frame, genetic code and stop handling from either spelling', () => {
    expect(Microbe.translationArgsFromParameters({ dna: 'ATG' })).toEqual({ frame: 0, options: {} });
    expect(
      Microbe.translationArgsFromParameters({ reading_frame: 3, genetic_code: 'bacterial', include_stop_codons: false })
    ).toEqual({ frame: 2, options: { geneticCode: 'bacterial', includeStops: false } });
    expect(Microbe.translationArgsFromParameters({ frame: 1, transl_table: 4, include_stop_codons: 'false' })).toEqual({
      frame: 1,
      options: { geneticCode: 4, includeStops: false },
    });
    expect(Microbe.translationArgsFromParameters({ include_stop_codons: 'true' }).options).toEqual({
      includeStops: true,
    });
  });

  it('applies the genetic code and stop handling in the shared translation entry point', () => {
    expect(Microbe.translateDNA('ATGTGAAAATAA')).toBe('M*K*');
    expect(Microbe.translateDNA('ATGTGAAAATAA', 0, { geneticCode: 'mycoplasma' })).toBe('MWK*');
    expect(Microbe.translateDNA('ATGTGAAAATAA', 0, { includeStops: false })).toBe('M');
    expect(Microbe.translateDNA('ATGGCNTAA')).toBe('MA*');
    expect(() => Microbe.translateDNA('ATGTGAAAATAA', 0, { geneticCode: 'klingon' })).toThrow(/Unknown genetic code/);
  });

  it('gives MCP clients the same translation as the ChatBox', () => {
    const tools = new SequenceTools({});
    expect(tools.translateDNA('ATGTGAAAATAA', 0)).toBe('M*K*');
    expect(tools.translateDNA('ATGTGAAAATAA', 0, { geneticCode: '4' })).toBe('MWK*');
    const schema = tools.getTools().translate_dna.parameters.properties;
    expect(schema).toHaveProperty('genetic_code');
    expect(schema).toHaveProperty('include_stop_codons');
  });
});

describe('protein export uses the genetic code of the CDS', () => {
  const cds = qualifiers => ({ type: 'CDS', name: 'orf', start: 1, end: 12, strand: 1, qualifiers });

  it('translates a CDS without /translation under its own transl_table', () => {
    const manager = new ExportManager({});
    expect(manager.extractFeatureProtein('GTGTGAAAATAA', cds({ transl_table: '4' }))).toBe('MWK');
    expect(manager.extractFeatureProtein('GTGAAAAAATAA', cds({ transl_table: '11' }))).toBe('MKK');
    expect(manager.extractFeatureProtein('ATGAAAAAATAA', cds({}))).toBe('MKK');
  });

  it('accepts a requested table by name and rejects one it does not know', () => {
    const manager = new ExportManager({});
    expect(manager.extractFeatureProtein('ATGTGAAAATAA', cds({ translation: 'M' }), 'mycoplasma')).toBe('MWK');
    expect(() => manager.extractFeatureProtein('ATGTGAAAATAA', cds({}), 'klingon')).toThrow(/Unknown genetic code/);
    expect(() => manager.extractFeatureProtein('ATGTGAAAATAA', cds({ transl_table: '7' }))).toThrow(/table 7/);
  });

  it('still refuses a CDS recoded by /transl_except', () => {
    const manager = new ExportManager({});
    const feature = cds({ transl_table: '11', transl_except: '(pos:4..6,aa:Sec)' });
    expect(() => manager.extractFeatureProtein('ATGTGAAAATAA', feature)).toThrow(/No supported translation/);
  });
});

describe('the genetic code of a loaded genome', () => {
  const cds = (table, extra = {}) => ({
    type: 'CDS',
    qualifiers: table ? { transl_table: [String(table)] } : {},
    ...extra,
  });

  it('reads a feature table from a scalar or array /transl_table', () => {
    expect(GeneticCodes.forFeature(cds(4)).id).toBe(4);
    expect(GeneticCodes.forFeature({ qualifiers: { transl_table: '11' } }).id).toBe(11);
    expect(GeneticCodes.forFeature(cds(null))).toBeNull();
    expect(GeneticCodes.forFeature(cds(7))).toBeNull();
    expect(GeneticCodes.forFeature(null)).toBeNull();
  });

  it('takes the table most CDS features of a record carry', () => {
    const features = [{ type: 'gene', qualifiers: { transl_table: '2' } }, cds(4), cds(4), cds(11), cds(null)];
    expect(GeneticCodes.forAnnotations(features).id).toBe(4);
    expect(GeneticCodes.forAnnotations([cds(null)])).toBeNull();
    expect(GeneticCodes.forAnnotations(undefined)).toBeNull();
    // The answer is refreshed when the record gains features.
    const growing = [cds(null)];
    expect(GeneticCodes.forAnnotations(growing)).toBeNull();
    growing.push(cds(11));
    expect(GeneticCodes.forAnnotations(growing).id).toBe(11);
  });

  it('prefers the feature, then its record, then the standard code', () => {
    expect(GeneticCodes.forContext(cds(4), [cds(11)]).id).toBe(4);
    expect(GeneticCodes.forContext(cds(null), [cds(11)]).id).toBe(11);
    expect(GeneticCodes.forContext(null, []).id).toBe(1);
  });

  it('groups synonymous codons by the table in use', () => {
    expect(GeneticCodes.synonymousCodons(GeneticCodes.resolve(1))['*']).toEqual(['TAA', 'TAG', 'TGA']);
    expect(GeneticCodes.synonymousCodons(GeneticCodes.resolve(1)).W).toEqual(['TGG']);
    expect(GeneticCodes.synonymousCodons(GeneticCodes.resolve(4))['*']).toEqual(['TAA', 'TAG']);
    expect(GeneticCodes.synonymousCodons(GeneticCodes.resolve(4)).W).toEqual(['TGA', 'TGG']);
    expect(GeneticCodes.synonymousCodons(GeneticCodes.resolve(1)).L).toEqual([
      'TTA',
      'TTG',
      'CTT',
      'CTC',
      'CTA',
      'CTG',
    ]);
  });

  it('passes a genetic code and CDS flag through the strand-based wrapper', () => {
    expect(Translation.strandBasedTranslateDNA('GTGTGAAAATAA', 1)).toBe('V');
    expect(Translation.strandBasedTranslateDNA('GTGTGAAAATAA', 1, { geneticCode: 4, cds: true })).toBe('MWK');
    expect(Translation.strandBasedTranslateDNA('TTATTTTCACAC', -1, { geneticCode: 4, cds: true })).toBe('MWK');
  });
});

describe('ORF search honours the genetic code', () => {
  it('keeps ATG-only, standard-stop behaviour by default', () => {
    const orfs = Microbe.findORFs('ATGAAATGAAAATAA', 1).filter(orf => orf.frame === 1);
    expect(orfs.map(orf => orf.sequence)).toEqual(['ATGAAATGA']);
  });

  it('reads through TGA under table 4', () => {
    const orfs = Microbe.findORFs('ATGAAATGAAAATAA', 1, { geneticCode: 'mycoplasma' }).filter(orf => orf.frame === 1);
    expect(orfs.map(orf => orf.sequence)).toEqual(['ATGAAATGAAAATAA']);
  });

  it('finds GTG and TTG starts only when alternative starts are requested', () => {
    const dna = 'CCGTGAAACCCTAA';
    expect(Microbe.findORFs(dna, 1, { geneticCode: 11 }).filter(orf => orf.frame > 0)).toEqual([]);
    const orfs = Microbe.findORFs(dna, 1, { geneticCode: 11, alternativeStarts: true }).filter(orf => orf.frame === 3);
    expect(orfs.map(orf => orf.sequence)).toEqual(['GTGAAACCCTAA']);
    expect(() => Microbe.findORFs(dna, 1, { geneticCode: 'klingon' })).toThrow(/Unknown genetic code/);
  });
});
