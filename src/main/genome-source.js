'use strict';

const fs = require('node:fs/promises');
const { createHash } = require('node:crypto');
const { pipeline } = require('node:stream/promises');
const { createGunzip } = require('node:zlib');

const MAX_FILE_BYTES = 500 * 1024 * 1024;
const MAX_GZIP_BYTES = 256 * 1024 * 1024;
const fingerprints = new Map();

function isGenomeSource(filePath) {
  return /\.(?:fa|fasta|gb|gbk|gbff|genbank)(?:\.gz)?$/i.test(filePath);
}

function statVersion(stats) {
  return [stats.dev, stats.ino, stats.size, stats.mtimeNs, stats.ctimeNs].join(':');
}

function genomeSourceChanged() {
  return Object.assign(
    new Error('The genome file contents changed. Reload the genome before using its companion file.'),
    {
      code: 'GENOME_SOURCE_CHANGED',
    }
  );
}

async function readGenomeSource(filePath, { includeText = false, gzip = /\.gz$/i.test(filePath) } = {}) {
  const canonicalPath = await fs.realpath(filePath);
  const key = JSON.stringify([canonicalPath, gzip]);
  const stats = await fs.stat(canonicalPath, { bigint: true });
  if (!stats.isFile() || stats.size > MAX_FILE_BYTES) {
    throw new Error('Genome source must be a regular file no larger than 500 MiB');
  }
  const version = statVersion(stats);
  const cached = fingerprints.get(key);
  if (!includeText && cached?.version === version) return cached;

  const handle = await fs.open(canonicalPath, 'r');
  try {
    if (statVersion(await handle.stat({ bigint: true })) !== version) throw genomeSourceChanged();
    const hash = createHash('sha256');
    const decoder = includeText ? new TextDecoder('utf-8', { ignoreBOM: !gzip }) : null;
    const chunks = [];
    let bytes = 0;
    const readChunks = async stream => {
      for await (const chunk of stream) {
        bytes += chunk.length;
        if (bytes > (gzip ? MAX_GZIP_BYTES : MAX_FILE_BYTES)) {
          throw new Error(gzip ? 'Gzip output exceeds the 256 MiB import limit' : 'Genome source exceeds 500 MiB');
        }
        hash.update(chunk);
        if (decoder) chunks.push(decoder.decode(chunk, { stream: true }));
      }
    };

    const stream = handle.createReadStream({ autoClose: false });
    if (gzip) await pipeline(stream, createGunzip(), readChunks);
    else await readChunks(stream);

    if (
      statVersion(await handle.stat({ bigint: true })) !== version ||
      statVersion(await fs.stat(filePath, { bigint: true })) !== version
    ) {
      throw genomeSourceChanged();
    }
    const identity = { version, sha256: hash.digest('hex'), changedAtMs: Number(stats.ctimeNs) / 1e6 };
    fingerprints.delete(key);
    fingerprints.set(key, identity);
    if (fingerprints.size > 32) fingerprints.delete(fingerprints.keys().next().value);

    if (!decoder) return identity;
    chunks.push(decoder.decode());
    return { ...identity, text: chunks.join('') };
  } finally {
    await handle.close();
  }
}

module.exports = { isGenomeSource, readGenomeSource, genomeSourceChanged };
