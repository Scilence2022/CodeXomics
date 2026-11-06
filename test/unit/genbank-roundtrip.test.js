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
    expect(() => exporter.formatLocation(changed)).toThrow(/edited compound location/);
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
    ['join(<2..4,7..8)', {}],
    ['join(2..4,AB123.1:7..8)', {}],
    ['join(2..4,7..8)', { transl_except: '(pos:7..8,aa:Sec)' }],
  ])('requires review for gap edits to %s with unresolved coordinates', (location, qualifiers) => {
    const actions = createActionManager({});
    const exporter = new GenBankExporter({});
    const edited = actions.adjustSingleFeature(
      { type: 'CDS', start: 2, end: 8, strand: 1, location, qualifiers, genbankLocationBounds: [2, 8, 1] },
      [{ type: 'insert', position: 5, sequence: 'AA' }]
    );
    expect(() => exporter.formatLocation(edited)).toThrow(/edited compound location/);
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
