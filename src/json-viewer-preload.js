'use strict';

const { contextBridge, ipcRenderer } = require('electron');

let hasSubscription = false;

contextBridge.exposeInMainWorld(
  'dgrJsonViewer',
  Object.freeze({
    onData(callback) {
      if (typeof callback !== 'function') {
        throw new TypeError('DGR JSON viewer onData requires a callback');
      }
      if (hasSubscription) {
        throw new Error('DGR JSON viewer data listener is already registered');
      }

      hasSubscription = true;
      const listener = (_event, payload) => {
        const safePayload = Object.freeze({
          content: typeof payload?.content === 'string' ? payload.content : '',
          fileName: typeof payload?.fileName === 'string' ? payload.fileName.slice(0, 512) : '',
          sha256: typeof payload?.sha256 === 'string' ? payload.sha256.slice(0, 64) : '',
          size: Number.isFinite(Number(payload?.size)) ? Number(payload.size) : 0,
          title: typeof payload?.title === 'string' ? payload.title.slice(0, 256) : '',
        });
        callback(safePayload);
      };

      ipcRenderer.once('json-viewer:data', listener);
      return () => ipcRenderer.removeListener('json-viewer:data', listener);
    },
  })
);
