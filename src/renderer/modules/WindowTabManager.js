/**
 * WindowTabManager - top-level tabs for grouping independent genome windows.
 *
 * This deliberately does not replace TabManager. TabManager remains the
 * per-genome, same-sequence multi-view system; WindowTabManager only switches
 * between existing genome BrowserWindow contexts coordinated by the main process.
 */
class WindowTabManager {
  constructor(genomeBrowser) {
    this.genomeBrowser = genomeBrowser;
    this.windowId = genomeBrowser?.windowId || null;
    this.snapshot = null;
    this.root = null;
    this.tabsContainer = null;
    this.statusElement = null;
    this.fullScreenButton = null;
    const runtimePlatform =
      (typeof window.electronAPI?.platform === 'function'
        ? window.electronAPI.platform()
        : window.electronAPI?.platform) ||
      window.nodeAPI?.platform ||
      navigator.platform ||
      '';
    this.platformClass =
      runtimePlatform === 'darwin' || /mac/i.test(runtimePlatform)
        ? 'window-tabs-platform-darwin'
        : runtimePlatform === 'win32' || /win/i.test(runtimePlatform)
          ? 'window-tabs-platform-win32'
          : 'window-tabs-platform-other';

    this.initializeUI();
    this.initializeListeners();
    this.refresh();
    setTimeout(() => this.refresh(), 300);
    setTimeout(() => this.refresh(), 1200);
  }

  initializeUI() {
    if (this.root || typeof document === 'undefined') return;

    const app = document.getElementById('app') || document.body;
    if (!app) {
      setTimeout(() => this.initializeUI(), 100);
      return;
    }

    document.body.classList.add('window-tabs-titlebar', this.platformClass);
    if (navigator.windowControlsOverlay?.visible) {
      document.body.classList.add('window-tabs-titlebar-overlay');
    }

    this.root = document.createElement('div');
    this.root.id = 'windowTabBar';
    this.root.className = 'window-tab-bar';
    this.root.hidden = true;

    this.root.innerHTML = `
      <div class="window-tab-strip" id="windowTabStrip"></div>
      <div class="window-tab-actions">
        <span class="window-tab-status" id="windowTabStatus"></span>
        <button class="window-tab-icon-button" id="attachAllWindowsBtn" title="Group all genome windows">
          <i class="fas fa-object-group"></i>
        </button>
        <button class="window-tab-icon-button" id="newWindowTabBtn" title="New genome window tab">
          <i class="fas fa-plus"></i>
        </button>
        <button class="window-tab-icon-button" id="windowTabFullScreenBtn" title="Enter full screen">
          <i class="fas fa-expand"></i>
        </button>
      </div>
    `;

    app.insertBefore(this.root, app.firstElementChild);
    this.tabsContainer = this.root.querySelector('#windowTabStrip');
    this.statusElement = this.root.querySelector('#windowTabStatus');
    this.fullScreenButton = this.root.querySelector('#windowTabFullScreenBtn');

    this.root.querySelector('#attachAllWindowsBtn')?.addEventListener('click', () => this.attachAllWindows());
    this.root.querySelector('#newWindowTabBtn')?.addEventListener('click', () => this.createNewWindowTab());
    this.fullScreenButton?.addEventListener('click', () => this.toggleFullScreen());
  }

  initializeListeners() {
    const api = window.electronAPI;
    if (api?.onWindowTabsUpdated) {
      api.onWindowTabsUpdated((event, snapshot) => {
        this.render(snapshot);
      });
    } else if (window.ipcRenderer?.on) {
      window.ipcRenderer.on('window-tabs-updated', (event, snapshot) => {
        this.render(snapshot);
      });
    }
  }

  setWindowId(windowId) {
    this.windowId = windowId;
    this.refresh();
  }

  async refresh() {
    try {
      const api = window.electronAPI;
      const snapshot = api?.getWindowTabs
        ? await api.getWindowTabs()
        : window.ipcRenderer?.invoke
          ? await window.ipcRenderer.invoke('window-tabs:list')
          : null;

      if (snapshot) this.render(snapshot);
    } catch (error) {
      console.warn('[WindowTabManager] Failed to refresh window tabs:', error.message);
    }
  }

  render(snapshot) {
    if (!this.root || !this.tabsContainer) return;

    this.snapshot = snapshot || null;
    const tabs = Array.isArray(snapshot?.tabs) ? snapshot.tabs : [];
    const shouldShow = snapshot?.success !== false && tabs.length > 0;

    this.root.hidden = !shouldShow;
    if (!shouldShow) {
      this.tabsContainer.innerHTML = '';
      return;
    }

    this.tabsContainer.innerHTML = '';
    this.updateFullScreenButton(!!snapshot?.isFullScreen);

    tabs.forEach(tab => {
      const tabButton = document.createElement('button');
      tabButton.className = `window-level-tab${tab.isActive ? ' active' : ''}`;
      tabButton.type = 'button';
      tabButton.title = tab.title || tab.windowId;
      tabButton.dataset.windowId = tab.windowId;

      const icon = document.createElement('i');
      icon.className = 'fas fa-dna window-level-tab-icon';

      const title = document.createElement('span');
      title.className = 'window-level-tab-title';
      title.textContent = tab.title || tab.windowId;

      const detachButton = document.createElement('span');
      detachButton.className = 'window-level-tab-detach';
      detachButton.title = 'Detach tab to its own window';
      detachButton.innerHTML = '<i class="fas fa-external-link-alt"></i>';
      detachButton.addEventListener('click', event => {
        event.stopPropagation();
        this.detachWindowTab(tab.windowId);
      });

      tabButton.appendChild(icon);
      tabButton.appendChild(title);
      tabButton.appendChild(detachButton);

      tabButton.addEventListener('click', () => {
        if (!tab.isActive) this.switchToWindowTab(tab.windowId);
      });

      this.tabsContainer.appendChild(tabButton);
    });

    if (this.statusElement) {
      this.statusElement.textContent = '';
    }
  }

  async switchToWindowTab(windowId) {
    try {
      const result = window.electronAPI?.switchWindowTab
        ? await window.electronAPI.switchWindowTab(windowId)
        : await window.ipcRenderer.invoke('window-tabs:switch', windowId);

      if (result && result.success === false) {
        this.showError(result.error || 'Unable to switch genome window tab');
      }
    } catch (error) {
      this.showError(error.message);
    }
  }

  async detachWindowTab(windowId) {
    try {
      const result = window.electronAPI?.detachWindowTab
        ? await window.electronAPI.detachWindowTab(windowId)
        : await window.ipcRenderer.invoke('window-tabs:detach', windowId);

      if (result && result.success === false) {
        this.showError(result.error || 'Unable to detach genome window tab');
      }
    } catch (error) {
      this.showError(error.message);
    }
  }

  async attachAllWindows() {
    try {
      const result = window.electronAPI?.attachAllGenomeWindows
        ? await window.electronAPI.attachAllGenomeWindows()
        : await window.ipcRenderer.invoke('window-tabs:attach-all');

      if (result && result.success === false) {
        this.showError(result.error || 'Unable to group genome windows');
      }
    } catch (error) {
      this.showError(error.message);
    }
  }

  async createNewWindowTab() {
    try {
      const result = window.electronAPI?.createWindowLevelTab
        ? await window.electronAPI.createWindowLevelTab()
        : await window.ipcRenderer.invoke('window-tabs:new-tab');

      if (result && result.success === false) {
        this.showError(result.error || 'Unable to create genome window tab');
      }
    } catch (error) {
      this.showError(error.message);
    }
  }

  async toggleFullScreen() {
    try {
      const result = window.electronAPI?.toggleWindowTabFullScreen
        ? await window.electronAPI.toggleWindowTabFullScreen()
        : await window.ipcRenderer.invoke('window-tabs:toggle-fullscreen');

      if (result && result.success === false) {
        this.showError(result.error || 'Unable to toggle full screen');
      } else {
        this.updateFullScreenButton(!!result?.isFullScreen);
      }
    } catch (error) {
      this.showError(error.message);
    }
  }

  updateFullScreenButton(isFullScreen) {
    if (!this.fullScreenButton) return;
    this.fullScreenButton.classList.toggle('active', !!isFullScreen);
    this.fullScreenButton.title = isFullScreen ? 'Exit full screen' : 'Enter full screen';
    this.fullScreenButton.innerHTML = isFullScreen
      ? '<i class="fas fa-compress"></i>'
      : '<i class="fas fa-expand"></i>';
  }

  showError(message) {
    if (this.genomeBrowser?.showNotification) {
      this.genomeBrowser.showNotification(message, 'error');
    } else {
      console.error('[WindowTabManager]', message);
    }
  }
}

window.WindowTabManager = WindowTabManager;
