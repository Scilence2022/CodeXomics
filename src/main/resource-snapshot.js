const crypto = require('crypto');

/** Request current loaded-file state from the selected genome view. */
function requestResourceSnapshot(ipcMain, target, timeoutMs = 5000) {
  if (!target?.webContents || target.webContents.isDestroyed?.()) {
    return Promise.reject(new Error('No active genome window'));
  }
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      clearTimeout(timer);
      ipcMain.removeListener('resource-info-response', receive);
    };
    const receive = (event, response) => {
      if (event.sender !== target.webContents || response?.requestId !== requestId) return;
      cleanup();
      if (!Array.isArray(response.resources)) reject(new Error('Invalid resource snapshot'));
      else resolve({ success: true, resources: response.resources });
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Resource snapshot timed out'));
    }, timeoutMs);
    ipcMain.on('resource-info-response', receive);
    try {
      target.webContents.send('collect-resource-info', { requestId });
    } catch (error) {
      cleanup();
      reject(error);
    }
  });
}
module.exports = { requestResourceSnapshot };
