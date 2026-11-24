/* global restrictionEnzymeCatalog */

// Manufacturer references for entries outside the REBASE snapshot:
// https://www.neb.com/en/tools-and-resources/selection-charts/alphabetized-list-of-recognition-specificities
// https://www.neb.com/tools-and-resources/selection-charts/type-iis-restriction-enzymes
const RESTRICTION_PRODUCT_VARIANTS = {
  'AgeI-HF': 'AgeI',
  'BamHI-HF': 'BamHI',
  'BbsI-HF': 'BbsI',
  'BsaI-HFv2': 'BsaI',
  'BsmBI-v2': 'BsmBI',
  'EcoRI-HF': 'EcoRI',
  'EcoRV-HF': 'EcoRV',
  'HindIII-HF': 'HindIII',
  'NheI-HF': 'NheI',
  'NotI-HF': 'NotI',
  'SalI-HF': 'SalI',
  'SbfI-HF': 'SbfI',
};

const RESTRICTION_LEGACY_ALIASES = {
  'BamHI-HFv2': 'BamHI-HF',
  'BstEII-v2': 'BstEII',
  'ClaI-v2': 'ClaI',
  'EcoRI-HFv2': 'EcoRI-HF',
  'HpaI-v2': 'HpaI',
  'MfeI-v2': 'MfeI',
  'NheI-HFv2': 'NheI-HF',
  'NotI-HFv2': 'NotI-HF',
  'PvuII-HFv2': 'PvuII',
  'SwaI-v2': 'SwaI',
  'XhoI-v2': 'XhoI',
  HfI: 'HinfI',
  NlaII: 'MboI',
  Tsp509I: 'TasI',
};

// Absolute offsets from the beginning of the top-strand motif. Missing
// strand offsets are null so they can never be mistaken for blunt cuts.
const RESTRICTION_NICKASES = [
  ['Nb.BbvCI', 'CCTCAGC', null, 5],
  ['Nb.BsmI', 'GAATGC', null, 5],
  ['Nb.BsrDI', 'GCAATG', null, 6],
  ['Nb.BssSI', 'CACGAG', null, 5],
  ['Nb.BtsI', 'GCAGTG', null, 6],
  ['Nt.AlwI', 'GGATC', 9, null],
  ['Nt.BbvCI', 'CCTCAGC', 2, null],
  ['Nt.BsmAI', 'GTCTC', 6, null],
  ['Nt.BspQI', 'GCTCTTC', 8, null],
  ['Nt.BstNBI', 'GAGTC', 9, null],
  ['Nt.CviPII', 'CCD', 0, null],
  ['WarmStart Nt.BstNBI', 'GAGTC', 9, null],
];

// Single-cut entries cross-checked against NEB's Type IIS selection chart.
const VERIFIED_TYPE_IIS_ENZYMES = new Set([
  'AcuI',
  'AlwI',
  'BbsI',
  'BbvI',
  'BccI',
  'BceAI',
  'BciVI',
  'BcoDI',
  'BfuAI',
  'BmrI',
  'BpmI',
  'BpuEI',
  'BsaI',
  'BseRI',
  'BsgI',
  'BsmAI',
  'BsmBI',
  'BsmFI',
  'BsmI',
  'BspCNI',
  'BspMI',
  'BspQI',
  'BsrDI',
  'BsrI',
  'BtgZI',
  'BtsCI',
  'BtsI',
  'BtsIMutI',
  'EarI',
  'EciI',
  'Esp3I',
  'FauI',
  'FokI',
  'HgaI',
  'HphI',
  'HpyAV',
  'MboII',
  'MlyI',
  'MmeI',
  'MnlI',
  'NmeAIII',
  'PaqCI',
  'PleI',
  'SapI',
  'SfaNI',
]);

/**
 * Offline restriction catalog. All offsets are zero-based boundaries relative
 * to the beginning of the 5′→3′ recognition motif on the top strand.
 */
class RestrictionEnzymeDatabase {
  constructor() {
    const catalog =
      typeof restrictionEnzymeCatalog !== 'undefined'
        ? restrictionEnzymeCatalog
        : require('../../../data/restriction-enzyme-catalog');
    this.supplierNames = catalog.suppliers;
    this._enzymes = new Map();
    this._aliases = new Map();

    for (const [name, recognition, topCut, bottomCut, supplierCodes, rebaseId] of catalog.enzymes) {
      this._addEnzyme({ name, recognition, topCut, bottomCut, supplierCodes, rebaseId });
    }
    for (const [name, parent] of Object.entries(RESTRICTION_PRODUCT_VARIANTS)) {
      const { recognition, topCut, bottomCut, isotype } = this.get(parent);
      this._addEnzyme({ name, recognition, topCut, bottomCut, isotype, supplierCodes: 'N' });
    }
    for (const [name, recognition, topCut, bottomCut] of RESTRICTION_NICKASES) {
      this._addEnzyme({ name, recognition, topCut, bottomCut, supplierCodes: 'N' });
    }
    for (const [alias, name] of Object.entries(RESTRICTION_LEGACY_ALIASES)) {
      const enzyme = this.get(name);
      this._aliases.set(alias.toLowerCase(), enzyme);
      enzyme.aliases.push(alias);
    }

    const groups = new Map();
    for (const enzyme of this._enzymes.values()) {
      const group = groups.get(enzyme.cleavageKey) ?? [];
      group.push(enzyme);
      groups.set(enzyme.cleavageKey, group);
    }
    for (const group of groups.values()) {
      for (const enzyme of group) {
        enzyme.isoschizomers = group.filter(entry => entry !== enzyme).map(entry => entry.name);
      }
    }
  }

  _addEnzyme({ name, recognition, topCut, bottomCut, supplierCodes, rebaseId = null, isotype = null }) {
    const recognitionLength = recognition.length;
    const nicking = topCut === null || bottomCut === null;
    const overhangType = nicking ? 'nick' : this._determineOverhangType(topCut, bottomCut);
    const reverse = this.reverseComplementIUPAC(recognition);
    const reverseTop = bottomCut === null ? null : recognitionLength - bottomCut;
    const reverseBottom = topCut === null ? null : recognitionLength - topCut;
    const forwardKey = [recognition, topCut, bottomCut].join(':');
    const reverseKey = [reverse, reverseTop, reverseBottom].join(':');
    const enzyme = {
      name,
      recognition,
      recognitionLength,
      topCut,
      bottomCut,
      isPalindromic: recognition === reverse,
      isotype: VERIFIED_TYPE_IIS_ENZYMES.has(name) ? 'typeIIs' : isotype,
      commercial: supplierCodes.length > 0,
      supplierCodes,
      suppliers: Array.from(supplierCodes, code => this.supplierNames[code]),
      rebaseId,
      nicking,
      cutsOutsideSite: [topCut, bottomCut].some(cut => cut !== null && (cut < 0 || cut > recognitionLength)),
      overhangType,
      overhangLength: nicking ? null : Math.abs(topCut - bottomCut),
      recognitionKey: recognition < reverse ? recognition : reverse,
      cleavageKey: forwardKey < reverseKey ? forwardKey : reverseKey,
      aliases: [],
      isoschizomers: [],
    };
    this._enzymes.set(name.toLowerCase(), enzyme);
  }

  _determineOverhangType(topCut, bottomCut) {
    if (topCut === bottomCut) return 'blunt';
    return topCut < bottomCut ? "5'_overhang" : "3'_overhang";
  }

  get(name) {
    if (typeof name !== 'string') return null;
    const key = name.trim().toLowerCase();
    return this._enzymes.get(key) ?? this._aliases.get(key) ?? null;
  }

  has(name) {
    return this.get(name) !== null;
  }

  getAll() {
    return Array.from(this._enzymes.values());
  }

  getNames() {
    return this.getAll().map(enzyme => enzyme.name);
  }

  getByOverhangType(type) {
    return this.getAll().filter(enzyme => enzyme.overhangType === type);
  }

  getByRecognitionLength(length) {
    return this.getAll().filter(enzyme => enzyme.recognitionLength === length);
  }

  getCommerciallyAvailable() {
    return this.getAll().filter(enzyme => enzyme.commercial);
  }

  search(query) {
    const text = query.trim().toLowerCase();
    return this.getAll().filter(enzyme =>
      [enzyme.name, enzyme.recognition, ...enzyme.aliases].some(value => value.toLowerCase().includes(text))
    );
  }

  getIUPACRegex(pattern) {
    const iupacMap = {
      A: 'A',
      C: 'C',
      G: 'G',
      T: 'T',
      U: 'T',
      R: '[AG]',
      Y: '[CT]',
      S: '[GC]',
      W: '[AT]',
      K: '[GT]',
      M: '[AC]',
      B: '[CGT]',
      D: '[AGT]',
      H: '[ACT]',
      V: '[ACG]',
      N: '[ACGT]',
    };

    let regexStr = '';
    for (const char of pattern.toUpperCase()) {
      regexStr += iupacMap[char] || char;
    }
    return new RegExp(regexStr, 'g');
  }

  reverseComplementIUPAC(pattern) {
    const complementMap = {
      A: 'T',
      T: 'A',
      G: 'C',
      C: 'G',
      R: 'Y',
      Y: 'R',
      S: 'S',
      W: 'W',
      K: 'M',
      M: 'K',
      B: 'V',
      V: 'B',
      D: 'H',
      H: 'D',
      N: 'N',
    };
    return pattern
      .toUpperCase()
      .split('')
      .reverse()
      .map(c => complementMap[c] || c)
      .join('');
  }
}

if (typeof window !== 'undefined') {
  window.RestrictionEnzymeDatabase = RestrictionEnzymeDatabase;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RestrictionEnzymeDatabase;
}
