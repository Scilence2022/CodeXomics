// @ts-check
/**
 * BookmarkPanelUI - sidebar management panel for region bookmarks and saved views.
 */
class BookmarkPanelUI {
  constructor(genomeBrowser) {
    this.gb = genomeBrowser;
    this.sectionId = 'bookmarksSection';
    this.contentId = 'bookmarksContent';

    const section = document.getElementById(this.sectionId);
    if (section) {
      section.addEventListener('click', event => this._onClick(event));
    }
  }

  open() {
    this.refresh();
    const section = document.getElementById(this.sectionId);
    if (!section) return;

    this.gb?.uiManager?.showPanel?.(this.sectionId);
    this.gb?.scrollSidebarToSection?.(section);
  }

  isOpen() {
    const section = document.getElementById(this.sectionId);
    if (!section) return false;
    const computedDisplay = window.getComputedStyle ? window.getComputedStyle(section).display : section.style.display;
    return section.style.display !== 'none' && computedDisplay !== 'none';
  }

  refreshIfOpen() {
    if (this.isOpen()) {
      this.refresh();
    }
  }

  refresh() {
    const content = document.getElementById(this.contentId);
    if (!content) return;

    const entries = this._getEntries();
    const bookmarkEntries = entries.filter(entry => entry.kind === 'bookmark');
    const viewEntries = entries.filter(entry => entry.kind === 'viewState');

    content.innerHTML = `
      <div class="bookmarks-toolbar">
        <button class="btn btn-primary btn-sm" data-action="add-current" title="Bookmark the current visible region">
          <i class="fas fa-plus"></i> Current View
        </button>
        <button class="btn btn-sm" data-action="refresh" title="Refresh bookmarks">
          <i class="fas fa-sync-alt"></i>
        </button>
      </div>
      ${this._renderGroup('Region Bookmarks', bookmarkEntries, 'bookmark')}
      ${this._renderGroup('Saved Views', viewEntries, 'viewState')}
    `;
  }

  _renderGroup(title, entries, kind) {
    if (entries.length === 0) {
      const emptyText = kind === 'bookmark' ? 'No region bookmarks saved' : 'No saved views available';
      return `
        <div class="bookmark-group">
          <div class="bookmark-group-title">${this._esc(title)}</div>
          <p class="bookmarks-empty">${emptyText}</p>
        </div>
      `;
    }

    return `
      <div class="bookmark-group">
        <div class="bookmark-group-title">${this._esc(title)}</div>
        <div class="bookmark-list">
          ${entries.map(entry => this._entryHtml(entry)).join('')}
        </div>
      </div>
    `;
  }

  _entryHtml(entry) {
    const action = entry.kind === 'viewState' ? 'restore' : 'navigate';
    const actionIcon = entry.kind === 'viewState' ? 'fa-history' : 'fa-crosshairs';
    const actionTitle = entry.kind === 'viewState' ? 'Restore saved view' : 'Go to bookmark';
    const coordinateText =
      entry.chromosome && Number.isFinite(entry.start) && Number.isFinite(entry.end)
        ? `${entry.chromosome}:${Number(entry.start).toLocaleString()}-${Number(entry.end).toLocaleString()}`
        : 'Position unavailable';
    const createdText = entry.created ? this._formatDate(entry.created) : '';
    const notesText = entry.notes || entry.description || '';

    return `
      <div class="bookmark-item" data-bookmark-kind="${entry.kind}" data-bookmark-key="${this._esc(entry.key)}">
        <div class="bookmark-main">
          <div class="bookmark-title">${this._esc(entry.name || 'Untitled')}</div>
          <div class="bookmark-position">${this._esc(coordinateText)}</div>
          ${notesText ? `<div class="bookmark-notes">${this._esc(notesText)}</div>` : ''}
          ${createdText ? `<div class="bookmark-created">${this._esc(createdText)}</div>` : ''}
        </div>
        <div class="bookmark-actions">
          <button class="btn btn-xs" data-action="${action}" title="${actionTitle}">
            <i class="fas ${actionIcon}"></i>
          </button>
          <button class="btn btn-xs btn-danger" data-action="delete" title="Delete">
            <i class="fas fa-trash"></i>
          </button>
        </div>
      </div>
    `;
  }

  async _onClick(event) {
    const actionEl = event.target.closest('[data-action]');
    if (!actionEl) return;

    const action = actionEl.getAttribute('data-action');
    const row = event.target.closest('[data-bookmark-key]');
    const key = row?.getAttribute('data-bookmark-key');

    try {
      switch (action) {
        case 'add-current':
          await this._addCurrentBookmark();
          break;
        case 'refresh':
          this.refresh();
          break;
        case 'navigate':
          if (key) this._navigateToBookmark(key);
          break;
        case 'restore':
          if (key) await this._restoreViewState(key);
          break;
        case 'delete':
          if (key) await this._deleteEntry(key);
          break;
        default:
          break;
      }
    } catch (error) {
      this._notify(error?.message || 'Bookmark action failed', 'error');
    }
  }

  async _addCurrentBookmark() {
    const currentPosition = this.gb?.currentPosition;
    const chromosome = document.getElementById('chromosomeSelect')?.value || this.gb?.currentChromosome;
    if (!chromosome || !currentPosition) {
      this._notify('Load genome data before creating a bookmark', 'warn');
      return;
    }

    const start = (Number(currentPosition.start) || 0) + 1;
    const end = Number(currentPosition.end) || start;
    const defaultName = `${chromosome}:${start}-${end}`;
    const name = typeof window.prompt === 'function' ? window.prompt('Bookmark name', defaultName) : defaultName;
    if (!name || !name.trim()) return;

    if (this.gb?.chatManager && typeof this.gb.chatManager.bookmarkPosition === 'function') {
      await this.gb.chatManager.bookmarkPosition({
        name: name.trim(),
        chromosome,
        start,
        end,
      });
    } else {
      const bookmarks = this._getConfigBookmarks();
      bookmarks.push({
        id: this._generateId(),
        name: name.trim(),
        chromosome,
        start,
        end,
        notes: '',
        created: new Date().toISOString(),
      });
      await this.gb?.configManager?.set?.('bookmarks', bookmarks);
      await this.gb?.configManager?.save?.();
    }

    this.refresh();
    this._notify(`Bookmarked ${chromosome}:${start}-${end}`, 'success');
  }

  _navigateToBookmark(key) {
    const entry = this._getEntries().find(candidate => candidate.key === key);
    if (!entry || !entry.chromosome || !Number.isFinite(entry.start) || !Number.isFinite(entry.end)) {
      this._notify('Bookmark does not contain a navigable region', 'warn');
      return;
    }

    const result = this.gb?.navigationManager?.navigateToPosition?.(entry.chromosome, entry.start, entry.end);
    if (result && result.success === false) {
      throw new Error(result.error || 'Navigation failed');
    }
  }

  async _restoreViewState(key) {
    const entry = this._getEntries().find(candidate => candidate.key === key);
    if (!entry) return;

    if (this.gb?.chatManager && typeof this.gb.chatManager.restoreViewState === 'function') {
      await this.gb.chatManager.restoreViewState(entry.id ? { id: entry.id } : { name: entry.name });
      return;
    }

    this._navigateToBookmark(key);
  }

  async _deleteEntry(key) {
    const entry = this._getEntries().find(candidate => candidate.key === key);
    if (!entry) return;
    if (typeof window.confirm === 'function' && !window.confirm(`Delete "${entry.name || 'Untitled'}"?`)) {
      return;
    }

    if (entry.kind === 'bookmark') {
      await this._deleteBookmark(entry);
    } else {
      await this._deleteViewState(entry);
    }

    this.refresh();
  }

  async _deleteBookmark(entry) {
    if (entry.source === 'localStorage') {
      const bookmarks = this._getLocalBookmarks().filter(
        bookmark => this._bookmarkKey(bookmark, 'localStorage') !== entry.key
      );
      this._setLocalJson('genome_browser_bookmarks', bookmarks);
      return;
    }

    const bookmarks = this._getConfigBookmarks().filter(
      bookmark => this._bookmarkKey(bookmark, 'config') !== entry.key
    );
    await this.gb?.configManager?.set?.('bookmarks', bookmarks);
    await this.gb?.configManager?.save?.();
  }

  async _deleteViewState(entry) {
    const matches = state => {
      if (!state || typeof state !== 'object') return false;
      if (entry.id) return state.id === entry.id;
      return this._viewStateKey(state) === entry.key;
    };

    const configStates = this._getConfigViewStates().filter(state => !matches(state));
    await this.gb?.configManager?.set?.('viewStates', configStates);
    await this.gb?.configManager?.save?.();

    const localStates = this._getLocalViewStates().filter(state => !matches(state));
    this._setLocalJson('genome_browser_view_states', localStates);
  }

  _getEntries() {
    return [...this._getBookmarkEntries(), ...this._getViewStateEntries()].sort((a, b) => {
      const aTime = Date.parse(a.created || 0) || 0;
      const bTime = Date.parse(b.created || 0) || 0;
      return bTime - aTime;
    });
  }

  _getBookmarkEntries() {
    const entries = [];
    const seen = new Set();

    const append = (bookmark, source) => {
      const entry = this._normalizeBookmark(bookmark, source);
      if (!entry || seen.has(entry.key)) return;
      seen.add(entry.key);
      entries.push(entry);
    };

    this._getConfigBookmarks().forEach(bookmark => append(bookmark, 'config'));
    this._getLocalBookmarks().forEach(bookmark => append(bookmark, 'localStorage'));
    return entries;
  }

  _getViewStateEntries() {
    const states =
      this.gb?.chatManager && typeof this.gb.chatManager.getAllStoredViewStates === 'function'
        ? this.gb.chatManager.getAllStoredViewStates()
        : [...this._getConfigViewStates(), ...this._getLocalViewStates()];
    const entries = [];
    const seen = new Set();

    for (const state of states) {
      const entry = this._normalizeViewState(state);
      if (!entry || seen.has(entry.key)) continue;
      seen.add(entry.key);
      entries.push(entry);
    }

    return entries;
  }

  _normalizeBookmark(bookmark, source) {
    if (!bookmark || typeof bookmark !== 'object') return null;
    const position = bookmark.position || {};
    const chromosome = bookmark.chromosome || position.chromosome;
    const start = Number(bookmark.start ?? position.start);
    const end = Number(bookmark.end ?? position.end);

    return {
      kind: 'bookmark',
      source,
      key: this._bookmarkKey(bookmark, source),
      id: bookmark.id || null,
      name: bookmark.name || 'Untitled bookmark',
      chromosome,
      start,
      end,
      notes: bookmark.notes || '',
      created: bookmark.created || bookmark.timestamp || null,
    };
  }

  _normalizeViewState(state) {
    if (!state || typeof state !== 'object') return null;
    const position = state.position || {};
    const start = Number(position.start);
    const end = Number(position.end);

    return {
      kind: 'viewState',
      source: 'viewStates',
      key: this._viewStateKey(state),
      id: state.id || null,
      name: state.name || 'Untitled saved view',
      chromosome: state.chromosome,
      start: Number.isFinite(start) ? start + 1 : start,
      end,
      description: state.description || '',
      created: state.created || null,
    };
  }

  _getConfigBookmarks() {
    const bookmarks = this.gb?.configManager?.get?.('bookmarks', []);
    return Array.isArray(bookmarks) ? bookmarks : [];
  }

  _getConfigViewStates() {
    const states = this.gb?.configManager?.get?.('viewStates', []);
    return Array.isArray(states) ? states : [];
  }

  _getLocalBookmarks() {
    return this._getLocalJson('genome_browser_bookmarks');
  }

  _getLocalViewStates() {
    return this._getLocalJson('genome_browser_view_states');
  }

  _getLocalJson(key) {
    try {
      const stored = localStorage.getItem(key);
      const parsed = stored ? JSON.parse(stored) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn(`Failed to read ${key}:`, error);
      return [];
    }
  }

  _setLocalJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (error) {
      console.warn(`Failed to write ${key}:`, error);
    }
  }

  _bookmarkKey(bookmark, source) {
    if (bookmark.id) return `${source}:${bookmark.id}`;
    const position = bookmark.position || {};
    return `${source}:${bookmark.name || 'untitled'}:${bookmark.created || bookmark.timestamp || ''}:${
      bookmark.chromosome || position.chromosome || ''
    }:${bookmark.start ?? position.start ?? ''}-${bookmark.end ?? position.end ?? ''}`;
  }

  _viewStateKey(state) {
    if (state.id) return `viewState:${state.id}`;
    return `viewState:${state.name || 'untitled'}:${state.created || ''}:${state.chromosome || ''}:${
      state.position?.start ?? ''
    }-${state.position?.end ?? ''}`;
  }

  _formatDate(value) {
    const date = typeof value === 'number' ? new Date(value) : new Date(value);
    if (!Number.isFinite(date.getTime())) return '';
    return date.toLocaleString();
  }

  _generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 11);
  }

  _notify(message, type = 'info') {
    if (typeof window._notificationService?.toast === 'function') {
      window._notificationService.toast(message, type);
    } else if (typeof this.gb?.showNotification === 'function') {
      this.gb.showNotification(message, type);
    } else if (type === 'error') {
      alert(message);
    }
  }

  _esc(value) {
    return String(value ?? '').replace(/[&<>"']/g, ch => {
      switch (ch) {
        case '&':
          return '&amp;';
        case '<':
          return '&lt;';
        case '>':
          return '&gt;';
        case '"':
          return '&quot;';
        default:
          return '&#39;';
      }
    });
  }
}

if (typeof window !== 'undefined') {
  window.BookmarkPanelUI = BookmarkPanelUI;
}
