// JavaScript patch to fix sequence track width issues
// This script optimizes the sequence display width calculation

(function() {
    console.log('🔧 Applying sequence track width fixes...');
    
    // Override the createBaseElement method in TrackRenderer to use exact width distribution
    if (window.trackRenderer && window.trackRenderer.createBaseElement) {
        const originalCreateBaseElement = window.trackRenderer.createBaseElement;
        
        window.trackRenderer.createBaseElement = function(base, index, viewport, fontSize, charWidth) {
            const baseElement = document.createElement('span');
            baseElement.className = `base-${base.toLowerCase()} sequence-base-inline`;
            baseElement.textContent = base;
            
            // FIX: Use exact positioning for uniform distribution
            const totalSequenceLength = viewport.range;
            const containerWidth = this.getContainerWidth();
            const exactCharWidth = containerWidth / totalSequenceLength;
            const leftPosition = index * exactCharWidth;
            
            baseElement.style.cssText = `
                position: absolute;
                left: ${leftPosition}px;
                width: ${exactCharWidth}px;
                font-size: ${fontSize}px;
                font-family: 'Courier New', Consolas, Monaco, monospace;
                font-weight: bold;
                text-align: center;
                line-height: 30px;
                overflow: hidden;
                white-space: nowrap;
                box-sizing: border-box;
            `;
            
            // Add tooltip with position info
            const position = viewport.start + index + 1;
            baseElement.title = `Position: ${position}, Base: ${base}`;
            
            return baseElement;
        };
        
        // Add helper method to get container width
        window.trackRenderer.getContainerWidth = function() {
            const genomeBrowser = document.querySelector('#genome-browser');
            if (genomeBrowser) {
                return genomeBrowser.getBoundingClientRect().width - 40; // Account for padding
            }
            return 800; // Fallback
        };
    }
    
    // Override adjustSequenceDisplay to use full container width
    if (window.trackRenderer && window.trackRenderer.adjustSequenceDisplay) {
        const originalAdjustSequenceDisplay = window.trackRenderer.adjustSequenceDisplay;
        
        window.trackRenderer.adjustSequenceDisplay = function(seqDisplay, subsequence, viewport) {
            if (!seqDisplay.parentElement) return;
            
            // Get actual container width
            const containerWidth = seqDisplay.parentElement.getBoundingClientRect().width || 800;
            const sequenceLength = viewport.range;
            
            // FIX: Use exact width distribution - no margins or padding reduction
            const exactCharWidth = containerWidth / sequenceLength;
            
            console.log('🔧 [SequenceWidthFix] Adjusted sequence display:', {
                containerWidth,
                sequenceLength,
                exactCharWidth,
                totalWidth: exactCharWidth * sequenceLength
            });
            
            // Update all base elements with exact positioning
            const baseElements = seqDisplay.querySelectorAll('.sequence-base-inline');
            baseElements.forEach((element, index) => {
                const leftPosition = index * exactCharWidth;
                element.style.left = `${leftPosition}px`;
                element.style.width = `${exactCharWidth}px`;
                element.style.boxSizing = 'border-box';
            });
        };
    }
    
    // Add CSS fix for sequence containers
    const style = document.createElement('style');
    style.textContent = `
        /* Sequence Track Width Fixes */
        .sequence-single-line {
            width: 100% !important;
            box-sizing: border-box !important;
            padding: 0 !important;
            margin: 0 !important;
        }
        
        .sequence-base-inline {
            box-sizing: border-box !important;
            padding: 0 !important;
            margin: 0 !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
        }
        
        /* Ensure track content uses full width */
        .track-content {
            width: 100% !important;
            box-sizing: border-box !important;
        }
        
        .sequence-track .track-content {
            padding: 0 !important;
        }
    `;
    document.head.appendChild(style);
    
    console.log('✅ Sequence track width fixes applied');
})();