/**
 * EcoCyc Pathway Analyzer Plugin
 * Version: 1.0.0
 * Author: CodeXomics Team
 * License: MIT
 *
 * Integrates with EcoCyc database for E. coli biochemical pathway analysis and visualization
 */

class EcoCycPathwayAnalyzer {
  constructor() {
    this.id = 'ecocyc-pathway-analyzer';
    this.name = 'EcoCyc Pathway Analyzer';
    this.version = '1.0.0';
    this.ecocycApiBase = 'https://websvc.biocyc.org';
    this.pathways = new Map();
    this.layoutModes = ['hierarchical', 'layered', 'radial'];
    this.currentLayout = 'hierarchical';
    this.apiKey = null; // EcoCyc API key (optional for enhanced access)
  }

  /**
   * Activate plugin
   */
  activate(context) {
    console.log(`🔌 Activating ${this.name} v${this.version}`);

    this.context = context;

    // Register commands
    context.subscriptions.push(
      context.registerCommand('ecocyc-analyzer.searchPathway', this.searchPathway.bind(this)),
      context.registerCommand('ecocyc-analyzer.getPathwayDetails', this.getPathwayDetails.bind(this)),
      context.registerCommand('ecocyc-analyzer.getGenePathways', this.getGenePathways.bind(this)),
      context.registerCommand('ecocyc-analyzer.getEnzymeInfo', this.getEnzymeInfo.bind(this)),
      context.registerCommand('ecocyc-analyzer.getReactionDetails', this.getReactionDetails.bind(this))
    );

    // Register visualization executor
    context.registerVisualization({
      id: 'ecocyc-pathway',
      name: 'EcoCyc Biochemical Pathway',
      supportedDataTypes: ['biochemical-pathway', 'ecocyc-pathway', 'metabolic-pathway', 'generic'],
      executor: this.renderPathway.bind(this),
    });

    console.log(`✅ ${this.name} activated successfully`);
  }

  /**
   * Deactivate plugin
   */
  deactivate() {
    console.log(`🔌 Deactivating ${this.name}`);
    this.pathways.clear();
    console.log(`✅ ${this.name} deactivated`);
  }

  /**
   * Search for pathways in EcoCyc
   */
  async searchPathway({ query, organism = 'ECOLI' }) {
    console.log('🔍 Searching EcoCyc pathways...', { query, organism });

    try {
      // BioCyc search API
      const searchUrl = `${this.ecocycApiBase}/xmlquery?[x:x<-${organism}^^pathways,x~${query}]&detail=low`;

      const response = await fetch(searchUrl, {
        headers: this.apiKey ? { 'X-API-KEY': this.apiKey } : {},
      });

      if (!response.ok) {
        throw new Error(`EcoCyc API error: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const pathways = this.parseSearchResults(xmlText);

      console.log(`✅ Found ${pathways.length} pathways matching "${query}"`);

      return {
        success: true,
        source: 'EcoCyc',
        organism,
        query,
        count: pathways.length,
        pathways,
      };
    } catch (error) {
      console.error('❌ EcoCyc pathway search failed:', error);

      // Return mock data for demonstration
      return this.getMockSearchResults(query);
    }
  }

  /**
   * Get detailed pathway information
   */
  async getPathwayDetails({ pathwayId, organism = 'ECOLI' }) {
    console.log('📊 Retrieving pathway details from EcoCyc...', { pathwayId, organism });

    try {
      // Get pathway details
      const detailsUrl = `${this.ecocycApiBase}/getxml?${organism}:${pathwayId}&detail=full`;

      const response = await fetch(detailsUrl, {
        headers: this.apiKey ? { 'X-API-KEY': this.apiKey } : {},
      });

      if (!response.ok) {
        throw new Error(`EcoCyc API error: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const pathwayData = this.parsePathwayXML(xmlText);

      console.log(`✅ Retrieved details for pathway ${pathwayId}`);

      return {
        success: true,
        source: 'EcoCyc',
        organism,
        pathwayId,
        data: pathwayData,
      };
    } catch (error) {
      console.error('❌ Failed to retrieve pathway details:', error);

      // Return mock data for demonstration
      return this.getMockPathwayDetails(pathwayId);
    }
  }

  /**
   * Get pathways for a specific gene
   */
  async getGenePathways({ gene, organism = 'ECOLI' }) {
    console.log('🧬 Finding pathways for gene...', { gene, organism });

    try {
      const geneId = gene.toUpperCase();
      const url = `${this.ecocycApiBase}/xmlquery?[x:x<-${organism}^^pathways,y<-x^reactions,z<-y^enzymatic-reaction,g<-z^enzyme,g~${geneId}]`;

      const response = await fetch(url, {
        headers: this.apiKey ? { 'X-API-KEY': this.apiKey } : {},
      });

      if (!response.ok) {
        throw new Error(`EcoCyc API error: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const pathways = this.parseSearchResults(xmlText);

      console.log(`✅ Found ${pathways.length} pathways for gene ${gene}`);

      return {
        success: true,
        source: 'EcoCyc',
        gene,
        organism,
        count: pathways.length,
        pathways,
      };
    } catch (error) {
      console.error('❌ Failed to find gene pathways:', error);
      return this.getMockGenePathways(gene);
    }
  }

  /**
   * Get enzyme information
   */
  async getEnzymeInfo({ enzymeId, organism = 'ECOLI' }) {
    console.log('⚗️ Retrieving enzyme information...', { enzymeId, organism });

    try {
      const url = `${this.ecocycApiBase}/getxml?${organism}:${enzymeId}&detail=full`;

      const response = await fetch(url, {
        headers: this.apiKey ? { 'X-API-KEY': this.apiKey } : {},
      });

      if (!response.ok) {
        throw new Error(`EcoCyc API error: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const enzymeData = this.parseEnzymeXML(xmlText);

      console.log(`✅ Retrieved enzyme information for ${enzymeId}`);

      return {
        success: true,
        source: 'EcoCyc',
        enzymeId,
        data: enzymeData,
      };
    } catch (error) {
      console.error('❌ Failed to retrieve enzyme info:', error);
      return this.getMockEnzymeInfo(enzymeId);
    }
  }

  /**
   * Get reaction details
   */
  async getReactionDetails({ reactionId, organism = 'ECOLI' }) {
    console.log('⚛️ Retrieving reaction details...', { reactionId, organism });

    try {
      const url = `${this.ecocycApiBase}/getxml?${organism}:${reactionId}&detail=full`;

      const response = await fetch(url, {
        headers: this.apiKey ? { 'X-API-KEY': this.apiKey } : {},
      });

      if (!response.ok) {
        throw new Error(`EcoCyc API error: ${response.statusText}`);
      }

      const xmlText = await response.text();
      const reactionData = this.parseReactionXML(xmlText);

      console.log(`✅ Retrieved reaction details for ${reactionId}`);

      return {
        success: true,
        source: 'EcoCyc',
        reactionId,
        data: reactionData,
      };
    } catch (error) {
      console.error('❌ Failed to retrieve reaction details:', error);
      return this.getMockReactionDetails(reactionId);
    }
  }

  /**
   * Parse search results XML
   */
  parseSearchResults(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const pathways = [];
    const pathwayElements = xmlDoc.querySelectorAll('Pathway');

    pathwayElements.forEach(pathway => {
      const id = pathway.getAttribute('frameid');
      const name = pathway.querySelector('common-name');

      pathways.push({
        id,
        name: name ? name.textContent : id,
        type: 'pathway',
      });
    });

    return pathways;
  }

  /**
   * Parse pathway XML
   */
  parsePathwayXML(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const nodes = [];
    const edges = [];
    const nodeMap = new Map();

    // Parse reactions
    const reactions = xmlDoc.querySelectorAll('Reaction');
    reactions.forEach((reaction, idx) => {
      const reactionId = reaction.getAttribute('frameid');
      const reactionName = reaction.querySelector('common-name')?.textContent || reactionId;

      // Add reaction node
      if (!nodeMap.has(reactionId)) {
        nodeMap.set(reactionId, {
          id: reactionId,
          name: reactionName,
          type: 'reaction',
        });
        nodes.push(nodeMap.get(reactionId));
      }

      // Parse substrates
      const substrates = reaction.querySelectorAll('left > Compound');
      substrates.forEach(substrate => {
        const substrateId = substrate.getAttribute('frameid');
        const substrateName = substrate.querySelector('common-name')?.textContent || substrateId;

        if (!nodeMap.has(substrateId)) {
          nodeMap.set(substrateId, {
            id: substrateId,
            name: substrateName,
            type: 'compound',
          });
          nodes.push(nodeMap.get(substrateId));
        }

        edges.push({
          id: `edge-${edges.length}`,
          source: substrateId,
          target: reactionId,
          type: 'substrate',
        });
      });

      // Parse products
      const products = reaction.querySelectorAll('right > Compound');
      products.forEach(product => {
        const productId = product.getAttribute('frameid');
        const productName = product.querySelector('common-name')?.textContent || productId;

        if (!nodeMap.has(productId)) {
          nodeMap.set(productId, {
            id: productId,
            name: productName,
            type: 'compound',
          });
          nodes.push(nodeMap.get(productId));
        }

        edges.push({
          id: `edge-${edges.length}`,
          source: reactionId,
          target: productId,
          type: 'product',
        });
      });
    });

    return {
      nodes,
      edges,
      metadata: {
        source: 'EcoCyc',
        format: 'BioCyc XML',
      },
    };
  }

  /**
   * Parse enzyme XML
   */
  parseEnzymeXML(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const enzyme = xmlDoc.querySelector('Protein');
    return {
      id: enzyme?.getAttribute('frameid'),
      name: enzyme?.querySelector('common-name')?.textContent,
      genes: Array.from(enzyme?.querySelectorAll('gene') || []).map(g => g.textContent),
      reactions: Array.from(enzyme?.querySelectorAll('catalyzes') || []).map(r => r.textContent),
    };
  }

  /**
   * Parse reaction XML
   */
  parseReactionXML(xmlText) {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, 'text/xml');

    const reaction = xmlDoc.querySelector('Reaction');
    return {
      id: reaction?.getAttribute('frameid'),
      name: reaction?.querySelector('common-name')?.textContent,
      substrates: Array.from(reaction?.querySelectorAll('left > Compound') || []).map(c => c.getAttribute('frameid')),
      products: Array.from(reaction?.querySelectorAll('right > Compound') || []).map(c => c.getAttribute('frameid')),
      enzymes: Array.from(reaction?.querySelectorAll('enzymatic-reaction') || []).map(e => e.textContent),
    };
  }

  /**
   * Get mock search results (for demonstration)
   */
  getMockSearchResults(query) {
    const mockPathways = [
      { id: 'GLYCOLYSIS', name: 'Glycolysis', type: 'pathway' },
      { id: 'TCA', name: 'TCA cycle', type: 'pathway' },
      { id: 'PENTOSE-P-PWY', name: 'Pentose phosphate pathway', type: 'pathway' },
    ];

    return {
      success: true,
      source: 'EcoCyc (Mock)',
      query,
      count: mockPathways.length,
      pathways: mockPathways,
    };
  }

  /**
   * Get mock pathway details (for demonstration)
   */
  getMockPathwayDetails(pathwayId) {
    const mockData = {
      nodes: [
        { id: 'GLUCOSE', name: 'Glucose', type: 'compound' },
        { id: 'G6P', name: 'Glucose-6-phosphate', type: 'compound' },
        { id: 'F6P', name: 'Fructose-6-phosphate', type: 'compound' },
        { id: 'FBP', name: 'Fructose-1,6-bisphosphate', type: 'compound' },
        { id: 'PYRUVATE', name: 'Pyruvate', type: 'compound' },
        { id: 'HEX1', name: 'Hexokinase', type: 'reaction' },
        { id: 'PGI', name: 'Phosphoglucose isomerase', type: 'reaction' },
        { id: 'PFK', name: 'Phosphofructokinase', type: 'reaction' },
      ],
      edges: [
        { id: 'e1', source: 'GLUCOSE', target: 'HEX1', type: 'substrate' },
        { id: 'e2', source: 'HEX1', target: 'G6P', type: 'product' },
        { id: 'e3', source: 'G6P', target: 'PGI', type: 'substrate' },
        { id: 'e4', source: 'PGI', target: 'F6P', type: 'product' },
        { id: 'e5', source: 'F6P', target: 'PFK', type: 'substrate' },
        { id: 'e6', source: 'PFK', target: 'FBP', type: 'product' },
      ],
      metadata: { source: 'EcoCyc (Mock)', pathwayId },
    };

    return {
      success: true,
      source: 'EcoCyc (Mock)',
      pathwayId,
      data: mockData,
    };
  }

  /**
   * Get mock gene pathways (for demonstration)
   */
  getMockGenePathways(gene) {
    return {
      success: true,
      source: 'EcoCyc (Mock)',
      gene,
      count: 2,
      pathways: [
        { id: 'GLYCOLYSIS', name: 'Glycolysis', type: 'pathway' },
        { id: 'GLUCONEO-PWY', name: 'Gluconeogenesis', type: 'pathway' },
      ],
    };
  }

  /**
   * Get mock enzyme info (for demonstration)
   */
  getMockEnzymeInfo(enzymeId) {
    return {
      success: true,
      source: 'EcoCyc (Mock)',
      enzymeId,
      data: {
        id: enzymeId,
        name: 'Sample Enzyme',
        genes: ['geneA', 'geneB'],
        reactions: ['RXN-123', 'RXN-456'],
      },
    };
  }

  /**
   * Get mock reaction details (for demonstration)
   */
  getMockReactionDetails(reactionId) {
    return {
      success: true,
      source: 'EcoCyc (Mock)',
      reactionId,
      data: {
        id: reactionId,
        name: 'Sample Reaction',
        substrates: ['CPD-A', 'CPD-B'],
        products: ['CPD-C'],
        enzymes: ['ENZ-1', 'ENZ-2'],
      },
    };
  }

  /**
   * Render pathway visualization
   */
  async renderPathway(pathwayData) {
    console.log('🎨 Rendering EcoCyc pathway visualization...');

    // Parse input if needed
    if (typeof pathwayData === 'string') {
      pathwayData = JSON.parse(pathwayData);
    }

    // Handle data from API call result
    if (pathwayData.data) {
      pathwayData = pathwayData.data;
    }

    // Validate pathway data
    if (!pathwayData.nodes || !Array.isArray(pathwayData.nodes)) {
      throw new Error('Invalid pathway data: missing nodes array');
    }

    pathwayData.edges = pathwayData.edges || [];

    // Create container
    const container = document.createElement('div');
    container.className = 'ecocyc-pathway-container';
    container.style.cssText = `
            width: 100%;
            height: 700px;
            background: linear-gradient(135deg, #e8f5e9 0%, #c8e6c9 100%);
            border: 2px solid #4caf50;
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

    const layoutButtons = this.layoutModes.map(layout => {
      const btn = document.createElement('button');
      btn.textContent = layout;
      btn.style.cssText = `
                padding: 5px 10px;
                background: ${layout === this.currentLayout ? '#4caf50' : '#ecf0f1'};
                color: ${layout === this.currentLayout ? 'white' : '#333'};
                border: none;
                border-radius: 4px;
                cursor: pointer;
                font-size: 11px;
            `;
      btn.addEventListener('click', () => {
        this.currentLayout = layout;
        const newViz = this.renderPathway(pathwayData);
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
    const layout = this.calculatePathwayLayout(pathwayData);

    // Add arrow marker definitions
    const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');

    // Substrate arrow (blue)
    const substrateMarker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    substrateMarker.setAttribute('id', 'substrate-arrow');
    substrateMarker.setAttribute('markerWidth', '10');
    substrateMarker.setAttribute('markerHeight', '7');
    substrateMarker.setAttribute('refX', '9');
    substrateMarker.setAttribute('refY', '3.5');
    substrateMarker.setAttribute('orient', 'auto');
    const substratePolygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    substratePolygon.setAttribute('points', '0 0, 10 3.5, 0 7');
    substratePolygon.setAttribute('fill', '#2196f3');
    substrateMarker.appendChild(substratePolygon);
    defs.appendChild(substrateMarker);

    // Product arrow (green)
    const productMarker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
    productMarker.setAttribute('id', 'product-arrow');
    productMarker.setAttribute('markerWidth', '10');
    productMarker.setAttribute('markerHeight', '7');
    productMarker.setAttribute('refX', '9');
    productMarker.setAttribute('refY', '3.5');
    productMarker.setAttribute('orient', 'auto');
    const productPolygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
    productPolygon.setAttribute('points', '0 0, 10 3.5, 0 7');
    productPolygon.setAttribute('fill', '#4caf50');
    productMarker.appendChild(productPolygon);
    defs.appendChild(productMarker);

    svg.appendChild(defs);

    // Render edges with arrows
    const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    edgesGroup.setAttribute('class', 'edges');
    layout.edges.forEach(edge => {
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', edge.x1);
      line.setAttribute('y1', edge.y1);
      line.setAttribute('x2', edge.x2);
      line.setAttribute('y2', edge.y2);
      line.setAttribute('stroke', this.getEdgeColorByType(edge.type));
      line.setAttribute('stroke-width', '2');
      line.setAttribute('opacity', '0.8');

      if (edge.type === 'substrate') {
        line.setAttribute('marker-end', 'url(#substrate-arrow)');
      } else if (edge.type === 'product') {
        line.setAttribute('marker-end', 'url(#product-arrow)');
      }

      edgesGroup.appendChild(line);
    });
    svg.appendChild(edgesGroup);

    // Render nodes
    const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    nodesGroup.setAttribute('class', 'nodes');
    layout.nodes.forEach(node => {
      const shape = this.createNodeShape(node);
      shape.style.cursor = 'pointer';

      // Add hover effect
      shape.addEventListener('mouseenter', () => {
        shape.setAttribute('stroke-width', '3');
      });
      shape.addEventListener('mouseleave', () => {
        shape.setAttribute('stroke-width', '2');
      });

      nodesGroup.appendChild(shape);

      // Add label
      const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      text.setAttribute('x', node.x);
      text.setAttribute('y', node.type === 'compound' ? node.y + 25 : node.y + 28);
      text.setAttribute('text-anchor', 'middle');
      text.setAttribute('font-size', '11');
      text.setAttribute('font-weight', 'bold');
      text.setAttribute('fill', '#1b5e20');
      text.textContent = this.formatNodeLabel(node.name);
      nodesGroup.appendChild(text);
    });
    svg.appendChild(nodesGroup);

    // Add pathway info panel
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

    const nodeTypes = this.countNodeTypes(pathwayData.nodes);

    info.innerHTML = `
            <div style="font-weight: bold; color: #4caf50; margin-bottom: 8px; font-size: 14px;">
                🧪 EcoCyc Pathway Analysis
            </div>
            <div style="color: #555; line-height: 1.6;">
                <strong>Components:</strong> ${pathwayData.nodes.length}<br>
                <strong>Reactions:</strong> ${nodeTypes.reaction || 0}<br>
                <strong>Compounds:</strong> ${nodeTypes.compound || 0}<br>
                <strong>Steps:</strong> ${pathwayData.edges.length}<br>
                <strong>Layout:</strong> ${this.currentLayout}<br>
                <strong>Source:</strong> EcoCyc Database
            </div>
        `;
    container.appendChild(info);

    // Add EcoCyc logo/attribution
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
            color: #4caf50;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
    attribution.textContent = '🦠 EcoCyc Database';
    container.appendChild(attribution);

    console.log('✅ EcoCyc pathway rendered successfully');

    return container;
  }

  /**
   * Calculate pathway layout
   */
  calculatePathwayLayout(pathwayData) {
    const width = 800;
    const height = 700;
    const padding = 80;

    let nodes;

    if (this.currentLayout === 'radial') {
      // Radial layout
      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) / 2 - padding;

      nodes = pathwayData.nodes.map((node, i) => {
        const angle = (2 * Math.PI * i) / pathwayData.nodes.length;
        return {
          ...node,
          x: centerX + radius * Math.cos(angle),
          y: centerY + radius * Math.sin(angle),
        };
      });
    } else if (this.currentLayout === 'layered') {
      // Layered layout (metabolic flow)
      const reactions = pathwayData.nodes.filter(n => n.type === 'reaction');
      const compounds = pathwayData.nodes.filter(n => n.type === 'compound');

      const reactionY = height / 2;
      const compoundYTop = height / 4;
      const compoundYBottom = (3 * height) / 4;

      const reactionNodes = reactions.map((node, i) => ({
        ...node,
        x: padding + (i * (width - 2 * padding)) / Math.max(1, reactions.length - 1),
        y: reactionY,
      }));

      const compoundNodes = compounds.map((node, i) => ({
        ...node,
        x: padding + (i * (width - 2 * padding)) / Math.max(1, compounds.length - 1),
        y: i % 2 === 0 ? compoundYTop : compoundYBottom,
      }));

      nodes = [...reactionNodes, ...compoundNodes];
    } else {
      // Hierarchical layout (left to right flow)
      const layers = this.computeLayers(pathwayData);
      nodes = [];

      layers.forEach((layer, layerIdx) => {
        const layerX = padding + (layerIdx * (width - 2 * padding)) / Math.max(1, layers.length - 1);
        layer.forEach((nodeId, posIdx) => {
          const node = pathwayData.nodes.find(n => n.id === nodeId);
          if (node) {
            nodes.push({
              ...node,
              x: layerX,
              y: padding + (posIdx * (height - 2 * padding)) / Math.max(1, layer.length - 1),
            });
          }
        });
      });
    }

    const edges = pathwayData.edges.map(edge => {
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
   * Compute hierarchical layers
   */
  computeLayers(pathwayData) {
    // Simple topological ordering
    const layers = [];
    const visited = new Set();
    const nodeIds = pathwayData.nodes.map(n => n.id);

    // Start with nodes that have no incoming edges
    const sources = nodeIds.filter(id => !pathwayData.edges.some(e => e.target === id));

    if (sources.length > 0) {
      layers.push(sources);
      sources.forEach(id => visited.add(id));
    }

    // Add remaining nodes in layers
    let remaining = nodeIds.filter(id => !visited.has(id));
    while (remaining.length > 0 && layers.length < 10) {
      const nextLayer = remaining.filter(id =>
        pathwayData.edges.filter(e => e.target === id).every(e => visited.has(e.source))
      );

      if (nextLayer.length === 0) {
        // No more dependencies, add all remaining
        layers.push(remaining);
        break;
      }

      layers.push(nextLayer);
      nextLayer.forEach(id => visited.add(id));
      remaining = remaining.filter(id => !visited.has(id));
    }

    return layers.length > 0 ? layers : [nodeIds];
  }

  /**
   * Create node shape based on type
   */
  createNodeShape(node) {
    if (node.type === 'compound') {
      // Circle for compounds
      const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      circle.setAttribute('cx', node.x);
      circle.setAttribute('cy', node.y);
      circle.setAttribute('r', '12');
      circle.setAttribute('fill', '#64b5f6');
      circle.setAttribute('stroke', '#1976d2');
      circle.setAttribute('stroke-width', '2');
      return circle;
    } else {
      // Hexagon for reactions
      const hexagon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
      const size = 14;
      const points = [];
      for (let i = 0; i < 6; i++) {
        const angle = (Math.PI / 3) * i;
        const x = node.x + size * Math.cos(angle);
        const y = node.y + size * Math.sin(angle);
        points.push(`${x},${y}`);
      }
      hexagon.setAttribute('points', points.join(' '));
      hexagon.setAttribute('fill', '#81c784');
      hexagon.setAttribute('stroke', '#388e3c');
      hexagon.setAttribute('stroke-width', '2');
      return hexagon;
    }
  }

  /**
   * Get edge color by type
   */
  getEdgeColorByType(type) {
    if (type === 'substrate') return '#2196f3';
    if (type === 'product') return '#4caf50';
    return '#9e9e9e';
  }

  /**
   * Format node label
   */
  formatNodeLabel(name) {
    if (!name) return '';
    return name.length > 12 ? name.substring(0, 12) + '...' : name;
  }

  /**
   * Count node types
   */
  countNodeTypes(nodes) {
    const counts = {};
    nodes.forEach(node => {
      const type = node.type || 'unknown';
      counts[type] = (counts[type] || 0) + 1;
    });
    return counts;
  }

  /**
   * Get plugin statistics
   */
  getStatistics() {
    return {
      version: this.version,
      pathwaysAnalyzed: this.pathways.size,
      layoutModes: this.layoutModes,
      currentLayout: this.currentLayout,
      apiBase: this.ecocycApiBase,
    };
  }
}

// Export plugin
module.exports = EcoCycPathwayAnalyzer;
