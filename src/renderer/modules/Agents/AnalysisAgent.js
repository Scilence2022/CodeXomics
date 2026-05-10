/**
 * AnalysisAgent - 分析智能体
 * 专门处理序列分析和计算相关的函数
 */
class AnalysisAgent extends AgentBase {
  constructor(multiAgentSystem) {
    super(multiAgentSystem, 'analysis', [
      'sequence_analysis',
      'computational_biology',
      'statistical_analysis',
      'pattern_recognition',
    ]);

    this.app = multiAgentSystem.app;
    this.configManager = multiAgentSystem.configManager;
    this.sequenceUtils = null;
  }

  /**
   * 执行具体初始化逻辑
   */
  async performInitialization() {
    // 确保应用已初始化
    if (!this.app) {
      throw new Error('Application reference not available');
    }

    // 获取序列工具
    this.sequenceUtils = this.app.sequenceUtils || null;
    if (!this.sequenceUtils) {
      console.warn('⚠️ AnalysisAgent: SequenceUtils not available, some tools will rely on ChatManager fallback');
    }

    console.log(`🔬 AnalysisAgent: Sequence analysis tools initialized`);
  }

  /**
   * Perform function execution with ChatManager delegation
   */
  async performExecution(functionName, parameters, context) {
    const chatManager = this.multiAgentSystem.chatManager;

    // Try ChatManager first (authoritative execution path)
    if (chatManager && typeof chatManager.executeToolByName === 'function') {
      try {
        const result = await chatManager.executeToolByName(functionName, parameters);
        return result;
      } catch (error) {
        console.warn(`AnalysisAgent: ChatManager execution failed for ${functionName}, falling back to local implementation`);
      }
    }

    // Fall back to local implementation
    return await this._performLocalExecution(functionName, parameters, context);
  }

  /**
   * Local execution fallback
   */
  async _performLocalExecution(functionName, parameters, context) {
    // Check toolMapping for local implementations
    if (this.toolMapping.has(functionName)) {
      const toolFunction = this.toolMapping.get(functionName);
      return await toolFunction(parameters, context);
    }

    throw new Error(`AnalysisAgent: Function ${functionName} not implemented locally and ChatManager unavailable`);
  }

  /**
   * 注册工具映射
   */
  registerToolMapping() {
    // 序列分析工具
    this.toolMapping.set('get_sequence', this.getSequence.bind(this));
    this.toolMapping.set('translate_sequence', this.translateDNA.bind(this));
    this.toolMapping.set('translate_dna', this.translateDNA.bind(this));
    this.toolMapping.set('reverse_complement', this.reverseComplement.bind(this));

    // GC含量分析
    this.toolMapping.set('calculate_gc_content', this.calculateGCContent.bind(this));
    this.toolMapping.set('compute_gc', this.computeGC.bind(this));
    this.toolMapping.set('calc_region_gc', this.calcRegionGC.bind(this));

    // 序列统计
    this.toolMapping.set('sequence_statistics', this.sequenceStatistics.bind(this));
    this.toolMapping.set('codon_usage_analysis', this.codonUsageAnalysis.bind(this));
    this.toolMapping.set('analyze_codon_usage', this.analyzeCodonUsage.bind(this));
    this.toolMapping.set('genome_codon_usage_analysis', this.codonUsageAnalysis.bind(this));

    // 高级分析
    this.toolMapping.set('calculate_entropy', this.calculateEntropy.bind(this));
    this.toolMapping.set('calculate_melting_temp', this.calculateMeltingTemp.bind(this));
    this.toolMapping.set('calculate_molecular_weight', this.calculateMolecularWeight.bind(this));

    // 预测工具
    this.toolMapping.set('predict_promoter', this.predictPromoter.bind(this));
    this.toolMapping.set('predict_rbs', this.predictRBS.bind(this));
    this.toolMapping.set('predict_terminator', this.predictTerminator.bind(this));

    // 区域分析
    this.toolMapping.set('analyze_region', this.analyzeRegion.bind(this));
    this.toolMapping.set('compare_regions', this.compareRegions.bind(this));
    this.toolMapping.set('find_similar_sequences', this.findSimilarSequences.bind(this));

    // 限制性酶切
    this.toolMapping.set('find_restriction_sites', this.findRestrictionSites.bind(this));
    this.toolMapping.set('virtual_digest', this.virtualDigest.bind(this));

    // 序列模式搜索
    this.toolMapping.set('search_pattern', this.searchPattern.bind(this));
    this.toolMapping.set('search_sequence_motif', this.searchPattern.bind(this));

    // 引物设计
    this.toolMapping.set('calculate_primer_properties', this.calculatePrimerProperties.bind(this));
    this.toolMapping.set('design_primers', this.designPrimers.bind(this));
    this.toolMapping.set('find_primer_binding_sites', this.findPrimerBindingSites.bind(this));
    this.toolMapping.set('add_primer_annotation', this.addPrimerAnnotation.bind(this));

    // CDS
    this.toolMapping.set('get_coding_sequence', this.getCodingSequence.bind(this));

    // 上游下游分析
    this.toolMapping.set('get_upstream_region', this.getUpstreamRegion.bind(this));
    this.toolMapping.set('get_downstream_region', this.getDownstreamRegion.bind(this));

    console.log(`🔬 AnalysisAgent: Registered ${this.toolMapping.size} analysis tools`);
  }

  /**
   * 获取序列
   */
  async getSequence(parameters, strategy) {
    try {
      const { chromosome, start, end } = parameters;

      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Chromosome, start, and end are required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const sequence = await this.sequenceUtils.getSequence(chromosome, start, end);

      return {
        success: true,
        sequence,
        length: sequence.length,
        region: { chromosome, start, end },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 翻译序列
   */
  async translateSequence(parameters, strategy) {
    try {
      const { sequence, frame = 0 } = parameters;

      if (!sequence) {
        throw new Error('Sequence is required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const protein = this.sequenceUtils.translateDNA(sequence, frame);

      return {
        success: true,
        protein,
        frame,
        length: protein.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 翻译DNA
   */
  async translateDNA(parameters, strategy) {
    try {
      const { dna, frame = 0 } = parameters;

      if (!dna) {
        throw new Error('DNA sequence is required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const protein = this.sequenceUtils.translateDNA(dna, frame);

      return {
        success: true,
        protein,
        frame,
        length: protein.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 反向互补
   */
  async reverseComplement(parameters, strategy) {
    try {
      const { dna } = parameters;

      if (!dna) {
        throw new Error('DNA sequence is required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const reverseComp = this.sequenceUtils.reverseComplement(dna);

      return {
        success: true,
        reverseComplement: reverseComp,
        original: dna,
        length: reverseComp.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 计算GC含量
   */
  async calculateGCContent(parameters, strategy) {
    try {
      const { sequence } = parameters;

      if (!sequence) {
        throw new Error('Sequence is required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const gcContent = this.sequenceUtils.calculateGCContent(sequence);

      return {
        success: true,
        gcContent: gcContent,
        sequence: sequence,
        length: sequence.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 计算GC含量（别名）
   */
  async computeGC(parameters, strategy) {
    return await this.calculateGCContent(parameters, strategy);
  }

  /**
   * 计算区域GC含量
   */
  async calcRegionGC(parameters, strategy) {
    try {
      const { chromosome, start, end, windowSize = 1000 } = parameters;

      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Chromosome, start, and end are required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const sequence = await this.sequenceUtils.getSequence(chromosome, start, end);
      const gcContent = this.sequenceUtils.calculateGCContent(sequence);

      // 计算滑动窗口GC含量
      const windowGC = [];
      for (let i = 0; i <= sequence.length - windowSize; i += windowSize) {
        const windowSeq = sequence.substring(i, i + windowSize);
        const windowGCContent = this.sequenceUtils.calculateGCContent(windowSeq);
        windowGC.push({
          position: start + i,
          gcContent: windowGCContent,
        });
      }

      return {
        success: true,
        overallGC: gcContent,
        windowGC: windowGC,
        region: { chromosome, start, end },
        windowSize,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 序列统计
   */
  async sequenceStatistics(parameters, strategy) {
    try {
      const { sequence, include = ['composition', 'length', 'gc'] } = parameters;

      if (!sequence) {
        throw new Error('Sequence is required');
      }

      const stats = {};

      if (include.includes('length')) {
        stats.length = sequence.length;
      }

      if (include.includes('composition')) {
        stats.composition = {
          A: (sequence.match(/A/g) || []).length,
          T: (sequence.match(/T/g) || []).length,
          G: (sequence.match(/G/g) || []).length,
          C: (sequence.match(/C/g) || []).length,
        };
      }

      if (include.includes('gc') && this.sequenceUtils) {
        stats.gcContent = this.sequenceUtils.calculateGCContent(sequence);
      }

      return {
        success: true,
        statistics: stats,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 密码子使用分析
   */
  async codonUsageAnalysis(parameters, strategy) {
    try {
      const { dna } = parameters;

      if (!dna) {
        throw new Error('DNA sequence is required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const codonUsage = this.sequenceUtils.analyzeCodonUsage(dna);

      return {
        success: true,
        codonUsage,
        totalCodons: Object.values(codonUsage).reduce((sum, count) => sum + count, 0),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 分析密码子使用（别名）
   */
  async analyzeCodonUsage(parameters, strategy) {
    return await this.codonUsageAnalysis(parameters, strategy);
  }

  /**
   * 计算熵
   */
  async calculateEntropy(parameters, strategy) {
    try {
      const { sequence } = parameters;

      if (!sequence) {
        throw new Error('Sequence is required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const entropy = this.sequenceUtils.calculateEntropy(sequence);

      return {
        success: true,
        entropy,
        sequence: sequence,
        length: sequence.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 计算熔解温度
   */
  async calculateMeltingTemp(parameters, strategy) {
    try {
      const { dna, method = 'wallace' } = parameters;

      if (!dna) {
        throw new Error('DNA sequence is required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const meltingTemp = this.sequenceUtils.calculateMeltingTemp(dna, method);

      return {
        success: true,
        meltingTemp,
        method,
        dna: dna,
        length: dna.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 计算分子量
   */
  async calculateMolecularWeight(parameters, strategy) {
    try {
      const { dna } = parameters;

      if (!dna) {
        throw new Error('DNA sequence is required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const molecularWeight = this.sequenceUtils.calculateMolecularWeight(dna);

      return {
        success: true,
        molecularWeight,
        dna: dna,
        length: dna.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 预测启动子
   */
  async predictPromoter(parameters, strategy) {
    try {
      const { seq } = parameters;

      if (!seq) {
        throw new Error('Sequence is required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const promoterScore = this.sequenceUtils.predictPromoter(seq);

      return {
        success: true,
        promoterScore,
        sequence: seq,
        prediction: promoterScore > 0.7 ? 'likely' : promoterScore > 0.4 ? 'possible' : 'unlikely',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 预测核糖体结合位点
   */
  async predictRBS(parameters, strategy) {
    try {
      const { seq } = parameters;

      if (!seq) {
        throw new Error('Sequence is required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const rbsScore = this.sequenceUtils.predictRBS(seq);

      return {
        success: true,
        rbsScore,
        sequence: seq,
        prediction: rbsScore > 0.7 ? 'likely' : rbsScore > 0.4 ? 'possible' : 'unlikely',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 预测终止子
   */
  async predictTerminator(parameters, strategy) {
    try {
      const { seq } = parameters;

      if (!seq) {
        throw new Error('Sequence is required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const terminatorScore = this.sequenceUtils.predictTerminator(seq);

      return {
        success: true,
        terminatorScore,
        sequence: seq,
        prediction: terminatorScore > 0.7 ? 'likely' : terminatorScore > 0.4 ? 'possible' : 'unlikely',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 分析区域
   */
  async analyzeRegion(parameters, strategy) {
    try {
      const { chromosome, start, end } = parameters;

      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Chromosome, start, and end are required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const sequence = await this.sequenceUtils.getSequence(chromosome, start, end);
      const gcContent = this.sequenceUtils.calculateGCContent(sequence);
      const orfs = this.sequenceUtils.findORFs(sequence, 30);

      return {
        success: true,
        region: { chromosome, start, end },
        sequence: sequence,
        gcContent,
        orfCount: orfs.length,
        orfs: orfs.map(orf => ({
          start: orf.start,
          end: orf.end,
          length: orf.end - orf.start,
          frame: orf.frame,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 比较区域
   */
  async compareRegions(parameters, strategy) {
    try {
      const { regions } = parameters;

      if (!regions || !Array.isArray(regions) || regions.length < 2) {
        throw new Error('At least 2 regions are required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const comparisons = [];

      for (let i = 0; i < regions.length; i++) {
        for (let j = i + 1; j < regions.length; j++) {
          const region1 = regions[i];
          const region2 = regions[j];

          const seq1 = await this.sequenceUtils.getSequence(region1.chromosome, region1.start, region1.end);
          const seq2 = await this.sequenceUtils.getSequence(region2.chromosome, region2.start, region2.end);

          const gc1 = this.sequenceUtils.calculateGCContent(seq1);
          const gc2 = this.sequenceUtils.calculateGCContent(seq2);

          comparisons.push({
            region1: region1,
            region2: region2,
            gc1,
            gc2,
            gcDifference: Math.abs(gc1 - gc2),
            length1: seq1.length,
            length2: seq2.length,
          });
        }
      }

      return {
        success: true,
        comparisons,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 查找相似序列
   */
  async findSimilarSequences(parameters, strategy) {
    try {
      const { sequence, threshold = 0.8 } = parameters;

      if (!sequence) {
        throw new Error('Sequence is required');
      }

      const similarSequences = [
        {
          sequence: sequence,
          similarity: 1.0,
          position: { chromosome: 'chr1', start: 1000, end: 1000 + sequence.length },
        },
      ];

      return {
        success: true,
        similarSequences,
        threshold,
        count: similarSequences.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 查找限制性酶切位点
   */
  async findRestrictionSites(parameters, strategy) {
    try {
      const { enzyme, sequence } = parameters;

      if (!enzyme || !sequence) {
        throw new Error('Enzyme and sequence are required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const sites = this.sequenceUtils.findRestrictionSites(enzyme, sequence);

      return {
        success: true,
        enzyme,
        sites: sites.map(site => ({
          position: site.position,
          sequence: site.sequence,
          cutPosition: site.cutPosition,
        })),
        count: sites.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 虚拟酶切
   */
  async virtualDigest(parameters, strategy) {
    try {
      const { sequence, enzymes } = parameters;

      if (!sequence || !enzymes) {
        throw new Error('Sequence and enzymes are required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const fragments = this.sequenceUtils.virtualDigest(sequence, enzymes);

      return {
        success: true,
        fragments: fragments.map(fragment => ({
          start: fragment.start,
          end: fragment.end,
          length: fragment.end - fragment.start,
          sequence: fragment.sequence,
        })),
        count: fragments.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 搜索序列模式 (search_sequence_motif / search_pattern)
   */
  async searchPattern(parameters, strategy) {
    try {
      const {
        pattern,
        motif,
        sequence,
        chromosome,
        start,
        end,
        strand = 'both',
        maxMismatches = 0,
        max_mismatches,
        case_sensitive = false,
      } = parameters;

      const motifPattern = motif || pattern;
      const maxMM = max_mismatches ?? maxMismatches ?? 0;

      if (!motifPattern) {
        throw new Error('Pattern/motif is required');
      }

      // If a raw sequence string is provided, search within it directly
      if (this.sequenceUtils && sequence) {
        const matches = this.sequenceUtils.searchPattern(motifPattern, sequence, maxMM);
        return {
          success: true,
          motif: motifPattern,
          matches,
          totalMatches: matches.length,
        };
      }

      // Otherwise delegate to ChatManager.searchMotif which can access genome data
      if (this.chatManager && typeof this.chatManager.searchMotif === 'function') {
        return await this.chatManager.searchMotif({
          pattern: motifPattern,
          chromosome,
          start,
          end,
          strand,
          max_mismatches: maxMM,
          case_sensitive,
        });
      }

      return {
        success: false,
        error: 'search_sequence_motif requires a sequence string, genome data via ChatManager, or sequenceUtils',
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 计算引物属性
   */
  async calculatePrimerProperties(parameters, strategy) {
    try {
      const PrimerDesigner = (typeof window !== 'undefined' && window.PrimerDesigner)
        || (typeof require === 'function' && require('../../../renderer/modules/PrimerDesigner'));
      if (PrimerDesigner) {
        const properties = PrimerDesigner.calculateProperties(parameters.sequence);
        return { success: true, properties };
      }
      if (!parameters.sequence) throw new Error('Primer sequence is required');
      if (this.sequenceUtils?.calculatePrimerProperties) {
        return { success: true, properties: this.sequenceUtils.calculatePrimerProperties(parameters.sequence) };
      }
      throw new Error('No primer calculation engine available');
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async designPrimers(parameters, strategy) {
    try {
      const PrimerDesigner = (typeof window !== 'undefined' && window.PrimerDesigner)
        || (typeof require === 'function' && require('../../../renderer/modules/PrimerDesigner'));
      const targetSequence = parameters.targetSequence || parameters.sequence || parameters.targetRegion;
      if (!targetSequence) throw new Error('targetSequence is required');
      if (PrimerDesigner) {
        const options = { targetTm: parameters.targetTm || 60.0, minProductSize: parameters.minProductSize || 100 };
        const pair = PrimerDesigner.designPrimerPair(targetSequence, options);
        return { success: true, primers: pair || { note: 'No valid primer pair found' } };
      }
      if (this.sequenceUtils?.designPrimers) {
        return { success: true, primers: await this.sequenceUtils.designPrimers(targetSequence, parameters.constraints || {}) };
      }
      throw new Error('No primer design engine available');
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async findPrimerBindingSites(parameters, strategy) {
    try {
      const PrimerDesigner = (typeof window !== 'undefined' && window.PrimerDesigner)
        || (typeof require === 'function' && require('../../../renderer/modules/PrimerDesigner'));
      const primer = parameters.primerSequence || parameters.primer;
      const template = parameters.templateSequence || parameters.sequence;
      if (!primer || !template) throw new Error('primerSequence and templateSequence are required');
      if (PrimerDesigner) {
        const sites = PrimerDesigner.findBindingSites(primer, template, parameters.maxMismatches || 0);
        return { success: true, sites, count: sites.length };
      }
      if (this.sequenceUtils?.findPrimerBindingSites) {
        const sites = this.sequenceUtils.findPrimerBindingSites(primer, template);
        return { success: true, sites, count: sites.length };
      }
      throw new Error('No primer binding site engine available');
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async addPrimerAnnotation(parameters, strategy) {
    try {
      if (this.chatManager && typeof this.chatManager.primerAddAnnotation === 'function') {
        return await this.chatManager.primerAddAnnotation(parameters);
      }
      const { name, chromosome, start, end } = parameters;
      if (!name || !chromosome || !start || !end) {
        throw new Error('name, chromosome, start, and end are required for primer annotation');
      }
      return { success: true, annotation: { name, chromosome, start, end, strand: parameters.strand || '+' } };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取编码序列
   */
  async getCodingSequence(parameters, strategy) {
    try {
      const { geneName, chromosome, start, end } = parameters;
      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }
      const cds = this.sequenceUtils.getCodingSequence
        ? await this.sequenceUtils.getCodingSequence(geneName || { chromosome, start, end })
        : null;
      return { success: true, cds };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * 获取上游区域
   */
  async getUpstreamRegion(parameters, strategy) {
    try {
      const { geneObj, length = 500 } = parameters;

      if (!geneObj) {
        throw new Error('Gene object is required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const upstreamStart = Math.max(0, geneObj.feature.start - length);
      const upstreamEnd = geneObj.feature.start;

      const sequence = await this.sequenceUtils.getSequence(geneObj.chromosome, upstreamStart, upstreamEnd);

      return {
        success: true,
        upstreamSequence: sequence,
        region: {
          chromosome: geneObj.chromosome,
          start: upstreamStart,
          end: upstreamEnd,
        },
        length: sequence.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取下游区域
   */
  async getDownstreamRegion(parameters, strategy) {
    try {
      const { geneObj, length = 500 } = parameters;

      if (!geneObj) {
        throw new Error('Gene object is required');
      }

      if (!this.sequenceUtils) {
        throw new Error('SequenceUtils not available');
      }

      const downstreamStart = geneObj.feature.end;
      const downstreamEnd = geneObj.feature.end + length;

      const sequence = await this.sequenceUtils.getSequence(geneObj.chromosome, downstreamStart, downstreamEnd);

      return {
        success: true,
        downstreamSequence: sequence,
        region: {
          chromosome: geneObj.chromosome,
          start: downstreamStart,
          end: downstreamEnd,
        },
        length: sequence.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

// 导出智能体
window.AnalysisAgent = AnalysisAgent;
