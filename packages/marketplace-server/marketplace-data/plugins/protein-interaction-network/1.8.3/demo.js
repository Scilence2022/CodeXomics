/**
 * Protein Interaction Network - Interactive Demo Script
 *
 * This module provides demo scenarios and execution logic for testing
 * Protein Interaction Network Visualizer plugin functionality.
 *
 * @version 1.8.3
 * @author CodeXomics Team
 */

class ProteinNetworkDemo {
  constructor(pluginInstance) {
    this.plugin = pluginInstance;
    this.demoData = this.initializeDemoData();
  }

  /**
   * Initialize demo datasets with various network scenarios
   * These demos use pre-generated network data structures
   */
  initializeDemoData() {
    return {
      basic: {
        name: 'Basic Protein Interaction Network',
        description: 'Simple 3-protein interaction network',
        complexity: 'basic',
        expectedNodes: 3,
        expectedEdges: 2,
        networkData: {
          nodes: [
            { id: 'TP53', name: 'TP53', type: 'protein', properties: { function: 'Tumor suppressor' } },
            { id: 'MDM2', name: 'MDM2', type: 'protein', properties: { function: 'E3 ubiquitin ligase' } },
            { id: 'ATM', name: 'ATM', type: 'protein', properties: { function: 'DNA damage sensor' } },
          ],
          edges: [
            { source: 'TP53', target: 'MDM2', confidence: 0.95, type: 'inhibition' },
            { source: 'ATM', target: 'TP53', confidence: 0.85, type: 'activation' },
          ],
          metadata: {
            description: 'Core p53 regulatory network',
            organism: 'Homo sapiens',
          },
        },
        validationRules: {
          minNodes: 3,
          minEdges: 2,
        },
      },

      complex: {
        name: 'DNA Damage Response Network',
        description: 'Extended network with 8 proteins in DNA repair pathway',
        complexity: 'complex',
        expectedNodes: 8,
        expectedEdges: 12,
        networkData: {
          nodes: [
            { id: 'TP53', name: 'TP53', type: 'protein' },
            { id: 'MDM2', name: 'MDM2', type: 'protein' },
            { id: 'ATM', name: 'ATM', type: 'protein' },
            { id: 'CHEK2', name: 'CHEK2', type: 'protein' },
            { id: 'BRCA1', name: 'BRCA1', type: 'protein' },
            { id: 'RAD51', name: 'RAD51', type: 'protein' },
            { id: 'ATR', name: 'ATR', type: 'protein' },
            { id: 'CDKN1A', name: 'CDKN1A', type: 'protein' },
          ],
          edges: [
            { source: 'ATM', target: 'TP53', confidence: 0.9, type: 'activation' },
            { source: 'ATM', target: 'CHEK2', confidence: 0.88, type: 'activation' },
            { source: 'ATM', target: 'BRCA1', confidence: 0.85, type: 'activation' },
            { source: 'CHEK2', target: 'TP53', confidence: 0.92, type: 'activation' },
            { source: 'TP53', target: 'MDM2', confidence: 0.95, type: 'inhibition' },
            { source: 'TP53', target: 'CDKN1A', confidence: 0.93, type: 'activation' },
            { source: 'MDM2', target: 'TP53', confidence: 0.94, type: 'inhibition' },
            { source: 'BRCA1', target: 'RAD51', confidence: 0.87, type: 'activation' },
            { source: 'ATR', target: 'TP53', confidence: 0.82, type: 'activation' },
            { source: 'ATR', target: 'CHEK2', confidence: 0.8, type: 'activation' },
            { source: 'BRCA1', target: 'ATM', confidence: 0.78, type: 'interaction' },
            { source: 'RAD51', target: 'BRCA1', confidence: 0.86, type: 'interaction' },
          ],
          metadata: {
            description: 'DNA damage response and repair network',
            pathway: 'DNA Damage Response',
            organism: 'Homo sapiens',
          },
        },
        validationRules: {
          minNodes: 8,
          minEdges: 10,
          minAvgConfidence: 0.8,
        },
      },

      oncogene: {
        name: 'Oncogene Network Analysis',
        description: 'Key oncogenes and tumor suppressors interaction network',
        complexity: 'advanced',
        expectedNodes: 6,
        expectedEdges: 10,
        networkData: {
          nodes: [
            { id: 'TP53', name: 'TP53', type: 'protein', properties: { role: 'tumor suppressor' } },
            { id: 'BRCA1', name: 'BRCA1', type: 'protein', properties: { role: 'tumor suppressor' } },
            { id: 'BRCA2', name: 'BRCA2', type: 'protein', properties: { role: 'tumor suppressor' } },
            { id: 'MYC', name: 'MYC', type: 'protein', properties: { role: 'oncogene' } },
            { id: 'KRAS', name: 'KRAS', type: 'protein', properties: { role: 'oncogene' } },
            { id: 'APC', name: 'APC', type: 'protein', properties: { role: 'tumor suppressor' } },
          ],
          edges: [
            { source: 'TP53', target: 'MYC', confidence: 0.88, type: 'inhibition' },
            { source: 'TP53', target: 'BRCA1', confidence: 0.85, type: 'activation' },
            { source: 'BRCA1', target: 'BRCA2', confidence: 0.92, type: 'interaction' },
            { source: 'KRAS', target: 'MYC', confidence: 0.87, type: 'activation' },
            { source: 'APC', target: 'MYC', confidence: 0.82, type: 'inhibition' },
            { source: 'MYC', target: 'TP53', confidence: 0.78, type: 'inhibition' },
            { source: 'KRAS', target: 'TP53', confidence: 0.75, type: 'inhibition' },
            { source: 'BRCA1', target: 'TP53', confidence: 0.9, type: 'interaction' },
            { source: 'BRCA2', target: 'TP53', confidence: 0.86, type: 'interaction' },
            { source: 'APC', target: 'TP53', confidence: 0.84, type: 'activation' },
          ],
          metadata: {
            description: 'Oncogene and tumor suppressor network',
            pathway: 'Cancer Pathways',
            organism: 'Homo sapiens',
          },
        },
        validationRules: {
          minNodes: 6,
          minEdges: 8,
          minAvgConfidence: 0.75,
        },
      },

      performance: {
        name: 'Large Scale Network (Performance Test)',
        description: 'Stress test with 15 proteins and extensive connections',
        complexity: 'performance',
        expectedNodes: 15,
        expectedEdges: 25,
        networkData: this.generateLargeNetwork(),
        validationRules: {
          minNodes: 15,
          minEdges: 20,
          maxRenderTime: 3000, // 3 seconds
        },
      },
    };
  }

  /**
   * Generate large network for performance testing
   * @returns {Object} Large network data structure
   */
  generateLargeNetwork() {
    const proteins = [
      'TP53',
      'BRCA1',
      'BRCA2',
      'ATM',
      'ATR',
      'CHEK1',
      'CHEK2',
      'MDM2',
      'MDM4',
      'CDKN1A',
      'PTEN',
      'AKT1',
      'KRAS',
      'BRAF',
      'EGFR',
    ];

    const nodes = proteins.map(id => ({
      id,
      name: id,
      type: 'protein',
      properties: { category: this.getProteinCategory(id) },
    }));

    const edges = [];
    const edgeTypes = ['activation', 'inhibition', 'interaction', 'binding'];

    // Generate edges between proteins with realistic confidence scores
    for (let i = 0; i < proteins.length; i++) {
      for (let j = i + 1; j < proteins.length; j++) {
        // Create edges for related proteins (not fully connected)
        if (Math.random() > 0.65) {
          // ~35% connectivity
          edges.push({
            source: proteins[i],
            target: proteins[j],
            confidence: 0.6 + Math.random() * 0.35, // 0.6 - 0.95
            type: edgeTypes[Math.floor(Math.random() * edgeTypes.length)],
          });
        }
      }
    }

    return {
      nodes,
      edges,
      metadata: {
        description: 'Large-scale cancer pathway network',
        pathway: 'Comprehensive Cancer Network',
        organism: 'Homo sapiens',
        generated: true,
      },
    };
  }

  /**
   * Categorize protein by biological role
   * @param {string} proteinId - Protein identifier
   * @returns {string} Category
   */
  getProteinCategory(proteinId) {
    const categories = {
      TP53: 'tumor suppressor',
      BRCA1: 'tumor suppressor',
      BRCA2: 'tumor suppressor',
      ATM: 'DNA damage sensor',
      ATR: 'DNA damage sensor',
      CHEK1: 'checkpoint kinase',
      CHEK2: 'checkpoint kinase',
      MDM2: 'E3 ligase',
      MDM4: 'E3 ligase',
      CDKN1A: 'cell cycle regulator',
      PTEN: 'phosphatase',
      AKT1: 'kinase',
      KRAS: 'oncogene',
      BRAF: 'oncogene',
      EGFR: 'receptor',
    };
    return categories[proteinId] || 'protein';
  }

  /**
   * Execute demo scenario
   * @param {string} demoKey - Demo identifier (basic, complex, oncogene, performance)
   * @param {Function} logger - Logging function
   * @returns {Promise<Object>} Demo execution result
   */
  async executeDemo(demoKey, logger) {
    const demo = this.demoData[demoKey];
    if (!demo) {
      throw new Error(`Unknown demo: ${demoKey}`);
    }

    logger(`Starting demo: ${demo.name}`, 'info');
    logger(`Description: ${demo.description}`, 'info');
    logger(`Expected: ${demo.expectedNodes} nodes, ${demo.expectedEdges} edges`, 'info');

    try {
      const startTime = performance.now();

      // Visualize the network
      const result = await this.plugin.visualizeNetwork(demo.networkData);

      const renderTime = performance.now() - startTime;
      logger(`✅ Network rendered in ${renderTime.toFixed(2)}ms`, 'success');

      // Validate results
      const validation = this.validateResult(result, demo.networkData, demo.validationRules);

      if (validation.valid) {
        logger(`✅ Validation passed`, 'success');
        logger(`  Nodes: ${validation.actualNodes}/${demo.expectedNodes}`, 'success');
        logger(`  Edges: ${validation.actualEdges}/${demo.expectedEdges}`, 'success');
      } else {
        logger(`⚠️ Validation warnings:`, 'warning');
        validation.warnings.forEach(w => logger(`  ${w}`, 'warning'));
      }

      return {
        success: true,
        demo: demo.name,
        result,
        validation,
        renderTime,
      };
    } catch (error) {
      logger(`❌ Demo failed: ${error.message}`, 'error');
      throw error;
    }
  }

  /**
   * Validate visualization result
   * @param {Object} result - Visualization result from plugin
   * @param {Object} networkData - Original network data
   * @param {Object} rules - Validation rules
   * @returns {Object} Validation result
   */
  validateResult(result, networkData, rules) {
    const warnings = [];

    const actualNodes = result.nodeCount || networkData.nodes.length;
    const actualEdges = result.edgeCount || networkData.edges.length;

    // Check node count
    if (rules.minNodes && actualNodes < rules.minNodes) {
      warnings.push(`Node count ${actualNodes} below minimum ${rules.minNodes}`);
    }

    // Check edge count
    if (rules.minEdges && actualEdges < rules.minEdges) {
      warnings.push(`Edge count ${actualEdges} below minimum ${rules.minEdges}`);
    }

    // Check average confidence (if applicable)
    if (rules.minAvgConfidence && networkData.edges.length > 0) {
      const avgConfidence =
        networkData.edges.reduce((sum, e) => sum + (e.confidence || 0), 0) / networkData.edges.length;
      if (avgConfidence < rules.minAvgConfidence) {
        warnings.push(`Average confidence ${avgConfidence.toFixed(2)} below minimum ${rules.minAvgConfidence}`);
      }
    }

    return {
      valid: warnings.length === 0,
      warnings,
      actualNodes,
      actualEdges,
      timestamp: new Date().toISOString(),
    };
  }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ProteinNetworkDemo;
} else if (typeof window !== 'undefined') {
  window.ProteinNetworkDemo = ProteinNetworkDemo;
}
