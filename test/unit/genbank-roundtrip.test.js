import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const require = createRequire(import.meta.url);
const FileManager = require('../../src/renderer/modules/FileManager.js');
const ExportManager = require('../../src/renderer/modules/ExportManager.js');
const GenBankExporter = require('../../src/renderer/modules/export/GenBankExporter.js');

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
    const sandbox = { window: {}, console };
    const source = readFileSync(require.resolve('../../src/renderer/modules/ActionManager.js'), 'utf8');
    runInNewContext(source, sandbox);
    const edit = sandbox.window.ActionManager.prototype.adjustSingleFeature;
    const exporter = new GenBankExporter(browser);
    const shifted = edit(cds, [{ type: 'insert', position: 2, length: 2 }]);
    expect(exporter.formatLocation(shifted)).toBe('join(6..8,22..27)');
    const changed = edit(shifted, [{ type: 'replace', start: 23, end: 23, newSequence: 'G' }]);
    expect(changed.qualifiers.translation).toBeUndefined();
    expect(() => exporter.formatLocation(changed)).toThrow(/edited compound location/);
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
