/**
 * GenomeNavigationBar - Interactive ruler-style navigation for the genome viewer
 */
class GenomeNavigationBar {
    constructor(genomeBrowser) {
        this.genomeBrowser = genomeBrowser;
        this.container = null;
        this.canvas = null;
        this.ctx = null;
        this.isVisible = false;
        this.height = 60; // Height of the navigation bar
        this.majorTickHeight = 20;
        this.minorTickHeight = 10;
        this.labelOffset = 35;
        this.currentChromosome = null;
        this.sequenceLength = 0;
        
        // Range interaction state
        this.isDragging = false;
        this.isResizing = false;
        this.resizeHandle = null; // 'left', 'right', or null
        this.dragStartX = 0;
        this.dragStartRange = { start: 0, end: 0 };
        this.tempRange = null; // Temporary range during drag/resize operations
        this.handleWidth = 8; // Width of resize handles
        
        // Sequence selection state
        this.isSelecting = false;
        this.selectionStart = null;
        this.selectionEnd = null;
        this.selectionMode = false; // Toggle for selection mode vs navigation mode
        
        this.initialize();
    }

    initialize() {
        this.createNavigationBar();
        this.setupEventListeners();
    }

    createNavigationBar() {
        // Create the navigation bar container
        this.container = document.createElement('div');
        this.container.id = 'genomeNavigationBar';
        this.container.className = 'genome-navigation-bar';
        this.container.style.display = 'none'; // Initially hidden
        
        // Create canvas for drawing the ruler
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'navigation-canvas';
        this.ctx = this.canvas.getContext('2d');
        
        // Set up canvas styling
        this.canvas.style.cursor = 'crosshair';
        this.canvas.style.display = 'block';
        this.canvas.style.width = '100%';
        this.canvas.style.height = `${this.height}px`;
        
        // Create position indicator
        this.positionIndicator = document.createElement('div');
        this.positionIndicator.className = 'position-indicator';
        
        // Create range indicator (shows current view)
        this.rangeIndicator = document.createElement('div');
        this.rangeIndicator.className = 'range-indicator';
        
        // Create selection mode toggle button
        this.selectionToggle = document.createElement('button');
        this.selectionToggle.className = 'selection-toggle-btn';
        this.selectionToggle.innerHTML = '<i class="fas fa-mouse-pointer"></i>';
        this.selectionToggle.title = 'Toggle sequence selection mode';
        this.selectionToggle.style.cssText = `
            position: absolute;
            top: 5px;
            right: 10px;
            width: 30px;
            height: 30px;
            border: 1px solid #cbd5e1;
            border-radius: 4px;
            background: #ffffff;
            cursor: pointer;
            z-index: 10;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            color: #64748b;
            transition: all 0.2s ease;
        `;
        
        // Add tooltip for position display
        this.tooltip = document.createElement('div');
        this.tooltip.className = 'navigation-tooltip';
        this.tooltip.style.display = 'none';
        
        // Assemble the navigation bar
        this.container.appendChild(this.canvas);
        this.container.appendChild(this.positionIndicator);
        this.container.appendChild(this.rangeIndicator);
        this.container.appendChild(this.selectionToggle);
        this.container.appendChild(this.tooltip);
        
        // Insert the navigation bar above the genome viewer
        const genomeViewerSection = document.getElementById('genomeViewerSection');
        if (genomeViewerSection) {
            genomeViewerSection.insertBefore(this.container, genomeViewerSection.firstChild);
        }
        
        console.log('GenomeNavigationBar: Navigation bar created and inserted');
    }

    setupEventListeners() {
        // Handle canvas resizing
        const resizeObserver = new ResizeObserver(entries => {
            for (let entry of entries) {
                this.resizeCanvas();
                this.draw();
            }
        });
        resizeObserver.observe(this.container);

        // Mouse events for navigation and range interaction
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
        this.canvas.addEventListener('dblclick', (e) => this.handleDoubleClick(e));
        
        // Selection mode toggle
        this.selectionToggle.addEventListener('click', (e) => this.toggleSelectionMode(e));
        
        // Keyboard navigation
        this.canvas.addEventListener('keydown', (e) => this.handleKeyDown(e));
        this.canvas.setAttribute('tabindex', '0');
        
        console.log('GenomeNavigationBar: Event listeners set up');
    }

    resizeCanvas() {
        const rect = this.container.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr;
        this.canvas.height = this.height * dpr;
        
        this.ctx.scale(dpr, dpr);
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = this.height + 'px';
    }

    show(chromosome, sequenceLength) {
        this.currentChromosome = chromosome;
        this.sequenceLength = sequenceLength;
        this.isVisible = true;
        
        this.container.style.display = 'block';
        this.resizeCanvas();
        this.draw();
        
        console.log(`GenomeNavigationBar: Showing navigation for ${chromosome} (${sequenceLength} bp)`);
    }

    hide() {
        this.isVisible = false;
        this.container.style.display = 'none';
        console.log('GenomeNavigationBar: Hidden');
    }

    update() {
        if (this.isVisible) {
            this.draw();
        }
    }

    draw() {
        if (!this.ctx || !this.isVisible || this.sequenceLength === 0) return;
        
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.height;
        
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Set font and styles
        this.ctx.font = '11px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.strokeStyle = '#64748b';
        this.ctx.fillStyle = '#334155';
        this.ctx.lineWidth = 1;
        
        // Draw background
        this.ctx.fillStyle = '#f8fafc';
        this.ctx.fillRect(0, 0, width, height);
        
        // Calculate scale and tick intervals
        const scale = width / this.sequenceLength;
        const { majorInterval, minorInterval } = this.calculateTickIntervals();
        
        // Draw minor ticks
        this.ctx.strokeStyle = '#cbd5e1';
        this.ctx.lineWidth = 0.5;
        for (let pos = 0; pos <= this.sequenceLength; pos += minorInterval) {
            const x = pos * scale;
            this.ctx.beginPath();
            this.ctx.moveTo(x, height - this.minorTickHeight);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }
        
        // Draw major ticks and labels
        this.ctx.strokeStyle = '#64748b';
        this.ctx.fillStyle = '#334155';
        this.ctx.lineWidth = 1;
        
        for (let pos = 0; pos <= this.sequenceLength; pos += majorInterval) {
            const x = pos * scale;
            
            // Draw major tick
            this.ctx.beginPath();
            this.ctx.moveTo(x, height - this.majorTickHeight);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
            
            // Draw label
            const label = this.formatPosition(pos);
            this.ctx.fillText(label, x, this.labelOffset);
        }
        
        // Draw current view range indicator
        this.drawRangeIndicator();
        
        // Draw sequence selection if in selection mode
        if (this.selectionMode && this.selectionStart !== null && this.selectionEnd !== null) {
            this.drawSelectionIndicator();
        }
        
        // Draw ruler border
        this.ctx.strokeStyle = '#cbd5e1';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(0, 0, width, height);
    }

    calculateTickIntervals() {
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const pixelsPerBp = width / this.sequenceLength;
        
        // Aim for ticks every 50-100 pixels
        const targetMajorPixels = 80;
        const targetMinorPixels = 20;
        
        const baseMajorInterval = targetMajorPixels / pixelsPerBp;
        const baseMinorInterval = targetMinorPixels / pixelsPerBp;
        
        // Round to nice numbers (powers of 10 * 1, 2, or 5)
        const majorInterval = this.roundToNiceNumber(baseMajorInterval);
        const minorInterval = this.roundToNiceNumber(baseMinorInterval);
        
        return { majorInterval, minorInterval };
    }

    roundToNiceNumber(value) {
        const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
        const normalized = value / magnitude;
        
        let nice;
        if (normalized <= 1) nice = 1;
        else if (normalized <= 2) nice = 2;
        else if (normalized <= 5) nice = 5;
        else nice = 10;
        
        return nice * magnitude;
    }

    formatPosition(position) {
        if (position === 0) return '0';
        
        if (position >= 1000000) {
            return (position / 1000000).toFixed(1) + 'M';
        } else if (position >= 1000) {
            return (position / 1000).toFixed(1) + 'K';
        } else {
            return position.toString();
        }
    }

    drawRangeIndicator() {
        if (!this.genomeBrowser.currentPosition) return;
        
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const scale = width / this.sequenceLength;
        
        // Use temporary range if dragging/resizing, otherwise use current position
        const range = this.tempRange || this.genomeBrowser.currentPosition;
        const startX = range.start * scale;
        const endX = range.end * scale;
        const rangeWidth = endX - startX;
        
        // Draw highlighted range
        this.ctx.fillStyle = 'rgba(59, 130, 246, 0.2)';
        this.ctx.fillRect(startX, 0, rangeWidth, this.height);
        
        // Draw range borders
        this.ctx.strokeStyle = '#3b82f6';
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(startX, 0);
        this.ctx.lineTo(startX, this.height);
        this.ctx.moveTo(endX, 0);
        this.ctx.lineTo(endX, this.height);
        this.ctx.stroke();
        
        // Draw resize handles
        this.drawResizeHandles(startX, endX);
    }

    drawResizeHandles(startX, endX) {
        const handleHeight = this.height;
        
        // Left handle
        this.ctx.fillStyle = '#3b82f6';
        this.ctx.fillRect(startX - this.handleWidth / 2, 0, this.handleWidth, handleHeight);
        
        // Right handle
        this.ctx.fillRect(endX - this.handleWidth / 2, 0, this.handleWidth, handleHeight);
        
        // Handle highlights for better visibility
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillRect(startX - this.handleWidth / 2 + 1, 2, this.handleWidth - 2, handleHeight - 4);
        this.ctx.fillRect(endX - this.handleWidth / 2 + 1, 2, this.handleWidth - 2, handleHeight - 4);
    }
    
    /**
     * Draw sequence selection indicator
     */
    drawSelectionIndicator() {
        if (!this.selectionStart || !this.selectionEnd) return;
        
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const height = this.height;
        const scale = width / this.sequenceLength;
        
        const start = Math.min(this.selectionStart, this.selectionEnd);
        const end = Math.max(this.selectionStart, this.selectionEnd);
        
        const startX = start * scale;
        const endX = end * scale;
        const selectionWidth = endX - startX;
        
        // Draw selection background
        this.ctx.fillStyle = 'rgba(59, 130, 246, 0.3)';
        this.ctx.fillRect(startX, 0, selectionWidth, height);
        
        // Draw selection border
        this.ctx.strokeStyle = '#3b82f6';
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(startX, 0, selectionWidth, height);
        
        // Draw selection handles
        const handleWidth = 6;
        this.ctx.fillStyle = '#3b82f6';
        this.ctx.fillRect(startX - handleWidth/2, height - 20, handleWidth, 20);
        this.ctx.fillRect(endX - handleWidth/2, height - 20, handleWidth, 20);
        
        // Draw handle borders
        this.ctx.strokeStyle = '#1d4ed8';
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(startX - handleWidth/2, height - 20, handleWidth, 20);
        this.ctx.strokeRect(endX - handleWidth/2, height - 20, handleWidth, 20);
        
        // Draw selection label
        const length = end - start + 1;
        this.ctx.fillStyle = '#1d4ed8';
        this.ctx.font = 'bold 10px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(`${length.toLocaleString()} bp`, startX + selectionWidth/2, 15);
    }

    getInteractionType(x) {
        if (!this.genomeBrowser.currentPosition) return 'none';
        
        const width = this.canvas.width / (window.devicePixelRatio || 1);
        const scale = width / this.sequenceLength;
        
        const range = this.tempRange || this.genomeBrowser.currentPosition;
        const startX = range.start * scale;
        const endX = range.end * scale;
        
        // Check for resize handles
        if (Math.abs(x - startX) <= this.handleWidth / 2) {
            return 'resize-left';
        }
        if (Math.abs(x - endX) <= this.handleWidth / 2) {
            return 'resize-right';
        }
        
        // Check if inside range for dragging
        if (x >= startX && x <= endX) {
            return 'drag';
        }
        
        return 'navigate';
    }

    updateCursor(interactionType) {
        switch (interactionType) {
            case 'resize-left':
            case 'resize-right':
                this.canvas.style.cursor = 'ew-resize';
                break;
            case 'drag':
                this.canvas.style.cursor = this.isDragging ? 'grabbing' : 'grab';
                break;
            default:
                this.canvas.style.cursor = 'crosshair';
        }
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const interactionType = this.getInteractionType(x);
        
        if (this.selectionMode) {
            // Handle sequence selection mode
            this.isSelecting = true;
            this.selectionStart = this.getPositionFromEvent(e);
            this.selectionEnd = this.selectionStart;
            this.canvas.style.cursor = 'crosshair';
            this.container.classList.add('selecting');
            this.canvas.classList.add('selecting');
            e.preventDefault();
        } else {
            // Handle navigation mode (original behavior)
            if (interactionType === 'resize-left' || interactionType === 'resize-right') {
                this.isResizing = true;
                this.resizeHandle = interactionType === 'resize-left' ? 'left' : 'right';
                this.dragStartX = x;
                this.dragStartRange = { ...this.genomeBrowser.currentPosition };
                this.tempRange = { ...this.genomeBrowser.currentPosition };
                this.canvas.style.cursor = 'ew-resize';
                // Add visual feedback
                this.container.classList.add('resizing', 'active-resize');
                this.canvas.classList.add('resizing');
                e.preventDefault();
            } else if (interactionType === 'drag') {
                this.isDragging = true;
                this.dragStartX = x;
                this.dragStartRange = { ...this.genomeBrowser.currentPosition };
                this.tempRange = { ...this.genomeBrowser.currentPosition };
                this.canvas.style.cursor = 'grabbing';
                // Add visual feedback
                this.container.classList.add('dragging', 'active-drag');
                this.canvas.classList.add('dragging');
                e.preventDefault();
            } else if (interactionType === 'navigate') {
                // Handle single click navigation
                const position = this.getPositionFromEvent(e);
                if (position !== null) {
                    this.navigateToPosition(position);
                }
            }
        }
    }

    handleMouseMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        
        if (this.isSelecting && this.selectionStart !== null) {
            // Handle sequence selection mode
            this.selectionEnd = this.getPositionFromEvent(e);
            if (this.selectionEnd !== null) {
                this.draw();
                this.showSelectionTooltip(e, this.selectionStart, this.selectionEnd);
            }
        } else if (this.isResizing && this.tempRange) {
            const width = rect.width;
            const scale = this.sequenceLength / width;
            const deltaX = x - this.dragStartX;
            const deltaPosition = deltaX * scale;
            
            if (this.resizeHandle === 'left') {
                const newStart = Math.max(0, this.dragStartRange.start + deltaPosition);
                const newEnd = this.dragStartRange.end;
                if (newStart < newEnd - 100) { // Minimum range of 100bp
                    this.tempRange = { start: newStart, end: newEnd };
                }
            } else if (this.resizeHandle === 'right') {
                const newStart = this.dragStartRange.start;
                const newEnd = Math.min(this.sequenceLength, this.dragStartRange.end + deltaPosition);
                if (newEnd > newStart + 100) { // Minimum range of 100bp
                    this.tempRange = { start: newStart, end: newEnd };
                }
            }
            
            this.draw();
            this.showRangeTooltip(e, this.tempRange.start, this.tempRange.end);
        } else if (this.isDragging && this.tempRange) {
            const width = rect.width;
            const scale = this.sequenceLength / width;
            const deltaX = x - this.dragStartX;
            const deltaPosition = deltaX * scale;
            
            const rangeSize = this.dragStartRange.end - this.dragStartRange.start;
            let newStart = this.dragStartRange.start + deltaPosition;
            let newEnd = this.dragStartRange.end + deltaPosition;
            
            // Keep within bounds
            if (newStart < 0) {
                newStart = 0;
                newEnd = rangeSize;
            }
            if (newEnd > this.sequenceLength) {
                newEnd = this.sequenceLength;
                newStart = this.sequenceLength - rangeSize;
            }
            
            this.tempRange = { start: newStart, end: newEnd };
            this.draw();
            this.showRangeTooltip(e, this.tempRange.start, this.tempRange.end);
        } else {
            // Update cursor based on hover state
            const interactionType = this.getInteractionType(x);
            this.updateCursor(interactionType);
            
            // Add CSS classes for hover states
            this.canvas.classList.remove('hovering-handle', 'hovering-range');
            if (interactionType === 'resize-left' || interactionType === 'resize-right') {
                this.canvas.classList.add('hovering-handle');
            } else if (interactionType === 'drag') {
                this.canvas.classList.add('hovering-range');
            }
            
            // Show position tooltip
            const position = this.getPositionFromEvent(e);
            if (position !== null) {
                this.showTooltip(e, position);
            }
        }
    }

    handleMouseUp(e) {
        if (this.isSelecting) {
            // Handle sequence selection completion
            if (this.selectionStart !== null && this.selectionEnd !== null) {
                const startPos = Math.min(this.selectionStart, this.selectionEnd);
                const endPos = Math.max(this.selectionStart, this.selectionEnd);
                
                // Apply sequence selection to the genome browser
                this.applySequenceSelection(startPos, endPos);
                
                console.log(`GenomeNavigationBar: Sequence selected ${startPos}-${endPos} (${endPos - startPos + 1} bp)`);
            }
            
            // Reset selection state
            this.isSelecting = false;
            this.selectionStart = null;
            this.selectionEnd = null;
            
            // Remove visual feedback classes
            this.container.classList.remove('selecting');
            this.canvas.classList.remove('selecting');
            
            this.draw();
        } else if (this.isResizing || this.isDragging) {
            // Apply the temporary range to the Genome AI Studio
            if (this.tempRange) {
                this.genomeBrowser.currentPosition = {
                    start: Math.round(this.tempRange.start),
                    end: Math.round(this.tempRange.end)
                };
                
                // Update the Genome AI Studio display
                const sequence = this.genomeBrowser.currentSequence[this.currentChromosome];
                this.genomeBrowser.updateStatistics(this.currentChromosome, sequence);
                this.genomeBrowser.displayGenomeView(this.currentChromosome, sequence);
                
                console.log(`GenomeNavigationBar: Range updated to ${this.genomeBrowser.currentPosition.start}-${this.genomeBrowser.currentPosition.end}`);
            }
            
            // Reset interaction state and remove visual feedback
            this.isResizing = false;
            this.isDragging = false;
            this.resizeHandle = null;
            this.tempRange = null;
            
            // Remove visual feedback classes
            this.container.classList.remove('resizing', 'dragging', 'active-resize', 'active-drag');
            this.canvas.classList.remove('resizing', 'dragging');
            
            // Update cursor
            const rect = this.canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const interactionType = this.getInteractionType(x);
            this.updateCursor(interactionType);
            
            this.draw();
        }
    }

    handleMouseLeave(e) {
        this.tooltip.style.display = 'none';
        
        // Remove hover state classes
        this.canvas.classList.remove('hovering-handle', 'hovering-range');
        
        // If we're in the middle of an operation, don't reset cursor
        if (!this.isResizing && !this.isDragging) {
            this.canvas.style.cursor = 'crosshair';
        }
    }

    handleDoubleClick(e) {
        const position = this.getPositionFromEvent(e);
        if (position !== null) {
            this.navigateToPositionAndZoom(position);
        }
    }

    handleKeyDown(e) {
        const currentRange = this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start;
        const step = Math.max(1, Math.floor(currentRange * 0.1));
        
        let newStart = this.genomeBrowser.currentPosition.start;
        
        switch(e.key) {
            case 'ArrowLeft':
                newStart = Math.max(0, this.genomeBrowser.currentPosition.start - step);
                break;
            case 'ArrowRight':
                newStart = Math.min(this.sequenceLength - currentRange, this.genomeBrowser.currentPosition.start + step);
                break;
            case 'Home':
                newStart = 0;
                break;
            case 'End':
                newStart = Math.max(0, this.sequenceLength - currentRange);
                break;
            default:
                return;
        }
        
        e.preventDefault();
        
        const newEnd = newStart + currentRange;
        this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
        this.genomeBrowser.updateStatistics(this.currentChromosome, this.genomeBrowser.currentSequence[this.currentChromosome]);
        this.genomeBrowser.displayGenomeView(this.currentChromosome, this.genomeBrowser.currentSequence[this.currentChromosome]);
    }

    getPositionFromEvent(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const width = rect.width;
        
        if (x < 0 || x > width) return null;
        
        const position = Math.round((x / width) * this.sequenceLength);
        return Math.max(0, Math.min(this.sequenceLength, position));
    }

    showTooltip(e, startPos, endPos = null) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        
        this.tooltip.style.left = `${x}px`;
        this.tooltip.style.top = `${this.height + 5}px`;
        this.tooltip.style.display = 'block';
        
        if (endPos !== null) {
            // Show range tooltip with special styling
            const rangeSize = Math.round(endPos - startPos);
            this.tooltip.textContent = `Range: ${Math.round(startPos).toLocaleString()}-${Math.round(endPos).toLocaleString()} bp (${rangeSize.toLocaleString()} bp)`;
            this.tooltip.classList.add('range-tooltip');
        } else {
            // Show position tooltip
            this.tooltip.textContent = `Position: ${startPos.toLocaleString()} bp`;
            this.tooltip.classList.remove('range-tooltip');
        }
    }

    showRangeTooltip(e, startPos, endPos) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        
        this.tooltip.style.left = `${x}px`;
        this.tooltip.style.top = `${this.height + 5}px`;
        this.tooltip.style.display = 'block';
        
        const rangeSize = Math.round(endPos - startPos);
        this.tooltip.textContent = `Range: ${Math.round(startPos).toLocaleString()}-${Math.round(endPos).toLocaleString()} bp (${rangeSize.toLocaleString()} bp)`;
        this.tooltip.classList.add('range-tooltip');
    }

    navigateToPosition(position) {
        // Center the view on the clicked position
        const currentRange = this.genomeBrowser.currentPosition ? 
            (this.genomeBrowser.currentPosition.end - this.genomeBrowser.currentPosition.start) : 
            Math.min(10000, this.sequenceLength);
        
        const newStart = Math.max(0, position - Math.floor(currentRange / 2));
        const newEnd = Math.min(this.sequenceLength, newStart + currentRange);
        
        this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
        
        // Update the display
        const sequence = this.genomeBrowser.currentSequence[this.currentChromosome];
        this.genomeBrowser.updateStatistics(this.currentChromosome, sequence);
        this.genomeBrowser.displayGenomeView(this.currentChromosome, sequence);
        
        console.log(`GenomeNavigationBar: Navigated to position ${position}`);
    }

    navigateToPositionAndZoom(position) {
        // Double-click zooms in and centers on position
        const zoomRange = Math.max(1000, this.sequenceLength * 0.01); // 1% of sequence or 1kb minimum
        
        const newStart = Math.max(0, position - Math.floor(zoomRange / 2));
        const newEnd = Math.min(this.sequenceLength, newStart + zoomRange);
        
        this.genomeBrowser.currentPosition = { start: newStart, end: newEnd };
        
        // Update the display
        const sequence = this.genomeBrowser.currentSequence[this.currentChromosome];
        this.genomeBrowser.updateStatistics(this.currentChromosome, sequence);
        this.genomeBrowser.displayGenomeView(this.currentChromosome, sequence);
        
        console.log(`GenomeNavigationBar: Zoomed to position ${position} with range ${zoomRange}`);
    }
    
    /**
     * Toggle sequence selection mode
     */
    toggleSelectionMode(e) {
        e.preventDefault();
        this.selectionMode = !this.selectionMode;
        
        if (this.selectionMode) {
            this.selectionToggle.style.background = '#3b82f6';
            this.selectionToggle.style.color = '#ffffff';
            this.selectionToggle.style.borderColor = '#3b82f6';
            this.canvas.style.cursor = 'crosshair';
            this.genomeBrowser.showNotification('Sequence selection mode enabled. Click and drag on the ruler to select a region.', 'info');
        } else {
            this.selectionToggle.style.background = '#ffffff';
            this.selectionToggle.style.color = '#64748b';
            this.selectionToggle.style.borderColor = '#cbd5e1';
            this.canvas.style.cursor = 'crosshair';
            this.genomeBrowser.showNotification('Navigation mode enabled.', 'info');
        }
        
        console.log(`GenomeNavigationBar: Selection mode ${this.selectionMode ? 'enabled' : 'disabled'}`);
    }
    
    /**
     * Apply sequence selection to genome browser
     */
    applySequenceSelection(startPos, endPos) {
        // Clear any existing selection
        this.genomeBrowser.clearSequenceSelection();
        
        // Set the sequence selection
        this.genomeBrowser.currentSequenceSelection = {
            chromosome: this.currentChromosome,
            start: startPos,
            end: endPos
        };
        
        // Update sequence selection state
        this.genomeBrowser.sequenceSelection = {
            start: startPos,
            end: endPos,
            active: true,
            source: 'ruler'
        };
        
        // Highlight the selected region in Genes & Features track
        this.highlightSelectedRegion(startPos, endPos);
        
        // Update copy button state
        this.genomeBrowser.updateCopyButtonState();
        
        // Show notification
        this.genomeBrowser.showNotification(
            `Sequence selected: ${this.currentChromosome}:${startPos}-${endPos} (${endPos - startPos + 1} bp)`,
            'success'
        );
    }
    
    /**
     * Highlight selected region in Genes & Features track
     */
    highlightSelectedRegion(startPos, endPos) {
        // Find features that overlap with the selection
        if (this.genomeBrowser.currentAnnotations && this.genomeBrowser.currentAnnotations[this.currentChromosome]) {
            const annotations = this.genomeBrowser.currentAnnotations[this.currentChromosome];
            const overlappingFeatures = annotations.filter(feature => 
                feature.start <= endPos && feature.end >= startPos
            );
            
            // Clear previous highlights
            document.querySelectorAll('.feature-highlighted').forEach(el => {
                el.classList.remove('feature-highlighted');
            });
            
            // Highlight overlapping features
            overlappingFeatures.forEach(feature => {
                const featureElements = document.querySelectorAll(`[data-feature-id="${feature.id}"]`);
                featureElements.forEach(el => {
                    el.classList.add('feature-highlighted');
                });
            });
            
            console.log(`GenomeNavigationBar: Highlighted ${overlappingFeatures.length} features in selected region`);
        }
    }
    
    /**
     * Show selection tooltip
     */
    showSelectionTooltip(e, startPos, endPos) {
        if (!startPos || !endPos) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const start = Math.min(startPos, endPos);
        const end = Math.max(startPos, endPos);
        const length = end - start + 1;
        
        this.tooltip.innerHTML = `
            <div style="font-weight: bold; margin-bottom: 4px;">Sequence Selection</div>
            <div>Start: ${start.toLocaleString()}</div>
            <div>End: ${end.toLocaleString()}</div>
            <div>Length: ${length.toLocaleString()} bp</div>
        `;
        
        this.tooltip.style.left = (x + 10) + 'px';
        this.tooltip.style.top = (y - 60) + 'px';
        this.tooltip.style.display = 'block';
    }
} 