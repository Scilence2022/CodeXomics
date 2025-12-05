/**
 * KEGG Pathway Viewer Plugin
 * Version: 1.0.0
 * Author: CodeXomics Team
 * License: MIT
 * 
 * Integrates with KEGG database for metabolic pathway retrieval and visualization
 */

class KEGGPathwayViewer {
    constructor() {
        this.id = 'kegg-pathway-viewer';
        this.name = 'KEGG Pathway Viewer';
        this.version = '1.0.0';
        this.keggApiBase = 'https://rest.kegg.jp';
        this.pathways = new Map();
        this.layoutModes = ['hierarchical', 'circular', 'grid'];
        this.currentLayout = 'hierarchical';
    }

    /**
     * Activate plugin
     */
    activate(context) {
        console.log(`🔌 Activating ${this.name} v${this.version}`);
        
        this.context = context;
        
        // Register commands
        context.subscriptions.push(
            context.registerCommand('kegg-viewer.searchPathway', this.searchPathway.bind(this)),
            context.registerCommand('kegg-viewer.getPathwayDetails', this.getPathwayDetails.bind(this)),
            context.registerCommand('kegg-viewer.findPathwaysByGene', this.findPathwaysByGene.bind(this)),
            context.registerCommand('kegg-viewer.getCompoundInfo', this.getCompoundInfo.bind(this))
        );
        
        // Register visualization executor
        context.registerVisualization({
            id: 'kegg-pathway',
            name: 'KEGG Metabolic Pathway',
            supportedDataTypes: ['metabolic-pathway', 'kegg-pathway', 'pathway-data', 'generic'],
            executor: this.renderPathway.bind(this)
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
     * Search for pathways by keyword
     */
    async searchPathway({ keyword, organism = 'hsa' }) {
        console.log('🔍 Searching KEGG pathways...', { keyword, organism });
        
        try {
            // Search pathways for organism
            const listUrl = `${this.keggApiBase}/list/pathway/${organism}`;
            const response = await fetch(listUrl);
            
            if (!response.ok) {
                throw new Error(`KEGG API error: ${response.statusText}`);
            }
            
            const text = await response.text();
            const pathways = this.parseKEGGList(text);
            
            // Filter by keyword
            const filtered = pathways.filter(p => 
                p.name.toLowerCase().includes(keyword.toLowerCase()) ||
                p.id.toLowerCase().includes(keyword.toLowerCase())
            );
            
            console.log(`✅ Found ${filtered.length} pathways matching "${keyword}"`);
            
            return {
                success: true,
                source: 'KEGG',
                organism,
                keyword,
                count: filtered.length,
                pathways: filtered
            };
            
        } catch (error) {
            console.error('❌ KEGG pathway search failed:', error);
            throw error;
        }
    }

    /**
     * Get detailed pathway information
     */
    async getPathwayDetails({ pathwayId }) {
        console.log('📊 Retrieving pathway details from KEGG...', { pathwayId });
        
        try {
            // Get pathway entry
            const getUrl = `${this.keggApiBase}/get/${pathwayId}`;
            const response = await fetch(getUrl);
            
            if (!response.ok) {
                throw new Error(`KEGG API error: ${response.statusText}`);
            }
            
            const text = await response.text();
            const pathwayInfo = this.parseKEGGEntry(text);
            
            // Get pathway genes and compounds
            const kgmlUrl = `${this.keggApiBase}/get/${pathwayId}/kgml`;
            const kgmlResponse = await fetch(kgmlUrl);
            
            let pathwayData = null;
            if (kgmlResponse.ok) {
                const kgmlText = await kgmlResponse.text();
                pathwayData = this.parseKGML(kgmlText);
            }
            
            console.log(`✅ Retrieved details for pathway ${pathwayId}`);
            
            return {
                success: true,
                source: 'KEGG',
                pathwayId,
                info: pathwayInfo,
                data: pathwayData
            };
            
        } catch (error) {
            console.error('❌ Failed to retrieve pathway details:', error);
            throw error;
        }
    }

    /**
     * Find pathways containing specific gene
     */
    async findPathwaysByGene({ gene, organism = 'hsa' }) {
        console.log('🧬 Finding pathways for gene...', { gene, organism });
        
        try {
            const geneId = gene.includes(':') ? gene : `${organism}:${gene}`;
            const url = `${this.keggApiBase}/link/pathway/${geneId}`;
            
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`KEGG API error: ${response.statusText}`);
            }
            
            const text = await response.text();
            const pathways = this.parseKEGGLink(text);
            
            console.log(`✅ Found ${pathways.length} pathways for gene ${gene}`);
            
            return {
                success: true,
                source: 'KEGG',
                gene,
                organism,
                count: pathways.length,
                pathways
            };
            
        } catch (error) {
            console.error('❌ Failed to find pathways:', error);
            throw error;
        }
    }

    /**
     * Get compound information
     */
    async getCompoundInfo({ compoundId }) {
        console.log('💊 Retrieving compound information...', { compoundId });
        
        try {
            const url = `${this.keggApiBase}/get/${compoundId}`;
            const response = await fetch(url);
            
            if (!response.ok) {
                throw new Error(`KEGG API error: ${response.statusText}`);
            }
            
            const text = await response.text();
            const compoundInfo = this.parseKEGGEntry(text);
            
            console.log(`✅ Retrieved compound information for ${compoundId}`);
            
            return {
                success: true,
                source: 'KEGG',
                compoundId,
                data: compoundInfo
            };
            
        } catch (error) {
            console.error('❌ Failed to retrieve compound info:', error);
            throw error;
        }
    }

    /**
     * Parse KEGG list format
     */
    parseKEGGList(text) {
        const lines = text.trim().split('\n');
        return lines.map(line => {
            const parts = line.split('\t');
            return {
                id: parts[0],
                name: parts[1] || ''
            };
        });
    }

    /**
     * Parse KEGG entry format
     */
    parseKEGGEntry(text) {
        const entry = {};
        let currentField = null;
        
        const lines = text.split('\n');
        lines.forEach(line => {
            if (line.match(/^[A-Z]/)) {
                const match = line.match(/^([A-Z_]+)\s+(.*)/);
                if (match) {
                    currentField = match[1];
                    entry[currentField] = match[2];
                }
            } else if (currentField && line.trim()) {
                entry[currentField] += ' ' + line.trim();
            }
        });
        
        return entry;
    }

    /**
     * Parse KEGG link format
     */
    parseKEGGLink(text) {
        const lines = text.trim().split('\n');
        return lines.map(line => {
            const parts = line.split('\t');
            return {
                gene: parts[0],
                pathway: parts[1]
            };
        });
    }

    /**
     * Parse KGML (KEGG Markup Language)
     */
    parseKGML(kgmlText) {
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(kgmlText, 'text/xml');
        
        const entries = xmlDoc.querySelectorAll('entry');
        const relations = xmlDoc.querySelectorAll('relation');
        const reactions = xmlDoc.querySelectorAll('reaction');
        
        const nodes = [];
        const edges = [];
        
        // Parse entries (genes, compounds, etc.)
        entries.forEach(entry => {
            const id = entry.getAttribute('id');
            const name = entry.getAttribute('name');
            const type = entry.getAttribute('type');
            
            const graphics = entry.querySelector('graphics');
            nodes.push({
                id,
                name: name.split(' ')[0], // First name only
                type,
                x: graphics ? parseFloat(graphics.getAttribute('x')) : null,
                y: graphics ? parseFloat(graphics.getAttribute('y')) : null,
                properties: {
                    fullName: name,
                    graphics: graphics ? {
                        name: graphics.getAttribute('name'),
                        fgcolor: graphics.getAttribute('fgcolor'),
                        bgcolor: graphics.getAttribute('bgcolor'),
                        type: graphics.getAttribute('type')
                    } : null
                }
            });
        });
        
        // Parse relations
        relations.forEach((relation, idx) => {
            const entry1 = relation.getAttribute('entry1');
            const entry2 = relation.getAttribute('entry2');
            const type = relation.getAttribute('type');
            
            edges.push({
                id: `rel-${idx}`,
                source: entry1,
                target: entry2,
                type: `relation-${type}`,
                properties: { relationType: type }
            });
        });
        
        // Parse reactions
        reactions.forEach((reaction, idx) => {
            const id = reaction.getAttribute('id');
            const name = reaction.getAttribute('name');
            const type = reaction.getAttribute('type');
            
            const substrates = reaction.querySelectorAll('substrate');
            const products = reaction.querySelectorAll('product');
            
            substrates.forEach(substrate => {
                products.forEach(product => {
                    edges.push({
                        id: `rxn-${idx}-${substrate.getAttribute('id')}-${product.getAttribute('id')}`,
                        source: substrate.getAttribute('id'),
                        target: product.getAttribute('id'),
                        type: 'reaction',
                        properties: {
                            reactionId: id,
                            reactionName: name,
                            reactionType: type
                        }
                    });
                });
            });
        });
        
        return {
            nodes,
            edges,
            metadata: {
                source: 'KEGG',
                format: 'KGML'
            }
        };
    }

    /**
     * Render pathway visualization
     */
    async renderPathway(pathwayData) {
        console.log('🎨 Rendering KEGG pathway visualization...');
        
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
        container.className = 'kegg-pathway-container';
        container.style.cssText = `
            width: 100%;
            height: 700px;
            background: linear-gradient(135deg, #fef9e7 0%, #f4e1d2 100%);
            border: 2px solid #e67e22;
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
                background: ${layout === this.currentLayout ? '#e67e22' : '#ecf0f1'};
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
        
        // Render edges with different styles for different types
        const edgesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        edgesGroup.setAttribute('class', 'edges');
        layout.edges.forEach(edge => {
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', edge.x1);
            line.setAttribute('y1', edge.y1);
            line.setAttribute('x2', edge.x2);
            line.setAttribute('y2', edge.y2);
            line.setAttribute('stroke', this.getEdgeColorByType(edge.type));
            line.setAttribute('stroke-width', edge.type === 'reaction' ? '2' : '1.5');
            line.setAttribute('opacity', '0.7');
            
            if (edge.type === 'reaction') {
                line.setAttribute('marker-end', 'url(#arrowhead)');
            }
            
            edgesGroup.appendChild(line);
        });
        
        // Add arrow marker for reactions
        const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        marker.setAttribute('id', 'arrowhead');
        marker.setAttribute('markerWidth', '10');
        marker.setAttribute('markerHeight', '7');
        marker.setAttribute('refX', '9');
        marker.setAttribute('refY', '3.5');
        marker.setAttribute('orient', 'auto');
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        polygon.setAttribute('points', '0 0, 10 3.5, 0 7');
        polygon.setAttribute('fill', '#e67e22');
        marker.appendChild(polygon);
        defs.appendChild(marker);
        svg.appendChild(defs);
        svg.appendChild(edgesGroup);
        
        // Render nodes with different shapes for different types
        const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodesGroup.setAttribute('class', 'nodes');
        layout.nodes.forEach(node => {
            const shape = this.createNodeShape(node);
            shape.style.cursor = 'pointer';
            
            // Add hover effect
            shape.addEventListener('mouseenter', () => {
                shape.setAttribute('stroke-width', '3');
                shape.setAttribute('filter', 'url(#shadow)');
            });
            shape.addEventListener('mouseleave', () => {
                shape.setAttribute('stroke-width', '2');
                shape.setAttribute('filter', 'none');
            });
            
            nodesGroup.appendChild(shape);
            
            // Add label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', node.x);
            text.setAttribute('y', node.y + 25);
            text.setAttribute('text-anchor', 'middle');
            text.setAttribute('font-size', '11');
            text.setAttribute('font-weight', 'bold');
            text.setAttribute('fill', '#2c3e50');
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
        const edgeTypes = this.countEdgeTypes(pathwayData.edges);
        
        info.innerHTML = `
            <div style="font-weight: bold; color: #e67e22; margin-bottom: 8px; font-size: 14px;">
                🧬 KEGG Pathway Analysis
            </div>
            <div style="color: #555; line-height: 1.6;">
                <strong>Components:</strong> ${pathwayData.nodes.length}<br>
                <strong>Reactions:</strong> ${pathwayData.edges.length}<br>
                <strong>Genes:</strong> ${nodeTypes.gene || 0}<br>
                <strong>Compounds:</strong> ${nodeTypes.compound || 0}<br>
                <strong>Layout:</strong> ${this.currentLayout}<br>
                <strong>Source:</strong> KEGG Database
            </div>
        `;
        container.appendChild(info);
        
        // Add KEGG logo/attribution
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
            color: #e67e22;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        `;
        attribution.textContent = '🔬 KEGG Database';
        container.appendChild(attribution);
        
        console.log('✅ KEGG pathway rendered successfully');
        
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
        
        if (this.currentLayout === 'circular') {
            const centerX = width / 2;
            const centerY = height / 2;
            const radius = Math.min(width, height) / 2 - padding;
            
            nodes = pathwayData.nodes.map((node, i) => {
                const angle = (2 * Math.PI * i) / pathwayData.nodes.length;
                return {
                    ...node,
                    x: centerX + radius * Math.cos(angle),
                    y: centerY + radius * Math.sin(angle)
                };
            });
        } else if (this.currentLayout === 'grid') {
            const cols = Math.ceil(Math.sqrt(pathwayData.nodes.length));
            nodes = pathwayData.nodes.map((node, i) => ({
                ...node,
                x: padding + ((i % cols) * (width - 2 * padding)) / cols,
                y: padding + (Math.floor(i / cols) * (height - 2 * padding)) / Math.ceil(pathwayData.nodes.length / cols)
            }));
        } else {
            // Hierarchical layout
            // Use original KGML coordinates if available
            nodes = pathwayData.nodes.map(node => {
                if (node.x && node.y) {
                    // Scale KGML coordinates to fit
                    return {
                        ...node,
                        x: (node.x / 1000) * (width - 2 * padding) + padding,
                        y: (node.y / 1000) * (height - 2 * padding) + padding
                    };
                }
                // Random layout if no coordinates
                return {
                    ...node,
                    x: padding + Math.random() * (width - 2 * padding),
                    y: padding + Math.random() * (height - 2 * padding)
                };
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
                y2: target ? target.y : 0
            };
        });
        
        return { nodes, edges };
    }

    /**
     * Create node shape based on type
     */
    createNodeShape(node) {
        const nodeType = node.type || 'gene';
        
        if (nodeType === 'compound') {
            // Circle for compounds
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', node.x);
            circle.setAttribute('cy', node.y);
            circle.setAttribute('r', '10');
            circle.setAttribute('fill', '#3498db');
            circle.setAttribute('stroke', '#2c3e50');
            circle.setAttribute('stroke-width', '2');
            return circle;
        } else if (nodeType === 'enzyme') {
            // Diamond for enzymes
            const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
            const points = [
                [node.x, node.y - 12],
                [node.x + 12, node.y],
                [node.x, node.y + 12],
                [node.x - 12, node.y]
            ].map(p => p.join(',')).join(' ');
            polygon.setAttribute('points', points);
            polygon.setAttribute('fill', '#9b59b6');
            polygon.setAttribute('stroke', '#2c3e50');
            polygon.setAttribute('stroke-width', '2');
            return polygon;
        } else {
            // Rectangle for genes
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', node.x - 12);
            rect.setAttribute('y', node.y - 8);
            rect.setAttribute('width', '24');
            rect.setAttribute('height', '16');
            rect.setAttribute('fill', '#e67e22');
            rect.setAttribute('stroke', '#2c3e50');
            rect.setAttribute('stroke-width', '2');
            rect.setAttribute('rx', '3');
            return rect;
        }
    }

    /**
     * Get edge color by type
     */
    getEdgeColorByType(type) {
        if (type === 'reaction') return '#e67e22';
        if (type && type.includes('activation')) return '#27ae60';
        if (type && type.includes('inhibition')) return '#e74c3c';
        return '#95a5a6';
    }

    /**
     * Format node label
     */
    formatNodeLabel(name) {
        if (!name) return '';
        // Remove organism prefix
        const cleaned = name.replace(/^[a-z]+:/, '');
        return cleaned.substring(0, 10);
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
     * Count edge types
     */
    countEdgeTypes(edges) {
        const counts = {};
        edges.forEach(edge => {
            const type = edge.type || 'unknown';
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
            pathwaysViewed: this.pathways.size,
            layoutModes: this.layoutModes,
            currentLayout: this.currentLayout,
            apiBase: this.keggApiBase
        };
    }
}

// Export plugin
module.exports = KEGGPathwayViewer;
