const ACTIONS = new Set([
  'open',
  'loadProjectFromFile',
  'saveCurrentProject',
  'saveProjectAs',
  'exportProjectAsXML',
  'clearRecentProjects',
]);
async function dispatchProjectManagerAction(createWindow, options = {}) {
  const action = options.action || 'open';
  if (!ACTIONS.has(action)) throw new Error('Unsupported Project Manager action');
  const target = createWindow();
  if (!target || target.isDestroyed?.()) throw new Error('Project Manager window unavailable');
  if (target.webContents.isLoading()) {
    await new Promise((resolve, reject) => {
      const loaded = () => {
        cleanup();
        resolve();
      };
      const failed = () => {
        cleanup();
        reject(new Error('Project Manager failed to load'));
      };
      const cleanup = () => {
        clearTimeout(timer);
        target.webContents.removeListener('did-finish-load', loaded);
        target.webContents.removeListener('did-fail-load', failed);
      };
      const timer = setTimeout(failed, 10000);
      target.webContents.once('did-finish-load', loaded);
      target.webContents.once('did-fail-load', failed);
    });
  }
  if (action !== 'open') target.webContents.send('project-manager-action', { action, filePath: options.filePath });
  return { success: true, action: 'requested' };
}
module.exports = { dispatchProjectManagerAction };
