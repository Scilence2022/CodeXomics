'use strict';

class AlignmentDepth {
  constructor(start, end) {
    if (![start, end].every(Number.isSafeInteger) || end <= start) {
      throw new Error('Invalid alignment depth viewport');
    }
    this.start = start;
    this.end = end;
    this.binSize = Math.ceil((end - start) / 1000);
    const bins = Math.ceil((end - start) / this.binSize);
    this.alignedBases = new Float64Array(bins);
    this.wholeBins = new Float64Array(bins);
  }

  static visitReferenceSpans(start, cigar, onAlignedSpan) {
    let position = start;
    for (const [, length, operation] of cigar.matchAll(/(\d+)([MIDNSHP=X])/g)) {
      if (!'MDN=X'.includes(operation)) continue;
      const next = position + Number(length);
      if (onAlignedSpan && 'M=X'.includes(operation)) onAlignedSpan(position, next);
      position = next;
    }
    return position;
  }

  static allowsRecord(flags, mappingQuality, settings) {
    return (
      !(flags & 4) &&
      (settings.showSecondary !== false || !(flags & 256)) &&
      (settings.showSupplementary !== false || !(flags & 2048)) &&
      mappingQuality >= (settings.minMappingQuality || 0)
    );
  }

  addSpan(left, right) {
    const from = Math.max(this.start, left) - this.start;
    const to = Math.min(this.end, right) - this.start;
    if (to <= from) return;
    const first = Math.floor(from / this.binSize);
    const last = Math.floor((to - 1) / this.binSize);
    if (first === last) {
      this.alignedBases[first] += to - from;
      return;
    }
    this.alignedBases[first] += (first + 1) * this.binSize - from;
    this.alignedBases[last] += to - last * this.binSize;
    this.wholeBins[first + 1]++;
    this.wholeBins[last]--;
  }

  addAlignment(start, cigar, sourceStart, sourceEnd, offset) {
    AlignmentDepth.visitReferenceSpans(start, cigar, (left, right) => {
      this.addSpan(Math.max(left, sourceStart) + offset, Math.min(right, sourceEnd) + offset);
    });
  }

  summarize() {
    let whole = 0;
    const alignedBases = Array.from(this.alignedBases, (partial, index) => {
      whole += this.wholeBins[index];
      return partial + whole * this.binSize;
    });
    return { binSize: this.binSize, alignedBases };
  }
}

const MAX_SAM_LINE_LENGTH = 4 * 1024 * 1024;

class SamRegion {
  constructor(chromosome, start, end, settings = {}) {
    if (![start, end].every(Number.isSafeInteger) || start < 0 || end < start) {
      throw new Error('Invalid SAM query range');
    }
    this.chromosome = chromosome;
    this.start = start;
    this.end = end;
    this.settings = settings;
    const viewport = settings.depthViewport;
    this.depth = viewport ? new AlignmentDepth(viewport.start, viewport.end) : null;
    this.offset = viewport?.offset ?? 0;
    if (!Number.isSafeInteger(this.offset)) throw new Error('Invalid SAM viewport offset');
    this.reads = [];
    this.totalReads = 0;
    this.retainedBytes = 0;
  }

  addLine(line) {
    if (line.length > MAX_SAM_LINE_LENGTH) throw new Error('SAM record exceeds the supported line length');
    if (!line || line.startsWith('@')) return;
    const fields = line.trimEnd().split('\t', 11);
    if (fields.length < 11) return;
    const [id, flag, chromosome, pos, mapq, cigar, , , , sequence, quality] = fields;
    if (chromosome === '*' || (!this.settings.ignoreChromosome && chromosome !== this.chromosome)) return;
    const flags = Number(flag);
    const mappingQuality = Number(mapq);
    if (
      !Number.isInteger(flags) ||
      !Number.isInteger(mappingQuality) ||
      !AlignmentDepth.allowsRecord(flags, mappingQuality, this.settings)
    ) {
      return;
    }

    const start = Number(pos) - 1;
    if (!Number.isSafeInteger(start) || start < 0 || start >= this.end || !/^(?:[1-9]\d*[MIDNSHP=X])+$/.test(cigar)) {
      return;
    }
    const end = AlignmentDepth.visitReferenceSpans(start, cigar);
    if (!Number.isSafeInteger(end) || end <= this.start || end <= start) return;

    this.totalReads++;
    this.depth?.addAlignment(start, cigar, this.start, this.end, this.offset);
    const estimatedBytes = 256 + 2 * (id.length + chromosome.length + cigar.length + sequence.length + quality.length);
    if (this.reads.length < 50_000 && this.retainedBytes + estimatedBytes <= 16 * 1024 * 1024) {
      this.retainedBytes += estimatedBytes;
      this.reads.push({
        id,
        chromosome,
        start: start + 1,
        end,
        strand: flags & 16 ? '-' : '+',
        flags,
        mappingQuality,
        cigar,
        sequence: sequence === '*' ? '' : sequence,
        quality: quality === '*' ? '' : quality,
      });
    }
  }

  summarize() {
    return {
      reads: this.reads,
      depth: this.depth?.summarize() || null,
      sourceSamplingInfo:
        this.totalReads > this.reads.length
          ? { totalRecords: this.totalReads, sampledRecords: this.reads.length, truncated: true }
          : null,
    };
  }
}

const alignmentDepth = { AlignmentDepth, SamRegion, MAX_SAM_LINE_LENGTH };

if (typeof module !== 'undefined' && module.exports) {
  module.exports = alignmentDepth;
} else {
  window.alignmentDepth = alignmentDepth;
}
