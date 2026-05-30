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
    this.viewportPadding = 16;

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

    // Only set initial dimensions on first initialization (no inline width set yet)
    if (!modalContent.style.width) {
      // Use the modal's current CSS-determined width as the base
      const currentWidth = modalContent.getBoundingClientRect().width;
      const baseWidth = currentWidth > 100 ? currentWidth : 500;
      modalContent.style.width = `${Math.round(baseWidth)}px`;
    }

    // Save the original CSS constraints before overriding them
    const currentStyle = window.getComputedStyle(modalContent);
    const originalMaxWidth = currentStyle.maxWidth;
    if (originalMaxWidth && originalMaxWidth !== 'none' && !modalContent.hasAttribute('data-max-width')) {
      const parsedMax = parseInt(originalMaxWidth, 10);
      if (!isNaN(parsedMax) && parsedMax > 0) {
        modalContent.setAttribute('data-max-width', parsedMax.toString());
      }
    }
    const originalMinWidth = currentStyle.minWidth;
    if (originalMinWidth && originalMinWidth !== '0px' && !modalContent.hasAttribute('data-min-width')) {
      const parsedMin = parseInt(originalMinWidth, 10);
      if (!isNaN(parsedMin) && parsedMin > 0) {
        modalContent.setAttribute('data-min-width', parsedMin.toString());
      }
    }

    // Allow the JS constraint logic to be the single source of truth.
    modalContent.style.setProperty('max-width', 'none', 'important');

    console.log(`Made modal resizable: ${modalSelector}`);
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

    // Pin the element to its current visual position using fixed positioning.
    // This takes it out of flex-centered flow so one side can resize independently.
    // so resizing one side does not cause the other side to expand/shrink simultaneously.
    const currentPosition = window.getComputedStyle(modalContent).position;
    if (currentPosition !== 'fixed' && currentPosition !== 'absolute') {
      modalContent.style.position = 'fixed';
      modalContent.style.left = `${rect.left}px`;
      modalContent.style.top = `${rect.top}px`;
      modalContent.style.margin = '0';
    } else {
      // Even if already fixed/absolute, make sure left and top are explicitly set
      if (!modalContent.style.left) modalContent.style.left = `${rect.left}px`;
      if (!modalContent.style.top) modalContent.style.top = `${rect.top}px`;
    }

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

    const constraints = this.getResizeConstraints(modalContent);
    const minWidth = constraints.minWidth;
    const minHeight = constraints.minHeight;
    const maxWidth = constraints.maxWidth;
    const maxHeight = constraints.maxHeight;

    const leftBoundary = this.viewportPadding;
    const topBoundary = this.viewportPadding;
    const rightBoundary = Math.max(leftBoundary, window.innerWidth - this.viewportPadding);
    const bottomBoundary = Math.max(topBoundary, window.innerHeight - this.viewportPadding);

    // Calculate new dimensions based on handle type
    if (
      handleClass.includes('resize-handle-e') ||
      handleClass.includes('resize-handle-ne') ||
      handleClass.includes('resize-handle-se')
    ) {
      newWidth = this.startWidth + deltaX;
      const maxWidthForEast = Math.max(minWidth, Math.min(maxWidth, rightBoundary - this.startLeft));
      newWidth = this.clamp(newWidth, minWidth, maxWidthForEast);
    }
    if (
      handleClass.includes('resize-handle-w') ||
      handleClass.includes('resize-handle-nw') ||
      handleClass.includes('resize-handle-sw')
    ) {
      newWidth = this.startWidth - deltaX;
      const fixedRight = this.startLeft + this.startWidth;
      const maxWidthForWest = Math.max(minWidth, Math.min(maxWidth, fixedRight - leftBoundary));
      newWidth = this.clamp(newWidth, minWidth, maxWidthForWest);

      newLeft = fixedRight - newWidth;
    }
    if (
      handleClass.includes('resize-handle-s') ||
      handleClass.includes('resize-handle-se') ||
      handleClass.includes('resize-handle-sw')
    ) {
      newHeight = this.startHeight + deltaY;
      const maxHeightForSouth = Math.max(minHeight, Math.min(maxHeight, bottomBoundary - this.startTop));
      newHeight = this.clamp(newHeight, minHeight, maxHeightForSouth);
    }
    if (
      handleClass.includes('resize-handle-n') ||
      handleClass.includes('resize-handle-ne') ||
      handleClass.includes('resize-handle-nw')
    ) {
      newHeight = this.startHeight - deltaY;
      const fixedBottom = this.startTop + this.startHeight;
      const maxHeightForNorth = Math.max(minHeight, Math.min(maxHeight, fixedBottom - topBoundary));
      newHeight = this.clamp(newHeight, minHeight, maxHeightForNorth);

      newTop = fixedBottom - newHeight;
    }

    // Apply new dimensions
    modalContent.style.width = `${newWidth}px`;
    modalContent.style.height = `${newHeight}px`;

    // Apply position changes for handles that affect position
    if (
      handleClass.includes('resize-handle-w') ||
      handleClass.includes('resize-handle-nw') ||
      handleClass.includes('resize-handle-sw')
    ) {
      modalContent.style.left = `${newLeft}px`;
    }
    if (
      handleClass.includes('resize-handle-n') ||
      handleClass.includes('resize-handle-ne') ||
      handleClass.includes('resize-handle-nw')
    ) {
      modalContent.style.top = `${newTop}px`;
    }
  }

  parsePositiveInteger(value, fallback) {
    const parsed = parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }

  clamp(value, min, max) {
    return Math.max(min, Math.min(value, max));
  }

  getResizeConstraints(modalContent) {
    const style = window.getComputedStyle(modalContent);

    const defaultMaxWidth = Math.max(window.innerWidth * 3, 2000);
    const defaultMaxHeight = Math.max(window.innerHeight * 2, 1200);
    const cssMaxWidth = style.maxWidth && style.maxWidth !== 'none' ?
      this.parsePositiveInteger(style.maxWidth, defaultMaxWidth) :
      defaultMaxWidth;
    const cssMaxHeight = style.maxHeight && style.maxHeight !== 'none' ?
      this.parsePositiveInteger(style.maxHeight, defaultMaxHeight) :
      defaultMaxHeight;

    const configuredMinWidth = this.parsePositiveInteger(
        modalContent.getAttribute('data-min-width'),
        this.parsePositiveInteger(style.minWidth, 400),
    );
    const configuredMinHeight = this.parsePositiveInteger(
        modalContent.getAttribute('data-min-height'),
        this.parsePositiveInteger(style.minHeight, 300),
    );
    const configuredMaxWidth = this.parsePositiveInteger(modalContent.getAttribute('data-max-width'), cssMaxWidth);
    const configuredMaxHeight = this.parsePositiveInteger(modalContent.getAttribute('data-max-height'), cssMaxHeight);

    const viewportMaxWidth = Math.max(1, window.innerWidth - this.viewportPadding * 2);
    const viewportMaxHeight = Math.max(1, window.innerHeight - this.viewportPadding * 2);
    const maxWidth = Math.min(configuredMaxWidth, viewportMaxWidth);
    const maxHeight = Math.min(configuredMaxHeight, viewportMaxHeight);

    return {
      minWidth: Math.min(configuredMinWidth, maxWidth),
      minHeight: Math.min(configuredMinHeight, maxHeight),
      maxWidth,
      maxHeight,
    };
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

    // Clear inline dimensions and positioning so CSS defaults take effect
    modalContent.style.width = '';
    modalContent.style.height = '';
    modalContent.style.left = '';
    modalContent.style.top = '';
    modalContent.style.maxWidth = '';
    modalContent.style.position = '';
    modalContent.style.margin = '';
  }
}

// Export for use in other modules
if (typeof window !== 'undefined') {
  window.ResizableModalManager = ResizableModalManager;
}
