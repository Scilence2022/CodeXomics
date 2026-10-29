'use strict';

const { ElectronHttpExecutor } = require('electron-updater/out/electronHttpExecutor');

// builder-util-runtime 9.x implements timeouts using Node's `socket` event.
// Electron net.ClientRequest has no such event, so offline update checks can
// otherwise remain pending forever. Use an inactivity timer for the real API.
class UpdateHttpExecutor extends ElectronHttpExecutor {
  addTimeOutHandler(request, callback, timeout = 60000) {
    let timer;
    const clear = () => clearTimeout(timer);
    const reset = () => {
      clear();
      timer = setTimeout(() => {
        const error = new Error('Update request timed out');
        error.code = 'ETIMEDOUT';
        callback(error);
        request.abort();
      }, timeout);
      timer.unref?.();
    };
    request.once('response', response => {
      reset();
      response.on('data', reset);
      response.once('end', clear);
      response.once('close', clear);
      response.once('error', clear);
    });
    request.once('abort', clear);
    request.once('error', clear);
    // Electron emits request `close` when its upload side finishes, often
    // BEFORE response headers arrive. Only the response can end this timeout.
    reset();
  }
}

module.exports = { UpdateHttpExecutor };
