import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import path from 'path';

const require = createRequire(import.meta.url);
const ADVANCED_SEARCH_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/AdvancedSearchManager.js');

describe('AdvancedSearchManager protein search', () => {
  let AdvancedSearchManager;

  beforeEach(() => {
    document.body.innerHTML = `
      <select id="chromosomeSelect">
        <option value="chr1" selected>chr1</option>
        <option value="chr2">chr2</option>
      </select>
    `;
    localStorage.clear();
    AdvancedSearchManager = require(ADVANCED_SEARCH_MANAGER_PATH);
  });

  afterEach(() => {
    document.body.innerHTML = '';
    vi.restoreAllMocks();
  });

  function createManager(overrides = {}) {
    const genomeBrowser = {
      currentSequence: {
        chr1: 'ATGAAAACGTAA',
        chr2: 'CGTTTTCAT',
      },
      currentAnnotations: {
        chr1: [
          {
            type: 'CDS',
            start: 1,
            end: 12,
            strand: '+',
            name: 'forwardGene',
            qualifiers: {
              gene: 'forwardGene',
              product: 'Forward protein',
            },
          },
        ],
        chr2: [
          {
            type: 'CDS',
            start: 1,
            end: 9,
            strand: '-',
            name: 'reverseGene',
            qualifiers: {
              gene: 'reverseGene',
              product: 'Reverse protein',
            },
          },
        ],
      },
      getQualifierValue(qualifiers, key) {
        const value = qualifiers?.[key];
        return Array.isArray(value) ? value[0] : value;
      },
      updateStatus: vi.fn(),
      ...overrides,
    };

    return new AdvancedSearchManager(genomeBrowser);
  }

  it('adds a protein search tab to the advanced search modal', () => {
    createManager();

    const proteinTab = document.querySelector('.search-tab[data-tab="protein"]');
    const proteinInput = document.getElementById('proteinSearchInput');

    expect(proteinTab?.textContent).toContain('Protein Search');
    expect(proteinInput?.placeholder).toContain('protein sequence');
  });

  it('finds protein subsequences in translated forward-strand CDS features', () => {
    const manager = createManager();

    const results = manager.searchByProtein('KT');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      type: 'protein',
      chromosome: 'chr1',
      position: 3,
      end: 9,
      proteinStart: 2,
      proteinEnd: 3,
      matchedProteinSequence: 'KT',
    });
  });

  it('maps reverse-strand protein hits back to the matching genomic interval', () => {
    document.getElementById('chromosomeSelect').value = 'chr2';
    const manager = createManager();

    const results = manager.searchByProtein('KT');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      type: 'protein',
      chromosome: 'chr2',
      position: 0,
      end: 6,
      strand: '-',
      proteinStart: 2,
      proteinEnd: 3,
    });
  });

  it('normalizes pasted FASTA protein queries before searching stored translations', () => {
    const manager = createManager({
      currentSequence: { chr1: '' },
      currentAnnotations: {
        chr1: [
          {
            type: 'CDS',
            start: 10,
            end: 36,
            strand: '+',
            qualifiers: {
              gene: 'storedGene',
              product: 'Stored translation protein',
              translation: 'MPEPTIDE',
            },
          },
        ],
      },
    });

    const results = manager.searchByProtein('>query\nPEP TIDE');

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      chromosome: 'chr1',
      position: 12,
      end: 33,
      matchedProteinSequence: 'PEPTIDE',
    });
  });
});
