import { describe, expect, it } from 'vitest';
import fs from 'fs';
import path from 'path';
import vm from 'vm';

const FILE_OPERATION_SERVICE = path.join(process.cwd(), 'src/renderer/modules/chat/services/FileOperationService.js');

function loadFileOperationService(electronAPI) {
  const sandbox = { window: { electronAPI }, console, process };
  vm.createContext(sandbox);
  vm.runInContext(fs.readFileSync(FILE_OPERATION_SERVICE, 'utf8'), sandbox);
  return sandbox.window.FileOperationService;
}

function createHarness({ benchmark = false, dialogResult = { canceled: true } } = {}) {
  const calls = { writeFile: [], showSaveDialog: [] };
  const electronAPI = {
    async writeFile(filePath, content) {
      calls.writeFile.push({ filePath, length: content.length });
      return { success: true, filePath };
    },
    async showSaveDialog(options) {
      calls.showSaveDialog.push(options);
      return dialogResult;
    },
  };

  const sequence = 'ATGAAACGCATTAGCACCACCATTACCACCACCATCACCATTACCACAGGTAACGGTGCGGGCTGA';
  const features = [
    { type: 'gene', start: 1, end: 66, strand: '+', attributes: { name: 'thrL' } },
    { type: 'CDS', start: 1, end: 66, strand: '+', attributes: { name: 'thrL' }, name: 'thrL' },
  ];
  const app = {
    currentSequence: { U00096: sequence },
    currentAnnotations: { U00096: features },
    exportManager: {
      extractFeatureSequence: (chromosomeSequence, feature) =>
        chromosomeSequence.substring(feature.start - 1, feature.end),
      translateDNA: () => 'MKRISTTITTTITTGNGAG*',
    },
  };
  const chatManager = {
    benchmarkAutomationActive: benchmark,
    getCurrentState: () => ({
      currentChromosome: 'U00096',
      currentPosition: { start: 1, end: 66 },
      sequenceLength: sequence.length,
    }),
    showNotification: () => {},
  };

  const FileOperationService = loadFileOperationService(electronAPI);
  return { service: new FileOperationService(app, chatManager), calls };
}

function loadExportDataClass() {
  const source = fs.readFileSync(path.join(process.cwd(), 'src/renderer/modules/ChatManager.js'), 'utf8');
  const start = source.indexOf('  async exportData(params = {}) {');
  const end = source.indexOf('\n  /**\n   * Open the export configuration dialog', start);
  if (start === -1 || end === -1) throw new Error('Unable to extract ChatManager.exportData');
  const methods = source.slice(start, end);
  // eslint-disable-next-line no-new-func -- loads the real source methods into an isolated class
  return new Function(`return class ExportDataSupport {\n${methods}\n}`)();
}

const EXPORT_TOOLS = [
  { method: 'exportFastaSequence', file: 'exported_sequences.fasta' },
  { method: 'exportGenBankFormat', file: 'exported_data.gbk' },
  { method: 'exportGffAnnotations', file: 'exported_annotations.gff3' },
  { method: 'exportBedFormat', file: 'exported_features.bed' },
  { method: 'exportCdsFasta', file: 'exported_cds.fasta' },
  { method: 'exportProteinFasta', file: 'exported_proteins.fasta' },
  { method: 'exportCurrentViewFasta', file: 'exported_region.fasta' },
];

describe('export tools never block on a save dialog', () => {
  EXPORT_TOOLS.forEach(({ method, file }) => {
    it(`${method} writes directly when auto_save and a filename are given`, async () => {
      const { service, calls } = createHarness();
      const filename = `/tmp/exported_files/${file}`;

      const result = await service[method]({ auto_save: true, filename, feature_types: ['all'] });

      expect(result.success).toBe(true);
      expect(calls.showSaveDialog).toHaveLength(0);
      expect(calls.writeFile.map(call => call.filePath)).toEqual([filename]);
      expect(result.file_path).toBe(filename);
    });

    it(`${method} writes directly when only a filename is given`, async () => {
      const { service, calls } = createHarness();
      const filename = `/tmp/exported_files/${file}`;

      await service[method]({ filename, feature_types: ['all'] });

      expect(calls.showSaveDialog).toHaveLength(0);
      expect(calls.writeFile.map(call => call.filePath)).toEqual([filename]);
    });

    it(`${method} fails fast instead of opening a dialog during benchmark automation`, async () => {
      const { service, calls } = createHarness({ benchmark: true });

      await expect(service[method]({ feature_types: ['all'] })).rejects.toThrow(
        /requires an explicit filename \(or auto_save\) during benchmark automation/
      );
      expect(calls.showSaveDialog).toHaveLength(0);
      expect(calls.writeFile).toHaveLength(0);
    });

    it(`${method} reports failure when the interactive save dialog is canceled`, async () => {
      const { service, calls } = createHarness({ dialogResult: { canceled: true } });

      await expect(service[method]({ feature_types: ['all'] })).rejects.toThrow(/export canceled/);
      expect(calls.showSaveDialog).toHaveLength(1);
      expect(calls.writeFile).toHaveLength(0);
    });
  });

  it('routes export_data through the same non-interactive export path', async () => {
    const { service, calls } = createHarness();
    const ExportDataSupport = loadExportDataClass();
    const manager = new ExportDataSupport();
    manager.services = { file: service };

    const formats = [
      ['genbank', '/tmp/exported_files/exported_data.gbk', 'export_genbank_format'],
      ['gff3', '/tmp/exported_files/exported_annotations.gff3', 'export_gff_annotations'],
      ['bed', '/tmp/exported_files/exported_features.bed', 'export_bed_format'],
      ['fasta', '/tmp/exported_files/exported_sequences.fasta', 'export_fasta_sequence'],
    ];

    for (const [format, filename, delegate] of formats) {
      const result = await manager.exportData({ format, filename, auto_save: true, feature_types: ['all'] });
      expect(result.success).toBe(true);
      expect(result.tool).toBe('export_data');
      expect(result.delegated_tool).toBe(delegate);
      expect(result.file_path).toBe(filename);
    }

    expect(calls.showSaveDialog).toHaveLength(0);
    expect(calls.writeFile.map(call => call.filePath)).toEqual(formats.map(([, filename]) => filename));
  });

  it('export_data fails fast during benchmark automation instead of opening a dialog', async () => {
    const { service, calls } = createHarness({ benchmark: true });
    const ExportDataSupport = loadExportDataClass();
    const manager = new ExportDataSupport();
    manager.services = { file: service };

    await expect(manager.exportData({})).rejects.toThrow(/during benchmark automation/);
    expect(calls.showSaveDialog).toHaveLength(0);
  });

  it('export_data returns a region FASTA inline when no destination is given', async () => {
    const { service, calls } = createHarness();
    const ExportDataSupport = loadExportDataClass();
    const manager = new ExportDataSupport();
    manager.services = { file: service };
    manager.app = { getSequenceForRegion: async () => 'ATGAAACGC' };

    const result = await manager.exportData({ format: 'fasta', chromosome: 'U00096', start: 1, end: 9 });

    expect(result.content).toBe('>U00096:1-9\nATGAAACGC\n');
    expect(calls.showSaveDialog).toHaveLength(0);
    expect(calls.writeFile).toHaveLength(0);
  });

  it('export_data writes a region FASTA when a destination is given', async () => {
    const { service, calls } = createHarness();
    const ExportDataSupport = loadExportDataClass();
    const manager = new ExportDataSupport();
    manager.services = { file: service };
    manager.app = { getSequenceForRegion: async () => 'ATGAAACGC' };

    const result = await manager.exportData({
      format: 'fasta',
      chromosome: 'U00096',
      start: 1,
      end: 9,
      filename: '/tmp/exported_files/region.fasta',
      auto_save: true,
    });

    expect(result.file_path).toBe('/tmp/exported_files/region.fasta');
    expect(calls.showSaveDialog).toHaveLength(0);
    expect(calls.writeFile.map(call => call.filePath)).toEqual(['/tmp/exported_files/region.fasta']);
  });

  it('still offers the save dialog for an interactive export without a destination', async () => {
    const { service, calls } = createHarness({
      dialogResult: { canceled: false, filePath: '/Users/tester/Downloads/genome.gbk' },
    });

    const result = await service.exportGenBankFormat({});

    expect(calls.showSaveDialog).toHaveLength(1);
    expect(calls.showSaveDialog[0].defaultPath).toBe('genome.gbk');
    expect(result.file_path).toBe('/Users/tester/Downloads/genome.gbk');
  });
});
