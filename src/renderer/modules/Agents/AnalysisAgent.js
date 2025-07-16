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
            'pattern_recognition'
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
        this.sequenceUtils = this.app.sequenceUtils;
        if (!this.sequenceUtils) {
            throw new Error('SequenceUtils not available');
        }
        
        console.log(`🔬 AnalysisAgent: Sequence analysis tools initialized`);
    }
    
    /**
     * 注册工具映射
     */
    registerToolMapping() {
        // 序列分析工具
        this.toolMapping.set('get_sequence', this.getSequence.bind(this));
        this.toolMapping.set('translate_sequence', this.translateSequence.bind(this));
        this.toolMapping.set('translate_dna', this.translateDNA.bind(this));
        this.toolMapping.set('reverse_complement', this.reverseComplement.bind(this));
        this.toolMapping.set('find_orfs', this.findORFs.bind(this));
        
        // GC含量分析
        this.toolMapping.set('calculate_gc_content', this.calculateGCContent.bind(this));
        this.toolMapping.set('compute_gc', this.computeGC.bind(this));
        this.toolMapping.set('calc_region_gc', this.calcRegionGC.bind(this));
        
        // 序列统计
        this.toolMapping.set('sequence_statistics', this.sequenceStatistics.bind(this));
        this.toolMapping.set('codon_usage_analysis', this.codonUsageAnalysis.bind(this));
        this.toolMapping.set('analyze_codon_usage', this.analyzeCodonUsage.bind(this));
        
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
            
            const sequence = await this.sequenceUtils.getSequence(chromosome, start, end);
            
            return {
                success: true,
                sequence,
                length: sequence.length,
                region: { chromosome, start, end }
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const protein = this.sequenceUtils.translateDNA(sequence, frame);
            
            return {
                success: true,
                protein,
                frame,
                length: protein.length
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const protein = this.sequenceUtils.translateDNA(dna, frame);
            
            return {
                success: true,
                protein,
                frame,
                length: protein.length
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const reverseComp = this.sequenceUtils.reverseComplement(dna);
            
            return {
                success: true,
                reverseComplement: reverseComp,
                original: dna,
                length: reverseComp.length
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
    
    /**
     * 查找开放阅读框
     */
    async findORFs(parameters, strategy) {
        try {
            const { dna, minLength = 30 } = parameters;
            
            if (!dna) {
                throw new Error('DNA sequence is required');
            }
            
            const orfs = this.sequenceUtils.findORFs(dna, minLength);
            
            return {
                success: true,
                orfs: orfs.map(orf => ({
                    start: orf.start,
                    end: orf.end,
                    length: orf.end - orf.start,
                    frame: orf.frame,
                    sequence: orf.sequence,
                    protein: orf.protein
                })),
                count: orfs.length
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const gcContent = this.sequenceUtils.calculateGCContent(sequence);
            
            return {
                success: true,
                gcContent: gcContent,
                sequence: sequence,
                length: sequence.length
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const sequence = await this.sequenceUtils.getSequence(chromosome, start, end);
            const gcContent = this.sequenceUtils.calculateGCContent(sequence);
            
            // 计算滑动窗口GC含量
            const windowGC = [];
            for (let i = 0; i <= sequence.length - windowSize; i += windowSize) {
                const windowSeq = sequence.substring(i, i + windowSize);
                const windowGCContent = this.sequenceUtils.calculateGCContent(windowSeq);
                windowGC.push({
                    position: start + i,
                    gcContent: windowGCContent
                });
            }
            
            return {
                success: true,
                overallGC: gcContent,
                windowGC: windowGC,
                region: { chromosome, start, end },
                windowSize
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
                    C: (sequence.match(/C/g) || []).length
                };
            }
            
            if (include.includes('gc')) {
                stats.gcContent = this.sequenceUtils.calculateGCContent(sequence);
            }
            
            return {
                success: true,
                statistics: stats
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const codonUsage = this.sequenceUtils.analyzeCodonUsage(dna);
            
            return {
                success: true,
                codonUsage,
                totalCodons: Object.values(codonUsage).reduce((sum, count) => sum + count, 0)
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const entropy = this.sequenceUtils.calculateEntropy(sequence);
            
            return {
                success: true,
                entropy,
                sequence: sequence,
                length: sequence.length
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const meltingTemp = this.sequenceUtils.calculateMeltingTemp(dna, method);
            
            return {
                success: true,
                meltingTemp,
                method,
                dna: dna,
                length: dna.length
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const molecularWeight = this.sequenceUtils.calculateMolecularWeight(dna);
            
            return {
                success: true,
                molecularWeight,
                dna: dna,
                length: dna.length
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const promoterScore = this.sequenceUtils.predictPromoter(seq);
            
            return {
                success: true,
                promoterScore,
                sequence: seq,
                prediction: promoterScore > 0.7 ? 'likely' : promoterScore > 0.4 ? 'possible' : 'unlikely'
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const rbsScore = this.sequenceUtils.predictRBS(seq);
            
            return {
                success: true,
                rbsScore,
                sequence: seq,
                prediction: rbsScore > 0.7 ? 'likely' : rbsScore > 0.4 ? 'possible' : 'unlikely'
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const terminatorScore = this.sequenceUtils.predictTerminator(seq);
            
            return {
                success: true,
                terminatorScore,
                sequence: seq,
                prediction: terminatorScore > 0.7 ? 'likely' : terminatorScore > 0.4 ? 'possible' : 'unlikely'
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
                    frame: orf.frame
                }))
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
                        length2: seq2.length
                    });
                }
            }
            
            return {
                success: true,
                comparisons
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            // 这里需要实现序列相似性搜索
            // 暂时返回模拟结果
            const similarSequences = [
                {
                    sequence: sequence,
                    similarity: 1.0,
                    position: { chromosome: 'chr1', start: 1000, end: 1000 + sequence.length }
                }
            ];
            
            return {
                success: true,
                similarSequences,
                threshold,
                count: similarSequences.length
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const sites = this.sequenceUtils.findRestrictionSites(enzyme, sequence);
            
            return {
                success: true,
                enzyme,
                sites: sites.map(site => ({
                    position: site.position,
                    sequence: site.sequence,
                    cutPosition: site.cutPosition
                })),
                count: sites.length
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const fragments = this.sequenceUtils.virtualDigest(sequence, enzymes);
            
            return {
                success: true,
                fragments: fragments.map(fragment => ({
                    start: fragment.start,
                    end: fragment.end,
                    length: fragment.end - fragment.start,
                    sequence: fragment.sequence
                })),
                count: fragments.length
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
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
            
            const upstreamStart = Math.max(0, geneObj.feature.start - length);
            const upstreamEnd = geneObj.feature.start;
            
            const sequence = await this.sequenceUtils.getSequence(geneObj.chromosome, upstreamStart, upstreamEnd);
            
            return {
                success: true,
                upstreamSequence: sequence,
                region: {
                    chromosome: geneObj.chromosome,
                    start: upstreamStart,
                    end: upstreamEnd
                },
                length: sequence.length
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
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
            
            const downstreamStart = geneObj.feature.end;
            const downstreamEnd = geneObj.feature.end + length;
            
            const sequence = await this.sequenceUtils.getSequence(geneObj.chromosome, downstreamStart, downstreamEnd);
            
            return {
                success: true,
                downstreamSequence: sequence,
                region: {
                    chromosome: geneObj.chromosome,
                    start: downstreamStart,
                    end: downstreamEnd
                },
                length: sequence.length
            };
            
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }
}

// 导出智能体
window.AnalysisAgent = AnalysisAgent; 