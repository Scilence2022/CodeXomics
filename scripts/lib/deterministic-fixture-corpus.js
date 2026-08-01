'use strict';

const crypto = require('crypto');
const PrimerDesigner = require('../../src/renderer/modules/PrimerDesigner.js');
const RestrictionDigestService = require('../../src/renderer/modules/chat/services/RestrictionDigestService.js');

const FIXTURE_RUNNER_ID = 'codexomics-pinned-readonly-fixture-v1';
const CORE_FIXTURE_ID = 'codexomics-synthetic-core-v2';
const UNIPROT_FIXTURE_ID = 'codexomics-uniprot-snapshot-v2';
const SINGLE_SPLIT_QUOTAS = Object.freeze({ train: 8, dev: 1, holdout: 1 });

const CORE_TOOL_NAMES = Object.freeze([
  'get_sequence',
  'find_gene_by_name',
  'list_annotations',
  'get_annotation',
  'get_gene_details',
  'get_nearby_features',
  'reverse_complement',
  'translate_dna',
  'compute_gc',
  'calculate_entropy',
  'calculate_molecular_weight',
  'calculate_primer_properties',
  'find_primer_binding_sites',
  'find_restriction_sites',
  'virtual_digest',
  'list_restriction_enzymes',
  'search_uniprot_database',
  'get_uniprot_entry',
]);

const CODON_TABLE = Object.freeze({
  TTT: 'F', TTC: 'F', TTA: 'L', TTG: 'L', TCT: 'S', TCC: 'S', TCA: 'S', TCG: 'S',
  TAT: 'Y', TAC: 'Y', TAA: '*', TAG: '*', TGT: 'C', TGC: 'C', TGA: '*', TGG: 'W',
  CTT: 'L', CTC: 'L', CTA: 'L', CTG: 'L', CCT: 'P', CCC: 'P', CCA: 'P', CCG: 'P',
  CAT: 'H', CAC: 'H', CAA: 'Q', CAG: 'Q', CGT: 'R', CGC: 'R', CGA: 'R', CGG: 'R',
  ATT: 'I', ATC: 'I', ATA: 'I', ATG: 'M', ACT: 'T', ACC: 'T', ACA: 'T', ACG: 'T',
  AAT: 'N', AAC: 'N', AAA: 'K', AAG: 'K', AGT: 'S', AGC: 'S', AGA: 'R', AGG: 'R',
  GTT: 'V', GTC: 'V', GTA: 'V', GTG: 'V', GCT: 'A', GCC: 'A', GCA: 'A', GCG: 'A',
  GAT: 'D', GAC: 'D', GAA: 'E', GAG: 'E', GGT: 'G', GGC: 'G', GGA: 'G', GGG: 'G',
});

const RESTRICTION_SERVICE = new RestrictionDigestService(null, null);

function clone(value) {
  return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value)
      .sort()
      .map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`)
      .join(',')}}`;
  }
  return JSON.stringify(value);
}

function sha256(value) {
  return crypto.createHash('sha256').update(String(value)).digest('hex');
}

function promptTemplateFingerprint(value) {
  const skeleton = String(value || '')
    .normalize('NFKC')
    .toLowerCase()
    .replace(/\b[acgtn]{10,}\b/g, '<sequence>')
    .replace(/\b(?:px_core_[ab]|fxg\d+|px\d+|pcf\d+|qx\d+a|ann-px-\d+)\b/g, '<fixture_id>')
    .replace(/\b\d+(?:\.\d+)?\b/g, '<number>')
    .replace(/px-\d+/g, '<sample_tag>')
    .replace(/\s+/g, ' ')
    .trim();
  return sha256(skeleton);
}

function deterministicDna(label, length) {
  let output = '';
  let block = 0;
  while (output.length < length) {
    const digest = sha256(`${label}:${block}`);
    for (const nibble of digest) {
      output += 'ACGT'[parseInt(nibble, 16) % 4];
      if (output.length === length) break;
    }
    block += 1;
  }
  return output;
}

function spliceSequence(sequence, startOneBased, replacement) {
  const start = startOneBased - 1;
  return `${sequence.slice(0, start)}${replacement}${sequence.slice(start + replacement.length)}`;
}

function codingSequence(index) {
  const codons = ['GCT', 'GAA', 'TTC', 'CGT', 'AAC', 'GGT', 'CAA', 'TAT', 'AAA', 'CTG', 'ACC', 'GAC'];
  const bodyLength = 4 + (index % 5);
  const body = Array.from({ length: bodyLength }, (_unused, offset) => codons[(index + offset) % codons.length]);
  return `ATG${body.join('')}TAA`;
}

function buildCoreFixture() {
  const contigs = {
    px_core_A: deterministicDna('px-core-contig-a', 18000),
    px_core_B: deterministicDna('px-core-contig-b', 16000),
  };
  const genes = [];
  const annotations = [];
  for (let index = 0; index < 20; index += 1) {
    const chromosome = index % 2 === 0 ? 'px_core_A' : 'px_core_B';
    const start = 401 + Math.floor(index / 2) * 1100 + (index % 2) * 137;
    const sequence = codingSequence(index);
    const end = start + sequence.length - 1;
    const locusTag = `px${String(index + 1).padStart(3, '0')}`;
    const gene = `fxg${String(index + 1).padStart(2, '0')}`;
    contigs[chromosome] = spliceSequence(contigs[chromosome], start, sequence);
    genes.push({
      name: gene,
      locus_tag: locusTag,
      chromosome,
      start,
      end,
      strand: '+',
      product: `pinned metabolic protein ${index + 1}`,
      sequence,
    });
    annotations.push({
      id: `ann-px-${String(index + 1).padStart(3, '0')}`,
      type: index % 5 === 0 ? 'tRNA' : 'CDS',
      start,
      end,
      strand: 1,
      locus_tag: locusTag,
      gene,
      product: index % 5 === 0 ? `pinned transfer RNA ${index + 1}` : `pinned metabolic protein ${index + 1}`,
      chromosome,
    });
  }

  const plantedSites = [
    ['px_core_A', 250, 'GAATTC'],
    ['px_core_A', 3250, 'GGATCC'],
    ['px_core_A', 7250, 'AAGCTT'],
    ['px_core_B', 750, 'CTCGAG'],
    ['px_core_B', 4750, 'CTGCAG'],
    ['px_core_B', 8750, 'GCGGCCGC'],
  ];
  for (const [chromosome, start, motif] of plantedSites) {
    contigs[chromosome] = spliceSequence(contigs[chromosome], start, motif);
  }
  return { contigs, genes, annotations };
}

function buildUniProtFixture() {
  const organisms = ['Synthetic bacterium Alpha', 'Synthetic bacterium Beta', 'Synthetic archaeon Gamma'];
  return {
    entries: Array.from({ length: 20 }, (_unused, index) => {
      const suffix = String(index + 1).padStart(3, '0');
      const sequence = `M${'ACDEFGHIKLMNPQRSTVWY'.slice(index % 10)}${'GAVLIPFYWSTCMNQDEKRH'.slice(0, 8 + (index % 8))}`;
      return {
        accession: `QX${suffix}A`,
        protein_name: `Pinned catalytic family ${suffix}`,
        gene_name: `pcf${suffix}`,
        organism: organisms[index % organisms.length],
        reviewed: index % 3 !== 2,
        protein_sequence: sequence,
      };
    }),
  };
}

const FIXTURES = Object.freeze({
  [CORE_FIXTURE_ID]: buildCoreFixture(),
  [UNIPROT_FIXTURE_ID]: buildUniProtFixture(),
});

function reverseComplement(sequence) {
  const complements = { A: 'T', T: 'A', G: 'C', C: 'G', N: 'N' };
  return String(sequence || '')
    .toUpperCase()
    .split('')
    .reverse()
    .map(base => complements[base] || 'N')
    .join('');
}

function translate(sequence, readingFrame = 1, includeStopCodons = true) {
  const dna = String(sequence || '').toUpperCase();
  let protein = '';
  for (let offset = Math.max(0, Number(readingFrame) - 1); offset + 2 < dna.length; offset += 3) {
    const aminoAcid = CODON_TABLE[dna.slice(offset, offset + 3)] || 'X';
    if (aminoAcid !== '*' || includeStopCodons) protein += aminoAcid;
  }
  return protein;
}

function calculateGc(sequence) {
  const dna = String(sequence || '').toUpperCase();
  const counts = { A: 0, T: 0, C: 0, G: 0, N: 0 };
  for (const base of dna) counts[Object.prototype.hasOwnProperty.call(counts, base) ? base : 'N'] += 1;
  const valid = counts.A + counts.T + counts.C + counts.G;
  return valid === 0 ? 0 : ((counts.G + counts.C) / valid) * 100;
}

function calculateEntropy(sequence) {
  const text = String(sequence || '').toUpperCase();
  const counts = new Map();
  for (const symbol of text) counts.set(symbol, (counts.get(symbol) || 0) + 1);
  let entropy = 0;
  for (const count of counts.values()) {
    const probability = count / text.length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}

function calculateMolecularWeight(sequence, type = 'auto') {
  const clean = String(sequence || '').trim().toUpperCase().replace(/[\s\d-]/g, '');
  const detectedType = type === 'auto' ? (/^[ATGCNU]+$/.test(clean) ? 'dna' : 'protein') : type;
  if (detectedType === 'dna' || detectedType === 'rna') {
    const weights = { A: 331.2, T: 322.2, G: 347.2, C: 307.2, U: 308.2, N: 327.0 };
    return [...clean].reduce((sum, base) => sum + (weights[base] || weights.N), 0) - Math.max(0, clean.length - 1) * 18.01;
  }
  const weights = {
    A: 71.08, R: 156.19, N: 114.1, D: 115.09, C: 103.14, E: 129.12, Q: 128.13,
    G: 57.05, H: 137.14, I: 113.16, L: 113.16, K: 128.17, M: 131.2, F: 147.18,
    P: 97.12, S: 87.08, T: 101.11, W: 186.21, Y: 163.18, V: 99.13, U: 150.03,
    O: 237.3, '*': 0, X: 110,
  };
  return [...clean].reduce((sum, aminoAcid) => sum + (weights[aminoAcid] || weights.X), 0) + 18.02;
}

function getCoreFixture(fixtureId) {
  const fixture = FIXTURES[fixtureId];
  if (!fixture) throw new Error(`Unsupported deterministic fixture: ${fixtureId}`);
  return fixture;
}

function restrictionSites(parameters) {
  const sequence = String(parameters.sequence || '').replace(/\s/g, '').toUpperCase();
  if (!sequence) throw new Error('Pinned restriction replay requires direct sequence input');
  const enzyme = RESTRICTION_SERVICE._resolveEnzyme(parameters.enzyme);
  const regionStart = parameters.start ?? 0;
  const regionEnd = parameters.end || regionStart + sequence.length;
  const chromosome = parameters.chromosome || 'direct_sequence';
  const sites = RESTRICTION_SERVICE._findSitesInSequence(sequence, enzyme, regionStart);
  return {
    enzyme: enzyme.name,
    recognitionSite: enzyme.recognition,
    recognitionLength: enzyme.recognitionLength,
    overhangType: enzyme.overhangType,
    overhangLength: enzyme.overhangLength,
    topCut: enzyme.topCut,
    bottomCut: enzyme.bottomCut,
    chromosome,
    searchRegion: { start: regionStart, end: regionEnd },
    searchRegionStr: `${regionStart}-${regionEnd}`,
    sitesFound: sites.length,
    sites,
  };
}

function virtualDigest(parameters) {
  const sequence = String(parameters.sequence || '').replace(/\s/g, '').toUpperCase();
  if (!sequence) throw new Error('Pinned digest replay requires direct sequence input');
  const regionStart = parameters.start ?? 0;
  const regionEnd = parameters.end || regionStart + sequence.length;
  const chromosome = parameters.chromosome || 'direct_sequence';
  const cutEvents = [];
  const enzymeDetails = {};
  for (const enzymeName of parameters.enzymes || []) {
    const enzyme = RESTRICTION_SERVICE._resolveEnzyme(enzymeName);
    enzymeDetails[enzymeName] = enzyme;
    const sites = RESTRICTION_SERVICE._findSitesInSequence(sequence, enzyme, regionStart);
    for (const site of sites) {
      cutEvents.push({
        position: site.position,
        topStrandCut: site.position + enzyme.topCut,
        bottomStrandCut: site.position + enzyme.bottomCut,
        enzyme: enzymeName,
        strand: site.strand,
        recognitionSite: site.site,
        overhangType: enzyme.overhangType,
        overhangLength: enzyme.overhangLength,
      });
    }
  }
  cutEvents.sort((left, right) => left.topStrandCut - right.topStrandCut);
  const cuts = RESTRICTION_SERVICE._deduplicateCutSites(cutEvents);
  const fragments = RESTRICTION_SERVICE._calculateFragments(cuts, regionStart, regionEnd);
  const stats = RESTRICTION_SERVICE._calculateDigestStats(fragments, regionEnd - regionStart);
  return {
    enzymes: clone(parameters.enzymes),
    enzymeDetails: Object.fromEntries(
      Object.entries(enzymeDetails).map(([name, enzyme]) => [
        name,
        {
          recognition: enzyme.recognition,
          overhangType: enzyme.overhangType,
          overhangLength: enzyme.overhangLength,
        },
      ])
    ),
    chromosome,
    region: { start: regionStart, end: regionEnd },
    totalSites: cuts.length,
    totalFragments: fragments.length,
    averageFragmentSize: stats.average,
    medianFragmentSize: stats.median,
    largestFragment: stats.max,
    smallestFragment: stats.min,
    sizeRange: `${stats.min.toLocaleString()} - ${stats.max.toLocaleString()} bp`,
    fragmentDetails: fragments,
    digestMap: RESTRICTION_SERVICE._generateDigestMap(fragments, cuts),
  };
}

function executeTool(fixtureId, call) {
  const fixture = getCoreFixture(fixtureId);
  const parameters = call.parameters || {};
  switch (call.tool_name) {
    case 'get_sequence': {
      const chromosome = parameters.chromosome || Object.keys(fixture.contigs || {})[0];
      const contig = fixture.contigs?.[chromosome];
      if (!contig) throw new Error(`No pinned contig named ${chromosome}`);
      if (parameters.start < 1 || parameters.end < parameters.start || parameters.end > contig.length) {
        throw new Error(`Pinned sequence coordinates are outside ${chromosome}`);
      }
      const forward = contig.slice(parameters.start - 1, parameters.end);
      const strand = parameters.strand || '+';
      const sequence = strand === '-' ? reverseComplement(forward) : forward;
      return {
        success: true,
        sequence,
        length: sequence.length,
        chromosome,
        start: parameters.start,
        end: parameters.end,
        strand,
        format: parameters.format || 'raw',
      };
    }
    case 'find_gene_by_name': {
      const query = String(parameters.name || '');
      const normalize = value => (parameters.case_sensitive ? String(value) : String(value).toLowerCase());
      const normalizedQuery = normalize(query);
      const genes = (fixture.genes || []).filter(gene => {
        const identifiers = [gene.name, gene.locus_tag].map(normalize);
        return parameters.exact_match
          ? identifiers.includes(normalizedQuery)
          : identifiers.some(identifier => identifier.includes(normalizedQuery));
      });
      return { success: true, genes_found: genes.length, genes: clone(genes) };
    }
    case 'list_annotations': {
      const matches = (fixture.annotations || []).filter(annotation => {
        if (parameters.chromosome && annotation.chromosome !== parameters.chromosome) return false;
        if (parameters.start !== undefined && annotation.end < parameters.start) return false;
        if (parameters.end !== undefined && annotation.start > parameters.end) return false;
        if (parameters.type && annotation.type !== parameters.type) return false;
        return true;
      });
      const offset = Math.max(0, parameters.offset || 0);
      const limit = parameters.limit === 0 ? matches.length : parameters.limit || 100;
      const selected = matches.slice(offset, offset + limit).map(({ chromosome: _chromosome, ...annotation }) => annotation);
      return {
        success: true,
        chromosome: parameters.chromosome || Object.keys(fixture.contigs || {})[0],
        total: matches.length,
        count: selected.length,
        annotations: clone(selected),
      };
    }
    case 'get_annotation': {
      const annotation = (fixture.annotations || []).find(candidate =>
        [candidate.id, candidate.locus_tag, candidate.gene].includes(parameters.identifier) &&
        (!parameters.chromosome || candidate.chromosome === parameters.chromosome)
      );
      if (!annotation) throw new Error(`No pinned annotation for ${parameters.identifier}`);
      const { chromosome, ...details } = annotation;
      return { success: true, identifier: parameters.identifier, chromosome, annotation: clone(details) };
    }
    case 'get_gene_details': {
      const matches = (fixture.genes || []).filter(gene =>
        [gene.name, gene.locus_tag].some(identifier => identifier.toLowerCase() === String(parameters.geneName).toLowerCase()) &&
        (!parameters.chromosome || gene.chromosome === parameters.chromosome)
      );
      return {
        geneName: parameters.geneName,
        chromosome: parameters.chromosome || matches[0]?.chromosome || null,
        found: matches.length > 0,
        count: matches.length,
        genes: clone(matches),
      };
    }
    case 'get_nearby_features': {
      const chromosome = parameters.chromosome || Object.keys(fixture.contigs || {})[0];
      const distance = parameters.distance ?? 5000;
      const types = Array.isArray(parameters.featureTypes) ? parameters.featureTypes : [];
      const features = (fixture.annotations || []).filter(annotation => {
        if (annotation.chromosome !== chromosome) return false;
        if (types.length > 0 && !types.includes(annotation.type)) return false;
        return annotation.end >= parameters.position - distance && annotation.start <= parameters.position + distance;
      });
      return { success: true, chromosome, position: parameters.position, distance, count: features.length, features: clone(features) };
    }
    case 'reverse_complement': {
      const sequence = String(parameters.sequence || '').toUpperCase();
      return {
        success: true,
        original_sequence: sequence,
        reverse_complement: reverseComplement(sequence),
        sequence_length: sequence.length,
        validation_passed: true,
      };
    }
    case 'translate_sequence': {
      const dna = String(parameters.dna || parameters.sequence || '').toUpperCase();
      const readingFrame = parameters.reading_frame || 1;
      return { success: true, dna, reading_frame: readingFrame, amino_acid_sequence: translate(dna, readingFrame) };
    }
    case 'translate_dna': {
      const dna = String(parameters.dna || '').toUpperCase();
      const readingFrame = parameters.reading_frame || 1;
      const includeStops = parameters.include_stop_codons !== false;
      const protein = translate(dna, readingFrame, includeStops);
      return {
        success: true,
        original_sequence: dna,
        amino_acid_sequence: protein,
        reading_frame: readingFrame,
        genetic_code_used: parameters.genetic_code || 'standard',
        sequence_length: dna.length,
        protein_length: protein.length,
      };
    }
    case 'compute_gc': {
      const sequence = String(parameters.sequence || '');
      return { success: true, gcContent: calculateGc(sequence), sequence, length: sequence.length };
    }
    case 'calculate_entropy': {
      const sequence = String(parameters.sequence || '');
      return { success: true, entropy: calculateEntropy(sequence), sequence, length: sequence.length };
    }
    case 'calculate_molecular_weight': {
      const sequence = parameters.sequence || parameters.dna || parameters.protein || '';
      return {
        success: true,
        molecularWeight: calculateMolecularWeight(sequence, parameters.type || 'auto'),
        dna: sequence,
        sequence,
        length: sequence.length,
      };
    }
    case 'calculate_primer_properties':
      return PrimerDesigner.calculateProperties(parameters.sequence);
    case 'find_primer_binding_sites': {
      const primer = parameters.primerSequence || parameters.sequence;
      const sites = PrimerDesigner.findBindingSites(
        primer,
        parameters.templateSequence,
        parameters.maxMismatches ?? 3,
        {
          max3PrimeMismatches: parameters.max3PrimeMismatches,
          minBindingTm: parameters.minBindingTm,
          scoringMode: parameters.scoringMode || 'fast',
          naConcentration: parameters.naConcentration,
          primerConcentration: parameters.primerConcentration,
        }
      ).map(site => {
        const bindingSequence = site.strand === '-'
          ? PrimerDesigner.reverseComplement(site.genomicSequence || site.sequence)
          : site.genomicSequence || site.sequence;
        return {
          ...site,
          bindingSequence,
          mismatches: (site.mismatchDetails || []).map(mismatch => ({
            primerIndex: mismatch.position,
            primerBase: mismatch.primer,
            genomeBase: bindingSequence[mismatch.position],
            posFrom3Prime: mismatch.posFrom3Prime,
            type: mismatch.type,
          })),
        };
      });
      return { queryLength: primer.length, sites };
    }
    case 'find_restriction_sites':
      return restrictionSites(parameters);
    case 'virtual_digest':
      return virtualDigest(parameters);
    case 'list_restriction_enzymes':
      return RESTRICTION_SERVICE.listEnzymes(parameters);
    case 'search_uniprot_database': {
      const query = String(parameters.search_query || '').toLowerCase();
      let entries = (fixture.entries || []).filter(entry => {
        const searchable = `${entry.accession} ${entry.protein_name} ${entry.gene_name} ${entry.organism}`.toLowerCase();
        if (!searchable.includes(query)) return false;
        if (parameters.organism && entry.organism !== parameters.organism) return false;
        if (parameters.reviewed_only && !entry.reviewed) return false;
        if (parameters.length_range?.min && entry.protein_sequence.length < parameters.length_range.min) return false;
        if (parameters.length_range?.max && entry.protein_sequence.length > parameters.length_range.max) return false;
        return true;
      });
      entries = entries.slice(0, parameters.max_results || 100);
      return {
        success: true,
        results_count: entries.length,
        entries: entries.map(entry => ({
          accession: entry.accession,
          protein_name: entry.protein_name,
          gene_name: entry.gene_name,
          organism: entry.organism,
          reviewed: entry.reviewed,
          length: entry.protein_sequence.length,
        })),
      };
    }
    case 'get_uniprot_entry': {
      const entry = (fixture.entries || []).find(candidate =>
        parameters.uniprot_id
          ? candidate.accession === parameters.uniprot_id
          : candidate.gene_name.toLowerCase() === String(parameters.geneName || '').toLowerCase() &&
            (!parameters.organism || candidate.organism === parameters.organism)
      );
      if (!entry) throw new Error('No pinned UniProt entry matched the request');
      return {
        success: true,
        entry_info: {
          accession: entry.accession,
          protein_name: entry.protein_name,
          gene_name: entry.gene_name,
          organism: entry.organism,
          reviewed: entry.reviewed,
        },
        ...(parameters.include_sequence === false
          ? {}
          : { protein_sequence: entry.protein_sequence, sequence_length: entry.protein_sequence.length }),
      };
    }
    default:
      throw new Error(`Tool ${call.tool_name} is not supported by deterministic fixture corpus v2`);
  }
}

function fixtureIdForTool(toolName) {
  return ['search_uniprot_database', 'get_uniprot_entry'].includes(toolName)
    ? UNIPROT_FIXTURE_ID
    : CORE_FIXTURE_ID;
}

function primerForCase(index) {
  return deterministicDna(`fixture-primer-${index}`, 18 + (index % 5));
}

function restrictionSequence(index, enzymes) {
  const motifs = enzymes.map(name => RESTRICTION_SERVICE._resolveEnzyme(name).recognition);
  return `${deterministicDna(`digest-left-${index}`, 17 + index)}${motifs.join(
    deterministicDna(`digest-gap-${index}`, 13 + (index % 4))
  )}${deterministicDna(`digest-right-${index}`, 19 + (index % 6))}`;
}

function buildSingleCall(toolName, index) {
  const core = FIXTURES[CORE_FIXTURE_ID];
  const proteins = FIXTURES[UNIPROT_FIXTURE_ID].entries;
  const gene = core.genes[index % core.genes.length];
  const annotation = core.annotations[index % core.annotations.length];
  const coding = codingSequence(index + 21);
  const dna = deterministicDna(`fixture-analysis-${toolName}-${index}`, 24 + (index % 9));
  const primer = primerForCase(index);
  const enzymes = ['EcoRI', 'BamHI', 'HindIII', 'XhoI', 'PstI', 'NotI'];
  const enzyme = enzymes[index % enzymes.length];
  const protein = proteins[index % proteins.length];
  switch (toolName) {
    case 'get_sequence': {
      const start = 91 + index * 127;
      return { tool_name: toolName, parameters: { chromosome: index % 2 ? 'px_core_B' : 'px_core_A', start, end: start + 23 + (index % 5), strand: index % 3 === 0 ? '-' : '+' } };
    }
    case 'find_gene_by_name':
      return { tool_name: toolName, parameters: { name: gene.name, navigate_to_gene: false } };
    case 'list_annotations':
      return { tool_name: toolName, parameters: { chromosome: annotation.chromosome, start: annotation.start - 31, end: annotation.end + 41, type: annotation.type, limit: 7 } };
    case 'get_annotation':
      return { tool_name: toolName, parameters: { identifier: annotation.locus_tag, full_details: true } };
    case 'get_gene_details':
      return { tool_name: toolName, parameters: { geneName: gene.locus_tag, chromosome: gene.chromosome } };
    case 'get_nearby_features':
      return { tool_name: toolName, parameters: { chromosome: annotation.chromosome, position: annotation.start + 3, distance: 180 + index * 7, featureTypes: [annotation.type] } };
    case 'reverse_complement':
      return { tool_name: toolName, parameters: { sequence: dna } };
    case 'translate_sequence':
      return { tool_name: 'translate_dna', parameters: { dna: coding, reading_frame: 1 } };
    case 'translate_dna':
      return { tool_name: toolName, parameters: { dna: coding, reading_frame: 1, genetic_code: index % 2 ? 'bacterial' : 'standard', include_stop_codons: index % 3 !== 0 } };
    case 'compute_gc':
      return { tool_name: toolName, parameters: { sequence: dna, normalize_case: true } };
    case 'calculate_entropy':
      return { tool_name: toolName, parameters: { sequence: dna } };
    case 'calculate_molecular_weight':
      return index % 2 === 0
        ? { tool_name: toolName, parameters: { sequence: dna, type: 'dna' } }
        : { tool_name: toolName, parameters: { sequence: protein.protein_sequence, type: 'protein' } };
    case 'calculate_primer_properties':
      return { tool_name: toolName, parameters: { sequence: primer } };
    case 'find_primer_binding_sites': {
      const left = deterministicDna(`binding-left-${index}`, 11 + index);
      const template = `${left}${primer}${deterministicDna(`binding-right-${index}`, 15 + (index % 4))}`;
      return { tool_name: toolName, parameters: { sequence: primer, templateSequence: template, maxMismatches: 0, max3PrimeMismatches: 0 } };
    }
    case 'find_restriction_sites':
      return { tool_name: toolName, parameters: { enzyme, sequence: restrictionSequence(index, [enzyme]) } };
    case 'virtual_digest': {
      const pair = [enzyme, enzymes[(index + 2) % enzymes.length]];
      return { tool_name: toolName, parameters: { enzymes: pair, sequence: restrictionSequence(index, pair) } };
    }
    case 'list_restriction_enzymes':
      return { tool_name: toolName, parameters: { query: enzyme, minRecognitionLength: 4, maxRecognitionLength: 10, commercialOnly: true } };
    case 'search_uniprot_database':
      return { tool_name: toolName, parameters: { search_query: protein.gene_name, organism: protein.organism, max_results: 4 } };
    case 'get_uniprot_entry':
      return { tool_name: toolName, parameters: { uniprot_id: protein.accession, include_sequence: true } };
    default:
      throw new Error(`No generated call template for ${toolName}`);
  }
}

function devPromptForCall(call, tag) {
  const parameters = call.parameters;
  const operation = {
    get_sequence: 'read a bounded strand interval from the named synthetic contig',
    find_gene_by_name: 'resolve an exact synthetic locus without changing the visible region',
    list_annotations: 'filter pinned feature records inside a coordinate window',
    get_annotation: 'load the complete record for one pinned locus identifier',
    get_gene_details: 'inspect the read-only details of one synthetic gene',
    get_nearby_features: 'collect typed features around a specified center coordinate',
    reverse_complement: 'derive the opposite-strand representation of the supplied oligo',
    translate_sequence: 'decode the supplied coding fragment in its declared frame',
    translate_dna: 'decode a coding fragment with the declared code-table options',
    compute_gc: 'measure the G/C fraction of the explicit nucleotide sample',
    calculate_entropy: 'measure symbol-level Shannon complexity for the explicit sample',
    calculate_molecular_weight: 'derive molecular mass for the declared polymer type',
    calculate_primer_properties: 'inspect length, composition, melting behavior, and hairpin risk of the oligo',
    find_primer_binding_sites: 'scan the explicit template for exact matches to the supplied primer',
    find_restriction_sites: 'scan explicit DNA for recognition sites of the declared enzyme',
    virtual_digest: 'compute fragment boundaries after the declared enzyme combination',
    list_restriction_enzymes: 'filter the pinned enzyme index by the supplied catalog constraints',
    search_uniprot_database: 'query the frozen protein snapshot with the supplied identity filters',
    get_uniprot_entry: 'load one frozen protein record and include its amino-acid sequence',
  }[call.tool_name];
  return [
    `Validation card ${tag}`,
    `Objective: ${operation}.`,
    `Pinned inputs: ${JSON.stringify(parameters)}.`,
    'Do not substitute values from another genome or external service.',
  ].join('\n');
}

function holdoutPromptForCall(call, tag) {
  const p = call.parameters;
  switch (call.tool_name) {
    case 'get_sequence':
      return `合成样本 ${tag} 中，请读取 ${p.chromosome} 的 ${p.start} 到 ${p.end} 位点，并按 ${p.strand} 链返回序列。`;
    case 'find_gene_by_name':
      return `在只读夹具 ${tag} 里精确查找人工基因 ${p.name}，不要跳转当前视图。`;
    case 'list_annotations':
      return `核对 ${tag}：列出 ${p.chromosome}:${p.start}-${p.end} 内的 ${p.type} 注释，最多 ${p.limit} 条。`;
    case 'get_annotation':
      return `请从 ${p.chromosome} 的固定数据中取回 ${p.identifier} 的完整注释记录（样本 ${tag}）。`;
    case 'get_gene_details':
      return `查询合成染色体 ${p.chromosome} 上位点 ${p.geneName} 的只读基因详情，编号 ${tag}。`;
    case 'get_nearby_features':
      return `以 ${p.chromosome}:${p.position} 为中心，在 ${p.distance} bp 范围内查找 ${p.featureTypes.join('、')} 特征；这是固定样本 ${tag}。`;
    case 'reverse_complement':
      return `为固定寡核苷酸 ${tag} 生成反向互补序列，并校验碱基：${p.sequence}。`;
    case 'translate_sequence':
      return `把合成编码片段 ${tag} 按第 ${p.reading_frame} 阅读框翻译：${p.dna}。`;
    case 'translate_dna':
      return `使用 ${p.genetic_code} 密码表和第 ${p.reading_frame} 阅读框翻译样本 ${tag}：${p.dna}；${p.include_stop_codons ? '保留' : '去掉'}终止符。`;
    case 'compute_gc':
      return `计算固定序列 ${tag} 的 GC 比例，启用大小写归一化：${p.sequence}。`;
    case 'calculate_entropy':
      return `求合成序列 ${tag} 的 Shannon 复杂度：${p.sequence}。`;
    case 'calculate_molecular_weight':
      return `按 ${p.type} 类型计算固定样本 ${tag} 的分子量：${p.sequence}。`;
    case 'calculate_primer_properties':
      return `分析合成实验 ${tag} 的引物长度、GC、Tm 和发卡风险：${p.sequence}。`;
    case 'find_primer_binding_sites':
      return `在显式模板 ${p.templateSequence} 中寻找引物 ${p.sequence} 的完全匹配位点，样本 ${tag} 不允许错配。`;
    case 'find_restriction_sites':
      return `在固定 DNA ${p.sequence} 中定位 ${p.enzyme} 识别位点，检查编号 ${tag}。`;
    case 'virtual_digest':
      return `用 ${p.enzymes.join(' 和 ')} 对合成分子 ${p.sequence} 做虚拟酶切，编号 ${tag}。`;
    case 'list_restriction_enzymes':
      return `从固定酶目录中筛选名称匹配 ${p.query}、识别长度为 ${p.minRecognitionLength}-${p.maxRecognitionLength} 且可商购的条目（${tag}）。`;
    case 'search_uniprot_database':
      return `在冻结的 UniProt 蛋白快照中检索 ${p.organism} 的人工蛋白记录 ${p.search_query}，最多返回 ${p.max_results} 条（${tag}）；这是 UniProt 检索，不是基因组基因查找。`;
    case 'get_uniprot_entry':
      return `取回固定蛋白条目 ${p.uniprot_id} 及其氨基酸序列，核对编号 ${tag}。`;
    default:
      throw new Error(`No holdout prompt for ${call.tool_name}`);
  }
}

function promptForCall(call, index, split = 'train') {
  const parameters = call.parameters;
  const tag = `PX-${String(index + 1).padStart(2, '0')}`;
  if (split === 'dev') return devPromptForCall(call, tag);
  if (split === 'holdout') return holdoutPromptForCall(call, tag);
  switch (call.tool_name) {
    case 'get_sequence':
      return `For pinned synthetic sample ${tag}, return the ${parameters.strand} strand from ${parameters.chromosome} coordinates ${parameters.start} through ${parameters.end}.`;
    case 'find_gene_by_name':
      return `In read-only fixture ${tag}, look up the exact synthetic gene identifier ${parameters.name} without moving the genome view.`;
    case 'list_annotations':
      return `Audit fixture ${tag}: list ${parameters.type} records on ${parameters.chromosome} between ${parameters.start} and ${parameters.end}, capped at ${parameters.limit}.`;
    case 'get_annotation':
      return `Retrieve the complete pinned annotation ${parameters.identifier} from ${parameters.chromosome} for synthetic audit ${tag}.`;
    case 'get_gene_details':
      return `Fetch read-only gene details for synthetic locus ${parameters.geneName} on ${parameters.chromosome} in audit ${tag}.`;
    case 'get_nearby_features':
      return `For synthetic neighborhood audit ${tag}, find ${parameters.featureTypes.join(', ')} features within ${parameters.distance} bp of ${parameters.chromosome}:${parameters.position}.`;
    case 'reverse_complement':
      return `Produce the validated reverse complement for synthetic oligo ${tag}: ${parameters.sequence}.`;
    case 'translate_sequence':
      return `Translate pinned coding fragment ${tag} in reading frame ${parameters.reading_frame}: ${parameters.dna}.`;
    case 'translate_dna':
      return `Using the ${parameters.genetic_code} code, translate synthetic CDS ${tag} in frame ${parameters.reading_frame}${parameters.include_stop_codons ? ' and retain' : ' and omit'} stop symbols: ${parameters.dna}.`;
    case 'compute_gc':
      return `Run the GC quality metric for pinned sequence ${tag}, with case normalization enabled: ${parameters.sequence}.`;
    case 'calculate_entropy':
      return `Measure Shannon sequence complexity for synthetic sample ${tag}: ${parameters.sequence}.`;
    case 'calculate_molecular_weight':
      return `Calculate the ${parameters.type} molecular mass for pinned sample ${tag}: ${parameters.sequence}.`;
    case 'calculate_primer_properties':
      return `Compute primer properties for synthetic assay ${tag} using oligo ${parameters.sequence}.`;
    case 'find_primer_binding_sites':
      return `Search the explicit synthetic template in assay ${tag} for exact sites of primer ${parameters.sequence}, allowing zero mismatches. Template: ${parameters.templateSequence}`;
    case 'find_restriction_sites':
      return `Locate ${parameters.enzyme} sites in the explicit pinned DNA for digest check ${tag}: ${parameters.sequence}.`;
    case 'virtual_digest':
      return `Virtually digest the explicit synthetic molecule for check ${tag} with ${parameters.enzymes.join(' and ')}: ${parameters.sequence}.`;
    case 'list_restriction_enzymes':
      return `From the pinned enzyme catalog for audit ${tag}, list commercial entries matching ${parameters.query} with recognition lengths ${parameters.minRecognitionLength}-${parameters.maxRecognitionLength}.`;
    case 'search_uniprot_database':
      return `Search the pinned UniProt protein snapshot for the synthetic protein record ${parameters.search_query} in ${parameters.organism}, limiting the audit ${tag} to ${parameters.max_results} entries. This is a UniProt lookup, not a genome-gene search.`;
    case 'get_uniprot_entry':
      return `Retrieve pinned protein entry ${parameters.uniprot_id} with its sequence for synthetic audit ${tag}.`;
    default:
      throw new Error(`No generated prompt template for ${call.tool_name}`);
  }
}

function findFamilyId(prefix, desiredSplit, projectSplit) {
  for (let salt = 0; salt < 100000; salt += 1) {
    const familyId = `${prefix}:${salt}`;
    if (projectSplit(familyId) === desiredSplit) return familyId;
  }
  throw new Error(`Could not assign ${prefix} to ${desiredSplit}`);
}

function sourceForCalls({ familyId, userQuery, calls, fixtureId, category, workflowTemplate = null }) {
  const fixtureOutputs = calls.map(call => ({
    tool_name: call.tool_name,
    result: executeTool(fixtureId, call),
    provenance: {
      fixture_id: fixtureId,
      source: 'generated_expected_output',
      generator: 'deterministic-fixture-corpus-v2',
    },
  }));
  return {
    family_id: familyId,
    atomic_source_ids: [familyId],
    user_query: userQuery,
    language: 'en',
    decision: 'call',
    calls,
    category,
    stateful: false,
    statefulness_basis: 'deterministic_readonly_fixture',
    environment: { fixture_id: fixtureId },
    fixture_outputs: fixtureOutputs,
    fixture_replay: { status: 'passed', reason_code: 'passed', runner: FIXTURE_RUNNER_ID },
    terminal_predicates: calls.map(call => ({ type: 'fixture_call_succeeded', tool_name: call.tool_name })),
    provenance: {
      source_type: 'deterministic_fixture_generator_v2',
      source_ref: 'scripts/lib/deterministic-fixture-corpus.js',
      source_index: null,
      license: 'MIT',
      generator_template: workflowTemplate || `single:${calls[0].tool_name}`,
      prompt_template_fingerprint: promptTemplateFingerprint(userQuery),
    },
  };
}

function buildSingleSources(projectSplit) {
  const sources = [];
  for (const toolName of CORE_TOOL_NAMES) {
    let globalIndex = 0;
    for (const [split, quota] of Object.entries(SINGLE_SPLIT_QUOTAS)) {
      for (let ordinal = 0; ordinal < quota; ordinal += 1) {
        const index = CORE_TOOL_NAMES.indexOf(toolName) * 31 + globalIndex;
        const call = buildSingleCall(toolName, index);
        const familyId = findFamilyId(`fixture:v2:single:${toolName}:${split}:${ordinal}`, split, projectSplit);
        sources.push(
          sourceForCalls({
            familyId,
            userQuery: promptForCall(call, index, split),
            calls: [call],
            fixtureId: fixtureIdForTool(toolName),
            category: `fixture_${toolName}`,
            workflowTemplate: `single:${toolName}:${split}-surface-v1`,
          })
        );
        globalIndex += 1;
      }
    }
  }
  return sources;
}

function buildGeneWorkflow(split, ordinal, projectSplit) {
  const fixture = FIXTURES[CORE_FIXTURE_ID];
  const gene = fixture.genes[(ordinal + ['train', 'dev', 'holdout'].indexOf(split) * 5) % fixture.genes.length];
  const first = { tool_name: 'find_gene_by_name', parameters: { name: gene.name, exact_match: true, navigate_to_gene: false } };
  const firstResult = executeTool(CORE_FIXTURE_ID, first);
  const secondResolved = {
    tool_name: 'get_sequence',
    parameters: { chromosome: gene.chromosome, start: gene.start, end: gene.end, strand: gene.strand },
  };
  const secondResult = executeTool(CORE_FIXTURE_ID, secondResolved);
  const thirdResolved = { tool_name: 'translate_dna', parameters: { dna: secondResult.sequence, reading_frame: 1 } };
  const calls = [
    first,
    {
      tool_name: 'get_sequence',
      parameters_template: {
        chromosome: { $from: 'call_1.result.genes.0.chromosome' },
        start: { $from: 'call_1.result.genes.0.start' },
        end: { $from: 'call_1.result.genes.0.end' },
        strand: { $from: 'call_1.result.genes.0.strand' },
      },
      parameters: secondResolved.parameters,
    },
    {
      tool_name: 'translate_dna',
      parameters_template: { dna: { $from: 'call_2.result.sequence' }, reading_frame: 1 },
      parameters: thirdResolved.parameters,
    },
  ];
  const familyId = findFamilyId(`fixture:v2:workflow:gene-cds:${split}:${ordinal}`, split, projectSplit);
  const source = sourceForCalls({
    familyId,
    userQuery:
      split === 'train'
        ? `For pinned locus ${gene.name}, find its coordinates without navigation, retrieve exactly that returned interval, then translate the retrieved DNA in frame 1.`
        : split === 'dev'
          ? `Dependency card GW-${gene.locus_tag}\nResolve ${gene.name} in the frozen genome without moving the view. Feed the returned contig and bounds into a sequence read, then feed that read result into frame-one translation.`
          : `在冻结基因组中只读查找人工位点 ${gene.name}；把检索结果里的染色体和边界用于取序列，再将返回的 DNA 按第一阅读框翻译。`,
    calls: [first, secondResolved, thirdResolved],
    fixtureId: CORE_FIXTURE_ID,
    category: 'fixture_dependent_gene_translation',
    workflowTemplate: `dependent:gene-search-to-sequence-to-translation:${split}-surface-v1`,
  });
  source.calls = calls.map(({ parameters: _resolved, ...call }, index) =>
    index === 0 ? first : call
  );
  source.fixture_outputs = [firstResult, secondResult, executeTool(CORE_FIXTURE_ID, thirdResolved)].map((result, index) => ({
    tool_name: [first, secondResolved, thirdResolved][index].tool_name,
    result,
    provenance: { fixture_id: CORE_FIXTURE_ID, source: 'generated_expected_output', generator: 'deterministic-fixture-corpus-v2' },
  }));
  source.terminal_predicates = [
    { type: 'argument_from_result', call_index: 2, parameter: 'start', source: 'call_1.result.genes.0.start' },
    { type: 'argument_from_result', call_index: 3, parameter: 'dna', source: 'call_2.result.sequence' },
  ];
  return source;
}

function buildAnnotationWorkflow(split, ordinal, projectSplit) {
  const fixture = FIXTURES[CORE_FIXTURE_ID];
  const annotation = fixture.annotations[(ordinal + 7 + ['train', 'dev', 'holdout'].indexOf(split) * 4) % fixture.annotations.length];
  const first = { tool_name: 'list_annotations', parameters: { chromosome: annotation.chromosome, start: annotation.start - 25, end: annotation.end + 25, type: annotation.type, limit: 5 } };
  const firstResult = executeTool(CORE_FIXTURE_ID, first);
  const secondResolved = { tool_name: 'get_annotation', parameters: { identifier: firstResult.annotations[0].locus_tag, chromosome: firstResult.chromosome, full_details: true } };
  const familyId = findFamilyId(`fixture:v2:workflow:annotation-detail:${split}:${ordinal}`, split, projectSplit);
  const source = sourceForCalls({
    familyId,
    userQuery:
      split === 'train'
        ? `Within the pinned interval on ${annotation.chromosome}, list matching ${annotation.type} annotations and then fetch full details for the first locus tag returned.`
        : split === 'dev'
          ? `Dependency card AW-${annotation.id}\nFilter the frozen ${annotation.type} records around ${annotation.start}-${annotation.end} on ${annotation.chromosome}. Use the first returned locus tag, rather than a guessed identifier, for a full-detail lookup.`
          : `先在 ${annotation.chromosome} 的固定区间 ${annotation.start - 25}-${annotation.end + 25} 内列出 ${annotation.type} 注释，再用列表返回的第一个 locus tag 获取完整详情。`,
    calls: [first, secondResolved],
    fixtureId: CORE_FIXTURE_ID,
    category: 'fixture_dependent_annotation_lookup',
    workflowTemplate: `dependent:annotation-list-to-detail:${split}-surface-v1`,
  });
  source.calls = [
    first,
    {
      tool_name: 'get_annotation',
      parameters_template: {
        identifier: { $from: 'call_1.result.annotations.0.locus_tag' },
        chromosome: { $from: 'call_1.result.chromosome' },
        full_details: true,
      },
    },
  ];
  source.terminal_predicates = [
    { type: 'argument_from_result', call_index: 2, parameter: 'identifier', source: 'call_1.result.annotations.0.locus_tag' },
  ];
  return source;
}

function buildProteinWorkflow(split, ordinal, projectSplit) {
  const fixture = FIXTURES[UNIPROT_FIXTURE_ID];
  const entry = fixture.entries[(ordinal + 3 + ['train', 'dev', 'holdout'].indexOf(split) * 4) % fixture.entries.length];
  const first = { tool_name: 'search_uniprot_database', parameters: { search_query: entry.gene_name, organism: entry.organism, max_results: 3 } };
  const firstResult = executeTool(UNIPROT_FIXTURE_ID, first);
  const secondResolved = { tool_name: 'get_uniprot_entry', parameters: { uniprot_id: firstResult.entries[0].accession, include_sequence: true } };
  const secondResult = executeTool(UNIPROT_FIXTURE_ID, secondResolved);
  const thirdResolved = { tool_name: 'calculate_molecular_weight', parameters: { sequence: secondResult.protein_sequence, type: 'protein' } };
  const familyId = findFamilyId(`fixture:v2:workflow:protein-mass:${split}:${ordinal}`, split, projectSplit);
  const source = sourceForCalls({
    familyId,
    userQuery:
      split === 'train'
        ? `Search the pinned UniProt protein snapshot for synthetic protein record ${entry.gene_name}, retrieve the first returned accession with its sequence, and calculate that returned protein sequence's molecular weight. This is a UniProt lookup, not a genome-gene search.`
        : split === 'dev'
          ? `Dependency card PW-${entry.accession}\nQuery the frozen UniProt protein snapshot for ${entry.organism} record ${entry.gene_name}. Resolve the first accession to a sequence-bearing entry, then use that returned amino-acid sequence for a protein-mass calculation. This is a UniProt lookup, not a genome-gene search.`
          : `在冻结的 UniProt 蛋白快照中检索 ${entry.organism} 的人工蛋白记录 ${entry.gene_name}，用首条结果的 accession 获取蛋白序列，然后计算该返回序列的蛋白分子量；这是 UniProt 检索，不是基因组基因查找。`,
    calls: [first, secondResolved, thirdResolved],
    fixtureId: UNIPROT_FIXTURE_ID,
    category: 'fixture_dependent_protein_mass',
    workflowTemplate: `dependent:protein-search-to-entry-to-mass:${split}-surface-v1`,
  });
  source.calls = [
    first,
    {
      tool_name: 'get_uniprot_entry',
      parameters_template: {
        uniprot_id: { $from: 'call_1.result.entries.0.accession' },
        include_sequence: true,
      },
    },
    {
      tool_name: 'calculate_molecular_weight',
      parameters_template: { sequence: { $from: 'call_2.result.protein_sequence' }, type: 'protein' },
    },
  ];
  source.terminal_predicates = [
    { type: 'argument_from_result', call_index: 2, parameter: 'uniprot_id', source: 'call_1.result.entries.0.accession' },
    { type: 'argument_from_result', call_index: 3, parameter: 'sequence', source: 'call_2.result.protein_sequence' },
  ];
  return source;
}

function buildDependentWorkflowSources(projectSplit) {
  const sources = [];
  for (const split of ['train', 'dev', 'holdout']) {
    sources.push(buildGeneWorkflow(split, 0, projectSplit));
    sources.push(buildAnnotationWorkflow(split, 0, projectSplit));
    sources.push(buildProteinWorkflow(split, 0, projectSplit));
  }
  return sources;
}

function buildDeterministicFixtureSources({ projectSplit }) {
  if (typeof projectSplit !== 'function') throw new Error('projectSplit callback is required');
  const sources = [...buildSingleSources(projectSplit), ...buildDependentWorkflowSources(projectSplit)];
  const uniqueMaterial = new Set(
    sources.map(source => `${source.user_query}\n${stableStringify(source.calls)}`)
  );
  if (uniqueMaterial.size !== sources.length) throw new Error('Deterministic fixture generator produced duplicates');
  return sources;
}

function supportsFixture(fixtureId) {
  return Object.prototype.hasOwnProperty.call(FIXTURES, fixtureId);
}

module.exports = {
  CORE_FIXTURE_ID,
  CORE_TOOL_NAMES,
  FIXTURE_RUNNER_ID,
  FIXTURES,
  SINGLE_SPLIT_QUOTAS,
  UNIPROT_FIXTURE_ID,
  buildDeterministicFixtureSources,
  executeTool,
  supportsFixture,
};
