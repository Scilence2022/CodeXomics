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
    const options = {
      targetTm: params.targetTm || 60.0,
      minProductSize: params.minProductSize || 100,
    };
    const pair = Designer.designPrimerPair(params.targetSequence, options);
    return pair || { error: 'Could not find a valid primer pair meeting the criteria in the given sequence' };
  }

  // --- find_primer_binding_sites ---

  async findPrimerBindingSites(params) {
    await this._resolveTemplateSequence(params);
    const Designer = this._getDesigner();
    const result = {
      queryLength: params.primerSequence.length,
      sites: Designer.findBindingSites(
        params.primerSequence,
        params.templateSequence,
        params.maxMismatches || 0
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
    const strand = params.strand === '-' ? -1 : 1;
    return await this.chatManager.createAnnotation({
      type: 'primer',
      name: params.name,
      chromosome: params.chromosome,
      start: parseInt(params.start),
      end: parseInt(params.end),
      strand,
      description: params.description || `Tm: ${params.tm || '?'}, GC: ${params.gcContent || '?'}%`,
    });
  }

  // --- Private helpers ---

  _getDesigner() {
    if (typeof window !== 'undefined' && window.PrimerDesigner) {
      return window.PrimerDesigner;
    }
    throw new Error('PrimerDesigner is not loaded. Primer tools are unavailable.');
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
}

window.PrimerService = PrimerService;
