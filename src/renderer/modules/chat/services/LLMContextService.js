/**
 * LLMContextService - Extracted from ChatManager
 */
class LLMContextService {
  constructor(app, chatManager) {
    this.app = app;
    this.chatManager = chatManager;
  }

  formatToolResult(toolName, parameters, result) {
    console.log('formatToolResult called with:', { toolName, parameters, result });

    switch (toolName) {
      case 'navigate_to_position':
        const rangeInfo = result.usedDefaultRange ? ' (2000bp default range)' : '';
        return `✅ Navigated to ${result.chromosome}:${result.start}-${result.end}${rangeInfo}`;

      case 'open_new_tab':
        const tabRangeInfo = result.usedDefaultRange ? ' (2000bp default range)' : '';
        return `🗂️ Opened new tab: ${result.title}${tabRangeInfo}`;

      case 'switch_to_tab':
        return `🗂️ Switched to tab: ${result.tab_title || result.message}`;

      case 'close_tab':
        return `🗂️ Closed tab: ${result.closed_tab_title || result.message} (${result.remaining_tabs} tabs remaining)`;

      case 'search_features':
        if (result.count > 0) {
          return `🔍 Found ${result.count} features matching "${result.query}"`;
        } else {
          return `🔍 No features found matching "${result.query}"`;
        }

      case 'get_current_state':
        return `📊 Current state: ${result.currentChromosome || 'No chromosome selected'}, position ${result.currentPosition?.start || 0}-${result.currentPosition?.end || 0}, ${result.annotationsCount || 0} annotations loaded`;

      case 'get_sequence':
        return `🧬 Retrieved ${result.length}bp sequence from ${result.chromosome}:${result.start}-${result.end}`;

      case 'toggle_track':
      case 'toggle_annotation_track':
        if (result.noChangeNeeded) {
          return `👁️ Track "${parameters.trackName || parameters.track_name}" is already ${result.visible ? 'visible' : 'hidden'}`;
        }
        return `👁️ Track "${parameters.trackName || parameters.track_name}" is now ${result.visible ? 'visible' : 'hidden'}`;

      case 'create_annotation':
        return `✨ Created ${result.type} annotation "${result.name}" at ${result.chromosome}:${result.start}-${result.end}`;

      case 'analyze_region':
        return `🔬 Analyzed region ${result.chromosome}:${result.start}-${result.end} (${result.length}bp, ${result.gcContent}% GC, ${result.featureCount || 0} features)`;

      case 'export_data':
        return `💾 Exported ${result.format.toUpperCase()} data successfully. File has been downloaded.`;

      case 'get_gene_details':
        if (result.found) {
          return `🧬 Found ${result.count} gene(s) matching "${result.geneName}": ${result.genes
            .map(g => `${g.name} (${g.start}-${g.end}, ${g.product})`)
            .slice(0, 3)
            .join(', ')}${result.count > 3 ? '...' : ''}`;
        } else {
          return `❌ No genes found matching "${result.geneName}" in ${result.chromosome}`;
        }

      case 'translate_sequence':
        return `🔬 Translated ${result.length.dna}bp DNA sequence to ${result.length.protein}aa protein from ${result.chromosome}:${result.start}-${result.end} (${result.strand} strand)`;

      case 'calculate_gc_content':
        return `📊 GC content analysis for ${result.chromosome}:${result.region}: Overall ${result.overallGCContent}% GC (${result.length}bp analyzed in ${result.totalWindows} windows)`;

      case 'get_operons':
        return `🧬 Found ${result.operonsFound} operons in ${result.chromosome}: ${result.operons
          .slice(0, 3)
          .map(op => `${op.name} (${op.geneCount} genes)`)
          .join(', ')}${result.operonsFound > 3 ? '...' : ''}`;

      case 'zoom_to_gene':
        return `🔍 Zoomed to gene ${result.gene.name} at ${result.gene.start}-${result.gene.end} with ${result.padding}bp padding`;

      case 'get_chromosome_list':
        return `📋 Available chromosomes (${result.count}): ${result.chromosomes.map(chr => `${chr.name} (${(chr.length / 1000000).toFixed(1)}Mbp)${chr.isSelected ? ' *' : ''}`).join(', ')}. Current: ${result.currentChromosome}`;

      case 'get_track_status':
        return `Track Status:\n${Object.entries(result)
          .map(([track, status]) => `• ${track}: ${status ? 'visible' : 'hidden'}`)
          .join('\n')}`;

      case 'search_motif':
        return (
          `Motif Search Results for "${result.pattern}":\n` +
          `• Found ${result.matchesFound} matches in ${result.searchRegion}\n` +
          `• Allowing up to ${result.allowedMismatches} mismatches\n` +
          (result.matches.length > 0
            ? `• Top matches:\n${result.matches
              .slice(0, 5)
              .map(m => `  - Position ${m.position}: ${m.sequence} (${m.strand} strand, ${m.mismatches} mismatches)`)
              .join('\n')}`
            : '• No matches found')
        );

      case 'search_pattern':
        return (
          `Pattern Search Results for "${result.regex}":\n` +
          `• Found ${result.matchesFound} matches in ${result.searchRegion}\n` +
          (result.matches.length > 0
            ? `• Matches:\n${result.matches
              .slice(0, 10)
              .map(m => `  - Position ${m.position}: ${m.sequence} (length: ${m.length})`)
              .join('\n')}`
            : '• No matches found')
        );

      case 'get_nearby_features':
        return (
          `Nearby Features (within ${result.searchDistance} bp of position ${result.position}):\n` +
          `• Found ${result.featuresFound} features\n` +
          (result.features.length > 0
            ? `• Features:\n${result.features
              .map(
                f =>
                  `  - ${f.name} (${f.type}): ${f.start}-${f.end} ${f.strand} strand, ${f.distance} bp ${f.direction}`
              )
              .join('\n')}`
            : '• No features found in range')
        );

      case 'find_intergenic_regions':
        return (
          `Intergenic Regions (min ${result.minLength} bp):\n` +
          `• Found ${result.regionsFound} regions\n` +
          `• Total intergenic length: ${result.totalIntergenicLength.toLocaleString()} bp\n` +
          (result.regions.length > 0
            ? `• Largest regions:\n${result.regions
              .slice(0, 5)
              .map(
                r =>
                  `  - ${r.start}-${r.end} (${r.length.toLocaleString()} bp) between ${r.upstreamGene} and ${r.downstreamGene}`
              )
              .join('\n')}`
            : '• No intergenic regions found')
        );

      case 'find_restriction_sites':
        return (
          `Restriction Sites for ${result.enzyme} (${result.recognitionSite}):\n` +
          `• Found ${result.sitesFound} sites in ${result.searchRegion}\n` +
          (result.sites.length > 0
            ? `• Sites:\n${result.sites
              .map(s => `  - Position ${s.position}: ${s.site} (${s.strand} strand)`)
              .join('\n')}`
            : '• No restriction sites found')
        );

      case 'virtual_digest':
        return (
          `Virtual Digest with ${result.enzymes.join(', ')}:\n` +
          `• Total cut sites: ${result.totalSites}\n` +
          `• Fragments generated: ${result.fragments}\n` +
          `• Average fragment size: ${result.averageFragmentSize.toLocaleString()} bp\n` +
          `• Size range: ${result.smallestFragment.toLocaleString()} - ${result.largestFragment.toLocaleString()} bp\n` +
          (result.fragmentDetails.length > 0
            ? `• Largest fragments:\n${result.fragmentDetails
              .slice(0, 5)
              .map(f => `  - ${f.start}-${f.end} (${f.length.toLocaleString()} bp) cut by ${f.cutBy}`)
              .join('\n')}`
            : '')
        );

      case 'sequence_statistics':
        let statsOutput = `Sequence Statistics for ${result.region}:\n`;
        if (result.statistics.composition) {
          const comp = result.statistics.composition;
          statsOutput += `• Length: ${comp.length.toLocaleString()} bp\n`;
          statsOutput += `• Composition: A=${comp.A.percentage}%, T=${comp.T.percentage}%, G=${comp.G.percentage}%, C=${comp.C.percentage}%\n`;
          statsOutput += `• GC content: ${comp.GC.percentage}%\n`;
        }
        if (result.statistics.complexity) {
          statsOutput += `• Low complexity regions: ${result.statistics.complexity.lowComplexityRegions}\n`;
        }
        if (result.statistics.skew) {
          statsOutput += `• AT/GC skew analysis: ${result.statistics.skew.length} data points\n`;
        }
        return statsOutput;

      case 'codon_usage_analysis':
        return (
          `Codon Usage Analysis for ${result.geneName}:\n` +
          `• Total codons: ${result.totalCodons}\n` +
          `• Unique codons used: ${result.uniqueCodons}/64\n` +
          `• Most frequent codons:\n${result.mostFrequentCodons
            .map(c => `  - ${c.codon} (${c.aminoAcid}): ${c.count} times (${c.frequency}%)`)
            .join('\n')}`
        );

      case 'bookmark_position':
        return (
          `✓ ${result.message}\n` +
          `• Bookmark ID: ${result.bookmark.id}\n` +
          `• Created: ${new Date(result.bookmark.created).toLocaleString()}\n` +
          (result.bookmark.notes ? `• Notes: ${result.bookmark.notes}` : '')
        );

      case 'get_bookmarks':
        return (
          `Bookmarks ${result.chromosome !== 'all' ? `for ${result.chromosome}` : ''}:\n` +
          `• Total bookmarks: ${result.totalBookmarks}\n` +
          `• Showing: ${result.filteredBookmarks}\n` +
          (result.bookmarks.length > 0
            ? `• Bookmarks:\n${result.bookmarks
              .map(
                b =>
                  `  - ${b.name}: ${b.chromosome}:${b.start}-${b.end} (${new Date(b.created).toLocaleDateString()})`
              )
              .join('\n')}`
            : '• No bookmarks found')
        );

      case 'save_view_state':
        return (
          `✓ ${result.message}\n` +
          `• State ID: ${result.viewState.id}\n` +
          `• Position: ${result.viewState.chromosome}:${result.viewState.position?.start}-${result.viewState.position?.end}\n` +
          `• Visible tracks: ${result.viewState.visibleTracks?.join(', ') || 'none'}\n` +
          `• Created: ${new Date(result.viewState.created).toLocaleString()}`
        );

      case 'compare_regions':
        return (
          `Region Comparison:\n` +
          `• Region 1: ${result.region1} (${result.length1.toLocaleString()} bp)\n` +
          `• Region 2: ${result.region2} (${result.length2.toLocaleString()} bp)\n` +
          `• Similarity: ${result.similarity}%\n` +
          `• Identity: ${result.identity}%\n` +
          `• Preview:\n  Region 1: ${result.sequenceData.region1}\n  Region 2: ${result.sequenceData.region2}`
        );

      case 'find_similar_sequences':
        return (
          `Similar Sequence Search:\n` +
          `• Query: ${result.querySequence}\n` +
          `• Found ${result.resultsFound} similar regions (≥${result.minSimilarity} similarity)\n` +
          (result.results.length > 0
            ? `• Top matches:\n${result.results
              .slice(0, 5)
              .map(r => `  - ${r.start}-${r.end}: ${r.similarity} similarity\n    ${r.sequence}`)
              .join('\n')}`
            : '• No similar sequences found')
        );

      case 'edit_annotation':
        return (
          `✓ ${result.message}\n` +
          `• Annotation: ${result.updatedAnnotation.qualifiers?.gene || result.updatedAnnotation.qualifiers?.locus_tag || result.annotationId}\n` +
          `• Type: ${result.updatedAnnotation.type}\n` +
          `• Position: ${result.updatedAnnotation.start}-${result.updatedAnnotation.end}`
        );

      case 'delete_annotation':
        return (
          `✓ ${result.message}\n` +
          `• Deleted: ${result.deletedAnnotation.qualifiers?.gene || result.deletedAnnotation.qualifiers?.locus_tag || result.annotationId}\n` +
          `• Type: ${result.deletedAnnotation.type}\n` +
          `• Position: ${result.deletedAnnotation.start}-${result.deletedAnnotation.end}`
        );

      case 'batch_create_annotations':
        return (
          `✓ Batch created ${result.annotationsCreated} annotations on ${result.chromosome}\n` +
          (result.annotations.length > 0
            ? `• Created annotations:\n${result.annotations
              .map(a => `  - ${a.type}: ${a.start}-${a.end} (${a.qualifiers?.gene || a.id})`)
              .join('\n')}`
            : '')
        );

      case 'get_file_info':
        let fileOutput = `File Information ${result.fileType !== 'all' ? `(${result.fileType})` : ''}:\n`;

        if (result.fileInfo.genome) {
          const genome = result.fileInfo.genome;
          fileOutput += `• Genome: ${genome.chromosomes} chromosome(s), ${genome.totalLength.toLocaleString()} bp total\n`;
          fileOutput += `• Current: ${genome.currentChromosome || 'none'}\n`;
        }

        if (result.fileInfo.annotations) {
          const ann = result.fileInfo.annotations;
          fileOutput += `• Annotations: ${ann.totalFeatures.toLocaleString()} features across ${ann.chromosomes} chromosome(s)\n`;
          fileOutput += `• Feature types: ${ann.featureTypes.join(', ')}\n`;
        }

        if (result.fileInfo.tracks) {
          const tracks = Object.entries(result.fileInfo.tracks);
          const visible = tracks.filter(([_, status]) => status).length;
          fileOutput += `• Tracks: ${visible}/${tracks.length} visible\n`;
        }

        return fileOutput;

      case 'export_region_features':
        return (
          `✓ Exported ${result.featuresExported} features from ${result.chromosome}:${result.region}\n` +
          `• Format: ${result.format}\n` +
          `• Data ready for download`
        );

      case 'open_protein_viewer':
        return `✓ Opened protein viewer for ${result.geneName}`;

      default:
        return `✅ Tool ${toolName} executed successfully`;
    }
  }

  checkTaskCompletion(response) {
    console.log('=== Checking Task Completion ===');
    console.log('Response length:', response ? response.length : 0);

    const result = {
      isCompleted: false,
      reason: '',
      confidence: 0,
      summary: null,
    };

    if (!response || typeof response !== 'string') {
      return result;
    }

    const lowercaseResponse = response.toLowerCase();

    // Define completion indicators with weights
    const completionIndicators = [
      // Strong completion signals
      {
        patterns: ['task completed', 'task finished', 'task done', 'completed successfully'],
        weight: 0.9,
        reason: 'Explicit task completion statement',
      },
      {
        patterns: ['analysis complete', 'analysis finished', 'analysis done'],
        weight: 0.85,
        reason: 'Analysis completion indicated',
      },
      {
        patterns: ['i have completed', 'i have finished', 'i have done'],
        weight: 0.8,
        reason: 'Direct completion confirmation',
      },
      {
        patterns: ['the task is complete', 'the task is finished', 'the task is done'],
        weight: 0.85,
        reason: 'Task status confirmation',
      },

      // Gene search completion signals
      {
        patterns: ['gene found', 'found the gene', 'located the gene', 'gene located'],
        weight: 0.85,
        reason: 'Gene search completed',
      },
      {
        patterns: ['gene information', 'gene details', 'gene data', 'gene sequence'],
        weight: 0.8,
        reason: 'Gene information provided',
      },
      {
        patterns: ['here is the gene', 'here are the details', 'gene details are'],
        weight: 0.75,
        reason: 'Gene details presented',
      },
      {
        patterns: ['gene name:', 'gene id:', 'gene symbol:', 'location:'],
        weight: 0.8,
        reason: 'Gene metadata provided',
      },

      // Search result completion
      {
        patterns: ['search results', 'search completed', 'found results'],
        weight: 0.75,
        reason: 'Search results provided',
      },
      {
        patterns: ['no results found', 'no matches found', 'gene not found'],
        weight: 0.8,
        reason: 'Search completed with no results',
      },

      // Summary/conclusion signals
      { patterns: ['in summary', 'to summarize', 'in conclusion', 'overall'], weight: 0.7, reason: 'Summary provided' },
      { patterns: ['final result', 'final analysis', 'final summary'], weight: 0.75, reason: 'Final results provided' },
      { patterns: ['that completes', 'this completes', 'this concludes'], weight: 0.8, reason: 'Completion statement' },

      // Question/offer for next steps
      {
        patterns: ['is there anything else', 'anything else you need', 'what else would you like'],
        weight: 0.65,
        reason: 'Offering further assistance',
      },
      {
        patterns: ['do you need anything else', 'would you like me to', 'let me know if you need'],
        weight: 0.6,
        reason: 'Proactive assistance offer',
      },
      {
        patterns: ['please let me know if', 'feel free to ask if'],
        weight: 0.55,
        reason: 'Open-ended assistance offer',
      },

      // Results presentation
      {
        patterns: ['here are the results', 'the results show', 'results summary'],
        weight: 0.65,
        reason: 'Results presented',
      },
      {
        patterns: ['based on the analysis', 'the data shows', 'findings indicate'],
        weight: 0.6,
        reason: 'Analysis findings presented',
      },

      // Tool execution completion without follow-up
      {
        patterns: ['successfully navigated', 'successfully retrieved', 'successfully analyzed'],
        weight: 0.5,
        reason: 'Tool execution completed',
      },
    ];

    let maxWeight = 0;
    let bestReason = '';

    // Check for completion indicators
    for (const indicator of completionIndicators) {
      for (const pattern of indicator.patterns) {
        if (lowercaseResponse.includes(pattern)) {
          if (indicator.weight > maxWeight) {
            maxWeight = indicator.weight;
            bestReason = indicator.reason;
          }
          console.log(`Found completion indicator: "${pattern}" (weight: ${indicator.weight})`);
        }
      }
    }

    // Additional context checks
    let contextBonus = 0;

    // Check if no tool calls are present (conversational response)
    const hasToolCall = this.chatManager.parseToolCall(response) !== null || this.chatManager.parseMultipleToolCalls(response).length > 0;

    // CRITICAL: If tool calls are present, heavily reduce completion confidence
    // Tool calls should ALWAYS take priority over completion detection
    if (hasToolCall) {
      maxWeight *= 0.1; // Drastically reduce confidence if tool calls exist
      console.log('Tool calls detected - heavily reducing task completion confidence to prioritize tool execution');
    }

    // CRITICAL: For analysis tasks, don't mark as complete if we only have basic data retrieval
    const isAnalysisTask = lowercaseResponse.includes('analyze') || lowercaseResponse.includes('analysis');
    const hasAnalysisResults =
      lowercaseResponse.includes('results') ||
      lowercaseResponse.includes('findings') ||
      lowercaseResponse.includes('statistics') ||
      lowercaseResponse.includes('composition') ||
      lowercaseResponse.includes('frequency') ||
      lowercaseResponse.includes('usage');

    // Check if this is a request for summary rather than providing one
    const isSummaryRequest =
      lowercaseResponse.includes('please provide') ||
      lowercaseResponse.includes('provide a summary') ||
      lowercaseResponse.includes('give me a summary') ||
      lowercaseResponse.includes('can you summarize');

    // If it's an analysis task but we don't have analysis results, reduce confidence significantly
    if (isAnalysisTask && !hasAnalysisResults && maxWeight > 0) {
      maxWeight *= 0.3; // Significantly reduce confidence
      console.log('Analysis task detected without results - reducing confidence');
    }

    // If this is a summary request (not providing summary), reduce confidence heavily
    if (isSummaryRequest && maxWeight > 0) {
      maxWeight *= 0.2; // Even more reduction for summary requests
      console.log('Summary request detected - reducing confidence heavily');
    }

    if (!hasToolCall && maxWeight > 0) {
      contextBonus += 0.15;
      console.log('No tool calls detected - adding context bonus');
    }

    // Check response length - longer responses with completion indicators are more likely to be final
    if (response.length > 100 && maxWeight > 0) {
      contextBonus += 0.1;
      console.log('Substantial response length - adding context bonus');
    }

    // Check for direct answers without need for more tools
    if (
      lowercaseResponse.includes('the answer is') ||
      lowercaseResponse.includes('the result is') ||
      (lowercaseResponse.includes('found') && !hasToolCall)
    ) {
      contextBonus += 0.1;
      console.log('Direct answer detected - adding context bonus');
    }

    const finalConfidence = Math.min(maxWeight + contextBonus, 1.0);

    // Determine completion status based on confidence threshold
    const completionThreshold = this.chatManager.configManager.get('llm.completionThreshold', 0.7);

    if (finalConfidence >= completionThreshold) {
      result.isCompleted = true;
      result.confidence = finalConfidence;
      result.reason = bestReason;

      // Extract summary if available
      const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
      if (sentences.length > 0) {
        // Use the entire response as summary for now
        result.summary = response.trim();
      }
    }

    console.log(
      `Task completion check result: ${result.isCompleted} (confidence: ${finalConfidence}, threshold: ${completionThreshold})`
    );
    if (result.isCompleted) {
      console.log(`Completion reason: ${result.reason}`);
    }

    return result;
  }

  shouldTerminateAfterToolExecution(toolsToExecute, successfulResults, originalMessage) {
    // Check if this is a simple search task that likely doesn't need follow-up
    const message = originalMessage.toLowerCase();

    // Simple task patterns that typically complete with one tool call
    const singleExecutionPatterns = [
      // Search patterns
      'search for gene',
      'find gene',
      'locate gene',
      'show me gene',
      'get gene',
      'gene information',
      'gene details',
      // Navigation patterns
      'jump to gene',
      'go to gene',
      'navigate to gene',
      'find gene',
      'navigate to position',
      'go to position',
      'move to position',
      'navigate to',
      'jump to position',
      'show position',
      'go to coordinates',
      // Analysis patterns
      'codon usage analysis',
      'codon analysis',
      'analyze codon',
      'codon frequency',
      'codon bias',
      'analyze domains',
      'domain analysis',
      'interpro analysis',
      'protein domains',
      // File loading patterns
      'load genome',
      'load file',
      'open file',
      'import file',
      'load annotation',
      'load variant',
      'load reads',
      'load wig',
      'load operon',
      // UI action patterns
      'open new tab',
      'create new tab',
      'new tab',
      // Track control patterns - expanded to include more variations
      'toggle track',
      'hide track',
      'show track',
      'toggle off',
      'toggle on',
      'turn off',
      'turn on',
      'hide gc',
      'show gc',
      'toggle gc',
      'show genes',
      'hide genes',
      'toggle genes',
      'show variants',
      'hide variants',
      'toggle variants',
      'show reads',
      'hide reads',
      'toggle reads',
      'show proteins',
      'hide proteins',
      'toggle proteins',
      'show wig',
      'hide wig',
      'toggle wig',
      'show sequence',
      'hide sequence',
      'toggle sequence',
      'show actions',
      'hide actions',
      'toggle actions',
      // State information patterns
      'get genome info',
      'genome information',
      'show genome info',
      'genome details',
      'get current state',
      'current state',
      'browser state',
      'show state',
    ];

    const isSingleExecutionTask =
      singleExecutionPatterns.some(pattern => message.toLowerCase().includes(pattern)) ||
      // Also check for very short messages that are likely simple commands
      (message.toLowerCase().split(' ').length <= 5 &&
        (message.toLowerCase().includes('toggle') ||
          message.toLowerCase().includes('show') ||
          message.toLowerCase().includes('hide') ||
          message.toLowerCase().includes('turn on') ||
          message.toLowerCase().includes('turn off')));

    // Check if we executed tools that typically complete tasks
    const taskCompletingTools = [
      'search_gene_by_name',
      'search_sequence',
      'find_feature',
      'search_feature',
      'jump_to_gene',
      'jump_to_feature',
      'focus_on_gene',
      'codon_usage_analysis',
      'compute_gc',
      'analyze_region',
      'analyze_interpro_domains',
      'load_genome_file',
      'load_annotation_file',
      'load_variant_file',
      'load_reads_file',
      'load_wig_tracks',
      'load_operon_file',
      'open_new_tab',
      'create_annotation',
      'export_data',
      // Track control operations - complete actions that don't need follow-up
      'toggle_track',
      'toggle_annotation_track',
      // Navigation operations - complete actions that don't need follow-up
      'navigate_to_position',
      // State information operations - complete actions that don't need follow-up
      'get_genome_info',
      'get_current_state',
      'get_file_info',
    ];

    const executedTaskCompletingTool = toolsToExecute.some(tool => taskCompletingTools.includes(tool.tool_name));

    // Check if the tool execution was successful and returned meaningful data
    const hasValidResults = successfulResults.some(result => {
      if (!result.result) return false;

      // For file loading and UI operations, check for success flag
      const fileAndUITools = [
        'load_genome_file',
        'load_annotation_file',
        'load_variant_file',
        'load_reads_file',
        'load_wig_tracks',
        'load_operon_file',
        'open_new_tab',
        'create_annotation',
        'export_data',
        // Track control operations
        'toggle_track',
        'toggle_annotation_track',
        // Navigation operations
        'navigate_to_position',
        // State information operations
        'get_genome_info',
        'get_current_state',
        'get_file_info',
      ];

      if (fileAndUITools.includes(result.tool)) {
        // For toggle_track operations, both success and noChangeNeeded are valid results
        if (result.tool === 'toggle_track' || result.tool === 'toggle_annotation_track') {
          return result.result.success === true || result.result.noChangeNeeded === true;
        }
        return result.result.success === true;
      }

      // Check if result contains actual data (not just empty or error responses)
      const resultStr = JSON.stringify(result.result).toLowerCase();
      return (
        !resultStr.includes('error') &&
        !resultStr.includes('not found') &&
        !resultStr.includes('no results') &&
        resultStr.length > 20
      ); // Reasonable data length
    });

    // For single execution tasks with successful results, terminate early
    if (isSingleExecutionTask && executedTaskCompletingTool && hasValidResults) {
      console.log('Early termination criteria met: Single execution task completed successfully');
      return true;
    }

    // For complex tasks or failed searches, continue with normal flow
    return false;
  }

  shouldAllowToolExecution(tool, conversationHistory, currentRound, toolResults = []) {
    const toolKey = `${tool.tool_name}:${JSON.stringify(tool.parameters)}`;
    const toolName = tool.tool_name;

    // Define tool execution policies
    const toolPolicies = {
      // File operations - only re-execute with different parameters or after failure
      file_operations: {
        tools: [
          'load_genome_file',
          'load_annotation_file',
          'load_variant_file',
          'load_reads_file',
          'load_wig_tracks',
          'load_operon_file',
        ],
        policy: 'conditional_re_execution',
        condition: (tool, history, results) => {
          const wasSuccessful = this.chatManager.wasToolExecutedSuccessfully(toolKey, history);
          if (wasSuccessful) {
            console.log(`🚫 [Policy] File operation already succeeded with same parameters: ${toolName}`);
            return false;
          }
          return true;
        },
      },

      // UI operations - allow once per round, prevent rapid repetition
      ui_operations: {
        tools: ['open_new_tab', 'close_tab', 'switch_tab', 'create_annotation', 'delete_feature', 'export_data'],
        policy: 'once_per_round',
        condition: (tool, history, results, round) => {
          const executedInCurrentRound = results.some(r => r.tool === toolName);
          if (executedInCurrentRound) {
            console.log(`🚫 [Policy] UI operation already executed in current round: ${toolName}`);
            return false;
          }
          return true;
        },
      },

      // Navigation operations - prevent re-navigation to same position
      position_navigation: {
        tools: ['navigate_to_position'],
        policy: 'parameter_based',
        condition: (tool, history, results) => {
          const existingExecution = this.chatManager.findExistingExecution(toolKey, history);
          if (existingExecution && existingExecution.success) {
            console.log(`🚫 [Policy] Navigation already executed with same parameters: ${toolName}`);
            return false;
          }
          return true;
        },
      },

      // Scroll operations - can be repeated (different from precise navigation)
      scroll_operations: {
        tools: ['scroll_left', 'scroll_right'],
        policy: 'always_allowed',
        condition: () => true,
      },

      // Zoom operations - prevent rapid repetition
      zoom_operations: {
        tools: ['zoom_in', 'zoom_out'],
        policy: 'rate_limited',
        condition: (tool, history, results) => {
          const recentExecution = this.chatManager.findRecentExecution(toolName, history, 5000); // 5 seconds
          if (recentExecution) {
            console.log(`🚫 [Policy] Zoom operation rate limited: ${toolName}`);
            return false;
          }
          return true;
        },
      },

      // Gene/feature navigation - single execution per gene/feature
      feature_navigation: {
        tools: ['jump_to_gene', 'jump_to_feature', 'focus_on_gene'],
        policy: 'parameter_based',
        condition: (tool, history, results) => {
          const existingExecution = this.chatManager.findExistingExecution(toolKey, history);
          if (existingExecution && existingExecution.success) {
            console.log(`🚫 [Policy] Feature navigation already executed with same parameters: ${toolName}`);
            return false;
          }
          return true;
        },
      },

      // Search operations - allow with different parameters or after reasonable delay
      search: {
        tools: ['search_gene_by_name', 'search_features', 'search_sequence_motif'],
        policy: 'parameter_based',
        condition: (tool, history, results) => {
          // Allow if parameters are different
          const existingExecution = this.chatManager.findExistingExecution(toolKey, history);
          if (existingExecution && existingExecution.success) {
            console.log(`🚫 [Policy] Search already executed with same parameters: ${toolName}`);
            return false;
          }
          return true;
        },
      },

      // Analysis operations - single execution per analysis request
      analysis: {
        tools: [
          'codon_usage_analysis',
          'compute_gc',
          'analyze_region',
          'translate_dna',
          'reverse_complement',
          'get_coding_sequence',
          'analyze_interpro_domains',
        ],
        policy: 'parameter_based',
        condition: (tool, history, results) => {
          const existingExecution = this.chatManager.findExistingExecution(toolKey, history);
          if (existingExecution && existingExecution.success) {
            console.log(`🚫 [Policy] Analysis already executed with same parameters: ${toolName}`);
            return false;
          }
          return true;
        },
      },

      // Display/UI state operations - once per round
      display_operations: {
        tools: ['show_hide_features', 'set_view_mode', 'refresh_view'],
        policy: 'once_per_round',
        condition: (tool, history, results, round) => {
          const executedInCurrentRound = results.some(r => r.tool === toolName);
          if (executedInCurrentRound) {
            console.log(`🚫 [Policy] Display operation already executed in current round: ${toolName}`);
            return false;
          }
          return true;
        },
      },

      // Track toggle operations - prevent unnecessary repetition of track toggle
      track_operations: {
        tools: ['toggle_track', 'toggle_annotation_track'],
        policy: 'parameter_based_rate_limited',
        condition: (tool, history, results) => {
          // Get current track name from either trackName or track_name parameter
          const currentTrack = tool.parameters?.trackName || tool.parameters?.track_name;
          const currentAction = tool.parameters?.action;
          const currentVisible = tool.parameters?.visible;

          // Convert action to visible state for comparison
          let currentVisibleState = currentVisible;
          if (currentVisibleState === undefined && currentAction) {
            currentVisibleState = currentAction === 'show';
          }

          // Normalize track names for comparison (treat "action" and "actions" as the same)
          const normalizeTrackName = trackName => {
            if (trackName === 'action') return 'actions';
            return trackName;
          };

          const normalizedCurrentTrack = normalizeTrackName(currentTrack);

          // Check if the track is already in the desired state
          const trackMapping = {
            genes: 'trackGenes',
            gc: 'trackGC',
            variants: 'trackVariants',
            reads: 'trackReads',
            proteins: 'trackProteins',
            wigTracks: 'trackWIG',
            sequence: 'trackSequence',
            actions: 'trackActions',
            action: 'trackActions',
            blast: 'trackBlast',
            blast_results: 'trackBlast',
          };

          const checkboxId = trackMapping[currentTrack];
          if (checkboxId) {
            const trackCheckbox = document.getElementById(checkboxId);
            if (trackCheckbox && trackCheckbox.checked === currentVisibleState) {
              console.log(
                `🚫 [Policy] Track ${currentTrack} is already ${currentVisibleState ? 'visible' : 'hidden'}, no need to toggle`
              );
              return false;
            }
          }

          // Check for recent execution of same track toggle with more precise parameter matching
          const now = Date.now();
          const timeWindowMs = 3000; // 3 seconds

          // Look through conversation history for recent executions
          for (let i = conversationHistory.length - 1; i >= 0; i--) {
            const msg = conversationHistory[i];

            // Check assistant messages for tool calls
            if (msg.role === 'assistant' && msg.content) {
              try {
                // Try to parse as single tool call
                const parsed = JSON.parse(msg.content);
                if (
                  (parsed.tool_name === 'toggle_track' || parsed.tool_name === 'toggle_annotation_track') &&
                  parsed.parameters
                ) {
                  const estimatedTimestamp = now - (conversationHistory.length - 1 - i) * 1000;

                  if (now - estimatedTimestamp < timeWindowMs) {
                    // Get recent track name from either trackName or track_name parameter
                    const recentTrack = parsed.parameters?.trackName || parsed.parameters?.track_name;
                    const recentAction = parsed.parameters?.action;
                    const recentVisible = parsed.parameters?.visible;

                    // Convert recent action to visible state for comparison
                    let recentVisibleState = recentVisible;
                    if (recentVisibleState === undefined && recentAction) {
                      recentVisibleState = recentAction === 'show';
                    }

                    // If same track and same action, block it
                    const normalizedRecentTrack = normalizeTrackName(recentTrack);
                    if (
                      normalizedCurrentTrack === normalizedRecentTrack &&
                      currentVisibleState === recentVisibleState
                    ) {
                      console.log(
                        `🚫 [Policy] Track toggle rate limited for same track with same action: ${currentTrack} (${currentAction || currentVisible})`
                      );
                      return false;
                    }
                  }
                }
              } catch (e) {
                // Try to parse as multiple tool calls
                try {
                  const multipleToolCalls = this.chatManager.parseMultipleToolCalls(msg.content);
                  const matchingTool = multipleToolCalls.find(
                    t => t.tool_name === 'toggle_track' || t.tool_name === 'toggle_annotation_track'
                  );

                  if (matchingTool && matchingTool.parameters) {
                    const estimatedTimestamp = now - (conversationHistory.length - 1 - i) * 1000;

                    if (now - estimatedTimestamp < timeWindowMs) {
                      // Get recent track name from either trackName or track_name parameter
                      const recentTrack = matchingTool.parameters?.trackName || matchingTool.parameters?.track_name;
                      const recentAction = matchingTool.parameters?.action;
                      const recentVisible = matchingTool.parameters?.visible;

                      // Convert recent action to visible state for comparison
                      let recentVisibleState = recentVisible;
                      if (recentVisibleState === undefined && recentAction) {
                        recentVisibleState = recentAction === 'show';
                      }

                      // If same track and same action, block it
                      const normalizedRecentTrack = normalizeTrackName(recentTrack);
                      if (
                        normalizedCurrentTrack === normalizedRecentTrack &&
                        currentVisibleState === recentVisibleState
                      ) {
                        console.log(
                          `🚫 [Policy] Track toggle rate limited for same track with same action: ${currentTrack} (${currentAction || currentVisible})`
                        );
                        return false;
                      }
                    }
                  }
                } catch (e2) {
                  // Not a tool call, continue
                }
              }
            }
          }

          return true;
        },
      },

      // State operations - parameter-based to prevent repetition
      state: {
        tools: [
          'get_current_state',
          'get_genome_info',
          'get_file_info',
          'get_sequence',
          'get_current_region',
          'get_visible_tracks',
        ],
        policy: 'parameter_based',
        condition: (tool, history, results) => {
          const existingExecution = this.chatManager.findExistingExecution(toolKey, history);
          if (existingExecution && existingExecution.success) {
            console.log(`🚫 [Policy] State operation already executed with same parameters: ${toolName}`);
            return false;
          }
          return true;
        },
      },

      // External API operations - prevent rapid re-execution
      external_api: {
        tools: [
          'blast_search',
          'fetch_protein_structure',
          'get_uniprot_entry',
          'search_uniprot_database',
          'fetch_alphafold_structure',
        ],
        policy: 'rate_limited',
        condition: (tool, history, results) => {
          const recentExecution = this.chatManager.findRecentExecution(toolName, history, 30000); // 30 seconds
          if (recentExecution) {
            console.log(`🚫 [Policy] External API operation rate limited: ${toolName}`);
            return false;
          }
          return true;
        },
      },
    };

    // Find applicable policy
    let applicablePolicy = null;
    for (const [policyName, policy] of Object.entries(toolPolicies)) {
      if (policy.tools.includes(toolName)) {
        applicablePolicy = policy;
        console.log(`🎯 [Policy] Applied ${policyName} policy to ${toolName}`);
        break;
      }
    }

    // Default policy for unknown tools - allow once
    if (!applicablePolicy) {
      console.log(`⚠️ [Policy] Unknown tool, applying default once-per-round policy: ${toolName}`);
      const alreadyExecuted = this.chatManager.wasToolExecutedSuccessfully(toolKey, conversationHistory);
      return !alreadyExecuted;
    }

    // Apply the policy condition
    return applicablePolicy.condition(tool, conversationHistory, toolResults, currentRound);
  }

  generateSingleToolResponse(tool, result) {
    // Generate appropriate response based on tool type
    switch (tool.tool_name) {
      case 'jump_to_gene':
        if (result.result && result.result.success !== false) {
          const geneName = tool.parameters.geneName || tool.parameters.name || 'target gene';
          return `🎯 **Successfully jumped to gene ${geneName}!**

**Navigation Details:**
- **Gene:** ${geneName}
- **Location:** ${result.result.location || result.result.position || 'Located'}
- **Status:** Gene found and browser navigated to location

The genome browser is now showing the ${geneName} gene region.`;
        } else {
          const geneName = tool.parameters.geneName || tool.parameters.name || 'target gene';
          return `Gene navigation completed. ${result.result?.message || `Attempted to locate ${geneName}`}.`;
        }

      case 'open_new_tab':
        if (result.result && result.result.success) {
          return `🗂️ **New tab opened successfully!**

**Tab Details:**
- **Tab ID:** ${result.result.tabId || 'N/A'}
- **Title:** ${result.result.title || 'New Tab'}
- **Message:** ${result.result.message || 'Tab created'}

The new tab is ready for analysis and comparison.`;
        } else {
          return 'New tab creation completed, but there may have been issues.';
        }

      case 'create_annotation':
        return result.result?.success
          ? `✅ Annotation created successfully: ${result.result.message || 'New annotation added'}`
          : 'Annotation creation completed with potential issues.';

      case 'export_data':
        return result.result?.success
          ? `✅ Data exported successfully: ${result.result.filePath || result.result.message || 'Export completed'}`
          : 'Data export completed with potential issues.';

      case 'load_genome_file':
        if (result.result && result.result.success) {
          return `✅ **Genome file loaded successfully!**

**File Details:**
- **File Path:** ${result.result.filePath || 'N/A'}
- **File Type:** ${result.result.fileType || 'Genome'}
- **Load Time:** ${new Date(result.result.timestamp).toLocaleString()}

The genome file has been loaded and is ready for analysis.`;
        } else {
          return 'Genome file loading completed, but there may have been issues. Please check the file format and try again.';
        }

      case 'load_annotation_file':
        return result.result?.success
          ? `✅ Annotation file loaded successfully from: ${result.result.filePath || 'selected file'}`
          : 'Annotation file loading completed with potential issues.';

      case 'load_variant_file':
        return result.result?.success
          ? `✅ Variant file loaded successfully from: ${result.result.filePath || 'selected file'}`
          : 'Variant file loading completed with potential issues.';

      case 'load_reads_file':
        return result.result?.success
          ? `✅ Reads file loaded successfully from: ${result.result.filePath || 'selected file'}`
          : 'Reads file loading completed with potential issues.';

      case 'load_wig_tracks':
        return result.result?.success
          ? `✅ WIG tracks loaded successfully. ${result.result.count || 1} file(s) processed.`
          : 'WIG tracks loading completed with potential issues.';

      case 'load_operon_file':
        return result.result?.success
          ? `✅ Operon file loaded successfully from: ${result.result.filePath || 'selected file'}`
          : 'Operon file loading completed with potential issues.';

      case 'analyze_interpro_domains':
        if (result.result && result.result.success) {
          const domains = result.result.domain_architecture || [];
          const proteinInfo = result.result.protein_info || {};
          return `🔬 **InterPro Domain Analysis Completed!**

**Protein Information:**
- **Name:** ${proteinInfo.name || 'Unknown'}
- **ID:** ${proteinInfo.id || 'N/A'}
- **Organism:** ${proteinInfo.organism || 'Unknown'}
- **Length:** ${result.result.sequence_length || 'Unknown'} amino acids

**Domain Analysis Results:**
- **Total Domains Found:** ${domains.length}
- **Domain Coverage:** ${result.result.summary?.domain_coverage || 'Unknown'}%
- **Databases Searched:** ${result.result.analysis_parameters?.applications?.join(', ') || 'Multiple'}

**Top Domains:**
${domains
              .slice(0, 3)
              .map(domain => `- **${domain.name}** (${domain.database}): ${domain.start}-${domain.end} (E-value: ${domain.evalue})`)
              .join('\n')}

${domains.length > 3 ? `... and ${domains.length - 3} more domains` : ''}

InterPro domain analysis has been completed successfully.`;
        } else {
          return `InterPro domain analysis completed. ${result.result?.message || result.result?.error || 'Analysis finished.'}`;
        }

      case 'export_fasta_sequence':
        if (result.result && result.result.success) {
          return `🧬 **FASTA Sequence Export Completed!**

**Export Details:**
- **Format:** ${result.result.exported_format}
- **File:** ${result.result.filename}
- **Chromosomes:** ${result.result.total_chromosomes}
- **Total Length:** ${result.result.total_length?.toLocaleString()} bp

✅ ${result.result.message}
${result.result.details}`;
        } else {
          return `FASTA export completed. ${result.result?.message || result.result?.error || 'Export finished.'}`;
        }

      case 'export_genbank_format':
        if (result.result && result.result.success) {
          return `📄 **GenBank Format Export Completed!**

**Export Details:**
- **Format:** ${result.result.exported_format}
- **File:** ${result.result.filename}
- **Chromosomes:** ${result.result.total_chromosomes}
- **Features:** ${result.result.total_features}
- **Protein Sequences:** ${result.result.include_protein_sequences ? 'Included' : 'Not included'}

✅ ${result.result.message}
${result.result.details}`;
        } else {
          return `GenBank export completed. ${result.result?.message || result.result?.error || 'Export finished.'}`;
        }

      case 'export_cds_fasta':
        if (result.result && result.result.success) {
          return `🧬 **CDS FASTA Export Completed!**

**Export Details:**
- **Format:** ${result.result.exported_format}
- **File:** ${result.result.filename}
- **CDS Sequences:** ${result.result.total_cds_sequences}
- **Gene Names:** ${result.result.include_gene_names ? 'Included' : 'Not included'}

✅ ${result.result.message}
${result.result.details}`;
        } else {
          return `CDS FASTA export completed. ${result.result?.message || result.result?.error || 'Export finished.'}`;
        }

      case 'export_protein_fasta':
        if (result.result && result.result.success) {
          return `🧬 **Protein FASTA Export Completed!**

**Export Details:**
- **Format:** ${result.result.exported_format}
- **File:** ${result.result.filename}
- **Protein Sequences:** ${result.result.total_protein_sequences}
- **Translation Table:** ${result.result.translation_table}

✅ ${result.result.message}
${result.result.details}`;
        } else {
          return `Protein FASTA export completed. ${result.result?.message || result.result?.error || 'Export finished.'}`;
        }

      case 'export_gff_annotations':
        if (result.result && result.result.success) {
          return `📋 **GFF Annotations Export Completed!**

**Export Details:**
- **Format:** ${result.result.exported_format}
- **File:** ${result.result.filename}
- **Features:** ${result.result.total_features}
- **Feature Types:** ${result.result.feature_types?.join(', ') || 'Various'}

✅ ${result.result.message}
${result.result.details}`;
        } else {
          return `GFF export completed. ${result.result?.message || result.result?.error || 'Export finished.'}`;
        }

      case 'export_bed_format':
        if (result.result && result.result.success) {
          return `📊 **BED Format Export Completed!**

**Export Details:**
- **Format:** ${result.result.exported_format}
- **File:** ${result.result.filename}
- **Features:** ${result.result.total_features}
- **Score/Strand:** ${result.result.include_score && result.result.include_strand ? 'Included' : 'Basic format'}

✅ ${result.result.message}
${result.result.details}`;
        } else {
          return `BED export completed. ${result.result?.message || result.result?.error || 'Export finished.'}`;
        }

      case 'export_current_view_fasta':
        if (result.result && result.result.success) {
          return `👁️ **Current View FASTA Export Completed!**

**Export Details:**
- **Format:** ${result.result.exported_format}
- **File:** ${result.result.filename}
- **Region:** ${result.result.coordinates}
- **Length:** ${result.result.region_length?.toLocaleString()} bp

✅ ${result.result.message}
${result.result.details}`;
        } else {
          return `Current view export completed. ${result.result?.message || result.result?.error || 'Export finished.'}`;
        }

      case 'search_gene_by_name':
        if (result.result && result.result.length > 0) {
          const gene = result.result[0]; // Get first result
          return `Found the gene "${gene.name || gene.symbol || 'Unknown'}". Here are the details:

**Gene Information:**
- Name: ${gene.name || 'N/A'}
- Symbol: ${gene.symbol || 'N/A'}
- Location: ${gene.location || 'N/A'}
- Strand: ${gene.strand || 'N/A'}
- Length: ${gene.length || 'N/A'} bp

The gene search has been completed successfully.`;
        } else {
          return 'Gene search completed, but no matching genes were found in the current genome.';
        }

      case 'search_sequence':
        return `Sequence search completed successfully. Found ${result.result?.length || 0} matching sequence(s).`;

      case 'find_feature':
        return `Feature search completed successfully. Found ${result.result?.length || 0} matching feature(s).`;

      case 'codon_usage_analysis':
        if (result.result) {
          const data = result.result;
          const geneInfo = data.geneName ? ` for gene **${data.geneName}**` : '';
          const locusInfo = data.locusTag ? ` (locus tag: ${data.locusTag})` : '';

          let response = `## Codon Usage Analysis Results${geneInfo}${locusInfo}

**Analysis Summary:**
- **Total Codons**: ${data.totalCodons}
- **Unique Codons**: ${data.uniqueCodons}
- **Sequence Length**: ${data.sequenceLength} bp
- **Analysis Type**: ${data.analysisType}

**Top 10 Most Frequent Codons:**
${data.mostFrequentCodons
              .slice(0, 10)
              .map(
                codon =>
                  `- **${codon.codon}** (${codon.aminoAcid}): ${codon.frequency}% (${codon.count} occurrences)${codon.rscu ? ` - RSCU: ${codon.rscu}` : ''}`
              )
              .join('\n')}

**Amino Acid Composition:**
${Object.entries(data.aminoAcidComposition)
              .sort(([, a], [, b]) => b - a)
              .slice(0, 10)
              .map(([aa, count]) => `- **${aa}**: ${count} codons`)
              .join('\n')}`;

          // Add codon preferences if available
          if (data.codonPreferences && Object.keys(data.codonPreferences).length > 0) {
            response += `\n\n**Codon Preferences by Amino Acid:**\n`;
            const sortedAAs = Object.entries(data.codonPreferences)
              .filter(([aa]) => aa !== '*') // Exclude stop codons
              .sort(([, a], [, b]) => b.totalCount - a.totalCount)
              .slice(0, 10);

            for (const [aa, pref] of sortedAAs) {
              response += `\n**${aa}** (${pref.totalCount} total, ${pref.synonymousCodons} synonymous codons):\n`;
              for (const codonInfo of pref.codons) {
                const prefIcon =
                  codonInfo.preference === 'preferred' ? '⭐' : codonInfo.preference === 'rare' ? '⚠️' : '▪️';
                response += `  ${prefIcon} ${codonInfo.codon}: ${codonInfo.percentage}% (RSCU: ${codonInfo.rscu}, ${codonInfo.preference})\n`;
              }
            }
          }

          response += `\nThe codon usage analysis has been completed successfully.`;
          return response;
        } else {
          return 'Codon usage analysis completed, but no results were obtained.';
        }

      case 'genome_codon_usage_analysis':
        if (result.result) {
          const data = result.result;
          let response = `## Genome-Wide Codon Usage Analysis Results

**Analysis Summary:**
- **Total Genes Analyzed**: ${data.totalGenes}
- **Total Codons**: ${data.totalCodons}
- **Unique Codons**: ${data.uniqueCodons}
- **Total Sequence Length**: ${data.totalSequenceLength} bp
- **Chromosomes**: ${data.chromosomes?.join(', ')}
- **Feature Type**: ${data.featureType}
- **Minimum Length Filter**: ${data.minLength} bp

**Top 10 Most Frequent Codons (Genome-Wide):**
${data.mostFrequentCodons
              .slice(0, 10)
              .map(
                codon =>
                  `- **${codon.codon}** (${codon.aminoAcid}): ${codon.frequency}% (${codon.count} occurrences) - RSCU: ${codon.rscu}`
              )
              .join('\n')}

**GC Content by Codon Position:**
- **Position 1**: ${data.gcContent?.position1}%
- **Position 2**: ${data.gcContent?.position2}%
- **Position 3**: ${data.gcContent?.position3}%
- **Overall**: ${data.gcContent?.overall}%`;

          // Add comprehensive genome-wide synonymous codon preferences
          if (data.codonPreferences && Object.keys(data.codonPreferences).length > 0) {
            response += `

## Synonymous Codon Preference Analysis

`;
            response += `This analysis shows how the genome uses different codons for each amino acid. Higher RSCU values (>1.0) indicate preferred codons, while lower values (<1.0) indicate less preferred codons.\n`;

            const sortedAAs = Object.entries(data.codonPreferences)
              .filter(([aa]) => aa !== '*') // Exclude stop codons
              .sort(([, a], [, b]) => b.totalCount - a.totalCount);

            // Group by number of synonymous codons
            const multiCodonAAs = sortedAAs.filter(([, pref]) => pref.synonymousCodons > 1);
            const singleCodonAAs = sortedAAs.filter(([, pref]) => pref.synonymousCodons === 1);

            response += `\n### Multi-Codon Amino Acids (${multiCodonAAs.length} amino acids with codon bias)\n`;

            for (const [aa, pref] of multiCodonAAs) {
              // Get amino acid full name
              const aaNames = {
                A: 'Alanine',
                R: 'Arginine',
                N: 'Asparagine',
                D: 'Aspartic acid',
                C: 'Cysteine',
                Q: 'Glutamine',
                E: 'Glutamic acid',
                G: 'Glycine',
                H: 'Histidine',
                I: 'Isoleucine',
                L: 'Leucine',
                K: 'Lysine',
                F: 'Phenylalanine',
                P: 'Proline',
                S: 'Serine',
                T: 'Threonine',
                Y: 'Tyrosine',
                V: 'Valine',
                W: 'Tryptophan',
                M: 'Methionine',
              };

              const aaFullName = aaNames[aa] || aa;
              const biasLevel =
                pref.statistics.biasStrength >= 75
                  ? 'Very Strong'
                  : pref.statistics.biasStrength >= 50
                    ? 'Strong'
                    : pref.statistics.biasStrength >= 25
                      ? 'Moderate'
                      : 'Weak';

              response += `\n**${aa} - ${aaFullName}** (${pref.totalCount.toLocaleString()} occurrences, ${pref.synonymousCodons} synonymous codons)\n`;
              response += `  📊 Bias Strength: ${biasLevel} (${pref.statistics.biasStrength}%) | Effective # of Codons: ${pref.statistics.effectiveNumberOfCodons}/${pref.synonymousCodons}\n`;
              response += `  📈 Usage Distribution: Mean=${pref.statistics.mean}%, StdDev=${pref.statistics.stdDev}%, CV=${pref.statistics.coefficientOfVariation}%\n`;
              response += `  \n`;

              // Show all codons with visual indicators
              for (const codonInfo of pref.codons) {
                // Visual preference indicator
                let prefIcon;
                if (codonInfo.preference === 'highly preferred') prefIcon = '🌟🌟';
                else if (codonInfo.preference === 'preferred') prefIcon = '🌟';
                else if (codonInfo.preference === 'rare') prefIcon = '▫️';
                else if (codonInfo.preference === 'highly rare') prefIcon = '❌';
                else prefIcon = '▪️';

                // Create visual bar for percentage
                const barLength = Math.round((codonInfo.percentage / 100) * 20);
                const bar = '█'.repeat(barLength) + '░'.repeat(20 - barLength);

                response += `    ${prefIcon} **${codonInfo.codon}**: ${codonInfo.percentage}% |${bar}| RSCU: ${codonInfo.rscu} (${codonInfo.count.toLocaleString()} uses)\n`;
              }
            }

            // Add single-codon amino acids summary
            if (singleCodonAAs.length > 0) {
              response += `\n### Single-Codon Amino Acids (${singleCodonAAs.length} amino acids with no codon bias)\n`;
              for (const [aa, pref] of singleCodonAAs) {
                const aaNames = {
                  W: 'Tryptophan',
                  M: 'Methionine',
                };
                const aaFullName = aaNames[aa] || aa;
                const codon = pref.codons[0];
                response += `- **${aa} - ${aaFullName}**: ${codon.codon} (${pref.totalCount.toLocaleString()} occurrences, no alternatives)\n`;
              }
            }

            // Add interpretation guide
            response += `\n### Understanding the Results\n\n`;
            response += `**RSCU (Relative Synonymous Codon Usage):**\n`;
            response += `- RSCU > 1.5: Highly preferred codon (used much more than expected)\n`;
            response += `- RSCU 1.0-1.5: Preferred codon (used more than average)\n`;
            response += `- RSCU 0.6-1.0: Neutral/slightly disfavored\n`;
            response += `- RSCU 0.3-0.6: Rare codon (used less than average)\n`;
            response += `- RSCU < 0.3: Highly rare codon (strongly avoided)\n\n`;
            response += `**Bias Strength:** Indicates how strongly the genome prefers certain synonymous codons over others.\n`;
            response += `**Effective # of Codons (ENC):** If all synonymous codons were used equally, ENC would equal the number of synonymous codons. Lower ENC indicates stronger bias.\n`;
          }

          response += `\n\nThe genome-wide codon usage analysis has been completed successfully.`;
          return response;
        } else {
          return 'Genome-wide codon usage analysis completed, but no results were obtained.';
        }

      default:
        // For unknown tools (including MCP tools), show full results if available
        if (result.result) {
          // Check if result.result is an object with useful data
          if (typeof result.result === 'object' && result.result !== null) {
            // Check if this is a task ID response (from Deep Gene Research)
            if (result.result.taskId && result.result.status) {
              // This is a task ID response - we'll start polling for status updates
              const taskId = result.result.taskId;
              const initialStatus = result.result.status;
              const createdAt = result.result.createdAt || new Date().toISOString();

              // Store task info for polling
              const taskInfo = {
                taskId: taskId,
                serverId: tool.serverId,
                serverName: tool.serverName,
                toolName: tool.tool_name,
                status: initialStatus,
                createdAt: createdAt,
                lastUpdated: new Date().toISOString(),
                messageElement: null, // Will store the message element for updates
              };

              // Start polling for task status
              this.chatManager.startTaskPolling(taskInfo);

              // Return initial task status message
              return (
                `✅ **Deep Gene Research Task Started**\n\n` +
                `📋 **Task ID**: ${taskId}\n` +
                `📊 **Status**: ${initialStatus}\n` +
                `⏱️ **Created**: ${new Date(createdAt).toLocaleString()}\n\n` +
                `🔄 The system will automatically update this message as the research progresses...`
              );
            }
            // If result has a summary or message, use it
            else if (result.result.summary || result.result.message) {
              return `✅ **Tool Execution Results for ${tool.tool_name}**\n\n${result.result.summary || result.result.message}`;
            } else {
              // Otherwise, try to format the entire result
              try {
                // Convert to string for display
                const resultString = JSON.stringify(result.result, null, 2);
                return `✅ **Tool Execution Results for ${tool.tool_name}**\n\n**Full Results:**\n\`\`\`json\n${resultString}\n\`\`\``;
              } catch (e) {
                return `✅ **Tool Execution Results for ${tool.tool_name}**\n\nResults obtained but could not be formatted: ${String(result.result)}`;
              }
            }
          } else {
            // If result.result is a simple value, display it directly
            return `✅ **Tool Execution Results for ${tool.tool_name}**\n\n${result.result}`;
          }
        } else {
          return `Task completed successfully using ${tool.tool_name}. Results have been processed.`;
        }
    }
  }

  getAllToolsDetailed(context) {
    const mcpServers = this.chatManager.mcpServerManager.getServerStatus();
    const connectedServers = mcpServers.filter(s => s.connected);
    const toolsByCategory = this.chatManager.mcpServerManager.getToolsByCategory();

    let toolsInfo = `COMPREHENSIVE TOOLS DOCUMENTATION:

TOOL STATISTICS:
- Total Available Tools: ${context.genomeBrowser.toolSources.total}
- Local/Built-in Tools: ${context.genomeBrowser.toolSources.local}
- Plugin Tools: ${context.genomeBrowser.toolSources.plugins}
- MCP Server Tools: ${context.genomeBrowser.toolSources.mcp}

MCP SERVER TOOLS:`;

    if (connectedServers.length > 0) {
      toolsInfo += `
Connected Servers: ${connectedServers.length}
${connectedServers.map(server => `- ${server.name} (${server.category}): ${server.toolCount} tools`).join('\n')}

MCP Tools by Category:
${Object.entries(toolsByCategory)
          .map(
            ([category, tools]) =>
              `${category.toUpperCase()}:\n${tools
                .map(tool => `  - ${tool.name}: ${tool.description || 'No description'}`)
                .join('\n')}`
          )
          .join('\n\n')}`;
    } else {
      toolsInfo += `
No MCP servers connected. Available tools are limited to local and plugin functions.`;
    }

    // Add MicrobeGenomics Functions details
    if (this.chatManager.MicrobeFns) {
      try {
        const categories = this.chatManager.MicrobeFns.getFunctionCategories();
        toolsInfo += `

MICROBE GENOMICS FUNCTIONS:
${Object.entries(categories)
            .map(
              ([category, info]) =>
                `${category.toUpperCase()} (${info.description}):\n${info.functions
                  .map(
                    fn =>
                      `  - ${fn}: Use as "${fn
                        .toLowerCase()
                        .replace(/([A-Z])/g, '_$1')
                        .toLowerCase()}"`
                  )
                  .join('\n')}`
            )
            .join('\n\n')}`;
      } catch (error) {
        toolsInfo += `\nMicrobeGenomics Functions: Available but details unavailable`;
      }
    }

    // Add Plugin Tools details
    if (this.chatManager.pluginFunctionCallsIntegrator) {
      try {
        const pluginInfo = this.chatManager.pluginFunctionCallsIntegrator.getPluginFunctionsSystemInfo();
        const stats = this.chatManager.pluginFunctionCallsIntegrator.getPluginFunctionStats();

        toolsInfo += `

PLUGIN SYSTEM TOOLS:
Total Plugin Functions: ${stats.totalFunctions}
Available Plugins: ${Object.keys(stats.pluginCounts).join(', ')}
Function Categories: ${Object.keys(stats.categoryStats).join(', ')}

${pluginInfo}`;
      } catch (error) {
        toolsInfo += `\nPlugin Tools: Available but details unavailable`;
      }
    }

    // Add comprehensive tool examples
    toolsInfo += `

CORE LOCAL TOOLS:
Navigation & State:
  - navigate_to_position: Navigate to specific chromosome position
  - get_current_state: Get current browser state
  - jump_to_gene: Navigate to specific gene
  - zoom_in/zoom_out: Adjust view zoom level
  - scroll_left/scroll_right: Pan the view

Search & Discovery:
  - search_features: Search for features by text
  - search_gene_by_name: Find specific genes
  - search_motif: Find sequence motifs
  - search_by_position: Find features near position

Sequence Analysis:
  - get_sequence: Extract DNA sequence
  - translate_dna: Translate DNA to protein
  - compute_gc: Calculate GC content
  - reverse_complement: Get reverse complement
  - sequence_statistics: Analyze sequence composition

Advanced Analysis:
  - analyze_region: Comprehensive region analysis
  - blast_search: BLAST sequence similarity
  - predict_promoter: Predict promoter regions
  - find_restriction_sites: Find enzyme cut sites
  - show_metabolic_pathway: Display pathway diagrams

Annotation & Data:
  - create_annotation: Add new annotations
  - toggle_track: Show/hide data tracks
  - export_data: Export in various formats
  - get_genome_info: Get genome metadata

Track Settings:
  - get_track_settings: Get current settings for a specific track type
  - set_track_settings: Update settings for a specific track type
  - get_all_track_settings: Get all track settings at once
  - reset_track_settings: Reset track settings to defaults (single or all tracks)
  - get_track_settings_schema: Get complete settings schema with types and defaults
  - batch_set_track_settings: Batch update multiple track settings at once

Primer Design & PCR:
  - calculate_primer_properties: Calculate melting temp, GC content for a primer
  - design_primers: Design a full PCR primer pair for a given sequence
  - find_primer_binding_sites: Find binding locations of a primer on the genome
  - add_primer_annotation: Add an interactive primer display to the genome track

Protein Structure:
  - open_protein_viewer: Display 3D protein structures
  - fetch_protein_structure: Get PDB structure data
  - search_pdb_structures: Find experimental protein structures from PDB database

TOOL USAGE EXAMPLES:
Basic Navigation:
  {"tool_name": "navigate_to_position", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
  {"tool_name": "navigate_to_position", "parameters": {"chromosome": "COLI-K12", "position": 2000000}}
  {"tool_name": "jump_to_gene", "parameters": {"geneName": "lacZ"}}
  {"tool_name": "zoom_in", "parameters": {"factor": 2}}
  {"tool_name": "zoom_out", "parameters": {"factor": 3}}
  {"tool_name": "open_new_tab", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
  {"tool_name": "open_new_tab", "parameters": {"geneName": "lacZ"}}

Sequence Analysis:
  {"tool_name": "get_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
  {"tool_name": "compute_gc", "parameters": {"sequence": "ATGCGCTATCG"}}
  {"tool_name": "translate_dna", "parameters": {"dna": "ATGAAATAG", "frame": 0}}

Search Operations:
  {"tool_name": "search_gene_by_name", "parameters": {"name": "lacZ"}}
  {"tool_name": "search_features", "parameters": {"query": "DNA polymerase", "caseSensitive": false}}
  {"tool_name": "search_motif", "parameters": {"pattern": "GAATTC", "allowMismatches": 0}}

Advanced Analysis:
  {"tool_name": "blast_search", "parameters": {"sequence": "ATGCGCTATCG", "blastType": "blastn", "database": "nt"}}
  {"tool_name": "predict_promoter", "parameters": {"seq": "ATGCTATAAT"}}
  {"tool_name": "show_metabolic_pathway", "parameters": {"pathway": "glycolysis"}}

Protein Structure:
  {"tool_name": "open_protein_viewer", "parameters": {"pdbId": "1TUP"}}
  {"tool_name": "search_pdb_structures", "parameters": {"geneName": "p53", "organism": "Homo sapiens"}}

Data Management:
  {"tool_name": "create_annotation", "parameters": {"type": "gene", "name": "test_gene", "chromosome": "chr1", "start": 1000, "end": 2000}}
  {"tool_name": "export_data", "parameters": {"format": "fasta", "chromosome": "chr1", "start": 1000, "end": 2000}}

Track Settings:
  {"tool_name": "get_track_settings", "parameters": {"track_type": "genes"}}
  {"tool_name": "set_track_settings", "parameters": {"track_type": "reads", "settings": {"readHeight": 8, "showMismatches": true}}}
  {"tool_name": "get_all_track_settings", "parameters": {}}
  {"tool_name": "reset_track_settings", "parameters": {"track_type": "all"}}
  {"tool_name": "get_track_settings_schema", "parameters": {}}
  {"tool_name": "batch_set_track_settings", "parameters": {"settings_map": {"genes": {"height": 200}, "reads": {"readHeight": 6}}}}
  
Primer Tools:
  {"tool_name": "calculate_primer_properties", "parameters": {"sequence": "ATGCGCTAGCATCAT"}}
  {"tool_name": "design_primers", "parameters": {"geneName": "lacZ", "targetTm": 60.5}}
  {"tool_name": "find_primer_binding_sites", "parameters": {"primerSequence": "ATGCGTAC", "chromosome": "chr1"}}
  {"tool_name": "add_primer_annotation", "parameters": {"name": "Test_Fwd", "chromosome": "chr1", "start": 1000, "end": 1020, "strand": "+"}}`;

    return toolsInfo;
  }

  getOptimizedSystemMessage() {
    const toolPriority = this.chatManager.getToolPriorityString();

    return `You are an AI assistant for CodeXomics, a comprehensive bioinformatics application. You have access to powerful genomic analysis, protein structure, and sequence analysis tools.

IMPORTANT: Task Completion Instructions
When you complete a user's task or fully answer their question, end with a clear completion indicator like "Task completed", "Analysis finished", or "In summary" to signal completion efficiently.

${this.chatManager.getOptimizedToolContext()}

===FUNCTION CALLING FORMAT===
CRITICAL: Always respond with ONLY a JSON object when using tools. No explanatory text around the JSON.
Format: {"tool_name": "tool_name", "parameters": {"param": "value"}}

${toolPriority}

CRITICAL: The system will automatically route tool requests based on the priority order above. You should use tool names without worrying about which category they belong to - the system will find and execute them in the correct priority order. The priority order ensures that local tools are tried first (fastest), followed by specialized genomics tools, then plugins, and finally MCP server tools.

===PROTEIN STRUCTURE SEARCH DISAMBIGUATION===
CRITICAL: Choose the correct protein structure function based on user intent:

• For PDB database searches (experimental structures):
  - Keywords: "PDB", "PDB database", "experimental structure", "crystal structure", "NMR structure", "cryo-EM"
  - Use: search_pdb_structures
  - Example: "search PDB experimental structures for lysC" → search_pdb_structures

• For AlphaFold predictions (AI-predicted structures):
  - Keywords: "AlphaFold", "predicted structure", "AI prediction", "fold prediction"
  - Use: search_alphafold_by_gene
  - Example: "find AlphaFold structure for lysC" → search_alphafold_by_gene

• Default behavior (when unspecified):
  - If user mentions "PDB" explicitly → use search_pdb_structures
  - If user mentions "AlphaFold" explicitly → use search_alphafold_by_gene
  - If context is unclear, prefer search_pdb_structures for experimental data

===SEQUENCE EDITING FUNCTIONS - DETAILED USAGE===

SEQUENCE EDITING WORKFLOW:
1. Find gene location: search_gene_by_name
2. Use appropriate editing function (deleteSequence, insertSequence, etc.)
3. Execute all pending actions: execute_actions
4. IMPORTANT: Actions are queued until execute_actions is called

EDITING FUNCTIONS WITH PARAMETERS:

• delete_sequence - Delete a DNA sequence region
  Parameters: chromosome (string), start (number), end (number), strand (optional: "+" or "-")
  Example: {"tool_name": "delete_sequence", "parameters": {"chromosome": "COLI-K12", "start": 1000, "end": 2000}}

• delete_gene - Delete a gene by name or locus tag (automatically finds gene coordinates)
  Parameters: geneName (string - gene name or locus tag), chromosome (optional string - will auto-detect if not provided)
  Example: {"tool_name": "delete_gene", "parameters": {"geneName": "yaaJ"}}
  Example: {"tool_name": "delete_gene", "parameters": {"geneName": "b0005"}}
  Example: {"tool_name": "delete_gene", "parameters": {"geneName": "lacZ", "chromosome": "COLI-K12"}}

• insert_sequence - Insert DNA sequence at a specific position
  Parameters: chromosome (string), position (number), sequence (string - DNA only: A,T,C,G,N)
  Example: {"tool_name": "insert_sequence", "parameters": {"chromosome": "COLI-K12", "position": 1000, "sequence": "ATGCGCTAT"}}

• replace_sequence - Replace sequence in a region with new sequence
  Parameters: chromosome (string), start (number), end (number), sequence (string), strand (optional)
  Example: {"tool_name": "replace_sequence", "parameters": {"chromosome": "COLI-K12", "start": 1000, "end": 1500, "sequence": "ATGCGC"}}

• copy_sequence - Copy sequence region to clipboard
  Parameters: chromosome (string), start (number), end (number), strand (optional)
  Example: {"tool_name": "copy_sequence", "parameters": {"chromosome": "COLI-K12", "start": 1000, "end": 1500}}

• cut_sequence - Cut sequence (copy to clipboard and mark for deletion)
  Parameters: chromosome (string), start (number), end (number), strand (optional)
  Example: {"tool_name": "cut_sequence", "parameters": {"chromosome": "COLI-K12", "start": 1000, "end": 1500}}

• paste_sequence - Paste sequence from clipboard
  Parameters: chromosome (string), position (number)
  Example: {"tool_name": "paste_sequence", "parameters": {"chromosome": "COLI-K12", "position": 2000}}

• execute_actions - Execute all queued sequence editing actions
  Parameters: confirm (optional boolean, default: false)
  Example: {"tool_name": "execute_actions", "parameters": {}}

• get_action_list - View current action queue
  Parameters: status (optional: "all", "pending", "completed", "failed")
  Example: {"tool_name": "get_action_list", "parameters": {"status": "pending"}}

CRITICAL GENE DELETION WORKFLOW:
Method 1 - Simple gene deletion by name or locus tag:
1. {"tool_name": "delete_gene", "parameters": {"geneName": "yaaJ"}}  (by gene name)
1. {"tool_name": "delete_gene", "parameters": {"geneName": "b0005"}}  (by locus tag)
2. {"tool_name": "execute_actions", "parameters": {}}

Method 2 - Manual deletion with coordinates:
1. {"tool_name": "search_gene_by_name", "parameters": {"name": "yaaJ"}}
2. Use gene coordinates from result in deleteSequence
3. {"tool_name": "deleteSequence", "parameters": {"chromosome": "COLI-K12", "start": [gene_start], "end": [gene_end]}}
4. {"tool_name": "execute_actions", "parameters": {}}

CHROMOSOME NAMES:
- Current genome uses "COLI-K12" as chromosome identifier
- Always use the exact chromosome name from current genome state

COMMON TASK PATTERNS:
• Gene Analysis: search_gene_by_name → get_coding_sequence → analyze features
• **Domain Analysis: analyze_interpro_domains → protein domain identification (use geneName parameter for gene names)**
• **Data Export: export_fasta_sequence → export genome as FASTA, export_genbank_format → export as GenBank**
• **Sequence Export: export_cds_fasta → export coding sequences, export_protein_fasta → export proteins**
• **Annotation Export: export_gff_annotations → export features as GFF, export_bed_format → export as BED**
• AlphaFold AI Predictions: search_alphafold_by_gene → open_alphafold_viewer
• PDB Experimental Structures: search_pdb_structures → open_protein_viewer
• Sequence Analysis: get_sequence → compute_gc/translate_dna
• Navigation: jump_to_gene → navigate_to_position
• New Tab: open_new_tab → for parallel analysis
• BLAST Search: blast_search → analyze results
• Pathway Analysis: show_metabolic_pathway → find_pathway_genes
• Gene Deletion: search_gene_by_name → deleteSequence → execute_actions
• Sequence Insertion: insertSequence → execute_actions
• Copy/Paste: copy_sequence → paste_sequence → execute_actions
• Track Settings: get_track_settings → set_track_settings or batch_set_track_settings
• Track Configuration: get_track_settings_schema → set_track_settings (use schema to know valid settings)

===CRITICAL DOMAIN ANALYSIS INSTRUCTIONS===
For protein domain analysis requests:
• **"domain analysis of [gene]" → use analyze_interpro_domains with geneName parameter**
• **"analyze domains in [gene]" → use analyze_interpro_domains with geneName parameter**
• **"find domains for [gene]" → use analyze_interpro_domains with geneName parameter**
• Example: {"tool_name": "analyze_interpro_domains", "parameters": {"geneName": "lysC"}}
• For sequence input: {"tool_name": "analyze_interpro_domains", "parameters": {"sequence": "PROTEIN_SEQUENCE"}}
• For UniProt ID: {"tool_name": "analyze_interpro_domains", "parameters": {"uniprot_id": "P12345"}}

===CRITICAL DATA EXPORT INSTRUCTIONS===
For data export requests:
• **"export genome as FASTA" → use export_fasta_sequence**
• **"export as GenBank" → use export_genbank_format**
• **"export coding sequences" → use export_cds_fasta**
• **"export proteins" → use export_protein_fasta**
• **"export annotations" → use export_gff_annotations for GFF or export_bed_format for BED**
• **"export current view" → use export_current_view_fasta**
• Examples: 
  - {"tool_name": "export_fasta_sequence", "parameters": {}}
  - {"tool_name": "export_genbank_format", "parameters": {"includeProteinSequences": true}}
  - {"tool_name": "export_cds_fasta", "parameters": {"filename": "my_cds.fasta"}}
  - {"tool_name": "export_current_view_fasta", "parameters": {}}

SEARCH FUNCTIONS GUIDE:
- Gene names/products: search_gene_by_name, search_features
- Genomic positions: search_by_position, get_nearby_features  
- Sequence motifs: search_sequence_motif
- PDB experimental structures: search_pdb_structures (for known PDB entries)
- AlphaFold AI predictions: search_alphafold_by_gene (for AI-predicted structures)

ANALYSIS FUNCTIONS:
- Sequence: get_coding_sequence, translate_dna, reverse_complement
- Composition: compute_gc, sequence_statistics, codon_usage_analysis
- Features: predict_promoter, predict_rbs, find_restriction_sites
- Comparison: blast_search, compare_regions, find_similar_sequences
- Editing: copy_sequence, cut_sequence, paste_sequence, deleteSequence, insertSequence, replace_sequence

IMPORTANT PREREQUISITES:
Before using get_coding_sequence or other gene-specific functions:
1. Ensure genome data is loaded (GenBank/GFF files)
2. Use search_gene_by_name to verify gene exists
3. Check current genome state with get_genome_info

WORKFLOW EXAMPLES:
• Gene Deletion Workflow:
  Method 1 (Recommended): 
  1. {"tool_name": "delete_gene", "parameters": {"geneName": "yaaJ"}}  (by gene name)
  1. {"tool_name": "delete_gene", "parameters": {"geneName": "b0005"}}  (by locus tag)
  2. {"tool_name": "execute_actions", "parameters": {}}
  
  Method 2 (Manual): 
  1. {"tool_name": "search_gene_by_name", "parameters": {"name": "yaaJ"}}
  2. {"tool_name": "deleteSequence", "parameters": {"chromosome": "COLI-K12", "start": 8238, "end": 9191}}
  3. {"tool_name": "execute_actions", "parameters": {}}

• Gene Analysis Workflow:
  1. {"tool_name": "search_gene_by_name", "parameters": {"name": "lysC"}}
  2. {"tool_name": "get_coding_sequence", "parameters": {"gene_name": "lysC"}}
  3. {"tool_name": "translate_sequence", "parameters": {"sequence": "ATGCGC..."}}

• Sequence Insertion Workflow:
  1. {"tool_name": "insertSequence", "parameters": {"chromosome": "COLI-K12", "position": 1000, "sequence": "ATGCGCTAT"}}
  2. {"tool_name": "execute_actions", "parameters": {}}

• Copy/Paste Workflow:
  1. {"tool_name": "copy_sequence", "parameters": {"chromosome": "COLI-K12", "start": 1000, "end": 1500}}
  2. {"tool_name": "paste_sequence", "parameters": {"chromosome": "COLI-K12", "position": 2000}}
  3. {"tool_name": "execute_actions", "parameters": {}}

EXAMPLES:
• Find gene: {"tool_name": "search_gene_by_name", "parameters": {"name": "thrC"}}
• Delete gene: {"tool_name": "deleteSequence", "parameters": {"chromosome": "COLI-K12", "start": 1000, "end": 2000}}
• Insert DNA: {"tool_name": "insertSequence", "parameters": {"chromosome": "COLI-K12", "position": 1000, "sequence": "ATGCGC"}}
• Execute actions: {"tool_name": "execute_actions", "parameters": {}}
• Get action list: {"tool_name": "get_action_list", "parameters": {}}
• Copy sequence: {"tool_name": "copy_sequence", "parameters": {"chromosome": "COLI-K12", "start": 1000, "end": 1500}}
• Paste sequence: {"tool_name": "paste_sequence", "parameters": {"chromosome": "COLI-K12", "position": 2000}}`;
  }

  getCompleteToolContext() {
    const context = this.chatManager.getCurrentContext();

    // Get MCP server information
    const mcpServers = this.chatManager.mcpServerManager.getServerStatus();
    const connectedServers = mcpServers.filter(s => s.connected);
    const allMcpTools = this.chatManager.mcpServerManager.getAllAvailableTools();
    const toolsByCategory = this.chatManager.mcpServerManager.getToolsByCategory();

    let mcpServersInfo = '';
    if (connectedServers.length > 0) {
      mcpServersInfo = `
Connected MCP Servers: ${connectedServers.length}
${connectedServers.map(server => `- ${server.name} (${server.category}): ${server.toolCount} tools`).join('\n')}

MCP Tools by Category:
${Object.entries(toolsByCategory)
          .map(
            ([category, tools]) =>
              `${category.toUpperCase()}:\n${tools
                .map(tool => `  - ${tool.name} (${tool.serverName}): ${tool.description || 'No description'}`)
                .join('\n')}`
          )
          .join('\n\n')}
`;
    } else {
      mcpServersInfo = `
Connected MCP Servers: None
Note: Additional tools may be available when MCP servers are connected.
`;
    }

    // Get MicrobeGenomicsFunctions categories and examples
    let microbeGenomicsInfo = '';
    if (this.chatManager.MicrobeFns) {
      try {
        const categories = this.chatManager.MicrobeFns.getFunctionCategories();
        const examples = this.chatManager.MicrobeFns.getUsageExamples();

        microbeGenomicsInfo = `
MICROBE GENOMICS FUNCTIONS (Advanced Analysis Tools):
${Object.entries(categories)
            .map(
              ([category, info]) =>
                `${category.toUpperCase()} (${info.description}):\n${info.functions
                  .map(
                    fn =>
                      `  - ${fn}: Use as "${fn
                        .toLowerCase()
                        .replace(/([A-Z])/g, '_$1')
                        .toLowerCase()}"`
                  )
                  .join('\n')}`
            )
            .join('\n\n')}

MICROBE GENOMICS USAGE EXAMPLES:
${examples
            .map(example => `Task: ${example.task}\nSteps:\n${example.steps.map(step => `  ${step}`).join('\n')}`)
            .join('\n\n')}
`;
      } catch (error) {
        microbeGenomicsInfo = '\nMicrobeGenomicsFunctions: Available but could not load details\n';
      }
    }

    // Get plugin system information
    const pluginSystemInfo = this.chatManager.getPluginSystemInfo();

    return `
Current CodeXomics State:
- Current chromosome: ${context.genomeBrowser.currentState.currentChromosome || 'None'}
- Current position: ${JSON.stringify(context.genomeBrowser.currentState.currentPosition) || 'None'}
- Visible tracks: ${context.genomeBrowser.currentState.visibleTracks.join(', ') || 'None'}
- Loaded files: ${context.genomeBrowser.currentState.loadedFiles.length} files
- Sequence length: ${context.genomeBrowser.currentState.sequenceLength}
- Annotations count: ${context.genomeBrowser.currentState.annotationsCount}
- User-defined features: ${context.genomeBrowser.currentState.userDefinedFeaturesCount}

${mcpServersInfo}

Available Tools Summary:
- Total Available Tools: ${context.genomeBrowser.toolSources.total}
- Local Tools: ${context.genomeBrowser.toolSources.local}
- Plugin Tools: ${context.genomeBrowser.toolSources.plugins}
- MCP Tools: ${context.genomeBrowser.toolSources.mcp}

All Available Tools:
${context.genomeBrowser.availableTools.map(tool => `- ${tool}`).join('\n')}

${microbeGenomicsInfo}

${pluginSystemInfo}

===CRITICAL INSTRUCTION FOR TOOL CALLS===
When a user asks you to perform ANY action that requires using one of these tools, you MUST respond with ONLY a JSON object. Do NOT add any explanatory text, markdown formatting, or conversational responses around the JSON.

CORRECT format:
{"tool_name": "navigate_to_position", "parameters": {"chromosome": "U00096", "start": 1000, "end": 2000}}
{"tool_name": "navigate_to_position", "parameters": {"chromosome": "COLI-K12", "position": 2000000}}
{"tool_name": "open_new_tab", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
{"tool_name": "open_new_tab", "parameters": {"geneName": "lacZ"}}

Tool Selection Priority:
1. First try MCP server tools (if available and connected)
2. Use MicrobeGenomicsFunctions for specialized genomic analysis
3. Fall back to built-in local tools
4. Use the most appropriate tool for the task regardless of source

Basic Tool Examples:
- Navigate: {"tool_name": "navigate_to_position", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
- Navigate to position: {"tool_name": "navigate_to_position", "parameters": {"chromosome": "COLI-K12", "position": 2000000}}
- Open new tab: {"tool_name": "open_new_tab", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
- Open tab for gene: {"tool_name": "open_new_tab", "parameters": {"geneName": "lacZ"}}
- Search genes: {"tool_name": "search_features", "parameters": {"query": "lacZ", "caseSensitive": false}}
- Get current state: {"tool_name": "get_current_state", "parameters": {}}
- Get genome info: {"tool_name": "get_genome_info", "parameters": {}}
- Get sequence: {"tool_name": "get_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
- Toggle track: {"tool_name": "toggle_track", "parameters": {"trackName": "genes", "visible": true}}

Sequence Editing Examples:
- Copy sequence: {"tool_name": "copy_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
- Cut sequence: {"tool_name": "cut_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
- Paste sequence: {"tool_name": "paste_sequence", "parameters": {"chromosome": "chr1", "position": 2000}}
- Delete sequence: {"tool_name": "deleteSequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
- Insert sequence: {"tool_name": "insertSequence", "parameters": {"chromosome": "chr1", "position": 1000, "sequence": "ATGCGC"}}
- Replace sequence: {"tool_name": "replace_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500, "sequence": "ATGCGC"}}
- Execute actions: {"tool_name": "execute_actions", "parameters": {}}
- Get action list: {"tool_name": "get_action_list", "parameters": {}}

MicrobeGenomicsFunctions Examples:
- Navigate to gene: {"tool_name": "jump_to_gene", "parameters": {"geneName": "lacZ"}}
- Calculate GC content: {"tool_name": "compute_gc", "parameters": {"sequence": "ATGCGCTATCG"}}
- Get upstream region: {"tool_name": "get_upstream_region", "parameters": {"geneObj": {"chromosome": "chr1", "feature": {"start": 1000, "end": 2000}}, "length": 200}}
- Predict promoter: {"tool_name": "predict_promoter", "parameters": {"seq": "ATGCTATAAT"}}
- Search motif: {"tool_name": "search_sequence_motif", "parameters": {"pattern": "GAATTC", "chromosome": "chr1"}}
- Reverse complement: {"tool_name": "reverse_complement", "parameters": {"dna": "ATGC"}}
- Translate DNA: {"tool_name": "translate_dna", "parameters": {"dna": "ATGAAATAG", "frame": 0}}
- Calculate entropy: {"tool_name": "calculate_entropy", "parameters": {"sequence": "ATGCGCTATCG"}}
- Melting temperature: {"tool_name": "calculate_melting_temp", "parameters": {"dna": "ATGCGCTATCG"}}
- Molecular weight: {"tool_name": "calculate_molecular_weight", "parameters": {"dna": "ATGCGCTATCG"}}
- Codon usage: {"tool_name": "analyze_codon_usage", "parameters": {"dna": "ATGAAATAG"}}
- Predict RBS: {"tool_name": "predict_rbs", "parameters": {"seq": "AGGAGG"}}
- Predict terminator: {"tool_name": "predict_terminator", "parameters": {"seq": "ATGCGCTATCG"}}
- Get coding sequence: {"tool_name": "get_coding_sequence", "parameters": {"gene_name": "lacZ"}}
- Get multiple CDS: {"tool_name": "get_multiple_coding_sequences", "parameters": {"identifiers": ["lacZ", "lacY", "lacA"]}}
- Navigation controls: {"tool_name": "scroll_left", "parameters": {"bp": 1000}} or {"tool_name": "zoom_in", "parameters": {"factor": 2}}

CRITICAL DISTINCTION - Search Functions:
1. FOR TEXT-BASED SEARCHES (gene names, products): use 'search_features' or 'search_gene_by_name'
   - "find lacZ" → {"tool_name": "search_gene_by_name", "parameters": {"name": "lacZ"}}
   - "search DNA polymerase" → {"tool_name": "search_features", "parameters": {"query": "DNA polymerase", "caseSensitive": false}}

2. FOR POSITION-BASED SEARCHES (near coordinates): use 'get_nearby_features' or 'search_by_position'
   - "find genes near 123456" → {"tool_name": "search_by_position", "parameters": {"chromosome": "chr1", "position": 123456}}

3. FOR SEQUENCE MOTIF SEARCHES: use 'search_sequence_motif'
   - "find GAATTC sites" → {"tool_name": "search_sequence_motif", "parameters": {"pattern": "GAATTC"}}

Common Analysis Tools:
- Find restriction sites: {"tool_name": "find_restriction_sites", "parameters": {"enzyme": "EcoRI"}}
- Calculate GC content: {"tool_name": "sequence_statistics", "parameters": {"include": ["composition"]}}
- Search motifs: {"tool_name": "search_motif", "parameters": {"pattern": "GAATTC", "allowMismatches": 0}}

Protein Structure Tools:
- Display protein 3D structure: {"tool_name": "open_protein_viewer", "parameters": {"pdbId": "1TUP"}}
- Fetch protein structure data: {"tool_name": "fetch_protein_structure", "parameters": {"pdbId": "6SSC"}}
- Search PDB proteins by gene: {"tool_name": "search_pdb_structures", "parameters": {"geneName": "p53", "organism": "Homo sapiens"}}
- Search AlphaFold by gene: {"tool_name": "search_alphafold_by_gene", "parameters": {"geneName": "lysC", "organism": "Escherichia coli"}}

PROTEIN STRUCTURE DISAMBIGUATION:
- For "PDB" searches or experimental structures → use search_pdb_structures
- For "AlphaFold" or AI predictions → use search_alphafold_by_gene
- Example: "search PDB protein structure for lysC" → search_pdb_structures

IMPORTANT: For protein structure display requests, use "open_protein_viewer" with just the pdbId parameter. The system will automatically fetch the structure data if needed.

BLAST Search Tools:
- Search sequence similarity: {"tool_name": "blast_search", "parameters": {"sequence": "ATGCGCTATCG", "blastType": "blastn", "database": "nt", "evalue": "0.01", "maxTargets": 50}}
- BLAST current region: {"tool_name": "blast_sequence_from_region", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000, "blastType": "blastn", "database": "nt"}}
- Get BLAST databases: {"tool_name": "get_blast_databases", "parameters": {}}

BLAST Examples:
1. DNA sequence search: {"tool_name": "blast_search", "parameters": {"sequence": "ATGAAAGAATTGAAAGAAGCTGGCTGGAAAGAACTGCAGCCG", "blastType": "blastn", "database": "nt"}}
2. Protein sequence search: {"tool_name": "blast_search", "parameters": {"sequence": "MKELLKAGWKELQPIKEYGIEAVALAYTYQKEQDAIDKELKENITPNVEKKLVWEALKLK", "blastType": "blastp", "database": "nr"}}
3. Translate and search DNA: {"tool_name": "blast_search", "parameters": {"sequence": "ATGAAAGAATTGAAAGAAGCTGGCTGG", "blastType": "blastx", "database": "nr"}}
4. Search genomic region: {"tool_name": "blast_sequence_from_region", "parameters": {"chromosome": "NC_000913.3", "start": 3423681, "end": 3424651, "blastType": "blastn", "database": "refseq_genomic"}}

Enhanced BLAST Tools (Available with MCP BLAST Server):
- Batch BLAST search: {"tool_name": "batch_blast_search", "parameters": {"sequences": [{"id": "seq1", "sequence": "ATGCGCTATCG"}, {"id": "seq2", "sequence": "ATGAAAGAATT"}], "blastType": "blastn", "database": "nt", "maxTargets": 10}}
- Advanced BLAST with filtering: {"tool_name": "advanced_blast_search", "parameters": {"sequence": "ATGCGCTATCG", "blastType": "blastn", "database": "nt", "filters": {"minIdentity": 95, "minCoverage": 80}, "algorithms": {"wordSize": "11", "matrix": "BLOSUM62"}}}
- Local database info: {"tool_name": "local_blast_database_info", "parameters": {"databasePath": "/path/to/local/db"}}

Enhanced BLAST Examples:
1. Batch protein search: {"tool_name": "batch_blast_search", "parameters": {"sequences": [{"id": "protein1", "sequence": "MKELLKAGWKELQP"}, {"id": "protein2", "sequence": "MKLSAGATRVST"}], "blastType": "blastp", "database": "nr"}}
2. High-specificity DNA search: {"tool_name": "advanced_blast_search", "parameters": {"sequence": "ATGAAAGAATTGAAAGAAGCTGGCTGG", "blastType": "blastn", "database": "nt", "filters": {"minIdentity": 98, "maxEvalue": 1e-10}}}

MICROBE GENOMICS POWER USER EXAMPLES:
1. Complete Gene Analysis:
   - Find gene: {"tool_name": "search_gene_by_name", "parameters": {"name": "dnaA"}}
   - Get upstream: {"tool_name": "get_upstream_region", "parameters": {"geneObj": "result_from_above", "length": 200}}
   - Predict promoter: {"tool_name": "predict_promoter", "parameters": {"seq": "upstream_sequence"}}
   - Calculate GC: {"tool_name": "compute_gc", "parameters": {"sequence": "upstream_sequence"}}

2. Sequence Motif Analysis:
   - Search motif: {"tool_name": "search_sequence_motif", "parameters": {"pattern": "TATAAT"}}
   - Find nearby features: {"tool_name": "search_by_position", "parameters": {"position": "motif_position"}}

3. Comparative Analysis:
   - Get region 1: {"tool_name": "get_upstream_region", "parameters": {"geneObj": "gene1", "length": 500}}
   - Get region 2: {"tool_name": "get_upstream_region", "parameters": {"geneObj": "gene2", "length": 500}}
   - Compare GC: {"tool_name": "compute_gc", "parameters": {"sequence": "region1"}} then {"tool_name": "compute_gc", "parameters": {"sequence": "region2"}}

Remember: These functions provide atomic operations that can be chained together to perform complex genomic analyses!

Metabolic Pathway Tools:
- Display metabolic pathway: {"tool_name": "show_metabolic_pathway", "parameters": {"pathwayName": "glycolysis"}}
- Find pathway genes: {"tool_name": "find_pathway_genes", "parameters": {"pathwayName": "glycolysis", "includeRegulation": true}}

Metabolic Pathway Examples:
1. Glycolysis analysis: {"tool_name": "show_metabolic_pathway", "parameters": {"pathwayName": "glycolysis"}}
2. TCA cycle genes: {"tool_name": "find_pathway_genes", "parameters": {"pathwayName": "tca_cycle", "includeRegulation": false}}
3. Pentose phosphate pathway: {"tool_name": "show_metabolic_pathway", "parameters": {"pathwayName": "pentose_phosphate"}}
`;
  }

  getBaseSystemMessage() {
    const context = this.chatManager.getCurrentContext();

    // Get MCP server information
    const mcpServers = this.chatManager.mcpServerManager.getServerStatus();
    const connectedServers = mcpServers.filter(s => s.connected);
    const allMcpTools = this.chatManager.mcpServerManager.getAllAvailableTools();
    const toolsByCategory = this.chatManager.mcpServerManager.getToolsByCategory();

    let mcpServersInfo = '';
    if (connectedServers.length > 0) {
      mcpServersInfo = `
Connected MCP Servers: ${connectedServers.length}
${connectedServers.map(server => `- ${server.name} (${server.category}): ${server.toolCount} tools`).join('\n')}

MCP Tools by Category:
${Object.entries(toolsByCategory)
          .map(
            ([category, tools]) =>
              `${category.toUpperCase()}:\n${tools
                .map(tool => `  - ${tool.name} (${tool.serverName}): ${tool.description || 'No description'}`)
                .join('\n')}`
          )
          .join('\n\n')}
`;
    } else {
      mcpServersInfo = `
Connected MCP Servers: None
Note: Additional tools may be available when MCP servers are connected.
`;
    }

    // Get MicrobeGenomicsFunctions categories and examples
    let microbeGenomicsInfo = '';
    if (this.chatManager.MicrobeFns) {
      try {
        const categories = this.chatManager.MicrobeFns.getFunctionCategories();
        const examples = this.chatManager.MicrobeFns.getUsageExamples();

        microbeGenomicsInfo = `
MICROBE GENOMICS FUNCTIONS (Advanced Analysis Tools):
${Object.entries(categories)
            .map(
              ([category, info]) =>
                `${category.toUpperCase()} (${info.description}):\n${info.functions
                  .map(
                    fn =>
                      `  - ${fn}: Use as "${fn
                        .toLowerCase()
                        .replace(/([A-Z])/g, '_$1')
                        .toLowerCase()}"`
                  )
                  .join('\n')}`
            )
            .join('\n\n')}

MICROBE GENOMICS USAGE EXAMPLES:
${examples
            .map(example => `Task: ${example.task}\nSteps:\n${example.steps.map(step => `  ${step}`).join('\n')}`)
            .join('\n\n')}
`;
      } catch (error) {
        microbeGenomicsInfo = '\nMicrobeGenomicsFunctions: Available but could not load details\n';
      }
    }

    return `You are an AI assistant for a CodeXomics application. You have access to the following tools and current state:

IMPORTANT: Task Completion Instructions
When you believe you have completed the user's task or fully answered their question, you can end the conversation early by providing a summary response WITHOUT any tool calls. Use clear completion indicators like "Task completed", "Analysis finished", "In summary", or "The results show" to signal completion. This allows for efficient task execution without using unnecessary function call rounds.

Current CodeXomics State:
- Current chromosome: ${context.genomeBrowser.currentState.currentChromosome || 'None'}
- Current position: ${JSON.stringify(context.genomeBrowser.currentState.currentPosition) || 'None'}
- Visible tracks: ${context.genomeBrowser.currentState.visibleTracks.join(', ') || 'None'}
- Loaded files: ${context.genomeBrowser.currentState.loadedFiles.length} files
- Sequence length: ${context.genomeBrowser.currentState.sequenceLength}
- Annotations count: ${context.genomeBrowser.currentState.annotationsCount}
- User-defined features: ${context.genomeBrowser.currentState.userDefinedFeaturesCount}

${mcpServersInfo}

Available Tools Summary:
- Total Available Tools: ${context.genomeBrowser.toolSources.total}
- Local Tools: ${context.genomeBrowser.toolSources.local}
- Plugin Tools: ${context.genomeBrowser.toolSources.plugins}
- MCP Tools: ${context.genomeBrowser.toolSources.mcp}

All Available Tools:
${context.genomeBrowser.availableTools.map(tool => `- ${tool}`).join('\n')}

${microbeGenomicsInfo}

===CRITICAL INSTRUCTION FOR TOOL CALLS===
When a user asks you to perform ANY action that requires using one of these tools, you MUST respond with ONLY a JSON object. Do NOT add any explanatory text, markdown formatting, or conversational responses around the JSON.

CORRECT format:
{"tool_name": "navigate_to_position", "parameters": {"chromosome": "U00096", "start": 1000, "end": 2000}}
{"tool_name": "navigate_to_position", "parameters": {"chromosome": "COLI-K12", "position": 2000000}}
{"tool_name": "open_new_tab", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
{"tool_name": "open_new_tab", "parameters": {"geneName": "lacZ"}}

Tool Selection Priority:
1. First try MCP server tools (if available and connected)
2. Use Plugin System tools for database searches and advanced analysis
3. Use MicrobeGenomicsFunctions for specialized genomic analysis
4. Fall back to built-in local tools
5. Use the most appropriate tool for the task regardless of source


Basic Tool Examples:
- Navigate: {"tool_name": "navigate_to_position", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
- Navigate to position: {"tool_name": "navigate_to_position", "parameters": {"chromosome": "COLI-K12", "position": 2000000}}
- Open new tab: {"tool_name": "open_new_tab", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000}}
- Open tab for gene: {"tool_name": "open_new_tab", "parameters": {"geneName": "lacZ"}}
- Zoom in: {"tool_name": "zoom_in", "parameters": {"factor": 2}}
- Zoom out: {"tool_name": "zoom_out", "parameters": {"factor": 3}}
- Search genes: {"tool_name": "search_features", "parameters": {"query": "lacZ", "caseSensitive": false}}
- Get current state: {"tool_name": "get_current_state", "parameters": {}}
- Get genome info: {"tool_name": "get_genome_info", "parameters": {}}
- Get sequence: {"tool_name": "get_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
- Toggle track: {"tool_name": "toggle_track", "parameters": {"trackName": "genes", "visible": true}}

Sequence Editing Examples:
- Copy sequence: {"tool_name": "copy_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
- Cut sequence: {"tool_name": "cut_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
- Paste sequence: {"tool_name": "paste_sequence", "parameters": {"chromosome": "chr1", "position": 2000}}
- Delete sequence: {"tool_name": "deleteSequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500}}
- Insert sequence: {"tool_name": "insertSequence", "parameters": {"chromosome": "chr1", "position": 1000, "sequence": "ATGCGC"}}
- Replace sequence: {"tool_name": "replace_sequence", "parameters": {"chromosome": "chr1", "start": 1000, "end": 1500, "sequence": "ATGCGC"}}
- Execute actions: {"tool_name": "execute_actions", "parameters": {}}
- Get action list: {"tool_name": "get_action_list", "parameters": {}}

MicrobeGenomicsFunctions Examples:
- Navigate to gene: {"tool_name": "jump_to_gene", "parameters": {"geneName": "lacZ"}}
- Calculate GC content: {"tool_name": "compute_gc", "parameters": {"sequence": "ATGCGCTATCG"}}
- Get upstream region: {"tool_name": "get_upstream_region", "parameters": {"geneObj": {"chromosome": "chr1", "feature": {"start": 1000, "end": 2000}}, "length": 200}}
- Predict promoter: {"tool_name": "predict_promoter", "parameters": {"seq": "ATGCTATAAT"}}
- Search motif: {"tool_name": "search_sequence_motif", "parameters": {"pattern": "GAATTC", "chromosome": "chr1"}}
- Reverse complement: {"tool_name": "reverse_complement", "parameters": {"dna": "ATGC"}}
- Translate DNA: {"tool_name": "translate_dna", "parameters": {"dna": "ATGAAATAG", "frame": 0}}
- Calculate entropy: {"tool_name": "calculate_entropy", "parameters": {"sequence": "ATGCGCTATCG"}}
- Melting temperature: {"tool_name": "calculate_melting_temp", "parameters": {"dna": "ATGCGCTATCG"}}
- Molecular weight: {"tool_name": "calculate_molecular_weight", "parameters": {"dna": "ATGCGCTATCG"}}
- Codon usage: {"tool_name": "analyze_codon_usage", "parameters": {"dna": "ATGAAATAG"}}
- Predict RBS: {"tool_name": "predict_rbs", "parameters": {"seq": "AGGAGG"}}
- Predict terminator: {"tool_name": "predict_terminator", "parameters": {"seq": "ATGCGCTATCG"}}
- Navigation controls: {"tool_name": "scroll_left", "parameters": {"bp": 1000}}, {"tool_name": "zoom_in", "parameters": {"factor": 2}}, {"tool_name": "zoom_out", "parameters": {"factor": 3}}

CRITICAL DISTINCTION - Search Functions:
1. FOR TEXT-BASED SEARCHES (gene names, products): use 'search_features' or 'search_gene_by_name'
   - "find lacZ" → {"tool_name": "search_gene_by_name", "parameters": {"name": "lacZ"}}
   - "search DNA polymerase" → {"tool_name": "search_features", "parameters": {"query": "DNA polymerase", "caseSensitive": false}}

2. FOR POSITION-BASED SEARCHES (near coordinates): use 'get_nearby_features' or 'search_by_position'
   - "find genes near 123456" → {"tool_name": "search_by_position", "parameters": {"chromosome": "chr1", "position": 123456}}

3. FOR SEQUENCE MOTIF SEARCHES: use 'search_sequence_motif'
   - "find GAATTC sites" → {"tool_name": "search_sequence_motif", "parameters": {"pattern": "GAATTC"}}

Common Analysis Tools:
- Find restriction sites: {"tool_name": "find_restriction_sites", "parameters": {"enzyme": "EcoRI"}}
- Calculate GC content: {"tool_name": "sequence_statistics", "parameters": {"include": ["composition"]}}
- Search motifs: {"tool_name": "search_motif", "parameters": {"pattern": "GAATTC", "allowMismatches": 0}}

Protein Structure Tools:
- Display protein 3D structure: {"tool_name": "open_protein_viewer", "parameters": {"pdbId": "1TUP"}}
- Fetch protein structure data: {"tool_name": "fetch_protein_structure", "parameters": {"pdbId": "6SSC"}}
- Search PDB proteins by gene: {"tool_name": "search_pdb_structures", "parameters": {"geneName": "p53", "organism": "Homo sapiens"}}
- Search AlphaFold by gene: {"tool_name": "search_alphafold_by_gene", "parameters": {"geneName": "lysC", "organism": "Escherichia coli"}}

PROTEIN STRUCTURE DISAMBIGUATION:
- For "PDB" searches or experimental structures → use search_pdb_structures
- For "AlphaFold" or AI predictions → use search_alphafold_by_gene
- Example: "search PDB protein structure for lysC" → search_pdb_structures

IMPORTANT: For protein structure display requests, use "open_protein_viewer" with just the pdbId parameter. The system will automatically fetch the structure data if needed.

BLAST Search Tools:
- Search sequence similarity: {"tool_name": "blast_search", "parameters": {"sequence": "ATGCGCTATCG", "blastType": "blastn", "database": "nt", "evalue": "0.01", "maxTargets": 50}}
- BLAST current region: {"tool_name": "blast_sequence_from_region", "parameters": {"chromosome": "chr1", "start": 1000, "end": 2000, "blastType": "blastn", "database": "nt"}}
- Get BLAST databases: {"tool_name": "get_blast_databases", "parameters": {}}

BLAST Examples:
1. DNA sequence search: {"tool_name": "blast_search", "parameters": {"sequence": "ATGAAAGAATTGAAAGAAGCTGGCTGGAAAGAACTGCAGCCG", "blastType": "blastn", "database": "nt"}}
2. Protein sequence search: {"tool_name": "blast_search", "parameters": {"sequence": "MKELLKAGWKELQPIKEYGIEAVALAYTYQKEQDAIDKELKENITPNVEKKLVWEALKLK", "blastType": "blastp", "database": "nr"}}
3. Translate and search DNA: {"tool_name": "blast_search", "parameters": {"sequence": "ATGAAAGAATTGAAAGAAGCTGGCTGG", "blastType": "blastx", "database": "nr"}}
4. Search genomic region: {"tool_name": "blast_sequence_from_region", "parameters": {"chromosome": "NC_000913.3", "start": 3423681, "end": 3424651, "blastType": "blastn", "database": "refseq_genomic"}}

Enhanced BLAST Tools (Available with MCP BLAST Server):
- Batch BLAST search: {"tool_name": "batch_blast_search", "parameters": {"sequences": [{"id": "seq1", "sequence": "ATGCGCTATCG"}, {"id": "seq2", "sequence": "ATGAAAGAATT"}], "blastType": "blastn", "database": "nt", "maxTargets": 10}}
- Advanced BLAST with filtering: {"tool_name": "advanced_blast_search", "parameters": {"sequence": "ATGCGCTATCG", "blastType": "blastn", "database": "nt", "filters": {"minIdentity": 95, "minCoverage": 80}, "algorithms": {"wordSize": "11", "matrix": "BLOSUM62"}}}
- Local database info: {"tool_name": "local_blast_database_info", "parameters": {"databasePath": "/path/to/local/db"}}

Enhanced BLAST Examples:
1. Batch protein search: {"tool_name": "batch_blast_search", "parameters": {"sequences": [{"id": "protein1", "sequence": "MKELLKAGWKELQP"}, {"id": "protein2", "sequence": "MKLSAGATRVST"}], "blastType": "blastp", "database": "nr"}}
2. High-specificity DNA search: {"tool_name": "advanced_blast_search", "parameters": {"sequence": "ATGAAAGAATTGAAAGAAGCTGGCTGG", "blastType": "blastn", "database": "nt", "filters": {"minIdentity": 98, "maxEvalue": 1e-10}}}
MICROBE GENOMICS POWER USER EXAMPLES:
1. Complete Gene Analysis:
   - Find gene: {"tool_name": "search_gene_by_name", "parameters": {"name": "dnaA"}}
   - Get upstream: {"tool_name": "get_upstream_region", "parameters": {"geneObj": "result_from_above", "length": 200}}
   - Predict promoter: {"tool_name": "predict_promoter", "parameters": {"seq": "upstream_sequence"}}
   - Calculate GC: {"tool_name": "compute_gc", "parameters": {"sequence": "upstream_sequence"}}

2. Sequence Motif Analysis:
   - Search motif: {"tool_name": "search_sequence_motif", "parameters": {"pattern": "TATAAT"}}
   - Find nearby features: {"tool_name": "search_by_position", "parameters": {"position": "motif_position"}}

3. Comparative Analysis:
   - Get region 1: {"tool_name": "get_upstream_region", "parameters": {"geneObj": "gene1", "length": 500}}
   - Get region 2: {"tool_name": "get_upstream_region", "parameters": {"geneObj": "gene2", "length": 500}}
   - Compare GC: {"tool_name": "compute_gc", "parameters": {"sequence": "region1"}} then {"tool_name": "compute_gc", "parameters": {"sequence": "region2"}}

Remember: These functions provide atomic operations that can be chained together to perform complex genomic analyses!

PLUGIN SYSTEM FUNCTIONS:
${this.chatManager.getPluginSystemInfo()}`;
  }

  addToolResultMessage(toolResults) {
    const successCount = toolResults.filter(r => r.success).length;
    const failCount = toolResults.filter(r => !r.success).length;

    // Add to Evolution data first (always record tool results)
    this.chatManager.addToEvolutionData({
      type: 'tool_results',
      timestamp: new Date().toISOString(),
      content: toolResults,
      visible: this.chatManager.showToolCalls,
      metadata: {
        source: 'tool_execution_results',
        requestId: this.chatManager.conversationState.currentRequestId,
        successCount: successCount,
        failCount: failCount,
        totalCount: toolResults.length,
        tools: toolResults.map(r => ({ tool: r.tool, success: r.success })),
      },
    });

    if (!this.chatManager.showToolCalls) return;

    let resultMessage = `✅ Tool execution completed: ${successCount} succeeded`;
    if (failCount > 0) {
      resultMessage += `, ${failCount} failed`;
    }

    // 显示详细结果
    const detailsHtml = toolResults
      .map(result => {
        const icon = result.success ? '✅' : '❌';
        let resultDisplay = `<div style="margin: 8px 0; padding: 8px; border-left: 3px solid ${result.success ? '#4CAF50' : '#F44336'};">`;
        resultDisplay += `<strong>${icon} ${result.tool}</strong><br>`;

        if (result.success) {
          // Custom handling for Deep Gene Research tool
          if (result.tool === 'deep-gene-research') {
            const resultData = result.result || result.data;
            let reportSaved = false;
            let reportPath = '';

            try {
              const fs = require('fs');
              const path = require('path');

              // Use the new helper to extract report from various formats
              const extracted = this.chatManager.extractDeepGeneResearchReport(resultData);
              const { report, geneSymbol, stepsCount, statistics, images, sources } = extracted;

              // Save report if we have content (ensure report is a string)
              const reportStr = typeof report === 'string' ? report : report ? JSON.stringify(report, null, 2) : '';
              if (reportStr && reportStr.trim().length > 0) {
                const reportsDir = path.join(process.cwd(), 'reports');
                if (!fs.existsSync(reportsDir)) {
                  fs.mkdirSync(reportsDir, { recursive: true });
                }

                const safeSymbol = geneSymbol.replace(/[^a-zA-Z0-9_-]/g, '_');
                const filename = `Gene_${safeSymbol}_Research_Report.md`;
                reportPath = path.join(reportsDir, filename);

                fs.writeFileSync(reportPath, reportStr);
                reportSaved = true;
                console.log(`✅ Deep Gene Research report saved to: ${reportPath}`);
              }

              // Formatted Display
              resultDisplay += `<div style="margin-top: 8px; padding: 12px; background: #e3f2fd; border-radius: 8px; border-left: 4px solid #2196F3;">`;
              resultDisplay += `<h3 style="margin: 0 0 8px 0; color: #1565C0; font-size: 1.1em;"><i class="fas fa-dna"></i> Deep Gene Research Complete: ${geneSymbol}</h3>`;

              if (reportSaved) {
                resultDisplay += `<div style="color: #00695c; display: flex; align-items: center; margin-bottom: 8px;">`;
                resultDisplay += `<i class="fas fa-check-circle" style="margin-right: 6px;"></i> Report saved to <code>reports/${path.basename(reportPath)}</code>`;
                resultDisplay += `</div>`;
              }

              resultDisplay += `<div style="font-size: 0.9em; color: #555;">`;
              if (stepsCount > 0) {
                resultDisplay += `Completed ${stepsCount} steps of analysis.<br>`;
              }
              if (statistics.totalCitations > 0 || statistics.processedPapers > 0) {
                resultDisplay += `Found ${statistics.totalCitations} citations`;
                if (statistics.processedPapers > 0) {
                  resultDisplay += ` and ${statistics.processedPapers} papers`;
                }
                resultDisplay += `.<br>`;
              }
              if (reportStr && reportStr.length > 0) {
                // Show a preview of the report content
                const previewLength = 500;
                const preview =
                  reportStr.length > previewLength ? reportStr.substring(0, previewLength) + '...' : reportStr;
                resultDisplay += `<details style="margin-top: 8px;">`;
                resultDisplay += `<summary style="cursor: pointer; color: #1565C0;">📄 Report Preview</summary>`;
                resultDisplay += `<div style="background: #fff; padding: 8px; margin-top: 4px; border-radius: 4px; max-height: 200px; overflow-y: auto; border: 1px solid #ddd; white-space: pre-wrap; font-size: 0.85em;">${this.chatManager.escapeHtml(preview)}</div>`;
                resultDisplay += `</details>`;
              }
              resultDisplay += `</div>`;

              // Collapsible detailed JSON
              if (this.chatManager.showDetailedToolData) {
                resultDisplay += `<details style="margin-top: 8px;">`;
                resultDisplay += `<summary style="cursor: pointer; color: #2196F3; font-size: 0.9em;">📊 View raw data</summary>`;
                resultDisplay += `<div style="background: #fff; padding: 8px; margin-top: 4px; border-radius: 4px; font-family: monospace; font-size: 0.85em; max-height: 300px; overflow-y: auto; border: 1px solid #ddd;">`;
                try {
                  const formattedData = this.chatManager.formatToolResultData(resultData);
                  resultDisplay += formattedData;
                } catch (error) {
                  resultDisplay += `<pre>${JSON.stringify(resultData, null, 2)}</pre>`;
                }
                resultDisplay += `</div></details>`;
              }

              resultDisplay += `</div>`;
            } catch (e) {
              console.error('Error processing deep-gene-research result:', e);
              // Fallback to default display
              resultDisplay += `<span style="color: #4CAF50;">Status: Success (Display Error)</span>`;
              if (this.chatManager.showDetailedToolData) {
                const rawData = result.result || result.data;
                if (rawData) {
                  resultDisplay += `<br><details style="margin-top: 8px;">`;
                  resultDisplay += `<summary style="cursor: pointer; color: #2196F3;">📊 Show detailed data</summary>`;
                  resultDisplay += `<div style="background: #f5f5f5; padding: 8px; margin-top: 4px; border-radius: 4px; font-family: monospace; font-size: 0.85em; max-height: 500px; overflow-y: auto;">`;
                  try {
                    const formattedData = this.chatManager.formatToolResultData(rawData);
                    resultDisplay += formattedData;
                  } catch (error) {
                    resultDisplay += `<pre>${JSON.stringify(rawData, null, 2)}</pre>`;
                  }
                  resultDisplay += `</div></details>`;
                }
              }
            }
          } else {
            // Standard display for other tools
            resultDisplay += `<span style="color: #4CAF50;">Status: Success</span>`;

            // 显示详细数据（如果启用）
            if (this.chatManager.showDetailedToolData) {
              // Check for result.result first (standard tool execution result), then fallback to result.data (legacy)
              const resultData = result.result || result.data;
              if (resultData) {
                resultDisplay += `<br><details style="margin-top: 8px;">`;
                resultDisplay += `<summary style="cursor: pointer; color: #2196F3;">📊 Show detailed data</summary>`;
                resultDisplay += `<div style="background: #f5f5f5; padding: 8px; margin-top: 4px; border-radius: 4px; font-family: monospace; font-size: 0.85em; max-height: 500px; overflow-y: auto;">`;
                try {
                  // 格式化数据显示
                  const formattedData = this.chatManager.formatToolResultData(resultData);
                  resultDisplay += formattedData;
                } catch (error) {
                  resultDisplay += `<pre>${JSON.stringify(resultData, null, 2)}</pre>`;
                }
                resultDisplay += `</div></details>`;
              }
            }
          }
        } else {
          resultDisplay += `<span style="color: #F44336;">Status: Failed</span>`;
          if (result.error) {
            resultDisplay += `<br><span style="color: #F44336; font-size: 0.9em;">Error: ${result.error}</span>`;
          }
        }

        resultDisplay += `</div>`;
        return resultDisplay;
      })
      .join('');

    this.chatManager.updateThinkingMessage(`${resultMessage}<br><div style="margin-top: 8px;">${detailsHtml}</div>`);
  }


}

window.LLMContextService = LLMContextService;
