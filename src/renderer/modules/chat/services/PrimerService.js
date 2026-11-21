// @ts-check
/**
 * PrimerService - Primer design and analysis tools extracted from ChatManager
 * Routes directly to PrimerDesigner, bypassing the 15-layer
 * ToolExecutionService → AnalysisAgent → re-entry → executeLocalTool chain.
 *
 * New call path (7 layers):
 *   LLM → sendToLLM → executeToolByName → ToolExecutionService → PrimerService → PrimerDesigner
 *
 * Sequence resolution (geneName/chromosome) is handled here so no
 * ChatManager prototype methods are needed for primer tools.
 */
class PrimerService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  // --- calculate_primer_properties ---

  async calculatePrimerProperties(params) {
    const Designer = this._getDesigner();
    return Designer.calculateProperties(params.sequence);
  }

  // --- design_primers ---

  async designPrimers(params) {
    await this._resolveTargetSequence(params);
    const Designer = this._getDesigner();
    const options = this._getDesignOptions(params);
    options.preserveCoordinates = Boolean(params.targetMetadata);
    const pair = Designer.designPrimerPair(params.targetSequence, options);
    if (!pair) {
      return { error: 'Could not find a valid primer pair meeting the criteria in the given sequence' };
    }
    return params.targetMetadata ? this._decoratePrimerPair(pair, params.targetMetadata) : pair;
  }

  // --- find_primer_binding_sites ---

  async findPrimerBindingSites(params) {
    const primerSeq = params.primerSequence || params.sequence || params.primer;
    if (!primerSeq) {
      throw new Error('primerSequence or sequence parameter is required');
    }
    params.primerSequence = primerSeq;

    await this._resolveTemplateSequence(params);
    const Designer = this._getDesigner();
    const result = {
      queryLength: params.primerSequence.length,
      sites: Designer.findBindingSites(
        params.primerSequence,
        params.templateSequence,
        params.maxMismatches !== undefined ? params.maxMismatches : 3,
        {
          max3PrimeMismatches: params.max3PrimeMismatches,
          minBindingTm: params.minBindingTm,
          scoringMode: params.scoringMode || 'fast',
          naConcentration: params.naConcentration,
          primerConcentration: params.primerConcentration,
        }
      ),
    };
    const hasGenomicContext = Boolean(params.chromosome || params.sequenceOffset);
    if (result.sites.length > 0) {
      const sequenceOffset = params.sequenceOffset || 1;
      result.sites = result.sites.map(site => {
        const bindingSequence =
          site.strand === '-'
            ? Designer.reverseComplement(site.genomicSequence || site.sequence)
            : site.genomicSequence || site.sequence;
        const mismatches = (site.mismatchDetails || []).map(mismatch => ({
          primerIndex: mismatch.position,
          primerBase: mismatch.primer,
          genomeBase: bindingSequence[mismatch.position],
          posFrom3Prime: mismatch.posFrom3Prime,
          type: mismatch.type,
        }));
        return {
          ...site,
          chromosome: params.chromosome,
          start: hasGenomicContext ? sequenceOffset + site.start : site.start,
          end: hasGenomicContext ? sequenceOffset + site.end - 1 : site.end,
          bindingSequence,
          mismatches,
        };
      });
    }
    return result;
  }

  // --- save_primer (alias: add_primer_annotation) ---

  async savePrimer(params) {
    if (!params.chromosome || !params.name) {
      throw new Error('Primer name and chromosome are required');
    }
    const start = this._getNumber(params.start);
    const end = this._getNumber(params.end);
    if (!Number.isSafeInteger(start) || start < 1 || !Number.isSafeInteger(end) || end < 1) {
      throw new Error(
        'Primer start and end must be 1-based genomic coordinates. For designed primers, use genomicStart and genomicEnd.'
      );
    }
    const strand = params.strand === '-' || params.strand === -1 ? -1 : 1;
    const primerSequence = params.sequence || params.primerSequence || params.oligoSequence;
    const manager = this._getPrimerManager();
    const primer = await manager.addPrimer({
      name: params.name,
      sequence: primerSequence,
      description: params.description || `Tm: ${params.tm || '?'}, GC: ${params.gcContent || '?'}%`,
      source: 'chatbox',
      bindingSites: [
        {
          chromosome: params.chromosome,
          start,
          end,
          strand,
          tm: params.tm,
          gcContent: params.gcContent,
          source: 'chatbox',
        },
      ],
    });

    this._showPrimerTrack(params.chromosome);
    return {
      success: true,
      primer,
      track: 'primers',
      message: `Added primer "${params.name}" to the Primers track`,
    };
  }

  async listPrimers(params = {}) {
    const manager = this._getPrimerManager();
    const chromosome =
      params.chromosome || document.getElementById('chromosomeSelect')?.value || this.app?.currentChromosome || null;
    const start = this._getNumber(params.start);
    const end = this._getNumber(params.end);
    const sitesByPrimer = new Map();
    for (const site of manager.getRenderableBindingSites(chromosome)) {
      if ((start !== undefined && site.end < start) || (end !== undefined && site.start > end)) continue;

      if (!sitesByPrimer.has(site.primerId)) sitesByPrimer.set(site.primerId, []);
      sitesByPrimer.get(site.primerId).push({
        id: site.id,
        chromosome: site.chromosome,
        start: site.start,
        end: site.end,
        strand: site.strand,
        origin: site.origin,
        bindingSequence: site.bindingSequence || '',
        mismatches: site.mismatches || [],
      });
    }

    const primers = manager
      .listPrimers()
      .filter(primer => (start === undefined && end === undefined) || sitesByPrimer.has(primer.id))
      .map(({ id, name, sequence, description, tags, fivePrimeTail, fivePrimePhosphate }) => {
        const bindingSites = sitesByPrimer.get(id) || [];
        return {
          id,
          name,
          sequence,
          description,
          tags,
          fivePrimeTail,
          fivePrimePhosphate,
          bindingSiteCount: bindingSites.length,
          bindingSites,
          ...(chromosome && manager.bindingService && sequence
            ? { predictionsCached: Boolean(manager.bindingService.getCachedSites(id, chromosome)) }
            : {}),
        };
      });

    return {
      success: true,
      chromosome,
      count: primers.length,
      primers,
    };
  }

  async deletePrimers(params = {}) {
    const chromosome = params.chromosome;
    const clearAll = params.confirm === true || params.confirm === 'true';
    if (!clearAll) {
      throw new Error('Set confirm=true to delete primers');
    }

    const manager = this._getPrimerManager();
    const removed = await manager.clearPrimers(chromosome);
    this._showPrimerTrack(chromosome);

    return {
      success: true,
      removed,
      chromosome: chromosome || 'all',
      message: `Removed ${removed} primer${removed === 1 ? '' : 's'}`,
    };
  }

  // --- Deprecated tool-name aliases (route old names to the new methods) ---

  async addPrimerAnnotation(params) {
    return this.savePrimer(params);
  }

  async listPrimerAnnotations(params = {}) {
    return this.listPrimers(params);
  }

  async clearPrimerAnnotations(params = {}) {
    return this.deletePrimers(params);
  }

  // --- Private helpers ---

  _getDesigner() {
    if (typeof window !== 'undefined' && window.PrimerDesigner) {
      return window.PrimerDesigner;
    }
    throw new Error('PrimerDesigner is not loaded. Primer tools are unavailable.');
  }

  _getPrimerManager() {
    const manager =
      this.app?.primerManager ||
      this.chatManager?.app?.primerManager ||
      (typeof window !== 'undefined' && window.primerManager);
    if (!manager) {
      throw new Error('PrimerManager is not loaded. Primer persistence is unavailable.');
    }
    return manager;
  }

  _showPrimerTrack(chromosome = null) {
    if (!this.app) return;

    if (this.app.visibleTracks && typeof this.app.visibleTracks.add === 'function') {
      this.app.visibleTracks.add('primers');
    }

    this.app.trackVisibility = this.app.trackVisibility || {};
    this.app.trackVisibility.primers = true;

    const checkbox = typeof document !== 'undefined' ? document.getElementById('trackPrimers') : null;
    if (checkbox && !checkbox.checked) {
      checkbox.checked = true;
    }

    if (typeof this.app.updateTrackVisibilityUI === 'function') {
      this.app.updateTrackVisibilityUI();
    }

    const selectedChr = typeof document !== 'undefined' ? document.getElementById('chromosomeSelect')?.value : null;
    const currentChr = selectedChr || chromosome;
    if (currentChr && this.app.currentSequence?.[currentChr] && typeof this.app.displayGenomeView === 'function') {
      this.app.displayGenomeView(currentChr, this.app.currentSequence[currentChr]);
    }
  }

  _getNumber(value) {
    if (value === undefined || value === null || value === '') return undefined;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  async _resolveTargetSequence(params) {
    if (params.targetSequence) return;

    if (params.geneName) {
      try {
        const genomics = this.chatManager.MicrobeFns || window.MicrobeFns || window.MicrobeGenomicsFunctions;
        if (!genomics || typeof genomics.getCodingSequence !== 'function') {
          throw new Error('MicrobeGenomicsFunctions.getCodingSequence is not available');
        }

        const seqData = await genomics.getCodingSequence(params.geneName);
        if (seqData && seqData.success === false) {
          throw new Error(seqData.message || seqData.error || `Could not find sequence for gene ${params.geneName}`);
        }

        await this._resolveGeneAmpliconSequence(params, seqData);
        return;
      } catch (e) {
        throw new Error(`Failed to lookup sequence for gene ${params.geneName}: ${e.message}`);
      }
    }

    if (params.chromosome && params.start != null && params.end != null) {
      const start = this._getNumber(params.start);
      const end = this._getNumber(params.end);
      if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 1 || end < start) {
        throw new Error('The primer design region requires 1-based genomic coordinates with start at or before end');
      }
      const seq = await this.chatManager.getSequence({
        chromosome: params.chromosome,
        start,
        end,
      });
      if (seq && seq.sequence) {
        params.targetSequence = seq.sequence;
        params.targetMetadata = {
          source: 'region',
          chromosome: params.chromosome,
          regionStart: start,
          regionEnd: start + seq.sequence.length - 1,
          inputSequenceOrientation: 'genomic forward strand',
        };
        return;
      }
      throw new Error('Failed to retrieve sequence for the specified genomic region');
    }

    throw new Error('targetSequence is required if no geneName or region is specified');
  }

  async _resolveGeneAmpliconSequence(params, seqData) {
    const Designer = this._getDesigner();
    const useAmpliconContext = this._shouldUseGeneAmpliconContext(params);
    const upstreamBp = this._getRequestedUpstreamBp(params);
    const downstreamBp = this._getRequestedDownstreamBp(params);
    const needsFlankingSequence = upstreamBp > 0 || downstreamBp > 0;
    const upstreamPrimerBuffer = this._getNonNegativeInteger(
      params.upstreamPrimerBuffer,
      needsFlankingSequence ? 75 : 0
    );
    const downstreamPrimerBuffer = this._getNonNegativeInteger(
      params.downstreamPrimerBuffer,
      needsFlankingSequence ? 75 : 0
    );

    const chromosome = seqData?.chromosome;
    const geneStart = parseInt(seqData?.start, 10);
    const geneEnd = parseInt(seqData?.end, 10);
    const isReverse = seqData?.strand === '-' || seqData?.strand === -1;

    if (!chromosome || !Number.isFinite(geneStart) || !Number.isFinite(geneEnd)) {
      throw new Error(`Gene ${params.geneName} was found, but chromosome/start/end metadata were unavailable`);
    }

    const chromosomeLength = this._getChromosomeLength(chromosome);
    let regionStart;
    let regionEnd;
    let requiredAmpliconStart;
    let requiredAmpliconEnd;
    let availableUpstreamBp;
    let availableDownstreamBp;

    if (isReverse) {
      const requestedRequiredStart = geneStart - downstreamBp;
      const requestedRequiredEnd = geneEnd + upstreamBp;
      const requiredGenomicStart = Math.max(1, requestedRequiredStart);
      const requiredGenomicEnd = chromosomeLength
        ? Math.min(chromosomeLength, requestedRequiredEnd)
        : requestedRequiredEnd;

      regionStart = Math.max(1, requiredGenomicStart - downstreamPrimerBuffer);
      regionEnd = requiredGenomicEnd + upstreamPrimerBuffer;
      if (chromosomeLength) regionEnd = Math.min(chromosomeLength, regionEnd);

      requiredAmpliconStart = Math.max(0, regionEnd - requiredGenomicEnd);
      requiredAmpliconEnd = regionEnd - requiredGenomicStart + 1;
      availableUpstreamBp = Math.max(0, requiredGenomicEnd - geneEnd);
      availableDownstreamBp = Math.max(0, geneStart - requiredGenomicStart);
    } else {
      const requestedRequiredStart = geneStart - upstreamBp;
      const requestedRequiredEnd = geneEnd + downstreamBp;
      const requiredGenomicStart = Math.max(1, requestedRequiredStart);
      const requiredGenomicEnd = chromosomeLength
        ? Math.min(chromosomeLength, requestedRequiredEnd)
        : requestedRequiredEnd;

      regionStart = Math.max(1, requiredGenomicStart - upstreamPrimerBuffer);
      regionEnd = requiredGenomicEnd + downstreamPrimerBuffer;
      if (chromosomeLength) regionEnd = Math.min(chromosomeLength, regionEnd);

      requiredAmpliconStart = Math.max(0, requiredGenomicStart - regionStart);
      requiredAmpliconEnd = requiredGenomicEnd - regionStart + 1;
      availableUpstreamBp = Math.max(0, geneStart - requiredGenomicStart);
      availableDownstreamBp = Math.max(0, requiredGenomicEnd - geneEnd);
    }

    if (useAmpliconContext) {
      const seq = await this.chatManager.getSequence({ chromosome, start: regionStart, end: regionEnd });
      if (!seq?.sequence) {
        throw new Error(`Failed to retrieve strand-aware amplicon sequence for gene ${params.geneName}`);
      }
      params.targetSequence = isReverse ? Designer.reverseComplement(seq.sequence) : seq.sequence;
      params.requiredAmpliconStart = requiredAmpliconStart;
      params.requiredAmpliconEnd = requiredAmpliconEnd;
    } else {
      params.targetSequence = seqData.dnaSequence || seqData.codingSequence || seqData.sequence;
      if (!params.targetSequence) {
        throw new Error(`Could not find sequence for gene ${params.geneName}`);
      }
    }
    params.targetMetadata = {
      source: 'geneName',
      geneName: seqData.geneName || params.geneName,
      locusTag: seqData.locusTag,
      chromosome,
      geneStart,
      geneEnd,
      geneStrand: isReverse ? '-' : '+',
      inputSequenceOrientation: isReverse ? 'gene-oriented reverse complement' : 'genomic forward strand',
      regionStart,
      regionEnd,
      requestedUpstreamBp: upstreamBp,
      requestedDownstreamBp: downstreamBp,
      availableUpstreamBp,
      availableDownstreamBp,
      upstreamPrimerBuffer,
      downstreamPrimerBuffer,
      requiredAmpliconStart: params.requiredAmpliconStart,
      requiredAmpliconEnd: params.requiredAmpliconEnd,
    };
  }

  async _resolveTemplateSequence(params) {
    if (params.templateSequence) return;

    if (params.chromosome) {
      try {
        const seqData = await this.chatManager.getSequence({
          chromosome: params.chromosome,
          start: params.start || 1,
          end: params.end,
        });
        if (seqData && seqData.sequence) {
          params.templateSequence = seqData.sequence;
          params.sequenceOffset = params.start || 1;
          return;
        }
      } catch (e) {
        throw new Error('Failed to load chromosome sequence as template');
      }
    }

    const state = this.chatManager.getCurrentState();
    if (state && state.currentChromosome) {
      const padding = 5000;
      const seqStart = Math.max(1, (state.viewingRegion?.start || 1) - padding);
      const seqEnd = (state.viewingRegion?.end || seqStart + 10000) + padding;
      const seqData = await this.chatManager.getSequence({
        chromosome: state.currentChromosome,
        start: seqStart,
        end: seqEnd,
      });
      if (seqData && seqData.sequence) {
        params.templateSequence = seqData.sequence;
        params.sequenceOffset = seqStart;
        return;
      }
      throw new Error('No template sequence provided and could not retrieve current region automatically');
    }

    throw new Error('templateSequence is required since no genomic region is currently loaded');
  }

  _decoratePrimerPair(pair, metadata) {
    const forwardBinding = this._mapOrientedBindingToGenome(
      pair.forward.bindStart,
      pair.forward.bindEnd,
      metadata,
      'forward'
    );
    const reverseBinding = this._mapOrientedBindingToGenome(
      pair.reverse.bindStart,
      pair.reverse.bindEnd,
      metadata,
      'reverse'
    );

    const productStart = Math.min(forwardBinding.genomicStart, reverseBinding.genomicStart);
    const productEnd = Math.max(forwardBinding.genomicEnd, reverseBinding.genomicEnd);
    const mappedPair = {
      ...pair,
      forward: { ...pair.forward, ...forwardBinding },
      reverse: { ...pair.reverse, ...reverseBinding },
      target: { ...metadata, productStart, productEnd },
    };
    if (metadata.source !== 'geneName') return mappedPair;

    const upstreamIncludedBp =
      metadata.geneStrand === '-'
        ? Math.max(0, productEnd - metadata.geneEnd)
        : Math.max(0, metadata.geneStart - productStart);
    const downstreamIncludedBp =
      metadata.geneStrand === '-'
        ? Math.max(0, metadata.geneStart - productStart)
        : Math.max(0, productEnd - metadata.geneEnd);
    const coversGene = productStart <= metadata.geneStart && productEnd >= metadata.geneEnd;
    const coversRequestedUpstream = upstreamIncludedBp >= metadata.requestedUpstreamBp;
    const coversRequestedDownstream = downstreamIncludedBp >= metadata.requestedDownstreamBp;

    const warnings = [];
    if (metadata.availableUpstreamBp < metadata.requestedUpstreamBp) {
      warnings.push(
        `Only ${metadata.availableUpstreamBp}bp upstream sequence is available before the chromosome boundary; ` +
          `requested ${metadata.requestedUpstreamBp}bp.`
      );
    }
    if (metadata.availableDownstreamBp < metadata.requestedDownstreamBp) {
      warnings.push(
        `Only ${metadata.availableDownstreamBp}bp downstream sequence is available before the chromosome boundary; ` +
          `requested ${metadata.requestedDownstreamBp}bp.`
      );
    }
    if (!coversRequestedUpstream) {
      warnings.push(
        `Primer pair includes ${upstreamIncludedBp}bp upstream of ${metadata.geneName}; ` +
          `requested ${metadata.requestedUpstreamBp}bp.`
      );
    }
    if (!coversRequestedDownstream) {
      warnings.push(
        `Primer pair includes ${downstreamIncludedBp}bp downstream of ${metadata.geneName}; ` +
          `requested ${metadata.requestedDownstreamBp}bp.`
      );
    }
    if (!coversGene) {
      warnings.push('Primer pair does not fully cover the annotated gene interval.');
    }

    Object.assign(mappedPair.target, {
      upstreamIncludedBp,
      downstreamIncludedBp,
      coversRequestedUpstream,
      coversRequestedDownstream,
      coversGene,
    });
    return warnings.length ? { ...mappedPair, warnings } : mappedPair;
  }

  _mapOrientedBindingToGenome(bindStart, bindEnd, metadata, primerType) {
    if (metadata.geneStrand === '-') {
      return {
        genomicStart: metadata.regionEnd - bindEnd + 1,
        genomicEnd: metadata.regionEnd - bindStart,
        strand: primerType === 'forward' ? '-' : '+',
      };
    }

    return {
      genomicStart: metadata.regionStart + bindStart,
      genomicEnd: metadata.regionStart + bindEnd - 1,
      strand: primerType === 'forward' ? '+' : '-',
    };
  }

  _getRequestedUpstreamBp(params) {
    return this._getNonNegativeInteger(
      params.upstreamBp ?? params.upstreamBases ?? params.upstream ?? params.upstreamLength,
      0
    );
  }

  _getRequestedDownstreamBp(params) {
    return this._getNonNegativeInteger(
      params.downstreamBp ?? params.downstreamBases ?? params.downstream ?? params.downstreamLength,
      0
    );
  }

  _shouldUseGeneAmpliconContext(params) {
    return (
      this._getRequestedUpstreamBp(params) > 0 ||
      this._getRequestedDownstreamBp(params) > 0 ||
      params.upstreamPrimerBuffer !== undefined ||
      params.downstreamPrimerBuffer !== undefined
    );
  }

  _getDesignOptions(params) {
    const exactPrimerLength = this._getPositiveInteger(
      params.primerLength ?? params.primerLengthBp ?? params.primerSize,
      null
    );
    const minLen = this._getPositiveInteger(
      params.minPrimerLength ?? params.minLen ?? params.minLength,
      exactPrimerLength || 18
    );
    const maxLen = this._getPositiveInteger(
      params.maxPrimerLength ?? params.maxLen ?? params.maxLength,
      exactPrimerLength || 25
    );

    return {
      targetTm: this._getNumberOption(params.targetTm, 60.0),
      tmTolerance: this._getNumberOption(params.tmTolerance, 2.0),
      minLen,
      maxLen,
      minProductSize: this._getPositiveInteger(params.minProductSize, 100),
      maxProductSize: this._getPositiveInteger(params.maxProductSize, undefined),
      minGcContent: this._getNumberOption(params.minGcContent ?? params.minGc, undefined),
      maxGcContent: this._getNumberOption(params.maxGcContent ?? params.maxGc, undefined),
      requireGcClamp: typeof params.requireGcClamp === 'boolean' ? params.requireGcClamp : undefined,
      avoidHairpin: typeof params.avoidHairpin === 'boolean' ? params.avoidHairpin : undefined,
      requiredAmpliconStart: params.requiredAmpliconStart,
      requiredAmpliconEnd: params.requiredAmpliconEnd,
    };
  }

  _getNonNegativeInteger(value, defaultValue) {
    if (value === undefined || value === null || value === '') return defaultValue;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  }

  _getPositiveInteger(value, defaultValue) {
    if (value === undefined || value === null || value === '') return defaultValue;
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultValue;
  }

  _getNumberOption(value, defaultValue) {
    if (value === undefined || value === null || value === '') return defaultValue;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : defaultValue;
  }

  _getChromosomeLength(chromosome) {
    const sequenceSources = [
      this.app?.currentSequence,
      this.chatManager?.app?.currentSequence,
      typeof window !== 'undefined' ? window.genomeBrowser?.currentSequence : null,
    ];

    for (const source of sequenceSources) {
      const seq = source?.[chromosome];
      if (typeof seq === 'string') return seq.length;
    }

    return null;
  }
}

window.PrimerService = PrimerService;
