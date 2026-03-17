/**
 * STRING Network Explorer Plugin
 * Version: 1.0.0
 * Author: CodeXomics Team
 * License: MIT
 *
 * Integrates with STRING database for protein-protein interaction network retrieval and visualization
 */

class STRINGNetworkExplorer {
  constructor() {
    this.id = 'string-network-explorer';
    this.name = 'STRING Network Explorer';
    this.version = '1.0.0';
    this.stringApiBase = 'https://string-db.org/api';
    this.networks = new Map();
    this.layoutAlgorithms = ['force-directed', 'circular', 'hierarchical'];
    this.currentLayout = 'force-directed';
  }

  /**
   * Activate plugin
   */
  activate(context) {
    console.log(`🔌 Activating ${this.name} v${this.version}`);

    this.context = context;

    // Register commands
    context.subscriptions.push(
      context.registerCommand('string-explorer.search', this.searchProteinInteractions.bind(this)),
      context.registerCommand('string-explorer.getNetwork', this.getProteinNetwork.bind(this)),
      context.registerCommand('string-explorer.getEnrichment', this.getEnrichmentAnalysis.bind(this))
    );

    // Register visualization executor
    context.registerVisualization({
      id: 'string-network',
      name: 'STRING Protein Network',
      supportedDataTypes: ['protein-interaction', 'string-network', 'ppi-network', 'generic'],
      executor: this.renderNetwork.bind(this),
    });

    console.log(`✅ ${this.name} activated successfully`);
  }

  /**
   * Deactivate plugin
   */
  deactivate() {
    console.log(`🔌 Deactivating ${this.name}`);
    this.networks.clear();
    console.log(`✅ ${this.name} deactivated`);
  }

  /**
   * Search for protein interactions in STRING database
   */
  async searchProteinInteractions({ proteins, species = '9606', requiredScore = 400, networkType = 'physical' }) {
    console.log('🔍 Searching STRING database...', { proteins, species, requiredScore });

    try {
      // Format protein identifiers
      const identifiers = Array.isArray(proteins) ? proteins.join('%0d') : proteins;

      // Build API URL for network request
      const url = `${this.stringApiBase}/json/network?identifiers=${identifiers}&species=${species}&required_score=${requiredScore}&network_type=${networkType}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`STRING API error: ${response.statusText}`);
      }

      const interactions = await response.json();

      // Transform STRING data to CodeXomics network format
      const networkData = this.transformSTRINGData(interactions, proteins);

      console.log(`✅ Retrieved ${networkData.edges.length} interactions for ${networkData.nodes.length} proteins`);

      return {
        success: true,
        source: 'STRING',
        species,
        requiredScore,
        data: networkData,
      };
    } catch (error) {
      console.error('❌ STRING search failed:', error);
      throw error;
    }
  }

  /**
   * Get detailed protein network from STRING
   */
  async getProteinNetwork({ proteins, species = '9606', requiredScore = 400, limit = 50 }) {
    console.log('🕸️ Retrieving protein network from STRING...', { proteins, species, limit });

    try {
      const identifiers = Array.isArray(proteins) ? proteins.join('%0d') : proteins;

      // Get interaction partners
      const url = `${this.stringApiBase}/json/interaction_partners?identifiers=${identifiers}&species=${species}&required_score=${requiredScore}&limit=${limit}`;

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`STRING API error: ${response.statusText}`);
      }

      const partners = await response.json();

      // Get network for all proteins including partners
      const allProteins = [
        ...(Array.isArray(proteins) ? proteins : [proteins]),
        ...partners.map(p => p.stringId_B || p.preferredName_B),
      ];

      const networkData = await this.searchProteinInteractions({
        proteins: allProteins.slice(0, 50), // Limit to 50 to avoid API overload
        species,
        requiredScore,
      });

      return networkData;
    } catch (error) {
      console.error('❌ Failed to retrieve protein network:', error);
      throw error;
    }
  }

  /**
   * Get functional enrichment analysis from STRING
   */
  async getEnrichmentAnalysis({ proteins, species = '9606', categories = ['Process', 'Component', 'Function'] }) {
    console.log('📊 Performing enrichment analysis...', { proteins, species, categories });

    try {
      const identifiers = Array.isArray(proteins) ? proteins.join('%0d') : proteins;

      const enrichmentResults = {};

      // Query each category
      for (const category of categories) {
        const url = `${this.stringApiBase}/json/enrichment?identifiers=${identifiers}&species=${species}&category=${category}`;

        const response = await fetch(url);
        if (response.ok) {
          enrichmentResults[category] = await response.json();
        }
      }

      console.log(`✅ Enrichment analysis complete`);

      return {
        success: true,
        source: 'STRING',
        species,
        categories: Object.keys(enrichmentResults),
        data: enrichmentResults,
      };
    } catch (error) {
      console.error('❌ Enrichment analysis failed:', error);
      throw error;
    }
  }

  /**
   * Transform STRING API data to CodeXomics network format
   */
  transformSTRINGData(stringInteractions, queryProteins) {
    const nodeMap = new Map();
    const edges = [];

    // Process interactions
    stringInteractions.forEach((interaction, index) => {
      const sourceId = interaction.preferredName_A || interaction.stringId_A;
      const targetId = interaction.preferredName_B || interaction.stringId_B;

      // Add nodes
      if (!nodeMap.has(sourceId)) {
        nodeMap.set(sourceId, {
          id: sourceId,
          name: interaction.preferredName_A || sourceId,
          type: 'protein',
          stringId: interaction.stringId_A,
          ncbiTaxonId: interaction.ncbiTaxonId,
        });
      }

      if (!nodeMap.has(targetId)) {
        nodeMap.set(targetId, {
          id: targetId,
          name: interaction.preferredName_B || targetId,
          type: 'protein',
          stringId: interaction.stringId_B,
          ncbiTaxonId: interaction.ncbiTaxonId,
        });
      }

      // Add edge with combined score
      edges.push({
        id: `edge-${index}`,
        source: sourceId,
        target: targetId,
        confidence: interaction.score || 0,
        type: 'protein-interaction',
        properties: {
          combinedScore: interaction.score,
          nscore: interaction.nscore,
          fscore: interaction.fscore,
          pscore: interaction.pscore,
          ascore: interaction.ascore,
          escore: interaction.escore,
          dscore: interaction.dscore,
          tscore: interaction.tscore,
        },
      });
    });

    return {
      nodes: Array.from(nodeMap.values()),
      edges,
      metadata: {
        source: 'STRING',
        queryProteins,
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Render network visualization
   */
  async renderNetwork(networkData) {
    console.log('🎨 Rendering STRING network visualization...');

    // Parse input if needed
    if (typeof networkData === 'string') {
      networkData = JSON.parse(networkData);
    }

    // Handle data from API call result
    if (networkData.data) {
      networkData = networkData.data;
    }

    // Validate network data
    if (!networkData.nodes || !Array.isArray(networkData.nodes)) {
      throw new Error('Invalid network data: missing nodes array');
    }

    networkData.edges = networkData.edges || [];

    // Create container
    const container = document.createElement('div');
    container.className = 'string-network-container';
    container.style.cssText = `
            width: 100%;
            height: 700px;
            background: linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%);
            border: 2px solid #3498db;
            border-radius: 12px;
            position: relative;
            overflow: hidden;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
        `;

    // Create toolbar
    const toolbar = document.createElement('div');
    toolbar.style.cssText = `
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(255, 255, 255, 0.95);
            padding: 10px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            z-index: 10;
            display: flex;
            gap: 5px;
        `;

    const layoutButtons = this.layoutAlgorithms.map(layout => {
      const btn = document.createElement('button');
      btn.textContent = layout;
      btn.style.cssText = `
                padding: 5px 10px;
                background: ${layout === this.currentLayout ? '#3498db' : '#ecf0f1'};
                color: ${layout === this.currentLayout ? 'white' : '#333'};
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            `;
      btn.addEventListener('click', () => {
        this.currentLayout = layout;
        const newViz = this.renderNetwork(networkData);
        container.replaceWith(newViz);
      });
      return btn;
    });

    layoutButtons.forEach(btn => toolbar.appendChild(btn));
    container.appendChild(toolbar);

    // Create SVG canvas
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('width', '100%');
    svg.setAttribute('height', '100%');
    container.appendChild(svg);

    // Apply layout algorithm
    const layout = this.calculateLayout(networkData);

    // Render edges
    const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgesGroup.setAttribute('class', 'edges');
    layout.edges.forEach(edge => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', edge.x1);
      line.setAttribute('y1', edge.y1);
      line.setAttribute('x2', edge.x2);
      line.setAttribute('y2', edge.y2);
      line.setAttribute('stroke', this.getEdgeColor(edge.confidence));
      line.setAttribute('stroke-width', Math.max(1, edge.confidence / 200));
      line.setAttribute('opacity', '0.6');
      edgesGroup.appendChild(line);
    });
    svg.appendChild(edgesGroup);

    // Render nodes
    const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodesGroup.setAttribute('class', 'nodes');
    layout.nodes.forEach(node => {
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', node.x);
      circle.setAttribute('cy', node.y);
      circle.setAttribute('r', '12');
      circle.setAttribute('fill', '#3498db');
      circle.setAttribute('stroke', '#2c3e50');
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('data-node-id', node.id);
      circle.style.cursor = 'pointer';

      // Add hover effect
      circle.addEventListener('mouseenter', () => {
        circle.setAttribute('r', '16');
        circle.setAttribute('fill', '#e74c3c');
      });
      circle.addEventListener('mouseleave', () => {
        circle.setAttribute('r', '12');
        circle.setAttribute('fill', '#3498db');
      });

      nodesGroup.appendChild(circle);

      // Add label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', node.x);
      text.setAttribute('y', node.y - 18);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '12');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('fill', '#2c3e50');
      text.textContent = node.name.substring(0, 12);
      nodesGroup.appendChild(text);
    });
    svg.appendChild(nodesGroup);

    // Add network info panel
    const info = document.createElement('div');
    info.style.cssText = `
            position: absolute;
            bottom: 10px;
            left: 10px;
            background: rgba(255, 255, 255, 0.95);
            padding: 15px;
            border-radius: 8px;
            font-size: 13px;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            max-width: 300px;
        `;

    const avgConfidence =
      networkData.edges.length > 0
        ? (networkData.edges.reduce((sum, e) => sum + (e.confidence || 0), 0) / networkData.edges.length).toFixed(2)
        : 0;

    info.innerHTML = `
            <div style="font-weight: bold; color: #3498db; margin-bottom: 8px; font-size: 14px;">
                📊 STRING Network Analysis
            </div>
            <div style="color: #555; line-height: 1.6;">
                <strong>Proteins:</strong> ${networkData.nodes.length}<br>
                <strong>Interactions:</strong> ${networkData.edges.length}<br>
                <strong>Avg Confidence:</strong> ${avgConfidence}<br>
                <strong>Layout:</strong> ${this.currentLayout}<br>
                <strong>Source:</strong> STRING Database
            </div>
        `;
    container.appendChild(info);

    // Add STRING logo/attribution
    const attribution = document.createElement('div');
    attribution.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(255, 255, 255, 0.95);
            padding: 8px 12px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: bold;
            color: #3498db;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
    attribution.textContent = '🧬 STRING Database';
    container.appendChild(attribution);

    console.log('✅ STRING network rendered successfully');

    return container;
  }

  /**
   * Calculate network layout
   */
  calculateLayout(networkData) {
    const width = 800;
    const height = 700;
    const padding = 80;

    let nodes;

    if (this.currentLayout === 'circular') {
      // Circular layout
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2 - padding;

      nodes = networkData.nodes.map((node, i) => {
        const angle = (2 * Math.PI * i) / networkData.nodes.length;
        return {
          ...node,
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        };
      });
    } else if (this.currentLayout === 'hierarchical') {
      // Simple hierarchical layout
      const levels = Math.ceil(Math.sqrt(networkData.nodes.length));
      nodes = networkData.nodes.map((node, i) => ({
        ...node,
        x: padding + ((i % levels) * (width - 2 * padding)) / levels,
        y: padding + (Math.floor(i / levels) * (height - 2 * padding)) / levels,
      }));
    } else {
      // Force-directed layout (simplified)
      nodes = networkData.nodes.map((node, i) => ({
        ...node,
        x: node.x || padding + Math.random() * (width - 2 * padding),
        y: node.y || padding + Math.random() * (height - 2 * padding),
      }));
    }

    const edges = networkData.edges.map(edge => {
      const source = nodes.find(n => n.id === edge.source);
      const target = nodes.find(n => n.id === edge.target);

      return {
        ...edge,
        x1: source ? source.x : 0,
        y1: source ? source.y : 0,
        x2: target ? target.x : 0,
        y2: target ? target.y : 0,
      };
    });

    return { nodes, edges };
  }

  /**
   * Get edge color based on confidence score
   */
  getEdgeColor(confidence) {
    // STRING scores are 0-1000
    if (confidence > 700) return '#27ae60'; // High confidence - green
    if (confidence > 400) return '#f39c12'; // Medium confidence - orange
    return '#e74c3c'; // Low confidence - red
  }

  /**
   * Get plugin statistics
   */
  getStatistics() {
    return {
      version: this.version,
      networksCreated: this.networks.size,
      layoutAlgorithms: this.layoutAlgorithms,
      currentLayout: this.currentLayout,
      apiBase: this.stringApiBase,
    };
  }
}

// Export plugin
module.exports = STRINGNetworkExplorer;
