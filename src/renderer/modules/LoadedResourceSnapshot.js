/** Metadata only: sequence and annotation bodies never cross this IPC boundary. */
class LoadedResourceSnapshot {
  static collect(browser) {
    return (browser.loadedFiles || []).map((file, index) => ({
      id: file.id || file.path || `loaded:${index}`,
      type: file.type,
      name: file.name,
      path: file.path,
      size: file.size || 0,
      loadedAt: file.loadedAt || null,
      status: 'loaded',
      capabilities: { view: false, export: false, remove: false },
    }));
  }
}
if (typeof module !== 'undefined' && module.exports) module.exports = LoadedResourceSnapshot;
else window.LoadedResourceSnapshot = LoadedResourceSnapshot;
