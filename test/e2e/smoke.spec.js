'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { gzipSync } = require('node:zlib');
const { test, expect, _electron: electron } = require('@playwright/test');

const APP_ROOT = path.join(__dirname, '..', '..');

test('genome view opens compressed GenBank at launch and isolates companion data after replacement', async () => {
  const fixtureDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'codexomics-smoke-'));
  const outsideDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'codexomics-outside-'));
  let app;
  try {
    const fixture = path.join(fixtureDirectory, 'smoke.gbk.gz');
    const original =
      'LOCUS       SMOKE                     12 bp    DNA     linear   UNK 01-JAN-2000\n' +
      'FEATURES             Location/Qualifiers\n' +
      '     gene            2..8\n' +
      '                     /gene="fixture_gene"\n' +
      '     CDS             join(2..4,AB123.1:500..510)\n' +
      'ORIGIN\n' +
      '        1 acgtacgtacgt\n' +
      '//\n';
    await fs.writeFile(fixture, gzipSync(original));
    const legacyDirectory = path.join(fixtureDirectory, '.codexomics');
    await fs.mkdir(legacyDirectory);
    const legacyPath = path.join(legacyDirectory, 'smoke.gbk.gz.CodeXomics');
    const legacyData = JSON.stringify({
      _originalPath: await fs.realpath(fixture),
      geneNotes: { fixture: { content: 'old notes' } },
    });
    await fs.writeFile(legacyPath, legacyData);
    const bootstrap = path.join(fixtureDirectory, 'electron-bootstrap.cjs');
    await fs.writeFile(
      bootstrap,
      `const { app } = require('electron');
app.setPath('userData', ${JSON.stringify(fixtureDirectory)});
app.setPath('temp', ${JSON.stringify(fixtureDirectory)});
app.setAppPath(${JSON.stringify(APP_ROOT)});
require(${JSON.stringify(path.join(APP_ROOT, 'src/main.js'))});
`
    );
    app = await electron.launch({
      args: [bootstrap, '--no-sandbox', '--disable-gpu', fixture],
      env: { ...process.env, NODE_ENV: 'test', CODEXOMICS_E2E: '1' },
    });

    let genomeView;
    await expect
      .poll(() => {
        genomeView = app.windows().find(page => new URL(page.url()).pathname.endsWith('/renderer/index.html'));
        return Boolean(genomeView);
      })
      .toBe(true);
    await expect(genomeView.locator('#genomeViewer')).toHaveCount(1);
    await expect
      .poll(() =>
        genomeView.evaluate(() => {
          const genome = window.genomeBrowser;
          const mixed = genome?.currentAnnotations?.SMOKE?.find(item => item.type === 'CDS');
          return {
            chromosome: genome?.currentChromosome,
            sequence: genome?.currentSequence?.SMOKE,
            feature: genome?.currentAnnotations?.SMOKE?.find(item => item.type === 'gene')?.qualifiers?.gene,
            localSegments: mixed
              ? genome.trackRenderer?.projectLocalGenBankFeature(mixed).map(({ start, end }) => [start, end])
              : undefined,
          };
        })
      )
      .toEqual({
        chromosome: 'SMOKE',
        sequence: 'ACGTACGTACGT',
        feature: 'fixture_gene',
        localSegments: [[2, 4]],
      });

    const originalBinding = await genomeView.evaluate(async () => {
      const { loadedGenomePath, loadedGenomeSourceSha256, sidecarManager } = window.genomeBrowser;
      return {
        digest: loadedGenomeSourceSha256,
        notes: await sidecarManager.get(loadedGenomePath, 'geneNotes'),
      };
    });
    expect(originalBinding.digest).toMatch(/^[a-f0-9]{64}$/);
    expect(originalBinding.notes.fixture.content).toBe('old notes');

    const replacement = original.replace('acgtacgtacgt', 'tgcatgcatgca');
    await fs.writeFile(fixture + '.replacement', gzipSync(replacement));
    await fs.rename(fixture + '.replacement', fixture);

    const staleSave = await genomeView.evaluate(async () => {
      const genome = window.genomeBrowser;
      try {
        await genome.sidecarManager.set(genome.loadedGenomePath, 'geneNotes', { stale: { content: 'stale edit' } });
      } catch (error) {
        return error.code;
      }
      return 'saved';
    });
    expect(staleSave).toBe('GENOME_SOURCE_CHANGED');

    const reopen = () =>
      genomeView.evaluate(async () => {
        const genome = window.genomeBrowser;
        const result = await genome.fileManager.loadFile(genome.loadedGenomePath, { reportErrors: false });
        genome.sidecarManager.clearCache(genome.loadedGenomePath);
        return {
          status: result.status,
          digest: genome.loadedGenomeSourceSha256,
          notes: await genome.sidecarManager.get(genome.loadedGenomePath, 'geneNotes'),
        };
      });
    const newBinding = await reopen();
    expect(newBinding.status).toBe('loaded');
    expect(newBinding.digest).not.toBe(originalBinding.digest);
    expect(newBinding.notes).toEqual({});
    await genomeView.evaluate(async () => {
      const genome = window.genomeBrowser;
      await genome.sidecarManager.set(genome.loadedGenomePath, 'geneNotes', { replacement: { content: 'new notes' } });
    });
    await fs.writeFile(fixture, gzipSync(original));
    expect(await reopen()).toEqual({ ...originalBinding, status: 'loaded' });
    expect(await fs.readFile(legacyPath, 'utf8')).toBe(legacyData);
    const expired = await genomeView.evaluate(async destination => {
      const genome = window.genomeBrowser;
      const api = window.electronAPI;
      const source = await api.loadSidecarFile(genome.loadedGenomePath, genome.loadedGenomeSourceSha256);
      const deadline = Date.now() - 1;
      return {
        export: await api.writeFile(destination, 'expired export', deadline),
        annotation: await api.saveSidecarFile(
          genome.loadedGenomePath,
          source.data,
          genome.loadedGenomeSourceSha256,
          deadline
        ),
      };
    }, fixture + '.expired-export');
    expect(expired.export).toMatchObject({ success: false, error: expect.stringMatching(/deadline/) });
    expect(expired.annotation).toMatchObject({ success: false, error: expect.stringMatching(/deadline/) });
    await expect(fs.stat(fixture + '.expired-export')).rejects.toMatchObject({ code: 'ENOENT' });
    const directoryLink = path.join(fixtureDirectory, 'outside-link');
    await fs.symlink(outsideDirectory, directoryLink, process.platform === 'win32' ? 'junction' : 'dir');
    const escapedWrite = await genomeView.evaluate(
      destination => window.electronAPI.writeFile(destination, 'outside'),
      path.join(directoryLink, 'export.gbk')
    );
    expect(escapedWrite).toMatchObject({ success: false, error: expect.stringMatching(/Blocked write file/) });
    await expect(fs.stat(path.join(outsideDirectory, 'export.gbk'))).rejects.toMatchObject({ code: 'ENOENT' });

    const exportPath = path.join(fixtureDirectory, 'stable-export.gbk');
    await fs.writeFile(exportPath, 'previous export', { mode: 0o640 });
    const failed = await genomeView.evaluate(
      destination => window.electronAPI.writeFile(destination, { invalid: true }),
      exportPath
    );
    expect(failed.success).toBe(false);
    expect(await fs.readFile(exportPath, 'utf8')).toBe('previous export');
    expect(
      (await fs.readdir(fixtureDirectory)).filter(name => name.startsWith('.codexomics-') && name.endsWith('.tmp'))
    ).toEqual([]);
    const written = await genomeView.evaluate(
      destination => window.electronAPI.writeFile(destination, 'new export'),
      exportPath
    );
    expect(written).toMatchObject({ success: true, filePath: exportPath, fileSize: 10 });
    expect(await fs.readFile(exportPath, 'utf8')).toBe('new export');
    if (process.platform !== 'win32') expect((await fs.stat(exportPath)).mode & 0o777).toBe(0o640);
  } finally {
    if (app) await app.close();
    await fs.rm(fixtureDirectory, { recursive: true, force: true });
    await fs.rm(outsideDirectory, { recursive: true, force: true });
  }
});
