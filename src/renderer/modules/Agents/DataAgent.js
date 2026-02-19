/**
 * DataAgent - 数据智能体
 * 专门处理数据检索和存储相关的函数
 */
class DataAgent extends AgentBase {
  constructor(multiAgentSystem) {
    super(multiAgentSystem, 'data', ['data_retrieval', 'data_storage', 'data_export', 'data_import']);

    this.app = multiAgentSystem.app;
    this.configManager = multiAgentSystem.configManager;
    this.storageManager = null;
  }

  /**
   * 执行具体初始化逻辑
   */
  async performInitialization() {
    // 确保应用已初始化
    if (!this.app) {
      throw new Error('Application reference not available');
    }

    // 获取存储管理器
    this.storageManager = this.app.storageManager;
    if (!this.storageManager) {
      throw new Error('StorageManager not available');
    }

    console.log(`💾 DataAgent: Data management tools initialized`);
  }

  /**
   * 注册工具映射
   */
  registerToolMapping() {
    // 数据检索工具
    this.toolMapping.set('get_sequence_data', this.getSequenceData.bind(this));
    this.toolMapping.set('get_gene_data', this.getGeneData.bind(this));
    this.toolMapping.set('get_annotation_data', this.getAnnotationData.bind(this));
    this.toolMapping.set('get_track_data', this.getTrackData.bind(this));

    // 数据导出工具
    this.toolMapping.set('export_sequence', this.exportSequence.bind(this));
    this.toolMapping.set('export_region', this.exportRegion.bind(this));
    this.toolMapping.set('export_gene_list', this.exportGeneList.bind(this));
    this.toolMapping.set('export_track_data', this.exportTrackData.bind(this));

    // 数据导入工具
    this.toolMapping.set('import_sequence', this.importSequence.bind(this));
    this.toolMapping.set('import_annotation', this.importAnnotation.bind(this));
    this.toolMapping.set('import_track_data', this.importTrackData.bind(this));

    // 数据搜索工具
    this.toolMapping.set('search_genes', this.searchGenes.bind(this));
    this.toolMapping.set('search_sequences', this.searchSequences.bind(this));
    this.toolMapping.set('search_annotations', this.searchAnnotations.bind(this));

    // 数据统计工具
    this.toolMapping.set('get_data_statistics', this.getDataStatistics.bind(this));
    this.toolMapping.set('get_genome_summary', this.getGenomeSummary.bind(this));

    console.log(`💾 DataAgent: Registered ${this.toolMapping.size} data tools`);
  }

  /**
   * 获取序列数据
   */
  async getSequenceData(parameters, strategy) {
    try {
      const { chromosome, start, end, format = 'fasta' } = parameters;

      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Chromosome, start, and end are required');
      }

      const sequence = await this.app.sequenceUtils.getSequence(chromosome, start, end);

      let formattedData;
      switch (format.toLowerCase()) {
        case 'fasta':
          formattedData = `>${chromosome}:${start}-${end}\n${sequence}`;
          break;
        case 'raw':
          formattedData = sequence;
          break;
        case 'json':
          formattedData = {
            chromosome,
            start,
            end,
            sequence,
            length: sequence.length,
          };
          break;
        default:
          throw new Error(`Unsupported format: ${format}`);
      }

      return {
        success: true,
        data: formattedData,
        format,
        region: { chromosome, start, end },
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
   * 获取基因数据
   */
  async getGeneData(parameters, strategy) {
    try {
      const { geneName, includeSequence = false } = parameters;

      if (!geneName) {
        throw new Error('Gene name is required');
      }

      // 获取基因信息
      const geneInfo = await this.app.navigationManager.getGeneInfo(geneName);
      if (!geneInfo) {
        throw new Error(`Gene not found: ${geneName}`);
      }

      const result = {
        name: geneName,
        chromosome: geneInfo.chromosome,
        start: geneInfo.start,
        end: geneInfo.end,
        strand: geneInfo.strand,
        type: geneInfo.type,
        description: geneInfo.description,
      };

      // 如果需要序列
      if (includeSequence) {
        const sequence = await this.app.sequenceUtils.getSequence(geneInfo.chromosome, geneInfo.start, geneInfo.end);
        result.sequence = sequence;
      }

      return {
        success: true,
        geneData: result,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取注释数据
   */
  async getAnnotationData(parameters, strategy) {
    try {
      const { chromosome, start, end, type = 'all' } = parameters;

      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Chromosome, start, and end are required');
      }

      // 获取注释数据
      const annotations = await this.app.annotationManager.getAnnotations(chromosome, start, end, type);

      return {
        success: true,
        annotations: annotations.map(ann => ({
          id: ann.id,
          type: ann.type,
          start: ann.start,
          end: ann.end,
          strand: ann.strand,
          attributes: ann.attributes,
        })),
        count: annotations.length,
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
   * 获取轨道数据
   */
  async getTrackData(parameters, strategy) {
    try {
      const { trackName, chromosome, start, end } = parameters;

      if (!trackName) {
        throw new Error('Track name is required');
      }

      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Chromosome, start, and end are required');
      }

      // 获取轨道数据
      const trackData = await this.app.trackRenderer.getTrackData(trackName, chromosome, start, end);

      return {
        success: true,
        trackName,
        data: trackData,
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
   * 导出序列
   */
  async exportSequence(parameters, strategy) {
    try {
      const { chromosome, start, end, format = 'fasta', filename } = parameters;

      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Chromosome, start, and end are required');
      }

      const sequence = await this.app.sequenceUtils.getSequence(chromosome, start, end);

      let content;
      switch (format.toLowerCase()) {
        case 'fasta':
          content = `>${chromosome}:${start}-${end}\n${sequence}`;
          break;
        case 'genbank':
          content = this.formatGenBank(chromosome, start, end, sequence);
          break;
        default:
          throw new Error(`Unsupported export format: ${format}`);
      }

      // 保存文件
      const savedFile = await this.storageManager.saveFile(
        filename || `${chromosome}_${start}-${end}.${format}`,
        content
      );

      return {
        success: true,
        message: `Sequence exported to ${savedFile}`,
        file: savedFile,
        format,
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
   * 导出区域
   */
  async exportRegion(parameters, strategy) {
    try {
      const { chromosome, start, end, includeAnnotations = true, format = 'gff' } = parameters;

      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Chromosome, start, and end are required');
      }

      const sequence = await this.app.sequenceUtils.getSequence(chromosome, start, end);
      let content = '';

      if (format.toLowerCase() === 'gff' && includeAnnotations) {
        const annotations = await this.app.annotationManager.getAnnotations(chromosome, start, end);
        content = this.formatGFF(chromosome, start, end, sequence, annotations);
      } else {
        content = `>${chromosome}:${start}-${end}\n${sequence}`;
      }

      const filename = `${chromosome}_${start}-${end}_region.${format}`;
      const savedFile = await this.storageManager.saveFile(filename, content);

      return {
        success: true,
        message: `Region exported to ${savedFile}`,
        file: savedFile,
        format,
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
   * 导出基因列表
   */
  async exportGeneList(parameters, strategy) {
    try {
      const { chromosome, start, end, format = 'csv' } = parameters;

      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Chromosome, start, and end are required');
      }

      const annotations = await this.app.annotationManager.getAnnotations(chromosome, start, end, 'gene');

      let content;
      if (format.toLowerCase() === 'csv') {
        content = 'Gene,Start,End,Strand,Type,Description\n';
        annotations.forEach(gene => {
          content += `${gene.id},${gene.start},${gene.end},${gene.strand},${gene.type},${gene.attributes.description || ''}\n`;
        });
      } else if (format.toLowerCase() === 'json') {
        content = JSON.stringify(annotations, null, 2);
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

      const filename = `${chromosome}_${start}-${end}_genes.${format}`;
      const savedFile = await this.storageManager.saveFile(filename, content);

      return {
        success: true,
        message: `Gene list exported to ${savedFile}`,
        file: savedFile,
        format,
        geneCount: annotations.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 导出轨道数据
   */
  async exportTrackData(parameters, strategy) {
    try {
      const { trackName, chromosome, start, end, format = 'wig' } = parameters;

      if (!trackName) {
        throw new Error('Track name is required');
      }

      if (!chromosome || start === undefined || end === undefined) {
        throw new Error('Chromosome, start, and end are required');
      }

      const trackData = await this.app.trackRenderer.getTrackData(trackName, chromosome, start, end);

      let content;
      if (format.toLowerCase() === 'wig') {
        content = this.formatWIG(trackName, chromosome, trackData);
      } else if (format.toLowerCase() === 'bedgraph') {
        content = this.formatBedGraph(trackName, trackData);
      } else {
        throw new Error(`Unsupported format: ${format}`);
      }

      const filename = `${trackName}_${chromosome}_${start}-${end}.${format}`;
      const savedFile = await this.storageManager.saveFile(filename, content);

      return {
        success: true,
        message: `Track data exported to ${savedFile}`,
        file: savedFile,
        format,
        trackName,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 导入序列
   */
  async importSequence(parameters, strategy) {
    try {
      const { filePath, format = 'auto' } = parameters;

      if (!filePath) {
        throw new Error('File path is required');
      }

      const content = await this.storageManager.readFile(filePath);
      const sequences = this.parseSequenceFile(content, format);

      // 存储序列数据
      for (const seq of sequences) {
        await this.app.sequenceUtils.storeSequence(seq.chromosome, seq.start, seq.end, seq.sequence);
      }

      return {
        success: true,
        message: `Imported ${sequences.length} sequences`,
        sequences: sequences.map(s => ({ chromosome: s.chromosome, start: s.start, end: s.end })),
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 导入注释
   */
  async importAnnotation(parameters, strategy) {
    try {
      const { filePath, format = 'gff' } = parameters;

      if (!filePath) {
        throw new Error('File path is required');
      }

      const content = await this.storageManager.readFile(filePath);
      const annotations = this.parseAnnotationFile(content, format);

      // 存储注释数据
      for (const ann of annotations) {
        await this.app.annotationManager.addAnnotation(ann);
      }

      return {
        success: true,
        message: `Imported ${annotations.length} annotations`,
        annotationCount: annotations.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 导入轨道数据
   */
  async importTrackData(parameters, strategy) {
    try {
      const { filePath, trackName, format = 'wig' } = parameters;

      if (!filePath || !trackName) {
        throw new Error('File path and track name are required');
      }

      const content = await this.storageManager.readFile(filePath);
      const trackData = this.parseTrackFile(content, format);

      // 创建轨道
      await this.app.trackRenderer.createTrack(trackName, trackData);

      return {
        success: true,
        message: `Track ${trackName} created with ${trackData.length} data points`,
        trackName,
        dataPoints: trackData.length,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 搜索基因
   */
  async searchGenes(parameters, strategy) {
    try {
      const { query, chromosome, type = 'all' } = parameters;

      if (!query) {
        throw new Error('Search query is required');
      }

      const genes = await this.app.annotationManager.searchGenes(query, chromosome, type);

      return {
        success: true,
        genes: genes.map(gene => ({
          id: gene.id,
          name: gene.name,
          chromosome: gene.chromosome,
          start: gene.start,
          end: gene.end,
          type: gene.type,
          description: gene.description,
        })),
        count: genes.length,
        query,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 搜索序列
   */
  async searchSequences(parameters, strategy) {
    try {
      const { sequence, chromosome, maxMismatches = 0 } = parameters;

      if (!sequence) {
        throw new Error('Search sequence is required');
      }

      const matches = await this.app.sequenceUtils.searchSequence(sequence, chromosome, maxMismatches);

      return {
        success: true,
        matches: matches.map(match => ({
          chromosome: match.chromosome,
          start: match.start,
          end: match.end,
          strand: match.strand,
          score: match.score,
        })),
        count: matches.length,
        query: sequence,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 搜索注释
   */
  async searchAnnotations(parameters, strategy) {
    try {
      const { query, type = 'all', chromosome } = parameters;

      if (!query) {
        throw new Error('Search query is required');
      }

      const annotations = await this.app.annotationManager.searchAnnotations(query, type, chromosome);

      return {
        success: true,
        annotations: annotations.map(ann => ({
          id: ann.id,
          type: ann.type,
          chromosome: ann.chromosome,
          start: ann.start,
          end: ann.end,
          attributes: ann.attributes,
        })),
        count: annotations.length,
        query,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取数据统计
   */
  async getDataStatistics(parameters, strategy) {
    try {
      const { chromosome } = parameters;

      const stats = await this.app.dataManager.getStatistics(chromosome);

      return {
        success: true,
        statistics: {
          totalLength: stats.totalLength,
          geneCount: stats.geneCount,
          annotationCount: stats.annotationCount,
          trackCount: stats.trackCount,
          gcContent: stats.gcContent,
        },
        chromosome: chromosome || 'all',
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 获取基因组摘要
   */
  async getGenomeSummary(parameters, strategy) {
    try {
      const summary = await this.app.dataManager.getGenomeSummary();

      return {
        success: true,
        summary: {
          name: summary.name,
          version: summary.version,
          chromosomes: summary.chromosomes,
          totalLength: summary.totalLength,
          geneCount: summary.geneCount,
          annotationCount: summary.annotationCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * 格式化GenBank格式
   */
  formatGenBank(chromosome, start, end, sequence) {
    return (
      `LOCUS       ${chromosome}:${start}-${end}    ${sequence.length} bp    DNA     linear\n` +
      `DEFINITION  ${chromosome} region ${start}-${end}\n` +
      `ACCESSION   ${chromosome}_${start}_${end}\n` +
      `VERSION     ${chromosome}_${start}_${end}.1\n` +
      `ORIGIN\n` +
      sequence
        .match(/.{1,60}/g)
        .map((line, i) => `${String(i * 60 + 1).padStart(9)} ${line}`)
        .join('\n') +
      '\n' +
      `//\n`
    );
  }

  /**
   * 格式化GFF格式
   */
  formatGFF(chromosome, start, end, sequence, annotations) {
    let gff = `##gff-version 3\n` + `##sequence-region ${chromosome} ${start} ${end}\n`;

    annotations.forEach(ann => {
      gff += `${chromosome}\t.\t${ann.type}\t${ann.start}\t${ann.end}\t.\t${ann.strand}\t.\tID=${ann.id};Name=${ann.attributes.name || ann.id}\n`;
    });

    return gff;
  }

  /**
   * 格式化WIG格式
   */
  formatWIG(trackName, chromosome, trackData) {
    let wig = `track type=wiggle_0 name="${trackName}"\n` + `fixedStep chrom=${chromosome} start=1 step=1\n`;

    trackData.forEach(point => {
      wig += `${point.value}\n`;
    });

    return wig;
  }

  /**
   * 格式化BedGraph格式
   */
  formatBedGraph(trackName, trackData) {
    let bedgraph = `track type=bedGraph name="${trackName}"\n`;

    trackData.forEach(point => {
      bedgraph += `${point.chromosome}\t${point.start}\t${point.end}\t${point.value}\n`;
    });

    return bedgraph;
  }

  /**
   * 解析序列文件
   */
  parseSequenceFile(content, format) {
    const sequences = [];

    if (format === 'auto' || format === 'fasta') {
      const fastaRegex = />([^\n]+)\n([^>]+)/g;
      let match;
      while ((match = fastaRegex.exec(content)) !== null) {
        const header = match[1];
        const sequence = match[2].replace(/\s/g, '');

        // 解析头部信息
        const headerMatch = header.match(/([^:]+):(\d+)-(\d+)/);
        if (headerMatch) {
          sequences.push({
            chromosome: headerMatch[1],
            start: parseInt(headerMatch[2]),
            end: parseInt(headerMatch[3]),
            sequence: sequence,
          });
        }
      }
    }

    return sequences;
  }

  /**
   * 解析注释文件
   */
  parseAnnotationFile(content, format) {
    const annotations = [];

    if (format === 'gff') {
      const lines = content.split('\n');
      lines.forEach(line => {
        if (line.startsWith('#') || !line.trim()) return;

        const fields = line.split('\t');
        if (fields.length >= 9) {
          const attributes = this.parseGFFAttributes(fields[8]);
          annotations.push({
            chromosome: fields[0],
            source: fields[1],
            type: fields[2],
            start: parseInt(fields[3]),
            end: parseInt(fields[4]),
            score: fields[5],
            strand: fields[6],
            phase: fields[7],
            attributes: attributes,
          });
        }
      });
    }

    return annotations;
  }

  /**
   * 解析GFF属性
   */
  parseGFFAttributes(attributesString) {
    const attributes = {};
    const pairs = attributesString.split(';');

    pairs.forEach(pair => {
      const [key, value] = pair.split('=');
      if (key && value) {
        attributes[key.trim()] = value.trim();
      }
    });

    return attributes;
  }

  /**
   * 解析轨道文件
   */
  parseTrackFile(content, format) {
    const trackData = [];

    if (format === 'wig') {
      const lines = content.split('\n');
      let currentChromosome = null;
      let currentStart = null;
      let currentStep = null;

      lines.forEach(line => {
        if (line.startsWith('track')) return;

        if (line.startsWith('fixedStep')) {
          const match = line.match(/chrom=([^\s]+)\s+start=(\d+)\s+step=(\d+)/);
          if (match) {
            currentChromosome = match[1];
            currentStart = parseInt(match[2]);
            currentStep = parseInt(match[3]);
          }
        } else if (currentChromosome && !isNaN(parseFloat(line))) {
          const value = parseFloat(line);
          trackData.push({
            chromosome: currentChromosome,
            start: currentStart,
            end: currentStart + currentStep - 1,
            value: value,
          });
          currentStart += currentStep;
        }
      });
    }

    return trackData;
  }
}

// 导出智能体
window.DataAgent = DataAgent;
