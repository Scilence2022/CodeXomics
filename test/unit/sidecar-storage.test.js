import { createRequire } from 'module';
import path from 'path';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
  MAX_SIDECAR_FILE_BYTES,
  assertSidecarContentSize,
  assertSidecarValueSize,
  legacyPathHash,
  securePathHash,
  buildFallbackPaths,
  validateFallbackBinding,
  createMigratedSidecarData,
} = require('../../src/main/sidecar-storage');

describe('sidecar fallback storage', () => {
  it('bounds sidecar reads and writes before unbounded JSON processing', () => {
    const shared = { value: 'safe' };
    expect(assertSidecarContentSize('{"safe":true}')).toBeGreaterThan(0);
    expect(assertSidecarValueSize({ safe: true, nested: ['bounded'] })).toBeGreaterThan(0);
    expect(assertSidecarValueSize({ first: shared, second: shared })).toBeGreaterThan(0);
    expect(() => assertSidecarContentSize(MAX_SIDECAR_FILE_BYTES + 1)).toThrow('storage limit');
    expect(() => assertSidecarValueSize({ huge: 'x'.repeat(1025) }, 1024)).toThrow('storage limit');
    expect(assertSidecarValueSize({ nested: { safe: true } }, MAX_SIDECAR_FILE_BYTES, 3)).toBeGreaterThan(0);
    expect(() => assertSidecarValueSize([1, 2, 3], MAX_SIDECAR_FILE_BYTES, 3)).toThrow('3-node JSON limit');
    const circular = {};
    circular.self = circular;
    expect(() => assertSidecarValueSize(circular)).toThrow('circular references');
  });

  it('isolates paths that collide under the legacy 32-bit filename hash', () => {
    const firstPath = '/tmp/Aa.gbk';
    const secondPath = '/tmp/BB.gbk';
    const first = buildFallbackPaths('/tmp/sidecars', firstPath, firstPath);
    const second = buildFallbackPaths('/tmp/sidecars', secondPath, secondPath);

    expect(legacyPathHash(firstPath)).toBe(legacyPathHash(secondPath));
    expect(securePathHash(firstPath)).not.toBe(securePathHash(secondPath));
    expect(first.fallbackPath).not.toBe(second.fallbackPath);
    expect(path.basename(first.legacyFallbackPaths[0])).toBe(path.basename(second.legacyFallbackPaths[0]));
  });

  it('rejects cross-genome fallback bindings and safely binds a verified legacy migration', () => {
    const firstPath = '/tmp/Aa.gbk';
    const secondPath = '/tmp/BB.gbk';
    const firstHash = securePathHash(firstPath);
    const bound = {
      sourceFile: 'Aa.gbk',
      annotationCuration: { schema: 'codexomics.annotation-ledger.v2' },
      _sourceGenomePathSha256: firstHash,
      _originalPath: firstPath,
    };

    expect(
      validateFallbackBinding(bound, {
        safeGenomePath: firstPath,
        sourcePathHash: firstHash,
        isLegacy: true,
      })
    ).toBe(true);
    expect(() =>
      validateFallbackBinding(bound, {
        safeGenomePath: secondPath,
        sourcePathHash: securePathHash(secondPath),
        isLegacy: true,
      })
    ).toThrow('does not match');
    expect(() =>
      validateFallbackBinding(
        { sourceFile: 'Aa.gbk', annotationCuration: { revision: 1 } },
        { safeGenomePath: firstPath, sourcePathHash: firstHash, isLegacy: true }
      )
    ).toThrow('no verifiable genome-path binding');
    expect(() =>
      validateFallbackBinding(
        { sourceFile: 'Aa.gbk', geneNotes: { b0001: 'unbound' } },
        { safeGenomePath: firstPath, sourcePathHash: firstHash, isLegacy: false }
      )
    ).toThrow('fallback sidecar has no verifiable genome-path binding');

    const migrated = createMigratedSidecarData(
      { sourceFile: 'Aa.gbk', _originalPath: firstPath, geneNotes: { b0001: 'reviewed' } },
      firstPath,
      firstHash
    );
    expect(migrated).toMatchObject({
      _sourceGenomePathSha256: firstHash,
      _originalPath: firstPath,
      geneNotes: { b0001: 'reviewed' },
    });
    expect(
      validateFallbackBinding(migrated, {
        safeGenomePath: firstPath,
        sourcePathHash: firstHash,
        isLegacy: false,
      })
    ).toBe(true);
  });
});
