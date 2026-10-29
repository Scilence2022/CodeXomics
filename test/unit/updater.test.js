import { createRequire } from 'node:module';
import { EventEmitter } from 'node:events';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

const require = createRequire(import.meta.url);
const {
  UpdateService,
  describeError,
  INITIAL_CHECK_DELAY_MS,
  CHECK_INTERVAL_MS,
  RELEASES_URL,
} = require('../../src/main/update-service');
const { UpdateHttpExecutor } = require('../../src/main/update-http-executor');
const digest = Buffer.alloc(64, 1).toString('base64');
const release = (version = '0.723.0') => ({
  isUpdateAvailable: true,
  updateInfo: {
    version,
    files: [{ url: 'CodeXomics.zip', sha512: digest }],
    releaseNotes: '<script>untrusted()</script>',
  },
});
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
};

describe('Application updater', () => {
  let service;
  let updater;
  let electron;
  let window;
  let handler;

  beforeEach(() => {
    vi.useFakeTimers();
    updater = new EventEmitter();
    updater.checkForUpdates = vi
      .fn()
      .mockResolvedValue({ isUpdateAvailable: false, updateInfo: { version: '0.722.0' } });
    updater.downloadUpdate = vi.fn().mockResolvedValue(['/cache/update']);
    updater.quitAndInstall = vi.fn();
    const app = new EventEmitter();
    app.isPackaged = true;
    app.getVersion = () => '0.722.0';
    electron = {
      app,
      autoUpdater: new EventEmitter(),
      ipcMain: {
        handle: vi.fn((_channel, callback) => {
          handler = callback;
        }),
        removeHandler: vi.fn(),
      },
      shell: { openExternal: vi.fn().mockResolvedValue(undefined) },
      dialog: { showMessageBox: vi.fn().mockResolvedValue({ response: 1 }) },
      BrowserWindow: vi.fn(function (options) {
        window = new EventEmitter();
        window.options = options;
        window.webContents = new EventEmitter();
        window.webContents.mainFrame = { url: new URL('../../src/renderer/updates.html', import.meta.url).href };
        window.webContents.send = vi.fn();
        window.webContents.setWindowOpenHandler = vi.fn();
        for (const method of ['setMenu', 'setProgressBar', 'show', 'showInactive', 'focus']) window[method] = vi.fn();
        window.isDestroyed = () => false;
        window.loadFile = vi.fn(file => {
          window.webContents.mainFrame.url = require('node:url').pathToFileURL(file).href;
          return Promise.resolve();
        });
        return window;
      }),
    };
    service = new UpdateService(electron, {
      platform: 'win32',
      env: {},
      loadUpdater: () => updater,
      logger: { error: vi.fn(), warn: vi.fn() },
    });
  });

  afterEach(() => {
    service.dispose();
    vi.useRealTimers();
  });

  it('initializes once, checks after startup and repeats for long-running sessions', async () => {
    await Promise.all([service.init(), service.init()]);
    expect(updater.listenerCount('error')).toBe(1);
    expect(updater.autoDownload).toBe(false);
    expect(updater.allowDowngrade).toBe(false);
    expect(updater.allowPrerelease).toBe(false);
    expect(updater.autoInstallOnAppQuit).toBe(false);
    await vi.advanceTimersByTimeAsync(INITIAL_CHECK_DELAY_MS);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    expect(service.state.phase).toBe('current');
    expect(electron.BrowserWindow).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('opens one window immediately and coalesces repeated manual/startup checks', async () => {
    const pending = deferred();
    updater.checkForUpdates.mockReturnValue(pending.promise);
    const check = service.check(true);
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    await service.check(true);
    expect(electron.BrowserWindow).toHaveBeenCalledTimes(1);
    expect(service.state.phase).toBe('checking');
    await vi.advanceTimersByTimeAsync(INITIAL_CHECK_DELAY_MS);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    pending.resolve({ isUpdateAvailable: false, updateInfo: { version: '0.722.0' } });
    await check;
    expect(service.state.phase).toBe('current');
  });

  it('surfaces network errors without duplicate dialogs and permits a retry', async () => {
    const failure = new Error('net::ERR_INTERNET_DISCONNECTED');
    updater.checkForUpdates.mockImplementationOnce(() => {
      updater.emit('error', failure);
      return Promise.reject(failure);
    });
    await service.check(true);
    expect(service.state.phase).toBe('error');
    expect(service.state.message).toContain('internet connection');
    expect(electron.dialog.showMessageBox).not.toHaveBeenCalled();
    await service.check(true);
    expect(service.state.phase).toBe('current');
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(2);
  });

  it('can recover from an initialization failure', async () => {
    service.loadUpdater = vi
      .fn()
      .mockImplementationOnce(() => {
        throw new Error('cannot initialize');
      })
      .mockReturnValue(updater);
    await service.check(true);
    expect(service.state.phase).toBe('error');
    await service.check(true);
    expect(service.state.phase).toBe('current');
  });

  it.each([
    ['development', { packaged: false }, 'development build'],
    ['portable', { env: { PORTABLE_EXECUTABLE_FILE: 'portable.exe' } }, 'Portable'],
    ['Snap', { platform: 'linux', env: { SNAP: '/snap/app' } }, 'package manager'],
    ['Flatpak', { platform: 'linux', env: { FLATPAK_ID: 'org.app' } }, 'package manager'],
    ['unpacked Linux', { platform: 'linux' }, 'does not support'],
  ])('explains %s installations without loading or invoking the updater', async (_name, options, message) => {
    electron.app.isPackaged = options.packaged ?? true;
    service.platform = options.platform || 'win32';
    service.env = options.env || {};
    service.readFile = vi.fn().mockRejectedValue(Object.assign(new Error('missing'), { code: 'ENOENT' }));
    service.resourcesPath = '/resources';
    const load = vi.spyOn(service, 'loadUpdater');
    await service.check(true);
    expect(service.state).toMatchObject({ phase: 'unsupported', message: expect.stringContaining(message) });
    expect(load).not.toHaveBeenCalled();
    expect(updater.checkForUpdates).not.toHaveBeenCalled();
  });

  it.each(['AppImage', 'deb'])('supports the Linux %s package', async type => {
    service.platform = 'linux';
    service.env = type === 'AppImage' ? { APPIMAGE: '/app/image' } : {};
    service.resourcesPath = '/resources';
    service.readFile = vi.fn().mockResolvedValue('deb\n');
    await service.check();
    expect(service.state.phase).toBe('current');
  });

  it('does not misreport an inactive updater as up to date', async () => {
    updater.checkForUpdates.mockResolvedValue(null);
    await service.check(true);
    expect(service.state.phase).toBe('unsupported');
  });

  it.each(['0.721.0', '0.723.0-beta.1', 'invalid'])('rejects an unexpected offered version %s', async version => {
    updater.checkForUpdates.mockResolvedValue(release(version));
    await service.check(true);
    expect(service.state.phase).toBe('error');
    expect(updater.downloadUpdate).not.toHaveBeenCalled();
  });

  it.each([[{ url: 'app.zip' }], [{ url: 'http://example.com/app.zip', sha512: digest }], []])(
    'rejects unsigned metadata or insecure download files %j',
    async files => {
      const result = release();
      result.updateInfo.files = files;
      updater.checkForUpdates.mockResolvedValue(result);
      await service.check();
      expect(service.state.phase).toBe('error');
    }
  );

  it('keeps available/ready states across menu clicks and waits for macOS verification', async () => {
    service.platform = 'darwin';
    service.state.installOnQuit = true;
    updater.checkForUpdates.mockResolvedValue(release());
    await service.check();
    expect(service.state.phase).toBe('available');
    expect(updater.autoInstallOnAppQuit).toBe(true);
    expect(updater.downloadUpdate).not.toHaveBeenCalled();
    window.emit('ready-to-show');
    expect(window.showInactive).toHaveBeenCalled();
    const pending = deferred();
    updater.downloadUpdate.mockReturnValue(pending.promise);
    const download = service.download();
    updater.emit('download-progress', { percent: 35, transferred: 350, total: 1000, bytesPerSecond: 70 });
    expect(service.state.progress.percent).toBe(35);
    updater.emit('update-downloaded', { version: '0.723.0' });
    expect(service.state.phase).toBe('verifying');
    await service.install();
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
    await service.check(true);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
    pending.resolve(['/cache/update']);
    await Promise.resolve();
    expect(service.state.phase).toBe('verifying');
    electron.autoUpdater.emit('update-downloaded');
    await download;
    expect(service.state.phase).toBe('ready');
    await service.check(true);
    expect(service.state.phase).toBe('ready');
  });

  it('cancels a download and allows another attempt after cleanup', async () => {
    updater.checkForUpdates.mockResolvedValue(release());
    await service.check();
    const pending = deferred();
    updater.downloadUpdate.mockReturnValueOnce(pending.promise);
    const download = service.download();
    await service.download();
    expect(updater.downloadUpdate).toHaveBeenCalledTimes(1);
    const token = service.token;
    service.cancel();
    expect(token.cancelled).toBe(true);
    expect(service.state.phase).toBe('cancelling');
    pending.reject(Object.assign(new Error('cancelled'), { name: 'CancellationError' }));
    await download;
    expect(service.state.phase).toBe('available');
    expect(service.token).toBeNull();
    await service.download();
    expect(service.state.phase).toBe('ready');
  });

  it('handles a macOS signature rejection after the local ZIP stream has finished', async () => {
    service.platform = 'darwin';
    service.state.installOnQuit = true;
    updater.checkForUpdates.mockResolvedValue(release());
    await service.check();
    updater.downloadUpdate.mockImplementation(() => {
      updater.emit('update-downloaded', {});
      return Promise.resolve([]);
    });
    const downloading = service.download();
    await Promise.resolve();
    expect(service.state.phase).toBe('verifying');
    electron.autoUpdater.emit('error', new Error('Code signature invalid'));
    await downloading;
    expect(service.state.phase).toBe('error');
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
    expect(electron.autoUpdater.listenerCount('update-downloaded')).toBe(0);
  });

  it('times out native staging without offering an unverified installer', async () => {
    service.platform = 'darwin';
    updater.checkForUpdates.mockResolvedValue(release());
    await service.check();
    updater.downloadUpdate.mockImplementation(() => {
      updater.emit('update-downloaded', {});
      return Promise.resolve([]);
    });
    const downloading = service.download();
    await vi.advanceTimersByTimeAsync(5 * 60 * 1000);
    await downloading;
    expect(service.state.phase).toBe('error');
    expect(electron.autoUpdater.listenerCount('update-downloaded')).toBe(0);
  });

  it('never offers installation when native verification rejects after the download event', async () => {
    updater.checkForUpdates.mockResolvedValue(release());
    await service.check();
    updater.downloadUpdate.mockImplementation(() => {
      updater.emit('update-downloaded', {});
      updater.emit('error', new Error('Code signature did not pass validation'));
      return Promise.reject(new Error('Code signature did not pass validation'));
    });
    await service.download();
    expect(service.state.phase).toBe('error');
    expect(service.state.message).toContain('not been installed');
    await service.install();
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
  });

  it('requires confirmation to restart and prevents two simultaneous installers', async () => {
    updater.checkForUpdates.mockResolvedValue(release());
    await service.check();
    await service.download();
    await service.install();
    expect(service.state.phase).toBe('ready');
    expect(updater.quitAndInstall).not.toHaveBeenCalled();
    const dialog = deferred();
    electron.dialog.showMessageBox.mockReturnValueOnce(dialog.promise);
    const install = service.install();
    await service.install();
    expect(electron.dialog.showMessageBox).toHaveBeenCalledTimes(2);
    dialog.resolve({ response: 0 });
    await install;
    expect(updater.quitAndInstall).toHaveBeenCalledExactlyOnceWith(false, true);
  });

  it('shows installation failures without terminating the app', async () => {
    updater.checkForUpdates.mockResolvedValue(release());
    await service.check();
    await service.download();
    electron.dialog.showMessageBox.mockResolvedValue({ response: 0 });
    updater.quitAndInstall.mockImplementation(() => {
      throw Object.assign(new Error('permission denied'), { code: 'EACCES' });
    });
    await service.install();
    expect(service.state.phase).toBe('error');
    expect(service.state.message).toContain('permissions');
  });

  it('restricts updater IPC to its own local main frame and a fixed release URL', async () => {
    await service.check(true);
    const event = { sender: window.webContents, senderFrame: window.webContents.mainFrame };
    await expect(handler({ ...event, sender: {} }, 'install')).rejects.toThrow('not allowed');
    await expect(handler({ ...event, senderFrame: { url: event.senderFrame.url } }, 'download')).rejects.toThrow(
      'not allowed'
    );
    await expect(handler(event, 'open:https://evil.test')).rejects.toThrow('Unknown');
    await handler(event, 'releases');
    expect(electron.shell.openExternal).toHaveBeenCalledExactlyOnceWith(RELEASES_URL);
    expect(window.options.webPreferences).toMatchObject({
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
    });
    window.emit('closed');
    expect(electron.ipcMain.removeHandler).toHaveBeenCalledWith('updater:action');
    expect(service.window).toBeNull();
  });

  it('cancels work on exit and ignores late results without unhandled error events', async () => {
    updater.checkForUpdates.mockResolvedValue(release());
    await service.check();
    const pending = deferred();
    updater.downloadUpdate.mockReturnValueOnce(pending.promise);
    const download = service.download();
    const token = service.token;
    electron.app.emit('will-quit');
    expect(token.cancelled).toBe(true);
    const previous = service.getState();
    pending.resolve([]);
    await download;
    updater.emit('error', new Error('late error'));
    expect(service.getState()).toEqual(previous);
    expect(service.timer).toBeNull();
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 2);
    expect(updater.checkForUpdates).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['ERR_UPDATER_CHANNEL_FILE_NOT_FOUND', 'release feed'],
    ['ENOSPC', 'disk space'],
    ['sha512 checksum mismatch', 'verified'],
    ['429 rate limit', 'rate limit'],
    ['ETIMEDOUT', 'internet'],
  ])('explains %s errors', (error, expected) => expect(describeError(new Error(error))).toContain(expected));
});

describe('Electron update request timeouts', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('aborts requests that never connect even without a Node socket event', async () => {
    const executor = new UpdateHttpExecutor();
    const request = new EventEmitter();
    request.abort = vi.fn();
    const reject = vi.fn();
    executor.addTimeOutHandler(request, reject, 1000);
    await vi.advanceTimersByTimeAsync(1000);
    expect(reject).toHaveBeenCalledWith(expect.objectContaining({ code: 'ETIMEDOUT' }));
    expect(request.abort).toHaveBeenCalledTimes(1);
  });

  it('allows long downloads while data keeps arriving and cleans up on completion', async () => {
    const executor = new UpdateHttpExecutor();
    const request = new EventEmitter();
    request.abort = vi.fn();
    const response = new EventEmitter();
    const reject = vi.fn();
    executor.addTimeOutHandler(request, reject, 1000);
    request.emit('response', response);
    for (let i = 0; i < 5; i++) {
      await vi.advanceTimersByTimeAsync(900);
      response.emit('data', Buffer.from('data'));
    }
    response.emit('end');
    await vi.advanceTimersByTimeAsync(2000);
    expect(reject).not.toHaveBeenCalled();
    expect(request.abort).not.toHaveBeenCalled();
  });

  it.each(['abort', 'error'])('cleans up a request timer on %s', async event => {
    const executor = new UpdateHttpExecutor();
    const request = new EventEmitter();
    request.abort = vi.fn();
    const reject = vi.fn();
    executor.addTimeOutHandler(request, reject, 1000);
    request.emit(event, new Error('finished'));
    await vi.advanceTimersByTimeAsync(2000);
    expect(reject).not.toHaveBeenCalled();
  });

  it('keeps timing out after Electron closes the request upload side before any response', async () => {
    const executor = new UpdateHttpExecutor();
    const request = new EventEmitter();
    request.abort = vi.fn();
    const reject = vi.fn();
    executor.addTimeOutHandler(request, reject, 1000);
    request.emit('close');
    await vi.advanceTimersByTimeAsync(1000);
    expect(reject).toHaveBeenCalledWith(expect.objectContaining({ code: 'ETIMEDOUT' }));
    expect(request.abort).toHaveBeenCalledTimes(1);
  });
});
