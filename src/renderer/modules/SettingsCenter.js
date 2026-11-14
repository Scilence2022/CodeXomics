/**
 * SettingsCenter - one window for every CodeXomics preference.
 *
 * The settings panels predate this window: each manager owns a modal
 * (generalSettingsModal, llmConfigModal, ...) and fills it in its own
 * show method. The Settings window adopts those modals instead of copying
 * them. At startup each one moves into a "host" inside #settingsCenterModal and
 * keeps its id, its listeners and its manager.
 *
 * Two rules keep the managers unaware of the move:
 * - Opening a panel still goes through the manager's show method, which
 *   loads current values and adds `.show` to its modal.
 * - Whenever an adopted modal gains `.show`, from this window or from any
 *   other caller (menus, toolbar, the AI toggle_settings_modal tool, a link
 *   in another panel), the Settings window displays that panel. A manager
 *   that hides its modal after Save leaves it in place; only this window's
 *   close button (or Escape) closes it.
 *
 * Panels with no modal of their own (Literature, BLAST+) are rendered here.
 */
class SettingsCenter {
  static GROUPS = Object.freeze([
    { id: 'general', label: 'General', color: '#64748b' },
    { id: 'view', label: 'Genome View', color: '#0284c7' },
    { id: 'ai', label: 'AI Assistant', color: '#7c3aed' },
    { id: 'tools', label: 'Tools', color: '#d97706' },
    { id: 'system', label: 'System', color: '#059669' },
  ]);

  /**
   * Where each panel lives. `modalId` hosts adopt an existing modal;
   * `native` hosts are rendered by this class.
   */
  static HOSTS = Object.freeze({
    general: { modalId: 'generalSettingsModal', hidesTabs: true },
    tabs: { modalId: 'tabSettingsModal' },
    tracks: { modalId: 'trackSettingsModal', wrapper: 'tracks' },
    geneDetails: { modalId: 'geneDetailSettingsModal' },
    search: { modalId: 'searchSettingsModal' },
    llm: { modalId: 'llmConfigModal' },
    chatbox: { modalId: 'chatboxSettingsModal' },
    agents: { modalId: 'multiAgentSettingsModal' },
    mcp: { modalId: 'mcpSettingsModal' },
    literature: { native: true, aliasModalId: 'literatureSettingsModal' },
    external: { modalId: 'externalToolsModal' },
    blast: { native: true },
    plugins: { modalId: 'pluginManagementModal' },
  });

  static PANES = Object.freeze([
    {
      id: 'general.appearance',
      group: 'general',
      host: 'general',
      tab: 'appearance',
      label: 'Appearance',
      icon: 'fa-palette',
      description: 'Language, interface style, accent color, fonts and animations.',
      keywords: ['theme', 'style', 'color', 'font', 'language', 'dark', '外观', '主题', '语言', '字体', '颜色'],
    },
    {
      id: 'general.navigation',
      group: 'general',
      host: 'general',
      tab: 'navigation',
      label: 'Navigation',
      icon: 'fa-compass',
      description: 'Mouse wheel zoom and how the search box behaves.',
      keywords: ['zoom', 'wheel', 'scroll', 'mouse', '导航', '缩放', '滚轮'],
    },
    {
      id: 'general.features',
      group: 'general',
      host: 'general',
      tab: 'features',
      label: 'Features',
      icon: 'fa-toggle-on',
      description: 'Sequence analysis, AI integration and shortcuts to external tools.',
      keywords: ['gc content', 'operon', 'translation', 'suggestions', '功能', '翻译'],
    },
    {
      id: 'general.tabs',
      group: 'general',
      host: 'tabs',
      label: 'Tabs',
      icon: 'fa-folder-open',
      description: 'Genome tab appearance, the position indicator and the tab cache.',
      keywords: ['tab', 'indicator', 'chromosome', 'cache', '标签页', '标签'],
    },
    {
      id: 'view.visualization',
      group: 'view',
      host: 'general',
      tab: 'visualization',
      label: 'Visualization',
      icon: 'fa-chart-line',
      description: 'Track heights, sequence display and what moves while you drag the view.',
      keywords: ['track height', 'drag', 'rendering', 'sequence', 'line spacing', '可视化', '拖动', '渲染'],
    },
    {
      id: 'view.tracks',
      group: 'view',
      host: 'tracks',
      label: 'Tracks',
      icon: 'fa-layer-group',
      description: 'Per-track display options. A track header gear opens the same settings.',
      keywords: [
        'genes',
        'gc content',
        'gc skew',
        'reads',
        'variants',
        'wig',
        'primers',
        'gene height',
        'operon',
        'font size',
        'colors',
        '轨道',
        '基因',
        '读段',
        '变异',
      ],
    },
    {
      id: 'view.geneDetails',
      group: 'view',
      host: 'geneDetails',
      label: 'Gene Details',
      icon: 'fa-dna',
      description: 'The prompt Deep Gene Research uses from the gene details panel.',
      keywords: ['deep gene research', 'prompt', 'gene panel', '基因详情', '提示词'],
    },
    {
      id: 'view.search',
      group: 'view',
      host: 'search',
      label: 'Search',
      icon: 'fa-magnifying-glass',
      description: 'Search scope, matching rules, result display and history.',
      keywords: ['case sensitive', 'reverse complement', 'history', 'scope', '搜索', '历史'],
    },
    {
      id: 'ai.providers',
      group: 'ai',
      host: 'llm',
      label: 'Model Providers',
      icon: 'fa-robot',
      description: 'API keys, endpoints and the default model for each provider.',
      keywords: [
        'llm',
        'api key',
        'openai',
        'anthropic',
        'claude',
        'gemini',
        'deepseek',
        'openrouter',
        'endpoint',
        'default model',
        '模型',
        '密钥',
        '大模型',
      ],
    },
    {
      id: 'ai.chatbox',
      group: 'ai',
      host: 'chatbox',
      label: 'ChatBox',
      icon: 'fa-comments',
      description: 'What the chat shows, how it responds and the welcome examples.',
      keywords: ['chat', 'streaming', 'thinking', 'tool calls', 'timeout', 'examples', '聊天', '对话'],
    },
    {
      id: 'ai.agents',
      group: 'ai',
      host: 'agents',
      label: 'Agents & Skills',
      icon: 'fa-users-gear',
      description: 'Agent mode, generation, execution limits, context, memory and skills.',
      keywords: [
        'agent',
        'skills',
        'temperature',
        'reasoning',
        'context',
        'memory',
        'rounds',
        '智能体',
        '技能',
        '上下文',
      ],
    },
    {
      id: 'ai.mcp',
      group: 'ai',
      host: 'mcp',
      label: 'MCP Servers',
      icon: 'fa-server',
      description: 'External MCP servers the assistant can call.',
      keywords: ['mcp', 'server', 'tools', 'connection', '服务器'],
    },
    {
      id: 'ai.literature',
      group: 'ai',
      host: 'literature',
      label: 'Literature',
      icon: 'fa-book',
      description: 'How citations from literature searches are listed.',
      keywords: ['citations', 'papers', 'pubmed', 'page size', '文献', '引用'],
    },
    {
      id: 'tools.external',
      group: 'tools',
      host: 'external',
      label: 'External Tools',
      icon: 'fa-toolbox',
      description: 'Built-in web tools and your own tools in the Tools menu.',
      keywords: ['chopchop', 'progenfixer', 'deep gene research url', 'custom tool', '外部工具'],
    },
    {
      id: 'tools.blast',
      group: 'tools',
      host: 'blast',
      label: 'BLAST+',
      icon: 'fa-bolt',
      description: 'The local BLAST+ installation used for sequence searches.',
      keywords: ['blast', 'blastn', 'blastp', 'executable', 'database', '比对'],
    },
    {
      id: 'tools.plugins',
      group: 'tools',
      host: 'plugins',
      label: 'Plugins',
      icon: 'fa-puzzle-piece',
      description: 'Installed plugins, plugin sources and plugin options.',
      keywords: ['plugin', 'marketplace', 'sandbox', 'extension', '插件'],
    },
    {
      id: 'system.memory',
      group: 'system',
      host: 'general',
      tab: 'memory',
      label: 'Memory',
      icon: 'fa-memory',
      description: 'The sequence length limit and the rendering mode used for large genomes.',
      keywords: ['performance', 'sequence length', 'renderer', '内存', '性能'],
    },
    {
      id: 'system.caching',
      group: 'system',
      host: 'general',
      tab: 'caching',
      label: 'Caching',
      icon: 'fa-database',
      description: 'File caching and its size limit.',
      keywords: ['cache', 'clear cache', '缓存'],
    },
    {
      id: 'system.security',
      group: 'system',
      host: 'general',
      tab: 'security',
      label: 'Security',
      icon: 'fa-shield-halved',
      description: 'File and AI safety, downloads and plugin restrictions.',
      keywords: ['security', 'privacy', 'permissions', 'sandbox', '安全', '权限'],
    },
    {
      id: 'system.backup',
      group: 'system',
      host: 'general',
      tab: 'export',
      label: 'Import, Export & Backup',
      icon: 'fa-file-export',
      description: 'File export defaults, and moving your settings to another computer.',
      keywords: ['backup', 'restore', 'import settings', 'export settings', 'reset', '备份', '导入', '导出', '重置'],
    },
    {
      id: 'system.about',
      group: 'system',
      host: 'general',
      tab: 'about',
      label: 'About',
      icon: 'fa-circle-info',
      description: 'Version, credits and system information.',
      keywords: ['version', 'about', 'help', 'documentation', '关于', '版本'],
    },
  ]);

  static TRACK_TYPES = Object.freeze([
    { type: 'genes', label: 'Genes & Features' },
    { type: 'sequence', label: 'Sequence' },
    { type: 'sequenceLine', label: 'Single-line Sequence' },
    { type: 'gc', label: 'GC Content & Skew' },
    { type: 'reads', label: 'Aligned Reads' },
    { type: 'variants', label: 'Variants' },
    { type: 'wigTracks', label: 'WIG Tracks' },
    { type: 'primers', label: 'Primers' },
    { type: 'actions', label: 'Sequence Edits' },
  ]);

  /** Labels the search index reads from adopted panels. */
  static SEARCHABLE_SELECTOR =
    'h4, h5, label, legend, summary, .setting-label, .form-label, .checkbox-label, .settings-center-field-label, .modal-body button.btn, .settings-center-native-body button.btn';

  /** Internal tab panels of adopted modals, for revealing a search hit. */
  static TAB_PANEL_SELECTOR =
    '.tab-content, .provider-config, .search-settings-tab-content, .tab-settings-pane, [data-tab-panel]';

  static TAB_LIST_SELECTOR =
    '.llm-provider-tabs, .search-settings-tabs, .multi-agent-tabs, .tab-settings-nav, .plugin-management-tabs .tab-header';

  static TAB_BUTTON_SELECTOR = '.tab-button, .tab-btn, .tab-settings-nav-btn, .settings-center-track-type';

  static DEFAULT_PANE = 'general.appearance';

  constructor() {
    this.modal = null;
    this.isOpen = false;
    this.activePaneId = null;
    this.activeHost = null;
    this.hostElements = new Map();
    this.adoptedModals = new Map(); // hostId -> modal element
    this.modalToHost = new Map();
    this.visitedHosts = new Set(); // hosts loaded during the current opening
    this.loadingHosts = new Map();
    this.selection = 0;
    this.closing = false;
    this.searchIndex = null;
    this.searchResults = [];
    this.selectedResult = -1;
    this.trackType = 'genes';
    this.lastFocused = null;
    this.initialized = false;
    this.observers = [];
    this.documentListeners = [];

    for (const [hostId, host] of Object.entries(SettingsCenter.HOSTS)) {
      if (host.modalId) this.modalToHost.set(host.modalId, hostId);
      if (host.aliasModalId) this.modalToHost.set(host.aliasModalId, hostId);
    }
  }

  // ---------------------------------------------------------------------------
  // Setup
  // ---------------------------------------------------------------------------

  init() {
    if (this.initialized) return this;
    this.modal = document.getElementById('settingsCenterModal');
    if (!this.modal) return this;

    this.nav = this.modal.querySelector('#settingsCenterNav');
    this.results = this.modal.querySelector('#settingsCenterResults');
    this.searchInput = this.modal.querySelector('#settingsCenterSearch');
    this.searchStatus = this.modal.querySelector('#settingsCenterSearchStatus');
    this.clearSearchButton = this.modal.querySelector('.settings-center-clear-search');
    this.sectionSelect = this.modal.querySelector('#settingsCenterSection');
    this.hostsContainer = this.modal.querySelector('#settingsCenterHosts');
    this.paneTitle = this.modal.querySelector('#settingsCenterPaneTitle');
    this.paneDescription = this.modal.querySelector('#settingsCenterPaneDescription');
    this.paneIcon = this.modal.querySelector('#settingsCenterPaneIcon');

    this.renderNav();
    this.createHosts();
    this.adoptAvailableModals();
    this.observeBody();
    this.bindEvents();
    this.fillShortcutHints();
    this.registerWindowBehavior();

    this.initialized = true;
    return this;
  }

  renderNav() {
    const fragment = document.createDocumentFragment();
    this.sectionSelect.replaceChildren();
    for (const group of SettingsCenter.GROUPS) {
      const panes = SettingsCenter.PANES.filter(pane => pane.group === group.id);
      if (panes.length === 0) continue;

      const section = document.createElement('div');
      const options = document.createElement('optgroup');
      options.label = group.label;
      section.className = 'settings-center-nav-group';
      section.setAttribute('role', 'group');
      section.setAttribute('aria-label', group.label);

      const heading = document.createElement('div');
      heading.className = 'settings-center-nav-heading';
      heading.textContent = group.label;
      section.appendChild(heading);

      for (const pane of panes) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'settings-center-nav-item';
        button.dataset.pane = pane.id;
        button.style.setProperty('--settings-center-icon-bg', group.color);
        button.innerHTML = `<span class="settings-center-icon"><i class="fas ${pane.icon}" aria-hidden="true"></i></span><span class="settings-center-nav-label"></span>`;
        button.querySelector('.settings-center-nav-label').textContent = pane.label;
        section.appendChild(button);
        options.appendChild(new Option(pane.label, pane.id));
      }
      fragment.appendChild(section);
      this.sectionSelect.appendChild(options);
    }
    this.nav.replaceChildren(fragment);
  }

  createHosts() {
    for (const [hostId, host] of Object.entries(SettingsCenter.HOSTS)) {
      const element = document.createElement('div');
      element.className = 'settings-center-host';
      element.dataset.host = hostId;
      element.hidden = true;

      if (host.native) {
        element.classList.add('settings-center-native');
        element.appendChild(this.buildNativeHost(hostId));
      } else if (host.wrapper === 'tracks') {
        element.classList.add('settings-center-tracks');
        element.appendChild(this.buildTrackPicker());
      }

      const loading = document.createElement('div');
      loading.className = 'settings-center-loading';
      loading.textContent = 'Loading settings…';
      element.appendChild(loading);
      this.hostsContainer.appendChild(element);
      this.hostElements.set(hostId, element);
    }
  }

  /**
   * Adopt every hosted modal that already exists. Modals built on first use
   * (ChatBox, Track Settings) are adopted when they are added to the page.
   */
  adoptAvailableModals() {
    for (const [hostId, host] of Object.entries(SettingsCenter.HOSTS)) {
      if (!host.modalId || this.adoptedModals.has(hostId)) continue;
      const modal = document.getElementById(host.modalId);
      if (modal) this.adopt(hostId, modal);
    }
  }

  adopt(hostId, modal) {
    const hostElement = this.hostElements.get(hostId);
    if (!hostElement || this.adoptedModals.get(hostId) === modal) return;

    const wasShown = modal.classList.contains('show') || ['flex', 'block'].includes(modal.style.display);
    modal.classList.add('settings-center-embedded');
    modal.dataset.settingsHost = hostId;
    if (SettingsCenter.HOSTS[hostId].hidesTabs) modal.classList.add('settings-center-split-tabs');
    hostElement.appendChild(modal);
    this.adoptedModals.set(hostId, modal);
    this.hideDismissButtons(modal);
    this.syncHostTabs(modal);
    this.searchIndex = null;

    const observer = new MutationObserver(mutations => {
      if (mutations.some(mutation => mutation.target === modal)) this.onModalStateChange(hostId, modal);
      if (mutations.some(mutation => mutation.addedNodes.length || mutation.removedNodes.length)) {
        this.searchIndex = null;
      }
      if (
        mutations.some(
          mutation =>
            mutation.target.matches?.(SettingsCenter.TAB_BUTTON_SELECTOR) ||
            [...mutation.addedNodes].some(node => node.matches?.(SettingsCenter.TAB_BUTTON_SELECTOR))
        )
      ) {
        this.syncHostTabs(modal);
      }
    });
    observer.observe(modal, {
      attributes: true,
      attributeFilter: ['class', 'style', 'data-track-type', 'data-file-id'],
      childList: true,
      subtree: true,
    });
    this.observers.push(observer);

    if (wasShown) this.onModalStateChange(hostId, modal);
  }

  /**
   * Cancel/Close buttons dismissed a floating dialog; here the window's own
   * close button does that, so they are hidden.
   */
  hideDismissButtons(modal) {
    modal.querySelectorAll('.modal-footer button, .modal-footer .btn').forEach(button => {
      const label = button.textContent.trim().toLowerCase();
      if (button.classList.contains('modal-close') || label === 'cancel' || label === 'close') {
        button.classList.add('settings-center-hidden');
      }
    });
  }

  observeBody() {
    const observer = new MutationObserver(mutations => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (node.nodeType !== 1 || !node.id) continue;
          const hostId = this.modalToHost.get(node.id);
          if (hostId && SettingsCenter.HOSTS[hostId].modalId === node.id) this.adopt(hostId, node);
        }
      }
    });
    observer.observe(document.body, { childList: true });
    this.observers.push(observer);
  }

  /** Listen on document/window and remember it, so destroy() can undo it. */
  listen(target, type, handler, capture = false) {
    target.addEventListener(type, handler, capture);
    this.documentListeners.push([target, type, handler, capture]);
  }

  /** Stop observing and listening (tests, or a renderer being torn down). */
  destroy() {
    this.close();
    this.observers.forEach(observer => observer.disconnect());
    this.documentListeners.forEach(([target, type, handler, capture]) =>
      target.removeEventListener(type, handler, capture)
    );
    this.observers = [];
    this.documentListeners = [];
    this.initialized = false;
  }

  bindEvents() {
    this.nav.addEventListener('click', event => {
      const item = event.target.closest('.settings-center-nav-item');
      if (item) this.open(item.dataset.pane);
    });
    this.nav.addEventListener('keydown', event => this.onNavKeydown(event));
    this.sectionSelect.addEventListener('change', () => this.open(this.sectionSelect.value));

    this.modal
      .querySelectorAll('.settings-center-close')
      .forEach(button => button.addEventListener('click', () => this.close()));
    this.modal.querySelector('.settings-center-reset-position')?.addEventListener('click', () => {
      window.modalDragManager?.resetPosition?.('#settingsCenterModal');
      window.resizableModalManager?.resetSize?.('#settingsCenterModal');
    });

    this.searchInput.addEventListener('input', event => {
      if (!event.isComposing) this.runSearch(this.searchInput.value);
    });
    this.searchInput.addEventListener('compositionend', () => this.runSearch(this.searchInput.value));
    this.searchInput.addEventListener('keydown', event => this.onSearchKeydown(event));
    this.clearSearchButton.addEventListener('click', () => {
      this.clearSearch();
      this.searchInput.focus();
    });
    this.results.addEventListener('click', event => {
      const item = event.target.closest('.settings-center-result');
      if (item) this.openResult(Number(item.dataset.index));
    });

    this.hostsContainer.addEventListener('keydown', event => this.onHostTabKeydown(event));

    // Generic modal code (a shared `.modal-close` handler, "close all dialogs")
    // may hide the window directly; treat that as closing it.
    const windowObserver = new MutationObserver(() => {
      if (this.isOpen && !this.modal.classList.contains('show')) this.close();
    });
    windowObserver.observe(this.modal, { attributes: true, attributeFilter: ['class'] });
    this.observers.push(windowObserver);

    this.listen(document, 'keydown', event => this.onDocumentKeydown(event), true);
    this.listen(window, 'storage', event => {
      if (event.key === 'blast-config' && this.activeHost === 'blast') this.renderBlastStatus();
    });
    this.listen(window, 'focus', () => {
      if (this.isOpen && this.activeHost === 'blast') this.renderBlastStatus();
    });
  }

  fillShortcutHints() {
    const isMac = /mac/i.test(navigator.platform || '');
    document.querySelectorAll('[data-shortcut-mac]').forEach(element => {
      element.textContent = isMac ? element.dataset.shortcutMac : element.dataset.shortcutOther;
    });
  }

  /** Drag and resize managers load after this module; wait for them. */
  registerWindowBehavior(attempt = 0) {
    const dragManager = window.modalDragManager;
    const resizeManager = window.resizableModalManager;
    if (dragManager && resizeManager) {
      dragManager.makeDraggable('#settingsCenterModal');
      resizeManager.makeResizable('#settingsCenterModal');
      return;
    }
    if (attempt < 50) setTimeout(() => this.registerWindowBehavior(attempt + 1), 200);
  }

  // ---------------------------------------------------------------------------
  // Opening, closing, navigation
  // ---------------------------------------------------------------------------

  getPane(paneId) {
    return SettingsCenter.PANES.find(pane => pane.id === paneId) || null;
  }

  /**
   * Open the Settings window at a panel.
   * @param {string|null} paneId - e.g. 'ai.providers'; defaults to the last panel
   * @param {Object} [options] - { tab, trackType, fileId, focusSearch }
   * @returns {boolean} true when the window handled the request
   */
  open(paneId = null, options = {}) {
    if (!this.initialized) this.init();
    if (!this.modal) return false;

    const pane =
      this.getPane(paneId) || this.getPane(this.getLastPaneId()) || this.getPane(SettingsCenter.DEFAULT_PANE);

    const opening = !this.isOpen;
    if (opening) {
      this.lastFocused = document.activeElement;
      this.visitedHosts.clear();
      this.isOpen = true;
      this.modal.classList.add('show');
      this.modal.setAttribute('aria-hidden', 'false');
      document.body.classList.add('settings-center-open');
    }

    this.selectPane(pane, options);
    if (options.focusSearch || opening) {
      this.searchInput.focus({ preventScroll: true });
    }
    return true;
  }

  close() {
    if (!this.isOpen) return;
    this.closing = true;
    this.selection++;
    try {
      if (this.activeHost) this.leaveHost(this.activeHost);
      for (const modal of this.adoptedModals.values()) {
        modal.classList.remove('show');
        modal.style.display = '';
      }
      this.modal.classList.remove('show');
      this.modal.setAttribute('aria-hidden', 'true');
      document.body.classList.remove('settings-center-open');
      this.isOpen = false;
      this.activeHost = null;
      this.clearSearch();
    } finally {
      this.closing = false;
    }
    if (this.lastFocused && typeof this.lastFocused.focus === 'function' && document.contains(this.lastFocused)) {
      this.lastFocused.focus();
    }
  }

  isPaneOpen(paneId) {
    return this.isOpen && this.activePaneId === paneId;
  }

  /** Whether the window manages the modal with this id (for toggle_settings_modal). */
  managesModal(modalId) {
    return this.modalToHost.has(modalId);
  }

  /** Whether the panel hosting this modal is on screen. */
  isModalShown(modalId) {
    return this.isOpen && this.activeHost === this.modalToHost.get(modalId);
  }

  paneForModal(modalId) {
    const hostId = this.modalToHost.get(modalId);
    return hostId ? this.defaultPaneForHost(hostId) : null;
  }

  defaultPaneForHost(hostId) {
    if (hostId === 'general') {
      const tab = window.generalSettingsManager?.pendingTab || window.generalSettingsManager?.currentTab;
      const byTab = SettingsCenter.PANES.find(pane => pane.host === 'general' && pane.tab === tab);
      if (byTab) return byTab.id;
    }
    return SettingsCenter.PANES.find(pane => pane.host === hostId)?.id || null;
  }

  async selectPane(pane, options = {}) {
    const selection = ++this.selection;
    const hostId = pane.host;
    const previousHost = this.activeHost;
    const previousPane = this.activePaneId;
    if (previousHost && previousHost !== hostId) this.leaveHost(previousHost);

    this.activePaneId = pane.id;
    this.activeHost = hostId;
    this.renderPaneHeader(pane);
    this.nav.querySelectorAll('.settings-center-nav-item').forEach(item => {
      const isActive = item.dataset.pane === pane.id;
      item.classList.toggle('active', isActive);
      item.tabIndex = isActive ? 0 : -1;
      if (isActive) item.setAttribute('aria-current', 'page');
      else item.removeAttribute('aria-current');
    });
    if (previousHost === null) {
      this.nav.querySelector('.active')?.scrollIntoView({ block: 'nearest' });
    }
    for (const [id, element] of this.hostElements) element.hidden = id !== hostId;
    this.sectionSelect.value = pane.id;
    const hostElement = this.hostElements.get(hostId);
    hostElement.dataset.pane = pane.id;
    this.rememberPane(pane.id);

    if (this.loadingHosts.has(hostId)) {
      await this.loadingHosts.get(hostId);
    } else if (!this.visitedHosts.has(hostId) && !options.alreadyLoaded) {
      const loading = this.loadHost(hostId, pane, options);
      this.loadingHosts.set(hostId, loading);
      hostElement.setAttribute('aria-busy', 'true');
      try {
        await loading;
      } finally {
        this.loadingHosts.delete(hostId);
        hostElement.removeAttribute('aria-busy');
        if (this.activeHost !== hostId) this.leaveHost(hostId);
      }
    } else {
      this.visitedHosts.add(hostId);
      this.markShown(hostId);
      if (hostId === 'literature') this.renderLiterature();
      if (hostId === 'blast') this.renderBlastStatus();
      if (hostId === 'tabs') window.genomeBrowser?.tabManager?.startCacheStatsPolling?.();
      if (hostId === 'tracks' && options.trackType) {
        const modal = this.adoptedModals.get(hostId);
        if (modal?.dataset.trackType !== options.trackType || modal.dataset.fileId !== (options.fileId || '')) {
          this.selectTrackType(options.trackType, options.fileId);
        }
      }
    }

    if (selection !== this.selection) return false;
    if (pane.tab || options.tab) this.selectHostTab(hostId, options.tab || pane.tab);
    const body = this.adoptedModals.get(hostId)?.querySelector('.modal-body');
    if (body && previousPane !== pane.id) body.scrollTop = 0;
    return true;
  }

  /**
   * Ask the panel's manager to load current values. The manager shows its
   * modal as it always has; the window is already displaying that host.
   */
  async loadHost(hostId, pane, options = {}) {
    const gb = window.genomeBrowser;
    let failed = false;
    try {
      switch (hostId) {
        case 'general':
          await gb?.showGeneralSettingsModal?.(options.tab || pane.tab);
          break;
        case 'tabs':
          gb?.tabManager?.openTabSettingsModal?.();
          break;
        case 'tracks':
          this.selectTrackType(options.trackType || this.trackType, options.fileId);
          break;
        case 'geneDetails':
          gb?.showGeneDetailSettings?.();
          break;
        case 'search':
          gb?.navigationManager?.showSearchSettingsModal?.();
          break;
        case 'llm':
          gb?.llmConfigManager?.showConfigModal?.();
          break;
        case 'chatbox':
          window.chatBoxSettingsManager?.showSettingsModal?.();
          break;
        case 'agents':
          if (options.tab && window.multiAgentSettingsManager) {
            window.multiAgentSettingsManager.currentTab = options.tab;
          }
          window.multiAgentSettingsManager?.showModal?.();
          break;
        case 'mcp':
          gb?.showMCPSettingsModal?.();
          break;
        case 'external':
          await gb?.showExternalToolsModal?.();
          break;
        case 'plugins':
          await window.pluginManagementUI?.showPluginModal?.();
          break;
        case 'literature':
          this.renderLiterature();
          break;
        case 'blast':
          this.renderBlastStatus();
          break;
        default:
          break;
      }
    } catch (error) {
      failed = true;
      console.error(`[SettingsCenter] Could not load the ${hostId} panel:`, error);
    }

    // A modal built on first use was appended to <body> just now
    this.adoptAvailableModals();
    // Panels can rebuild their content when they load; index it afresh
    this.searchIndex = null;
    if (this.updateUnavailableNotice(hostId, failed)) {
      if (this.activeHost === hostId) this.markShown(hostId);
      if (this.activeHost) this.visitedHosts.add(hostId);
    }
  }

  /**
   * Keep the active panel's modal in its "open" state, so its manager
   * behaves as if its dialog were on screen.
   */
  markShown(hostId) {
    const modal = this.adoptedModals.get(hostId);
    if (modal && !modal.classList.contains('show')) modal.classList.add('show');
  }

  leaveHost(hostId) {
    const modal = this.adoptedModals.get(hostId);
    if (modal) {
      this.closing = true;
      try {
        modal.classList.remove('show');
        modal.style.display = '';
      } finally {
        this.closing = false;
      }
    }
    if (hostId === 'tabs') window.genomeBrowser?.tabManager?.stopCacheStatsPolling?.();
  }

  /**
   * An adopted modal changed. Showing it, from anywhere, displays its panel;
   * hiding the panel on screen (a manager's Save or Cancel) is undone.
   */
  onModalStateChange(hostId, modal) {
    if (this.closing) return;
    // Most managers toggle `.show`; Tab Settings sets an inline display instead
    const shown = modal.classList.contains('show') || ['flex', 'block'].includes(modal.style.display);

    if (shown) {
      if (this.loadingHosts.has(hostId)) return;
      if (hostId === 'tracks' && modal.dataset.trackType) {
        this.trackType = modal.dataset.trackType;
        this.updateTrackPicker(this.trackType, modal.dataset.fileId);
      }
      if (!this.isOpen || this.activeHost !== hostId) {
        this.updateUnavailableNotice(hostId);
        const paneId = this.defaultPaneForHost(hostId);
        // The caller already loaded the values; do not load them again
        this.open(paneId, { alreadyLoaded: true });
      }
      return;
    }

    if (this.isOpen && this.activeHost === hostId && !this.loadingHosts.has(hostId)) {
      this.markShown(hostId);
      if (hostId === 'tabs') window.genomeBrowser?.tabManager?.startCacheStatsPolling?.();
    }
  }

  /** Switch an adopted modal to one of its internal tabs. */
  selectHostTab(hostId, tab) {
    if (!tab) return;
    if (hostId === 'general') {
      window.generalSettingsManager?.switchTab?.(tab);
      return;
    }
    const modal = this.adoptedModals.get(hostId);
    const button = [...(modal?.querySelectorAll(SettingsCenter.TAB_BUTTON_SELECTOR) || [])].find(
      button => SettingsCenter.tabName(button) === tab
    );
    if (button && !button.classList.contains('active')) button.click();
  }

  renderPaneHeader(pane) {
    const group = SettingsCenter.GROUPS.find(entry => entry.id === pane.group);
    this.paneTitle.textContent = pane.label;
    this.paneDescription.textContent = pane.description || '';
    this.paneIcon.style.setProperty('--settings-center-icon-bg', group?.color || '#64748b');
    this.paneIcon.innerHTML = `<i class="fas ${pane.icon}" aria-hidden="true"></i>`;
  }

  /** Shown when a panel's manager has not been created yet. */
  updateUnavailableNotice(hostId, failed = false) {
    const host = SettingsCenter.HOSTS[hostId];
    const element = this.hostElements.get(hostId);
    if (!element) return false;
    const missing = failed || (!host.native && !this.adoptedModals.has(hostId));
    this.adoptedModals.get(hostId)?.classList.toggle('settings-center-load-failed', missing);
    let notice = element.querySelector('.settings-center-unavailable');
    if (missing && !notice) {
      notice = document.createElement('div');
      notice.className = 'settings-center-unavailable';
      notice.innerHTML = '<i class="fas fa-circle-exclamation" aria-hidden="true"></i><p role="status"></p>';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'btn btn-secondary';
      retry.textContent = 'Try Again';
      retry.addEventListener('click', () => {
        this.visitedHosts.delete(hostId);
        const pane = this.getPane(this.activePaneId);
        if (pane) this.selectPane(pane);
      });
      notice.appendChild(retry);
      element.appendChild(notice);
    } else if (!missing && notice) {
      notice.remove();
    }
    if (missing) {
      notice.querySelector('p').textContent = failed
        ? 'This section could not be loaded.'
        : 'This section is still starting up.';
    }
    return !missing;
  }

  getLastPaneId() {
    const configManager = window.genomeBrowser?.configManager;
    return configManager?.get?.('ui.settingsCenterLastPane', null) || null;
  }

  rememberPane(paneId) {
    const configManager = window.genomeBrowser?.configManager;
    if (configManager?.isInitialized && configManager.get('ui.settingsCenterLastPane', null) !== paneId) {
      configManager.set('ui.settingsCenterLastPane', paneId);
    }
  }

  // ---------------------------------------------------------------------------
  // Keyboard
  // ---------------------------------------------------------------------------

  onDocumentKeydown(event) {
    if (!this.isOpen || event.defaultPrevented || event.isComposing || !['Escape', 'Tab'].includes(event.key)) return;
    // A dialog opened from a panel (add server, confirm, ...) closes first
    const otherDialog = [
      ...document.querySelectorAll('.modal, .literature-settings-modal-overlay, .notification-overlay'),
    ].some(
      element =>
        element !== this.modal &&
        !this.modal.contains(element) &&
        (element.classList.contains('show') || element.getClientRects().length > 0)
    );
    if (otherDialog) return;
    if (event.key === 'Tab') {
      this.trapTabFocus(event);
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (document.activeElement === this.searchInput && this.searchInput.value) {
      this.clearSearch();
      return;
    }
    this.close();
  }

  trapTabFocus(event) {
    const controls = [
      ...this.modal.querySelectorAll('button, input, select, textarea, a[href], summary, [tabindex]'),
    ].filter(
      control =>
        control.tabIndex >= 0 &&
        !control.matches(':disabled') &&
        control.getClientRects().length > 0 &&
        getComputedStyle(control).visibility === 'visible'
    );
    if (!controls.length) return;
    const active = document.activeElement;
    if (!this.modal.contains(active) || active === controls[event.shiftKey ? 0 : controls.length - 1]) {
      event.preventDefault();
      controls[event.shiftKey ? controls.length - 1 : 0].focus();
    }
  }

  static tabName(element) {
    return (
      element.dataset.tab ||
      element.dataset.provider ||
      element.dataset.pane ||
      element.id.replace(/(-plugins)?-(tab|config)$/, '')
    );
  }

  syncHostTabs(modal) {
    if (modal.classList.contains('settings-center-split-tabs')) return;
    modal.querySelectorAll(SettingsCenter.TAB_LIST_SELECTOR).forEach(list => {
      list.setAttribute('role', 'tablist');
      if (!list.hasAttribute('aria-label')) {
        list.setAttribute('aria-label', this.getPane(this.defaultPaneForHost(modal.dataset.settingsHost)).label);
      }
      const panels = new Map(
        [...modal.querySelectorAll(SettingsCenter.TAB_PANEL_SELECTOR)].map(panel => [
          SettingsCenter.tabName(panel),
          panel,
        ])
      );
      list.querySelectorAll(SettingsCenter.TAB_BUTTON_SELECTOR).forEach(button => {
        const name = SettingsCenter.tabName(button);
        const selected = button.classList.contains('active');
        button.id ||= `${modal.id}-tab-${name}`;
        button.setAttribute('role', 'tab');
        button.setAttribute('aria-selected', String(selected));
        button.tabIndex = selected ? 0 : -1;
        const panel = panels.get(name);
        if (!panel) return;
        panel.id ||= `${modal.id}-panel-${name}`;
        button.setAttribute('aria-controls', panel.id);
        panel.setAttribute('role', 'tabpanel');
        panel.setAttribute('aria-labelledby', button.id);
      });
    });
  }

  onHostTabKeydown(event) {
    const button = event.target.closest('[role="tab"]');
    const list = button?.closest('[role="tablist"]');
    if (!list || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
    const tabs = [...list.querySelectorAll('[role="tab"]:not(:disabled)')];
    const index = tabs.indexOf(button);
    const offset = event.key === 'ArrowLeft' ? -1 : 1;
    const target =
      {
        Home: tabs[0],
        End: tabs.at(-1),
      }[event.key] || tabs[(index + offset + tabs.length) % tabs.length];
    if (!target) return;
    event.preventDefault();
    target.focus();
    if (target !== button) target.click();
  }

  onNavKeydown(event) {
    if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
    const items = [...this.nav.querySelectorAll('.settings-center-nav-item')];
    const index = items.indexOf(document.activeElement);
    let next = index;
    if (event.key === 'ArrowDown') next = Math.min(items.length - 1, index + 1);
    if (event.key === 'ArrowUp') next = Math.max(0, index - 1);
    if (event.key === 'Home') next = 0;
    if (event.key === 'End') next = items.length - 1;
    if (next !== index && items[next]) {
      event.preventDefault();
      items[next].focus();
      this.open(items[next].dataset.pane);
    }
  }

  onSearchKeydown(event) {
    if (event.isComposing || !this.searchResults.length) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      const delta = event.key === 'ArrowDown' ? 1 : -1;
      const count = this.searchResults.length;
      this.selectedResult = (this.selectedResult + delta + count) % count;
      this.highlightSelectedResult();
    } else if (event.key === 'Enter') {
      event.preventDefault();
      this.openResult(Math.max(0, this.selectedResult));
    }
  }

  // ---------------------------------------------------------------------------
  // Search
  // ---------------------------------------------------------------------------

  /**
   * Visible label text: without nested help text, and without the emoji some
   * panels put in front of headings.
   */
  static labelText(element) {
    const clone = element.cloneNode(true);
    clone
      .querySelectorAll('small, .help-text, .form-text, .setting-description, select, option, textarea')
      .forEach(node => node.remove());
    return clone.textContent
      .replace(/[\p{Extended_Pictographic}\uFE0F]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  static normalize(text) {
    return String(text || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Index the panel names and every label in the adopted panels. Panels
   * whose content is built on first use are indexed by keyword until then.
   */
  buildSearchIndex() {
    const entries = [];
    const seen = new Set();
    const add = entry => {
      const key = `${entry.paneId}|${SettingsCenter.normalize(entry.text)}|${SettingsCenter.normalize(entry.context)}`;
      if (seen.has(key)) return;
      seen.add(key);
      entries.push(entry);
    };

    for (const pane of SettingsCenter.PANES) {
      add({
        kind: 'pane',
        paneId: pane.id,
        text: pane.label,
        context: '',
        haystack: SettingsCenter.normalize([pane.label, pane.description, ...(pane.keywords || [])].join(' ')),
      });
    }

    for (const { type, label } of SettingsCenter.TRACK_TYPES) {
      add({
        kind: 'tab',
        paneId: 'view.tracks',
        text: label,
        trackType: type,
        context: '',
        haystack: SettingsCenter.normalize(`${label} tracks`),
      });
    }

    const roots = [...this.adoptedModals];
    for (const [hostId, element] of this.hostElements) {
      if (SettingsCenter.HOSTS[hostId].native) roots.push([hostId, element]);
    }

    for (const [hostId, root] of roots) {
      root.querySelectorAll(SettingsCenter.TAB_LIST_SELECTOR).forEach(list => {
        if (SettingsCenter.HOSTS[hostId].hidesTabs) return;
        list.querySelectorAll(SettingsCenter.TAB_BUTTON_SELECTOR).forEach(button => {
          const paneId = this.defaultPaneForHost(hostId);
          const text = SettingsCenter.labelText(button);
          add({
            kind: 'tab',
            paneId,
            text,
            tab: SettingsCenter.tabName(button),
            context: '',
            haystack: SettingsCenter.normalize(`${text} ${this.getPane(paneId).label}`),
          });
        });
      });
      root.querySelectorAll(SettingsCenter.SEARCHABLE_SELECTOR).forEach(element => {
        if (element.closest('.settings-center-hidden, .modal-header')) return;
        if (element.matches('.tab-button, .tab-btn')) return;
        // A label wrapping its own .setting-label is indexed through that child
        if (element.matches('label') && element.querySelector('.setting-label, .form-label, .checkbox-label')) return;
        const text = SettingsCenter.labelText(element);
        if (text.length < 3 || text.length > 90 || /^[\d\s.:%-]+$/.test(text)) return;
        const paneId = this.paneIdForElement(hostId, element);
        if (!paneId) return;
        const panel = element.closest(SettingsCenter.TAB_PANEL_SELECTOR);
        const context = this.contextForElement(element, text);
        const pane = this.getPane(paneId);
        add({
          kind: 'setting',
          paneId,
          text: text.replace(/:$/, ''),
          context,
          element,
          tab: panel && SettingsCenter.tabName(panel),
          trackType: root.dataset.trackType,
          fileId: root.dataset.fileId,
          controlId: this.controlForElement(element)?.id,
          haystack: SettingsCenter.normalize(`${text} ${context} ${pane.label}`),
        });
      });
    }

    this.searchIndex = entries;
    return entries;
  }

  paneIdForElement(hostId, element) {
    if (hostId === 'general') {
      const tab = element.closest('.tab-content')?.id?.replace(/-tab$/, '');
      return SettingsCenter.PANES.find(pane => pane.host === 'general' && pane.tab === tab)?.id || null;
    }
    return SettingsCenter.PANES.find(pane => pane.host === hostId)?.id || null;
  }

  /** The section heading or tab a label sits under, for the result's breadcrumb. */
  contextForElement(element, text) {
    const parts = [];
    const panel = element.closest(SettingsCenter.TAB_PANEL_SELECTOR);
    const modal = element.closest('.settings-center-embedded');
    if (panel && modal && !modal.classList.contains('settings-center-split-tabs')) {
      const button = this.tabButtonForPanel(modal, panel);
      const label = button ? SettingsCenter.labelText(button) : '';
      if (label) parts.push(label);
    }
    if (modal?.dataset.settingsHost === 'tracks') {
      const track = SettingsCenter.TRACK_TYPES.find(track => track.type === modal.dataset.trackType);
      if (track) parts.push(track.label);
    }
    const section = element.closest(
      '.settings-section, .settings-group, .form-section, .config-section, fieldset, details'
    );
    const headingElement = section?.querySelector('h4, h5, legend, summary');
    const heading = headingElement ? SettingsCenter.labelText(headingElement) : '';
    if (heading && heading !== text) parts.push(heading);
    return parts.join(' › ');
  }

  tabButtonForPanel(modal, panel) {
    if (!panel) return null;
    const name = SettingsCenter.tabName(panel);
    return [...modal.querySelectorAll(SettingsCenter.TAB_BUTTON_SELECTOR)].find(
      button => SettingsCenter.tabName(button) === name
    );
  }

  /**
   * @param {string} query
   * @returns {Array} matching entries, best first
   */
  search(query) {
    const tokens = SettingsCenter.normalize(query).split(' ').filter(Boolean);
    if (tokens.length === 0) return [];
    const index = this.searchIndex || this.buildSearchIndex();
    const phrase = tokens.join(' ');

    const scored = [];
    for (const entry of index) {
      if (!tokens.every(token => entry.haystack.includes(token))) continue;
      const text = SettingsCenter.normalize(entry.text);
      let score = 0;
      if (text === phrase) score += 100;
      else if (text.startsWith(phrase)) score += 60;
      else if (text.includes(phrase)) score += 35;
      if (entry.kind === 'pane' || entry.kind === 'tab') score += 25;
      score -= Math.min(text.length, 60) / 10;
      scored.push({ entry, score });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 40).map(item => item.entry);
  }

  runSearch(query) {
    const trimmed = String(query || '').trim();
    if (!trimmed) {
      this.clearSearch({ keepInput: true });
      return;
    }

    this.searchResults = this.search(trimmed);
    this.selectedResult = this.searchResults.length ? 0 : -1;
    this.nav.hidden = true;
    this.sectionSelect.hidden = true;
    this.results.hidden = false;
    this.clearSearchButton.hidden = false;
    this.searchInput.setAttribute('aria-expanded', 'true');
    this.searchInput.removeAttribute('aria-activedescendant');
    this.searchStatus.textContent = this.searchResults.length
      ? `${this.searchResults.length} matching settings`
      : 'No matching settings';

    if (this.searchResults.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'settings-center-no-results';
      empty.textContent = `No settings match “${trimmed}”`;
      this.results.replaceChildren(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    this.searchResults.forEach((entry, index) => {
      const pane = this.getPane(entry.paneId);
      const group = SettingsCenter.GROUPS.find(item => item.id === pane.group);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'settings-center-result';
      button.dataset.index = String(index);
      button.id = `settings-center-result-${index}`;
      button.tabIndex = -1;
      button.setAttribute('role', 'option');
      button.style.setProperty('--settings-center-icon-bg', group?.color || '#64748b');
      button.innerHTML = `<span class="settings-center-icon"><i class="fas ${pane.icon}" aria-hidden="true"></i></span><span class="settings-center-result-text"><span class="settings-center-result-title"></span><span class="settings-center-result-crumb"></span></span>`;
      button.querySelector('.settings-center-result-title').textContent = entry.text;
      button.querySelector('.settings-center-result-crumb').textContent =
        entry.kind === 'pane' ? group?.label || '' : [pane.label, entry.context].filter(Boolean).join(' › ');
      fragment.appendChild(button);
    });
    this.results.replaceChildren(fragment);
    this.highlightSelectedResult();
  }

  highlightSelectedResult() {
    this.results.querySelectorAll('.settings-center-result').forEach((item, index) => {
      const selected = index === this.selectedResult;
      item.classList.toggle('selected', selected);
      item.setAttribute('aria-selected', selected ? 'true' : 'false');
      if (selected) {
        this.searchInput.setAttribute('aria-activedescendant', item.id);
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  clearSearch({ keepInput = false } = {}) {
    if (!keepInput && this.searchInput) this.searchInput.value = '';
    this.searchInput.removeAttribute('aria-activedescendant');
    this.searchInput.setAttribute('aria-expanded', 'false');
    this.searchStatus.textContent = '';
    this.clearSearchButton.hidden = true;
    this.searchResults = [];
    this.selectedResult = -1;
    if (this.results) {
      this.results.hidden = true;
      this.results.replaceChildren();
    }
    if (this.nav) this.nav.hidden = false;
    this.sectionSelect.hidden = false;
  }

  async openResult(index) {
    const entry = this.searchResults[index];
    if (!entry) return;
    this.clearSearch();
    const pane = this.getPane(entry.paneId);
    const selected = await this.selectPane(pane, {
      tab: pane.tab || entry.tab,
      trackType: entry.trackType,
      fileId: entry.fileId,
    });
    if (!selected) return;
    const control = entry.controlId && document.getElementById(entry.controlId);
    if (entry.element?.isConnected || (control && this.hostElements.get(pane.host).contains(control))) {
      this.revealElement(entry.element?.isConnected ? entry.element : control);
    } else this.paneTitle.focus({ preventScroll: true });
  }

  controlForElement(element) {
    const label = element.closest('label');
    return (
      label?.control ||
      element.closest('button, input, select, textarea, summary') ||
      element.closest('.setting-item')?.querySelector('input, select, textarea')
    );
  }

  /** Bring a setting into view, including collapsed sections. */
  revealElement(element) {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
      if (parent.matches('details')) parent.open = true;
    }

    const target =
      element.closest('.form-group, .setting-item, .settings-section, .settings-group, .form-section') || element;
    const reducedMotion =
      document.body.classList.contains('no-animations') ||
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    target.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
    target.classList.remove('settings-center-flash');
    // Restart the animation when the same setting is opened twice.
    void target.offsetWidth;
    target.classList.add('settings-center-flash');
    setTimeout(() => target.classList.remove('settings-center-flash'), 1800);

    const control = this.controlForElement(element);
    const focus = control?.getClientRects().length && !control.matches(':disabled') ? control : this.paneTitle;
    focus.focus({ preventScroll: true });
  }

  // ---------------------------------------------------------------------------
  // Tracks
  // ---------------------------------------------------------------------------

  buildTrackPicker() {
    const bar = document.createElement('div');
    bar.className = 'settings-center-track-picker';
    const list = document.createElement('div');
    list.className = 'settings-center-track-tabs';
    list.setAttribute('role', 'tablist');
    list.setAttribute('aria-label', 'Track type');
    bar.appendChild(list);
    for (const { type, label } of SettingsCenter.TRACK_TYPES) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'settings-center-track-type';
      button.dataset.trackType = type;
      button.id = `settings-track-tab-${type}`;
      button.setAttribute('role', 'tab');
      button.setAttribute('aria-controls', 'trackSettingsBody');
      button.tabIndex = type === this.trackType ? 0 : -1;
      button.textContent = label;
      button.addEventListener('click', () => this.selectTrackType(type));
      list.appendChild(button);
    }
    const note = document.createElement('div');
    note.className = 'settings-center-track-note';
    note.hidden = true;
    bar.appendChild(note);
    return bar;
  }

  selectTrackType(type, fileId = null) {
    const trackRenderer = window.genomeBrowser?.trackRenderer;
    if (!trackRenderer?.openTrackSettings) return;
    this.trackType = type || 'genes';
    trackRenderer.openTrackSettings(this.trackType, fileId);
    this.adoptAvailableModals();
    this.updateTrackPicker(this.trackType, fileId);
    const body = this.adoptedModals.get('tracks')?.querySelector('.modal-body');
    if (body) body.scrollTop = 0;
    this.searchIndex = null;
    this.updateUnavailableNotice('tracks');
    if (this.activeHost === 'tracks') this.markShown('tracks');
  }

  updateTrackPicker(type, fileId = null) {
    const host = this.hostElements.get('tracks');
    if (!host) return;
    host.querySelectorAll('.settings-center-track-type').forEach(button => {
      const selected = button.dataset.trackType === type;
      button.classList.toggle('active', selected);
      button.tabIndex = selected ? 0 : -1;
      button.setAttribute('aria-selected', String(selected));
    });
    const body = this.adoptedModals.get('tracks')?.querySelector('.modal-body');
    body?.setAttribute('role', 'tabpanel');
    const selected = host.querySelector('.settings-center-track-type.active');
    if (selected) body?.setAttribute('aria-labelledby', selected.id);
    else body?.removeAttribute('aria-labelledby');
    const note = host.querySelector('.settings-center-track-note');
    if (note) {
      note.hidden = !fileId;
      note.textContent = fileId ? 'These settings apply to one loaded file track only.' : '';
    }
  }

  // ---------------------------------------------------------------------------
  // Panels rendered here
  // ---------------------------------------------------------------------------

  buildNativeHost(hostId) {
    const body = document.createElement('div');
    body.className = 'settings-center-native-body';
    if (hostId === 'literature') {
      body.innerHTML = `
        <div class="settings-section">
          <h4><i class="fas fa-list-ol"></i> Citation List</h4>
          <div class="form-group">
            <label for="settingsLiteraturePageSize">Citations per page</label>
            <input type="number" id="settingsLiteraturePageSize" class="input-full" min="5" max="50" step="1">
            <small class="help-text">How many citations a literature result shows at a time (5–50). Changes apply immediately.</small>
          </div>
          <div class="form-group">
            <button type="button" class="btn btn-secondary" id="settingsLiteratureReset">
              <i class="fas fa-undo"></i> Reset to Default
            </button>
          </div>
          <p class="settings-center-inline-status" role="status"></p>
        </div>`;
      const input = body.querySelector('#settingsLiteraturePageSize');
      const status = body.querySelector('[role="status"]');
      input.addEventListener('change', () => {
        const literature = window.literatureSettings;
        if (!literature) return;
        literature.setPageSize(input.value);
        input.value = literature.getPageSize();
        window.enhancedCitationDisplay?.onSettingsChanged?.();
        status.textContent = `Showing ${input.value} citations per page.`;
      });
      body.querySelector('#settingsLiteratureReset').addEventListener('click', () => {
        window.literatureSettings?.resetToDefaults();
        this.renderLiterature();
        status.textContent = `Restored the default of ${input.value} citations per page.`;
      });
    } else if (hostId === 'blast') {
      body.innerHTML = `
        <div class="settings-section">
          <h4><i class="fas fa-terminal"></i> BLAST+ Installation</h4>
          <div class="system-info settings-center-blast-status">
            <div class="info-row"><span class="info-label">Status</span><span class="info-value" data-blast="status" role="status">—</span></div>
            <div class="info-row"><span class="info-label">Executable</span><span class="info-value" data-blast="path">—</span></div>
            <div class="info-row"><span class="info-label">Version</span><span class="info-value" data-blast="version">—</span></div>
            <div class="info-row"><span class="info-label">Last detection</span><span class="info-value" data-blast="detected">—</span></div>
          </div>
          <small class="help-text">BLAST+ runs on this computer. Setup finds or verifies the installation; the download assistant installs it.</small>
          <div class="settings-center-button-row">
            <button type="button" class="btn btn-primary" data-blast-action="configure"><i class="fas fa-sliders"></i> Set Up BLAST+…</button>
            <button type="button" class="btn btn-secondary" data-blast-action="download"><i class="fas fa-download"></i> Download BLAST+…</button>
          </div>
        </div>
        <div class="settings-section">
          <h4><i class="fas fa-database"></i> Databases</h4>
          <small class="help-text">Create and remove local BLAST databases from the BLAST tool.</small>
          <div class="settings-center-button-row">
            <button type="button" class="btn btn-secondary" data-blast-action="databases"><i class="fas fa-database"></i> Manage Databases…</button>
          </div>
        </div>`;
      body.addEventListener('click', event => {
        const action = event.target.closest('[data-blast-action]')?.dataset.blastAction;
        if (action) this.runBlastAction(action);
      });
    }
    return body;
  }

  renderLiterature() {
    const input = document.getElementById('settingsLiteraturePageSize');
    const literature = window.literatureSettings;
    if (input && literature) input.value = literature.getPageSize();
  }

  readBlastConfig() {
    try {
      const stored = localStorage.getItem('blast-config');
      if (stored) return JSON.parse(stored);
    } catch (error) {
      console.warn('[SettingsCenter] Could not read the BLAST+ configuration:', error.message);
    }
    return window.genomeBrowser?.configManager?.get?.('blastTools', null) || null;
  }

  renderBlastStatus() {
    const host = this.hostElements.get('blast');
    if (!host) return;
    const config = this.readBlastConfig();
    const set = (key, text) => {
      const element = host.querySelector(`[data-blast="${key}"]`);
      if (element) element.textContent = text;
    };
    const path = config?.blastExecutablePath;
    set('status', path ? 'Configured' : 'Not configured');
    set('path', path || 'Not set');
    set('version', config?.blastVersion || 'Unknown');
    set('detected', config?.lastDetection ? new Date(config.lastDetection).toLocaleString() : 'Never');
    host.querySelector('[data-blast="status"]')?.classList.toggle('settings-center-status-ok', !!path);

    // Keep the persisted copy current for export and other computers
    window.genomeBrowser?.configManager?.syncBlastToolsFromStorage?.();
  }

  runBlastAction(action) {
    const ipc = window.ipcRenderer;
    if (action === 'configure') {
      ipc?.send?.('open-blast-config-window');
    } else if (action === 'download') {
      ipc?.send?.('open-blast-downloader-window');
    } else if (action === 'databases') {
      const blastManager = window.genomeBrowser?.blastManager;
      if (!blastManager?.showBlastModal) return;
      this.close();
      blastManager.showBlastModal();
      blastManager.switchModalTab?.('db-management');
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SettingsCenter;
}

if (typeof window !== 'undefined') {
  window.SettingsCenter = SettingsCenter;
  if (typeof document !== 'undefined' && !window.settingsCenter) {
    window.settingsCenter = new SettingsCenter();
    const start = () => window.settingsCenter.init();
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', start, { once: true });
    } else {
      start();
    }
  }
}
