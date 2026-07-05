// @ts-check
/**
 * PrimerManager - Owns primer *identity* independently from genome annotations.
 *
 * A primer is an oligo: a name + sequence + metadata (tags, notes, optional 5'
 * tail). WHERE a primer binds is NOT stored here — it is predicted in real time
 * by PrimerBindingService from (oligo, genome, stringency). The only positional
 * data persisted are rare "pinned" sites: manual placements a user asserts (e.g.
 * a cloning primer with a 5' tail that does not match the reference, or a legacy
 * primer imported from an annotation file).
 *
 * Primers and primer pairs are stored in the per-genome `.CodeXomics` sidecar
 * file (keys `primers` and `primerPairs`). They are never written into the genome
 * file itself (GBK/GFF/BED); see ExportManager for the export-side guard.
 */
class PrimerManager {
  constructor(genomeBrowser, configManager, sidecarManager = null) {
    this.genomeBrowser = genomeBrowser;
    this.configManager = configManager;
    this.sidecarManager = sidecarManager;
    this.primers = new Map(); // id -> oligo
    this.pairs = new Map(); // id -> primer pair
    this.storageKey = 'primers';
    this.pairStorageKey = 'primerPairs';

    this.bindingService = null;
    this._bindingServiceTried = false;

    this.init();
  }

  async init() {
    try {
      await this.loadPrimers();
      await this.loadPairs();
      console.log('🧬 PrimerManager initialized');
    } catch (error) {
      console.error('Error initializing PrimerManager:', error);
    }
  }

  async reloadForFile() {
    await this.loadPrimers();
    await this.loadPairs();
    this.bindingService?.invalidate();
    const migrated = await this.migrateLegacyPrimerAnnotations({ persist: true });
    if (migrated > 0) {
      console.log(`🧬 Migrated ${migrated} legacy primer annotation${migrated === 1 ? '' : 's'} into PrimerManager`);
    }
  }

  getCurrentFilePath() {
    return this.genomeBrowser?.fileManager?.currentFile?.path || null;
  }

  // --- Real-time binding service integration -------------------------------

  /** Inject a PrimerBindingService instance (used by the renderer wiring/tests). */
  setBindingService(service) {
    this.bindingService = service || null;
    this._bindingServiceTried = true;
    if (this.bindingService && typeof this.bindingService.onSitesUpdated === 'function') {
      this.bindingService.onSitesUpdated(chromosome => this.refreshPrimerViews(chromosome));
    }
    return this.bindingService;
  }

  /** Lazily resolve a binding service from the browser global, if available. */
  _getBindingService() {
    if (this.bindingService) return this.bindingService;
    if (this._bindingServiceTried) return null;
    this._bindingServiceTried = true;
    const Cls = (typeof window !== 'undefined' && window.PrimerBindingService) || null;
    if (Cls) {
      const svc = new Cls(this.genomeBrowser);
      if (typeof svc.onSitesUpdated === 'function') {
        svc.onSitesUpdated(chromosome => this.refreshPrimerViews(chromosome));
      }
      this.bindingService = svc;
    }
    return this.bindingService;
  }

  setStringency(profile) {
    const svc = this._getBindingService();
    return svc ? svc.setStringency(profile) : null;
  }

  getStringency() {
    return this.bindingService ? this.bindingService.getStringency() : null;
  }

  invalidateBindingCache(primerId = null, chromosome = null) {
    this.bindingService?.invalidate(primerId, chromosome);
  }

  // --- Persistence: oligos -------------------------------------------------

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

  // --- Persistence: pairs --------------------------------------------------

  async loadPairs() {
    let data = [];
    const currentFilePath = this.getCurrentFilePath();

    if (this.sidecarManager && currentFilePath) {
      data = (await this.sidecarManager.get(currentFilePath, this.pairStorageKey)) || [];
    } else if (this.configManager) {
      data = this.configManager.get('primers.pairs', []);
    }

    this.pairs.clear();
    const pairArray = Array.isArray(data) ? data : Object.values(data || {});
    pairArray.forEach(rawPair => {
      const pair = this.normalizePair(rawPair);
      if (pair) this.pairs.set(pair.id, pair);
    });
  }

  async savePairs() {
    const data = this.listPairs();
    const currentFilePath = this.getCurrentFilePath();

    if (this.sidecarManager && currentFilePath) {
      await this.sidecarManager.set(currentFilePath, this.pairStorageKey, data);
    } else if (this.configManager) {
      this.configManager.set('primers.pairs', data);
    }
  }

  // --- ID generators -------------------------------------------------------

  generatePrimerId() {
    return `primer_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  generateBindingSiteId() {
    return `site_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  generatePairId() {
    return `pair_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  // --- Normalization -------------------------------------------------------

  normalizePrimer(rawPrimer) {
    if (!rawPrimer) return null;

    const now = new Date().toISOString();
    const sequence = this.normalizeSequence(
      rawPrimer.sequence || rawPrimer.primerSequence || rawPrimer.oligoSequence || ''
    );
    const id = rawPrimer.id || this.generatePrimerId();
    const notes = rawPrimer.notes || rawPrimer.description || rawPrimer.note || '';
    const primer = {
      id,
      name: rawPrimer.name || rawPrimer.label || rawPrimer.gene || id,
      sequence,
      notes,
      description: notes, // compatibility alias for existing UI/serialization
      tags: Array.isArray(rawPrimer.tags) ? rawPrimer.tags.slice() : [],
      color: rawPrimer.color || '#a21caf',
      fivePrimeTail: this.normalizeSequence(rawPrimer.fivePrimeTail || ''),
      fivePrimePhosphate:
        rawPrimer.fivePrimePhosphate === true ||
        rawPrimer.fivePrimePhosphate === 'true' ||
        rawPrimer.phosphorylated === true,
      source: rawPrimer.source || 'user',
      createdAt: rawPrimer.createdAt || now,
      updatedAt: rawPrimer.updatedAt || now,
      pinnedSites: [],
    };

    const rawSites = Array.isArray(rawPrimer.pinnedSites)
      ? rawPrimer.pinnedSites
      : Array.isArray(rawPrimer.bindingSites)
        ? rawPrimer.bindingSites
        : [];
    rawSites.forEach(site => {
      const normalizedSite = this.normalizePinnedSite(site, primer);
      if (normalizedSite) {
        primer.pinnedSites.push(normalizedSite);
      }
    });
    if (!primer.sequence && primer.pinnedSites[0]?.bindingSequence) {
      primer.sequence = primer.pinnedSites[0].bindingSequence;
    }

    return primer.sequence || primer.pinnedSites.length > 0 ? primer : null;
  }

  normalizePinnedSite(rawSite, primer) {
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
      primerEnd: Number.isFinite(rawSite.primerEnd)
        ? rawSite.primerEnd
        : primerSequence.length || bindingSequence.length,
      bindingSequence,
      mismatches,
      tm: Number.isFinite(rawSite.tm) ? rawSite.tm : rawSite.bindingTm,
      gcContent: Number.isFinite(rawSite.gcContent) ? rawSite.gcContent : undefined,
      bindingScore: Number.isFinite(rawSite.bindingScore) ? rawSite.bindingScore : undefined,
      reason: rawSite.reason || '',
      isPrimary: rawSite.isPrimary === true,
      origin: 'pinned',
      source: rawSite.source || primer.source || 'user',
    };
  }

  /** @deprecated use normalizePinnedSite — retained as a compatibility alias. */
  normalizeBindingSite(rawSite, primer) {
    return this.normalizePinnedSite(rawSite, primer);
  }

  normalizePair(rawPair) {
    if (!rawPair) return null;
    const now = new Date().toISOString();
    const forwardId = rawPair.forwardId || rawPair.forward || null;
    const reverseId = rawPair.reverseId || rawPair.reverse || null;
    if (!forwardId || !reverseId) return null;
    const id = rawPair.id || this.generatePairId();
    return {
      id,
      name: rawPair.name || id,
      forwardId,
      reverseId,
      expectedProductBp: Number.isFinite(rawPair.expectedProductBp)
        ? rawPair.expectedProductBp
        : Number.isFinite(rawPair.productSize)
          ? rawPair.productSize
          : undefined,
      purpose: rawPair.purpose || '',
      tags: Array.isArray(rawPair.tags) ? rawPair.tags.slice() : [],
      createdAt: rawPair.createdAt || now,
      updatedAt: rawPair.updatedAt || now,
    };
  }

  // --- Oligo CRUD ----------------------------------------------------------

  async addPrimer(rawPrimer, options = {}) {
    const primer = this.normalizePrimer(rawPrimer);
    if (!primer) {
      throw new Error('Primer sequence or at least one binding site is required');
    }

    if (!primer.pinnedSites.length && rawPrimer.chromosome && rawPrimer.start && rawPrimer.end) {
      const site = this.normalizePinnedSite(rawPrimer, primer);
      if (site) primer.pinnedSites.push(site);
    }

    const existingId = options.mergeDuplicates === false ? null : this.findDuplicatePrimerId(primer);
    if (existingId) {
      const existing = this.primers.get(existingId);
      existing.pinnedSites.push(...primer.pinnedSites.filter(site => !this.hasDuplicateSite(existing, site)));
      existing.sequence = existing.sequence || primer.sequence;
      existing.notes = existing.notes || primer.notes;
      existing.description = existing.notes;
      existing.fivePrimePhosphate = existing.fivePrimePhosphate || primer.fivePrimePhosphate;
      if (primer.tags?.length) {
        existing.tags = Array.from(new Set([...(existing.tags || []), ...primer.tags]));
      }
      existing.updatedAt = new Date().toISOString();
      this.primers.set(existingId, existing);
      await this.savePrimers();
      this.invalidateBindingCache(existingId);
      this.refreshPrimerViews();
      return existing;
    }

    this.primers.set(primer.id, primer);
    await this.savePrimers();
    this.invalidateBindingCache(primer.id);
    this.refreshPrimerViews();
    return primer;
  }

  async updatePrimer(primerId, updates = {}) {
    const primer = this.primers.get(primerId);
    if (!primer) throw new Error(`Primer not found: ${primerId}`);
    if (updates.name !== undefined) primer.name = updates.name;
    if (updates.sequence !== undefined) primer.sequence = this.normalizeSequence(updates.sequence);
    if (updates.notes !== undefined || updates.description !== undefined) {
      primer.notes = updates.notes ?? updates.description ?? primer.notes;
      primer.description = primer.notes;
    }
    if (updates.color !== undefined) primer.color = updates.color;
    if (Array.isArray(updates.tags)) primer.tags = updates.tags.slice();
    if (updates.fivePrimeTail !== undefined) primer.fivePrimeTail = this.normalizeSequence(updates.fivePrimeTail);
    if (updates.fivePrimePhosphate !== undefined) primer.fivePrimePhosphate = updates.fivePrimePhosphate === true;
    primer.updatedAt = new Date().toISOString();
    await this.savePrimers();
    this.invalidateBindingCache(primerId);
    this.refreshPrimerViews();
    return primer;
  }

  async addPinnedSite(primerId, rawSite) {
    const primer = this.primers.get(primerId);
    if (!primer) throw new Error(`Primer not found: ${primerId}`);

    const site = this.normalizePinnedSite(rawSite, primer);
    if (!site) throw new Error('Invalid primer binding site');
    if (!this.hasDuplicateSite(primer, site)) {
      primer.pinnedSites.push(site);
    }
    primer.updatedAt = new Date().toISOString();
    await this.savePrimers();
    this.refreshPrimerViews();
    return site;
  }

  /** @deprecated use addPinnedSite — retained as a compatibility alias. */
  async addBindingSite(primerId, rawSite) {
    return this.addPinnedSite(primerId, rawSite);
  }

  async removePrimer(primerId) {
    const removed = this.primers.delete(primerId);
    if (removed) {
      let pairsChanged = false;
      for (const [pairId, pair] of this.pairs) {
        if (pair.forwardId === primerId || pair.reverseId === primerId) {
          this.pairs.delete(pairId);
          pairsChanged = true;
        }
      }
      await this.savePrimers();
      if (pairsChanged) await this.savePairs();
      this.invalidateBindingCache(primerId);
      this.refreshPrimerViews();
    }
    return removed;
  }

  async clearPrimers(chromosome = null) {
    if (!chromosome) {
      const removed = this.primers.size;
      this.primers.clear();
      this.pairs.clear();
      if (removed > 0) {
        await this.savePrimers();
        await this.savePairs();
        this.bindingService?.invalidate();
        this.refreshPrimerViews();
      }
      return removed;
    }

    // Chromosome-scoped clear removes pinned placements on that chromosome and
    // prunes oligos that existed only for those placements. Identity-only oligos
    // (no pinned sites) and oligos pinned elsewhere are left untouched.
    let removed = 0;
    const emptied = [];
    for (const [primerId, primer] of this.primers) {
      const before = (primer.pinnedSites || []).length;
      if (before === 0) continue;
      primer.pinnedSites = primer.pinnedSites.filter(site => site.chromosome !== chromosome);
      const delta = before - primer.pinnedSites.length;
      removed += delta;
      if (delta > 0 && primer.pinnedSites.length === 0) emptied.push(primerId);
    }
    // Drop any pairs that referenced a pruned oligo so the sidecar never keeps a
    // pair pointing at a primer that no longer exists.
    const emptiedSet = new Set(emptied);
    let pairsChanged = false;
    emptied.forEach(id => this.primers.delete(id));
    for (const [pairId, pair] of this.pairs) {
      if (emptiedSet.has(pair.forwardId) || emptiedSet.has(pair.reverseId)) {
        this.pairs.delete(pairId);
        pairsChanged = true;
      }
    }

    if (removed > 0) {
      await this.savePrimers();
      if (pairsChanged) await this.savePairs();
      this.bindingService?.invalidate(null, chromosome);
      this.refreshPrimerViews(chromosome);
    }
    return removed;
  }

  listPrimers() {
    return Array.from(this.primers.values()).map(primer => ({
      id: primer.id,
      name: primer.name,
      sequence: primer.sequence,
      notes: primer.notes,
      description: primer.notes, // compatibility alias
      tags: [...(primer.tags || [])],
      color: primer.color,
      fivePrimeTail: primer.fivePrimeTail || '',
      fivePrimePhosphate: primer.fivePrimePhosphate || false,
      source: primer.source,
      createdAt: primer.createdAt,
      updatedAt: primer.updatedAt,
      pinnedSites: (primer.pinnedSites || []).map(site => ({ ...site })),
    }));
  }

  getPrimer(primerId) {
    return this.primers.get(primerId) || null;
  }

  // --- Pair CRUD -----------------------------------------------------------

  async addPair(rawPair) {
    const pair = this.normalizePair(rawPair);
    if (!pair) throw new Error('A primer pair requires forwardId and reverseId');
    if (!this.primers.has(pair.forwardId) || !this.primers.has(pair.reverseId)) {
      throw new Error('Both forward and reverse primers must exist before pairing');
    }
    this.pairs.set(pair.id, pair);
    await this.savePairs();
    return pair;
  }

  async removePair(pairId) {
    const removed = this.pairs.delete(pairId);
    if (removed) await this.savePairs();
    return removed;
  }

  listPairs() {
    return Array.from(this.pairs.values()).map(pair => ({ ...pair, tags: [...(pair.tags || [])] }));
  }

  getPair(pairId) {
    return this.pairs.get(pairId) || null;
  }

  getPairForPrimer(primerId) {
    for (const pair of this.pairs.values()) {
      if (pair.forwardId === primerId || pair.reverseId === primerId) return pair;
    }
    return null;
  }

  // --- Duplicate detection -------------------------------------------------

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
    return (primer.pinnedSites || []).some(
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
        pinnedSites: primer.pinnedSites.filter(site => site.chromosome === chromosome),
      }))
      .filter(primer => primer.pinnedSites.length > 0);
  }

  // --- Renderable sites (pinned + predicted) ------------------------------

  /**
   * Return renderable binding sites for the chromosome/viewport. Combines the
   * primer's pinned sites with real-time predicted sites from the binding service
   * (deduped against pinned sites). When no binding service is available (e.g.
   * Node tests) only pinned sites are returned.
   */
  getRenderableBindingSites(chromosome, viewport = null) {
    const renderables = [];
    for (const primer of this.primers.values()) {
      const sites = this.getSitesForPrimer(primer, chromosome, viewport);
      sites.forEach(site => {
        if (chromosome && site.chromosome && site.chromosome !== chromosome) return;
        if (viewport && !this.siteOverlapsViewport(site, viewport)) return;
        renderables.push(this.toRenderableBindingSite(primer, site));
      });
    }
    return renderables.sort((a, b) => a.start - b.start || a.end - b.end || a.name.localeCompare(b.name));
  }

  getSitesForPrimer(primer, chromosome, viewport = null) {
    const pinned = (primer.pinnedSites || []).map(site => ({ ...site, origin: 'pinned' }));

    let predicted = [];
    const service = this._getBindingService();
    if (service && primer.sequence && chromosome) {
      try {
        predicted = service.predictForViewport(primer, chromosome, viewport) || [];
      } catch (e) {
        predicted = [];
      }
    }
    if (!predicted.length) return pinned;

    const pinnedKeys = new Set(pinned.map(site => this._siteKey(site)));
    const merged = pinned.slice();
    predicted.forEach(site => {
      if (!pinnedKeys.has(this._siteKey(site))) {
        merged.push({ ...site, origin: site.origin || 'predicted' });
      }
    });
    return merged;
  }

  _siteKey(site) {
    return `${site.chromosome}:${Math.min(site.start, site.end)}:${Math.max(site.start, site.end)}:${this.normalizeStrand(
      site.strand
    )}`;
  }

  toRenderableBindingSite(primer, site) {
    const pair = this.getPairForPrimer(primer.id);
    return {
      id: `${primer.id}:${site.id}`,
      primerId: primer.id,
      bindingSiteId: site.id,
      pairId: pair ? pair.id : undefined,
      type: 'primer_binding',
      origin: site.origin || 'pinned',
      name: primer.name,
      sequence: primer.sequence,
      primerSequence: primer.sequence,
      bindingSequence: site.bindingSequence,
      chromosome: site.chromosome,
      start: site.start,
      end: site.end,
      strand: site.strand,
      color: primer.color,
      description: primer.description || primer.notes,
      fivePrimePhosphate: primer.fivePrimePhosphate || false,
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
        five_prime_phosphate: primer.fivePrimePhosphate || false,
        note: primer.description || primer.notes,
      },
    };
  }

  siteOverlapsViewport(site, viewport) {
    if (!viewport) return true;
    // Inclusive overlap (1-based): a site touching the left edge still overlaps.
    return site.end >= viewport.start && site.start <= viewport.end;
  }

  // --- Legacy annotation migration (Phase 1) ------------------------------

  async migrateLegacyPrimerAnnotations(options = {}) {
    const annotationsByChromosome = this.genomeBrowser?.currentAnnotations || {};
    let migrated = 0;
    const removalsByChromosome = {};

    const markForRemoval = (chromosome, feature) => {
      if (!removalsByChromosome[chromosome]) removalsByChromosome[chromosome] = new Set();
      removalsByChromosome[chromosome].add(feature);
    };

    Object.entries(annotationsByChromosome).forEach(([chromosome, annotations]) => {
      (annotations || []).forEach(feature => {
        const type = String(feature?.type || '').toLowerCase();
        if (type !== 'primer' && type !== 'primer_bind') return;

        const primer = this.primerFromLegacyAnnotation(feature, chromosome);
        if (!primer) return;

        const existingId = this.findDuplicatePrimerId(primer);
        if (existingId) {
          const existing = this.primers.get(existingId);
          primer.pinnedSites.forEach(site => {
            if (!this.hasDuplicateSite(existing, site)) {
              existing.pinnedSites.push(site);
            }
          });
          existing.updatedAt = new Date().toISOString();
        } else {
          this.primers.set(primer.id, primer);
        }
        migrated++;
        markForRemoval(chromosome, feature);
      });
    });

    // Primers are owned by PrimerManager, not by the genome annotations. Strip the
    // migrated primer/primer_bind features so they no longer render in the gene
    // track and never leak back into exported genome files (e.g. GBK/GFF).
    const removed = this.removeFeaturesFromGenome(removalsByChromosome);

    if (migrated > 0 && options.persist !== false) {
      await this.savePrimers();
    }
    if (removed > 0 && typeof this.genomeBrowser?.updateGeneDisplay === 'function') {
      // Refresh only if a view is already rendered; harmless during initial load.
      try {
        this.genomeBrowser.updateGeneDisplay();
      } catch (e) {
        /* display may not be ready during initial load */
      }
    }
    return migrated;
  }

  /**
   * Remove the given feature objects from the genome's annotation collections.
   * @param {Object<string, Set>} removalsByChromosome - chromosome -> Set of feature refs
   * @returns {number} number of features removed across all collections
   */
  removeFeaturesFromGenome(removalsByChromosome) {
    let removed = 0;
    const strip = collection => {
      if (!collection) return;
      Object.entries(removalsByChromosome).forEach(([chromosome, featureSet]) => {
        const list = collection[chromosome];
        if (!Array.isArray(list)) return;
        const before = list.length;
        collection[chromosome] = list.filter(feature => !featureSet.has(feature));
        removed += before - collection[chromosome].length;
      });
    };
    strip(this.genomeBrowser?.currentAnnotations);
    strip(this.genomeBrowser?.userDefinedFeatures);
    return removed;
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
      pinnedSites: [
        {
          chromosome: feature.chromosome || chromosome,
          start: feature.start,
          end: feature.end,
          strand: feature.strand,
          reason: 'imported from annotation file',
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

  // --- Sequence helpers ----------------------------------------------------

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

  // --- Import / export (Phase 4) ------------------------------------------

  /** Serialize all oligos to a CSV string. */
  exportToCSV() {
    const escape = value => {
      const str = String(value ?? '');
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    };
    const header = 'name,sequence,fivePrimeTail,fivePrimePhosphate,tags,notes';
    const rows = this.listPrimers().map(primer =>
      [
        primer.name,
        primer.sequence,
        primer.fivePrimeTail || '',
        primer.fivePrimePhosphate ? 'true' : 'false',
        (primer.tags || []).join('|'),
        primer.notes || '',
      ]
        .map(escape)
        .join(',')
    );
    return [header, ...rows].join('\n');
  }

  /** Serialize all oligos to FASTA (>name + sequence). */
  exportToFasta() {
    return this.listPrimers()
      .filter(primer => primer.sequence)
      .map(primer => `>${primer.name}${primer.notes ? ` ${primer.notes}` : ''}\n${primer.sequence}`)
      .join('\n');
  }

  /**
   * Import oligos from CSV text. Recognizes a header row with name/sequence
   * columns; otherwise treats columns positionally as name,sequence,...
   * @returns {Promise<number>} number of primers imported
   */
  async importFromCSV(text) {
    const lines = String(text || '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    if (lines.length === 0) return 0;

    const parseRow = row => {
      const out = [];
      let cur = '';
      let inQuotes = false;
      for (let i = 0; i < row.length; i++) {
        const ch = row[i];
        if (inQuotes) {
          if (ch === '"' && row[i + 1] === '"') {
            cur += '"';
            i++;
          } else if (ch === '"') {
            inQuotes = false;
          } else {
            cur += ch;
          }
        } else if (ch === '"') {
          inQuotes = true;
        } else if (ch === ',') {
          out.push(cur);
          cur = '';
        } else {
          cur += ch;
        }
      }
      out.push(cur);
      return out.map(value => value.trim());
    };

    const header = parseRow(lines[0]).map(value => value.toLowerCase());
    const hasHeader = header.includes('sequence') || header.includes('name');
    const col = key => header.indexOf(key);
    const dataLines = hasHeader ? lines.slice(1) : lines;

    let imported = 0;
    for (const line of dataLines) {
      const cols = parseRow(line);
      const name = hasHeader && col('name') >= 0 ? cols[col('name')] : cols[0];
      const sequence = hasHeader && col('sequence') >= 0 ? cols[col('sequence')] : cols[1];
      if (!sequence) continue;
      const tailIdx = hasHeader ? col('fiveprimetail') : -1;
      const phosphateIdx = hasHeader ? col('fiveprimephosphate') : -1;
      const tagsIdx = hasHeader ? col('tags') : -1;
      const notesIdx = hasHeader ? col('notes') : -1;
      await this.addPrimer({
        name: name || undefined,
        sequence,
        fivePrimeTail: tailIdx >= 0 ? cols[tailIdx] : '',
        fivePrimePhosphate: phosphateIdx >= 0 ? this.parseBoolean(cols[phosphateIdx]) : false,
        tags:
          tagsIdx >= 0 && cols[tagsIdx]
            ? cols[tagsIdx]
                .split('|')
                .map(t => t.trim())
                .filter(Boolean)
            : [],
        notes: notesIdx >= 0 ? cols[notesIdx] : '',
        source: 'import',
      });
      imported++;
    }
    return imported;
  }

  parseBoolean(value) {
    return /^(true|1|yes|y|phosphorylated|5p)$/i.test(String(value || '').trim());
  }

  /**
   * Import oligos from FASTA text.
   * @returns {Promise<number>} number of primers imported
   */
  async importFromFasta(text) {
    const entries = [];
    let current = null;
    String(text || '')
      .split(/\r?\n/)
      .forEach(line => {
        if (line.startsWith('>')) {
          if (current) entries.push(current);
          const header = line.slice(1).trim();
          const spaceIdx = header.indexOf(' ');
          current = {
            name: spaceIdx >= 0 ? header.slice(0, spaceIdx) : header,
            notes: spaceIdx >= 0 ? header.slice(spaceIdx + 1) : '',
            sequence: '',
          };
        } else if (current) {
          current.sequence += line.trim();
        }
      });
    if (current) entries.push(current);

    let imported = 0;
    for (const entry of entries) {
      if (!entry.sequence) continue;
      await this.addPrimer({ name: entry.name, sequence: entry.sequence, notes: entry.notes, source: 'import' });
      imported++;
    }
    return imported;
  }

  // --- View refresh --------------------------------------------------------

  refreshPrimerViews(chromosome = null) {
    if (typeof document === 'undefined') return;
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
      this.genomeBrowser.sequenceUtils.displayEnhancedSequence(
        currentChr,
        this.genomeBrowser.currentSequence[currentChr]
      );
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrimerManager;
}

if (typeof window !== 'undefined') {
  window.PrimerManager = PrimerManager;
}
