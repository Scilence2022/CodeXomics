/**
 * ErrorHandler — Centralized Error Handling for CodeXomics
 *
 * Provides a unified error reporting and user notification system.
 * Replaces scattered console.error() + alert() patterns with structured error handling.
 *
 * Usage:
 *   ErrorHandler.handle(error, 'ChatManager.sendMessage');
 *   ErrorHandler.onGlobalError();  // Call once during app init
 *
 * Error levels:
 *   - fatal:   App-critical, user must be notified immediately
 *   - error:   Feature failure, user should know
 *   - warning: Recoverable issue, log and continue
 *   - info:    Diagnostic information
 *
 * @class ErrorHandler
 */
class ErrorHandler {
  /**
   * @param {Object} [options]
   * @param {Function} [options.onError] - Custom error callback
   * @param {boolean} [options.showToasts=true] - Show toast notifications
   * @param {Function} [options.notificationService] - Toast/notification service
   */
  constructor(options = {}) {
    this._onError = options.onError || null;
    this._showToasts = options.showToasts !== false;
    this._notificationService = options.notificationService || null;
    this._errorCount = 0;
    this._errorHistory = []; // Keep last 50 errors for diagnostics
    this._maxHistory = 50;
  }

  /**
   * Handle an error with context
   * @param {Error|string} error - The error object or message
   * @param {string} [context=''] - Where the error occurred (e.g., 'ChatManager.sendMessage')
   * @param {string} [level='error'] - Error severity level
   */
  handle(error, context = '', level = 'error') {
    this._errorCount++;

    // Normalize error object
    const errorObj = this._normalizeError(error, context);

    // Record in history
    this._errorHistory.push({
      ...errorObj,
      level,
      timestamp: new Date().toISOString(),
    });
    if (this._errorHistory.length > this._maxHistory) {
      this._errorHistory.shift();
    }

    // Console logging (structured)
    this._logError(errorObj, level);

    // Toast notification for user-facing errors
    if (this._showToasts) {
      this._notifyUser(errorObj, level);
    }

    // Custom callback
    if (this._onError) {
      try {
        this._onError(errorObj, level);
      } catch (callbackError) {
        console.error('[ErrorHandler] Error in onError callback:', callbackError);
      }
    }
  }

  /**
   * Shortcut for fatal errors
   * @param {Error|string} error
   * @param {string} [context]
   */
  fatal(error, context = '') {
    this.handle(error, context, 'fatal');
  }

  /**
   * Shortcut for warnings
   * @param {Error|string} error
   * @param {string} [context]
   */
  warning(error, context = '') {
    this.handle(error, context, 'warning');
  }

  /**
   * Shortcut for diagnostic info
   * @param {Error|string} error
   * @param {string} [context]
   */
  info(error, context = '') {
    this.handle(error, context, 'info');
  }

  /**
   * Register global unhandled rejection handler
   * Call once during app initialization
   */
  registerGlobalHandlers() {
    if (typeof window !== 'undefined') {
      // Browser global error handler
      window.onerror = (message, source, lineno, colno, error) => {
        this.handle(
          error || new Error(String(message)),
          `Global script error at ${source}:${lineno}:${colno}`,
          'error'
        );
        return false; // Don't prevent default browser handling
      };

      // Unhandled Promise rejection
      window.addEventListener('unhandledrejection', (event) => {
        this.handle(
          event.reason || new Error('Unhandled Promise rejection'),
          'Unhandled Promise',
          'error'
        );
        event.preventDefault(); // Prevent console noise after we handle it
      });
    }

    if (typeof process !== 'undefined') {
      // Node.js unhandled rejection
      process.on('unhandledRejection', (reason, promise) => {
        this.handle(
          reason instanceof Error ? reason : new Error(String(reason)),
          'Node.js unhandledRejection',
          'warning'
        );
      });

      // Node.js uncaught exception
      process.on('uncaughtException', (error) => {
        this.handle(error, 'Node.js uncaughtException', 'fatal');
        // Don't exit — let the app decide
      });
    }
  }

  /**
   * Wrap a function with error handling
   * @param {Function} fn - The function to wrap
   * @param {string} context - Context name for error reporting
   * @returns {Function} Wrapped function
   */
  wrap(fn, context) {
    return (...args) => {
      try {
        const result = fn(...args);
        // Handle async functions
        if (result instanceof Promise) {
          return result.catch((error) => {
            this.handle(error, context);
            throw error; // Re-throw for caller to handle if needed
          });
        }
        return result;
      } catch (error) {
        this.handle(error, context);
        throw error;
      }
    };
  }

  /**
   * Safe try-catch wrapper that returns [result, error] tuple
   * @param {Function} fn
   * @param {string} [context]
   * @returns {Promise<[any, Error|null]>}
   */
  static async safeAsync(fn, context = '') {
    try {
      const result = await fn();
      return [result, null];
    } catch (error) {
      if (ErrorHandler._instance) {
        ErrorHandler._instance.handle(error, context);
      }
      return [null, error];
    }
  }

  /**
   * Get error statistics
   * @returns {{total: number, recent: Array}}
   */
  getStats() {
    return {
      total: this._errorCount,
      recent: this._errorHistory.slice(-10),
      history: this._errorHistory,
    };
  }

  /**
   * Clear error history
   */
  clearHistory() {
    this._errorHistory = [];
    this._errorCount = 0;
  }

  /**
   * @private
   */
  _normalizeError(error, context) {
    if (error instanceof Error) {
      return {
        message: error.message,
        name: error.name,
        stack: error.stack,
        context,
      };
    }
    return {
      message: String(error),
      name: 'Error',
      stack: null,
      context,
    };
  }

  /**
   * @private
   */
  _logError(errorObj, level) {
    const prefix = `[${level.toUpperCase()}]`;
    const location = errorObj.context ? ` (${errorObj.context})` : '';

    switch (level) {
      case 'fatal':
        console.error(`${prefix} FATAL${location}:`, errorObj.message, errorObj.stack || '');
        break;
      case 'error':
        console.error(`${prefix}${location}:`, errorObj.message);
        break;
      case 'warning':
        console.warn(`${prefix}${location}:`, errorObj.message);
        break;
      default:
        console.info(`${prefix}${location}:`, errorObj.message);
    }
  }

  /**
   * @private
   */
  _notifyUser(errorObj, level) {
    // Use NotificationService if available
    if (this._notificationService && typeof this._notificationService.toast === 'function') {
      this._notificationService.toast(errorObj.message, level === 'fatal' ? 'error' : level);
      return;
    }

    // Fall back to window.NotificationService if globally available
    if (typeof window !== 'undefined' && window.NotificationService && typeof window.NotificationService.toast === 'function') {
      window.NotificationService.toast(errorObj.message, level === 'fatal' ? 'error' : level);
      return;
    }

    // Last resort: use alert for fatal/error, console for rest
    if (level === 'fatal' && typeof window !== 'undefined') {
      setTimeout(() => window.alert(`Fatal Error: ${errorObj.message}`), 0);
    }
  }

  /**
   * Set global singleton instance
   * @static
   */
  static setInstance(instance) {
    ErrorHandler._instance = instance;
  }

  /**
   * Get global singleton instance
   * @static
   * @returns {ErrorHandler|null}
   */
  static getInstance() {
    return ErrorHandler._instance || null;
  }
}

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ErrorHandler;
}
if (typeof window !== 'undefined') {
  window.ErrorHandler = ErrorHandler;
}
