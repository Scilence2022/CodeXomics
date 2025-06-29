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
        this.charWidth = 9; // Adjusted for better monospace alignment
        this.basesPerLine = 80;
        this.scrollTop = 0;
        this.visibleLines = 20;
        this.currentLine = -1; // Track current line for highlighting
        
        // Settings
        this.settings = {
            fontSize: 14,
            fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', 'Menlo', 'Consolas', 'DejaVu Sans Mono', 'Ubuntu Mono', 'Courier New', monospace",
            backgroundColor: '#1e1e1e',
            textColor: '#d4d4d4',
            baseColors: {
                a: '#f92672',
                t: '#66d9ef', 
                g: '#a6e22e',
                c: '#fd971f',
                n: '#75715e'
            },
            lineHighlightColor: 'rgba(255, 255, 255, 0.05)',
            cursorColor: '#ffffff',
            selectionColor: 'rgba(38, 79, 120, 0.4)',
            rulerColor: '#858585',
            showFeatureBackgrounds: false,
            showLineHighlight: true,
            showCursorPosition: true
        };
        
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
        
        // Create position ruler
        this.positionRuler = document.createElement('div');
        this.positionRuler.className = 'position-ruler';
        
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
        
        // Create line highlight
        this.lineHighlight = document.createElement('div');
        this.lineHighlight.className = 'line-highlight';
        
        // Create scrollbar
        this.scrollbar = document.createElement('div');
        this.scrollbar.className = 'editor-scrollbar';
        const scrollThumb = document.createElement('div');
        scrollThumb.className = 'scrollbar-thumb';
        this.scrollbar.appendChild(scrollThumb);
        
        // Assemble editor
        this.container.appendChild(this.positionRuler);
        this.editorContainer.appendChild(this.lineNumbers);
        this.editorContainer.appendChild(this.sequenceContent);
        this.sequenceContent.appendChild(this.lineHighlight);
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
                min-height: 400px;
                font-family: ${this.settings.fontFamily};
                font-size: ${this.settings.fontSize}px;
                line-height: 20px;
                background: ${this.settings.backgroundColor};
                color: ${this.settings.textColor};
                position: relative;
                overflow: hidden;
                border: 1px solid #3c3c3c;
                border-radius: 4px;
                box-sizing: border-box;
            }
            
            .editor-container {
                display: flex;
                height: calc(100% - 20px);
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
                font-family: ${this.settings.fontFamily};
                font-size: ${this.settings.fontSize}px;
                letter-spacing: 0px;
            }
            
            .sequence-base {
                display: inline-block;
                width: 9px;
                text-align: center;
                position: relative;
                font-family: inherit;
            }
            
            /* Base colors */
            .base-a { color: ${this.settings.baseColors.a}; }
            .base-t { color: ${this.settings.baseColors.t}; }
            .base-g { color: ${this.settings.baseColors.g}; }
            .base-c { color: ${this.settings.baseColors.c}; }
            .base-n { color: ${this.settings.baseColors.n}; }
            
            /* Feature highlighting - disabled by default */
            .feature-gene.show-background { background: rgba(102, 217, 239, 0.2); }
            .feature-cds.show-background { background: rgba(166, 226, 46, 0.2); }
            .feature-rna.show-background { background: rgba(249, 38, 114, 0.2); }
            .feature-promoter.show-background { background: rgba(253, 151, 31, 0.2); }
            
            /* Line highlighting */
            .line-highlight {
                position: absolute;
                left: 0;
                right: 0;
                height: 20px;
                background: rgba(255, 255, 255, 0.05);
                z-index: 1;
                pointer-events: none;
                display: none;
            }
            
            .editor-cursor {
                position: absolute;
                width: 2px;
                height: 20px;
                background: ${this.settings.cursorColor};
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
                background: ${this.settings.selectionColor};
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
            
            /* Cursor position indicator in ruler */
            .cursor-position-indicator {
                position: absolute;
                top: 0;
                width: 2px;
                height: 20px;
                background: #ffff00;
                z-index: 10;
                pointer-events: none;
            }
            
            .cursor-position-label {
                position: absolute;
                top: -15px;
                font-size: 10px;
                color: #ffff00;
                font-weight: bold;
                transform: translateX(-50%);
                background: rgba(0, 0, 0, 0.8);
                padding: 1px 4px;
                border-radius: 2px;
                white-space: nowrap;
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
        this.sequenceContent.addEventListener('contextmenu', this.handleContextMenu.bind(this));
        
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
        
        // Measure character width with actual font
        this.measureCharacterWidth();
        this.updateDimensions();
        this.render();
    }
    
    measureCharacterWidth() {
        // Create a test element to measure character width
        const testElement = document.createElement('span');
        testElement.textContent = 'ATCGATCGATCG'; // 12 characters
        testElement.style.fontFamily = this.settings.fontFamily;
        testElement.style.fontSize = this.settings.fontSize + 'px';
        testElement.style.visibility = 'hidden';
        testElement.style.position = 'absolute';
        testElement.style.whiteSpace = 'nowrap';
        
        this.sequenceContent.appendChild(testElement);
        const width = testElement.offsetWidth / 12; // Divide by number of characters
        this.sequenceContent.removeChild(testElement);
        
        this.charWidth = Math.ceil(width); // Round up for safety
    }
    
    updateDimensions() {
        const rect = this.container.getBoundingClientRect();
        this.containerWidth = rect.width;
        this.containerHeight = Math.max(rect.height, 400); // Ensure minimum height
        
        // If container height is very small (like 0), use a reasonable default
        if (this.containerHeight < 100) {
            this.containerHeight = 500;
        }
        
        // Calculate visible area
        const contentRect = this.sequenceContent.getBoundingClientRect();
        this.contentWidth = Math.max(contentRect.width - 20, 600); // Account for padding, minimum width
        this.contentHeight = Math.max(this.containerHeight - 60, 340); // Account for ruler, borders, padding
        
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
        this.renderLineHighlight();
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
            
            // Add feature classes (only show background if enabled)
            const features = this.getFeatureAtPosition(globalPos);
            features.forEach(feature => {
                baseElement.classList.add(`feature-${feature.type.toLowerCase()}`);
                if (this.settings.showFeatureBackgrounds) {
                    baseElement.classList.add('show-background');
                }
            });
            
            line.appendChild(baseElement);
        }
        
        return line;
    }
    
    renderLineHighlight() {
        if (!this.settings.showLineHighlight) {
            this.lineHighlight.style.display = 'none';
            return;
        }
        
        const { line } = this.getLineColumnFromPosition(this.cursorPosition);
        const y = line * this.lineHeight - this.scrollTop;
        
        // Only show highlight if line is visible
        if (y >= 0 && y < this.contentHeight) {
            this.lineHighlight.style.top = y + 'px';
            this.lineHighlight.style.background = this.settings.lineHighlightColor;
            this.lineHighlight.style.display = 'block';
            this.currentLine = line;
        } else {
            this.lineHighlight.style.display = 'none';
            this.currentLine = -1;
        }
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
        ruler.style.background = this.settings.backgroundColor;
        ruler.style.color = this.settings.rulerColor;
        
        // Get cursor line for dynamic ruler positioning
        const { line: cursorLine, column: cursorColumn } = this.getLineColumnFromPosition(this.cursorPosition);
        const currentScrollLine = Math.floor(this.scrollTop / this.lineHeight);
        
        // Determine which line to show in ruler (cursor line if visible, otherwise current scroll position)
        let displayLine = currentScrollLine;
        if (cursorLine >= currentScrollLine && cursorLine < currentScrollLine + this.visibleLines) {
            displayLine = cursorLine;
        }
        
        const lineStartPos = displayLine * this.basesPerLine;
        const lineEndPos = Math.min(lineStartPos + this.basesPerLine, this.sequence.length);
        
        // Add ruler marks every 10 bases for the display line
        for (let pos = lineStartPos; pos < lineEndPos; pos += 10) {
            if (pos % 50 === 0 || pos === lineStartPos) {
                const mark = document.createElement('div');
                mark.className = 'ruler-mark';
                mark.style.left = ((pos - lineStartPos) * this.charWidth + 70) + 'px'; // Offset for line numbers
                ruler.appendChild(mark);
                
                const label = document.createElement('div');
                label.className = 'ruler-label';
                label.textContent = (this.viewStart + pos + 1).toString();
                label.style.left = ((pos - lineStartPos) * this.charWidth + 70) + 'px';
                ruler.appendChild(label);
            }
        }
        
        // Add cursor position indicator if enabled and cursor is on the display line
        if (this.settings.showCursorPosition && cursorLine === displayLine) {
            const cursorIndicator = document.createElement('div');
            cursorIndicator.className = 'cursor-position-indicator';
            cursorIndicator.style.left = (cursorColumn * this.charWidth + 70) + 'px';
            ruler.appendChild(cursorIndicator);
            
            const cursorLabel = document.createElement('div');
            cursorLabel.className = 'cursor-position-label';
            cursorLabel.textContent = `${this.viewStart + this.cursorPosition + 1}`;
            cursorLabel.style.left = (cursorColumn * this.charWidth + 70) + 'px';
            ruler.appendChild(cursorLabel);
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
    
    handleContextMenu(e) {
        e.preventDefault();
        
        // Create context menu
        const menu = document.createElement('div');
        menu.className = 'sequence-context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${e.clientX}px;
            top: ${e.clientY}px;
            background: #2d2d30;
            border: 1px solid #3c3c3c;
            border-radius: 4px;
            padding: 4px 0;
            box-shadow: 0 4px 12px rgba(0, 0, 0, 0.5);
            z-index: 10000;
            min-width: 150px;
            color: #d4d4d4;
            font-size: 13px;
        `;
        
        const menuItems = [
            { text: 'Copy', action: () => this.copy(), enabled: this.selectionStart !== this.selectionEnd },
            { text: 'Select All', action: () => this.selectAll() },
            { text: '---' },
            { text: 'Go to Position...', action: () => this.goToPosition() },
            { text: 'Search...', action: () => this.showSearch() },
            { text: '---' },
            { text: 'Settings...', action: () => this.showSettingsDialog() }
        ];
        
        menuItems.forEach(item => {
            if (item.text === '---') {
                const separator = document.createElement('div');
                separator.style.cssText = `
                    height: 1px;
                    background: #3c3c3c;
                    margin: 4px 0;
                `;
                menu.appendChild(separator);
            } else {
                const menuItem = document.createElement('div');
                menuItem.textContent = item.text;
                menuItem.style.cssText = `
                    padding: 6px 16px;
                    cursor: ${item.enabled !== false ? 'pointer' : 'default'};
                    color: ${item.enabled !== false ? '#d4d4d4' : '#666'};
                `;
                
                if (item.enabled !== false) {
                    menuItem.addEventListener('mouseenter', () => {
                        menuItem.style.background = '#404040';
                    });
                    
                    menuItem.addEventListener('mouseleave', () => {
                        menuItem.style.background = 'transparent';
                    });
                    
                    menuItem.addEventListener('click', () => {
                        item.action();
                        menu.remove();
                    });
                }
                
                menu.appendChild(menuItem);
            }
        });
        
        document.body.appendChild(menu);
        
        // Remove menu on click outside
        const removeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', removeMenu);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', removeMenu);
        }, 0);
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
    
    // Settings methods
    updateSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        this.applySettings();
        this.render();
    }
    
    applySettings() {
        // Update CSS variables and styles
        this.updateEditorStyles();
        
        // Re-measure character width if font changed
        if (this.sequence) {
            this.measureCharacterWidth();
            this.updateDimensions();
        }
    }
    
    updateEditorStyles() {
        // Update the existing style element
        const existingStyle = document.getElementById('vscode-sequence-editor-styles');
        if (existingStyle) {
            existingStyle.remove();
        }
        this.addEditorStyles();
    }
    
    showSettingsDialog() {
        const dialog = this.createSettingsDialog();
        document.body.appendChild(dialog);
        dialog.style.display = 'flex';
    }
    
    createSettingsDialog() {
        const modal = document.createElement('div');
        modal.className = 'sequence-settings-modal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
        `;
        
        const dialog = document.createElement('div');
        dialog.className = 'settings-dialog';
        dialog.style.cssText = `
            background: #2d2d30;
            color: #d4d4d4;
            border-radius: 8px;
            padding: 20px;
            width: 500px;
            max-height: 80vh;
            overflow-y: auto;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
        `;
        
        dialog.innerHTML = `
            <h3 style="margin-top: 0; color: #ffffff; border-bottom: 1px solid #3c3c3c; padding-bottom: 10px;">Sequence Editor Settings</h3>
            
            <div class="setting-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Font Family:</label>
                <input type="text" id="fontFamily" value="${this.settings.fontFamily}" 
                       style="width: 100%; padding: 8px; background: #1e1e1e; color: #d4d4d4; border: 1px solid #3c3c3c; border-radius: 4px;">
            </div>
            
            <div class="setting-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Font Size:</label>
                <input type="number" id="fontSize" value="${this.settings.fontSize}" min="8" max="24"
                       style="width: 100%; padding: 8px; background: #1e1e1e; color: #d4d4d4; border: 1px solid #3c3c3c; border-radius: 4px;">
            </div>
            
            <div class="setting-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Background Color:</label>
                <input type="color" id="backgroundColor" value="${this.settings.backgroundColor}"
                       style="width: 100%; height: 40px; padding: 4px; background: #1e1e1e; border: 1px solid #3c3c3c; border-radius: 4px;">
            </div>
            
            <div class="setting-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Text Color:</label>
                <input type="color" id="textColor" value="${this.settings.textColor}"
                       style="width: 100%; height: 40px; padding: 4px; background: #1e1e1e; border: 1px solid #3c3c3c; border-radius: 4px;">
            </div>
            
            <div class="setting-group" style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px; color: #ffffff;">Base Colors:</h4>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
                    <div>
                        <label>A (Adenine):</label>
                        <input type="color" id="baseA" value="${this.settings.baseColors.a}" style="width: 100%; height: 30px;">
                    </div>
                    <div>
                        <label>T (Thymine):</label>
                        <input type="color" id="baseT" value="${this.settings.baseColors.t}" style="width: 100%; height: 30px;">
                    </div>
                    <div>
                        <label>G (Guanine):</label>
                        <input type="color" id="baseG" value="${this.settings.baseColors.g}" style="width: 100%; height: 30px;">
                    </div>
                    <div>
                        <label>C (Cytosine):</label>
                        <input type="color" id="baseC" value="${this.settings.baseColors.c}" style="width: 100%; height: 30px;">
                    </div>
                </div>
            </div>
            
            <div class="setting-group" style="margin-bottom: 20px;">
                <label style="display: block; margin-bottom: 5px; font-weight: bold;">Line Highlight Color:</label>
                <input type="color" id="lineHighlightColor" value="#ffffff" data-alpha="0.05"
                       style="width: 100%; height: 40px; padding: 4px; background: #1e1e1e; border: 1px solid #3c3c3c; border-radius: 4px;">
                <input type="range" id="lineHighlightOpacity" min="0" max="20" value="5" 
                       style="width: 100%; margin-top: 5px;">
                <small>Opacity: <span id="opacityValue">5%</span></small>
            </div>
            
            <div class="setting-group" style="margin-bottom: 20px;">
                <h4 style="margin-bottom: 10px; color: #ffffff;">Display Options:</h4>
                <label style="display: block; margin-bottom: 8px;">
                    <input type="checkbox" id="showLineHighlight" ${this.settings.showLineHighlight ? 'checked' : ''}>
                    Show line highlighting
                </label>
                <label style="display: block; margin-bottom: 8px;">
                    <input type="checkbox" id="showFeatureBackgrounds" ${this.settings.showFeatureBackgrounds ? 'checked' : ''}>
                    Show feature backgrounds
                </label>
                <label style="display: block; margin-bottom: 8px;">
                    <input type="checkbox" id="showCursorPosition" ${this.settings.showCursorPosition ? 'checked' : ''}>
                    Show cursor position in ruler
                </label>
            </div>
            
            <div style="text-align: right; border-top: 1px solid #3c3c3c; padding-top: 15px;">
                <button id="resetSettings" style="background: #666; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-right: 10px; cursor: pointer;">Reset to Default</button>
                <button id="cancelSettings" style="background: #666; color: white; border: none; padding: 8px 16px; border-radius: 4px; margin-right: 10px; cursor: pointer;">Cancel</button>
                <button id="applySettings" style="background: #007acc; color: white; border: none; padding: 8px 16px; border-radius: 4px; cursor: pointer;">Apply</button>
            </div>
        `;
        
        modal.appendChild(dialog);
        
        // Event listeners for settings dialog
        const opacitySlider = dialog.querySelector('#lineHighlightOpacity');
        const opacityValue = dialog.querySelector('#opacityValue');
        
        opacitySlider.addEventListener('input', () => {
            opacityValue.textContent = opacitySlider.value + '%';
        });
        
        dialog.querySelector('#resetSettings').addEventListener('click', () => {
            this.resetToDefaultSettings();
            modal.remove();
        });
        
        dialog.querySelector('#cancelSettings').addEventListener('click', () => {
            modal.remove();
        });
        
        dialog.querySelector('#applySettings').addEventListener('click', () => {
            this.applySettingsFromDialog(dialog);
            modal.remove();
        });
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        return modal;
    }
    
    applySettingsFromDialog(dialog) {
        const newSettings = {
            fontFamily: dialog.querySelector('#fontFamily').value,
            fontSize: parseInt(dialog.querySelector('#fontSize').value),
            backgroundColor: dialog.querySelector('#backgroundColor').value,
            textColor: dialog.querySelector('#textColor').value,
            baseColors: {
                a: dialog.querySelector('#baseA').value,
                t: dialog.querySelector('#baseT').value,
                g: dialog.querySelector('#baseG').value,
                c: dialog.querySelector('#baseC').value,
                n: this.settings.baseColors.n
            },
            lineHighlightColor: this.hexToRgba(dialog.querySelector('#lineHighlightColor').value, 
                                              dialog.querySelector('#lineHighlightOpacity').value / 100),
            showLineHighlight: dialog.querySelector('#showLineHighlight').checked,
            showFeatureBackgrounds: dialog.querySelector('#showFeatureBackgrounds').checked,
            showCursorPosition: dialog.querySelector('#showCursorPosition').checked
        };
        
        this.updateSettings(newSettings);
    }
    
    hexToRgba(hex, alpha) {
        const r = parseInt(hex.slice(1, 3), 16);
        const g = parseInt(hex.slice(3, 5), 16);
        const b = parseInt(hex.slice(5, 7), 16);
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    resetToDefaultSettings() {
        const defaultSettings = {
            fontSize: 14,
            fontFamily: "'SF Mono', 'Monaco', 'Inconsolata', 'Roboto Mono', 'Source Code Pro', 'Menlo', 'Consolas', 'DejaVu Sans Mono', 'Ubuntu Mono', 'Courier New', monospace",
            backgroundColor: '#1e1e1e',
            textColor: '#d4d4d4',
            baseColors: {
                a: '#f92672',
                t: '#66d9ef', 
                g: '#a6e22e',
                c: '#fd971f',
                n: '#75715e'
            },
            lineHighlightColor: 'rgba(255, 255, 255, 0.05)',
            cursorColor: '#ffffff',
            selectionColor: 'rgba(38, 79, 120, 0.4)',
            rulerColor: '#858585',
            showFeatureBackgrounds: false,
            showLineHighlight: true,
            showCursorPosition: true
        };
        
        this.updateSettings(defaultSettings);
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