import { describe, expect, it } from 'vitest';
import { mkdtemp, rename, rm, utimes, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { readGenomeSource } from '../../src/main/genome-source.js';

describe('genome source fingerprint', () => {
  it('shares the decoded content identity across plain and recompressed sources', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'codexomics-source-'));
    try {
      const plain = join(directory, 'fixture.fa');
      const compressed = plain + '.gz';
      const text = '>chr1\nACGT\n';
      await writeFile(plain, text);
      await writeFile(compressed, gzipSync(text, { level: 1 }));
      const first = await readGenomeSource(plain, { includeText: true });
      const second = await readGenomeSource(compressed, { includeText: true });
      expect(second).toMatchObject({ sha256: first.sha256, text });
      await writeFile(compressed, gzipSync(text, { level: 9 }));
      expect(await readGenomeSource(compressed)).toMatchObject({ sha256: first.sha256 });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it('invalidates a cached fingerprint when a same-size replacement preserves the modification time', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'codexomics-source-'));
    try {
      const file = join(directory, 'fixture.fa');
      const pending = join(directory, 'pending.fa');
      const time = new Date('2025-01-01T00:00:00Z');
      await writeFile(file, '>chr1\nACGT\n');
      await utimes(file, time, time);
      const original = await readGenomeSource(file);
      await writeFile(pending, '>chr1\nTGCA\n');
      await utimes(pending, time, time);
      await rename(pending, file);
      const changed = await readGenomeSource(file);
      expect(changed.sha256).not.toBe(original.sha256);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
