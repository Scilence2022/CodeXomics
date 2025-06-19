/**
 * NetworkGraphPlugin - Universal network graph visualization plugin
 * Provides interactive network visualizations for all types of biological networks
 * Designed to be called by other plugins for consistent visualization
 */
class NetworkGraphPlugin {
    constructor(app, configManager) {
        this.app = app;
        this.configManager = configManager;
        this.initialized = false;
        
        // Default visualization options
        this.defaultOptions = {
            width: 800,
            height: 600,
            nodeRadius: 8,
            linkDistance: 100,
            charge: -300,
            showLabels: true,
            enableDrag: true,
            enableZoom: true,
            colorScheme: 'type'
        };
        
        console.log('NetworkGraphPlugin constructor called');
    }

    /**
     * Initialize the plugin
     */
    static init(app, configManager) {
        return new NetworkGraphPlugin(app, configManager);
    }

    /**
     * Render any type of network graph
     * Universal entry point for network visualization
     */
    async renderNetworkGraph(params) {
        console.log('Rendering network graph with params:', params);
        
        try {
            const { networkData, container, options = {} } = params;
            
            if (!networkData || !networkData.nodes || !networkData.edges) {
                throw new Error('Valid network data with nodes and edges is required');
            }

            if (!container) {
                throw new Error('Container element is required');
            }

            // Merge options with defaults
            const vizOptions = { ...this.defaultOptions, ...options };
            
            // Determine network type and apply appropriate styling
            const networkType = networkData.networkType || networkData.metadata?.networkType || 'generic';
            
            // Apply network-specific styling
            this.applyNetworkTypeStyles(networkData, networkType, vizOptions);
            
            // Create the visualization
            const result = await this.createInteractiveVisualization(networkData, container, vizOptions);
            
            // Add network-specific controls and panels
            this.addNetworkControls(container, networkData, networkType, vizOptions);
            
            console.log('Network graph rendered successfully');
            return {
                type: 'network-graph',
                networkType: networkType,
                visualization: result,
                metadata: {
                    nodeCount: networkData.nodes.length,
                    edgeCount: networkData.edges.length,
                    networkType: networkType,
                    generatedAt: new Date().toISOString(),
                    plugin: 'NetworkGraphPlugin',
                    version: '1.0.0'
                }
            };

        } catch (error) {
            console.error('Error rendering network graph:', error);
            throw error;
        }
    }

    /**
     * Create interactive D3.js visualization
     */
    async createInteractiveVisualization(networkData, container, options) {
        // Clear container
        if (typeof d3 !== 'undefined') {
            d3.select(container).selectAll('*').remove();
        } else {
            container.innerHTML = '';
        }

        if (typeof d3 !== 'undefined') {
            return await this.createD3Visualization(networkData, container, options);
        } else {
            return await this.createSVGVisualization(networkData, container, options);
        }
    }

    /**
     * Create D3.js-based interactive visualization
     */
    async createD3Visualization(networkData, container, options) {
        const {
            width,
            height,
            nodeRadius,
            linkDistance,
            charge,
            showLabels,
            enableDrag,
            enableZoom
        } = options;

        // Create SVG
        const svg = d3.select(container)
            .append('svg')
            .attr('width', width)
            .attr('height', height)
            .style('border', '1px solid #ccc')
            .style('border-radius', '4px');

        // Add zoom behavior
        if (enableZoom) {
            const zoom = d3.zoom()
                .scaleExtent([0.1, 10])
                .on('zoom', (event) => {
                    g.attr('transform', event.transform);
                });
            svg.call(zoom);
        }

        // Create main group for zoom/pan
        const g = svg.append('g');

        // Create force simulation
        const simulation = d3.forceSimulation(networkData.nodes)
            .force('link', d3.forceLink(networkData.edges).id(d => d.id).distance(linkDistance))
            .force('charge', d3.forceManyBody().strength(charge))
            .force('center', d3.forceCenter(width / 2, height / 2))
            .force('collision', d3.forceCollide().radius(d => (d.size || nodeRadius) + 2));

        // Create links
        const links = g.append('g')
            .attr('class', 'links')
            .selectAll('line')
            .data(networkData.edges)
            .enter().append('line')
            .attr('stroke', d => d.color || '#999')
            .attr('stroke-opacity', 0.6)
            .attr('stroke-width', d => Math.sqrt((d.weight || 1) * 3));

        // Add arrows for directed networks
        if (this.isDirectedNetwork(networkData)) {
            this.addArrowMarkers(svg);
            links.attr('marker-end', 'url(#arrowhead)');
        }

        // Create nodes
        const nodes = g.append('g')
            .attr('class', 'nodes')
            .selectAll('circle')
            .data(networkData.nodes)
            .enter().append('circle')
            .attr('r', d => d.size || nodeRadius)
            .attr('fill', d => d.color || '#4ECDC4')
            .attr('stroke', '#fff')
            .attr('stroke-width', 1.5);

        // Add drag behavior
        if (enableDrag) {
            nodes.call(d3.drag()
                .on('start', dragstarted)
                .on('drag', dragged)
                .on('end', dragended));
        }

        // Add labels
        let labels;
        if (showLabels) {
            labels = g.append('g')
                .attr('class', 'labels')
                .selectAll('text')
                .data(networkData.nodes)
                .enter().append('text')
                .text(d => d.label || d.name || d.id)
                .attr('font-size', '10px')
                .attr('font-family', 'Arial, sans-serif')
                .attr('text-anchor', 'middle')
                .attr('dy', d => (d.size || nodeRadius) + 12)
                .attr('fill', '#333');
        }

        // Add tooltips
        this.addTooltips(nodes, networkData);

        // Update positions on simulation tick
        simulation.on('tick', () => {
            links
                .attr('x1', d => d.source.x)
                .attr('y1', d => d.source.y)
                .attr('x2', d => d.target.x)
                .attr('y2', d => d.target.y);

            nodes
                .attr('cx', d => d.x)
                .attr('cy', d => d.y);

            if (showLabels && labels) {
                labels
                    .attr('x', d => d.x)
                    .attr('y', d => d.y);
            }
        });

        // Drag functions
        function dragstarted(event, d) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }

        function dragged(event, d) {
            d.fx = event.x;
            d.fy = event.y;
        }

        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }

        return { svg, simulation, nodes, links, labels };
    }

    /**
     * Create fallback SVG visualization (without D3.js)
     */
    async createSVGVisualization(networkData, container, options) {
        const { width, height, nodeRadius, showLabels } = options;

        // Create SVG element
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('width', width);
        svg.setAttribute('height', height);
        svg.style.border = '1px solid #ccc';
        svg.style.borderRadius = '4px';

        // Simple force-directed layout simulation
        const nodes = networkData.nodes.map((node, i) => ({
            ...node,
            x: Math.random() * (width - 100) + 50,
            y: Math.random() * (height - 100) + 50,
            vx: 0,
            vy: 0
        }));

        // Simple physics simulation
        for (let i = 0; i < 100; i++) {
            this.simulatePhysics(nodes, networkData.edges, width, height);
        }

        // Draw edges
        const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        edgeGroup.setAttribute('class', 'edges');
        
        networkData.edges.forEach(edge => {
            const sourceNode = nodes.find(n => n.id === edge.source);
            const targetNode = nodes.find(n => n.id === edge.target);
            
            if (sourceNode && targetNode) {
                const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                line.setAttribute('x1', sourceNode.x);
                line.setAttribute('y1', sourceNode.y);
                line.setAttribute('x2', targetNode.x);
                line.setAttribute('y2', targetNode.y);
                line.setAttribute('stroke', edge.color || '#999');
                line.setAttribute('stroke-width', Math.sqrt((edge.weight || 1) * 3));
                line.setAttribute('stroke-opacity', '0.6');
                edgeGroup.appendChild(line);
            }
        });
        
        svg.appendChild(edgeGroup);

        // Draw nodes
        const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodeGroup.setAttribute('class', 'nodes');
        
        nodes.forEach(node => {
            const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            circle.setAttribute('cx', node.x);
            circle.setAttribute('cy', node.y);
            circle.setAttribute('r', node.size || nodeRadius);
            circle.setAttribute('fill', node.color || '#4ECDC4');
            circle.setAttribute('stroke', '#fff');
            circle.setAttribute('stroke-width', '2');
            
            // Add click event
            circle.addEventListener('click', () => {
                this.showNodeDetails(node);
            });
            
            nodeGroup.appendChild(circle);
            
            // Node labels
            if (showLabels && (node.label || node.name)) {
                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', node.x);
                text.setAttribute('y', node.y + (node.size || nodeRadius) + 15);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('font-family', 'Arial, sans-serif');
                text.setAttribute('font-size', '10');
                text.setAttribute('fill', '#333');
                text.textContent = node.label || node.name;
                nodeGroup.appendChild(text);
            }
        });
        
        svg.appendChild(nodeGroup);
        container.appendChild(svg);

        return { svg, nodes };
    }

    /**
     * Simple physics simulation for SVG layout
     */
    simulatePhysics(nodes, edges, width, height) {
        const alpha = 0.1;
        const centerX = width / 2;
        const centerY = height / 2;

        // Reset forces
        nodes.forEach(node => {
            node.vx = 0;
            node.vy = 0;
        });

        // Repulsion between nodes
        for (let i = 0; i < nodes.length; i++) {
            for (let j = i + 1; j < nodes.length; j++) {
                const node1 = nodes[i];
                const node2 = nodes[j];
                const dx = node2.x - node1.x;
                const dy = node2.y - node1.y;
                const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = 1000 / (distance * distance);
                
                node1.vx -= (dx / distance) * force;
                node1.vy -= (dy / distance) * force;
                node2.vx += (dx / distance) * force;
                node2.vy += (dy / distance) * force;
            }
        }

        // Attraction along edges
        edges.forEach(edge => {
            const source = nodes.find(n => n.id === edge.source);
            const target = nodes.find(n => n.id === edge.target);
            
            if (source && target) {
                const dx = target.x - source.x;
                const dy = target.y - source.y;
                const distance = Math.sqrt(dx * dx + dy * dy) || 1;
                const force = distance * 0.01;
                
                source.vx += (dx / distance) * force;
                source.vy += (dy / distance) * force;
                target.vx -= (dx / distance) * force;
                target.vy -= (dy / distance) * force;
            }
        });

        // Center attraction
        nodes.forEach(node => {
            const dx = centerX - node.x;
            const dy = centerY - node.y;
            node.vx += dx * 0.001;
            node.vy += dy * 0.001;
        });

        // Apply forces
        nodes.forEach(node => {
            node.x += node.vx * alpha;
            node.y += node.vy * alpha;
            
            // Keep nodes within bounds
            node.x = Math.max(20, Math.min(width - 20, node.x));
            node.y = Math.max(20, Math.min(height - 20, node.y));
        });
    }

    /**
     * Apply network type-specific styling
     */
    applyNetworkTypeStyles(networkData, networkType, options) {
        switch (networkType) {
            case 'protein-interaction':
                this.applyProteinNetworkStyles(networkData, options);
                break;
            case 'gene-regulatory':
                this.applyGeneNetworkStyles(networkData, options);
                break;
            default:
                this.applyGenericNetworkStyles(networkData, options);
        }
    }

    /**
     * Apply protein interaction network styles
     */
    applyProteinNetworkStyles(networkData, options) {
        // Ensure nodes have appropriate colors and sizes
        networkData.nodes.forEach(node => {
            if (!node.color) {
                node.color = this.getProteinColor(node);
            }
            if (!node.size) {
                node.size = 8 + (node.properties?.expression || 0.5) * 12;
            }
        });

        // Ensure edges have appropriate colors
        networkData.edges.forEach(edge => {
            if (!edge.color) {
                edge.color = this.getInteractionColor(edge.properties?.confidence || edge.weight || 0.5);
            }
        });

        options.nodeRadius = 10;
        options.linkDistance = 80;
        options.charge = -400;
    }

    /**
     * Apply gene regulatory network styles
     */
    applyGeneNetworkStyles(networkData, options) {
        // Ensure nodes have appropriate colors and sizes
        networkData.nodes.forEach(node => {
            if (!node.color) {
                node.color = this.getGeneColor(node);
            }
            if (!node.size) {
                node.size = 10 + (node.properties?.expression || 0.5) * 10;
            }
        });

        // Ensure edges have appropriate colors based on regulation type
        networkData.edges.forEach(edge => {
            if (!edge.color) {
                edge.color = edge.type === 'activation' ? '#2ecc71' : '#e74c3c';
            }
        });

        options.nodeRadius = 12;
        options.linkDistance = 120;
        options.charge = -500;
    }

    /**
     * Apply generic network styles
     */
    applyGenericNetworkStyles(networkData, options) {
        networkData.nodes.forEach(node => {
            if (!node.color) {
                node.color = '#4ECDC4';
            }
            if (!node.size) {
                node.size = options.nodeRadius;
            }
        });

        networkData.edges.forEach(edge => {
            if (!edge.color) {
                edge.color = '#999';
            }
        });
    }

    /**
     * Color functions
     */
    getProteinColor(node) {
        const functionColors = {
            'DNA replication': '#3498db',
            'DNA binding': '#2ecc71',
            'DNA unwinding': '#f39c12',
            'RNA primer synthesis': '#e74c3c',
            'DNA synthesis': '#9b59b6',
            'Unknown': '#95a5a6'
        };
        return functionColors[node.properties?.function] || '#95a5a6';
    }

    getGeneColor(node) {
        const typeColors = {
            'transcription_factor': '#e74c3c',
            'gene': '#3498db',
            'regulator': '#f39c12',
            'dual_regulator': '#9b59b6'
        };
        return typeColors[node.type] || '#95a5a6';
    }

    getInteractionColor(confidence) {
        if (confidence >= 0.8) return '#2ecc71'; // High confidence - green
        if (confidence >= 0.6) return '#f39c12'; // Medium confidence - orange
        return '#e74c3c'; // Low confidence - red
    }

    /**
     * Check if network is directed
     */
    isDirectedNetwork(networkData) {
        return networkData.networkType === 'gene-regulatory' || 
               networkData.metadata?.networkType === 'gene-regulatory';
    }

    /**
     * Add arrow markers for directed networks
     */
    addArrowMarkers(svg) {
        svg.append('defs').append('marker')
            .attr('id', 'arrowhead')
            .attr('viewBox', '-0 -5 10 10')
            .attr('refX', 13)
            .attr('refY', 0)
            .attr('orient', 'auto')
            .attr('markerWidth', 13)
            .attr('markerHeight', 13)
            .attr('xoverflow', 'visible')
            .append('svg:path')
            .attr('d', 'M 0,-5 L 10 ,0 L 0,5')
            .attr('fill', '#999')
            .style('stroke', 'none');
    }

    /**
     * Add tooltips to nodes
     */
    addTooltips(nodes, networkData) {
        nodes.append('title')
            .text(d => {
                let tooltip = `${d.name || d.id}`;
                if (d.properties) {
                    Object.entries(d.properties).forEach(([key, value]) => {
                        if (typeof value !== 'object') {
                            tooltip += `\n${key}: ${value}`;
                        }
                    });
                }
                return tooltip;
            });
    }

    /**
     * Show node details (fallback for SVG)
     */
    showNodeDetails(node) {
        let details = `Node: ${node.name || node.id}\n`;
        details += `Type: ${node.type || 'Unknown'}\n`;
        
        if (node.properties) {
            Object.entries(node.properties).forEach(([key, value]) => {
                if (typeof value !== 'object') {
                    details += `${key}: ${value}\n`;
                }
            });
        }
        
        alert(details);
    }

    /**
     * Add network-specific controls and panels
     */
    addNetworkControls(container, networkData, networkType, options) {
        // Create controls container
        const controlsDiv = document.createElement('div');
        controlsDiv.className = 'network-controls';
        controlsDiv.style.marginTop = '10px';
        controlsDiv.style.padding = '10px';
        controlsDiv.style.border = '1px solid #ddd';
        controlsDiv.style.borderRadius = '4px';
        controlsDiv.style.backgroundColor = '#f8f9fa';

        // Add network statistics
        this.addNetworkStatistics(controlsDiv, networkData);

        // Add network-specific panels
        switch (networkType) {
            case 'protein-interaction':
                this.addProteinNetworkPanel(controlsDiv, networkData);
                break;
            case 'gene-regulatory':
                this.addGeneNetworkPanel(controlsDiv, networkData);
                break;
        }

        container.appendChild(controlsDiv);
    }

    /**
     * Add network statistics panel
     */
    addNetworkStatistics(container, networkData) {
        const statsDiv = document.createElement('div');
        statsDiv.innerHTML = `
            <h4>Network Statistics</h4>
            <table style="width: 100%; border-collapse: collapse;">
                <tr><td style="padding: 2px; border: 1px solid #ddd;">Nodes:</td><td style="padding: 2px; border: 1px solid #ddd;">${networkData.nodes.length}</td></tr>
                <tr><td style="padding: 2px; border: 1px solid #ddd;">Edges:</td><td style="padding: 2px; border: 1px solid #ddd;">${networkData.edges.length}</td></tr>
                <tr><td style="padding: 2px; border: 1px solid #ddd;">Density:</td><td style="padding: 2px; border: 1px solid #ddd;">${networkData.statistics?.density || 'N/A'}</td></tr>
                <tr><td style="padding: 2px; border: 1px solid #ddd;">Avg Degree:</td><td style="padding: 2px; border: 1px solid #ddd;">${networkData.statistics?.averageDegree || 'N/A'}</td></tr>
            </table>
        `;
        container.appendChild(statsDiv);
    }

    /**
     * Add protein network-specific panel
     */
    addProteinNetworkPanel(container, networkData) {
        if (networkData.complexes && networkData.complexes.length > 0) {
            const complexDiv = document.createElement('div');
            complexDiv.innerHTML = `
                <h4>Protein Complexes (${networkData.complexes.length})</h4>
                <ul>
                    ${networkData.complexes.map(complex => 
                        `<li>${complex.id}: ${complex.members.join(', ')} (confidence: ${complex.confidence?.toFixed(2) || 'N/A'})</li>`
                    ).join('')}
                </ul>
            `;
            container.appendChild(complexDiv);
        }
    }

    /**
     * Add gene network-specific panel
     */
    addGeneNetworkPanel(container, networkData) {
        if (networkData.modules && networkData.modules.length > 0) {
            const moduleDiv = document.createElement('div');
            moduleDiv.innerHTML = `
                <h4>Regulatory Modules (${networkData.modules.length})</h4>
                <ul>
                    ${networkData.modules.map(module => 
                        `<li>${module.id}: ${module.regulatorName} → ${module.targets.length} targets (${module.type})</li>`
                    ).join('')}
                </ul>
            `;
            container.appendChild(moduleDiv);
        }
    }

    /**
     * Generate test network data
     */
    generateTestNetworkData() {
        return {
            networkType: 'generic',
            nodes: [
                { id: 'N1', name: 'Node 1', type: 'type1', size: 10, color: '#3498db' },
                { id: 'N2', name: 'Node 2', type: 'type1', size: 12, color: '#2ecc71' },
                { id: 'N3', name: 'Node 3', type: 'type2', size: 8, color: '#e74c3c' },
                { id: 'N4', name: 'Node 4', type: 'type2', size: 14, color: '#f39c12' }
            ],
            edges: [
                { id: 'E1', source: 'N1', target: 'N2', weight: 0.8, color: '#999' },
                { id: 'E2', source: 'N2', target: 'N3', weight: 0.6, color: '#999' },
                { id: 'E3', source: 'N3', target: 'N4', weight: 0.9, color: '#999' },
                { id: 'E4', source: 'N1', target: 'N4', weight: 0.4, color: '#999' }
            ],
            metadata: {
                networkType: 'generic',
                generatedAt: new Date().toISOString()
            }
        };
    }

    /**
     * Get plugin metadata
     */
    getMetadata() {
        return {
            name: 'Network Graph Plugin',
            version: '1.0.0',
            description: 'Universal network graph visualization plugin',
            author: 'Genome AI Studio Team',
            functions: [
                'renderNetworkGraph'
            ],
            supportedNetworkTypes: [
                'protein-interaction',
                'gene-regulatory',
                'generic'
            ],
            requiresD3: false, // Has fallback implementation
            testDataAvailable: true,
            chatBoxCompatible: true
        };
    }
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = NetworkGraphPlugin;
} else if (typeof window !== 'undefined') {
    window.NetworkGraphPlugin = NetworkGraphPlugin;
} 