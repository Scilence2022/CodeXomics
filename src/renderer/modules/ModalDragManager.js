/**
 * ModalDragManager - Makes modals draggable and enhances their UX
 */
class ModalDragManager {
    constructor() {
        this.draggedElement = null;
        this.startX = 0;
        this.startY = 0;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        
        this.initializeEventListeners();
        console.log('ModalDragManager initialized');
    }

    initializeEventListeners() {
        // Handle mouse events for dragging
        document.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        document.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        document.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        
        // Prevent text selection during drag
        document.addEventListener('selectstart', (e) => {
            if (this.isDragging) {
                e.preventDefault();
            }
        });
    }

    /**
     * Make a modal draggable
     */
    makeDraggable(modalSelector) {
        const modal = document.querySelector(modalSelector);
        if (!modal) {
            console.warn(`Modal not found: ${modalSelector}`);
            return;
        }

        const modalContent = modal.querySelector('.modal-content');
        const modalHeader = modal.querySelector('.modal-header');
        
        if (!modalContent || !modalHeader) {
            console.warn(`Modal structure incomplete for: ${modalSelector}`);
            return;
        }

        // Add classes for styling
        modalContent.classList.add('draggable');
        modalHeader.classList.add('draggable-handle');

        // Add size classes based on content
        this.addSizeClass(modalContent);

        // Store reference for dragging
        modalHeader.setAttribute('data-modal-content', modalSelector);
        
        console.log(`Made modal draggable: ${modalSelector}`);
    }

    /**
     * Add appropriate size class based on modal content
     */
    addSizeClass(modalContent) {
        const modalBody = modalContent.querySelector('.modal-body');
        if (!modalBody) return;

        // Check for specific management interfaces
        const isPluginManagement = modalContent.querySelector('.plugin-management-tabs');
        const isMCPSettings = modalContent.querySelector('.mcp-servers-section');
        const isLLMConfig = modalContent.querySelector('.llm-provider-tabs');
        const isBlastModal = modalContent.querySelector('.blast-search-container');

        if (isPluginManagement || isMCPSettings || isLLMConfig || isBlastModal) {
            modalContent.classList.add('large');
        }

        // For very content-heavy modals
        if (isPluginManagement && modalContent.querySelectorAll('.tab-content').length > 2) {
            modalContent.classList.remove('large');
            modalContent.classList.add('extra-large');
        }
    }

    handleMouseDown(e) {
        const handle = e.target.closest('.draggable-handle');
        if (!handle) return;

        const modalSelector = handle.getAttribute('data-modal-content');
        if (!modalSelector) return;

        const modal = document.querySelector(modalSelector);
        const modalContent = modal?.querySelector('.modal-content');
        
        if (!modalContent || !modalContent.classList.contains('draggable')) return;

        // Don't start drag if clicking on buttons or inputs in the header
        if (e.target.closest('button') || e.target.closest('input') || e.target.closest('select')) {
            return;
        }

        e.preventDefault();
        this.startDrag(modalContent, e);
    }

    startDrag(modalContent, e) {
        this.isDragging = true;
        this.draggedElement = modalContent;

        // Get current position
        const rect = modalContent.getBoundingClientRect();
        this.startX = rect.left;
        this.startY = rect.top;
        this.offsetX = e.clientX - this.startX;
        this.offsetY = e.clientY - this.startY;

        // Add visual feedback
        modalContent.classList.add('dragging');
        document.body.style.cursor = 'move';
        document.body.style.userSelect = 'none';
    }

    handleMouseMove(e) {
        if (!this.isDragging || !this.draggedElement) return;

        e.preventDefault();

        // Calculate new position
        const newX = e.clientX - this.offsetX;
        const newY = e.clientY - this.offsetY;

        // Constrain to viewport
        const modalRect = this.draggedElement.getBoundingClientRect();
        const viewportWidth = window.innerWidth;
        const viewportHeight = window.innerHeight;

        const constrainedX = Math.max(
            0, 
            Math.min(newX, viewportWidth - modalRect.width)
        );
        const constrainedY = Math.max(
            0, 
            Math.min(newY, viewportHeight - modalRect.height)
        );

        // Apply position
        this.draggedElement.style.position = 'fixed';
        this.draggedElement.style.left = `${constrainedX}px`;
        this.draggedElement.style.top = `${constrainedY}px`;
        this.draggedElement.style.margin = '0';
        this.draggedElement.style.transform = 'none';
    }

    handleMouseUp(e) {
        if (!this.isDragging) return;

        // Clean up
        if (this.draggedElement) {
            this.draggedElement.classList.remove('dragging');
        }

        document.body.style.cursor = '';
        document.body.style.userSelect = '';

        this.isDragging = false;
        this.draggedElement = null;
    }

    /**
     * Reset modal position to center
     */
    resetPosition(modalSelector) {
        const modal = document.querySelector(modalSelector);
        const modalContent = modal?.querySelector('.modal-content');
        
        if (!modalContent) return;

        modalContent.style.position = '';
        modalContent.style.left = '';
        modalContent.style.top = '';
        modalContent.style.margin = '';
        modalContent.style.transform = '';
    }

    /**
     * Auto-initialize all management modals
     */
    initializeAllModals() {
        const managementModals = [
            '#pluginManagementModal',
            '#mcpSettingsModal', 
            '#llmConfigModal',
            '#blastModal',
            '#searchModal',
            '#gotoModal',
            '#addFeatureModal'
        ];

        managementModals.forEach(selector => {
            // Use setTimeout to ensure DOM is ready
            setTimeout(() => {
                this.makeDraggable(selector);
            }, 100);
        });
    }

    /**
     * Add reset button to modal headers
     */
    addResetButton(modalSelector) {
        const modal = document.querySelector(modalSelector);
        const modalHeader = modal?.querySelector('.modal-header');
        
        if (!modalHeader || modalHeader.querySelector('.reset-position-btn')) return;

        const resetBtn = document.createElement('button');
        resetBtn.className = 'reset-position-btn';
        resetBtn.innerHTML = '<i class="fas fa-expand-arrows-alt"></i>';
        resetBtn.title = 'Reset Position';
        resetBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.resetPosition(modalSelector);
        });

        // Insert before close button
        const closeBtn = modalHeader.querySelector('.modal-close');
        if (closeBtn) {
            modalHeader.insertBefore(resetBtn, closeBtn);
        } else {
            modalHeader.appendChild(resetBtn);
        }
    }
}

// Export for use in other modules
window.ModalDragManager = ModalDragManager; 