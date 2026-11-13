/**
 * NCBI genetic code tables.
 *
 * The single source of codon assignments for translation. Each table is stored
 * in the compact form NCBI publishes in gc.prt: 64 amino acids and 64 start
 * flags, both in TCAG order (TTT, TTC, TTA, TTG, TCT, ...).
 *
 * Table ids are the values of the GenBank /transl_table qualifier.
 */

const GENETIC_CODE_BASES = 'TCAG';

const GENETIC_CODE_DEFINITIONS = [
  [
    1,
    'Standard',
    'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    '---M---------------M---------------M----------------------------',
  ],
  [
    2,
    'Vertebrate Mitochondrial',
    'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNKKSS**VVVVAAAADDEEGGGG',
    '--------------------------------MMMM---------------M------------',
  ],
  [
    3,
    'Yeast Mitochondrial',
    'FFLLSSSSYY**CCWWTTTTPPPPHHQQRRRRIIMMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    '----------------------------------MM---------------M------------',
  ],
  [
    4,
    'Mold, Protozoan and Coelenterate Mitochondrial; Mycoplasma; Spiroplasma',
    'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    '--MM---------------M------------MMMM---------------M------------',
  ],
  [
    5,
    'Invertebrate Mitochondrial',
    'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNKKSSSSVVVVAAAADDEEGGGG',
    '---M----------------------------MMMM---------------M------------',
  ],
  [
    6,
    'Ciliate, Dasycladacean and Hexamita Nuclear',
    'FFLLSSSSYYQQCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    '-----------------------------------M----------------------------',
  ],
  [
    9,
    'Echinoderm and Flatworm Mitochondrial',
    'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNNKSSSSVVVVAAAADDEEGGGG',
    '-----------------------------------M---------------M------------',
  ],
  [
    10,
    'Euplotid Nuclear',
    'FFLLSSSSYY**CCCWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    '-----------------------------------M----------------------------',
  ],
  [
    11,
    'Bacterial, Archaeal and Plant Plastid',
    'FFLLSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    '---M---------------M------------MMMM---------------M------------',
  ],
  [
    12,
    'Alternative Yeast Nuclear',
    'FFLLSSSSYY**CC*WLLLSPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    '-------------------M---------------M----------------------------',
  ],
  [
    13,
    'Ascidian Mitochondrial',
    'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNKKSSGGVVVVAAAADDEEGGGG',
    '---M------------------------------MM---------------M------------',
  ],
  [
    14,
    'Alternative Flatworm Mitochondrial',
    'FFLLSSSSYYY*CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNNKSSSSVVVVAAAADDEEGGGG',
    '-----------------------------------M----------------------------',
  ],
  [
    15,
    'Blepharisma Macronuclear',
    'FFLLSSSSYY*QCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    '-----------------------------------M----------------------------',
  ],
  [
    16,
    'Chlorophycean Mitochondrial',
    'FFLLSSSSYY*LCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    '-----------------------------------M----------------------------',
  ],
  [
    21,
    'Trematode Mitochondrial',
    'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIMMTTTTNNNKSSSSVVVVAAAADDEEGGGG',
    '-----------------------------------M---------------M------------',
  ],
  [
    22,
    'Scenedesmus obliquus Mitochondrial',
    'FFLLSS*SYY*LCC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    '-----------------------------------M----------------------------',
  ],
  [
    23,
    'Thraustochytrium Mitochondrial',
    'FF*LSSSSYY**CC*WLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    '--------------------------------M--M---------------M------------',
  ],
  [
    24,
    'Rhabdopleuridae Mitochondrial',
    'FFLLSSSSYY**CCWWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSSKVVVVAAAADDEEGGGG',
    '---M---------------M---------------M---------------M------------',
  ],
  [
    25,
    'Candidate Division SR1 and Gracilibacteria',
    'FFLLSSSSYY**CCGWLLLLPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    '---M-------------------------------M---------------M------------',
  ],
  [
    26,
    'Pachysolen tannophilus Nuclear',
    'FFLLSSSSYY**CC*WLLLAPPPPHHQQRRRRIIIMTTTTNNKKSSRRVVVVAAAADDEEGGGG',
    '-------------------M---------------M----------------------------',
  ],
];

// Names a caller may use instead of a table id. Keys are normalised the same
// way as the lookup: lower case, runs of non-alphanumerics folded to '_'.
const GENETIC_CODE_ALIASES = {
  standard: 1,
  universal: 1,
  mitochondrial: 2,
  vertebrate_mitochondrial: 2,
  yeast_mitochondrial: 3,
  mold_mitochondrial: 4,
  protozoan_mitochondrial: 4,
  mycoplasma: 4,
  spiroplasma: 4,
  invertebrate_mitochondrial: 5,
  ciliate: 6,
  ciliate_nuclear: 6,
  echinoderm_mitochondrial: 9,
  flatworm_mitochondrial: 9,
  euplotid: 10,
  euplotid_nuclear: 10,
  bacterial: 11,
  bacteria: 11,
  archaeal: 11,
  archaea: 11,
  prokaryotic: 11,
  plant_plastid: 11,
  plastid: 11,
  alternative_yeast: 12,
  alternative_yeast_nuclear: 12,
  ascidian_mitochondrial: 13,
  alternative_flatworm_mitochondrial: 14,
  blepharisma: 15,
  chlorophycean_mitochondrial: 16,
  trematode_mitochondrial: 21,
  scenedesmus_mitochondrial: 22,
  thraustochytrium_mitochondrial: 23,
  rhabdopleuridae_mitochondrial: 24,
  pterobranchia_mitochondrial: 24,
  candidate_division_sr1: 25,
  sr1: 25,
  gracilibacteria: 25,
  pachysolen: 26,
  pachysolen_tannophilus_nuclear: 26,
};

const IUPAC_BASE_EXPANSIONS = {
  A: 'A',
  C: 'C',
  G: 'G',
  T: 'T',
  U: 'T',
  R: 'AG',
  Y: 'CT',
  S: 'CG',
  W: 'AT',
  K: 'GT',
  M: 'AC',
  B: 'CGT',
  D: 'AGT',
  H: 'ACT',
  V: 'ACG',
  N: 'ACGT',
};

class GeneticCodes {
  static _buildTables() {
    const tables = new Map();
    for (const [id, name, aminoAcids, starts] of GENETIC_CODE_DEFINITIONS) {
      const codons = {};
      const startCodons = [];
      const stopCodons = [];
      let index = 0;
      for (const first of GENETIC_CODE_BASES) {
        for (const second of GENETIC_CODE_BASES) {
          for (const third of GENETIC_CODE_BASES) {
            const codon = first + second + third;
            codons[codon] = aminoAcids[index];
            if (aminoAcids[index] === '*') stopCodons.push(codon);
            if (starts[index] === 'M') startCodons.push(codon);
            index++;
          }
        }
      }
      tables.set(
        id,
        Object.freeze({
          id,
          name,
          codons: Object.freeze(codons),
          startCodons: Object.freeze(startCodons),
          stopCodons: Object.freeze(stopCodons),
        })
      );
    }
    return tables;
  }

  static _tables() {
    if (!this._tableCache) this._tableCache = this._buildTables();
    return this._tableCache;
  }

  /**
   * Find a table by NCBI id (11, '11', 'table 11', 'transl_table=11') or by
   * name ('bacterial', 'Vertebrate Mitochondrial').
   *
   * @param {number|string} code - Table id or name; undefined, null and '' mean the standard code
   * @returns {Object|null} Frozen table entry, or null when the code is not known
   */
  static resolve(code) {
    const tables = this._tables();
    if (code === undefined || code === null || code === '') return tables.get(1);
    if (typeof code === 'number') return tables.get(code) || null;

    const key = String(code)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '');
    const numeric = key.match(/^(?:transl_table_|table_|ncbi_)?(\d+)$/);
    if (numeric) return tables.get(Number(numeric[1])) || null;

    const withoutSuffix = key.replace(/_(?:genetic_)?code$/, '');
    const aliased = GENETIC_CODE_ALIASES[key] ?? GENETIC_CODE_ALIASES[withoutSuffix];
    if (aliased) return tables.get(aliased);

    for (const table of tables.values()) {
      if (table.name.toLowerCase().replace(/[^a-z0-9]+/g, '_') === key) return table;
    }
    return null;
  }

  /**
   * Like resolve(), but an unknown code is an error rather than null.
   */
  static require(code) {
    const table = this.resolve(code);
    if (!table) {
      throw new Error(
        `Unknown genetic code "${code}". Use an NCBI translation table id (${this.supportedIds().join(', ')}) ` +
          'or a name such as standard, bacterial, vertebrate_mitochondrial or mycoplasma.'
      );
    }
    return table;
  }

  static supportedIds() {
    return Array.from(this._tables().keys());
  }

  static list() {
    return Array.from(this._tables().values()).map(table => ({
      id: table.id,
      name: table.name,
      startCodons: table.startCodons.slice(),
      stopCodons: table.stopCodons.slice(),
    }));
  }

  /**
   * Codons grouped by the residue they encode, in TCAG order. Stop codons are
   * listed under '*'.
   *
   * @param {Object} table - Entry returned by resolve()
   * @returns {Object} Map of one-letter residue to its codons
   */
  static synonymousCodons(table) {
    const groups = {};
    for (const [codon, residue] of Object.entries(table.codons)) {
      (groups[residue] = groups[residue] || []).push(codon);
    }
    return groups;
  }

  /**
   * The table named by a feature's /transl_table qualifier.
   *
   * @param {Object} feature - Annotation feature
   * @returns {Object|null} Table entry, or null when the feature names none or one that is not known
   */
  static forFeature(feature) {
    const value = feature?.qualifiers?.transl_table;
    const first = Array.isArray(value) ? value[0] : value;
    if (first === undefined || first === null || first === '') return null;
    return this.resolve(String(first));
  }

  /**
   * The table most CDS features of a record are annotated with. Organisms use
   * one genetic code throughout, so this is the code to read unannotated
   * sequence of the same record with.
   *
   * @param {Array} features - Features of one chromosome or record
   * @returns {Object|null} Table entry, or null when no CDS names a known table
   */
  static forAnnotations(features) {
    if (!Array.isArray(features)) return null;
    // Renderers ask on every draw; remember the answer until the list changes size.
    if (!this._annotationCache) this._annotationCache = new WeakMap();
    const cached = this._annotationCache.get(features);
    if (cached && cached.length === features.length) return cached.table;

    const votes = new Map();
    let counted = 0;
    for (const feature of features) {
      if (feature?.type !== 'CDS') continue;
      const table = this.forFeature(feature);
      if (!table) continue;
      votes.set(table, (votes.get(table) || 0) + 1);
      // A few hundred CDS settle the answer; no need to walk a whole genome.
      if (++counted >= 500) break;
    }
    let best = null;
    for (const [table, count] of votes) {
      if (!best || count > votes.get(best)) best = table;
    }
    this._annotationCache.set(features, { length: features.length, table: best });
    return best;
  }

  /**
   * The table to translate a feature with: its own /transl_table, else the
   * one the rest of its record is annotated with, else the standard code.
   *
   * @param {Object|null} feature - Feature being translated, if any
   * @param {Array} [features] - Features of the record the sequence comes from
   * @returns {Object} Table entry
   */
  static forContext(feature, features) {
    return this.forFeature(feature) || this.forAnnotations(features) || this.resolve(1);
  }

  /**
   * Translate one codon. A codon holding IUPAC ambiguity codes is translated
   * when every sequence it stands for encodes the same residue (GCN is Ala);
   * otherwise it is 'X'.
   *
   * @param {string} codon - Three upper-case nucleotides (T or U)
   * @param {Object} table - Entry returned by resolve()
   * @returns {string} One-letter amino acid, '*' for stop, 'X' when undetermined
   */
  static translateCodon(codon, table) {
    const direct = table.codons[codon];
    if (direct) return direct;
    if (codon.length !== 3) return 'X';

    const choices = [];
    for (const base of codon) {
      const expansion = IUPAC_BASE_EXPANSIONS[base];
      if (!expansion) return 'X';
      choices.push(expansion);
    }

    let residue = null;
    for (const first of choices[0]) {
      for (const second of choices[1]) {
        for (const third of choices[2]) {
          const candidate = table.codons[first + second + third];
          if (residue === null) residue = candidate;
          else if (candidate !== residue) return 'X';
        }
      }
    }
    return residue || 'X';
  }

  /**
   * Whether a codon can initiate translation under the table. Ambiguous
   * codons count only when every sequence they stand for is a start codon.
   */
  static isStartCodon(codon, table) {
    const normalised = String(codon).toUpperCase().replace(/U/g, 'T');
    if (table.startCodons.includes(normalised)) return true;
    if (normalised.length !== 3 || /^[ACGT]{3}$/.test(normalised)) return false;

    const choices = [];
    for (const base of normalised) {
      const expansion = IUPAC_BASE_EXPANSIONS[base];
      if (!expansion) return false;
      choices.push(expansion);
    }
    for (const first of choices[0]) {
      for (const second of choices[1]) {
        for (const third of choices[2]) {
          if (!table.startCodons.includes(first + second + third)) return false;
        }
      }
    }
    return true;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = GeneticCodes;
}

if (typeof window !== 'undefined') {
  window.GeneticCodes = GeneticCodes;
}
