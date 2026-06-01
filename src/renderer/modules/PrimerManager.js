// @ts-check
/**
 * PrimerManager - Owns primer records independently from genome annotations.
 *
 * Primers are stored as oligos plus explicit binding sites in the per-genome
 * .CodeXomics sidecar file. Legacy primer/primer_bind annotations can be
 * imported for compatibility, but new primer operations should not mutate
 * currentAnnotations.
 */
class PrimerManager {
  constructor(genomeBrowser, configManager, sidecarManager = null) {
    this.genomeBrowser = genomeBrowser;
    this.configManager = configManager;
    this.sidecarManager = sidecarManager;
    this.primers = new Map();
    this.storageKey = 'primers';

    this.init();
  }

  async init() {
    try {
      await this.loadPrimers();
      console.log('🧬 PrimerManager initialized');
    } catch (error) {
      console.error('Error initializing PrimerManager:', error);
    }
  }

  async reloadForFile() {
    await this.loadPrimers();
    const migrated = await this.migrateLegacyPrimerAnnotations({ persist: true });
    if (migrated > 0) {
      console.log(`🧬 Migrated ${migrated} legacy primer annotation${migrated === 1 ? '' : 's'} into PrimerManager`);
    }
  }

  getCurrentFilePath() {
    return this.genomeBrowser?.fileManager?.currentFile?.path || null;
  }

  async loadPrimers() {
    let data = [];
    const currentFilePath = this.getCurrentFilePath();

    if (this.sidecarManager && currentFilePath) {
      data = (await this.sidecarManager.get(currentFilePath, this.storageKey)) || [];
      console.log(`📂 Loading primers from sidecar file: ${currentFilePath}`);
    } else if (this.configManager) {
      data = this.configManager.get('primers.data', []);
      console.log('📂 Loading primers from config (fallback)');
    }

    this.primers.clear();
    const primerArray = Array.isArray(data) ? data : Object.values(data || {});
    primerArray.forEach(rawPrimer => {
      const primer = this.normalizePrimer(rawPrimer);
      if (primer) {
        this.primers.set(primer.id, primer);
      }
    });

    console.log(`📂 Loaded ${this.primers.size} primer${this.primers.size === 1 ? '' : 's'}`);
  }

  async savePrimers() {
    const data = this.listPrimers();
    const currentFilePath = this.getCurrentFilePath();

    if (this.sidecarManager && currentFilePath) {
      await this.sidecarManager.set(currentFilePath, this.storageKey, data);
      console.log('💾 Saved primers to sidecar file');
    } else if (this.configManager) {
      this.configManager.set('primers.data', data);
      console.log('💾 Saved primers to config (fallback)');
    }
  }

  generatePrimerId() {
    return `primer_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  generateBindingSiteId() {
    return `site_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  normalizePrimer(rawPrimer) {
    if (!rawPrimer) return null;

    const now = new Date().toISOString();
    const sequence = this.normalizeSequence(
      rawPrimer.sequence || rawPrimer.primerSequence || rawPrimer.oligoSequence || ''
    );
    const id = rawPrimer.id || this.generatePrimerId();
    const primer = {
      id,
      name: rawPrimer.name || rawPrimer.label || rawPrimer.gene || id,
      sequence,
      description: rawPrimer.description || rawPrimer.note || '',
      color: rawPrimer.color || '#a21caf',
      source: rawPrimer.source || 'user',
      createdAt: rawPrimer.createdAt || now,
      updatedAt: rawPrimer.updatedAt || now,
      bindingSites: [],
    };

    const rawSites = Array.isArray(rawPrimer.bindingSites) ? rawPrimer.bindingSites : [];
    rawSites.forEach(site => {
      const normalizedSite = this.normalizeBindingSite(site, primer);
      if (normalizedSite) {
        primer.bindingSites.push(normalizedSite);
      }
    });
    if (!primer.sequence && primer.bindingSites[0]?.bindingSequence) {
      primer.sequence = primer.bindingSites[0].bindingSequence;
    }

    return primer.sequence || primer.bindingSites.length > 0 ? primer : null;
  }

  normalizeBindingSite(rawSite, primer) {
    if (!rawSite) return null;

    const chromosome = rawSite.chromosome || rawSite.chr || this.genomeBrowser?.currentChromosome;
    const start = Number.parseInt(rawSite.start ?? rawSite.genomicStart, 10);
    const end = Number.parseInt(rawSite.end ?? rawSite.genomicEnd, 10);
    if (!chromosome || !Number.isFinite(start) || !Number.isFinite(end)) return null;

    const normalizedStart = Math.min(start, end);
    const normalizedEnd = Math.max(start, end);
    const strand = this.normalizeStrand(rawSite.strand);
    const bindingSequence =
      this.normalizeSequence(rawSite.bindingSequence || rawSite.genomeBindingSequence || '') ||
      this.getGenomeBindingSequence(chromosome, normalizedStart, normalizedEnd, strand);
    const primerSequence = primer.sequence || this.normalizeSequence(rawSite.primerSequence || '') || bindingSequence;
    const mismatches = Array.isArray(rawSite.mismatches)
      ? rawSite.mismatches
      : this.calculateMismatches(primerSequence, bindingSequence);

    return {
      id: rawSite.id || this.generateBindingSiteId(),
      chromosome,
      start: normalizedStart,
      end: normalizedEnd,
      strand,
      primerStart: Number.isFinite(rawSite.primerStart) ? rawSite.primerStart : 1,
      primerEnd: Number.isFinite(rawSite.primerEnd) ? rawSite.primerEnd : primerSequence.length || bindingSequence.length,
      bindingSequence,
      mismatches,
      tm: Number.isFinite(rawSite.tm) ? rawSite.tm : rawSite.bindingTm,
      gcContent: Number.isFinite(rawSite.gcContent) ? rawSite.gcContent : undefined,
      bindingScore: Number.isFinite(rawSite.bindingScore) ? rawSite.bindingScore : undefined,
      isPrimary: rawSite.isPrimary === true,
      source: rawSite.source || primer.source || 'user',
    };
  }

  async addPrimer(rawPrimer, options = {}) {
    const primer = this.normalizePrimer(rawPrimer);
    if (!primer) {
      throw new Error('Primer sequence or at least one binding site is required');
    }

    if (!primer.bindingSites.length && rawPrimer.chromosome && rawPrimer.start && rawPrimer.end) {
      const site = this.normalizeBindingSite(rawPrimer, primer);
      if (site) primer.bindingSites.push(site);
    }

    const existingId = options.mergeDuplicates === false ? null : this.findDuplicatePrimerId(primer);
    if (existingId) {
      const existing = this.primers.get(existingId);
      existing.bindingSites.push(...primer.bindingSites.filter(site => !this.hasDuplicateSite(existing, site)));
      existing.sequence = existing.sequence || primer.sequence;
      existing.description = existing.description || primer.description;
      existing.updatedAt = new Date().toISOString();
      this.primers.set(existingId, existing);
      await this.savePrimers();
      this.refreshPrimerViews();
      return existing;
    }

    this.primers.set(primer.id, primer);
    await this.savePrimers();
    this.refreshPrimerViews();
    return primer;
  }

  async addBindingSite(primerId, rawSite) {
    const primer = this.primers.get(primerId);
    if (!primer) throw new Error(`Primer not found: ${primerId}`);

    const site = this.normalizeBindingSite(rawSite, primer);
    if (!site) throw new Error('Invalid primer binding site');
    if (!this.hasDuplicateSite(primer, site)) {
      primer.bindingSites.push(site);
    }
    primer.updatedAt = new Date().toISOString();
    await this.savePrimers();
    this.refreshPrimerViews();
    return site;
  }

  async removePrimer(primerId) {
    const removed = this.primers.delete(primerId);
    if (removed) {
      await this.savePrimers();
      this.refreshPrimerViews();
    }
    return removed;
  }

  async clearPrimers(chromosome = null) {
    let removed = 0;
    if (!chromosome) {
      removed = this.primers.size;
      this.primers.clear();
    } else {
      for (const [primerId, primer] of this.primers) {
        const before = primer.bindingSites.length;
        primer.bindingSites = primer.bindingSites.filter(site => site.chromosome !== chromosome);
        removed += before - primer.bindingSites.length;
        if (primer.bindingSites.length === 0) {
          this.primers.delete(primerId);
        }
      }
    }

    if (removed > 0) {
      await this.savePrimers();
      this.refreshPrimerViews(chromosome);
    }
    return removed;
  }

  listPrimers() {
    return Array.from(this.primers.values()).map(primer => ({
      ...primer,
      bindingSites: primer.bindingSites.map(site => ({ ...site })),
    }));
  }

  findDuplicatePrimerId(primer) {
    const sequence = primer.sequence;
    const name = String(primer.name || '').toLowerCase();
    for (const [id, existing] of this.primers) {
      if (sequence && existing.sequence === sequence) return id;
      if (name && String(existing.name || '').toLowerCase() === name) return id;
    }
    return null;
  }

  hasDuplicateSite(primer, site) {
    return primer.bindingSites.some(
      existing =>
        existing.chromosome === site.chromosome &&
        existing.start === site.start &&
        existing.end === site.end &&
        existing.strand === site.strand
    );
  }

  getPrimersForChromosome(chromosome) {
    return this.listPrimers()
      .map(primer => ({
        ...primer,
        bindingSites: primer.bindingSites.filter(site => site.chromosome === chromosome),
      }))
      .filter(primer => primer.bindingSites.length > 0);
  }

  getRenderableBindingSites(chromosome, viewport = null) {
    const renderables = [];
    for (const primer of this.primers.values()) {
      primer.bindingSites.forEach(site => {
        if (chromosome && site.chromosome !== chromosome) return;
        if (viewport && !this.siteOverlapsViewport(site, viewport)) return;
        renderables.push(this.toRenderableBindingSite(primer, site));
      });
    }
    return renderables.sort((a, b) => a.start - b.start || a.end - b.end || a.name.localeCompare(b.name));
  }

  toRenderableBindingSite(primer, site) {
    return {
      id: `${primer.id}:${site.id}`,
      primerId: primer.id,
      bindingSiteId: site.id,
      type: 'primer_binding',
      name: primer.name,
      sequence: primer.sequence,
      primerSequence: primer.sequence,
      bindingSequence: site.bindingSequence,
      chromosome: site.chromosome,
      start: site.start,
      end: site.end,
      strand: site.strand,
      color: primer.color,
      description: primer.description,
      mismatches: site.mismatches || [],
      bindingScore: site.bindingScore,
      tm: site.tm,
      gcContent: site.gcContent,
      sourcePrimer: primer,
      bindingSite: site,
      qualifiers: {
        gene: primer.name,
        label: primer.name,
        sequence: primer.sequence,
        binding_sequence: site.bindingSequence,
        note: primer.description,
      },
    };
  }

  siteOverlapsViewport(site, viewport) {
    if (!viewport) return true;
    return site.end > viewport.start && site.start <= viewport.end;
  }

  async migrateLegacyPrimerAnnotations(options = {}) {
    const annotationsByChromosome = this.genomeBrowser?.currentAnnotations || {};
    let migrated = 0;

    Object.entries(annotationsByChromosome).forEach(([chromosome, annotations]) => {
      (annotations || []).forEach(feature => {
        const type = String(feature?.type || '').toLowerCase();
        if (type !== 'primer' && type !== 'primer_bind') return;

        const primer = this.primerFromLegacyAnnotation(feature, chromosome);
        if (!primer) return;
        const existingId = this.findDuplicatePrimerId(primer);
        if (existingId) {
          const existing = this.primers.get(existingId);
          primer.bindingSites.forEach(site => {
            if (!this.hasDuplicateSite(existing, site)) {
              existing.bindingSites.push(site);
              migrated++;
            }
          });
          existing.updatedAt = new Date().toISOString();
          return;
        }
        this.primers.set(primer.id, primer);
        migrated++;
      });
    });

    if (migrated > 0 && options.persist !== false) {
      await this.savePrimers();
    }
    return migrated;
  }

  primerFromLegacyAnnotation(feature, chromosome) {
    const name =
      feature.name ||
      this.getQualifier(feature, 'label') ||
      this.getQualifier(feature, 'gene') ||
      this.getQualifier(feature, 'locus_tag') ||
      `Primer ${feature.start}-${feature.end}`;
    const sequence = this.normalizeSequence(
      feature.sequence ||
        this.getQualifier(feature, 'sequence') ||
        this.getQualifier(feature, 'primer_sequence') ||
        this.getQualifier(feature, 'oligo_sequence') ||
        ''
    );

    return this.normalizePrimer({
      id: feature.id ? `legacy_${feature.id}` : undefined,
      name,
      sequence,
      description: feature.description || this.getQualifier(feature, 'note') || '',
      source: 'legacy_annotation',
      bindingSites: [
        {
          chromosome: feature.chromosome || chromosome,
          start: feature.start,
          end: feature.end,
          strand: feature.strand,
          source: 'legacy_annotation',
        },
      ],
    });
  }

  getQualifier(feature, key) {
    if (!feature?.qualifiers) return '';
    if (this.genomeBrowser?.getQualifierValue) {
      return this.genomeBrowser.getQualifierValue(feature.qualifiers, key) || '';
    }
    const value = feature.qualifiers[key];
    return Array.isArray(value) ? value[0] || '' : value || '';
  }

  getGenomeBindingSequence(chromosome, start, end, strand = '+') {
    const sequence = this.genomeBrowser?.currentSequence?.[chromosome];
    if (!sequence) return '';
    const sliceStart = Math.max(0, Math.min(start, end) - 1);
    const sliceEnd = Math.min(sequence.length, Math.max(start, end));
    const genomeSequence = sequence.substring(sliceStart, sliceEnd).toUpperCase();
    return strand === '-' ? this.reverseComplement(genomeSequence) : this.normalizeSequence(genomeSequence);
  }

  calculateMismatches(primerSequence, bindingSequence) {
    const primer = this.normalizeSequence(primerSequence);
    const binding = this.normalizeSequence(bindingSequence);
    if (!primer || !binding || primer.length !== binding.length) return [];

    const mismatches = [];
    for (let i = 0; i < primer.length; i++) {
      if (primer[i] !== binding[i]) {
        mismatches.push({
          primerIndex: i,
          primerBase: primer[i],
          genomeBase: binding[i],
        });
      }
    }
    return mismatches;
  }

  normalizeSequence(sequence) {
    return String(sequence || '')
      .toUpperCase()
      .replace(/[^ATCGRYSWKMBDHVN]/g, '');
  }

  normalizeStrand(strand) {
    return strand === -1 || strand === '-' || String(strand).toLowerCase() === 'reverse' ? '-' : '+';
  }

  reverseComplement(sequence) {
    const complement = {
      A: 'T',
      T: 'A',
      G: 'C',
      C: 'G',
      R: 'Y',
      Y: 'R',
      M: 'K',
      K: 'M',
      S: 'S',
      W: 'W',
      B: 'V',
      D: 'H',
      H: 'D',
      V: 'B',
      N: 'N',
    };
    return this.normalizeSequence(sequence)
      .split('')
      .reverse()
      .map(base => complement[base] || 'N')
      .join('');
  }

  refreshPrimerViews(chromosome = null) {
    const currentChr =
      chromosome || document.getElementById('chromosomeSelect')?.value || this.genomeBrowser?.currentChromosome;
    if (!currentChr || !this.genomeBrowser?.currentSequence?.[currentChr]) return;

    if (this.genomeBrowser.visibleTracks && typeof this.genomeBrowser.visibleTracks.add === 'function') {
      this.genomeBrowser.visibleTracks.add('primers');
    }

    if (typeof this.genomeBrowser.displayGenomeView === 'function') {
      this.genomeBrowser.displayGenomeView(currentChr, this.genomeBrowser.currentSequence[currentChr]);
    }
    if (this.genomeBrowser.visibleTracks?.has('sequence') && this.genomeBrowser.sequenceUtils) {
      this.genomeBrowser.sequenceUtils.displayEnhancedSequence(currentChr, this.genomeBrowser.currentSequence[currentChr]);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrimerManager;
}

if (typeof window !== 'undefined') {
  window.PrimerManager = PrimerManager;
}
