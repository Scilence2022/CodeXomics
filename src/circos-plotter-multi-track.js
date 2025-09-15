/**
 * Multi-Track Gene Distribution System for Circos Plotter
 * This module provides advanced gene track management with type-based distribution
 */

class MultiTrackGeneManager {
    constructor(circosPlotter) {
        this.circosPlotter = circosPlotter;
        this.geneTracks = {
            protein_coding: { enabled: true, track: 0, maxGenes: 2000, color: '#3b82f6', name: 'Protein Coding' },
            non_coding: { enabled: true, track: 1, maxGenes: 500, color: '#10b981', name: 'Non-Coding RNA' },
            tRNA: { enabled: true, track: 2, maxGenes: 200, color: '#f59e0b', name: 'tRNA' },
            rRNA: { enabled: true, track: 3, maxGenes: 100, color: '#8b5cf6', name: 'rRNA' },
            regulatory: { enabled: true, track: 4, maxGenes: 300, color: '#ef4444', name: 'Regulatory' },
            pseudogene: { enabled: true, track: 5, maxGenes: 200, color: '#6b7280', name: 'Pseudogene' },
            other: { enabled: false, track: 6, maxGenes: 100, color: '#9ca3af', name: 'Other' }
        };
        
        // CDS density tracks for high-density protein coding genes
        this.cdsDensityTracks = 3;
        this.cdsTrackHeight = 8;
        this.trackSpacing = 2;
        
        this.initializeUI();
    }
    
    initializeUI() {
        // Add multi-track controls to the UI
        this.addTrackControls();
        this.addTrackLegend();
    }
    
    addTrackControls() {
        const controlsContainer = document.getElementById('controls');
        if (!controlsContainer) return;
        
        // Create track controls section similar to GC Content controls
        const trackControlsDiv = document.createElement('div');
        trackControlsDiv.className = 'track-controls';
        trackControlsDiv.innerHTML = `
            <h4>Gene Track Controls</h4>
            <div class="track-checkboxes">
                ${Object.keys(this.geneTracks).map(type => `
                    <div class="checkbox-group">
                        <input type="checkbox" id="track-${type}" value="${type}" ${this.geneTracks[type].enabled ? 'checked' : ''}>
                        <label for="track-${type}">
                            <span class="track-color" style="background-color: ${this.geneTracks[type].color}"></span>
                            ${this.geneTracks[type].name}
                            <span class="gene-count" id="count-${type}">0</span>
                        </label>
                    </div>
                `).join('')}
            </div>
            
            <div class="track-settings">
                <label>
                    CDS Density Tracks: 
                    <input type="number" id="cds-density-tracks" value="${this.cdsDensityTracks}" min="1" max="5">
                </label>
                <button id="optimize-tracks">Optimize Distribution</button>
            </div>
        `;
        
        controlsContainer.appendChild(trackControlsDiv);
        
        // Add event listeners for gene type checkboxes
        Object.keys(this.geneTracks).forEach(type => {
            const checkbox = document.getElementById(`track-${type}`);
            if (checkbox) {
                checkbox.addEventListener('change', (e) => {
                    this.geneTracks[type].enabled = e.target.checked;
                    this.circosPlotter.redrawPlot();
                });
            }
        });
        
        const cdsDensityInput = document.getElementById('cds-density-tracks');
        if (cdsDensityInput) {
            cdsDensityInput.addEventListener('change', (e) => {
                this.cdsDensityTracks = parseInt(e.target.value) || 3;
                this.circosPlotter.redrawPlot();
            });
        }
        
        const optimizeBtn = document.getElementById('optimize-tracks');
        if (optimizeBtn) {
            optimizeBtn.addEventListener('click', () => {
                this.optimizeTrackDistribution();
            });
        }
    }
    
    
    addTrackLegend() {
        const legendContainer = document.getElementById('legend');
        if (!legendContainer) return;
        
        const trackLegendDiv = document.createElement('div');
        trackLegendDiv.className = 'track-legend';
        trackLegendDiv.innerHTML = `
            <h4>Gene Tracks</h4>
            <div class="track-legend-items">
                ${Object.keys(this.geneTracks).map(type => `
                    <div class="legend-item" data-track="${type}">
                        <span class="legend-color" style="background-color: ${this.geneTracks[type].color}"></span>
                        <span class="legend-label">${this.geneTracks[type].name}</span>
                        <span class="legend-count" id="legend-count-${type}">0</span>
                    </div>
                `).join('')}
            </div>
        `;
        
        legendContainer.appendChild(trackLegendDiv);
    }
    
    groupGenesByType(genes) {
        const groups = {};
        const typeCounts = {};
        
        genes.forEach(gene => {
            // Skip source features and other large features that obscure genes
            if (gene.type === 'source' || !gene.type) {
                return;
            }
            
            // Count original types for debugging
            typeCounts[gene.type] = (typeCounts[gene.type] || 0) + 1;
            
            // Map gene types to track categories
            let trackType = gene.type;
            if (gene.type === 'protein_coding' || gene.type === 'CDS' || gene.type === 'mRNA') {
                trackType = 'protein_coding';
            } else if (gene.type === 'tRNA') {
                trackType = 'tRNA';
            } else if (gene.type === 'rRNA') {
                trackType = 'rRNA';
            } else if (['regulatory', 'promoter', 'terminator'].includes(gene.type)) {
                trackType = 'regulatory';
            } else if (gene.type === 'pseudogene') {
                trackType = 'pseudogene';
            } else if (['gene', 'ncRNA', 'misc_RNA'].includes(gene.type)) {
                trackType = 'non_coding';
            } else {
                trackType = 'other';
            }
            
            if (!groups[trackType]) {
                groups[trackType] = [];
            }
            groups[trackType].push(gene);
        });
        
        // Debug: Log original type distribution
        console.log('Original gene type distribution:', typeCounts);
        console.log('Mapped gene type distribution:', Object.keys(groups).reduce((acc, key) => {
            acc[key] = groups[key].length;
            return acc;
        }, {}));
        
        // Debug: Show sample genes and their types
        if (genes.length > 0) {
            console.log('Sample genes (first 10):', genes.slice(0, 10).map(g => ({
                name: g.name,
                type: g.type,
                chromosome: g.chromosome
            })));
        }
        
        return groups;
    }
    
    renderGeneTracks(g, genes, baseRadius, theme) {
        const genesByType = this.groupGenesByType(genes);
        
        // Update gene counts in UI
        this.updateGeneCounts(genesByType);
        
        // Render each enabled gene type track
        Object.keys(this.geneTracks).forEach(geneType => {
            const trackConfig = this.geneTracks[geneType];
            if (!trackConfig.enabled) return;
            
            const genes = genesByType[geneType] || [];
            if (genes.length === 0) return;
            
            // Limit genes per track for performance
            const limitedGenes = genes.slice(0, trackConfig.maxGenes);
            console.log(`Rendering ${limitedGenes.length} ${geneType} genes on track ${trackConfig.track}`);
            
            this.renderGeneTypeTrack(g, limitedGenes, geneType, trackConfig, baseRadius, theme);
        });
        
        // Render CDS density tracks for protein coding genes
        if (this.geneTracks.protein_coding.enabled) {
            const cdsGenes = genesByType.protein_coding || [];
            if (cdsGenes.length > this.geneTracks.protein_coding.maxGenes) {
                this.renderCDSDensityTracks(g, cdsGenes, baseRadius, theme);
            }
        }
    }
    
    renderCanvasGeneTracks(ctx, genes, baseRadius, theme) {
        const genesByType = this.groupGenesByType(genes);
        
        // Update gene counts in UI
        this.updateGeneCounts(genesByType);
        
        // Render each enabled gene type track
        Object.keys(this.geneTracks).forEach(geneType => {
            const trackConfig = this.geneTracks[geneType];
            if (!trackConfig.enabled) return;
            
            const genes = genesByType[geneType] || [];
            if (genes.length === 0) return;
            
            // Limit genes per track for performance
            const limitedGenes = genes.slice(0, trackConfig.maxGenes);
            console.log(`Canvas: Rendering ${limitedGenes.length} ${geneType} genes on track ${trackConfig.track}`);
            
            this.renderCanvasGeneTypeTrack(ctx, limitedGenes, geneType, trackConfig, baseRadius, theme);
        });
        
        // Render CDS density tracks for protein coding genes
        if (this.geneTracks.protein_coding.enabled) {
            const cdsGenes = genesByType.protein_coding || [];
            if (cdsGenes.length > this.geneTracks.protein_coding.maxGenes) {
                this.renderCanvasCDSDensityTracks(ctx, cdsGenes, baseRadius, theme);
            }
        }
    }
    
    renderGeneTypeTrack(g, genes, geneType, trackConfig, baseRadius, theme) {
        const trackRadius = baseRadius + (trackConfig.track * (this.circosPlotter.geneHeight + this.trackSpacing));
        const geneHeight = Math.max(this.circosPlotter.geneHeight, 3);
        
        let renderedGenes = 0;
        genes.forEach(gene => {
            const chr = this.circosPlotter.data.chromosomes.find(c => 
                (c.name === gene.chromosome) || 
                (c.label === gene.chromosome) || 
                (c.id === gene.chromosome)
            );
            if (!chr) return;
            
            const chrLength = chr.length || chr.size || 1;
            
            // Validate gene coordinates
            if (!gene.start || !gene.end || isNaN(gene.start) || isNaN(gene.end)) {
                return;
            }
            
            // Ensure gene coordinates are within chromosome bounds
            const validStart = Math.max(0, Math.min(gene.start, chrLength - 1));
            const validEnd = Math.max(validStart + 1, Math.min(gene.end, chrLength));
            
            // Calculate angles with validation
            const startAngle = chr.startAngle + (validStart / chrLength) * (chr.endAngle - chr.startAngle);
            const endAngle = chr.startAngle + (validEnd / chrLength) * (chr.endAngle - chr.startAngle);
            
            // Validate calculated angles
            if (isNaN(startAngle) || isNaN(endAngle)) {
                return;
            }
            
            // Calculate arc parameters
            const innerRadius = Math.max(0, trackRadius);
            const outerRadius = Math.max(innerRadius + 1, trackRadius + geneHeight);
            const startRadians = startAngle * Math.PI / 180;
            const endRadians = endAngle * Math.PI / 180;
            
            // Validate arc parameters
            if (isNaN(innerRadius) || isNaN(outerRadius) || isNaN(startRadians) || isNaN(endRadians)) {
                return;
            }
            
            const arc = d3.arc()
                .innerRadius(innerRadius)
                .outerRadius(outerRadius)
                .startAngle(startRadians)
                .endAngle(endRadians);
            
            // Use track-specific color
            const geneColor = trackConfig.color;
            
            // Determine stroke style based on strand
            let strokeDasharray = 'none';
            if (gene.strand === '-') {
                strokeDasharray = '2,1';
            }
            
            g.append('path')
                .attr('d', arc)
                .attr('fill', geneColor)
                .attr('opacity', 0.8)
                .attr('stroke', theme.stroke)
                .attr('stroke-width', 0.5)
                .attr('stroke-dasharray', strokeDasharray)
                .style('cursor', 'pointer')
                .on('mouseover', (event) => {
                    const lengthKb = ((gene.end - gene.start) / 1000).toFixed(1);
                    this.circosPlotter.showTooltip(event, `
                        <strong>${gene.name}</strong><br/>
                        Type: ${gene.type}<br/>
                        Track: ${geneType}<br/>
                        Length: ${lengthKb} kb<br/>
                        Position: ${gene.start.toLocaleString()}-${gene.end.toLocaleString()}
                    `);
                })
                .on('mouseout', () => {
                    this.circosPlotter.hideTooltip();
                })
                .on('click', (event) => {
                    event.stopPropagation();
                    console.log(`Clicked on gene: ${gene.name} (${gene.type}) on ${geneType} track`);
                    this.circosPlotter.updateStatus(`Selected gene: ${gene.name} (${gene.type}) from ${geneType} track`);
                    this.circosPlotter.navigateToGene(gene);
                });
            
            renderedGenes++;
        });
        
        console.log(`Rendered ${renderedGenes} genes on ${geneType} track`);
    }
    
    renderCanvasGeneTypeTrack(ctx, genes, geneType, trackConfig, baseRadius, theme) {
        const trackRadius = baseRadius + (trackConfig.track * (this.circosPlotter.geneHeight + this.trackSpacing));
        const geneHeight = Math.max(this.circosPlotter.geneHeight, 3);
        
        let renderedGenes = 0;
        genes.forEach(gene => {
            const chr = this.circosPlotter.data.chromosomes.find(c => 
                (c.name === gene.chromosome) || 
                (c.label === gene.chromosome) || 
                (c.id === gene.chromosome)
            );
            if (!chr) return;
            
            const chrLength = chr.length || chr.size || 1;
            
            // Validate gene coordinates
            if (!gene.start || !gene.end || isNaN(gene.start) || isNaN(gene.end)) {
                return;
            }
            
            // Calculate gene angles
            const geneStartAngle = chr.startAngle + (gene.start / chrLength) * (chr.endAngle - chr.startAngle);
            const geneEndAngle = chr.startAngle + (gene.end / chrLength) * (chr.endAngle - chr.startAngle);
            
            // Validate angles
            if (isNaN(geneStartAngle) || isNaN(geneEndAngle)) {
                return;
            }
            
            const startRadians = geneStartAngle * Math.PI / 180;
            const endRadians = geneEndAngle * Math.PI / 180;
            
            // Calculate gene arc coordinates
            const innerRadius = trackRadius;
            const outerRadius = trackRadius + geneHeight;
            
            // Draw gene arc on canvas
            ctx.beginPath();
            ctx.arc(0, 0, (innerRadius + outerRadius) / 2, startRadians, endRadians);
            ctx.lineWidth = geneHeight;
            ctx.strokeStyle = trackConfig.color;
            ctx.globalAlpha = 0.8;
            
            // Set dash pattern for reverse strand
            if (gene.strand === '-') {
                ctx.setLineDash([2, 1]);
            } else {
                ctx.setLineDash([]);
            }
            
            ctx.stroke();
            ctx.globalAlpha = 1;
            ctx.setLineDash([]);
            
            renderedGenes++;
        });
        
        console.log(`Canvas: Rendered ${renderedGenes} ${geneType} genes on track ${trackConfig.track}`);
    }
    
    renderCDSDensityTracks(g, cdsGenes, baseRadius, theme) {
        // Distribute CDS genes across multiple density tracks
        const genesPerTrack = Math.ceil(cdsGenes.length / this.cdsDensityTracks);
        
        for (let trackIndex = 0; trackIndex < this.cdsDensityTracks; trackIndex++) {
            const startIndex = trackIndex * genesPerTrack;
            const endIndex = Math.min(startIndex + genesPerTrack, cdsGenes.length);
            const trackGenes = cdsGenes.slice(startIndex, endIndex);
            
            if (trackGenes.length === 0) continue;
            
            const trackRadius = baseRadius + (this.geneTracks.protein_coding.track * (this.circosPlotter.geneHeight + this.trackSpacing)) + 
                               (trackIndex * (this.cdsTrackHeight + 1));
            
            console.log(`Rendering CDS density track ${trackIndex + 1}: ${trackGenes.length} genes`);
            
            trackGenes.forEach(gene => {
                const chr = this.circosPlotter.data.chromosomes.find(c => 
                    (c.name === gene.chromosome) || 
                    (c.label === gene.chromosome) || 
                    (c.id === gene.chromosome)
                );
                if (!chr) return;
                
                const chrLength = chr.length || chr.size || 1;
                const validStart = Math.max(0, Math.min(gene.start, chrLength - 1));
                const validEnd = Math.max(validStart + 1, Math.min(gene.end, chrLength));
                
                const startAngle = chr.startAngle + (validStart / chrLength) * (chr.endAngle - chr.startAngle);
                const endAngle = chr.startAngle + (validEnd / chrLength) * (chr.endAngle - chr.startAngle);
                
                if (isNaN(startAngle) || isNaN(endAngle)) return;
                
                const innerRadius = Math.max(0, trackRadius);
                const outerRadius = Math.max(innerRadius + 1, trackRadius + this.cdsTrackHeight);
                const startRadians = startAngle * Math.PI / 180;
                const endRadians = endAngle * Math.PI / 180;
                
                const arc = d3.arc()
                    .innerRadius(innerRadius)
                    .outerRadius(outerRadius)
                    .startAngle(startRadians)
                    .endAngle(endRadians);
                
                g.append('path')
                    .attr('d', arc)
                    .attr('fill', this.geneTracks.protein_coding.color)
                    .attr('opacity', 0.7)
                    .attr('stroke', theme.stroke)
                    .attr('stroke-width', 0.3)
                    .style('cursor', 'pointer')
                    .on('click', (event) => {
                        event.stopPropagation();
                        this.circosPlotter.navigateToGene(gene);
                    });
            });
        }
    }
    
    renderCanvasCDSDensityTracks(ctx, cdsGenes, baseRadius, theme) {
        // Distribute CDS genes across multiple density tracks
        const genesPerTrack = Math.ceil(cdsGenes.length / this.cdsDensityTracks);
        
        for (let trackIndex = 0; trackIndex < this.cdsDensityTracks; trackIndex++) {
            const startIndex = trackIndex * genesPerTrack;
            const endIndex = Math.min(startIndex + genesPerTrack, cdsGenes.length);
            const trackGenes = cdsGenes.slice(startIndex, endIndex);
            
            if (trackGenes.length === 0) continue;
            
            const trackRadius = baseRadius + (this.geneTracks.protein_coding.track * (this.circosPlotter.geneHeight + this.trackSpacing)) + 
                               (trackIndex * (this.cdsTrackHeight + 1));
            
            console.log(`Canvas: Rendering CDS density track ${trackIndex + 1}: ${trackGenes.length} genes`);
            
            trackGenes.forEach(gene => {
                const chr = this.circosPlotter.data.chromosomes.find(c => 
                    (c.name === gene.chromosome) || 
                    (c.label === gene.chromosome) || 
                    (c.id === gene.chromosome)
                );
                if (!chr) return;
                
                const chrLength = chr.length || chr.size || 1;
                const validStart = Math.max(0, Math.min(gene.start, chrLength - 1));
                const validEnd = Math.max(validStart + 1, Math.min(gene.end, chrLength));
                
                const startAngle = chr.startAngle + (validStart / chrLength) * (chr.endAngle - chr.startAngle);
                const endAngle = chr.startAngle + (validEnd / chrLength) * (chr.endAngle - chr.startAngle);
                
                if (isNaN(startAngle) || isNaN(endAngle)) return;
                
                const innerRadius = Math.max(0, trackRadius);
                const outerRadius = Math.max(innerRadius + 1, trackRadius + this.cdsTrackHeight);
                const startRadians = startAngle * Math.PI / 180;
                const endRadians = endAngle * Math.PI / 180;
                
                // Draw gene arc on canvas
                ctx.beginPath();
                ctx.arc(0, 0, (innerRadius + outerRadius) / 2, startRadians, endRadians);
                ctx.lineWidth = this.cdsTrackHeight;
                ctx.strokeStyle = this.geneTracks.protein_coding.color;
                ctx.globalAlpha = 0.7;
                ctx.stroke();
                ctx.globalAlpha = 1;
            });
        }
    }
    
    updateGeneCounts(genesByType) {
        Object.keys(this.geneTracks).forEach(type => {
            const count = genesByType[type] ? genesByType[type].length : 0;
            
            // Update control panel count
            const countElement = document.getElementById(`count-${type}`);
            if (countElement) {
                countElement.textContent = count;
            }
            
            // Update legend count
            const legendCountElement = document.getElementById(`legend-count-${type}`);
            if (legendCountElement) {
                legendCountElement.textContent = count;
            }
        });
    }
    
    optimizeTrackDistribution() {
        // Analyze gene distribution and optimize track settings
        const genes = this.circosPlotter.data.genes || [];
        const genesByType = this.groupGenesByType(genes);
        
        console.log('Optimizing track distribution...');
        
        // Adjust maxGenes based on actual distribution
        Object.keys(genesByType).forEach(type => {
            const count = genesByType[type].length;
            if (this.geneTracks[type]) {
                // Set maxGenes to 80% of actual count, with reasonable limits
                this.geneTracks[type].maxGenes = Math.min(Math.max(Math.floor(count * 0.8), 50), 5000);
                console.log(`Optimized ${type} track: ${count} genes -> max ${this.geneTracks[type].maxGenes}`);
            }
        });
        
        // Adjust CDS density tracks based on protein coding gene count
        const proteinCodingCount = genesByType.protein_coding ? genesByType.protein_coding.length : 0;
        if (proteinCodingCount > 1000) {
            this.cdsDensityTracks = Math.min(Math.ceil(proteinCodingCount / 500), 5);
            console.log(`Optimized CDS density tracks: ${this.cdsDensityTracks} tracks for ${proteinCodingCount} genes`);
        }
        
        // Redraw with optimized settings
        this.circosPlotter.redrawPlot();
        
        this.circosPlotter.updateStatus(`Track distribution optimized for ${genes.length} genes`);
    }
    
    getTrackStatistics() {
        const genes = this.circosPlotter.data.genes || [];
        const genesByType = this.groupGenesByType(genes);
        
        const stats = {
            total: genes.length,
            byType: {},
            enabledTracks: Object.keys(this.geneTracks).filter(type => this.geneTracks[type].enabled).length,
            cdsDensityTracks: this.cdsDensityTracks
        };
        
        Object.keys(genesByType).forEach(type => {
            stats.byType[type] = {
                count: genesByType[type].length,
                enabled: this.geneTracks[type] ? this.geneTracks[type].enabled : false,
                maxGenes: this.geneTracks[type] ? this.geneTracks[type].maxGenes : 0
            };
        });
        
        return stats;
    }
}

// Export for use in Circos Plotter
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MultiTrackGeneManager;
} else if (typeof window !== 'undefined') {
    window.MultiTrackGeneManager = MultiTrackGeneManager;
}
