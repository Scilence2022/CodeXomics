import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const FileManager = require('../../src/renderer/modules/FileManager.js');
const ExportManager = require('../../src/renderer/modules/ExportManager.js');
const GenBankExporter = require('../../src/renderer/modules/export/GenBankExporter.js');
const actionSandbox = { window: {}, console, GenBankExporter };
runInNewContext(readFileSync(require.resolve('../../src/renderer/modules/ActionManager.js'), 'utf8'), actionSandbox);

function createActionManager(browser) {
  return Object.assign(Object.create(actionSandbox.window.ActionManager.prototype), { genomeBrowser: browser });
}

async function parse(data) {
  const browser = {
    populateChromosomeSelect() {},
    selectChromosome() {},
    updateStatus() {},
  };
  const loader = new FileManager(browser);
  loader.currentFile = { path: '/fixture.gbk', data };
  loader.updateLoadedFilesList = () => {};
  await loader.parseGenBank();
  return browser;
}

describe('GenBank round trip', () => {
  it('keeps multiline compound locations, complete translations, repeated qualifiers and topology', async () => {
    const location = 'complement(join(10..180,205..466))';
    const translation = 'M' + 'ACDEFGHIKLMNPQRSTVWY'.repeat(7);
    const input = [
      'LOCUS       FIXTURE 498 bp DNA circular',
      'FEATURES             Location/Qualifiers',
      '     CDS             complement(join(10..180,',
      '                     205..466))',
      '                     /note="two ""quotes"""',
      '                     /note="another value"',
      `                     /translation="${translation.slice(0, 45)}`,
      `                     ${translation.slice(45, 105)}`,
      `                     ${translation.slice(105)}"`,
      'ORIGIN',
      `        1 ${'acg'.repeat(166)}`,
      '//',
    ].join('\n');
    const browser = await parse(input);
    expect(browser.sourceFeatures.FIXTURE.topology).toBe('circular');
    const [cds] = browser.currentAnnotations.FIXTURE;
    expect(cds.genbankLocation).toBe(location);
    expect(cds.genbankLocationSpan).toEqual([10, 466]);
    expect(cds.qualifiers.translation).toBe(translation);
    expect(cds.genbankLegacyTranslation).toMatch(/\.\.\.$/);

    const manager = new ExportManager(browser);
    manager.exportConfig.includeProteinSequences = true;
    manager.downloadFile = vi.fn();
    manager.exportAsGenBank();
    const [serialized] = manager.downloadFile.mock.calls[0];
    const editedPathSerializer = new GenBankExporter(browser);
    expect(editedPathSerializer.formatLocation(cds)).toBe(location);
    const reopened = await parse(serialized);
    const reopenedCds = reopened.currentAnnotations.FIXTURE.find(item => item.type === 'CDS');
    expect(reopenedCds.location).toBe(location);
    expect(reopenedCds.qualifiers.translation).toBe(translation);
    expect(reopenedCds.qualifiers.note).toEqual(cds.qualifiers.note);
    expect(reopened.sourceFeatures.FIXTURE.topology).toBe('circular');
  });

  it('extracts joined CDS segments in coding order and honors the annotated reading frame', () => {
    const manager = new ExportManager({});
    const feature = {
      type: 'CDS',
      genbankLocation: 'complement(join(1..3,9..12))',
      genbankLocationBounds: [1, 12, -1],
      start: 1,
      end: 12,
      strand: -1,
      qualifiers: { codon_start: '2' },
    };
    expect(manager.extractFeatureSequence('TTTGGGGGCATC', feature)).toBe('GATGAAA');
    expect(manager.extractFeatureProtein('TTTGGGGGCATC', feature)).toBe('MK');
    const annotated = { ...feature, qualifiers: { translation: 'MW', transl_table: '4' } };
    expect(manager.extractFeatureProtein('TTTGGGGGCATC', annotated)).toBe('MW');
    expect(() =>
      manager.extractFeatureProtein('TTTGGGGGCATC', { ...annotated, qualifiers: { transl_table: '4' } })
    ).toThrow(/table 4/);
  });

  it('keeps circular-origin order and rejects extraction that requires a remote record', () => {
    const manager = new ExportManager({});
    const feature = { type: 'CDS', start: 1, end: 12, strand: 1, genbankLocationBounds: [1, 12, 1] };
    expect(manager.extractFeatureSequence('AAAGGGGGGCCC', { ...feature, genbankLocation: 'join(10..12,1..3)' })).toBe(
      'CCCAAA'
    );
    expect(() =>
      manager.extractFeatureSequence('AAAGGGGGGCCC', {
        ...feature,
        genbankLocation: 'join(10..12,AB123.1:1..3)',
      })
    ).toThrow(/Cannot extract local sequence/);
  });

  it('detects an edit to a segment that begins on a continuation line', async () => {
    const browser = await parse(
      [
        'LOCUS       FIXTURE 30 bp DNA circular',
        'FEATURES             Location/Qualifiers',
        '     CDS             join(4..6,',
        '                     20..25)',
        '                     /translation="MMM"',
        'ORIGIN',
        `        1 ${'atg'.repeat(10)}`,
        '//',
      ].join('\n')
    );
    const [cds] = browser.currentAnnotations.FIXTURE;
    const actions = createActionManager(browser);
    const exporter = new GenBankExporter(browser);
    const shifted = actions.adjustSingleFeature(cds, [{ type: 'insert', position: 2, length: 2 }]);
    expect(exporter.formatLocation(shifted)).toBe('join(6..8,22..27)');
    const changed = actions.adjustSingleFeature(shifted, [{ type: 'replace', start: 23, end: 23, newSequence: 'G' }]);
    expect(changed.qualifiers.translation).toBeUndefined();
    expect(exporter.formatLocation(changed)).toBe('join(6..8,22..27)');
    expect(() => exporter.generateFeatures('FIXTURE', 'A'.repeat(32), [changed], {})).toThrow(/edited CDS/);
  });

  it.each([
    { location: 'join(1..9,14..16)', strand: 1, position: 6, replacement: 'C' },
    { location: 'complement(join(1..3,8..16))', strand: -1, position: 11, replacement: 'G' },
  ])(
    'verifies synonymous edits in $location before GenBank and protein export',
    async ({ location, strand, position, replacement }) => {
      const manager = new ExportManager({});
      const sequence = 'ATGGCTGAACCCCTAA';
      const source = strand === 1 ? sequence : manager.reverseComplement(sequence);
      const browser = await parse(
        [
          'LOCUS       FIXTURE 16 bp DNA linear',
          'FEATURES             Location/Qualifiers',
          `     CDS             ${location}`,
          '                     /translation="MAE"',
          '                     /transl_table=11',
          'ORIGIN',
          `        1 ${source.toLowerCase()}`,
          '//',
        ].join('\n')
      );
      const actions = createActionManager(browser);
      const exporter = new GenBankExporter(browser);
      const data = { sequence: { ...browser.currentSequence }, annotations: { ...browser.currentAnnotations } };
      const edit = { type: 'replace', start: position, end: position, newSequence: replacement };
      actions.applySequenceModificationToGenomeData(data, 'FIXTURE', edit);
      actions.applyFeatureModificationToGenomeData(data, 'FIXTURE', edit);
      const [cds] = data.annotations.FIXTURE;
      expect(cds.qualifiers.translation).toBeUndefined();
      expect(manager.extractFeatureProtein(data.sequence.FIXTURE, cds)).toBe('MAE');
      const reopened = await parse(
        exporter.exportGenBank({
          chromosomes: ['FIXTURE'],
          getSequence: chr => data.sequence[chr],
          getFeatures: chr => data.annotations[chr],
        })
      );
      expect(reopened.currentAnnotations.FIXTURE.find(item => item.type === 'CDS')).toMatchObject({
        location,
        strand,
        qualifiers: { translation: 'MAE', transl_table: '11' },
      });
    }
  );

  it.each([
    [{ type: 'insert', position: 5, sequence: 'A' }, /not a complete unambiguous CDS/],
    [{ type: 'replace', start: 5, end: 5, newSequence: 'T' }, /changes the annotated protein/],
  ])('blocks both exports when an internal edit alters a CDS (%j)', (edit, reason) => {
    const actions = createActionManager({});
    const exporter = new GenBankExporter({});
    const manager = new ExportManager({});
    const data = {
      sequence: { FIXTURE: 'ATGGCTGAACCCCTAA' },
      annotations: {
        FIXTURE: [
          {
            type: 'CDS',
            start: 1,
            end: 16,
            strand: 1,
            location: 'join(1..9,14..16)',
            genbankLocationBounds: [1, 16, 1],
            qualifiers: { translation: 'MAE', protein_id: 'old' },
          },
        ],
      },
    };
    actions.applySequenceModificationToGenomeData(data, 'FIXTURE', edit);
    actions.applyFeatureModificationToGenomeData(data, 'FIXTURE', edit);
    const [cds] = data.annotations.FIXTURE;
    expect(() => manager.extractFeatureProtein(data.sequence.FIXTURE, cds)).toThrow(reason);
    expect(() => exporter.generateFeatures('FIXTURE', data.sequence.FIXTURE, [cds], {})).toThrow(reason);
  });

  it('remaps a noncoding join after an insertion and a deletion within its segments', () => {
    const actions = createActionManager({});
    const exporter = new GenBankExporter({});
    const feature = {
      type: 'misc_feature',
      start: 2,
      end: 15,
      strand: 1,
      location: 'join(2..7,10..15)',
      genbankLocationBounds: [2, 15, 1],
    };
    const inserted = actions.adjustSingleFeature(feature, [{ type: 'insert', position: 5, sequence: 'AA' }]);
    const deleted = actions.adjustSingleFeature(inserted, [{ type: 'delete', start: 14, end: 15 }]);
    expect(exporter.formatLocation(inserted)).toBe('join(2..9,12..17)');
    expect(exporter.formatLocation(deleted)).toBe('join(2..9,12..15)');
  });

  it('keeps coding order, translation and sequence through repeated edits between local joined segments', async () => {
    const browser = await parse(
      [
        'LOCUS       FIXTURE 30 bp DNA circular',
        'FEATURES             Location/Qualifiers',
        '     CDS             complement(join(22..24,',
        '                     2..4,6))',
        '                     /translation="MK"',
        'ORIGIN',
        '        1 aaccggttta ggccttaacc ggatcccggt',
        '//',
      ].join('\n')
    );
    const actions = createActionManager(browser);
    const exporter = new GenBankExporter(browser);
    const manager = new ExportManager(browser);
    const [original] = browser.currentAnnotations.FIXTURE;
    const originalSequence = browser.currentSequence.FIXTURE;
    const workspace = { sequence: { FIXTURE: originalSequence }, annotations: { FIXTURE: [original] } };
    const extract = (sequence, feature) => manager.extractFeatureSequence(sequence, feature);
    const expectedSequence = extract(originalSequence, original);
    const edits = [
      { type: 'insert', position: 22, sequence: 'TTA', expected: 'complement(join(25..27,2..4,6))' },
      { type: 'delete', start: 8, end: 11, expected: 'complement(join(21..23,2..4,6))' },
      { type: 'replace', start: 9, end: 10, newSequence: 'AGTC', expected: 'complement(join(23..25,2..4,6))' },
    ];
    for (const modification of edits) {
      actions.applySequenceModificationToGenomeData(workspace, 'FIXTURE', modification);
      actions.applyFeatureModificationToGenomeData(workspace, 'FIXTURE', modification);
      const [feature] = workspace.annotations.FIXTURE;
      expect(exporter.formatLocation(feature)).toBe(modification.expected);
      expect(extract(workspace.sequence.FIXTURE, feature)).toBe(expectedSequence);
      expect(feature.qualifiers.translation).toBe('MK');
    }

    const serialized = exporter.exportGenBank({
      chromosomes: ['FIXTURE'],
      getSequence: chr => workspace.sequence[chr],
      getFeatures: chr => workspace.annotations[chr],
      options: { includeProteinSequences: true },
    });
    const reopened = await parse(serialized);
    const [feature] = reopened.currentAnnotations.FIXTURE.filter(item => item.type === 'CDS');
    expect(feature.location).toBe(edits.at(-1).expected);
    expect(extract(reopened.currentSequence.FIXTURE, feature)).toBe(expectedSequence);
    expect(feature.qualifiers.translation).toBe('MK');
    expect(reopened.sourceFeatures.FIXTURE.topology).toBe('circular');
    expect(exporter.formatLocation(original)).toBe('complement(join(22..24,2..4,6))');
  });

  it('remaps order locations while keeping them unavailable for joined sequence extraction', () => {
    const actions = createActionManager({});
    const exporter = new GenBankExporter({});
    const feature = {
      type: 'misc_feature',
      start: 2,
      end: 8,
      strand: 1,
      location: 'order(2,7..8)',
      genbankLocationBounds: [2, 8, 1],
    };
    const edited = actions.adjustSingleFeature(feature, [{ type: 'insert', position: 5, sequence: 'AA' }]);
    expect(exporter.formatLocation(edited)).toBe('order(2,9..10)');
    expect(() => exporter.extractLocationSequence('A'.repeat(10), edited, vi.fn())).toThrow(/order location/);
  });

  it.each([
    ['join(<2..4,7..8)', 5, 'join(<2..4,9..10)'],
    ['join(2..4,7..>8)', 5, 'join(2..4,9..>10)'],
    ['complement(4..>8)', 2, 'complement(6..>10)'],
    ['complement(join(AB123.1:4..6,2..4,7..8))', 5, 'complement(join(AB123.1:4..6,2..4,9..10))'],
  ])(
    'remaps local edits to %s without changing remote references or boundary markers',
    (location, position, expected) => {
      const actions = createActionManager({});
      const exporter = new GenBankExporter({});
      const strand = location.startsWith('complement(') ? -1 : 1;
      const edited = actions.adjustSingleFeature(
        { type: 'misc_feature', start: 2, end: 8, strand, location, genbankLocationBounds: [2, 8, strand] },
        [{ type: 'insert', position, sequence: 'AA' }]
      );
      expect(exporter.formatLocation(edited)).toBe(expected);
    }
  );

  it.each([
    ['<4..8', { type: 'insert', position: 2, sequence: 'AA' }, /may overlap fuzzy coordinate/],
    ['4..>8', { type: 'delete', start: 9, end: 9 }, /may overlap fuzzy coordinate/],
    ['<4..8', { type: 'replace', start: 2, end: 9, newSequence: 'AA' }, /may overlap fuzzy coordinate/],
    ['join(4..8,AB123.1:4..8)', { type: 'replace', start: 2, end: 9, newSequence: 'AA' }, /Edit overlaps coordinate/],
  ])('blocks export when an edit may invalidate %s', (location, edit, diagnostic) => {
    const actions = createActionManager({});
    const exporter = new GenBankExporter({});
    const feature = { type: 'CDS', start: 4, end: 8, strand: 1, location, genbankLocationBounds: [4, 8, 1] };
    const workspace = { annotations: { FIXTURE: [feature] } };
    actions.applyFeatureModificationToGenomeData(workspace, 'FIXTURE', edit);
    const [edited] = workspace.annotations.FIXTURE;
    expect(() => exporter.formatLocation(edited)).toThrow(diagnostic);
    const editedAgain = actions.adjustSingleFeature(edited, [{ type: 'insert', position: 10, sequence: 'AA' }]);
    expect(() => exporter.formatLocation(editedAgain)).toThrow(diagnostic);
    expect(exporter.formatLocation(feature)).toBe(location);
  });

  it('keeps a remote-only feature through a replacement of the same numeric local coordinates', () => {
    const actions = createActionManager({});
    const exporter = new GenBankExporter({});
    const feature = {
      type: 'misc_feature',
      start: 4,
      end: 8,
      strand: 1,
      location: 'AB123.1:4..8',
      genbankLocationBounds: [4, 8, 1],
    };
    const workspace = { annotations: { FIXTURE: [feature] } };
    actions.applyFeatureModificationToGenomeData(workspace, 'FIXTURE', {
      type: 'replace',
      start: 2,
      end: 9,
      newSequence: 'AA',
    });
    expect(workspace.annotations.FIXTURE).toEqual([feature]);
    expect(exporter.formatLocation(workspace.annotations.FIXTURE[0])).toBe('AB123.1:4..8');
  });

  it('blocks legacy fuzzy shifts that lack the edit position needed to check the boundary', () => {
    const exporter = new GenBankExporter({});
    expect(() =>
      exporter.formatLocation({
        type: 'CDS',
        start: 5,
        end: 9,
        strand: 1,
        location: '<4..8',
        genbankLocationBounds: [4, 8, 1],
      })
    ).toThrow(/edited fuzzy location/);
  });

  it('round-trips repeated coordinate qualifiers after gap and upstream edits', async () => {
    const browser = await parse(
      [
        'LOCUS       FIXTURE 30 bp DNA linear',
        'FEATURES             Location/Qualifiers',
        '     CDS             join(2..7,20..25)',
        '                     /transl_except=(pos:5..7,aa:Sec)',
        '                     /transl_except=(pos:join(20,21..22),aa:Trp)',
        '     tRNA            complement(join(3..7,21..26))',
        '                     /anticodon=(pos:complement(22..24),aa:Leu,seq:taa)',
        '     repeat_region   join(2..7,20..25)',
        '                     /rpt_unit_range=4..6',
        '                     /rpt_unit_range=21..23',
        'ORIGIN',
        '        1 aaccggttta ggccttaacc ggatcccggt',
        '//',
      ].join('\n')
    );
    const actions = createActionManager(browser);
    const data = { sequence: { ...browser.currentSequence }, annotations: { ...browser.currentAnnotations } };
    for (const edit of [
      { type: 'insert', position: 12, sequence: 'TTA' },
      { type: 'delete', start: 1, end: 1 },
    ]) {
      actions.applySequenceModificationToGenomeData(data, 'FIXTURE', edit);
      actions.applyFeatureModificationToGenomeData(data, 'FIXTURE', edit);
    }
    const exporter = new GenBankExporter(browser);
    const reopened = await parse(
      exporter.exportGenBank({
        chromosomes: ['FIXTURE'],
        getSequence: chr => data.sequence[chr],
        getFeatures: chr => data.annotations[chr],
      })
    );
    const byType = Object.fromEntries(reopened.currentAnnotations.FIXTURE.map(feature => [feature.type, feature]));
    expect(byType.CDS.location).toBe('join(1..6,22..27)');
    expect(byType.CDS.qualifiers.transl_except).toEqual(['(pos:4..6,aa:Sec)', '(pos:join(22,23..24),aa:Trp)']);
    expect(byType.tRNA.location).toBe('complement(join(2..6,23..28))');
    expect(byType.tRNA.qualifiers.anticodon).toBe('(pos:complement(24..26),aa:Leu,seq:taa)');
    expect(byType.repeat_region.qualifiers.rpt_unit_range).toEqual(['3..5', '23..25']);
    expect(browser.currentAnnotations.FIXTURE[0].qualifiers.transl_except[0]).toBe('(pos:5..7,aa:Sec)');
  });

  it.each([
    ['complement(2..8)', 'complement(5..11)'],
    ['complement(join(2..5,7..8))', 'complement(join(5..8,10..11))'],
  ])('shifts coordinate qualifiers with legacy uniform offsets for %s', (location, remapped) => {
    const exporter = new GenBankExporter({});
    const feature = {
      type: 'tRNA',
      start: 5,
      end: 11,
      strand: -1,
      location,
      genbankLocationBounds: [2, 8, -1],
      qualifiers: { anticodon: '(pos:complement(3..5),aa:Leu,seq:taa)' },
    };
    const content = exporter.generateFeatures('fixture', 'A'.repeat(12), [feature], {});
    expect(content).toContain(remapped);
    expect(content).toContain('(pos:complement(6..8),aa:Leu,seq:taa)');
    expect(feature.qualifiers.anticodon).toBe('(pos:complement(3..5),aa:Leu,seq:taa)');
    expect(() =>
      exporter.generateFeatures('fixture', 'A'.repeat(12), [{ ...feature, genbankLocationEdited: true }], {})
    ).toThrow(/Cannot export (?:coordinate qualifiers|edited compound location)/);
  });

  it.each([{ transl_except: '(pos:<7..8,aa:Sec)' }, { rpt_unit_range: '3..7' }])(
    'rejects export when an edit cannot remap a coordinate qualifier %j',
    qualifiers => {
      const actions = createActionManager({});
      const exporter = new GenBankExporter({});
      const edited = actions.adjustSingleFeature(
        {
          type: 'misc_feature',
          start: 2,
          end: 8,
          strand: 1,
          location: 'join(2..4,7..8)',
          qualifiers,
          genbankLocationBounds: [2, 8, 1],
        },
        [{ type: 'insert', position: 5, sequence: 'AA' }]
      );
      expect(exporter.formatLocation(edited)).toBe('join(2..4,9..10)');
      expect(() => exporter.generateFeatures('fixture', 'A'.repeat(10), [edited], {})).toThrow(/Cannot remap \//);
    }
  );

  it('retains remote qualifier references while shifting nearby local coordinates', () => {
    const actions = createActionManager({});
    const exporter = new GenBankExporter({});
    const remote = '(pos:AB123.1:7..8,aa:Sec)';
    const feature = {
      type: 'CDS',
      start: 2,
      end: 8,
      strand: 1,
      location: 'join(2..4,7..8)',
      genbankLocationBounds: [2, 8, 1],
      qualifiers: { transl_except: [remote, '(pos:7..8,aa:TERM)'] },
    };
    const edited = actions.adjustSingleFeature(feature, [{ type: 'insert', position: 5, sequence: 'AA' }]);
    expect(edited.qualifiers.transl_except).toEqual([remote, '(pos:9..10,aa:TERM)']);
    expect(exporter.generateFeatures('fixture', 'A'.repeat(10), [edited], {})).toContain(remote);
    expect(exporter.getExportQualifiers({ ...feature, start: 4, end: 10 }).transl_except).toEqual([
      remote,
      '(pos:9..10,aa:TERM)',
    ]);
  });

  it('moves a fuzzy qualifier only when the edit is outside its possible span', () => {
    const actions = createActionManager({});
    const exporter = new GenBankExporter({});
    const feature = {
      type: 'tRNA',
      start: 4,
      end: 8,
      strand: -1,
      location: 'complement(4..8)',
      genbankLocationBounds: [4, 8, -1],
      qualifiers: { anticodon: '(pos:complement(5..>6),aa:Leu,seq:taa)' },
    };
    const shifted = actions.adjustSingleFeature(feature, [{ type: 'insert', position: 2, sequence: 'AA' }]);
    expect(exporter.formatLocation(shifted)).toBe('complement(6..10)');
    expect(shifted.qualifiers.anticodon).toBe('(pos:complement(7..>8),aa:Leu,seq:taa)');
    const downstream = actions.adjustSingleFeature(shifted, [{ type: 'insert', position: 12, sequence: 'AA' }]);
    expect(() => exporter.generateFeatures('fixture', 'A'.repeat(16), [downstream], {})).toThrow(
      /Cannot remap \/anticodon: Edit may overlap fuzzy coordinate/
    );
    expect(() => exporter.getExportQualifiers({ ...feature, start: 6, end: 10 })).toThrow(
      /Unsupported fuzzy coordinate/
    );
  });

  it('shifts an unchanged compound location uniformly and rejects an edit across its spans', () => {
    const exporter = new GenBankExporter({});
    const feature = {
      type: 'CDS',
      location: 'complement(join(2..4,10..12))',
      genbankLocationBounds: [2, 12, -1],
      start: 5,
      end: 15,
      strand: -1,
    };
    expect(exporter.formatLocation(feature)).toBe('complement(join(5..7,13..15))');
    expect(() => exporter.formatLocation({ ...feature, genbankLocationEdited: true })).toThrow(/compound location/);
  });
});
