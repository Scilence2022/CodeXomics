// @ts-check
/**
 * RestrictionEnzymeDatabase - Comprehensive restriction enzyme database
 * Contains 80+ commonly used restriction endonucleases with:
 * - Recognition sequences (IUPAC-aware)
 * - Cleavage positions (staggered cut support: 5' overhang, 3' overhang, blunt)
 * - Commercial availability, isoschizomers, and methylation sensitivity
 *
 * Data sourced from REBASE (Roberts et al., Nucleic Acids Research) conventions.
 * Cut positions are 0-indexed relative to the 5' end of the recognition sequence.
 * topCut = cut position on top (sense) strand
 * bottomCut = cut position on bottom (antisense) strand, measured from the 5' end of the BOTTOM strand
 *
 * For a palindromic sequence of length N with top cut at position t:
 *   - bottom cut position = N - t - 1 for blunt end (same position on both strands)
 *   - If topCut < bottomCut: 5' overhang (cohesive end)
 *   - If topCut > bottomCut: 3' overhang (cohesive end)
 *   - If topCut === bottomCut: blunt end
 */
class RestrictionEnzymeDatabase {
  constructor() {
    this._enzymes = new Map();
    this._aliasMap = new Map();
    this._initializeDatabase();
  }

  _addEnzyme(entry) {
    const { name, recognition, topCut, bottomCut, isPalindromic = true, isotype = 'typeII', commercial = true, isoschizomers = [], methylationSensitive = false, microRebase = true, notes = '' } = entry;

    const enzyme = {
      name,
      recognition: recognition.toUpperCase(),
      recognitionLength: recognition.length,
      topCut,
      bottomCut,
      isPalindromic,
      isotype,
      commercial,
      isoschizomers,
      methylationSensitive,
      microRebase,
      notes,
      overhangType: this._determineOverhangType(topCut, bottomCut, recognition.length),
      overhangLength: Math.abs(topCut - (recognition.length - bottomCut - 1)),
    };

    this._enzymes.set(name, enzyme);

    for (const alias of isoschizomers) {
      this._aliasMap.set(alias, name);
    }
  }

  _determineOverhangType(topCut, bottomCut, seqLen) {
    const effectiveBottom = seqLen - bottomCut - 1;
    if (topCut === effectiveBottom) return 'blunt';
    if (topCut < effectiveBottom) return "5'_overhang";
    return "3'_overhang";
  }

  get(name) {
    const lookup = this._aliasMap.get(name) || name;
    return this._enzymes.get(lookup) || null;
  }

  has(name) {
    return this._enzymes.has(name) || this._aliasMap.has(name);
  }

  getAll() {
    return Array.from(this._enzymes.values());
  }

  getNames() {
    return Array.from(this._enzymes.keys());
  }

  getByOverhangType(type) {
    return this.getAll().filter(e => e.overhangType === type);
  }

  getByRecognitionLength(len) {
    return this.getAll().filter(e => e.recognitionLength === len);
  }

  getCommerciallyAvailable() {
    return this.getAll().filter(e => e.commercial);
  }

  search(query) {
    const q = query.toLowerCase();
    return this.getAll().filter(e =>
      e.name.toLowerCase().includes(q) ||
      e.recognition.toLowerCase().includes(q) ||
      e.isoschizomers.some(a => a.toLowerCase().includes(q))
    );
  }

  _initializeDatabase() {
    // === 6-cutter palindromic enzymes (most common for genomic digestion) ===
    this._addEnzyme({ name: 'EcoRI',    recognition: 'GAATTC',  topCut: 1, bottomCut: 4, isoschizomers: ['EcoRI-HF', 'EcoRI-HFv2'], notes: 'Most widely used; 5\' sticky end' });
    this._addEnzyme({ name: 'BamHI',    recognition: 'GGATCC',  topCut: 1, bottomCut: 4, isoschizomers: ['BamHI-HFv2'], notes: 'Common cloning enzyme' });
    this._addEnzyme({ name: 'HindIII',  recognition: 'AAGCTT',  topCut: 1, bottomCut: 4, isoschizomers: ['HindIII-HF'], notes: 'Common cloning enzyme' });
    this._addEnzyme({ name: 'XhoI',     recognition: 'CTCGAG',  topCut: 1, bottomCut: 4, isoschizomers: ['XhoI-v2'], notes: 'Compatible with SalI overhang' });
    this._addEnzyme({ name: 'SalI',     recognition: 'GTCGAC',  topCut: 1, bottomCut: 4, isoschizomers: ['SalI-HF'], notes: 'Compatible with XhoI overhang' });
    this._addEnzyme({ name: 'SpeI',     recognition: 'ACTAGT',  topCut: 1, bottomCut: 4, notes: 'Compatible with XbaI/NheI/AvrII overhang' });
    this._addEnzyme({ name: 'KpnI',     recognition: 'GGTACC',  topCut: 5, bottomCut: 0, notes: '3\' overhang' });
    this._addEnzyme({ name: 'SacI',     recognition: 'GAGCTC',  topCut: 5, bottomCut: 0, isoschizomers: ['SstI'], notes: '3\' overhang' });
    this._addEnzyme({ name: 'PstI',     recognition: 'CTGCAG',  topCut: 5, bottomCut: 0, notes: '3\' overhang' });
    this._addEnzyme({ name: 'SmaI',     recognition: 'CCCGGG',  topCut: 3, bottomCut: 2, isoschizomers: ['XmaI'], notes: 'Blunt end; XmaI is neoschizomer with staggered cut' });
    this._addEnzyme({ name: 'XbaI',     recognition: 'TCTAGA',  topCut: 1, bottomCut: 4, notes: 'Compatible with SpeI/NheI/AvrII overhang' });
    this._addEnzyme({ name: 'NheI',     recognition: 'GCTAGC',  topCut: 1, bottomCut: 4, isoschizomers: ['NheI-HFv2'], notes: 'Compatible with SpeI/XbaI/AvrII overhang' });
    this._addEnzyme({ name: 'AvaI',     recognition: 'CYCGRG',  topCut: 1, bottomCut: 4, notes: 'IUPAC: Y=C/T, R=A/G; degenerate recognition' });
    this._addEnzyme({ name: 'BglII',    recognition: 'AGATCT',  topCut: 1, bottomCut: 4, notes: 'Compatible with BamHI overhang' });
    this._addEnzyme({ name: 'ClaI',     recognition: 'ATCGAT',  topCut: 2, bottomCut: 3, isoschizomers: ['ClaI-v2'], notes: 'Blunt end' });
    this._addEnzyme({ name: 'EcoRV',    recognition: 'GATATC',  topCut: 3, bottomCut: 2, isoschizomers: ['EcoRV-HF'], notes: 'Blunt end; very common for blunt-end cloning' });
    this._addEnzyme({ name: 'HincII',   recognition: 'GTYRAC',  topCut: 3, bottomCut: 2, isoschizomers: ['HindII'], notes: 'IUPAC: Y=C/T, R=A/G; blunt end' });
    this._addEnzyme({ name: 'MluI',     recognition: 'ACGCGT',  topCut: 1, bottomCut: 4, notes: 'CpG methylation sensitive' });
    this._addEnzyme({ name: 'NcoI',     recognition: 'CCATGG',  topCut: 1, bottomCut: 4, notes: 'Start codon-containing site' });
    this._addEnzyme({ name: 'NdeI',     recognition: 'CATATG',  topCut: 2, bottomCut: 3, notes: 'Start codon-containing site; blunt end' });
    this._addEnzyme({ name: 'NruI',     recognition: 'TCGCGA',  topCut: 3, bottomCut: 2, notes: 'Blunt end' });
    this._addEnzyme({ name: 'PvuII',    recognition: 'CAGCTG',  topCut: 3, bottomCut: 2, isoschizomers: ['PvuII-HFv2'], notes: 'Blunt end' });
    this._addEnzyme({ name: 'StuI',     recognition: 'AGGCCT',  topCut: 3, bottomCut: 2, isoschizomers: ['Eco147I'], notes: 'Blunt end' });
    this._addEnzyme({ name: 'ApaI',     recognition: 'GGGCCC',  topCut: 5, bottomCut: 0, notes: '3\' overhang' });
    this._addEnzyme({ name: 'BsiWI',    recognition: 'CGTACG',  topCut: 1, bottomCut: 4, notes: '5\' overhang' });
    this._addEnzyme({ name: 'BssHII',   recognition: 'GCGCGC',  topCut: 1, bottomCut: 4, notes: '5\' overhang' });
    this._addEnzyme({ name: 'BstBI',    recognition: 'TTCGAA',  topCut: 2, bottomCut: 3, notes: 'Blunt end' });
    this._addEnzyme({ name: 'NarI',     recognition: 'GGCGCC',  topCut: 2, bottomCut: 3, notes: 'Blunt end' });
    this._addEnzyme({ name: 'SphI',     recognition: 'GCATGC',  topCut: 5, bottomCut: 0, notes: '3\' overhang' });
    this._addEnzyme({ name: 'ScaI',     recognition: 'AGTACT',  topCut: 3, bottomCut: 2, notes: 'Blunt end' });

    // === 4-cutter enzymes (frequent cutters) ===
    this._addEnzyme({ name: 'AluI',     recognition: 'AGCT',    topCut: 2, bottomCut: 1, notes: 'Blunt end; very frequent cutter' });
    this._addEnzyme({ name: 'HaeIII',   recognition: 'GGCC',    topCut: 2, bottomCut: 1, notes: 'Blunt end; frequent cutter' });
    this._addEnzyme({ name: 'MboI',     recognition: 'GATC',    topCut: 0, bottomCut: 3, isoschizomers: ['Sau3AI', 'NlaII'], notes: '5\' overhang; methylation sensitive (dam)' });
    this._addEnzyme({ name: 'MseI',     recognition: 'TTAA',    topCut: 1, bottomCut: 2, isoschizomers: ['Tsp509I'], notes: 'Blunt end' });
    this._addEnzyme({ name: 'RsaI',     recognition: 'GTAC',    topCut: 2, bottomCut: 1, notes: 'Blunt end' });
    this._addEnzyme({ name: 'TaqI',     recognition: 'TCGA',    topCut: 1, bottomCut: 2, isoschizomers: ['TspRI'], notes: 'Blunt end; thermophilic' });
    this._addEnzyme({ name: 'HpaI',     recognition: 'GTTAAC', topCut: 3, bottomCut: 2, isoschizomers: ['HpaI-v2'], notes: 'Blunt end' });
    this._addEnzyme({ name: 'HinfI',    recognition: 'GANTC',  topCut: 1, bottomCut: 3, notes: 'IUPAC: N=any; 5\' overhang' });
    this._addEnzyme({ name: 'DdeI',     recognition: 'CTNAG',  topCut: 2, bottomCut: 2, notes: 'IUPAC: N=any; 5\' overhang' });

    // === 5-cutter enzymes ===
    this._addEnzyme({ name: 'BsrGI',    recognition: 'TGTACA',  topCut: 1, bottomCut: 4, notes: '5\' overhang' });
    this._addEnzyme({ name: 'AatII',    recognition: 'GACGTC',  topCut: 5, bottomCut: 0, notes: '3\' overhang' });
    this._addEnzyme({ name: 'AgeI',     recognition: 'ACCGGT',  topCut: 1, bottomCut: 4, isoschizomers: ['AgeI-HF'], notes: '5\' overhang' });
    this._addEnzyme({ name: 'BspDI',    recognition: 'ATCGAT',  topCut: 2, bottomCut: 3, isoschizomers: ['ClaI'], notes: 'Blunt end' });
    this._addEnzyme({ name: 'CfrI',     recognition: 'CCGCGG',  topCut: 2, bottomCut: 3, notes: 'Blunt end' });
    this._addEnzyme({ name: 'EcoNI',    recognition: 'CCTNNNAGG', topCut: 3, bottomCut: 5, notes: 'IUPAC: N=any; degenerate 9-bp site' });
    this._addEnzyme({ name: 'FseI',     recognition: 'GGCCGGCC', topCut: 2, bottomCut: 5, notes: '8-cutter; rare cutter; 5\' overhang' });
    this._addEnzyme({ name: 'PacI',     recognition: 'TTAATTAA', topCut: 5, bottomCut: 2, notes: '8-cutter; rare cutter; 5\' overhang' });
    this._addEnzyme({ name: 'PmeI',     recognition: 'GTTTAAAC', topCut: 4, bottomCut: 3, notes: '8-cutter; rare cutter; blunt end' });
    this._addEnzyme({ name: 'SwaI',     recognition: 'ATTTAAAT', topCut: 4, bottomCut: 3, isoschizomers: ['SwaI-v2'], notes: '8-cutter; rare cutter; blunt end' });
    this._addEnzyme({ name: 'AscI',     recognition: 'GGCGCGCC', topCut: 2, bottomCut: 5, notes: '8-cutter; rare cutter; 5\' overhang' });
    this._addEnzyme({ name: 'SfiI',     recognition: 'GGCCNNNNNGGCC', topCut: 2, bottomCut: 9, notes: '13-bp site with 5-bp spacer; IUPAC N=any' });

    // === 8-cutter rare enzymes (for large fragment generation) ===
    this._addEnzyme({ name: 'NotI',     recognition: 'GCGGCCGC', topCut: 2, bottomCut: 5, isoschizomers: ['NotI-HFv2'], notes: '8-cutter; rare cutter; 5\' overhang' });
    this._addEnzyme({ name: 'SbfI',     recognition: 'CCTGCAGG', topCut: 6, bottomCut: 1, isoschizomers: ['SbfI-HF'], notes: '8-cutter; rare cutter; 3\' overhang' });

    // === Additional common enzymes ===
    this._addEnzyme({ name: 'AflIII',   recognition: 'ACRYGT',  topCut: 1, bottomCut: 4, notes: 'IUPAC: R=A/G, Y=C/T' });
    this._addEnzyme({ name: 'BclI',     recognition: 'TGATCA',  topCut: 1, bottomCut: 4, notes: '5\' overhang; compatible with BstBI overhang' });
    this._addEnzyme({ name: 'BmtI',     recognition: 'GCTAGC',  topCut: 1, bottomCut: 4, isoschizomers: ['NheI'], notes: '5\' overhang' });
    this._addEnzyme({ name: 'BsiHKCI',  recognition: 'GTGCAC',  topCut: 1, bottomCut: 4, notes: '5\' overhang' });
    this._addEnzyme({ name: 'BstEII',   recognition: 'GGTNACC', topCut: 1, bottomCut: 5, isoschizomers: ['BstEII-v2'], notes: 'IUPAC: N=any; 7-bp site' });
    this._addEnzyme({ name: 'BstXI',    recognition: 'CCANNNNNTGG', topCut: 3, bottomCut: 6, notes: 'IUPAC: N=any; 11-bp site with 6-bp spacer' });
    this._addEnzyme({ name: 'DraI',     recognition: 'TTTAAA',  topCut: 3, bottomCut: 2, notes: 'Blunt end' });
    this._addEnzyme({ name: 'EaeI',     recognition: 'YGGCCR',  topCut: 1, bottomCut: 4, notes: 'IUPAC: Y=C/T, R=A/G' });
    this._addEnzyme({ name: 'EarI',     recognition: 'CTCTTC',  topCut: 1, bottomCut: 4, isotype: 'typeIIs', notes: 'Type IIS; cuts outside recognition' });
    this._addEnzyme({ name: 'FokI',     recognition: 'GGATG',   topCut: 5, bottomCut: 9, isotype: 'typeIIs', notes: 'Type IIS; cuts 9/13 downstream; 5\' overhang' });
    this._addEnzyme({ name: 'HaeII',    recognition: 'RGCGCY',  topCut: 1, bottomCut: 4, notes: 'IUPAC: R=A/G, Y=C/T' });
    this._addEnzyme({ name: 'HfI',      recognition: 'GANTC',   topCut: 1, bottomCut: 3, isoschizomers: ['HinfI'], notes: 'IUPAC: N=any' });
    this._addEnzyme({ name: 'HpaII',    recognition: 'CCGG',    topCut: 0, bottomCut: 3, isoschizomers: ['MspI'], notes: '5\' overhang; methylation sensitive (CpG)' });
    this._addEnzyme({ name: 'MfeI',     recognition: 'CAATTG',  topCut: 1, bottomCut: 4, isoschizomers: ['MfeI-v2'], notes: '5\' overhang; compatible with EcoRI overhang' });
    this._addEnzyme({ name: 'MluCI',    recognition: 'AATT',    topCut: 1, bottomCut: 2, notes: 'Blunt end' });
    this._addEnzyme({ name: 'PflMI',    recognition: 'CCANNNNNTGG', topCut: 3, bottomCut: 6, isoschizomers: ['BstXI'], notes: 'IUPAC: N=any' });
    this._addEnzyme({ name: 'PvuI',     recognition: 'CGATCG',  topCut: 3, bottomCut: 2, notes: 'Blunt end' });
    this._addEnzyme({ name: 'SatI',     recognition: 'GCGGCCGC', topCut: 2, bottomCut: 5, isoschizomers: ['NotI'], notes: 'Isoschizomer of NotI' });
    this._addEnzyme({ name: 'SnaBI',    recognition: 'TACGTA',  topCut: 3, bottomCut: 2, notes: 'Blunt end' });
    this._addEnzyme({ name: 'SspI',     recognition: 'AATATT',  topCut: 3, bottomCut: 2, notes: 'Blunt end' });
    this._addEnzyme({ name: 'Tth111I',  recognition: 'GACNNNNNGTC', topCut: 2, bottomCut: 7, notes: 'IUPAC: N=any; 11-bp site' });
    this._addEnzyme({ name: 'XmnI',     recognition: 'GAANNNTTC', topCut: 3, bottomCut: 5, notes: 'IUPAC: N=any; 9-bp site' });
    this._addEnzyme({ name: 'ZraI',     recognition: 'GATGAT',  topCut: 3, bottomCut: 2, notes: 'Blunt end' });

    // === NEB High-Fidelity (HF) variants - common aliases ===
    this._addEnzyme({ name: 'EcoRI-HF',   recognition: 'GAATTC',  topCut: 1, bottomCut: 4, commercial: true, notes: 'High-fidelity variant of EcoRI' });
    this._addEnzyme({ name: 'BamHI-HFv2', recognition: 'GGATCC',  topCut: 1, bottomCut: 4, commercial: true, notes: 'High-fidelity variant of BamHI' });
    this._addEnzyme({ name: 'HindIII-HF', recognition: 'AAGCTT',  topCut: 1, bottomCut: 4, commercial: true, notes: 'High-fidelity variant of HindIII' });
    this._addEnzyme({ name: 'NheI-HFv2',  recognition: 'GCTAGC',  topCut: 1, bottomCut: 4, commercial: true, notes: 'High-fidelity variant of NheI' });
    this._addEnzyme({ name: 'XhoI-v2',    recognition: 'CTCGAG',  topCut: 1, bottomCut: 4, commercial: true, notes: 'Improved version of XhoI' });
    this._addEnzyme({ name: 'SalI-HF',    recognition: 'GTCGAC',  topCut: 1, bottomCut: 4, commercial: true, notes: 'High-fidelity variant of SalI' });
    this._addEnzyme({ name: 'PvuII-HFv2', recognition: 'CAGCTG',  topCut: 3, bottomCut: 2, commercial: true, notes: 'High-fidelity variant of PvuII' });
    this._addEnzyme({ name: 'NotI-HFv2',  recognition: 'GCGGCCGC', topCut: 2, bottomCut: 5, commercial: true, notes: 'High-fidelity variant of NotI' });
  }

  getIUPACRegex(pattern) {
    const iupacMap = {
      'A': 'A', 'C': 'C', 'G': 'G', 'T': 'T', 'U': 'T',
      'R': '[AG]', 'Y': '[CT]', 'S': '[GC]', 'W': '[AT]',
      'K': '[GT]', 'M': '[AC]', 'B': '[CGT]', 'D': '[AGT]',
      'H': '[ACT]', 'V': '[ACG]', 'N': '[ACGT]',
    };

    let regexStr = '';
    for (const char of pattern.toUpperCase()) {
      regexStr += iupacMap[char] || char;
    }
    return new RegExp(regexStr, 'g');
  }

  reverseComplementIUPAC(pattern) {
    const complementMap = {
      'A': 'T', 'T': 'A', 'G': 'C', 'C': 'G',
      'R': 'Y', 'Y': 'R', 'S': 'S', 'W': 'W',
      'K': 'M', 'M': 'K', 'B': 'V', 'V': 'B',
      'D': 'H', 'H': 'D', 'N': 'N',
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
