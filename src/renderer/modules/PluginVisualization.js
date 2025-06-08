/**
 * PluginVisualization - Visualization drawing functions for plugin system
 * Contains implementations for various genomic data visualizations
 */

const PluginVisualization = {
    
    // ===== PHYLOGENETIC TREE VISUALIZATION =====
    
    drawPhylogeneticTree(svg, data, options = {}) {
        try {
            // Clear existing content
            svg.innerHTML = '';
            
            // Get dimensions
            const rect = svg.getBoundingClientRect();
            const width = rect.width || 400;
            const height = rect.height || 300;
            
            // Create group for tree
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('transform', 'translate(20, 20)');
            
            // Draw tree structure
            if (data.tree && data.tree.children) {
                this.drawTreeNode(g, data.tree, width - 40, height - 40, 0, 0);
            } else if (data.sequences) {
                // Simple layout for sequences
                this.drawSimpleTree(g, data.sequences, width - 40, height - 40);
            }
            
            // Add title
            const title = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            title.setAttribute('x', '10');
            title.setAttribute('y', '15');
            title.setAttribute('font-family', 'Arial, sans-serif');
            title.setAttribute('font-size', '14');
            title.setAttribute('font-weight', 'bold');
            title.setAttribute('fill', '#333');
            title.textContent = options.title || 'Phylogenetic Tree';
            
            svg.appendChild(title);
            svg.appendChild(g);
            
        } catch (error) {
            console.error('Error drawing phylogenetic tree:', error);
            this.drawErrorMessage(svg, 'Error rendering phylogenetic tree');
        }
    },

    drawTreeNode(container, node, width, height, x, y) {
        if (!node.children || node.children.length === 0) {
            // Leaf node
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', x + 5);
            text.setAttribute('y', y + 5);
            text.setAttribute('font-family', 'Arial, sans-serif');
            text.setAttribute('font-size', '12');
            text.setAttribute('fill', '#333');
            text.textContent = node.name || 'Unnamed';
            container.appendChild(text);
            return;
        }
        
        // Internal node - draw children
        const childHeight = height / node.children.length;
        node.children.forEach((child, i) => {
            const childY = y + i * childHeight;
            
            // Draw line to child
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', x);
            line.setAttribute('y1', y);
            line.setAttribute('x2', x + 50);
            line.setAttribute('y2', childY);
            line.setAttribute('stroke', '#666');
            line.setAttribute('stroke-width', '1');
            container.appendChild(line);
            
            // Draw child node
            this.drawTreeNode(container, child, width - 50, childHeight, x + 50, childY);
        });
    },

    drawSimpleTree(container, sequences, width, height) {
        const yStep = height / sequences.length;
        
        sequences.forEach((seq, i) => {
            const y = i * yStep;
            
            // Draw line
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', '0');
            line.setAttribute('y1', y);
            line.setAttribute('x2', '50');
            line.setAttribute('y2', y);
            line.setAttribute('stroke', '#666');
            line.setAttribute('stroke-width', '2');
            container.appendChild(line);
            
            // Draw label
            const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            text.setAttribute('x', '55');
            text.setAttribute('y', y + 5);
            text.setAttribute('font-family', 'Arial, sans-serif');
            text.setAttribute('font-size', '12');
            text.setAttribute('fill', '#333');
            text.textContent = seq.name || seq.id || `Sequence ${i + 1}`;
            container.appendChild(text);
        });
    },

    // ===== SEQUENCE ALIGNMENT VISUALIZATION =====
    
    drawSequenceAlignment(container, data, options = {}) {
        try {
            container.innerHTML = '';
            
            // Create header
            const header = document.createElement('div');
            header.style.fontWeight = 'bold';
            header.style.padding = '10px';
            header.style.borderBottom = '1px solid #ddd';
            header.style.backgroundColor = '#f5f5f5';
            header.textContent = options.title || 'Sequence Alignment';
            container.appendChild(header);
            
            // Create scrollable content area
            const content = document.createElement('div');
            content.style.padding = '10px';
            content.style.overflow = 'auto';
            content.style.maxHeight = 'calc(100% - 50px)';
            
            // Process alignment data
            let sequences = [];
            if (data.alignment) {
                sequences = data.alignment;
            } else if (data.sequences) {
                sequences = data.sequences.map(seq => ({
                    id: seq.id || seq.name,
                    sequence: seq.sequence
                }));
            }
            
            // Draw alignment
            if (sequences.length > 0) {
                this.drawAlignmentGrid(content, sequences, options);
            } else {
                content.textContent = 'No alignment data available';
            }
            
            container.appendChild(content);
            
        } catch (error) {
            console.error('Error drawing sequence alignment:', error);
            container.innerHTML = '<div style="padding: 20px; color: red;">Error rendering sequence alignment</div>';
        }
    },

    drawAlignmentGrid(container, sequences, options = {}) {
        const maxLength = Math.max(...sequences.map(seq => seq.sequence.length));
        const blockSize = options.blockSize || 50;
        const charWidth = 8;
        const lineHeight = 20;
        
        // Create alignment blocks
        for (let start = 0; start < maxLength; start += blockSize) {
            const blockDiv = document.createElement('div');
            blockDiv.style.marginBottom = '20px';
            
            // Position ruler
            const ruler = document.createElement('div');
            ruler.style.fontFamily = 'monospace';
            ruler.style.fontSize = '10px';
            ruler.style.color = '#666';
            ruler.style.marginBottom = '5px';
            ruler.style.paddingLeft = '120px';
            
            let rulerText = '';
            for (let i = start; i < Math.min(start + blockSize, maxLength); i += 10) {
                rulerText += (i + 1).toString().padStart(10, ' ');
            }
            ruler.textContent = rulerText;
            blockDiv.appendChild(ruler);
            
            // Sequence rows
            sequences.forEach(seq => {
                const seqDiv = document.createElement('div');
                seqDiv.style.fontFamily = 'monospace';
                seqDiv.style.fontSize = '12px';
                seqDiv.style.marginBottom = '2px';
                seqDiv.style.display = 'flex';
                
                // Sequence ID
                const idSpan = document.createElement('span');
                idSpan.style.width = '110px';
                idSpan.style.paddingRight = '10px';
                idSpan.style.fontWeight = 'bold';
                idSpan.style.textAlign = 'right';
                idSpan.textContent = seq.id || 'Unknown';
                seqDiv.appendChild(idSpan);
                
                // Sequence segment
                const seqSpan = document.createElement('span');
                const segment = seq.sequence.slice(start, start + blockSize);
                
                // Color-code bases
                let coloredSegment = '';
                for (let i = 0; i < segment.length; i++) {
                    const base = segment[i].toUpperCase();
                    const color = this.getBaseColor(base);
                    coloredSegment += `<span style="color: ${color}">${base}</span>`;
                }
                seqSpan.innerHTML = coloredSegment;
                seqDiv.appendChild(seqSpan);
                
                blockDiv.appendChild(seqDiv);
            });
            
            container.appendChild(blockDiv);
        }
    },

    getBaseColor(base) {
        const colors = {
            'A': '#FF6B6B',
            'T': '#4ECDC4',
            'G': '#45B7D1',
            'C': '#96CEB4',
            'N': '#999999',
            '-': '#CCCCCC'
        };
        return colors[base] || '#000000';
    },

    // ===== GC CONTENT PLOT =====
    
    drawGCContentPlot(ctx, data, options = {}) {
        try {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            
            if (!data.results || data.results.length === 0) {
                this.drawNoDataMessage(ctx, 'No GC content data available');
                return;
            }
            
            const width = ctx.canvas.width - 80;
            const height = ctx.canvas.height - 80;
            const margin = 40;
            
            // Draw axes
            this.drawAxes(ctx, margin, width, height, 'Position', 'GC Content (%)');
            
            // Prepare data
            const results = data.results;
            const maxGC = Math.max(...results.map(r => r.gcContent));
            const minGC = Math.min(...results.map(r => r.gcContent));
            const gcRange = maxGC - minGC || 1;
            
            const xStep = width / (results.length - 1 || 1);
            
            // Draw GC content line
            ctx.strokeStyle = options.lineColor || '#0066cc';
            ctx.lineWidth = 2;
            ctx.beginPath();
            
            results.forEach((result, i) => {
                const x = margin + i * xStep;
                const y = height + margin - ((result.gcContent - minGC) / gcRange) * height;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            });
            
            ctx.stroke();
            
            // Draw average line
            if (data.averageGC) {
                const avgY = height + margin - ((data.averageGC - minGC) / gcRange) * height;
                ctx.strokeStyle = '#ff6b6b';
                ctx.lineWidth = 1;
                ctx.setLineDash([5, 5]);
                ctx.beginPath();
                ctx.moveTo(margin, avgY);
                ctx.lineTo(margin + width, avgY);
                ctx.stroke();
                ctx.setLineDash([]);
                
                // Average label
                ctx.fillStyle = '#ff6b6b';
                ctx.font = '12px Arial';
                ctx.fillText(`Avg: ${data.averageGC.toFixed(1)}%`, margin + 10, avgY - 5);
            }
            
            // Draw title
            ctx.fillStyle = '#333';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(options.title || 'GC Content Distribution', ctx.canvas.width / 2, 25);
            
        } catch (error) {
            console.error('Error drawing GC content plot:', error);
            this.drawErrorMessage(ctx, 'Error rendering GC content plot');
        }
    },

    // ===== HEATMAP VISUALIZATION =====
    
    drawHeatmap(ctx, data, options = {}) {
        try {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            
            if (!data.matrix) {
                this.drawNoDataMessage(ctx, 'No matrix data available for heatmap');
                return;
            }
            
            const margin = 60;
            const width = ctx.canvas.width - 2 * margin;
            const height = ctx.canvas.height - 2 * margin;
            
            const matrix = data.matrix;
            const rows = matrix.length;
            const cols = matrix[0] ? matrix[0].length : 0;
            
            if (rows === 0 || cols === 0) {
                this.drawNoDataMessage(ctx, 'Empty matrix data');
                return;
            }
            
            const cellWidth = width / cols;
            const cellHeight = height / rows;
            
            // Find min and max values for color scaling
            let minVal = Infinity;
            let maxVal = -Infinity;
            
            for (let i = 0; i < rows; i++) {
                for (let j = 0; j < cols; j++) {
                    minVal = Math.min(minVal, matrix[i][j]);
                    maxVal = Math.max(maxVal, matrix[i][j]);
                }
            }
            
            // Draw heatmap cells
            for (let i = 0; i < rows; i++) {
                for (let j = 0; j < cols; j++) {
                    const value = matrix[i][j];
                    const intensity = (value - minVal) / (maxVal - minVal);
                    
                    const x = margin + j * cellWidth;
                    const y = margin + i * cellHeight;
                    
                    // Color from blue (low) to red (high)
                    const color = this.valueToColor(intensity, options.colorScheme);
                    
                    ctx.fillStyle = color;
                    ctx.fillRect(x, y, cellWidth, cellHeight);
                    
                    // Draw border
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 0.5;
                    ctx.strokeRect(x, y, cellWidth, cellHeight);
                }
            }
            
            // Draw labels if provided
            if (data.rowLabels) {
                ctx.fillStyle = '#333';
                ctx.font = '10px Arial';
                ctx.textAlign = 'right';
                data.rowLabels.forEach((label, i) => {
                    const y = margin + i * cellHeight + cellHeight / 2;
                    ctx.fillText(label, margin - 5, y);
                });
            }
            
            if (data.colLabels) {
                ctx.fillStyle = '#333';
                ctx.font = '10px Arial';
                ctx.textAlign = 'center';
                ctx.save();
                data.colLabels.forEach((label, j) => {
                    const x = margin + j * cellWidth + cellWidth / 2;
                    ctx.translate(x, margin - 5);
                    ctx.rotate(-Math.PI / 2);
                    ctx.fillText(label, 0, 0);
                    ctx.restore();
                    ctx.save();
                });
                ctx.restore();
            }
            
            // Draw color scale
            this.drawColorScale(ctx, minVal, maxVal, options);
            
        } catch (error) {
            console.error('Error drawing heatmap:', error);
            this.drawErrorMessage(ctx, 'Error rendering heatmap');
        }
    },

    valueToColor(intensity, colorScheme = 'blue-red') {
        switch (colorScheme) {
            case 'blue-red':
                const r = Math.round(intensity * 255);
                const b = Math.round((1 - intensity) * 255);
                return `rgb(${r}, 0, ${b})`;
            case 'green-red':
                const red = Math.round(intensity * 255);
                const green = Math.round((1 - intensity) * 255);
                return `rgb(${red}, ${green}, 0)`;
            default:
                const gray = Math.round(intensity * 255);
                return `rgb(${gray}, ${gray}, ${gray})`;
        }
    },

    drawColorScale(ctx, minVal, maxVal, options) {
        const scaleX = ctx.canvas.width - 50;
        const scaleY = 50;
        const scaleWidth = 20;
        const scaleHeight = 100;
        
        // Draw scale gradient
        for (let i = 0; i < scaleHeight; i++) {
            const intensity = i / scaleHeight;
            const color = this.valueToColor(intensity, options.colorScheme);
            
            ctx.fillStyle = color;
            ctx.fillRect(scaleX, scaleY + scaleHeight - i, scaleWidth, 1);
        }
        
        // Draw scale border
        ctx.strokeStyle = '#333';
        ctx.strokeRect(scaleX, scaleY, scaleWidth, scaleHeight);
        
        // Draw scale labels
        ctx.fillStyle = '#333';
        ctx.font = '10px Arial';
        ctx.textAlign = 'left';
        ctx.fillText(maxVal.toFixed(2), scaleX + scaleWidth + 5, scaleY + 5);
        ctx.fillText(minVal.toFixed(2), scaleX + scaleWidth + 5, scaleY + scaleHeight + 5);
    },

    // ===== NETWORK GRAPH VISUALIZATION =====
    
    drawNetworkGraph(svg, data, options = {}) {
        try {
            svg.innerHTML = '';
            
            if (!data.nodes || !data.edges) {
                this.drawSVGErrorMessage(svg, 'No network data available');
                return;
            }
            
            const width = svg.getBoundingClientRect().width || 400;
            const height = svg.getBoundingClientRect().height || 300;
            
            // Simple force-directed layout
            const nodes = data.nodes.map((node, i) => ({
                ...node,
                x: Math.random() * (width - 100) + 50,
                y: Math.random() * (height - 100) + 50,
                vx: 0,
                vy: 0
            }));
            
            // Draw edges
            const edgeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            data.edges.forEach(edge => {
                const sourceNode = nodes.find(n => n.id === edge.source);
                const targetNode = nodes.find(n => n.id === edge.target);
                
                if (sourceNode && targetNode) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', sourceNode.x);
                    line.setAttribute('y1', sourceNode.y);
                    line.setAttribute('x2', targetNode.x);
                    line.setAttribute('y2', targetNode.y);
                    line.setAttribute('stroke', edge.color || '#999');
                    line.setAttribute('stroke-width', edge.weight || 1);
                    edgeGroup.appendChild(line);
                }
            });
            
            svg.appendChild(edgeGroup);
            
            // Draw nodes
            const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            nodes.forEach(node => {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', node.x);
                circle.setAttribute('cy', node.y);
                circle.setAttribute('r', node.size || 8);
                circle.setAttribute('fill', node.color || '#4ECDC4');
                circle.setAttribute('stroke', '#fff');
                circle.setAttribute('stroke-width', '2');
                nodeGroup.appendChild(circle);
                
                // Node label
                if (node.label) {
                    const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                    text.setAttribute('x', node.x);
                    text.setAttribute('y', node.y + node.size + 15);
                    text.setAttribute('text-anchor', 'middle');
                    text.setAttribute('font-family', 'Arial, sans-serif');
                    text.setAttribute('font-size', '10');
                    text.setAttribute('fill', '#333');
                    text.textContent = node.label;
                    nodeGroup.appendChild(text);
                }
            });
            
            svg.appendChild(nodeGroup);
            
        } catch (error) {
            console.error('Error drawing network graph:', error);
            this.drawSVGErrorMessage(svg, 'Error rendering network graph');
        }
    },

    // ===== DOT PLOT VISUALIZATION =====
    
    drawDotPlot(ctx, data, options = {}) {
        try {
            ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
            
            if (!data.sequence1 || !data.sequence2) {
                this.drawNoDataMessage(ctx, 'Two sequences required for dot plot');
                return;
            }
            
            const margin = 60;
            const plotSize = Math.min(ctx.canvas.width, ctx.canvas.height) - 2 * margin;
            
            const seq1 = data.sequence1.toUpperCase();
            const seq2 = data.sequence2.toUpperCase();
            
            const windowSize = options.windowSize || 1;
            const threshold = options.threshold || 0.7;
            
            // Draw axes
            this.drawAxes(ctx, margin, plotSize, plotSize, 'Sequence 1', 'Sequence 2');
            
            // Calculate dot plot
            const dots = [];
            for (let i = 0; i < seq1.length - windowSize + 1; i += windowSize) {
                for (let j = 0; j < seq2.length - windowSize + 1; j += windowSize) {
                    const window1 = seq1.substr(i, windowSize);
                    const window2 = seq2.substr(j, windowSize);
                    
                    const similarity = this.calculateSimilarity(window1, window2);
                    if (similarity >= threshold) {
                        dots.push({
                            x: (i / seq1.length) * plotSize + margin,
                            y: margin + plotSize - (j / seq2.length) * plotSize,
                            similarity: similarity
                        });
                    }
                }
            }
            
            // Draw dots
            dots.forEach(dot => {
                const intensity = dot.similarity;
                const gray = Math.round((1 - intensity) * 255);
                ctx.fillStyle = `rgb(${gray}, ${gray}, ${gray})`;
                ctx.fillRect(dot.x, dot.y, 2, 2);
            });
            
            // Draw title
            ctx.fillStyle = '#333';
            ctx.font = 'bold 16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(options.title || 'Dot Plot Comparison', ctx.canvas.width / 2, 25);
            
        } catch (error) {
            console.error('Error drawing dot plot:', error);
            this.drawErrorMessage(ctx, 'Error rendering dot plot');
        }
    },

    // ===== UTILITY DRAWING FUNCTIONS =====
    
    drawAxes(ctx, margin, width, height, xLabel, yLabel) {
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        
        // X axis
        ctx.beginPath();
        ctx.moveTo(margin, margin + height);
        ctx.lineTo(margin + width, margin + height);
        ctx.stroke();
        
        // Y axis
        ctx.beginPath();
        ctx.moveTo(margin, margin);
        ctx.lineTo(margin, margin + height);
        ctx.stroke();
        
        // Labels
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        
        // X label
        ctx.fillText(xLabel, margin + width / 2, margin + height + 35);
        
        // Y label
        ctx.save();
        ctx.translate(15, margin + height / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.fillText(yLabel, 0, 0);
        ctx.restore();
    },

    drawNoDataMessage(ctx, message) {
        ctx.fillStyle = '#666';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(message, ctx.canvas.width / 2, ctx.canvas.height / 2);
    },

    drawErrorMessage(ctx, message) {
        ctx.fillStyle = '#cc0000';
        ctx.font = '16px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(message, ctx.canvas.width / 2, ctx.canvas.height / 2);
    },

    drawSVGErrorMessage(svg, message) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '50%');
        text.setAttribute('y', '50%');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('font-family', 'Arial, sans-serif');
        text.setAttribute('font-size', '16');
        text.setAttribute('fill', '#cc0000');
        text.textContent = message;
        svg.appendChild(text);
    },
    
    // Helper method for similarity calculation
    calculateSimilarity(seq1, seq2) {
        const minLen = Math.min(seq1.length, seq2.length);
        let matches = 0;
        for (let i = 0; i < minLen; i++) {
            if (seq1[i] === seq2[i]) {
                matches++;
            }
        }
        return matches / minLen;
    }
};

// Export if in module environment
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PluginVisualization;
} 