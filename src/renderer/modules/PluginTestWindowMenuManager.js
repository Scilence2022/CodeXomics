/**
 * PluginTestWindowMenuManager - Provides copy/paste functionality for plugin test windows
 * Implements standalone menu system with keyboard shortcuts and context menus
 * 
 * @version 1.0.0
 * @author GenomeAIStudio Team
 */

class PluginTestWindowMenuManager {
    constructor(testWindow) {
        this.testWindow = testWindow;
        this.doc = testWindow.document;
        
        this.initializeMenuSystem();
        this.initializeKeyboardShortcuts();
        this.initializeContextMenu();
        
        console.log('✅ PluginTestWindowMenuManager initialized with copy/paste support');
    }

    /**
     * Initialize menu bar for the test window
     */
    initializeMenuSystem() {
        // Create menu bar container
        const menuBar = this.doc.createElement('div');
        menuBar.id = 'plugin-test-menu-bar';
        menuBar.innerHTML = `
            <style>
                #plugin-test-menu-bar {
                    position: sticky;
                    top: 0;
                    z-index: 10000;
                    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                    color: white;
                    padding: 8px 16px;
                    display: flex;
                    align-items: center;
                    gap: 20px;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.15);
                    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
                    font-size: 13px;
                    user-select: none;
                }

                .menu-section {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .menu-item {
                    background: rgba(255, 255, 255, 0.1);
                    border: 1px solid rgba(255, 255, 255, 0.2);
                    color: white;
                    padding: 6px 12px;
                    border-radius: 6px;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    font-size: 13px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .menu-item:hover {
                    background: rgba(255, 255, 255, 0.2);
                    transform: translateY(-1px);
                }

                .menu-item:active {
                    transform: translateY(0);
                }

                .menu-item i {
                    font-size: 14px;
                }

                .menu-kbd {
                    background: rgba(0, 0, 0, 0.2);
                    padding: 2px 6px;
                    border-radius: 3px;
                    font-size: 11px;
                    margin-left: 4px;
                    font-family: 'Monaco', 'Courier New', monospace;
                }

                .menu-divider {
                    width: 1px;
                    height: 20px;
                    background: rgba(255, 255, 255, 0.3);
                }

                /* Context menu styles */
                #plugin-test-context-menu {
                    position: fixed;
                    background: white;
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    padding: 4px;
                    z-index: 10001;
                    min-width: 180px;
                    display: none;
                }

                #plugin-test-context-menu.show {
                    display: block;
                }

                .context-menu-item {
                    padding: 8px 12px;
                    cursor: pointer;
                    border-radius: 4px;
                    transition: background 0.15s ease;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    color: #2d3748;
                    font-size: 13px;
                }

                .context-menu-item:hover {
                    background: #f7fafc;
                }

                .context-menu-item.disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .context-menu-item.disabled:hover {
                    background: transparent;
                }

                .context-menu-item-label {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .context-menu-kbd {
                    color: #718096;
                    font-size: 11px;
                    font-family: 'Monaco', 'Courier New', monospace;
                }

                .context-menu-divider {
                    height: 1px;
                    background: #e2e8f0;
                    margin: 4px 0;
                }

                /* Notification toast */
                .copy-notification {
                    position: fixed;
                    top: 80px;
                    right: 20px;
                    background: #48bb78;
                    color: white;
                    padding: 12px 20px;
                    border-radius: 8px;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    z-index: 10002;
                    animation: slideIn 0.3s ease, slideOut 0.3s ease 2.7s;
                    pointer-events: none;
                }

                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }

                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                }
            </style>

            <div class="menu-section">
                <button class="menu-item" id="menu-copy" title="Copy selected text">
                    <i class="fas fa-copy"></i>
                    Copy
                    <span class="menu-kbd">${this.getModifierKey()}+C</span>
                </button>
                <button class="menu-item" id="menu-paste" title="Paste from clipboard">
                    <i class="fas fa-paste"></i>
                    Paste
                    <span class="menu-kbd">${this.getModifierKey()}+V</span>
                </button>
                <button class="menu-item" id="menu-cut" title="Cut selected text">
                    <i class="fas fa-cut"></i>
                    Cut
                    <span class="menu-kbd">${this.getModifierKey()}+X</span>
                </button>
            </div>

            <div class="menu-divider"></div>

            <div class="menu-section">
                <button class="menu-item" id="menu-select-all" title="Select all content">
                    <i class="fas fa-text-width"></i>
                    Select All
                    <span class="menu-kbd">${this.getModifierKey()}+A</span>
                </button>
            </div>

            <div class="menu-divider"></div>

            <div class="menu-section">
                <button class="menu-item" id="menu-refresh" title="Refresh page">
                    <i class="fas fa-sync-alt"></i>
                    Refresh
                    <span class="menu-kbd">${this.getModifierKey()}+R</span>
                </button>
            </div>
        `;

        // Insert menu bar at the top of the document
        this.doc.body.insertBefore(menuBar, this.doc.body.firstChild);

        // Attach menu event listeners
        this.attachMenuEventListeners();
    }

    /**
     * Get the platform-specific modifier key label
     */
    getModifierKey() {
        return navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'Cmd' : 'Ctrl';
    }

    /**
     * Get the platform-specific modifier key code
     */
    getModifierKeyCode() {
        return navigator.platform.toUpperCase().indexOf('MAC') >= 0 ? 'metaKey' : 'ctrlKey';
    }

    /**
     * Attach event listeners to menu items
     */
    attachMenuEventListeners() {
        this.doc.getElementById('menu-copy').addEventListener('click', () => this.copySelection());
        this.doc.getElementById('menu-paste').addEventListener('click', () => this.pasteFromClipboard());
        this.doc.getElementById('menu-cut').addEventListener('click', () => this.cutSelection());
        this.doc.getElementById('menu-select-all').addEventListener('click', () => this.selectAll());
        this.doc.getElementById('menu-refresh').addEventListener('click', () => this.testWindow.location.reload());
    }

    /**
     * Initialize keyboard shortcuts
     */
    initializeKeyboardShortcuts() {
        this.doc.addEventListener('keydown', (e) => {
            const modifierKey = this.getModifierKeyCode();
            
            // Copy: Ctrl/Cmd + C
            if (e[modifierKey] && e.key.toLowerCase() === 'c' && !e.shiftKey) {
                e.preventDefault();
                this.copySelection();
            }
            
            // Paste: Ctrl/Cmd + V
            else if (e[modifierKey] && e.key.toLowerCase() === 'v' && !e.shiftKey) {
                e.preventDefault();
                this.pasteFromClipboard();
            }
            
            // Cut: Ctrl/Cmd + X
            else if (e[modifierKey] && e.key.toLowerCase() === 'x' && !e.shiftKey) {
                e.preventDefault();
                this.cutSelection();
            }
            
            // Select All: Ctrl/Cmd + A
            else if (e[modifierKey] && e.key.toLowerCase() === 'a' && !e.shiftKey) {
                e.preventDefault();
                this.selectAll();
            }

            // Refresh: Ctrl/Cmd + R
            else if (e[modifierKey] && e.key.toLowerCase() === 'r' && !e.shiftKey) {
                e.preventDefault();
                this.testWindow.location.reload();
            }
        });
    }

    /**
     * Initialize context menu (right-click menu)
     */
    initializeContextMenu() {
        // Create context menu
        const contextMenu = this.doc.createElement('div');
        contextMenu.id = 'plugin-test-context-menu';
        contextMenu.innerHTML = `
            <div class="context-menu-item" id="context-copy">
                <span class="context-menu-item-label">
                    <i class="fas fa-copy"></i>
                    Copy
                </span>
                <span class="context-menu-kbd">${this.getModifierKey()}+C</span>
            </div>
            <div class="context-menu-item" id="context-paste">
                <span class="context-menu-item-label">
                    <i class="fas fa-paste"></i>
                    Paste
                </span>
                <span class="context-menu-kbd">${this.getModifierKey()}+V</span>
            </div>
            <div class="context-menu-item" id="context-cut">
                <span class="context-menu-item-label">
                    <i class="fas fa-cut"></i>
                    Cut
                </span>
                <span class="context-menu-kbd">${this.getModifierKey()}+X</span>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-item" id="context-select-all">
                <span class="context-menu-item-label">
                    <i class="fas fa-text-width"></i>
                    Select All
                </span>
                <span class="context-menu-kbd">${this.getModifierKey()}+A</span>
            </div>
        `;

        this.doc.body.appendChild(contextMenu);

        // Show context menu on right-click
        this.doc.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e.clientX, e.clientY);
        });

        // Hide context menu on click outside
        this.doc.addEventListener('click', () => {
            this.hideContextMenu();
        });

        // Attach context menu event listeners
        this.doc.getElementById('context-copy').addEventListener('click', () => {
            this.copySelection();
            this.hideContextMenu();
        });

        this.doc.getElementById('context-paste').addEventListener('click', () => {
            this.pasteFromClipboard();
            this.hideContextMenu();
        });

        this.doc.getElementById('context-cut').addEventListener('click', () => {
            this.cutSelection();
            this.hideContextMenu();
        });

        this.doc.getElementById('context-select-all').addEventListener('click', () => {
            this.selectAll();
            this.hideContextMenu();
        });
    }

    /**
     * Show context menu at position
     */
    showContextMenu(x, y) {
        const contextMenu = this.doc.getElementById('plugin-test-context-menu');
        contextMenu.style.left = x + 'px';
        contextMenu.style.top = y + 'px';
        contextMenu.classList.add('show');

        // Enable/disable menu items based on selection
        const hasSelection = this.testWindow.getSelection().toString().length > 0;
        const copyBtn = this.doc.getElementById('context-copy');
        const cutBtn = this.doc.getElementById('context-cut');
        
        if (hasSelection) {
            copyBtn.classList.remove('disabled');
            cutBtn.classList.remove('disabled');
        } else {
            copyBtn.classList.add('disabled');
            cutBtn.classList.add('disabled');
        }
    }

    /**
     * Hide context menu
     */
    hideContextMenu() {
        const contextMenu = this.doc.getElementById('plugin-test-context-menu');
        contextMenu.classList.remove('show');
    }

    /**
     * Copy selected text to clipboard
     */
    async copySelection() {
        const selection = this.testWindow.getSelection();
        const text = selection.toString();
        
        if (!text) {
            console.log('No text selected to copy');
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            this.showNotification('Copied to clipboard!');
            console.log('✅ Text copied to clipboard:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
        } catch (error) {
            console.error('❌ Failed to copy to clipboard:', error);
            
            // Fallback to execCommand
            try {
                this.doc.execCommand('copy');
                this.showNotification('Copied to clipboard!');
            } catch (fallbackError) {
                this.showNotification('Failed to copy', 'error');
            }
        }
    }

    /**
     * Paste from clipboard
     */
    async pasteFromClipboard() {
        try {
            const text = await navigator.clipboard.readText();
            
            if (!text) {
                console.log('Clipboard is empty');
                return;
            }

            // Get the currently focused element
            const activeElement = this.doc.activeElement;
            
            // Check if it's an input field or textarea
            if (activeElement && (activeElement.tagName === 'INPUT' || 
                                  activeElement.tagName === 'TEXTAREA' ||
                                  activeElement.contentEditable === 'true')) {
                
                // Insert text at cursor position
                if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') {
                    const start = activeElement.selectionStart;
                    const end = activeElement.selectionEnd;
                    const currentValue = activeElement.value;
                    
                    activeElement.value = currentValue.substring(0, start) + text + currentValue.substring(end);
                    activeElement.selectionStart = activeElement.selectionEnd = start + text.length;
                    
                    // Trigger input event
                    activeElement.dispatchEvent(new Event('input', { bubbles: true }));
                } else {
                    // For contenteditable
                    this.doc.execCommand('insertText', false, text);
                }
                
                this.showNotification('Pasted from clipboard!');
                console.log('✅ Text pasted from clipboard:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
            } else {
                console.log('No input field focused for paste');
                this.showNotification('Please focus an input field first', 'warning');
            }
        } catch (error) {
            console.error('❌ Failed to paste from clipboard:', error);
            this.showNotification('Failed to paste', 'error');
        }
    }

    /**
     * Cut selected text to clipboard
     */
    async cutSelection() {
        const selection = this.testWindow.getSelection();
        const text = selection.toString();
        
        if (!text) {
            console.log('No text selected to cut');
            return;
        }

        try {
            await navigator.clipboard.writeText(text);
            
            // Delete the selected text if it's in an editable field
            const activeElement = this.doc.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || 
                                  activeElement.tagName === 'TEXTAREA' ||
                                  activeElement.contentEditable === 'true')) {
                this.doc.execCommand('delete');
            }
            
            this.showNotification('Cut to clipboard!');
            console.log('✅ Text cut to clipboard:', text.substring(0, 50) + (text.length > 50 ? '...' : ''));
        } catch (error) {
            console.error('❌ Failed to cut to clipboard:', error);
            this.showNotification('Failed to cut', 'error');
        }
    }

    /**
     * Select all content
     */
    selectAll() {
        const activeElement = this.doc.activeElement;
        
        if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
            activeElement.select();
        } else {
            const selection = this.testWindow.getSelection();
            const range = this.doc.createRange();
            range.selectNodeContents(this.doc.body);
            selection.removeAllRanges();
            selection.addRange(range);
        }
        
        console.log('✅ All content selected');
    }

    /**
     * Show notification toast
     */
    showNotification(message, type = 'success') {
        const notification = this.doc.createElement('div');
        notification.className = 'copy-notification';
        notification.innerHTML = `
            <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'times-circle' : 'exclamation-circle'}"></i>
            ${message}
        `;
        notification.style.background = type === 'success' ? '#48bb78' : type === 'error' ? '#f56565' : '#ed8936';
        
        this.doc.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 3000);
    }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
    window.PluginTestWindowMenuManager = PluginTestWindowMenuManager;
}
