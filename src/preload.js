const { contextBridge, ipcRenderer } = require('electron');

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld('electronAPI', {
  // Resource management APIs
  getLoadedResources: () => ipcRenderer.invoke('get-loaded-resources'),
  refreshResources: () => ipcRenderer.invoke('refresh-resources'),
  removeResource: (resourceId) => ipcRenderer.invoke('remove-resource', resourceId),
  exportResource: (resourceId, options) => ipcRenderer.invoke('export-resource', resourceId, options),
  openResourceInBrowser: (resourceId) => ipcRenderer.invoke('open-resource-in-browser', resourceId),
  
  // File operations
  selectAndLoadFile: () => ipcRenderer.invoke('select-and-load-file'),
  getFileInfo: (filePath) => ipcRenderer.invoke('get-file-info', filePath),
  
  // Project Manager APIs
  selectProjectDirectory: () => ipcRenderer.invoke('selectProjectDirectory'),
  selectProjectFile: () => ipcRenderer.invoke('selectProjectFile'),
  selectMultipleFiles: () => ipcRenderer.invoke('selectMultipleFiles'),
  createProjectDirectory: (location, projectName) => ipcRenderer.invoke('createProjectDirectory', location, projectName),
  loadProjectFile: (filePath) => ipcRenderer.invoke('loadProjectFile', filePath),
  openFileInMainWindow: (filePath) => ipcRenderer.invoke('openFileInMainWindow', filePath),
  saveProjectsData: (projectsData) => ipcRenderer.invoke('saveProjectsData', projectsData),
  loadProjectsData: () => ipcRenderer.invoke('loadProjectsData'),
  saveProjectSettings: (settings) => ipcRenderer.invoke('saveProjectSettings', settings),
  loadProjectSettings: () => ipcRenderer.invoke('loadProjectSettings'),
  
  // Enhanced File Opening APIs
  checkMainWindowStatus: () => ipcRenderer.invoke('checkMainWindowStatus'),
  createNewMainWindow: (filePath) => ipcRenderer.invoke('createNewMainWindow', filePath),
  
  // File Save APIs
  saveFile: (fileName, content) => ipcRenderer.invoke('saveFile', fileName, content),
      saveProjectFile: (defaultPath, content) => ipcRenderer.invoke('saveProjectFile', defaultPath, content),
    createTempFile: (fileName, content) => ipcRenderer.invoke('createTempFile', fileName, content),
    getFileInfo: (filePath) => ipcRenderer.invoke('getFileInfo', filePath),
  
  // Communication with main window
  sendToMainWindow: (channel, data) => ipcRenderer.invoke('send-to-main-window', channel, data),
  
  // Window management
  closeWindow: () => ipcRenderer.send('close-resource-manager'),
  
  // Event listeners
  onResourceUpdate: (callback) => {
    ipcRenderer.on('resource-update', callback);
  },
  
  onResourceRemoved: (callback) => {
    ipcRenderer.on('resource-removed', callback);
  },
  
  onResourceAdded: (callback) => {
    ipcRenderer.on('resource-added', callback);
  },
  
  // Remove listeners
  removeAllListeners: (channel) => {
    ipcRenderer.removeAllListeners(channel);
  }
});

// Provide access to node process information (for development)
contextBridge.exposeInMainWorld('nodeAPI', {
  platform: process.platform,
  version: process.version
});

console.log('Resource Manager preload script loaded'); 