// @ts-check
/**
 * RestrictionDigestService - Core restriction enzyme analysis service
 * Extracted from ChatManager.js with major enhancements:
 * - Full enzyme database (80+ enzymes) via RestrictionEnzymeDatabase
 * - Staggered cut support (5' overhang, 3' overhang, blunt end)
 * - IUPAC ambiguity code matching
 * - Proper fragment calculation accounting for cut offsets
 * - Multi-enzyme digest with overlapping site detection
 * - Fragment end-type characterization
 */
class RestrictionDigestService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
    this._enzymeDb = null;
  }

  get enzymeDb() {
    if (!this._enzymeDb) {
      const DbClass =
        typeof window !== 'undefined' && window.RestrictionEnzymeDatabase
          ? window.RestrictionEnzymeDatabase
          : typeof require !== 'undefined'
            ? require('./RestrictionEnzymeDatabase')
            : null;
      if (DbClass) {
        this._enzymeDb = new DbClass();
      }
    }
    return this._enzymeDb;
  }

  async findRestrictionSites(params) {
    const { enzyme, chromosome, start, end, sequence } = params;

    let seq = sequence;
    let chr = chromosome;
    let regionStart = start;
    let regionEnd = end;

    const hasExplicitCoords = !!(
      chromosome &&
      chromosome !== 'direct_sequence' &&
      (start !== undefined || end !== undefined)
    );
    const useCoords = hasExplicitCoords || sequence === undefined || sequence === null;

    if (useCoords) {
      chr = chromosome || this.app.currentChromosome;
      if (!chr) {
        throw new Error('No chromosome specified and none currently selected');
      }

      regionStart = start || this.app.currentPosition?.start || 0;
      regionEnd = end || this.app.currentPosition?.end || this.app.currentSequence?.[chr]?.length || 0;

      seq = await this.app.getSequenceForRegion(chr, regionStart, regionEnd);
      if (!seq || seq.length === 0) {
        throw new Error(`No sequence available for ${chr}:${regionStart}-${regionEnd}`);
      }
    } else {
      seq = seq.replace(/\s/g, '').toUpperCase();
      if (!chr) {
        chr = 'direct_sequence';
      }
      if (regionStart === undefined || regionStart === null) {
        regionStart = 0;
      }
      if (!regionEnd) {
        regionEnd = regionStart + seq.length;
      }
    }

    const enzymeData = this._resolveEnzyme(enzyme);
    const sites = this._findSitesInSequence(seq, enzymeData, regionStart);

    return {
      enzyme: enzymeData.name,
      recognitionSite: enzymeData.recognition,
      recognitionLength: enzymeData.recognitionLength,
      overhangType: enzymeData.overhangType,
      overhangLength: enzymeData.overhangLength,
      topCut: enzymeData.topCut,
      bottomCut: enzymeData.bottomCut,
      chromosome: chr,
      searchRegion: { start: regionStart, end: regionEnd },
      searchRegionStr: `${regionStart}-${regionEnd}`,
      sitesFound: sites.length,
      sites,
    };
  }

  async virtualDigest(params) {
    const { enzymes, chromosome, start, end, sequence } = params;

    let seq = sequence;
    let chr = chromosome;
    const regionStart = start ?? 0;
    let regionEnd = end;

    const hasExplicitCoords = !!(
      chromosome &&
      chromosome !== 'direct_sequence' &&
      (start !== undefined || end !== undefined)
    );
    const useCoords = hasExplicitCoords || sequence === undefined || sequence === null;

    if (useCoords) {
      chr = chromosome || this.app.currentChromosome;
      if (!chr) {
        throw new Error('No chromosome specified and none currently selected');
      }
      regionEnd = end || this.app.currentSequence?.[chr]?.length || 0;
      seq = undefined;
    } else {
      seq = seq.replace(/\s/g, '').toUpperCase();
      if (!chr) {
        chr = 'direct_sequence';
      }
      if (!regionEnd) {
        regionEnd = regionStart + seq.length;
      }
    }

    const sequenceLength = regionEnd - regionStart;

    if (sequenceLength <= 0) {
      throw new Error(`Invalid region: ${chr}:${regionStart}-${regionEnd}`);
    }

    const allCutEvents = [];
    const enzymeDetails = {};

    for (const enzymeName of enzymes) {
      const enzymeData = this._resolveEnzyme(enzymeName);
      enzymeDetails[enzymeName] = enzymeData;

      const result = await this.findRestrictionSites({
        enzyme: enzymeName,
        chromosome: chr,
        start: regionStart,
        end: regionEnd,
        sequence: seq,
      });

      for (const site of result.sites) {
        allCutEvents.push({
          position: site.position,
          topStrandCut: site.position + enzymeData.topCut,
          bottomStrandCut: site.position + enzymeData.bottomCut,
          enzyme: enzymeName,
          strand: site.strand,
          recognitionSite: site.site,
          overhangType: enzymeData.overhangType,
          overhangLength: enzymeData.overhangLength,
        });
      }
    }

    allCutEvents.sort((a, b) => a.topStrandCut - b.topStrandCut);

    const deduplicatedCuts = this._deduplicateCutSites(allCutEvents);

    const fragments = this._calculateFragments(deduplicatedCuts, regionStart, regionEnd);

    const stats = this._calculateDigestStats(fragments, sequenceLength);

    return {
      enzymes,
      enzymeDetails: Object.fromEntries(
        Object.entries(enzymeDetails).map(([name, data]) => [
          name,
          {
            recognition: data.recognition,
            overhangType: data.overhangType,
            overhangLength: data.overhangLength,
          },
        ])
      ),
      chromosome: chr,
      region: { start: regionStart, end: regionEnd },
      totalSites: deduplicatedCuts.length,
      totalFragments: fragments.length,
      averageFragmentSize: stats.average,
      medianFragmentSize: stats.median,
      largestFragment: stats.max,
      smallestFragment: stats.min,
      sizeRange: `${stats.min.toLocaleString()} - ${stats.max.toLocaleString()} bp`,
      fragmentDetails: fragments,
      digestMap: this._generateDigestMap(fragments, deduplicatedCuts),
    };
  }

  listEnzymes(params = {}) {
    if (!this.enzymeDb) {
      return { enzymes: [], total: 0, error: 'Enzyme database not available' };
    }

    const { query, minRecognitionLength, maxRecognitionLength, overhangType, commercialOnly = true } = params;

    let results = commercialOnly ? this.enzymeDb.getCommerciallyAvailable() : this.enzymeDb.getAll();

    if (query) {
      results = this.enzymeDb.search(query);
    }

    if (minRecognitionLength) {
      results = results.filter(e => e.recognitionLength >= minRecognitionLength);
    }
    if (maxRecognitionLength) {
      results = results.filter(e => e.recognitionLength <= maxRecognitionLength);
    }
    if (overhangType) {
      results = results.filter(e => e.overhangType === overhangType);
    }

    return {
      enzymes: results.map(e => ({
        name: e.name,
        recognition: e.recognition,
        recognitionLength: e.recognitionLength,
        overhangType: e.overhangType,
        overhangLength: e.overhangLength,
        topCut: e.topCut,
        bottomCut: e.bottomCut,
        commercial: e.commercial,
        isoschizomers: e.isoschizomers,
      })),
      total: results.length,
    };
  }

  _resolveEnzyme(name) {
    if (this.enzymeDb) {
      const enzyme = this.enzymeDb.get(name);
      if (enzyme) return enzyme;
    }

    const fallback = {
      EcoRI: 'GAATTC',
      BamHI: 'GGATCC',
      HindIII: 'AAGCTT',
      XhoI: 'CTCGAG',
      SalI: 'GTCGAC',
      SpeI: 'ACTAGT',
      NotI: 'GCGGCCGC',
      KpnI: 'GGTACC',
      SacI: 'GAGCTC',
      PstI: 'CTGCAG',
    };

    const recognition = fallback[name];
    if (!recognition) {
      const available = this.enzymeDb ? this.enzymeDb.getNames().sort().join(', ') : Object.keys(fallback).join(', ');
      throw new Error(
        `Unknown restriction enzyme: ${name}. Available enzymes: ${available}. ` +
          `Use list_restriction_enzymes to browse the full database.`
      );
    }

    return {
      name,
      recognition,
      recognitionLength: recognition.length,
      topCut: 1,
      bottomCut: recognition.length - 1,
      isPalindromic: true,
      overhangType: "5'_overhang",
      overhangLength: recognition.length - 2,
      commercial: true,
      isoschizomers: [],
    };
  }

  _findSitesInSequence(sequence, enzymeData, offset) {
    const sites = [];
    const recognition = enzymeData.recognition;
    const hasIUPAC = /[^ACGT]/.test(recognition.toUpperCase());

    if (hasIUPAC && this.enzymeDb) {
      const regex = this.enzymeDb.getIUPACRegex(recognition);
      let match;
      const upperSeq = sequence.toUpperCase();
      while ((match = regex.exec(upperSeq)) !== null) {
        sites.push({
          position: offset + match.index,
          site: match[0],
          strand: '+',
          topStrandCut: offset + match.index + enzymeData.topCut,
          bottomStrandCut: offset + match.index + enzymeData.bottomCut,
        });
      }

      const rcRecognition = this.enzymeDb.reverseComplementIUPAC(recognition);
      if (rcRecognition !== recognition.toUpperCase()) {
        const rcRegex = this.enzymeDb.getIUPACRegex(rcRecognition);
        regex.lastIndex = 0;
        while ((match = rcRegex.exec(upperSeq)) !== null) {
          sites.push({
            position: offset + match.index,
            site: match[0],
            strand: '-',
            topStrandCut: offset + match.index + enzymeData.topCut,
            bottomStrandCut: offset + match.index + enzymeData.recognitionLength - enzymeData.bottomCut - 1,
          });
        }
      }
    } else {
      const upperSeq = sequence.toUpperCase();
      const upperRecognition = recognition.toUpperCase();
      const siteLength = upperRecognition.length;

      for (let i = 0; i <= upperSeq.length - siteLength; i++) {
        const subsequence = upperSeq.substring(i, i + siteLength);
        if (subsequence === upperRecognition) {
          sites.push({
            position: offset + i,
            site: subsequence,
            strand: '+',
            topStrandCut: offset + i + enzymeData.topCut,
            bottomStrandCut: offset + i + enzymeData.recognitionLength - enzymeData.bottomCut - 1,
          });
        }
      }

      const reverseComplement = this._reverseComplement(upperRecognition);
      if (reverseComplement !== upperRecognition) {
        for (let i = 0; i <= upperSeq.length - siteLength; i++) {
          const subsequence = upperSeq.substring(i, i + siteLength);
          if (subsequence === reverseComplement) {
            sites.push({
              position: offset + i,
              site: subsequence,
              strand: '-',
              topStrandCut: offset + i + enzymeData.topCut,
              bottomStrandCut: offset + i + enzymeData.recognitionLength - enzymeData.bottomCut - 1,
            });
          }
        }
      }
    }

    return sites.sort((a, b) => a.position - b.position);
  }

  _reverseComplement(seq) {
    const complement = { A: 'T', T: 'A', G: 'C', C: 'G' };
    return seq
      .split('')
      .reverse()
      .map(b => complement[b] || b)
      .join('');
  }

  _deduplicateCutSites(cutEvents) {
    if (cutEvents.length <= 1) return cutEvents;

    const deduped = [cutEvents[0]];
    for (let i = 1; i < cutEvents.length; i++) {
      const curr = cutEvents[i];
      const prev = deduped[deduped.length - 1];
      if (Math.abs(curr.topStrandCut - prev.topStrandCut) < 2) {
        if (!prev.enzymes) {
          prev.enzymes = [prev.enzyme];
          prev.isOverlapping = true;
        }
        prev.enzymes.push(curr.enzyme);
      } else {
        deduped.push(curr);
      }
    }
    return deduped;
  }

  _calculateFragments(cutEvents, regionStart, regionEnd) {
    const fragments = [];
    let lastEnd = regionStart;

    for (const cut of cutEvents) {
      const minCut = Math.min(cut.topStrandCut, cut.bottomStrandCut);
      if (minCut > lastEnd) {
        const fragmentLength = minCut - lastEnd;
        fragments.push({
          index: fragments.length + 1,
          start: lastEnd,
          end: minCut,
          length: fragmentLength,
          leftEndType:
            lastEnd === regionStart
              ? 'origin'
              : cutEvents.find(c => c.topStrandCut === lastEnd || c.bottomStrandCut === lastEnd)?.overhangType ||
                'blunt',
          rightEndType: cut.overhangType,
          rightOverhangLength: cut.overhangLength,
          cutByRight: cut.enzymes || cut.enzyme,
        });
      }
      lastEnd = Math.max(cut.topStrandCut, cut.bottomStrandCut);
    }

    if (lastEnd < regionEnd) {
      fragments.push({
        index: fragments.length + 1,
        start: lastEnd,
        end: regionEnd,
        length: regionEnd - lastEnd,
        leftEndType: cutEvents.length > 0 ? cutEvents[cutEvents.length - 1].overhangType : 'origin',
        rightEndType: 'terminal',
        rightOverhangLength: 0,
        cutByRight: 'terminal',
      });
    }

    return fragments;
  }

  _calculateDigestStats(fragments, totalLength) {
    if (fragments.length === 0) {
      return { average: 0, median: 0, min: 0, max: 0 };
    }

    const sizes = fragments.map(f => f.length).sort((a, b) => a - b);
    const sum = sizes.reduce((a, b) => a + b, 0);
    const mid = Math.floor(sizes.length / 2);
    const median = sizes.length % 2 !== 0 ? sizes[mid] : Math.round((sizes[mid - 1] + sizes[mid]) / 2);

    return {
      average: Math.round(sum / sizes.length),
      median,
      min: sizes[0],
      max: sizes[sizes.length - 1],
    };
  }

  _generateDigestMap(fragments, cutEvents) {
    const lanes = [];
    for (const cut of cutEvents) {
      const enzymeName = cut.enzymes ? cut.enzymes.join('+') : cut.enzyme;
      if (!lanes.find(l => l.enzyme === enzymeName)) {
        lanes.push({ enzyme: enzymeName, position: cut.position });
      }
    }

    return {
      totalFragments: fragments.length,
      cutPositions: cutEvents.map(c => ({
        position: c.position,
        enzyme: c.enzymes ? c.enzymes.join('+') : c.enzyme,
        overhangType: c.overhangType,
      })),
      fragmentDistribution: fragments.map(f => ({
        index: f.index,
        length: f.length,
        start: f.start,
        end: f.end,
      })),
    };
  }
}

if (typeof window !== 'undefined') {
  window.RestrictionDigestService = RestrictionDigestService;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = RestrictionDigestService;
}
