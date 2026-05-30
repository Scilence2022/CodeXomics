/**
 * Electron module mock for testing
 * Simulates the Electron API surface used in CodeXomics
 */

module.exports = {
  app: {
    getPath: vi.fn(name => `/mock/${name}`),
    getVersion: vi.fn(() => '0.6.0-beta'),
    getName: vi.fn(() => 'CodeXomics'),
    quit: vi.fn(),
    on: vi.fn(),
    whenReady: vi.fn(() => Promise.resolve()),
  },
  BrowserWindow: vi.fn().mockImplementation(() => ({
    loadFile: vi.fn(),
    loadURL: vi.fn(),
    on: vi.fn(),
    webContents: {
      on: vi.fn(),
      send: vi.fn(),
      openDevTools: vi.fn(),
    },
    close: vi.fn(),
    destroy: vi.fn(),
    show: vi.fn(),
    hide: vi.fn(),
  })),
  ipcMain: {
    handle: vi.fn(),
    on: vi.fn(),
    removeHandler: vi.fn(),
  },
  ipcRenderer: {
    invoke: vi.fn(),
    on: vi.fn(),
    send: vi.fn(),
    removeAllListeners: vi.fn(),
  },
  dialog: {
    showOpenDialog: vi.fn(),
    showSaveDialog: vi.fn(),
    showMessageBox: vi.fn(),
  },
  Menu: {
    buildFromTemplate: vi.fn(),
    setApplicationMenu: vi.fn(),
  },
  shell: {
    openExternal: vi.fn(),
    openPath: vi.fn(),
  },
  contextBridge: {
    exposeInMainWorld: vi.fn(),
  },
};

const vi = {
  fn: () => jest_fn(),
};

function jest_fn() {
  const fn = function (...args) {
    fn._calls.push(args);
    return fn._returnVal;
  };
  fn._calls = [];
  fn._returnVal = undefined;
  fn.mockReturnValue = val => {
    fn._returnVal = val;
    return fn;
  };
  fn.mockResolvedValue = val => {
    fn._returnVal = Promise.resolve(val);
    return fn;
  };
  fn.mockImplementation = impl => {
    return Object.assign(fn, impl);
  };
  return fn;
}
