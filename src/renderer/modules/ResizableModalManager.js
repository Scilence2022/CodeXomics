/**
 * ResizableModalManager - Handles resizable modal functionality
 */
class ResizableModalManager {
    constructor() {
        this.resizing = false;
        this.currentHandle = null;
        this.startX = 0;
        this.startY = 0;
        this.startWidth = 0;
        this.startHeight = 0;
        this.startLeft = 0;
        this.startTop = 0;
        
        this.initializeEventListeners();
        console.log('ResizableModalManager initialized');
    }

    initializeEventListeners() {
        // Handle mouse events for resizing
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // Prevent text selection during resize
        document.addEventListener('selectstart', (e) => {
            if (this.resizing) {
                e.preventDefault();
            }
        });
    }

    /**
     * Make a modal resizable
     */
    makeResizable(modalSelector) {
        const modal = document.querySelector(modalSelector);
        if (!modal) {
            console.warn(`Modal not found: ${modalSelector}`);
            return;
        }

        const modalContent = modal.querySelector('.modal-content.resizable');
        if (!modalContent) {
            console.warn(`Modal content not found or not resizable: ${modalSelector}`);
            return;
        }

        // Set initial size (1.5x width increase)
        const baseWidth = 500; // Default modal width
        const increasedWidth = Math.round(baseWidth * 1.5);
        modalContent.style.width = `${increasedWidth}px`;
        modalContent.style.maxWidth = 'none'; // Override max-width for resizable modals

        console.log(`Made modal resizable: ${modalSelector} with initial width: ${increasedWidth}px`);
    }

    handleMouseDown(e) {
        const handle = e.target.closest('.resize-handle');
        if (!handle) return;

        e.preventDefault();
        this.startResize(handle, e);
    }

    startResize(handle, e) {
        this.resizing = true;
        this.currentHandle = handle;
        const modalContent = handle.closest('.modal-content');
        
        if (!modalContent) return;

        // Get current dimensions and position
        const rect = modalContent.getBoundingClientRect();
        this.startX = e.clientX;
        this.startY = e.clientY;
        this.startWidth = rect.width;
        this.startHeight = rect.height;
        this.startLeft = rect.left;
        this.startTop = rect.top;

        // Add visual feedback
        modalContent.style.transition = 'none';
        document.body.style.cursor = handle.style.cursor;
        document.body.style.userSelect = 'none';
    }

    handleMouseMove(e) {
        if (!this.resizing || !this.currentHandle) return;

        e.preventDefault();

        const modalContent = this.currentHandle.closest('.modal-content');
        if (!modalContent) return;

        const deltaX = e.clientX - this.startX;
        const deltaY = e.clientY - this.startY;
        const handleClass = this.currentHandle.className;

        let newWidth = this.startWidth;
        let newHeight = this.startHeight;
        let newLeft = this.startLeft;
        let newTop = this.startTop;

        // Calculate new dimensions based on handle type
        if (handleClass.includes('resize-handle-e') || handleClass.includes('resize-handle-ne') || handleClass.includes('resize-handle-se')) {
            newWidth = this.startWidth + deltaX;
        }
        if (handleClass.includes('resize-handle-w') || handleClass.includes('resize-handle-nw') || handleClass.includes('resize-handle-sw')) {
            newWidth = this.startWidth - deltaX;
            newLeft = this.startLeft + deltaX;
        }
        if (handleClass.includes('resize-handle-s') || handleClass.includes('resize-handle-se') || handleClass.includes('resize-handle-sw')) {
            newHeight = this.startHeight + deltaY;
        }
        if (handleClass.includes('resize-handle-n') || handleClass.includes('resize-handle-ne') || handleClass.includes('resize-handle-nw')) {
            newHeight = this.startHeight - deltaY;
            newTop = this.startTop + deltaY;
        }

        // Apply constraints
        const minWidth = 400;
        const minHeight = 300;
        const maxWidth = window.innerWidth - 40;
        const maxHeight = window.innerHeight - 40;

        newWidth = Math.max(minWidth, Math.min(newWidth, maxWidth));
        newHeight = Math.max(minHeight, Math.min(newHeight, maxHeight));

        // Apply new dimensions
        modalContent.style.width = `${newWidth}px`;
        modalContent.style.height = `${newHeight}px`;
        
        // Apply position changes for handles that affect position
        if (handleClass.includes('resize-handle-w') || handleClass.includes('resize-handle-nw') || handleClass.includes('resize-handle-sw')) {
            modalContent.style.left = `${newLeft}px`;
        }
        if (handleClass.includes('resize-handle-n') || handleClass.includes('resize-handle-ne') || handleClass.includes('resize-handle-nw')) {
            modalContent.style.top = `${newTop}px`;
        }
    }

    handleMouseUp(e) {
        if (!this.resizing) return;

        // Clean up
        if (this.currentHandle) {
            const modalContent = this.currentHandle.closest('.modal-content');
            if (modalContent) {
                modalContent.style.transition = '';
            }
        }

        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        this.resizing = false;
        this.currentHandle = null;
    }

    /**
     * Reset modal size to default
     */
    resetSize(modalSelector) {
        const modal = document.querySelector(modalSelector);
        const modalContent = modal?.querySelector('.modal-content.resizable');
        
        if (!modalContent) return;

        // Reset to default size (1.5x width)
        const baseWidth = 500;
        const increasedWidth = Math.round(baseWidth * 1.5);
        
        modalContent.style.width = `${increasedWidth}px`;
        modalContent.style.height = '';
        modalContent.style.left = '';
        modalContent.style.top = '';
        modalContent.style.maxWidth = 'none';
    }
} 