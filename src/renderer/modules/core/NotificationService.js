// @ts-check
/**
 * NotificationService — Toast Notification System for CodeXomics
 *
 * Replaces browser alert() with non-blocking toast notifications.
 * Pure CSS/JS implementation — no external dependencies.
 *
 * Usage:
 *   const ns = new NotificationService();
 *   ns.toast('File saved successfully', 'success');
 *   ns.toast('Please enter a valid URL', 'warn');
 *   ns.toast('Failed to connect to server', 'error');
 *
 * Confirm dialogs:
 *   const confirmed = await ns.confirm('Are you sure?', 'Delete file');
 *
 * @class NotificationService
 */
class NotificationService {
  constructor(options = {}) {
    this._container = null;
    this._position = options.position || 'top-right'; // top-right | top-center | bottom-right | bottom-center
    this._duration = options.duration || 4000; // ms
    this._maxToasts = options.maxToasts || 5;
    this._activeToasts = [];
    this._ensureContainer();
  }

  /**
   * Show a toast notification
   * @param {string} message - The message to display
   * @param {string} [type='info'] - 'info' | 'success' | 'warn' | 'error'
   * @param {Object} [options]
   * @param {number} [options.duration] - Display duration in ms
   * @returns {HTMLElement} The toast element
   */
  toast(message, type = 'info', options = {}) {
    // Don't show duplicates of the same message within 1 second
    const recentDuplicate = this._activeToasts.find(
      t => t.message === message && Date.now() - t.timestamp < 1000
    );
    if (recentDuplicate) return recentDuplicate.element;

    // Remove oldest toast if we've reached max
    while (this._activeToasts.length >= this._maxToasts) {
      const oldest = this._activeToasts.shift();
      if (oldest && oldest.element) {
        this._removeToast(oldest.element);
      }
    }

    const toast = this._createToastElement(message, type);
    this._container.appendChild(toast);

    const duration = options.duration || this._duration;
    const toastData = { element: toast, message, type, timestamp: Date.now() };
    this._activeToasts.push(toastData);

    // Auto-dismiss
    if (duration > 0) {
      setTimeout(() => this._dismissToast(toast, toastData), duration);
    }

    // Trigger show animation
    requestAnimationFrame(() => toast.classList.add('show'));

    return toast;
  }

  /**
   * Show an async confirm dialog (replaces confirm())
   * @param {string} message - The confirmation message
   * @param {string} [title='Confirm'] - Dialog title
   * @returns {Promise<boolean>} True if confirmed
   */
  confirm(message, title = 'Confirm') {
    return new Promise((resolve) => {
      const overlay = this._createConfirmOverlay(message, title, resolve);
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('show'));
    });
  }

  /**
   * Show an async prompt dialog (replaces prompt())
   * @param {string} message - The prompt message
   * @param {string} [defaultValue=''] - Default input value
   * @returns {Promise<string|null>} Input value or null if cancelled
   */
  prompt(message, defaultValue = '') {
    return new Promise((resolve) => {
      const overlay = this._createPromptOverlay(message, defaultValue, resolve);
      document.body.appendChild(overlay);
      requestAnimationFrame(() => overlay.classList.add('show'));
    });
  }

  /**
   * Dismiss all active toasts
   */
  dismissAll() {
    while (this._activeToasts.length > 0) {
      const toast = this._activeToasts.shift();
      if (toast && toast.element) {
        this._removeToast(toast.element);
      }
    }
  }

  /**
   * @private
   */
  _ensureContainer() {
    if (this._container) return;

    // Check if a container already exists
    const existing = document.getElementById('notification-container');
    if (existing) {
      this._container = existing;
      return;
    }

    this._container = document.createElement('div');
    this._container.id = 'notification-container';
    this._container.className = `notification-container notification-${this._position}`;

    // Inject minimal styles if not already present
    if (!document.getElementById('notification-styles')) {
      const style = document.createElement('style');
      style.id = 'notification-styles';
      style.textContent = this._getStyles();
      document.head.appendChild(style);
    }

    document.body.appendChild(this._container);
  }

  /**
   * @private
   */
  _createToastElement(message, type) {
    const toast = document.createElement('div');
    toast.className = `notification-toast notification-${type}`;
    toast.setAttribute('role', 'alert');

    const icon = this._getIcon(type);
    toast.innerHTML = `
      <span class="notification-icon">${icon}</span>
      <span class="notification-message">${this._escapeHtml(message)}</span>
      <button class="notification-close" aria-label="Close">&times;</button>
    `;

    // Close button
    const closeBtn = toast.querySelector('.notification-close');
    closeBtn.addEventListener('click', () => this._dismissToast(toast));

    return toast;
  }

  /**
   * @private
   */
  _createConfirmOverlay(message, title, resolve) {
    const overlay = document.createElement('div');
    overlay.className = 'notification-overlay';
    overlay.innerHTML = `
      <div class="notification-dialog">
        <h3 class="notification-dialog-title">${this._escapeHtml(title)}</h3>
        <p class="notification-dialog-message">${this._escapeHtml(message)}</p>
        <div class="notification-dialog-actions">
          <button class="notification-btn notification-btn-cancel">Cancel</button>
          <button class="notification-btn notification-btn-confirm">Confirm</button>
        </div>
      </div>
    `;

    overlay.querySelector('.notification-btn-confirm').addEventListener('click', () => {
      this._removeOverlay(overlay);
      resolve(true);
    });
    overlay.querySelector('.notification-btn-cancel').addEventListener('click', () => {
      this._removeOverlay(overlay);
      resolve(false);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        this._removeOverlay(overlay);
        resolve(false);
      }
    });

    // Escape key closes
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        this._removeOverlay(overlay);
        resolve(false);
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);

    return overlay;
  }

  /**
   * @private
   */
  _createPromptOverlay(message, defaultValue, resolve) {
    const overlay = document.createElement('div');
    overlay.className = 'notification-overlay';
    const safeDefault = this._escapeHtml(defaultValue);
    overlay.innerHTML = `
      <div class="notification-dialog">
        <h3 class="notification-dialog-title">Input Required</h3>
        <p class="notification-dialog-message">${this._escapeHtml(message)}</p>
        <input class="notification-input" type="text" value="${safeDefault}" />
        <div class="notification-dialog-actions">
          <button class="notification-btn notification-btn-cancel">Cancel</button>
          <button class="notification-btn notification-btn-confirm">OK</button>
        </div>
      </div>
    `;

    const input = overlay.querySelector('.notification-input');
    input.focus();
    input.select();

    overlay.querySelector('.notification-btn-confirm').addEventListener('click', () => {
      this._removeOverlay(overlay);
      resolve(input.value);
    });
    overlay.querySelector('.notification-btn-cancel').addEventListener('click', () => {
      this._removeOverlay(overlay);
      resolve(null);
    });

    // Enter key confirms
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        this._removeOverlay(overlay);
        resolve(input.value);
      }
    });

    return overlay;
  }

  /**
   * @private
   */
  _dismissToast(toast, toastData) {
    if (!toast || !toast.parentNode) return;

    toast.classList.remove('show');
    toast.classList.add('hide');

    setTimeout(() => {
      this._removeToast(toast);
    }, 300);

    // Remove from active list
    if (toastData) {
      const index = this._activeToasts.indexOf(toastData);
      if (index > -1) this._activeToasts.splice(index, 1);
    }
  }

  /**
   * @private
   */
  _removeToast(toast) {
    if (toast && toast.parentNode) {
      toast.parentNode.removeChild(toast);
    }
  }

  /**
   * @private
   */
  _removeOverlay(overlay) {
    if (overlay && overlay.parentNode) {
      overlay.classList.remove('show');
      setTimeout(() => {
        if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
      }, 200);
    }
  }

  /**
   * @private
   */
  _getIcon(type) {
    switch (type) {
      case 'success': return '✓';
      case 'error':   return '✕';
      case 'warn':    return '⚠';
      default:        return 'ℹ';
    }
  }

  /**
   * @private
   */
  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * @private - CSS styles for the notification system
   */
  _getStyles() {
    return `
      /* Notification Container */
      .notification-container {
        position: fixed;
        z-index: 100000;
        display: flex;
        flex-direction: column;
        gap: 8px;
        pointer-events: none;
        max-width: 380px;
      }
      .notification-top-right    { top: 16px; right: 16px; }
      .notification-top-center   { top: 16px; left: 50%; transform: translateX(-50%); }
      .notification-bottom-right { bottom: 16px; right: 16px; }
      .notification-bottom-center{ bottom: 16px; left: 50%; transform: translateX(-50%); }

      /* Toast */
      .notification-toast {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 12px 16px;
        border-radius: 8px;
        background: #1e1e2e;
        color: #cdd6f4;
        font-size: 13px;
        line-height: 1.4;
        box-shadow: 0 4px 16px rgba(0,0,0,0.3);
        pointer-events: auto;
        opacity: 0;
        transform: translateX(30px);
        transition: opacity 0.3s ease, transform 0.3s ease;
      }
      .notification-toast.show { opacity: 1; transform: translateX(0); }
      .notification-toast.hide { opacity: 0; transform: translateX(30px); }

      .notification-icon {
        font-size: 16px;
        flex-shrink: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        font-weight: bold;
      }
      .notification-info .notification-icon    { background: #313244; color: #89b4fa; }
      .notification-success .notification-icon { background: #1a3a2a; color: #a6e3a1; }
      .notification-warn .notification-icon    { background: #3a2e1a; color: #f9e2af; }
      .notification-error .notification-icon   { background: #3a1a1a; color: #f38ba8; }

      .notification-message {
        flex: 1;
        word-break: break-word;
      }
      .notification-close {
        background: none;
        border: none;
        color: #6c7086;
        cursor: pointer;
        font-size: 18px;
        padding: 0 2px;
        line-height: 1;
        flex-shrink: 0;
      }
      .notification-close:hover { color: #cdd6f4; }

      /* Toast Type Borders */
      .notification-info    { border-left: 3px solid #89b4fa; }
      .notification-success { border-left: 3px solid #a6e3a1; }
      .notification-warn    { border-left: 3px solid #f9e2af; }
      .notification-error   { border-left: 3px solid #f38ba8; }

      /* Overlay */
      .notification-overlay {
        position: fixed;
        top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5);
        z-index: 100001;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        transition: opacity 0.2s ease;
      }
      .notification-overlay.show { opacity: 1; }

      /* Dialog */
      .notification-dialog {
        background: #1e1e2e;
        border: 1px solid #313244;
        border-radius: 12px;
        padding: 24px;
        min-width: 320px;
        max-width: 480px;
        box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      }
      .notification-dialog-title {
        margin: 0 0 12px 0;
        color: #cdd6f4;
        font-size: 16px;
        font-weight: 600;
      }
      .notification-dialog-message {
        margin: 0 0 20px 0;
        color: #a6adc8;
        font-size: 14px;
        line-height: 1.5;
      }
      .notification-dialog-actions {
        display: flex;
        gap: 8px;
        justify-content: flex-end;
      }

      /* Buttons */
      .notification-btn {
        padding: 8px 18px;
        border-radius: 6px;
        border: none;
        font-size: 13px;
        cursor: pointer;
        transition: background 0.15s ease;
      }
      .notification-btn-cancel   { background: #313244; color: #cdd6f4; }
      .notification-btn-cancel:hover   { background: #45475a; }
      .notification-btn-confirm  { background: #89b4fa; color: #1e1e2e; }
      .notification-btn-confirm:hover  { background: #b4d0fb; }

      /* Input */
      .notification-input {
        width: 100%;
        padding: 10px 12px;
        border: 1px solid #45475a;
        border-radius: 6px;
        background: #11111b;
        color: #cdd6f4;
        font-size: 14px;
        margin-bottom: 16px;
        box-sizing: border-box;
      }
      .notification-input:focus {
        outline: none;
        border-color: #89b4fa;
      }
    `;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = NotificationService;
}
if (typeof window !== 'undefined') {
  window.NotificationService = NotificationService;
}
