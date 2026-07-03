import { beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const source = fs.readFileSync(path.join(repoRoot, 'src/renderer/modules/HighlightRegionsUI.js'), 'utf8');
vm.runInThisContext(source, { filename: 'HighlightRegionsUI.js' });
const HighlightRegionsUI = window.HighlightRegionsUI;

function makeGenomeBrowser(selection = {}) {
  return {
    currentPosition: { start: 100, end: 200 },
    currentChromosome: 'chr1',
    highlightManager: {
      listHighlights: () => [],
      palette: ['#f59e0b'],
    },
    ...selection,
  };
}

describe('HighlightRegionsUI selection prefilling', () => {
  beforeEach(() => {
    document.body.innerHTML = '<select id="chromosomeSelect"><option value="chr1">chr1</option></select>';
  });

  it('prefills the selected manual sequence range when opened', () => {
    const ui = new HighlightRegionsUI(
      makeGenomeBrowser({
        currentSequenceSelection: { chromosome: 'chr1', start: 42, end: 17 },
      })
    );

    ui.open();

    expect(document.querySelector('[data-role="hl-start"]').value).toBe('17');
    expect(document.querySelector('[data-role="hl-end"]').value).toBe('42');
  });

  it('converts legacy zero-based manual selections before prefilling', () => {
    const ui = new HighlightRegionsUI(
      makeGenomeBrowser({
        currentSequenceSelection: {
          chromosome: 'chr1',
          start: 0,
          end: 9,
          coordinateSystem: 'zero-based-inclusive',
        },
      })
    );

    ui.open();

    expect(document.querySelector('[data-role="hl-start"]').value).toBe('1');
    expect(document.querySelector('[data-role="hl-end"]').value).toBe('10');
  });

  it('prefills an active gene or ruler selection when opened', () => {
    const ui = new HighlightRegionsUI(
      makeGenomeBrowser({
        sequenceSelection: { active: true, start: '55', end: '89' },
      })
    );

    ui.open();

    expect(document.querySelector('[data-role="hl-start"]').value).toBe('55');
    expect(document.querySelector('[data-role="hl-end"]').value).toBe('89');
  });

  it('falls back to an active selection when the manual selection is invalid', () => {
    const ui = new HighlightRegionsUI(
      makeGenomeBrowser({
        currentSequenceSelection: { start: null, end: null },
        sequenceSelection: { active: true, start: 12, end: 24 },
      })
    );

    ui.open();

    expect(document.querySelector('[data-role="hl-start"]').value).toBe('12');
    expect(document.querySelector('[data-role="hl-end"]').value).toBe('24');
  });

  it('leaves the form empty on open when there is no selection', () => {
    const ui = new HighlightRegionsUI(makeGenomeBrowser());

    ui.open();

    expect(document.querySelector('[data-role="hl-start"]').value).toBe('');
    expect(document.querySelector('[data-role="hl-end"]').value).toBe('');
  });
});
