'use strict';

/**
 * Structured logging and crash capture for the main process.
 *
 * Wraps electron-log so that:
 *  - All existing `console.*` calls in the main process are transparently routed
 *    to a rotating log file under userData/logs (no call-site changes required).
 *  - Uncaught exceptions and unhandled rejections are written to the log instead
 *    of silently terminating the process.
 *  - Renderer-side electron-log messages (when the renderer opts in via
 *    electron-log/renderer) are received over IPC and written to the same file.
 *  - Native crashes are captured locally via crashReporter (no data is uploaded
 *    unless a submit URL is configured).
 *
 * All initialization is wrapped in try/catch — logging must never crash the app.
 */

let logger = null;

function getLogger() {
  return logger;
}

function initLogging() {
  try {
    const log = require('electron-log/main');

    // Sets up the IPC channel used by electron-log/renderer and (best-effort)
    // renderer console capture.
    log.initialize();

    log.transports.file.level = 'info';
    log.transports.console.level = process.env.NODE_ENV === 'production' ? 'warn' : 'debug';
    // Keep individual log files bounded; electron-log rotates to <name>.old.log.
    log.transports.file.maxSize = 10 * 1024 * 1024; // 10 MB

    // Write uncaught exceptions / unhandled rejections to the log.
    log.errorHandler.startCatching({ showDialog: false });

    // Route the main process's existing console.* calls through electron-log so
    // the ~thousands of call sites are captured without modification.
    Object.assign(console, log.functions);

    logger = log;
    log.info('[logging] electron-log initialized. Log file:', getLogFilePath());
    return log;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('[logging] Failed to initialize electron-log:', error && error.message);
    return null;
  }
}

function startCrashReporter() {
  try {
    const { crashReporter } = require('electron');
    crashReporter.start({
      productName: 'CodeXomics',
      companyName: 'CodeXomics',
      // No remote endpoint by default — crashes are captured locally only.
      // Set a Crashpad/Breakpad submitURL here to enable opt-in upload.
      submitURL: '',
      uploadToServer: false,
      compress: true,
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn('[logging] crashReporter could not start:', error && error.message);
  }
}

function getLogFilePath() {
  try {
    if (logger && logger.transports && logger.transports.file) {
      const file = logger.transports.file.getFile?.();
      return file ? file.path : null;
    }
  } catch (error) {
    // ignore
  }
  return null;
}

module.exports = {
  initLogging,
  startCrashReporter,
  getLogger,
  getLogFilePath,
};
