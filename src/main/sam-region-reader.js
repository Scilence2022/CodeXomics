'use strict';

const fs = require('node:fs');
const { SamRegion, MAX_SAM_LINE_LENGTH } = require('../shared/alignment-depth');

async function readSamRegion(filePath, chromosome, start, end, settings, signal) {
  signal?.throwIfAborted();
  const region = new SamRegion(chromosome, start, end, settings);
  const stream = fs.createReadStream(filePath, { encoding: 'utf8', highWaterMark: 256 * 1024, signal });
  let rest = '';

  for await (const chunk of stream) {
    const lines = (rest + chunk).split('\n');
    rest = lines.pop();
    if (rest.length > MAX_SAM_LINE_LENGTH) throw new Error('SAM record exceeds the supported line length');
    for (const line of lines) region.addLine(line);
  }
  signal?.throwIfAborted();
  if (rest) region.addLine(rest);
  return region.summarize();
}

module.exports = { readSamRegion };
