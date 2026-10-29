'use strict';

const fs = require('fs/promises');
const path = require('path');
const semver = require('semver');
const { pathToFileURL } = require('url');

const RELEASES_URL = 'https://github.com/Scilence2022/CodeXomics/releases';
const INITIAL_CHECK_DELAY_MS = 15000;
const CHECK_INTERVAL_MS = 6 * 60 * 60 * 1000;
const BUSY_PHASES = new Set(['checking', 'downloading', 'cancelling', 'verifying', 'installing']);

function describeError(error) {
  const message = `${error?.code || ''} ${error?.message || error || 'Unknown error'}`;
  if (/sha512|checksum|signature/i.test(message)) {
    return 'The update could not be verified. It has not been installed. Retry the download or use the official releases page.';
  }
  if (/ENOSPC|disk.*space/i.test(message)) {
    return 'There is not enough disk space to download the update. Free some space and try again.';
  }
  if (/EACCES|EPERM|permission|read.only/i.test(message)) {
    return 'The update location is not writable. Check installation permissions; on macOS, move CodeXomics to Applications and reopen it.';
  }
  if (/404|CHANNEL_FILE|NO_PUBLISHED|LATEST_VERSION|ENOENT/i.test(message)) {
    return 'The release feed or an update file is unavailable. Try again later or download from the official releases page.';
  }
  if (/429|403|rate.limit/i.test(message)) {
    return 'The update server refused the request or its rate limit was reached. Try again later.';
  }
  return 'Could not complete the update. Check your internet connection and proxy settings, then try again. Details are recorded in the application log.';
}

class UpdateService {
  constructor(electron, options = {}) {
    this.electron = electron;
    this.platform = options.platform || process.platform;
    this.env = options.env || process.env;
    this.resourcesPath = options.resourcesPath || process.resourcesPath;
    this.readFile = options.readFile || fs.readFile;
    this.loadUpdater = options.loadUpdater || (() => require('electron-updater').autoUpdater);
    this.makeToken = options.makeToken || (() => new (require('builder-util-runtime').CancellationToken)());
    this.logger = options.logger || console;
    this.window = null;
    this.updater = null;
    this.initPromise = null;
    this.checkPromise = null;
    this.downloadPromise = null;
    this.timer = null;
    this.token = null;
    this.disposed = false;
    this.listeners = [];
    this.state = {
      phase: 'idle',
      revision: 0,
      currentVersion: electron.app.getVersion(),
      version: null,
      releaseNotes: '',
      progress: null,
      message: '',
      lastChecked: null,
      installOnQuit: this.platform === 'darwin',
    };
    this.onQuit = () => this.dispose();
  }

  setState(patch) {
    if (this.disposed) return;
    Object.assign(this.state, patch);
    this.state.revision++;
    if (this.window && !this.window.isDestroyed()) {
      try {
        this.window.webContents.send('updater:state', this.getState());
        const progress = this.state.progress;
        this.window.setProgressBar(this.state.phase === 'downloading' ? (progress ? progress.percent / 100 : 2) : -1);
      } catch (error) {
        this.logger.warn('[updater] Could not display update status:', error.message);
      }
    }
  }

  getState() {
    return { ...this.state, progress: this.state.progress ? { ...this.state.progress } : null };
  }

  async unsupportedReason() {
    if (!this.electron.app.isPackaged) {
      return 'Update checks are available in installed release builds. This is a development build.';
    }
    if (process.mas || process.windowsStore || this.env.SNAP || this.env.FLATPAK_ID) {
      return 'This installation is managed by an app store or package manager. Update CodeXomics through that service.';
    }
    if (this.platform === 'win32' && this.env.PORTABLE_EXECUTABLE_FILE) {
      return 'Portable editions cannot install updates automatically. Download the latest portable edition from the official releases page.';
    }
    if (this.platform === 'linux' && !this.env.APPIMAGE) {
      // An unpacked Linux directory looks packaged, but AppImageUpdater skips it.
      let packageType;
      try {
        packageType = (await this.readFile(path.join(this.resourcesPath, 'package-type'), 'utf8')).trim();
      } catch (error) {
        if (error.code !== 'ENOENT') this.logger.warn('[updater] Could not read package type:', error.message);
      }
      if (!['deb', 'rpm', 'pacman'].includes(packageType)) {
        return 'This Linux package does not support in-app updates. Use your package manager or download an AppImage from the official releases page.';
      }
    }
    return null;
  }

  init() {
    if (this.disposed) return Promise.resolve(false);
    if (!this.initPromise) this.initPromise = this.initialize();
    return this.initPromise;
  }

  async initialize() {
    try {
      const reason = await this.unsupportedReason();
      if (this.disposed) return false;
      if (reason) {
        this.setState({ phase: 'unsupported', message: reason });
        return false;
      }
      const updater = this.loadUpdater();
      this.updater = updater;
      try {
        updater.logger = require('electron-log/main');
      } catch (error) {
        updater.logger = this.logger;
      }
      // Own the download promise: on macOS update-downloaded is emitted BEFORE
      // Squirrel finishes verifying/staging the update, so it is not yet ready.
      updater.autoDownload = false;
      // macOS needs native staging. Other targets only install on an explicit
      // restart, avoiding an unattended installer during an OS shutdown.
      updater.autoInstallOnAppQuit = this.state.installOnQuit;
      updater.autoRunAppAfterInstall = true;
      updater.allowDowngrade = false;
      updater.allowPrerelease = semver.prerelease(this.state.currentVersion) !== null;
      updater.disableWebInstaller = true;
      const { UpdateHttpExecutor } = require('./update-http-executor');
      if (updater.httpExecutor) {
        updater.httpExecutor = new UpdateHttpExecutor(updater.httpExecutor.proxyLoginCallback);
      }
      this.listen('error', error => this.fail(error));
      this.listen('download-progress', progress => {
        if (this.state.phase !== 'downloading') return;
        const finite = value => (Number.isFinite(value) ? Math.max(0, value) : 0);
        this.setState({
          progress: {
            percent: Math.min(100, finite(progress.percent)),
            transferred: finite(progress.transferred),
            total: finite(progress.total),
            bytesPerSecond: finite(progress.bytesPerSecond),
          },
        });
      });
      this.listen('update-downloaded', () => {
        if (this.state.phase === 'downloading') {
          this.setState({ phase: 'verifying', progress: null });
          this.nativeVerification?.start();
        }
      });
      this.electron.app.once('will-quit', this.onQuit);
      this.schedule(INITIAL_CHECK_DELAY_MS);
      return true;
    } catch (error) {
      this.fail(error);
      this.initPromise = null;
      return false;
    }
  }

  listen(event, handler) {
    this.updater.on(event, handler);
    this.listeners.push([event, handler]);
  }

  schedule(delay = CHECK_INTERVAL_MS) {
    clearTimeout(this.timer);
    if (this.disposed) return;
    this.timer = setTimeout(async () => {
      this.timer = null;
      await this.check();
      if (!this.disposed) this.schedule();
    }, delay);
    this.timer.unref?.();
  }

  async check(manual = false) {
    if (this.disposed) return this.getState();
    if (manual) this.showWindow();
    const supported = await this.init();
    if (!supported || this.disposed) return this.getState();
    if (
      this.checkPromise ||
      this.downloadPromise ||
      BUSY_PHASES.has(this.state.phase) ||
      this.state.phase === 'ready' ||
      (manual && this.state.phase === 'available')
    ) {
      return this.getState();
    }
    clearTimeout(this.timer);
    this.timer = null;
    this.setState({ phase: 'checking', message: '', progress: null, version: null, releaseNotes: '' });
    this.checkPromise = this.performCheck();
    try {
      await this.checkPromise;
    } finally {
      this.checkPromise = null;
      if (!this.disposed) this.schedule();
    }
    return this.getState();
  }

  async performCheck() {
    try {
      const result = await this.updater.checkForUpdates();
      if (this.disposed) return;
      if (!result) {
        this.setState({
          phase: 'unsupported',
          message:
            'The updater is disabled for this installation. Use the official releases page or your package manager.',
        });
        return;
      }
      const info = result.updateInfo;
      if (!info || !semver.valid(info.version)) throw new Error('Invalid version in the update feed');
      const lastChecked = new Date().toISOString();
      if (!result.isUpdateAvailable) {
        this.setState({ phase: 'current', lastChecked });
        return;
      }
      if (
        !semver.gt(info.version, this.state.currentVersion) ||
        (!this.updater.allowPrerelease && semver.prerelease(info.version))
      ) {
        throw new Error('The update feed offered an unexpected release version');
      }
      if (
        !Array.isArray(info.files) ||
        !info.files.length ||
        info.files.some(file => {
          if (typeof file.sha512 !== 'string' || !/^[A-Za-z0-9+/]{86}==$/.test(file.sha512)) return true;
          if (typeof file.url !== 'string') return true;
          // A relative artifact path is resolved against the HTTPS GitHub feed.
          const url = new URL(file.url, `${RELEASES_URL}/`);
          return url.protocol !== 'https:';
        })
      ) {
        throw new Error('Invalid update files or missing SHA512 checksum in the release feed');
      }
      const notes = Array.isArray(info.releaseNotes)
        ? info.releaseNotes.map(note => note.note || '').join('\n\n')
        : info.releaseNotes;
      this.setState({
        phase: 'available',
        version: info.version,
        releaseNotes: String(notes || '').slice(0, 20000),
        lastChecked,
      });
      this.showWindow(false);
    } catch (error) {
      this.fail(error);
    }
  }

  async download() {
    if (this.disposed || this.state.phase !== 'available' || this.downloadPromise) return this.getState();
    try {
      this.token = this.makeToken();
    } catch (error) {
      this.fail(error);
      return this.getState();
    }
    this.setState({ phase: 'downloading', message: '', progress: null });
    this.downloadPromise = this.performDownload();
    try {
      await this.downloadPromise;
    } finally {
      this.downloadPromise = null;
      this.token = null;
    }
    return this.getState();
  }

  async performDownload() {
    try {
      // In updater 6.x even downloadUpdate's promise resolves when the local
      // HTTP stream finishes, BEFORE Squirrel validates the app signature.
      // Only Electron's native event proves macOS has staged a valid update.
      this.nativeVerification = this.platform === 'darwin' ? this.waitForNativeVerification() : null;
      await Promise.all([this.updater.downloadUpdate(this.token), this.nativeVerification?.promise]);
      if (this.disposed) return;
      if (this.token.cancelled) {
        this.setState({
          phase: 'available',
          progress: null,
          message: 'Download cancelled. You can try again when ready.',
        });
      } else if (this.state.phase !== 'error') {
        this.setState({ phase: 'ready', progress: null });
        this.showWindow(false);
      }
    } catch (error) {
      if (this.token?.cancelled || error?.name === 'CancellationError') {
        this.setState({
          phase: 'available',
          progress: null,
          message: 'Download cancelled. You can try again when ready.',
        });
      } else {
        this.fail(error);
      }
    } finally {
      this.nativeVerification?.dispose();
      this.nativeVerification = null;
    }
  }

  waitForNativeVerification() {
    const native = this.electron.autoUpdater;
    if (!native) throw new Error('Native signature verification is unavailable');
    let timer;
    let resolve;
    let reject;
    const promise = new Promise((yes, no) => {
      resolve = yes;
      reject = no;
    });
    const complete = () => resolve();
    const failed = error => reject(error);
    native.once('update-downloaded', complete);
    native.once('error', failed);
    return {
      promise,
      start: () => {
        clearTimeout(timer);
        timer = setTimeout(() => reject(new Error('Native signature verification timed out')), 5 * 60 * 1000);
        timer.unref?.();
      },
      cancel: () => reject(Object.assign(new Error('Cancelled'), { name: 'CancellationError' })),
      dispose: () => {
        clearTimeout(timer);
        native.removeListener('update-downloaded', complete);
        native.removeListener('error', failed);
      },
    };
  }

  cancel() {
    if (this.state.phase === 'downloading' && this.token) {
      this.setState({ phase: 'cancelling', message: 'Cancelling download…' });
      this.token.cancel();
    }
    return this.getState();
  }

  async install() {
    if (this.disposed || this.state.phase !== 'ready') return this.getState();
    this.setState({ phase: 'installing' });
    try {
      const options = {
        type: 'warning',
        title: 'Restart to Install Update',
        message: `Install CodeXomics ${this.state.version} and restart?`,
        detail:
          'Save your work in all CodeXomics windows before continuing. All application windows will close. The installer may request administrator permission.',
        buttons: ['Restart and Install', 'Cancel'],
        defaultId: 1,
        cancelId: 1,
      };
      const result =
        this.window && !this.window.isDestroyed()
          ? await this.electron.dialog.showMessageBox(this.window, options)
          : await this.electron.dialog.showMessageBox(options);
      if (this.disposed) return this.getState();
      if (this.state.phase !== 'installing') return this.getState();
      if (result.response !== 0) this.setState({ phase: 'ready' });
      else this.updater.quitAndInstall(false, true);
    } catch (error) {
      this.fail(error);
    }
    return this.getState();
  }

  fail(error) {
    this.logger.error('[updater]', error?.stack || error);
    if (this.disposed) return;
    // The library both emits and rejects errors. Updating one status window
    // makes that idempotent without duplicate error dialogs.
    this.setState({ phase: 'error', message: describeError(error), progress: null });
  }

  showWindow(focus = true) {
    if (this.disposed) return;
    try {
      if (this.window && !this.window.isDestroyed()) {
        if (focus) {
          this.window.show();
          this.window.focus();
        }
        return;
      }
      const { BrowserWindow, ipcMain } = this.electron;
      const window = new BrowserWindow({
        title: 'CodeXomics Updates',
        width: 540,
        height: 560,
        minWidth: 440,
        minHeight: 440,
        show: false,
        autoHideMenuBar: true,
        webPreferences: {
          preload: path.join(__dirname, 'update-preload.js'),
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      this.window = window;
      window.setMenu(null);
      const page = path.join(__dirname, '../renderer/updates.html');
      const pageUrl = pathToFileURL(page).href;
      ipcMain.handle('updater:action', async (event, action) => {
        if (
          event.sender !== window.webContents ||
          event.senderFrame !== window.webContents.mainFrame ||
          event.senderFrame.url !== pageUrl
        ) {
          throw new Error('Update action is not allowed from this window');
        }
        switch (action) {
          case 'state':
            return this.getState();
          case 'check':
            void this.check(true);
            break;
          case 'download':
            void this.download();
            break;
          case 'cancel':
            this.cancel();
            break;
          case 'install':
            void this.install();
            break;
          case 'releases':
            await this.electron.shell.openExternal(RELEASES_URL);
            break;
          default:
            throw new Error('Unknown update action');
        }
        return this.getState();
      });
      window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
      window.webContents.on('will-navigate', event => event.preventDefault());
      window.once('ready-to-show', () => {
        if (focus) window.show();
        else window.showInactive();
      });
      window.once('closed', () => {
        ipcMain.removeHandler('updater:action');
        if (this.window === window) this.window = null;
      });
      window.loadFile(page).catch(error => this.logger.error('[updater] Could not load update window:', error));
    } catch (error) {
      this.logger.error('[updater] Could not open update window:', error);
    }
  }

  dispose() {
    this.disposed = true;
    clearTimeout(this.timer);
    this.timer = null;
    this.token?.cancel();
    this.nativeVerification?.cancel();
    this.electron.app.removeListener('will-quit', this.onQuit);
    // Keep error listeners until process exit: a cancelled transfer can still
    // emit an error, and EventEmitter would otherwise throw during shutdown.
    for (const [event, handler] of this.listeners) {
      if (event !== 'error') this.updater.removeListener(event, handler);
    }
    this.listeners = [];
  }
}

module.exports = { UpdateService, describeError, RELEASES_URL, INITIAL_CHECK_DELAY_MS, CHECK_INTERVAL_MS };
