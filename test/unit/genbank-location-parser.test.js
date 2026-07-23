import { describe, expect, it } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const FileManager = require('../../src/renderer/modules/FileManager.js');

describe('FileManager GenBank compound locations', () => {
  const manager = new FileManager({});

  it('preserves the complete span and segments of a joined CDS', () => {
    const feature = { strand: 1 };

    manager.parseGenBankLocation(feature, 'join(3768892..3768975,3768975..3769256)');

    expect(feature).toMatchObject({
      start: 3768892,
      end: 3769256,
      strand: 1,
      segments: [
        { start: 3768892, end: 3768975 },
        { start: 3768975, end: 3769256 },
      ],
    });
  });

  it('preserves the complete span and reverse strand of complement(join(...))', () => {
    const feature = { strand: 1 };

    manager.parseGenBankLocation(feature, 'complement(join(<100..150,200..>275))');

    expect(feature).toMatchObject({
      start: 100,
      end: 275,
      strand: -1,
      segments: [
        { start: 100, end: 150 },
        { start: 200, end: 275 },
      ],
    });
  });

  it('ignores digits in remote accession prefixes', () => {
    const feature = { strand: 1 };

    manager.parseGenBankLocation(feature, 'J00194.1:100..200');

    expect(feature).toMatchObject({ start: 100, end: 200, strand: 1 });
  });
});
