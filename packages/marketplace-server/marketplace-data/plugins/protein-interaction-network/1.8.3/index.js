/**
 * Protein Interaction Network Visualizer Plugin
 * Version: 1.8.3
 * Author: CodeXomics Team
 * License: Apache-2.0
 *
 * Interactive protein-protein interaction network analysis and visualization
 */

class ProteinNetworkPlugin {
  constructor() {
    this.id = 'protein-interaction-network';
    this.name = 'Protein Interaction Network Visualizer';
    this.version = '1.8.3';
    this.networks = new Map();
    this.layoutAlgorithms = ['force-directed', 'circular', 'hierarchical', 'grid'];
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
      context.registerCommand('protein-network.visualize', this.visualizeNetwork.bind(this)),
      context.registerCommand('protein-network.layout', this.changeLayout.bind(this))
    );

    // Register visualization executor
    context.registerVisualization({
      id: 'protein-network',
      name: 'Protein Interaction Network',
      supportedDataTypes: ['protein-interaction', 'ppi-network', 'generic'],
      executor: this.renderNetwork.bind(this),
    });

    console.log(`✅ ${this.name} activated successfully`);
  }

  /**
   * Deactivate plugin
   */
  deactivate() {
    console.log(`🔌 Deactivating ${this.name}`);

    // Clean up networks
    this.networks.clear();

    console.log(`✅ ${this.name} deactivated`);
  }

  /**
   * Visualize protein interaction network
   */
  async visualizeNetwork(data) {
    console.log('🔬 Visualizing protein interaction network...');

    try {
      // Parse input data
      const networkData = this.parseNetworkData(data);

      // Create network ID
      const networkId = `network-${Date.now()}`;

      // Render network
      const visualization = await this.renderNetwork(networkData);

      // Store network
      this.networks.set(networkId, {
        data: networkData,
        visualization,
        createdAt: new Date(),
      });

      console.log(`✅ Network visualized: ${networkId}`);

      return {
        success: true,
        networkId,
        nodeCount: networkData.nodes.length,
        edgeCount: networkData.edges.length,
      };
    } catch (error) {
      console.error('❌ Network visualization failed:', error);
      throw error;
    }
  }

  /**
   * Parse network data from various formats
   */
  parseNetworkData(data) {
    if (!data) {
      throw new Error('Invalid network data: data is null or undefined. Expected an object with "nodes" and "edges" arrays.');
    }

    // Handle different data formats
    if (typeof data === 'string') {
      try {
        // Parse JSON string
        data = JSON.parse(data);
      } catch (e) {
        throw new Error(`Invalid network data: failed to parse JSON string. ${e.message}`);
      }
    }

    // Check if the LLM passed a single protein or identifier instead of a network
    if (!data.nodes && (data.protein || data.gene || data.identifier || data.proteins)) {
      const hint = data.protein || data.gene || data.identifier || (Array.isArray(data.proteins) ? data.proteins.join(', ') : data.proteins);
      throw new Error(`Invalid network data: received identifier(s) "${hint}" but no network structure. This plugin ONLY visualizes existing network data. Please use a search tool (like 'string-network-explorer.search') first to fetch the interaction data, then pass the result to this tool's "data" parameter.`);
    }

    // Validate required fields
    if (!data.nodes || !Array.isArray(data.nodes)) {
      throw new Error('Invalid network data: missing "nodes" array. The data object must contain a "nodes" array (e.g., {"nodes": [{"id": "P1"}], "edges": [...]}).');
    }

    // Ensure edges array exists
    if (!data.edges || !Array.isArray(data.edges)) {
      data.edges = [];
    }

    // Process nodes
    const nodes = data.nodes.map((node, index) => ({
      id: node.id || `node-${index}`,
      name: node.name || node.protein || node.id || `Protein ${index + 1}`,
      type: node.type || 'protein',
      properties: node.properties || {},
      x: node.x || null,
      y: node.y || null,
    }));

    // Process edges
    const edges = data.edges.map((edge, index) => ({
      id: edge.id || `edge-${index}`,
      source: edge.source || edge.from,
      target: edge.target || edge.to,
      confidence: edge.confidence || edge.score || 0.5,
      type: edge.type || 'interaction',
      properties: edge.properties || {},
    }));

    return {
      nodes,
      edges,
      metadata: data.metadata || {},
    };
  }

  /**
   * Render network visualization
   */
  async renderNetwork(networkData) {
    console.log('🎨 Rendering network visualization...');

    // Create container
    const container = document.createElement('div');
    container.className = 'protein-network-container';
    container.style.cssText = `
            width: 100%;
            height: 600px;
            background: #ffffff;
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            position: relative;
            overflow: hidden;
        `;

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
      line.setAttribute('stroke-width', edge.confidence * 3);
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
      circle.setAttribute('r', '10');
      circle.setAttribute('fill', this.getNodeColor(node.type));
      circle.setAttribute('stroke', '#333');
      circle.setAttribute('stroke-width', '2');
      circle.setAttribute('data-node-id', node.id);

      // Add hover effect
      circle.style.cursor = 'pointer';
      circle.addEventListener('mouseenter', () => {
        circle.setAttribute('r', '15');
        this.showNodeTooltip(node, circle);
      });
      circle.addEventListener('mouseleave', () => {
        circle.setAttribute('r', '10');
        this.hideNodeTooltip();
      });

      nodesGroup.appendChild(circle);

      // Add label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', node.x);
      text.setAttribute('y', node.y - 15);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '12');
      text.setAttribute('fill', '#333');
      text.textContent = node.name.substring(0, 15);
      nodesGroup.appendChild(text);
    });
    svg.appendChild(nodesGroup);

    // Add network info
    const info = document.createElement('div');
    info.style.cssText = `
            position: absolute;
            top: 10px;
            left: 10px;
            background: rgba(255, 255, 255, 0.9);
            padding: 10px;
            border-radius: 4px;
            font-size: 12px;
            font-family: monospace;
        `;
    info.innerHTML = `
            <strong>Protein Interaction Network</strong><br>
            Nodes: ${networkData.nodes.length}<br>
            Edges: ${networkData.edges.length}<br>
            Layout: ${this.currentLayout}
        `;
    container.appendChild(info);

    console.log('✅ Network rendered successfully');

    return container;
  }

  /**
   * Calculate network layout
   */
  calculateLayout(networkData) {
    const width = 800;
    const height = 600;

    // Simple force-directed layout simulation
    const nodes = networkData.nodes.map((node, i) => ({
      ...node,
      x: node.x || Math.random() * width,
      y: node.y || Math.random() * height,
    }));

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
   * Change network layout algorithm
   */
  changeLayout(layoutType) {
    if (this.layoutAlgorithms.includes(layoutType)) {
      this.currentLayout = layoutType;
      console.log(`📐 Layout changed to: ${layoutType}`);
      return { success: true, layout: layoutType };
    } else {
      throw new Error(`Invalid layout type: ${layoutType}`);
    }
  }

  /**
   * Get node color based on type
   */
  getNodeColor(type) {
    const colors = {
      protein: '#4CAF50',
      enzyme: '#2196F3',
      receptor: '#FF9800',
      default: '#9E9E9E',
    };
    return colors[type] || colors.default;
  }

  /**
   * Get edge color based on confidence
   */
  getEdgeColor(confidence) {
    if (confidence > 0.8) return '#4CAF50';
    if (confidence > 0.5) return '#FF9800';
    return '#f44336';
  }

  /**
   * Show node tooltip
   */
  showNodeTooltip(node, element) {
    // Implementation for tooltip
    console.log(`Node: ${node.name}`, node.properties);
  }

  /**
   * Hide node tooltip
   */
  hideNodeTooltip() {
    // Implementation for hiding tooltip
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
    };
  }
}

// Export plugin
module.exports = ProteinNetworkPlugin;
