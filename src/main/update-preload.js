'use strict';

const { contextBridge, ipcRenderer } = require('electron');
const actions = new Set(['state', 'check', 'download', 'cancel', 'install', 'releases']);

contextBridge.exposeInMainWorld('codeXomicsUpdater', {
  action: action => {
    if (!actions.has(action)) return Promise.reject(new Error('Unknown update action'));
    return ipcRenderer.invoke('updater:action', action);
  },
  onState: callback => {
    const listener = (_event, state) => callback(state);
    ipcRenderer.on('updater:state', listener);
    return () => ipcRenderer.removeListener('updater:state', listener);
  },
});
