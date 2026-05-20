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
    const pair = Designer.designPrimerPair(params.targetSequence, options);
    if (!pair) {
      return {error: 'Could not find a valid primer pair meeting the criteria in the given sequence'};
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
          params.maxMismatches || 0,
      ),
    };
    if (result.sites.length > 0 && params.sequenceOffset) {
      const offset = params.sequenceOffset - 1;
      result.sites.forEach((s) => {
        s.start += offset;
        s.end += offset;
      });
    }
    return result;
  }

  // --- add_primer_annotation ---

  async addPrimerAnnotation(params) {
    if (!params.chromosome || !params.start || !params.end || !params.name) {
      throw new Error('Missing required fields for annotation: chromosome, start, end, name');
    }
    const strand = params.strand === '-' || params.strand === -1 ? -1 : 1;
    const result = await this.chatManager.createAnnotation({
      type: 'primer',
      name: params.name,
      chromosome: params.chromosome,
      start: parseInt(params.start),
      end: parseInt(params.end),
      strand,
      description: params.description || `Tm: ${params.tm || '?'}, GC: ${params.gcContent || '?'}%`,
    });

    this._showPrimerTrack(params.chromosome);
    return {
      ...result,
      track: 'primers',
      message: `Added primer "${params.name}" to the Primers track`,
    };
  }

  async listPrimerAnnotations(params = {}) {
    const primers = this._getPrimerAnnotations(params.chromosome)
        .filter(primer => {
          const start = this._getNumber(params.start);
          const end = this._getNumber(params.end);
          if (start !== undefined && primer.end < start) return false;
          if (end !== undefined && primer.start > end) return false;
          return true;
        })
        .map(primer => ({
          id: primer.id,
          name: primer.name || primer.qualifiers?.gene || primer.qualifiers?.label || 'Primer',
          chromosome: primer.chromosome,
          start: primer.start,
          end: primer.end,
          strand: primer.strand === -1 ? '-' : '+',
          description: primer.description || primer.qualifiers?.note || '',
        }));

    return {
      success: true,
      count: primers.length,
      primers,
    };
  }

  async clearPrimerAnnotations(params = {}) {
    const chromosome = params.chromosome;
    const clearAll = params.confirm === true || params.confirm === 'true';
    if (!clearAll) {
      throw new Error('Set confirm=true to clear primer annotations');
    }

    const removed = this._removePrimerAnnotations(chromosome);
    this._showPrimerTrack(chromosome);

    return {
      success: true,
      removed,
      chromosome: chromosome || 'all',
      message: `Removed ${removed} primer annotation${removed === 1 ? '' : 's'}`,
    };
  }

  // --- Private helpers ---

  _getDesigner() {
    if (typeof window !== 'undefined' && window.PrimerDesigner) {
      return window.PrimerDesigner;
    }
    throw new Error('PrimerDesigner is not loaded. Primer tools are unavailable.');
  }

  _getPrimerAnnotations(chromosome = null) {
    const annotationsByChromosome = this.app?.currentAnnotations || {};
    const chromosomes = chromosome ? [chromosome] : Object.keys(annotationsByChromosome);
    const primers = [];

    chromosomes.forEach(chr => {
      const annotations = annotationsByChromosome[chr] || [];
      annotations.forEach(feature => {
        const featureType = String(feature?.type || '').toLowerCase();
        if (featureType === 'primer' || featureType === 'primer_bind') {
          primers.push({
            ...feature,
            chromosome: feature.chromosome || chr,
          });
        }
      });
    });

    return primers;
  }

  _removePrimerAnnotations(chromosome = null) {
    let removed = 0;
    const removeFromCollection = (collection, countRemovals = true) => {
      if (!collection) return;
      const chromosomes = chromosome ? [chromosome] : Object.keys(collection);
      chromosomes.forEach(chr => {
        if (!Array.isArray(collection[chr])) return;
        const before = collection[chr].length;
        collection[chr] = collection[chr].filter(feature => {
          const featureType = String(feature?.type || '').toLowerCase();
          return featureType !== 'primer' && featureType !== 'primer_bind';
        });
        if (countRemovals) {
          removed += before - collection[chr].length;
        }
      });
    };

    removeFromCollection(this.app?.currentAnnotations, true);
    removeFromCollection(this.app?.userDefinedFeatures, false);

    if (this.app && typeof this.app.updateGeneDisplay === 'function') {
      this.app.updateGeneDisplay();
    }

    return removed;
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

        if (this._shouldUseGeneAmpliconContext(params)) {
          await this._resolveGeneAmpliconSequence(params, seqData);
          return;
        }

        const targetSequence = seqData?.dnaSequence || seqData?.codingSequence || seqData?.sequence;
        if (targetSequence) {
          params.targetSequence = targetSequence;
          return;
        }
        throw new Error(`Could not find sequence for gene ${params.geneName}`);
      } catch (e) {
        throw new Error(`Failed to lookup sequence for gene ${params.geneName}: ${e.message}`);
      }
    }

    if (params.chromosome && params.start && params.end) {
      const seq = await this.chatManager.getSequence({
        chromosome: params.chromosome,
        start: params.start,
        end: params.end,
      });
      if (seq && seq.sequence) {
        params.targetSequence = seq.sequence;
        return;
      }
      throw new Error('Failed to retrieve sequence for the specified genomic region');
    }

    throw new Error('targetSequence is required if no geneName or region is specified');
  }

  async _resolveGeneAmpliconSequence(params, seqData) {
    const Designer = this._getDesigner();
    const upstreamBp = this._getRequestedUpstreamBp(params);
    const downstreamBp = this._getRequestedDownstreamBp(params);
    const needsFlankingSequence = upstreamBp > 0 || downstreamBp > 0;
    const upstreamPrimerBuffer = this._getNonNegativeInteger(
        params.upstreamPrimerBuffer,
        needsFlankingSequence ? 75 : 0,
    );
    const downstreamPrimerBuffer = this._getNonNegativeInteger(
        params.downstreamPrimerBuffer,
        needsFlankingSequence ? 75 : 0,
    );

    const chromosome = seqData.chromosome;
    const geneStart = parseInt(seqData.start, 10);
    const geneEnd = parseInt(seqData.end, 10);
    const isReverse = seqData.strand === '-' || seqData.strand === -1;

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
      const requiredGenomicEnd = chromosomeLength ?
        Math.min(chromosomeLength, requestedRequiredEnd) :
        requestedRequiredEnd;

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
      const requiredGenomicEnd = chromosomeLength ?
        Math.min(chromosomeLength, requestedRequiredEnd) :
        requestedRequiredEnd;

      regionStart = Math.max(1, requiredGenomicStart - upstreamPrimerBuffer);
      regionEnd = requiredGenomicEnd + downstreamPrimerBuffer;
      if (chromosomeLength) regionEnd = Math.min(chromosomeLength, regionEnd);

      requiredAmpliconStart = Math.max(0, requiredGenomicStart - regionStart);
      requiredAmpliconEnd = requiredGenomicEnd - regionStart + 1;
      availableUpstreamBp = Math.max(0, geneStart - requiredGenomicStart);
      availableDownstreamBp = Math.max(0, requiredGenomicEnd - geneEnd);
    }

    const seq = await this.chatManager.getSequence({
      chromosome,
      start: regionStart,
      end: regionEnd,
    });
    if (!seq || !seq.sequence) {
      throw new Error(`Failed to retrieve strand-aware amplicon sequence for gene ${params.geneName}`);
    }

    params.targetSequence = isReverse ? Designer.reverseComplement(seq.sequence) : seq.sequence;
    params.requiredAmpliconStart = requiredAmpliconStart;
    params.requiredAmpliconEnd = requiredAmpliconEnd;
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
      requiredAmpliconStart,
      requiredAmpliconEnd,
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
        'forward',
    );
    const reverseBinding = this._mapOrientedBindingToGenome(
        pair.reverse.bindStart,
        pair.reverse.bindEnd,
        metadata,
        'reverse',
    );

    const productStart = Math.min(forwardBinding.genomicStart, reverseBinding.genomicStart);
    const productEnd = Math.max(forwardBinding.genomicEnd, reverseBinding.genomicEnd);
    const upstreamIncludedBp = metadata.geneStrand === '-' ?
      Math.max(0, productEnd - metadata.geneEnd) :
      Math.max(0, metadata.geneStart - productStart);
    const downstreamIncludedBp = metadata.geneStrand === '-' ?
      Math.max(0, metadata.geneStart - productStart) :
      Math.max(0, productEnd - metadata.geneEnd);
    const coversGene = productStart <= metadata.geneStart && productEnd >= metadata.geneEnd;
    const coversRequestedUpstream = upstreamIncludedBp >= metadata.requestedUpstreamBp;
    const coversRequestedDownstream = downstreamIncludedBp >= metadata.requestedDownstreamBp;

    const warnings = [];
    if (metadata.availableUpstreamBp < metadata.requestedUpstreamBp) {
      warnings.push(
          `Only ${metadata.availableUpstreamBp}bp upstream sequence is available before the chromosome boundary; ` +
          `requested ${metadata.requestedUpstreamBp}bp.`,
      );
    }
    if (metadata.availableDownstreamBp < metadata.requestedDownstreamBp) {
      warnings.push(
          `Only ${metadata.availableDownstreamBp}bp downstream sequence is available before the chromosome boundary; ` +
          `requested ${metadata.requestedDownstreamBp}bp.`,
      );
    }
    if (!coversRequestedUpstream) {
      warnings.push(
          `Primer pair includes ${upstreamIncludedBp}bp upstream of ${metadata.geneName}; ` +
          `requested ${metadata.requestedUpstreamBp}bp.`,
      );
    }
    if (!coversRequestedDownstream) {
      warnings.push(
          `Primer pair includes ${downstreamIncludedBp}bp downstream of ${metadata.geneName}; ` +
          `requested ${metadata.requestedDownstreamBp}bp.`,
      );
    }
    if (!coversGene) {
      warnings.push('Primer pair does not fully cover the annotated gene interval.');
    }

    return {
      ...pair,
      forward: {
        ...pair.forward,
        ...forwardBinding,
      },
      reverse: {
        ...pair.reverse,
        ...reverseBinding,
      },
      target: {
        ...metadata,
        productStart,
        productEnd,
        upstreamIncludedBp,
        downstreamIncludedBp,
        coversRequestedUpstream,
        coversRequestedDownstream,
        coversGene,
      },
      warnings: warnings.length > 0 ? warnings : undefined,
    };
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
        0,
    );
  }

  _getRequestedDownstreamBp(params) {
    return this._getNonNegativeInteger(
        params.downstreamBp ?? params.downstreamBases ?? params.downstream ?? params.downstreamLength,
        0,
    );
  }

  _shouldUseGeneAmpliconContext(params) {
    return this._getRequestedUpstreamBp(params) > 0 ||
      this._getRequestedDownstreamBp(params) > 0 ||
      params.upstreamPrimerBuffer !== undefined ||
      params.downstreamPrimerBuffer !== undefined;
  }

  _getDesignOptions(params) {
    const exactPrimerLength = this._getPositiveInteger(
        params.primerLength ?? params.primerLengthBp ?? params.primerSize,
        null,
    );
    const minLen = this._getPositiveInteger(
        params.minPrimerLength ?? params.minLen ?? params.minLength,
        exactPrimerLength || 18,
    );
    const maxLen = this._getPositiveInteger(
        params.maxPrimerLength ?? params.maxLen ?? params.maxLength,
        exactPrimerLength || 25,
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
