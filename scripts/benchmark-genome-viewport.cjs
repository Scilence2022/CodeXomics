'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { _electron: electron, expect } = require('@playwright/test');

const APP_ROOT = path.resolve(__dirname, '..');
const FEATURE_COUNTS = [10_000, 100_000, 1_000_000];
const WINDOW_SIZE = 10_000;
const QUERY_COUNT = 40;

async function main() {
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'codexomics-viewport-'));
  let app;
  try {
    const bootstrap = path.join(profile, 'bootstrap.cjs');
    await fs.writeFile(
      bootstrap,
      `const { app } = require('electron');
app.setPath('userData', ${JSON.stringify(profile)});
app.setAppPath(${JSON.stringify(APP_ROOT)});
require(${JSON.stringify(path.join(APP_ROOT, 'src', 'main.js'))});
`
    );
    app = await electron.launch({
      args: [bootstrap, '--no-sandbox', '--disable-gpu'],
      env: { ...process.env, NODE_ENV: 'test', CODEXOMICS_E2E: '1' },
    });

    let genomeView;
    await expect
      .poll(() => {
        genomeView = app.windows().find(page => new URL(page.url()).pathname.endsWith('/renderer/index.html'));
        return Boolean(genomeView);
      })
      .toBe(true);
    await genomeView.waitForFunction(() => Boolean(window.genomeBrowser?.trackRenderer));

    const {
      profile: appProfile,
      runtime,
      rendererPid,
    } = await app.evaluate(({ app: electronApp, webContents }) => ({
      profile: electronApp.getPath('userData'),
      runtime: {
        electron: process.versions.electron,
        chromium: process.versions.chrome,
        node: process.versions.node,
      },
      rendererPid: webContents
        .getAllWebContents()
        .find(contents => new URL(contents.getURL() || 'about:blank').pathname.endsWith('/renderer/index.html'))
        ?.getOSProcessId(),
    }));
    if ((await fs.realpath(appProfile)) !== (await fs.realpath(profile))) {
      throw new Error('Electron did not use the benchmark profile');
    }
    if (!rendererPid) throw new Error('Could not identify the genome renderer process');

    const results = [];
    for (const featureCount of FEATURE_COUNTS) {
      const measured = await genomeView.evaluate(
        ({ featureCount, windowSize, queryCount }) => {
          const chromosomeLength = Math.max(250_000, featureCount * 20);
          const features = Array.from({ length: featureCount }, (_, index) => {
            const start = ((index * 65537) % (chromosomeLength - 1)) + 1;
            const length = index % 100 === 0 ? 25_000 : 50 + (index % 1500);
            return { type: index % 2 ? 'gene' : 'CDS', start, end: Math.min(start + length, chromosomeLength) };
          });
          const TrackRenderer = window.genomeBrowser.trackRenderer.constructor;
          const renderer = new TrackRenderer({
            currentChromosome: 'baseline',
            currentSequence: { baseline: 'A'.repeat(chromosomeLength) },
            shouldShowGeneType: () => true,
          });
          const measure = (circularMode, queryViewport) => {
            renderer.trackSettings = { genes: { circularMode } };
            const samples = [];
            let matchedFeatures = 0;
            for (let index = 0; index <= queryCount; index++) {
              const viewport = queryViewport(index);
              const start = performance.now();
              const visible = renderer.filterGeneAnnotations(features, viewport);
              samples.push(performance.now() - start);
              matchedFeatures += visible.length;
            }
            const [firstMs, ...warm] = samples;
            warm.sort((a, b) => a - b);
            return {
              firstMs,
              warmP50Ms: warm[Math.ceil(warm.length * 0.5) - 1],
              warmP95Ms: warm[Math.ceil(warm.length * 0.95) - 1],
              matchedFeatures,
            };
          };

          return {
            featureCount,
            chromosomeLength,
            linear: measure(false, index => {
              const start = (index * 123457) % (chromosomeLength - windowSize);
              return { start, end: start + windowSize };
            }),
            circularOrigin: measure(true, index => {
              const start = chromosomeLength - windowSize / 2 - index * 19;
              return { start, end: start + windowSize };
            }),
          };
        },
        { featureCount, windowSize: WINDOW_SIZE, queryCount: QUERY_COUNT }
      );

      const memoryKiB = await app.evaluate(({ app: electronApp }, genomePid) => {
        const metrics = electronApp.getAppMetrics();
        const getMemory = pid => {
          const memory = metrics.find(metric => metric.pid === pid)?.memory;
          return memory ? { workingSet: memory.workingSetSize, peakWorkingSet: memory.peakWorkingSetSize } : null;
        };
        return { main: getMemory(process.pid), genomeRenderer: getMemory(genomePid) };
      }, rendererPid);
      results.push({ ...measured, memoryKiB });
    }

    process.stdout.write(
      JSON.stringify(
        {
          schema: 'codexomics.viewport-baseline.v1',
          platform: process.platform,
          arch: process.arch,
          cpu: os.cpus()[0]?.model,
          runtime,
          windowSize: WINDOW_SIZE,
          warmQueriesPerMode: QUERY_COUNT,
          results,
        },
        null,
        2
      ) + '\n'
    );
  } finally {
    try {
      if (app) await app.close();
    } finally {
      await fs.rm(profile, { recursive: true, force: true });
    }
  }
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
