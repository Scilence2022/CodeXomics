const path = require('path');
const { isMainFrameAtFile } = require('./security-utils');

const plotterPage = path.join(__dirname, '..', 'circos-plotter.html');
const plotterSources = new WeakMap();

function bindCircosSource(plotter, source) {
  const contents = plotter.webContents;
  const id = String(contents.id);
  plotterSources.set(contents, { id, source });
  plotter.once('closed', () => {
    if (source && !source.isDestroyed() && !source.webContents.isDestroyed()) {
      source.webContents.executeJavaScript(`window.circosGenome?.close(${JSON.stringify(id)})`).catch(() => {});
    }
  });
}

function registerCircosIpc(ipcMain) {
  const register = (channel, action, validate) => {
    ipcMain.handle(channel, async (event, input) => {
      try {
        const binding = plotterSources.get(event.sender);
        if (!binding || !isMainFrameAtFile(event, plotterPage)) throw new Error('Invalid Circos window.');
        const { source, id } = binding;
        if (!source || source.isDestroyed() || source.webContents.isDestroyed()) {
          throw new Error('The source genome window is closed. Open Circos from a genome window.');
        }
        const args = validate ? validate(input) : null;
        const result = await source.webContents.executeJavaScript(`
          (async () => {
            try {
              const result = await window.circosGenome.${action}(${JSON.stringify(id)}, ${JSON.stringify(args)});
              return { success: true, ...result };
            } catch (error) {
              return { success: false, error: error.message };
            }
          })()
        `);
        if (action === 'navigate' && result.success) source.focus();
        return result;
      } catch (error) {
        return { success: false, error: error.message };
      }
    });
  };

  register('get-circos-genome-data', 'load');
  register('get-circos-tracks', 'tracks', input => {
    const size = input?.windowSize;
    if (Number.isSafeInteger(size) && size >= 1000 && size <= 50000) return { windowSize: size };
    if (typeof input?.wigName === 'string' && input.wigName) return { wigName: input.wigName };
    throw new Error('Invalid Circos track request.');
  });
  register('circos-navigate', 'navigate', input => {
    const { chromosome, start, end } = input || {};
    if (typeof chromosome !== 'string' || !chromosome) throw new Error('Invalid chromosome.');
    if (start === undefined && end === undefined) return { chromosome };
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) throw new Error('Invalid feature coordinates.');
    return { chromosome, start, end };
  });
}

module.exports = { bindCircosSource, registerCircosIpc };
