/* global vi */

const fs = require('node:fs');
const path = require('node:path');
const CircosData = require('../../src/circos-data');

describe('Circos dataset boundaries', () => {
  it('reads legacy data and normalizes aliases, coordinates and position-only links', () => {
    const sample = require('../../src/sample_circos_data.json');
    expect(CircosData.normalize(sample).genes).toHaveLength(sample.genes.length);

    const data = CircosData.normalize({
      coordinateSystem: '1-based-inclusive',
      chromosomes: [{ id: 'c1', name: 'Chromosome 1', size: '10' }],
      genes: [{ chromosome: 'c1', start: '1', end: '1' }],
      links: [{ source: { chromosome: 'c1', position: 1 }, target: { chromosome: 'c1', position: 10 } }],
    });
    expect(data.coordinateSystem).toBe('0-based-half-open');
    expect(data.genes[0]).toMatchObject({ chromosome: 'Chromosome 1', start: 0, end: 1 });
    expect(data.links[0]).toMatchObject({ source: { start: 0 }, target: { start: 9 } });
    expect(CircosData.normalize(data)).toEqual(data);
  });

  it('rejects malformed intervals and unknown chromosomes', () => {
    const chromosomes = [{ name: 'a', length: 10 }];
    expect(() => CircosData.normalize({ chromosomes, genes: [{ chromosome: 'a', start: 0, end: 11 }] })).toThrow(
      'genes row 1'
    );
    expect(() =>
      CircosData.normalize({
        chromosomes,
        tracks: { gc_skew: [{ chromosome: 'b', start: 0, end: 10, value: 0 }] },
      })
    ).toThrow('gc_skew window at row 1');
    expect(() => CircosData.fromTable([{ chromosome: 'x', start: '', end: '4' }])).toThrow('genes row 1');
  });

  it('keeps annotation-free genomes empty and preserves compound locations', () => {
    const sequences = { one: 'a'.repeat(30), two: 'a'.repeat(100000) };
    expect(CircosData.fromGenome(sequences).genes).toEqual([]);
    const data = CircosData.fromGenome(sequences, {
      one: [
        { type: 'gene', start: 1, end: 30, strand: -1, qualifiers: { locus_tag: ['first'] } },
        {
          type: 'CDS',
          start: 1,
          end: 30,
          strand: -1,
          qualifiers: { locus_tag: 'first' },
          segments: [
            { start: 1, end: 5 },
            { start: 26, end: 30 },
          ],
        },
        { type: 'tRNA', start: 8, end: 8 },
        { type: 'source', start: 1, end: 30 },
        { type: 'gene', start: 31, end: 40 },
      ],
    });
    expect(data.metadata).toMatchObject({ totalGenes: 2, invalidFeatures: 1 });
    expect(data.genes[0]).toMatchObject({
      id: 'first',
      track: 'protein_coding',
      start: 0,
      end: 30,
      strand: '-',
      segments: [
        { start: 0, end: 5 },
        { start: 25, end: 30 },
      ],
    });
    expect(data.genes[1]).toMatchObject({ track: 'tRNA', start: 7, end: 8 });
  });

  it('uses called bases and emits a partial window with missing values preserved', async () => {
    const tracks = await CircosData.sequenceTracks({ a: 'AgCNaaNNN', b: 'G' }, 4);
    expect(tracks.gc_content.map(point => point.value)).toEqual([200 / 3, 0, null, 100]);
    expect(tracks.gc_skew.map(point => point.value)).toEqual([0, null, null, 1]);
    expect(tracks.gc_content[2]).toEqual({ chromosome: 'a', start: 8, end: 9, value: null });
  });

  it('bounds WIG sampling and preserves signed values without filling uncovered bins', () => {
    const wig = CircosData.wigTrack([{ name: 'c', length: 64000 }], {
      c: [
        { start: 1, end: 4, value: -8 },
        { start: 4, end: 6, value: 10 },
        { start: 12, end: 13, value: 0 },
      ],
    });
    expect(wig).toEqual([
      { chromosome: 'c', start: 0, end: 4, value: -8 },
      { chromosome: 'c', start: 4, end: 8, value: 10 },
      { chromosome: 'c', start: 12, end: 16, value: 0 },
    ]);
  });

  it('rejects navigation from a stale genome snapshot and converts the first base correctly', () => {
    const bridge = fs.readFileSync(path.join(__dirname, '../../src/renderer/modules/CircosGenomeBridge.js'), 'utf8');
    const genomeBrowser = {
      currentSequence: { a: 'aaaa' },
      tabManager: { activeTabId: 'tab1' },
      navigationManager: { navigateToPosition: vi.fn(() => ({ success: true })) },
    };
    const glob = { genomeBrowser };
    // The renderer installs the bridge as a classic script on window.
    require('node:vm').runInNewContext(bridge, { window: glob, CircosData });
    glob.circosGenome.load('1');
    expect(glob.circosGenome.navigate('1', { chromosome: 'a', start: 0, end: 1 })).toEqual({ success: true });
    expect(genomeBrowser.navigationManager.navigateToPosition).toHaveBeenCalledWith('a', 1, 1);
    genomeBrowser.currentSequence.a = 'tttt';
    expect(() => glob.circosGenome.navigate('1', { chromosome: 'a' })).toThrow('source genome changed');
    genomeBrowser.currentSequence.a = 'aaaa';
    genomeBrowser.tabManager.activeTabId = 'tab2';
    expect(() => glob.circosGenome.navigate('1', { chromosome: 'a' })).toThrow('source genome changed');
  });
});

describe('Circos shared layout', () => {
  it('keeps fragmented assemblies ordered, drawable and aligned with their features', async () => {
    const d3 = await import('d3');
    const source = fs.readFileSync(path.join(__dirname, '../../src/circos-scene.js'), 'utf8');
    const scope = {};
    require('node:vm').runInNewContext(source, { window: scope, d3 });
    const chromosomes = Array.from({ length: 250 }, (_, index) => ({ name: `chr${index}`, length: 10 }));
    const data = CircosData.normalize({
      chromosomes,
      genes: [{ chromosome: 'chr249', start: 0, end: 1, type: 'CDS' }],
    });
    const plotter = {
      data,
      multiTrackManager: {
        geneTracks: { protein_coding: { enabled: true, name: 'Protein coding', color: '#008800' } },
        groupGenesByType: genes => new Map([['protein_coding', genes]]),
      },
      trackData: {},
      getCurrentTheme: () => ({ chromosomes: ['#222222'], stroke: '#444444' }),
      radius: 250,
      innerRadiusRatio: 0.8,
      chromosomeWidth: 15,
      chromosomeGap: 15,
      startAngle: -90,
      geneHeight: 8,
      showGenes: true,
    };
    const scene = scope.CircosScene.layout(plotter);
    const [chromosomesBand, genesBand] = scene.hitBands;
    const last = chromosomesBand.regions.at(-1);
    expect(chromosomesBand.regions).toHaveLength(250);
    expect(chromosomesBand.regions.every(region => region.endAngle > region.startAngle)).toBe(true);
    expect(genesBand.regions[0].startAngle).toBe(last.startAngle);
    expect(genesBand.regions[0].endAngle).toBeLessThan(last.endAngle);
    expect(scene.paths.every(path => path.d && !/NaN|Infinity/.test(path.d))).toBe(true);
    data.chromosomes.reverse();
    const reordered = scope.CircosScene.layout(plotter);
    expect(reordered.hitBands[0].regions[0].target.chromosome).toBe('chr249');
    expect(reordered.hitBands[1].regions[0].startAngle).toBe(-Math.PI / 2);
  });
});
