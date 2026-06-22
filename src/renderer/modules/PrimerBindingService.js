// @ts-check
/**
 * PrimerBindingService - Real-time, on-demand prediction of primer binding sites.
 *
 * Primer *identity* (the oligo: name + sequence) is persisted by PrimerManager.
 * *Where* a primer binds is a derived property of (oligo, genome, stringency) and
 * is computed here on demand rather than stored. Results are cached per chromosome
 * and invalidated when the genome sequence changes (e.g. an edit). Whole-chromosome
 * scans run in a Web Worker when available so the UI thread stays responsive; a
 * synchronous fallback keeps the service usable in Node (tests) and when Workers
 * are unavailable.
 *
 * Coordinate contract: PrimerDesigner.findBindingSites returns 0-based half-open
 * offsets within the template; this service converts them to the application's
 * 1-based inclusive genomic convention before handing sites to renderers.
 */

const DEFAULT_STRINGENCY = {
  maxMismatches: 3,
  max3PrimeMismatches: 1,
  minBindingTm: undefined,
  scoringMode: 'fast',
  naConcentration: 0.05,
  primerConcentration: 250e-9,
};

class PrimerBindingService {
  constructor(genomeBrowser, options = {}) {
    this.genomeBrowser = genomeBrowser;
    this.stringency = { ...DEFAULT_STRINGENCY, ...(options.stringency || {}) };

    // Viewport spans up to this size get an immediate synchronous preview scan
    // while the full-chromosome scan runs in the background.
    this.maxSyncWindow = Number.isFinite(options.maxSyncWindow) ? options.maxSyncWindow : 200000;
    // Without a Worker, skip whole-chromosome scans above this size to avoid
    // blocking the UI thread; viewport preview still provides local sites.
    this.maxSyncScan = Number.isFinite(options.maxSyncScan) ? options.maxSyncScan : 3000000;

    // Resolved lazily so the service can be constructed before PrimerDesigner.js
    // has finished loading; see _getDesigner().
    this.designer = options.designer || null;

    this.cache = new Map(); // cacheKey -> { sites }
    this.pending = new Map(); // cacheKey -> Promise<sites>
    this.versions = new Map(); // chromosome -> version number (bumped on invalidate)
    this.updateCallbacks = [];

    this.useWorker = options.useWorker !== false;
    this.workerUrl = options.workerUrl || 'modules/workers/primer-binding-worker.js';
    this.worker = null;
    this.workerDead = false;
    this.workerJobs = new Map(); // jobId -> { resolve, reject, primer, chromosome }
    this.workerJobSeq = 0;
  }

  _tryRequireDesigner() {
    try {
      return require('./PrimerDesigner');
    } catch (e) {
      return null;
    }
  }

  /** Resolve the PrimerDesigner engine lazily (it may load after this service). */
  _getDesigner() {
    if (this.designer) return this.designer;
    this.designer = (typeof window !== 'undefined' && window.PrimerDesigner) || this._tryRequireDesigner();
    return this.designer;
  }

  // --- Configuration -------------------------------------------------------

  setStringency(profile) {
    this.stringency = { ...this.stringency, ...(profile || {}) };
    this.invalidate(); // a stringency change invalidates every cached scan
    return this.stringency;
  }

  getStringency() {
    return { ...this.stringency };
  }

  onSitesUpdated(cb) {
    if (typeof cb === 'function') this.updateCallbacks.push(cb);
  }

  _notify(chromosome) {
    this.updateCallbacks.forEach(cb => {
      try {
        cb(chromosome);
      } catch (e) {
        /* listener errors must not break prediction */
      }
    });
  }

  // --- Cache keys / invalidation ------------------------------------------

  _chromosomeVersion(chromosome) {
    return this.versions.get(chromosome) || 0;
  }

  _stringencyKey() {
    const s = this.stringency;
    return `${s.maxMismatches}|${s.max3PrimeMismatches}|${s.minBindingTm}|${s.scoringMode}`;
  }

  _cacheKey(primerId, chromosome) {
    return `${primerId}::${chromosome}::${this._stringencyKey()}::${this._chromosomeVersion(chromosome)}`;
  }

  /**
   * Invalidate cached predictions. Call after a genome edit or stringency change.
   * @param {string|null} primerId - limit to one primer (optional)
   * @param {string|null} chromosome - limit to one chromosome (optional)
   */
  invalidate(primerId = null, chromosome = null) {
    if (!primerId && !chromosome) {
      const sequences = this.genomeBrowser?.currentSequence || {};
      const chrs = new Set([...Object.keys(sequences), ...this.versions.keys()]);
      chrs.forEach(chr => this.versions.set(chr, this._chromosomeVersion(chr) + 1));
      this.cache.clear();
      this.pending.clear();
      return;
    }
    if (chromosome) {
      this.versions.set(chromosome, this._chromosomeVersion(chromosome) + 1);
    }
    for (const key of [...this.cache.keys()]) {
      const [pid, chr] = key.split('::');
      if (primerId && pid !== primerId) continue;
      if (chromosome && chr !== chromosome) continue;
      this.cache.delete(key);
      this.pending.delete(key);
    }
  }

  // --- Public prediction API ----------------------------------------------

  /** Synchronously return cached full-chromosome sites for a primer, or null. */
  getCachedSites(primerId, chromosome) {
    const entry = this.cache.get(this._cacheKey(primerId, chromosome));
    return entry ? entry.sites : null;
  }

  /**
   * Return binding sites overlapping the viewport. Uses the cached full scan when
   * available; otherwise triggers a background scan and returns an immediate
   * synchronous preview for sufficiently small viewports.
   */
  predictForViewport(primer, chromosome, viewport = null) {
    if (!primer?.sequence || !chromosome) return [];

    const cached = this.getCachedSites(primer.id, chromosome);
    if (cached) return this._filterToViewport(cached, viewport);

    // Kick off the (cached) full-chromosome scan in the background.
    this.ensureSites(primer, chromosome);

    // Immediate preview for small viewports so navigation feels real-time.
    if (viewport && this._viewportSpan(viewport) <= this.maxSyncWindow) {
      return this._scanWindowSync(primer, chromosome, viewport);
    }
    return [];
  }

  /**
   * Ensure full-chromosome sites for a primer are computed and cached.
   * Coalesces concurrent requests; resolves to the normalized site array.
   */
  async ensureSites(primer, chromosome) {
    if (!primer?.sequence || !chromosome) return [];
    const key = this._cacheKey(primer.id, chromosome);
    const cached = this.cache.get(key);
    if (cached) return cached.sites;
    if (this.pending.has(key)) return this.pending.get(key);

    const seq = this.genomeBrowser?.currentSequence?.[chromosome];
    if (!seq) return [];

    // Without a worker, do not block the UI thread on very large genomes.
    if (!this._workerAvailable() && seq.length > this.maxSyncScan) {
      return [];
    }

    const versionAtStart = this._chromosomeVersion(chromosome);
    const promise = this._scanChromosome(primer, chromosome, seq)
      .then(sites => {
        this.pending.delete(key);
        // Only cache/notify if the chromosome was not invalidated meanwhile.
        if (this._chromosomeVersion(chromosome) === versionAtStart) {
          this.cache.set(this._cacheKey(primer.id, chromosome), { sites });
          this._notify(chromosome);
        }
        return sites;
      })
      .catch(err => {
        this.pending.delete(key);
        console.error('🧬 PrimerBindingService scan failed:', err);
        return [];
      });

    this.pending.set(key, promise);
    return promise;
  }

  /**
   * Summarize off-target potential from the cached full scan, or null if the scan
   * has not completed yet. "offTarget" counts acceptable sites beyond the single
   * best (lowest-mismatch, highest-score) hit.
   */
  getOffTargetSummary(primer, chromosome) {
    const sites = this.getCachedSites(primer.id, chromosome);
    if (!sites) return null;
    const perfect = sites.filter(s => (s.mismatches?.length || 0) === 0).length;
    return {
      total: sites.length,
      perfect,
      offTarget: Math.max(0, sites.length - 1),
      pending: false,
    };
  }

  // --- Internal compute ----------------------------------------------------

  _viewportSpan(viewport) {
    return Math.max(0, (viewport.end || 0) - (viewport.start || 0) + 1);
  }

  _filterToViewport(sites, viewport) {
    if (!viewport) return sites;
    return sites.filter(s => s.end >= viewport.start && s.start <= viewport.end);
  }

  _scanWindowSync(primer, chromosome, viewport) {
    const seq = this.genomeBrowser?.currentSequence?.[chromosome];
    if (!seq) return [];
    const start = Math.max(1, Math.floor(viewport.start));
    const end = Math.min(seq.length, Math.ceil(viewport.end));
    if (end < start) return [];
    const windowSeq = seq.substring(start - 1, end);
    return this._computeSites(primer, windowSeq, start, chromosome);
  }

  _computeSites(primer, templateSeq, offset, chromosome) {
    const Designer = this._getDesigner();
    if (!Designer || !templateSeq) return [];
    const raw = Designer.findBindingSites(primer.sequence, templateSeq, this.stringency.maxMismatches, {
      max3PrimeMismatches: this.stringency.max3PrimeMismatches,
      minBindingTm: this.stringency.minBindingTm,
      scoringMode: this.stringency.scoringMode,
      naConcentration: this.stringency.naConcentration,
      primerConcentration: this.stringency.primerConcentration,
    });
    return raw.map(site => this._normalizeSite(site, offset, chromosome, primer));
  }

  /**
   * Convert a PrimerDesigner site (0-based half-open, forward-genomic window) into
   * the application's 1-based inclusive site shape, oriented to the primer.
   */
  _normalizeSite(site, offset, chromosome, primer) {
    const Designer = this._getDesigner();
    const genomic = site.genomicSequence || site.sequence || '';
    // `oriented` is the binding sequence in the primer's 5'->3' frame, so that a
    // perfect match equals the primer character-for-character (the convention used
    // by pinned sites and PrimerManager.calculateMismatches). Derive mismatches by
    // comparing the primer against `oriented` directly — this is strand-agnostic and
    // avoids the frame mismatch of re-indexing the designer's query-frame details.
    const oriented = site.strand === '-' && Designer ? Designer.reverseComplement(genomic) : genomic;
    const primerSeq = String(primer.sequence || '')
      .toUpperCase()
      .replace(/[^ATCG]/g, '');
    const mismatches = [];
    const n = Math.min(primerSeq.length, oriented.length);
    for (let i = 0; i < n; i++) {
      if (primerSeq[i] !== oriented[i]) {
        mismatches.push({
          primerIndex: i,
          primerBase: primerSeq[i],
          genomeBase: oriented[i],
          posFrom3Prime: primerSeq.length - 1 - i,
          type:
            Designer && typeof Designer._classifyMismatch === 'function'
              ? Designer._classifyMismatch(primerSeq[i], oriented[i])
              : undefined,
        });
      }
    }
    return {
      id: `pred_${primer.id}_${chromosome}_${offset + site.start}_${site.strand === '-' ? 'r' : 'f'}`,
      chromosome,
      start: offset + site.start,
      end: offset + site.end - 1,
      strand: site.strand,
      bindingSequence: oriented,
      mismatches,
      bindingScore: site.bindingScore,
      tm: site.bindingTm,
      origin: 'predicted',
    };
  }

  async _scanChromosome(primer, chromosome, seq) {
    if (this._workerAvailable()) {
      try {
        return await this._scanViaWorker(primer, chromosome, seq);
      } catch (e) {
        // Worker failed — fall back to synchronous compute below.
      }
    }
    return this._computeSites(primer, seq, 1, chromosome);
  }

  // --- Web Worker plumbing -------------------------------------------------

  _workerAvailable() {
    if (!this.useWorker) return false;
    if (this.workerDead) return false;
    if (typeof Worker === 'undefined') return false;
    return this._ensureWorker();
  }

  _ensureWorker() {
    if (this.worker) return true;
    try {
      this.worker = new Worker(this.workerUrl);
      this.worker.onmessage = e => this._handleWorkerMessage(e);
      this.worker.onerror = () => this._killWorker();
      return true;
    } catch (e) {
      this.worker = null;
      this.workerDead = true;
      return false;
    }
  }

  _killWorker() {
    if (this.worker) {
      try {
        this.worker.terminate();
      } catch (e) {
        /* ignore */
      }
    }
    this.worker = null;
    this.workerDead = true;
    // Reject any in-flight jobs so callers fall back to synchronous compute.
    for (const [, job] of this.workerJobs) {
      job.reject(new Error('primer binding worker terminated'));
    }
    this.workerJobs.clear();
  }

  _scanViaWorker(primer, chromosome, seq) {
    return new Promise((resolve, reject) => {
      const jobId = ++this.workerJobSeq;
      this.workerJobs.set(jobId, { resolve, reject, primer, chromosome });
      this.worker.postMessage({
        jobId,
        primerSequence: primer.sequence,
        template: seq,
        stringency: this.stringency,
      });
    });
  }

  _handleWorkerMessage(e) {
    const { jobId, ok, sites, error } = e.data || {};
    const job = this.workerJobs.get(jobId);
    if (!job) return;
    this.workerJobs.delete(jobId);
    if (ok) {
      job.resolve((sites || []).map(s => this._normalizeSite(s, 1, job.chromosome, job.primer)));
    } else {
      job.reject(new Error(error || 'worker scan failed'));
    }
  }

  dispose() {
    this._killWorker();
    this.cache.clear();
    this.pending.clear();
    this.updateCallbacks = [];
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = PrimerBindingService;
}
if (typeof window !== 'undefined') {
  window.PrimerBindingService = PrimerBindingService;
}
