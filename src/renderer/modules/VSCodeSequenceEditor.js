/**
 * VS Code-like Sequence Editor
 * Provides smooth text visualization and operations similar to VS Code
 */
class VSCodeSequenceEditor {
    constructor(container, genomeBrowser) {
        this.container = container;
        this.genomeBrowser = genomeBrowser;
        this.sequence = '';
        this.annotations = [];
        this.viewStart = 0;
        this.viewEnd = 0;
        this.chromosome = '';
        
        // Editor state
        this.cursorPosition = 0;
        this.selectionStart = -1;
        this.selectionEnd = -1;
        this.lineHeight = 20;
        this.charWidth = 8;
        this.basesPerLine = 80;
        this.scrollTop = 0;
        this.visibleLines = 20;
        
        // Virtual scrolling for performance
        this.virtualScrolling = true;
        this.renderBuffer = 5; // Extra lines to render above/below visible area
        
        // Editor elements
        this.editorContainer = null;
        this.lineNumbers = null;
        this.sequenceContent = null;
        this.scrollbar = null;
        this.cursor = null;
        this.selection = null;
        
        // Event handlers
        this.isMouseDown = false;
        this.isDragging = false;
        
        this.init();
    }
    
    init() {
        this.createEditorStructure();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
    }
    
    createEditorStructure() {
        // Clear container
        this.container.innerHTML = '';
        this.container.className = 'vscode-sequence-editor';
        
        // Create main editor container
        this.editorContainer = document.createElement('div');
        this.editorContainer.className = 'editor-container';
        
        // Create line numbers panel
        this.lineNumbers = document.createElement('div');
        this.lineNumbers.className = 'line-numbers';
        
        // Create sequence content area
        this.sequenceContent = document.createElement('div');
        this.sequenceContent.className = 'sequence-content';
        this.sequenceContent.tabIndex = 0; // Make focusable
        
        // Create cursor
        this.cursor = document.createElement('div');
        this.cursor.className = 'editor-cursor';
        
        // Create selection overlay
        this.selection = document.createElement('div');
        this.selection.className = 'editor-selection';
        
        // Create scrollbar
        this.scrollbar = document.createElement('div');
        this.scrollbar.className = 'editor-scrollbar';
        const scrollThumb = document.createElement('div');
        scrollThumb.className = 'scrollbar-thumb';
        this.scrollbar.appendChild(scrollThumb);
        
        // Assemble editor
        this.editorContainer.appendChild(this.lineNumbers);
        this.editorContainer.appendChild(this.sequenceContent);
        this.sequenceContent.appendChild(this.cursor);
        this.sequenceContent.appendChild(this.selection);
        this.editorContainer.appendChild(this.scrollbar);
        
        this.container.appendChild(this.editorContainer);
        
        // Add CSS styles
        this.addEditorStyles();
    }
    
    addEditorStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .vscode-sequence-editor {
                width: 100%;
                height: 100%;
                font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', 'Consolas', 'Courier New', monospace;
                font-size: 14px;
                line-height: 20px;
                background: #1e1e1e;
                color: #d4d4d4;
                position: relative;
                overflow: hidden;
                border: 1px solid #3c3c3c;
                border-radius: 4px;
            }
            
            .editor-container {
                display: flex;
                height: 100%;
                position: relative;
            }
            
            .line-numbers {
                background: #252526;
                border-right: 1px solid #3c3c3c;
                padding: 0 10px 0 5px;
                min-width: 60px;
                text-align: right;
                color: #858585;
                user-select: none;
                overflow: hidden;
                position: relative;
            }
            
            .line-number {
                height: 20px;
                line-height: 20px;
                font-size: 12px;
                position: absolute;
                right: 10px;
                white-space: nowrap;
            }
            
            .sequence-content {
                flex: 1;
                position: relative;
                overflow: hidden;
                padding: 0 10px;
                outline: none;
                cursor: text;
            }
            
            .sequence-line {
                height: 20px;
                line-height: 20px;
                position: absolute;
                left: 10px;
                right: 10px;
                white-space: nowrap;
                font-family: inherit;
                font-size: inherit;
            }
            
            .sequence-base {
                display: inline-block;
                width: 8px;
                text-align: center;
                position: relative;
            }
            
            /* Base colors */
            .base-a { color: #f92672; }
            .base-t { color: #66d9ef; }
            .base-g { color: #a6e22e; }
            .base-c { color: #fd971f; }
            .base-n { color: #75715e; }
            
            /* Feature highlighting */
            .feature-gene { background: rgba(102, 217, 239, 0.2); }
            .feature-cds { background: rgba(166, 226, 46, 0.2); }
            .feature-rna { background: rgba(249, 38, 114, 0.2); }
            .feature-promoter { background: rgba(253, 151, 31, 0.2); }
            
            .editor-cursor {
                position: absolute;
                width: 2px;
                height: 20px;
                background: #ffffff;
                animation: blink 1s infinite;
                z-index: 10;
                pointer-events: none;
            }
            
            @keyframes blink {
                0%, 50% { opacity: 1; }
                51%, 100% { opacity: 0; }
            }
            
            .editor-selection {
                position: absolute;
                background: rgba(38, 79, 120, 0.4);
                z-index: 5;
                pointer-events: none;
            }
            
            .editor-scrollbar {
                width: 12px;
                background: #2d2d30;
                position: relative;
                border-left: 1px solid #3c3c3c;
            }
            
            .scrollbar-thumb {
                background: #424242;
                border-radius: 6px;
                margin: 2px;
                min-height: 20px;
                position: absolute;
                width: 8px;
                cursor: pointer;
                transition: background 0.2s;
            }
            
            .scrollbar-thumb:hover {
                background: #4f4f4f;
            }
            
            /* Minimap */
            .editor-minimap {
                width: 100px;
                background: #252526;
                border-left: 1px solid #3c3c3c;
                position: relative;
                overflow: hidden;
            }
            
            .minimap-line {
                height: 1px;
                margin: 0.5px 0;
                opacity: 0.6;
            }
            
            /* Search highlights */
            .search-highlight {
                background: rgba(255, 255, 0, 0.3);
                border: 1px solid #ffff00;
            }
            
            .search-current {
                background: rgba(255, 165, 0, 0.5);
                border: 1px solid #ffa500;
            }
            
            /* Position ruler */
            .position-ruler {
                height: 20px;
                background: #2d2d30;
                border-bottom: 1px solid #3c3c3c;
                font-size: 10px;
                color: #858585;
                display: flex;
                align-items: center;
                padding: 0 10px;
                position: relative;
            }
            
            .ruler-mark {
                position: absolute;
                top: 15px;
                width: 1px;
                height: 5px;
                background: #858585;
            }
            
            .ruler-label {
                position: absolute;
                top: 2px;
                font-size: 9px;
                transform: translateX(-50%);
            }
        `;
        
        if (!document.getElementById('vscode-sequence-editor-styles')) {
            style.id = 'vscode-sequence-editor-styles';
            document.head.appendChild(style);
        }
    }
    
    setupEventListeners() {
        // Mouse events
        this.sequenceContent.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.sequenceContent.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.sequenceContent.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.sequenceContent.addEventListener('wheel', this.handleWheel.bind(this));
        
        // Focus events
        this.sequenceContent.addEventListener('focus', this.handleFocus.bind(this));
        this.sequenceContent.addEventListener('blur', this.handleBlur.bind(this));
        
        // Keyboard events
        this.sequenceContent.addEventListener('keydown', this.handleKeyDown.bind(this));
        
        // Scrollbar events
        this.scrollbar.addEventListener('mousedown', this.handleScrollbarMouseDown.bind(this));
        
        // Resize observer
        if (window.ResizeObserver) {
            this.resizeObserver = new ResizeObserver(() => {
                this.updateDimensions();
                this.render();
            });
            this.resizeObserver.observe(this.container);
        }
    }
    
    setupKeyboardShortcuts() {
        // Common shortcuts
        this.shortcuts = {
            'Ctrl+A': () => this.selectAll(),
            'Cmd+A': () => this.selectAll(),
            'Ctrl+C': () => this.copy(),
            'Cmd+C': () => this.copy(),
            'Ctrl+F': () => this.showSearch(),
            'Cmd+F': () => this.showSearch(),
            'Ctrl+G': () => this.goToPosition(),
            'Cmd+G': () => this.goToPosition(),
            'Home': () => this.moveToLineStart(),
            'End': () => this.moveToLineEnd(),
            'Ctrl+Home': () => this.moveToStart(),
            'Cmd+Home': () => this.moveToStart(),
            'Ctrl+End': () => this.moveToEnd(),
            'Cmd+End': () => this.moveToEnd(),
            'PageUp': () => this.pageUp(),
            'PageDown': () => this.pageDown()
        };
    }
    
    updateSequence(chromosome, sequence, viewStart, viewEnd, annotations = []) {
        this.chromosome = chromosome;
        this.sequence = sequence.substring(viewStart, viewEnd);
        this.viewStart = viewStart;
        this.viewEnd = viewEnd;
        this.annotations = annotations;
        
        this.updateDimensions();
        this.render();
    }
    
    updateDimensions() {
        const rect = this.container.getBoundingClientRect();
        this.containerWidth = rect.width;
        this.containerHeight = rect.height;
        
        // Calculate visible area
        const contentRect = this.sequenceContent.getBoundingClientRect();
        this.contentWidth = contentRect.width - 20; // Account for padding
        this.contentHeight = contentRect.height;
        
        // Calculate bases per line based on available width
        this.basesPerLine = Math.floor(this.contentWidth / this.charWidth);
        this.visibleLines = Math.floor(this.contentHeight / this.lineHeight);
        
        // Calculate total lines
        this.totalLines = Math.ceil(this.sequence.length / this.basesPerLine);
        
        // Update scrollbar
        this.updateScrollbar();
    }
    
    render() {
        this.renderLineNumbers();
        this.renderSequence();
        this.renderCursor();
        this.renderSelection();
        this.renderRuler();
    }
    
    renderLineNumbers() {
        const startLine = Math.floor(this.scrollTop / this.lineHeight);
        const endLine = Math.min(startLine + this.visibleLines + this.renderBuffer, this.totalLines);
        
        this.lineNumbers.innerHTML = '';
        
        for (let i = startLine; i < endLine; i++) {
            const lineNumber = document.createElement('div');
            lineNumber.className = 'line-number';
            lineNumber.textContent = (i + 1).toString();
            lineNumber.style.top = (i * this.lineHeight - this.scrollTop) + 'px';
            this.lineNumbers.appendChild(lineNumber);
        }
    }
    
    renderSequence() {
        const startLine = Math.floor(this.scrollTop / this.lineHeight);
        const endLine = Math.min(startLine + this.visibleLines + this.renderBuffer, this.totalLines);
        
        // Clear existing content
        const existingLines = this.sequenceContent.querySelectorAll('.sequence-line');
        existingLines.forEach(line => line.remove());
        
        for (let lineIndex = startLine; lineIndex < endLine; lineIndex++) {
            const line = this.renderSequenceLine(lineIndex);
            this.sequenceContent.appendChild(line);
        }
    }
    
    renderSequenceLine(lineIndex) {
        const startPos = lineIndex * this.basesPerLine;
        const endPos = Math.min(startPos + this.basesPerLine, this.sequence.length);
        const lineSequence = this.sequence.substring(startPos, endPos);
        
        const line = document.createElement('div');
        line.className = 'sequence-line';
        line.style.top = (lineIndex * this.lineHeight - this.scrollTop) + 'px';
        line.dataset.lineIndex = lineIndex;
        
        // Render bases with features
        for (let i = 0; i < lineSequence.length; i++) {
            const base = lineSequence[i];
            const globalPos = this.viewStart + startPos + i;
            
            const baseElement = document.createElement('span');
            baseElement.className = `sequence-base base-${base.toLowerCase()}`;
            baseElement.textContent = base;
            baseElement.dataset.position = globalPos;
            
            // Add feature classes
            const features = this.getFeatureAtPosition(globalPos);
            features.forEach(feature => {
                baseElement.classList.add(`feature-${feature.type.toLowerCase()}`);
            });
            
            line.appendChild(baseElement);
        }
        
        return line;
    }
    
    renderCursor() {
        if (this.cursorPosition >= 0 && this.cursorPosition <= this.sequence.length) {
            const { line, column } = this.getLineColumnFromPosition(this.cursorPosition);
            const x = column * this.charWidth;
            const y = line * this.lineHeight - this.scrollTop;
            
            this.cursor.style.left = x + 'px';
            this.cursor.style.top = y + 'px';
            this.cursor.style.display = 'block';
        } else {
            this.cursor.style.display = 'none';
        }
    }
    
    renderSelection() {
        if (this.selectionStart >= 0 && this.selectionEnd >= 0 && this.selectionStart !== this.selectionEnd) {
            const start = Math.min(this.selectionStart, this.selectionEnd);
            const end = Math.max(this.selectionStart, this.selectionEnd);
            
            this.selection.innerHTML = '';
            
            const startLine = Math.floor(start / this.basesPerLine);
            const endLine = Math.floor(end / this.basesPerLine);
            
            for (let line = startLine; line <= endLine; line++) {
                const lineStart = line * this.basesPerLine;
                const lineEnd = Math.min(lineStart + this.basesPerLine, this.sequence.length);
                
                const selStart = Math.max(start, lineStart);
                const selEnd = Math.min(end, lineEnd);
                
                if (selStart < selEnd) {
                    const rect = document.createElement('div');
                    rect.style.position = 'absolute';
                    rect.style.left = ((selStart - lineStart) * this.charWidth) + 'px';
                    rect.style.top = (line * this.lineHeight - this.scrollTop) + 'px';
                    rect.style.width = ((selEnd - selStart) * this.charWidth) + 'px';
                    rect.style.height = this.lineHeight + 'px';
                    rect.style.background = 'rgba(38, 79, 120, 0.4)';
                    
                    this.selection.appendChild(rect);
                }
            }
            
            this.selection.style.display = 'block';
        } else {
            this.selection.style.display = 'none';
        }
    }
    
    renderRuler() {
        // Add position ruler at top
        let ruler = this.container.querySelector('.position-ruler');
        if (!ruler) {
            ruler = document.createElement('div');
            ruler.className = 'position-ruler';
            this.container.insertBefore(ruler, this.editorContainer);
        }
        
        ruler.innerHTML = '';
        
        // Add ruler marks every 10 bases
        const startPos = Math.floor(this.scrollTop / this.lineHeight) * this.basesPerLine;
        const endPos = startPos + this.visibleLines * this.basesPerLine;
        
        for (let pos = startPos; pos <= endPos; pos += 10) {
            if (pos % 50 === 0) {
                const mark = document.createElement('div');
                mark.className = 'ruler-mark';
                mark.style.left = ((pos - startPos) % this.basesPerLine) * this.charWidth + 'px';
                ruler.appendChild(mark);
                
                const label = document.createElement('div');
                label.className = 'ruler-label';
                label.textContent = (this.viewStart + pos + 1).toString();
                label.style.left = ((pos - startPos) % this.basesPerLine) * this.charWidth + 'px';
                ruler.appendChild(label);
            }
        }
    }
    
    // Event handlers
    handleMouseDown(e) {
        this.isMouseDown = true;
        this.sequenceContent.focus();
        
        const position = this.getPositionFromMouseEvent(e);
        this.setCursorPosition(position);
        this.selectionStart = position;
        this.selectionEnd = position;
        
        this.render();
        e.preventDefault();
    }
    
    handleMouseMove(e) {
        if (this.isMouseDown) {
            this.isDragging = true;
            const position = this.getPositionFromMouseEvent(e);
            this.selectionEnd = position;
            this.render();
        }
    }
    
    handleMouseUp(e) {
        this.isMouseDown = false;
        this.isDragging = false;
        
        if (this.selectionStart === this.selectionEnd) {
            this.clearSelection();
        }
    }
    
    handleWheel(e) {
        const delta = e.deltaY;
        this.scrollTop = Math.max(0, Math.min(
            this.scrollTop + delta,
            (this.totalLines - this.visibleLines) * this.lineHeight
        ));
        
        this.render();
        this.updateScrollbar();
        e.preventDefault();
    }
    
    handleKeyDown(e) {
        const key = e.key;
        const ctrl = e.ctrlKey || e.metaKey;
        const shift = e.shiftKey;
        
        // Handle shortcuts
        const shortcut = (ctrl ? 'Ctrl+' : '') + (e.metaKey ? 'Cmd+' : '') + key;
        if (this.shortcuts[shortcut]) {
            this.shortcuts[shortcut]();
            e.preventDefault();
            return;
        }
        
        // Handle navigation
        switch (key) {
            case 'ArrowLeft':
                this.moveCursor(-1, shift);
                break;
            case 'ArrowRight':
                this.moveCursor(1, shift);
                break;
            case 'ArrowUp':
                this.moveCursor(-this.basesPerLine, shift);
                break;
            case 'ArrowDown':
                this.moveCursor(this.basesPerLine, shift);
                break;
            default:
                return;
        }
        
        e.preventDefault();
    }
    
    // Utility methods
    getPositionFromMouseEvent(e) {
        const rect = this.sequenceContent.getBoundingClientRect();
        const x = e.clientX - rect.left - 10; // Account for padding
        const y = e.clientY - rect.top + this.scrollTop;
        
        const line = Math.floor(y / this.lineHeight);
        const column = Math.floor(x / this.charWidth);
        
        return Math.max(0, Math.min(line * this.basesPerLine + column, this.sequence.length));
    }
    
    getLineColumnFromPosition(position) {
        const line = Math.floor(position / this.basesPerLine);
        const column = position % this.basesPerLine;
        return { line, column };
    }
    
    getFeatureAtPosition(position) {
        return this.annotations.filter(feature => 
            position >= feature.start && position <= feature.end
        );
    }
    
    setCursorPosition(position) {
        this.cursorPosition = Math.max(0, Math.min(position, this.sequence.length));
        this.ensureCursorVisible();
    }
    
    ensureCursorVisible() {
        const { line } = this.getLineColumnFromPosition(this.cursorPosition);
        const y = line * this.lineHeight;
        
        if (y < this.scrollTop) {
            this.scrollTop = y;
        } else if (y >= this.scrollTop + this.contentHeight) {
            this.scrollTop = y - this.contentHeight + this.lineHeight;
        }
        
        this.updateScrollbar();
    }
    
    moveCursor(delta, extend = false) {
        const newPosition = this.cursorPosition + delta;
        this.setCursorPosition(newPosition);
        
        if (extend) {
            if (this.selectionStart < 0) {
                this.selectionStart = this.cursorPosition - delta;
            }
            this.selectionEnd = this.cursorPosition;
        } else {
            this.clearSelection();
        }
        
        this.render();
    }
    
    clearSelection() {
        this.selectionStart = -1;
        this.selectionEnd = -1;
    }
    
    updateScrollbar() {
        if (this.totalLines <= this.visibleLines) {
            this.scrollbar.style.display = 'none';
            return;
        }
        
        this.scrollbar.style.display = 'block';
        const thumb = this.scrollbar.querySelector('.scrollbar-thumb');
        
        const thumbHeight = Math.max(20, (this.visibleLines / this.totalLines) * this.containerHeight);
        const thumbTop = (this.scrollTop / this.lineHeight / this.totalLines) * this.containerHeight;
        
        thumb.style.height = thumbHeight + 'px';
        thumb.style.top = thumbTop + 'px';
    }
    
    // Public API methods
    selectAll() {
        this.selectionStart = 0;
        this.selectionEnd = this.sequence.length;
        this.render();
    }
    
    copy() {
        if (this.selectionStart >= 0 && this.selectionEnd >= 0) {
            const start = Math.min(this.selectionStart, this.selectionEnd);
            const end = Math.max(this.selectionStart, this.selectionEnd);
            const selectedText = this.sequence.substring(start, end);
            
            navigator.clipboard.writeText(selectedText).then(() => {
                this.genomeBrowser.showNotification('Sequence copied to clipboard', 'success');
            });
        }
    }
    
    goToPosition(position = null) {
        if (position === null) {
            // Show dialog
            const pos = prompt('Go to position (1-based):');
            if (pos) {
                position = parseInt(pos) - 1 + this.viewStart;
            }
        }
        
        if (position !== null) {
            const relativePos = position - this.viewStart;
            if (relativePos >= 0 && relativePos < this.sequence.length) {
                this.setCursorPosition(relativePos);
                this.render();
            }
        }
    }
    
    search(query) {
        // Implementation for search functionality
        const results = [];
        const upperQuery = query.toUpperCase();
        const upperSequence = this.sequence.toUpperCase();
        
        let index = 0;
        while ((index = upperSequence.indexOf(upperQuery, index)) !== -1) {
            results.push({
                start: index,
                end: index + query.length,
                position: this.viewStart + index
            });
            index++;
        }
        
        return results;
    }
    
    highlightSearchResults(results) {
        // Remove existing highlights
        this.sequenceContent.querySelectorAll('.search-highlight').forEach(el => {
            el.classList.remove('search-highlight', 'search-current');
        });
        
        // Add new highlights
        results.forEach((result, index) => {
            const { line: startLine, column: startCol } = this.getLineColumnFromPosition(result.start);
            const { line: endLine, column: endCol } = this.getLineColumnFromPosition(result.end);
            
            // For now, only highlight single-line results
            if (startLine === endLine) {
                const lineElement = this.sequenceContent.querySelector(`[data-line-index="${startLine}"]`);
                if (lineElement) {
                    const bases = lineElement.querySelectorAll('.sequence-base');
                    for (let i = startCol; i < endCol && i < bases.length; i++) {
                        bases[i].classList.add('search-highlight');
                        if (index === 0) {
                            bases[i].classList.add('search-current');
                        }
                    }
                }
            }
        });
    }
    
    // Navigation methods
    moveToLineStart() {
        const { line } = this.getLineColumnFromPosition(this.cursorPosition);
        this.setCursorPosition(line * this.basesPerLine);
        this.render();
    }
    
    moveToLineEnd() {
        const { line } = this.getLineColumnFromPosition(this.cursorPosition);
        const lineEnd = Math.min((line + 1) * this.basesPerLine, this.sequence.length);
        this.setCursorPosition(lineEnd);
        this.render();
    }
    
    moveToStart() {
        this.setCursorPosition(0);
        this.render();
    }
    
    moveToEnd() {
        this.setCursorPosition(this.sequence.length);
        this.render();
    }
    
    pageUp() {
        this.scrollTop = Math.max(0, this.scrollTop - this.contentHeight);
        this.render();
        this.updateScrollbar();
    }
    
    pageDown() {
        const maxScroll = (this.totalLines - this.visibleLines) * this.lineHeight;
        this.scrollTop = Math.min(maxScroll, this.scrollTop + this.contentHeight);
        this.render();
        this.updateScrollbar();
    }
    
    showSearch() {
        // Integration with existing search functionality
        if (this.genomeBrowser.showSearchModal) {
            this.genomeBrowser.showSearchModal();
        }
    }
    
    handleFocus() {
        this.cursor.style.display = 'block';
    }
    
    handleBlur() {
        this.cursor.style.display = 'none';
    }
    
    handleScrollbarMouseDown(e) {
        if (e.target.classList.contains('scrollbar-thumb')) {
            // Handle thumb dragging
            const startY = e.clientY;
            const startScrollTop = this.scrollTop;
            
            const handleMouseMove = (e) => {
                const deltaY = e.clientY - startY;
                const scrollRatio = deltaY / this.containerHeight;
                const newScrollTop = startScrollTop + (scrollRatio * this.totalLines * this.lineHeight);
                
                this.scrollTop = Math.max(0, Math.min(
                    newScrollTop,
                    (this.totalLines - this.visibleLines) * this.lineHeight
                ));
                
                this.render();
                this.updateScrollbar();
            };
            
            const handleMouseUp = () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
            
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        } else {
            // Click on scrollbar track
            const rect = this.scrollbar.getBoundingClientRect();
            const clickY = e.clientY - rect.top;
            const scrollRatio = clickY / rect.height;
            
            this.scrollTop = scrollRatio * (this.totalLines - this.visibleLines) * this.lineHeight;
            this.scrollTop = Math.max(0, Math.min(
                this.scrollTop,
                (this.totalLines - this.visibleLines) * this.lineHeight
            ));
            
            this.render();
            this.updateScrollbar();
        }
    }
    
    // Cleanup
    destroy() {
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        // Remove event listeners
        this.sequenceContent.removeEventListener('mousedown', this.handleMouseDown);
        this.sequenceContent.removeEventListener('mousemove', this.handleMouseMove);
        this.sequenceContent.removeEventListener('mouseup', this.handleMouseUp);
        this.sequenceContent.removeEventListener('wheel', this.handleWheel);
        this.sequenceContent.removeEventListener('focus', this.handleFocus);
        this.sequenceContent.removeEventListener('blur', this.handleBlur);
        this.sequenceContent.removeEventListener('keydown', this.handleKeyDown);
        this.scrollbar.removeEventListener('mousedown', this.handleScrollbarMouseDown);
        
        this.container.innerHTML = '';
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = VSCodeSequenceEditor;
} else if (typeof window !== 'undefined') {
    window.VSCodeSequenceEditor = VSCodeSequenceEditor;
} 