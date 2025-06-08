/**
 * BiologicalNetworkViz - Visualization components for biological networks
 * Provides interactive network visualizations with D3.js
 */
const BiologicalNetworkViz = {
    
    /**
     * Render protein-protein interaction network
     */
    async renderPPINetwork(data, container, options = {}) {
        console.log('Rendering PPI network:', data);
        
        try {
            const {
                width = 800,
                height = 600,
                nodeRadius = 8,
                linkDistance = 100,
                charge = -300,
                showLabels = true,
                colorScheme = 'function'
            } = options;

            // Clear container
            d3.select(container).selectAll('*').remove();

            // Create SVG
            const svg = d3.select(container)
                .append('svg')
                .attr('width', width)
                .attr('height', height)
                .style('border', '1px solid #ccc');

            // Create force simulation
            const simulation = d3.forceSimulation(data.nodes)
                .force('link', d3.forceLink(data.edges).id(d => d.id).distance(linkDistance))
                .force('charge', d3.forceManyBody().strength(charge))
                .force('center', d3.forceCenter(width / 2, height / 2))
                .force('collision', d3.forceCollide().radius(nodeRadius + 2));

            // Create links
            const links = svg.append('g')
                .attr('class', 'links')
                .selectAll('line')
                .data(data.edges)
                .enter().append('line')
                .attr('stroke', '#999')
                .attr('stroke-opacity', 0.6)
                .attr('stroke-width', d => Math.sqrt(d.confidence * 5));

            // Create nodes
            const nodes = svg.append('g')
                .attr('class', 'nodes')
                .selectAll('circle')
                .data(data.nodes)
                .enter().append('circle')
                .attr('r', nodeRadius)
                .attr('fill', d => this.getNodeColor(d, colorScheme))
                .attr('stroke', '#fff')
                .attr('stroke-width', 1.5)
                .call(d3.drag()
                    .on('start', dragstarted)
                    .on('drag', dragged)
                    .on('end', dragended));

            // Add labels if requested
            if (showLabels) {
                const labels = svg.append('g')
                    .attr('class', 'labels')
                    .selectAll('text')
                    .data(data.nodes)
                    .enter().append('text')
                    .text(d => d.name)
                    .attr('font-size', '10px')
                    .attr('dx', nodeRadius + 2)
                    .attr('dy', 4);
            }

            // Add tooltips
            nodes.append('title')
                .text(d => `${d.name}\nFunction: ${d.properties.function}\nExpression: ${d.properties.expression.toFixed(2)}`);

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

                if (showLabels) {
                    svg.selectAll('.labels text')
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

            // Add legend
            this.addNetworkLegend(svg, width, height, colorScheme);

            // Add statistics panel
            this.addStatisticsPanel(container, data);

            console.log('PPI network rendered successfully');
            return { svg, simulation };

        } catch (error) {
            console.error('Error rendering PPI network:', error);
            throw error;
        }
    },

    /**
     * Render gene regulatory network
     */
    async renderGeneRegulatoryNetwork(data, container, options = {}) {
        console.log('Rendering gene regulatory network:', data);
        
        try {
            const {
                width = 800,
                height = 600,
                nodeRadius = 10,
                linkDistance = 120,
                charge = -400,
                showLabels = true,
                showModules = true
            } = options;

            // Clear container
            d3.select(container).selectAll('*').remove();

            // Create SVG
            const svg = d3.select(container)
                .append('svg')
                .attr('width', width)
                .attr('height', height)
                .style('border', '1px solid #ccc');

            // Create force simulation
            const simulation = d3.forceSimulation(data.nodes)
                .force('link', d3.forceLink(data.edges).id(d => d.id).distance(linkDistance))
                .force('charge', d3.forceManyBody().strength(charge))
                .force('center', d3.forceCenter(width / 2, height / 2))
                .force('collision', d3.forceCollide().radius(nodeRadius + 3));

            // Draw modules background if available
            if (showModules && data.modules) {
                this.drawRegulatoryModules(svg, data.modules, data.nodes);
            }

            // Create links with arrows for regulation direction
            const links = svg.append('g')
                .attr('class', 'links')
                .selectAll('line')
                .data(data.edges)
                .enter().append('line')
                .attr('stroke', d => d.type === 'activation' ? '#2ecc71' : '#e74c3c')
                .attr('stroke-opacity', 0.7)
                .attr('stroke-width', d => Math.sqrt(d.strength * 8))
                .attr('marker-end', 'url(#arrowhead)');

            // Add arrowhead marker
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

            // Create nodes
            const nodes = svg.append('g')
                .attr('class', 'nodes')
                .selectAll('circle')
                .data(data.nodes)
                .enter().append('circle')
                .attr('r', nodeRadius)
                .attr('fill', d => this.getGeneNodeColor(d))
                .attr('stroke', '#fff')
                .attr('stroke-width', 2)
                .call(d3.drag()
                    .on('start', dragstarted)
                    .on('drag', dragged)
                    .on('end', dragended));

            // Add labels
            if (showLabels) {
                const labels = svg.append('g')
                    .attr('class', 'labels')
                    .selectAll('text')
                    .data(data.nodes)
                    .enter().append('text')
                    .text(d => d.name)
                    .attr('font-size', '9px')
                    .attr('dx', nodeRadius + 3)
                    .attr('dy', 3);
            }

            // Add tooltips
            nodes.append('title')
                .text(d => `${d.name}\nType: ${d.type}\nChromosome: ${d.properties.chromosome}\nExpression: ${d.properties.expression.toFixed(2)}`);

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

                if (showLabels) {
                    svg.selectAll('.labels text')
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

            // Add legend
            this.addRegulatoryLegend(svg, width, height);

            // Add modules panel if available
            if (data.modules) {
                this.addModulesPanel(container, data.modules);
            }

            console.log('Gene regulatory network rendered successfully');
            return { svg, simulation };

        } catch (error) {
            console.error('Error rendering gene regulatory network:', error);
            throw error;
        }
    },

    /**
     * Render network centrality dashboard
     */
    async renderCentralityDashboard(data, container, options = {}) {
        console.log('Rendering centrality dashboard:', data);
        
        try {
            const { width = 900, height = 600 } = options;

            // Clear container
            d3.select(container).selectAll('*').remove();

            // Create main container
            const mainDiv = d3.select(container)
                .append('div')
                .style('width', width + 'px')
                .style('height', height + 'px')
                .style('display', 'flex')
                .style('flex-direction', 'column');

            // Add title
            mainDiv.append('h3')
                .text('Network Centrality Analysis Dashboard')
                .style('margin', '10px')
                .style('color', '#333');

            // Create layout
            const contentDiv = mainDiv.append('div')
                .style('display', 'flex')
                .style('flex', '1')
                .style('gap', '20px')
                .style('padding', '10px');

            // Left panel - Centrality measures
            const leftPanel = contentDiv.append('div')
                .style('flex', '2')
                .style('border', '1px solid #ddd')
                .style('border-radius', '5px')
                .style('padding', '15px');

            // Right panel - Hub analysis
            const rightPanel = contentDiv.append('div')
                .style('flex', '1')
                .style('border', '1px solid #ddd')
                .style('border-radius', '5px')
                .style('padding', '15px');

            // Render centrality measures
            this.renderCentralityMeasures(leftPanel, data.centrality);

            // Render hub analysis
            this.renderHubAnalysis(rightPanel, data.hubs);

            // Add correlations section
            if (data.correlations) {
                this.renderCentralityCorrelations(leftPanel, data.correlations);
            }

            // Add statistics summary
            this.renderCentralityStatistics(rightPanel, data.statistics);

            console.log('Centrality dashboard rendered successfully');
            return { container: mainDiv };

        } catch (error) {
            console.error('Error rendering centrality dashboard:', error);
            throw error;
        }
    },

    /**
     * Helper method to get node color based on scheme
     */
    getNodeColor(node, colorScheme) {
        const colors = {
            function: {
                'Unknown': '#95a5a6',
                'Enzyme': '#e74c3c',
                'Transcription factor': '#3498db',
                'Structural': '#2ecc71',
                'Transport': '#f39c12'
            },
            expression: d3.scaleSequential(d3.interpolateViridis).domain([0, 1]),
            type: {
                'protein': '#3498db',
                'gene': '#2ecc71',
                'complex': '#e74c3c'
            }
        };

        switch (colorScheme) {
            case 'function':
                return colors.function[node.properties.function] || colors.function['Unknown'];
            case 'expression':
                return colors.expression(node.properties.expression || 0);
            case 'type':
                return colors.type[node.type] || '#95a5a6';
            default:
                return '#3498db';
        }
    },

    /**
     * Helper method to get gene node color
     */
    getGeneNodeColor(node) {
        const colors = {
            'transcription_factor': '#e74c3c',
            'gene': '#3498db',
            'regulator': '#f39c12'
        };
        return colors[node.type] || '#95a5a6';
    },

    /**
     * Add network legend
     */
    addNetworkLegend(svg, width, height, colorScheme) {
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width - 150}, 20)`);

        legend.append('rect')
            .attr('width', 140)
            .attr('height', 100)
            .attr('fill', 'white')
            .attr('stroke', '#ccc')
            .attr('rx', 5);

        legend.append('text')
            .attr('x', 10)
            .attr('y', 15)
            .text('Legend')
            .attr('font-weight', 'bold')
            .attr('font-size', '12px');

        // Add legend items based on color scheme
        const legendItems = [
            { color: '#e74c3c', label: 'High confidence' },
            { color: '#f39c12', label: 'Medium confidence' },
            { color: '#95a5a6', label: 'Low confidence' }
        ];

        legendItems.forEach((item, i) => {
            const y = 35 + i * 20;
            legend.append('circle')
                .attr('cx', 15)
                .attr('cy', y)
                .attr('r', 5)
                .attr('fill', item.color);

            legend.append('text')
                .attr('x', 25)
                .attr('y', y + 4)
                .text(item.label)
                .attr('font-size', '10px');
        });
    },

    /**
     * Add regulatory network legend
     */
    addRegulatoryLegend(svg, width, height) {
        const legend = svg.append('g')
            .attr('class', 'legend')
            .attr('transform', `translate(${width - 150}, 20)`);

        legend.append('rect')
            .attr('width', 140)
            .attr('height', 80)
            .attr('fill', 'white')
            .attr('stroke', '#ccc')
            .attr('rx', 5);

        legend.append('text')
            .attr('x', 10)
            .attr('y', 15)
            .text('Regulation')
            .attr('font-weight', 'bold')
            .attr('font-size', '12px');

        // Activation
        legend.append('line')
            .attr('x1', 10)
            .attr('y1', 30)
            .attr('x2', 40)
            .attr('y2', 30)
            .attr('stroke', '#2ecc71')
            .attr('stroke-width', 3);

        legend.append('text')
            .attr('x', 45)
            .attr('y', 34)
            .text('Activation')
            .attr('font-size', '10px');

        // Repression
        legend.append('line')
            .attr('x1', 10)
            .attr('y1', 50)
            .attr('x2', 40)
            .attr('y2', 50)
            .attr('stroke', '#e74c3c')
            .attr('stroke-width', 3);

        legend.append('text')
            .attr('x', 45)
            .attr('y', 54)
            .text('Repression')
            .attr('font-size', '10px');
    },

    /**
     * Add statistics panel
     */
    addStatisticsPanel(container, data) {
        const statsDiv = d3.select(container)
            .append('div')
            .style('margin-top', '20px')
            .style('padding', '15px')
            .style('border', '1px solid #ddd')
            .style('border-radius', '5px')
            .style('background', '#f8f9fa');

        statsDiv.append('h4')
            .text('Network Statistics')
            .style('margin-top', '0');

        const stats = data.statistics || data.metadata;
        const statsTable = statsDiv.append('table')
            .style('width', '100%')
            .style('border-collapse', 'collapse');

        const statsData = [
            ['Nodes', stats.nodeCount],
            ['Edges', stats.edgeCount],
            ['Density', stats.density ? stats.density.toFixed(3) : 'N/A'],
            ['Average Degree', stats.averageDegree ? stats.averageDegree.toFixed(2) : 'N/A']
        ];

        if (data.complexes) {
            statsData.push(['Complexes', data.complexes.length]);
        }

        if (data.modules) {
            statsData.push(['Modules', data.modules.length]);
        }

        const rows = statsTable.selectAll('tr')
            .data(statsData)
            .enter().append('tr');

        rows.selectAll('td')
            .data(d => d)
            .enter().append('td')
            .text(d => d)
            .style('padding', '5px')
            .style('border', '1px solid #ddd');
    },

    /**
     * Draw regulatory modules background
     */
    drawRegulatoryModules(svg, modules, nodes) {
        const moduleGroups = svg.append('g')
            .attr('class', 'modules')
            .selectAll('g')
            .data(modules)
            .enter().append('g')
            .attr('class', 'module');

        // Simple module visualization as colored backgrounds
        moduleGroups.each(function(module, i) {
            const moduleNodes = nodes.filter(node => 
                module.targets.includes(node.id) || node.id === module.regulator
            );

            if (moduleNodes.length > 0) {
                d3.select(this).append('circle')
                    .attr('r', 50)
                    .attr('fill', d3.schemeCategory10[i % 10])
                    .attr('opacity', 0.1)
                    .attr('stroke', d3.schemeCategory10[i % 10])
                    .attr('stroke-width', 2)
                    .attr('stroke-opacity', 0.3);
            }
        });
    },

    /**
     * Add modules panel
     */
    addModulesPanel(container, modules) {
        const modulesDiv = d3.select(container)
            .append('div')
            .style('margin-top', '20px')
            .style('padding', '15px')
            .style('border', '1px solid #ddd')
            .style('border-radius', '5px')
            .style('background', '#f8f9fa');

        modulesDiv.append('h4')
            .text('Regulatory Modules')
            .style('margin-top', '0');

        const modulesList = modulesDiv.append('ul')
            .style('list-style-type', 'none')
            .style('padding', '0');

        modules.forEach((module, i) => {
            const moduleItem = modulesList.append('li')
                .style('margin-bottom', '10px')
                .style('padding', '10px')
                .style('background', '#fff')
                .style('border', '1px solid #ddd')
                .style('border-radius', '3px');

            moduleItem.append('strong')
                .text(`Module ${i + 1}: `)
                .style('color', d3.schemeCategory10[i % 10]);

            moduleItem.append('span')
                .text(`${module.regulator} → ${module.targets.join(', ')}`);

            moduleItem.append('div')
                .style('font-size', '12px')
                .style('color', '#666')
                .text(`Size: ${module.size} genes`);
        });
    },

    /**
     * Render centrality measures
     */
    renderCentralityMeasures(container, centrality) {
        container.append('h4')
            .text('Centrality Measures')
            .style('margin-top', '0')
            .style('color', '#333');

        Object.keys(centrality).forEach(measure => {
            const measureDiv = container.append('div')
                .style('margin-bottom', '20px');

            measureDiv.append('h5')
                .text(measure.charAt(0).toUpperCase() + measure.slice(1) + ' Centrality')
                .style('color', '#555');

            // Create bar chart for top nodes
            const topNodes = Object.entries(centrality[measure])
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10);

            const chartDiv = measureDiv.append('div')
                .style('width', '100%')
                .style('height', '150px');

            this.createBarChart(chartDiv, topNodes, measure);
        });
    },

    /**
     * Create bar chart
     */
    createBarChart(container, data, measure) {
        const margin = { top: 10, right: 30, bottom: 40, left: 60 };
        const width = 400 - margin.left - margin.right;
        const height = 150 - margin.top - margin.bottom;

        const svg = container.append('svg')
            .attr('width', width + margin.left + margin.right)
            .attr('height', height + margin.top + margin.bottom);

        const g = svg.append('g')
            .attr('transform', `translate(${margin.left},${margin.top})`);

        const x = d3.scaleBand()
            .domain(data.map(d => d[0]))
            .range([0, width])
            .padding(0.1);

        const y = d3.scaleLinear()
            .domain([0, d3.max(data, d => d[1])])
            .range([height, 0]);

        g.selectAll('.bar')
            .data(data)
            .enter().append('rect')
            .attr('class', 'bar')
            .attr('x', d => x(d[0]))
            .attr('width', x.bandwidth())
            .attr('y', d => y(d[1]))
            .attr('height', d => height - y(d[1]))
            .attr('fill', '#3498db');

        g.append('g')
            .attr('transform', `translate(0,${height})`)
            .call(d3.axisBottom(x))
            .selectAll('text')
            .style('text-anchor', 'end')
            .attr('dx', '-.8em')
            .attr('dy', '.15em')
            .attr('transform', 'rotate(-45)');

        g.append('g')
            .call(d3.axisLeft(y));
    },

    /**
     * Render hub analysis
     */
    renderHubAnalysis(container, hubs) {
        container.append('h4')
            .text('Hub Nodes Analysis')
            .style('margin-top', '0')
            .style('color', '#333');

        if (!hubs || hubs.length === 0) {
            container.append('p')
                .text('No hub nodes identified')
                .style('color', '#666');
            return;
        }

        const hubsList = container.append('ul')
            .style('list-style-type', 'none')
            .style('padding', '0');

        hubs.slice(0, 10).forEach(hub => {
            const hubItem = hubsList.append('li')
                .style('margin-bottom', '10px')
                .style('padding', '10px')
                .style('background', '#f8f9fa')
                .style('border', '1px solid #ddd')
                .style('border-radius', '3px');

            hubItem.append('strong')
                .text(hub.id)
                .style('color', '#e74c3c');

            hubItem.append('div')
                .style('font-size', '12px')
                .style('color', '#666')
                .text(`Measures: ${hub.measures.join(', ')}`);

            // Show scores
            const scoresDiv = hubItem.append('div')
                .style('font-size', '11px')
                .style('color', '#888');

            Object.entries(hub.scores).forEach(([measure, score]) => {
                scoresDiv.append('span')
                    .text(`${measure}: ${score.toFixed(3)}`)
                    .style('margin-right', '10px');
            });
        });
    },

    /**
     * Render centrality correlations
     */
    renderCentralityCorrelations(container, correlations) {
        container.append('h4')
            .text('Centrality Correlations')
            .style('margin-top', '20px')
            .style('color', '#333');

        const corrTable = container.append('table')
            .style('width', '100%')
            .style('border-collapse', 'collapse')
            .style('margin-top', '10px');

        const corrData = Object.entries(correlations);

        const rows = corrTable.selectAll('tr')
            .data(corrData)
            .enter().append('tr');

        rows.selectAll('td')
            .data(d => [d[0], d[1].toFixed(3)])
            .enter().append('td')
            .text(d => d)
            .style('padding', '5px')
            .style('border', '1px solid #ddd')
            .style('background', (d, i) => i === 1 ? this.getCorrelationColor(+d) : '#fff');
    },

    /**
     * Get correlation color
     */
    getCorrelationColor(correlation) {
        const colorScale = d3.scaleSequential(d3.interpolateRdYlBu).domain([1, 0]);
        return colorScale(Math.abs(correlation));
    },

    /**
     * Render centrality statistics
     */
    renderCentralityStatistics(container, statistics) {
        container.append('h4')
            .text('Analysis Summary')
            .style('margin-top', '20px')
            .style('color', '#333');

        const statsData = [
            ['Total Nodes', statistics.nodeCount],
            ['Total Edges', statistics.edgeCount],
            ['Measures Calculated', statistics.measuresCalculated.join(', ')],
            ['Hub Nodes Found', statistics.hubCount]
        ];

        const statsTable = container.append('table')
            .style('width', '100%')
            .style('border-collapse', 'collapse')
            .style('margin-top', '10px');

        const rows = statsTable.selectAll('tr')
            .data(statsData)
            .enter().append('tr');

        rows.selectAll('td')
            .data(d => d)
            .enter().append('td')
            .text(d => d)
            .style('padding', '5px')
            .style('border', '1px solid #ddd');
    }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = BiologicalNetworkViz;
}