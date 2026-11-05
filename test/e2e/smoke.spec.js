'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { test, expect, _electron: electron } = require('@playwright/test');

const APP_ROOT = path.join(__dirname, '..', '..');

test('genome view starts and opens a GenBank file', async () => {
  const fixtureDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'codexomics-smoke-'));
  let app;
  try {
    const fixture = path.join(fixtureDirectory, 'smoke.gbk');
    await fs.writeFile(
      fixture,
      'LOCUS       SMOKE                     12 bp    DNA     linear   UNK 01-JAN-2000\n' +
        'FEATURES             Location/Qualifiers\n' +
        '     gene            2..8\n' +
        '                     /gene="fixture_gene"\n' +
        'ORIGIN\n' +
        '        1 acgtacgtacgt\n' +
        '//\n'
    );
    app = await electron.launch({
      args: [APP_ROOT, '--no-sandbox', '--disable-gpu', fixture],
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
          return {
            chromosome: genome?.currentChromosome,
            sequence: genome?.currentSequence?.SMOKE,
            feature: genome?.currentAnnotations?.SMOKE?.find(item => item.type === 'gene')?.qualifiers?.gene,
          };
        })
      )
      .toEqual({ chromosome: 'SMOKE', sequence: 'ACGTACGTACGT', feature: 'fixture_gene' });
  } finally {
    if (app) await app.close();
    await fs.rm(fixtureDirectory, { recursive: true, force: true });
  }
});
