/**
 * Circos datasets use zero-based, half-open intervals. Browser annotations
 * use one-based, inclusive coordinates and are converted at the source.
 */
const CircosData = (() => {
  function number(value) {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.trim()) return Number(value);
    return NaN;
  }

  function interval(record, chromosome, oneBased = false) {
    const start = number(record?.start) - Number(oneBased);
    const end = number(record?.end);
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      start >= end ||
      end > (chromosome?.length ?? 0)
    ) {
      return null;
    }
    return { start, end };
  }

  function normalize(input) {
    if (
      input?.coordinateSystem !== undefined &&
      !['0-based-half-open', '1-based-inclusive'].includes(input.coordinateSystem)
    ) {
      throw new Error('Unsupported coordinate system.');
    }
    if (!Array.isArray(input?.chromosomes) || input.chromosomes.length === 0) {
      throw new Error('The dataset must contain at least one chromosome.');
    }

    const names = new Map();
    const chromosomes = input.chromosomes.map((chr, index) => {
      const name = String(chr?.name ?? chr?.id ?? chr?.label ?? '');
      const length = number(chr?.length ?? chr?.size);
      if (!name.trim() || !Number.isSafeInteger(length) || length <= 0) {
        throw new Error(`Chromosome ${index + 1} needs a name and a positive integer length.`);
      }
      const chromosome = {
        name,
        length,
        ...(typeof chr.color === 'string' && /^#[0-9a-f]{6}$/i.test(chr.color) ? { color: chr.color } : {}),
      };
      for (const identifier of new Set([name, chr.id, chr.label].filter(value => typeof value === 'string' && value))) {
        if (names.has(identifier)) throw new Error(`Duplicate chromosome identifier "${identifier}".`);
        names.set(identifier, chromosome);
      }
      return chromosome;
    });

    const oneBased = input.coordinateSystem === '1-based-inclusive';
    const readList = (key, convert) => {
      const list = input[key] ?? [];
      if (!Array.isArray(list)) throw new Error(`"${key}" must be an array.`);
      return list.map((record, index) => {
        const result = convert(record);
        if (!result) throw new Error(`Invalid coordinates or chromosome reference in ${key} row ${index + 1}.`);
        return result;
      });
    };
    const genes = readList('genes', gene => {
      const chromosome = names.get(gene?.chromosome);
      const bounds = interval(gene, chromosome, oneBased);
      if (!bounds) return null;
      const segments = Array.isArray(gene.segments)
        ? gene.segments.map(segment => interval(segment, chromosome, oneBased))
        : [];
      if (segments.some(segment => !segment || segment.start < bounds.start || segment.end > bounds.end)) return null;
      return {
        ...gene,
        ...bounds,
        chromosome: chromosome.name,
        name: String(gene.name || gene.id || gene.type || 'Feature'),
        type: String(gene.type || 'other'),
        description: typeof gene.description === 'string' ? gene.description : '',
        strand: gene.strand === '-' || gene.strand === -1 ? '-' : gene.strand === '+' || gene.strand === 1 ? '+' : '.',
        segments,
      };
    });
    const endpoint = record => {
      const chromosome = names.get(record?.chromosome);
      const start = number(record?.start ?? record?.position) - Number(oneBased);
      // Legacy exports sometimes store link endpoints as points, or give an
      // end that represents width. The anchor is the start in both cases.
      if (!Number.isSafeInteger(start) || start < 0 || start > (chromosome?.length ?? -1)) return null;
      const candidateEnd = number(record.end);
      const end =
        Number.isSafeInteger(candidateEnd) && candidateEnd >= start && candidateEnd <= chromosome.length
          ? candidateEnd
          : start;
      return { chromosome: chromosome.name, start, end };
    };
    const links = readList('links', link => {
      const source = endpoint(link?.source);
      const target = endpoint(link?.target);
      const value = number(link?.value ?? 0.5);
      if (!source || !target || !Number.isFinite(value)) return null;
      return { ...link, source, target, value: Math.max(0, Math.min(1, value)) };
    });

    const tracks = {};
    for (const key of ['gc_content', 'gc_skew', 'wig']) {
      if (input.tracks?.[key] === undefined) continue;
      const list = input.tracks[key];
      if (!Array.isArray(list)) throw new Error(`"${key}" must be an array.`);
      tracks[key] = list.map((point, index) => {
        const chromosome = names.get(point?.chromosome);
        const bounds = interval(point, chromosome, oneBased);
        const value = point?.value === null ? null : number(point?.value);
        const validValue =
          value === null ||
          (Number.isFinite(value) &&
            (key !== 'gc_content' || (value >= 0 && value <= 100)) &&
            (key !== 'gc_skew' || Math.abs(value) <= 1));
        if (!bounds || !validValue) throw new Error(`Invalid ${key} window at row ${index + 1}.`);
        return { chromosome: chromosome.name, ...bounds, value };
      });
    }

    return {
      ...input,
      title: typeof input.title === 'string' ? input.title : undefined,
      coordinateSystem: '0-based-half-open',
      chromosomes,
      genes,
      links,
      tracks,
      metadata: {
        ...input.metadata,
        title: typeof input.metadata?.title === 'string' ? input.metadata.title : undefined,
        wigName: typeof input.metadata?.wigName === 'string' ? input.metadata.wigName : undefined,
        totalChromosomes: chromosomes.length,
        totalGenes: genes.length,
        totalLength: chromosomes.reduce((total, chr) => total + chr.length, 0),
      },
    };
  }

  function fromTable(rows) {
    const lengths = new Map();
    const genes = rows.map(row => {
      const chromosome = row.chromosome?.trim();
      if (!chromosome) throw new Error('Every table row needs a chromosome.');
      lengths.set(chromosome, Math.max(lengths.get(chromosome) ?? 0, number(row.end)));
      return { ...row, chromosome };
    });
    return normalize({
      chromosomes: Array.from(lengths, ([name, length]) => ({ name, length })),
      genes,
    });
  }

  function featureTrack(type) {
    switch (type.toLowerCase()) {
      case 'gene':
      case 'cds':
      case 'mrna':
      case 'orf':
      case 'protein_coding':
        return 'protein_coding';
      case 'ncrna':
      case 'misc_rna':
      case 'snrna':
      case 'snorna':
      case 'tmrna':
      case 'non_coding':
        return 'non_coding';
      case 'trna':
        return 'tRNA';
      case 'rrna':
        return 'rRNA';
      case 'regulatory':
      case 'promoter':
      case 'terminator':
        return 'regulatory';
      case 'pseudogene':
        return 'pseudogene';
      default:
        return 'other';
    }
  }

  function fromGenome(sequences, annotations = {}) {
    const chromosomes = Object.entries(sequences || {})
      .filter(([, sequence]) => typeof sequence === 'string' && sequence.length)
      .map(([name, sequence]) => ({ name, length: sequence.length }));
    if (chromosomes.length === 0) throw new Error('Load a genome in the browser first.');

    const genes = [];
    let invalidFeatures = 0;
    for (const chromosome of chromosomes) {
      const features = Array.isArray(annotations?.[chromosome.name]) ? annotations[chromosome.name] : [];
      const candidates = [];
      const childLoci = new Set();
      const childIntervals = new Set();
      for (const feature of features) {
        const type = String(feature?.type || 'other');
        if (type.toLowerCase() === 'source') continue;
        const range = interval(feature, chromosome, true);
        const segments = (Array.isArray(feature?.segments) ? feature.segments : []).map(segment =>
          interval(segment, chromosome, true)
        );
        if (!range || segments.some(segment => !segment || segment.start < range.start || segment.end > range.end)) {
          invalidFeatures++;
          continue;
        }
        const qualifiers = feature.qualifiers;
        const qualifier = key => (Array.isArray(qualifiers?.[key]) ? qualifiers[key][0] : qualifiers?.[key]);
        const locus = qualifier('locus_tag');
        const name = qualifier('gene') || qualifier('Name') || qualifier('name') || feature.name || locus || feature.id;
        const strand =
          feature.strand === -1 || feature.strand === '-'
            ? '-'
            : feature.strand === 1 || feature.strand === '+'
              ? '+'
              : '.';
        const isGene = type.toLowerCase() === 'gene';
        const rangeKey = `${range.start}:${range.end}:${strand}`;
        const track = qualifier('pseudo') || qualifier('pseudogene') ? 'pseudogene' : featureTrack(type);
        const locusKey = locus ? `${locus}:${strand}` : null;
        if (type.toLowerCase() === 'cds' || ['non_coding', 'tRNA', 'rRNA'].includes(track)) {
          if (locusKey) childLoci.add(locusKey);
          childIntervals.add(rangeKey);
        }
        candidates.push({
          isGene,
          locusKey,
          rangeKey,
          feature: {
            ...range,
            segments,
            chromosome: chromosome.name,
            id: String(locus || feature.id || `${type}:${range.start}-${range.end}`),
            name: String(name || type),
            type,
            track,
            strand,
            description: String(qualifier('product') || qualifier('note') || ''),
          },
        });
      }
      for (const candidate of candidates) {
        if (candidate.isGene && (childLoci.has(candidate.locusKey) || childIntervals.has(candidate.rangeKey))) continue;
        genes.push(candidate.feature);
      }
    }
    return normalize({ chromosomes, genes, metadata: { source: 'Genome browser', invalidFeatures } });
  }

  function trackWindow(length, requested) {
    return Math.max(requested, Math.ceil(length / 16000));
  }

  async function sequenceTracks(sequences, requestedWindow, isCurrent = () => true) {
    const length = Object.values(sequences).reduce((total, sequence) => total + sequence.length, 0);
    const windowSize = trackWindow(length, requestedWindow);
    const content = [];
    const skew = [];
    let basesSinceYield = 0;
    for (const [chromosome, sequence] of Object.entries(sequences)) {
      for (let start = 0; start < sequence.length; start += windowSize) {
        const end = Math.min(sequence.length, start + windowSize);
        let g = 0;
        let c = 0;
        let at = 0;
        for (let index = start; index < end; index++) {
          switch (sequence.charCodeAt(index) | 32) {
            case 103:
              g++;
              break;
            case 99:
              c++;
              break;
            case 97:
            case 116:
              at++;
              break;
          }
        }
        const gc = g + c;
        const called = gc + at;
        content.push({ chromosome, start, end, value: called ? (100 * gc) / called : null });
        skew.push({ chromosome, start, end, value: gc ? (g - c) / gc : null });
        basesSinceYield += end - start;
        if (basesSinceYield >= 2_000_000) {
          await new Promise(resolve => setTimeout(resolve, 0));
          if (!isCurrent()) throw new Error('Genome or track request changed. Reload the current genome.');
          basesSinceYield = 0;
        }
      }
    }
    return { windowSize, gc_content: content, gc_skew: skew };
  }

  function wigTrack(chromosomes, signal) {
    const windowSize = trackWindow(
      chromosomes.reduce((total, chr) => total + chr.length, 0),
      1
    );
    const points = [];
    for (const { name, length } of chromosomes) {
      const data = Object.hasOwn(signal, name) ? signal[name] : [];
      if (!Array.isArray(data)) continue;
      const bins = new Map();
      for (const { start, end, value } of data) {
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || !Number.isFinite(value)) continue;
        let position = Math.max(0, start);
        const stop = Math.min(length, end);
        while (position < stop) {
          const index = Math.floor(position / windowSize);
          const next = Math.min(stop, (index + 1) * windowSize);
          const count = next - position;
          const bin = bins.get(index) || { sum: 0, bases: 0 };
          bin.sum += value * count;
          bin.bases += count;
          bins.set(index, bin);
          position = next;
        }
      }
      for (const [index, bin] of bins) {
        points.push({
          chromosome: name,
          start: index * windowSize,
          end: Math.min(length, (index + 1) * windowSize),
          value: bin.sum / bin.bases,
        });
      }
    }
    return points;
  }

  return { normalize, fromTable, featureTrack, fromGenome, sequenceTracks, wigTrack };
})();

if (typeof module !== 'undefined' && module.exports) module.exports = CircosData;
