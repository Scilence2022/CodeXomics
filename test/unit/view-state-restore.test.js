import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ChatManager = require('../../src/renderer/modules/ChatManager.js');

describe('ChatManager restore_view_state', () => {
  it('stores current-view bookmarks using external one-based coordinates', async () => {
    const manager = Object.create(ChatManager.prototype);
    const savedValues = {};
    manager.app = {
      currentChromosome: 'chr1',
      currentPosition: { start: 119999, end: 121000 },
      bookmarkPanelUI: { refreshIfOpen: vi.fn() },
    };
    manager.configManager = {
      get: vi.fn((path, fallback) => (path === 'bookmarks' ? [] : fallback)),
      set: vi.fn(async (path, value) => {
        savedValues[path] = value;
      }),
      save: vi.fn(async () => {}),
    };

    const result = await manager.bookmarkPosition({ name: 'Test bookmark' });

    expect(result.success).toBe(true);
    expect(result.bookmark.chromosome).toBe('chr1');
    expect(result.bookmark.start).toBe(120000);
    expect(result.bookmark.end).toBe(121000);
    expect(savedValues.bookmarks).toHaveLength(1);
    expect(manager.configManager.save).toHaveBeenCalled();
    expect(manager.app.bookmarkPanelUI.refreshIfOpen).toHaveBeenCalled();
  });

  it('restores the newest saved view state matching a name', async () => {
    const manager = Object.create(ChatManager.prototype);
    const olderState = {
      id: 'old',
      name: 'benchmark smoke view',
      chromosome: 'chr1',
      position: { start: 100, end: 200 },
      visibleTracks: ['genes'],
      trackSettings: { genes: { height: 80 } },
      activeTabId: 'oldTab',
      created: '2026-01-01T00:00:00.000Z',
    };
    const newerState = {
      id: 'new',
      name: 'benchmark smoke view',
      chromosome: 'chr2',
      position: { start: 300, end: 450 },
      visibleTracks: ['genes', 'gc'],
      trackSettings: { gc: { height: 120 } },
      activeTabId: 'newTab',
      created: '2026-01-02T00:00:00.000Z',
    };

    manager.configManager = {
      get: vi.fn((path, fallback) => (path === 'viewStates' ? [olderState, newerState] : fallback)),
    };
    manager.getStoredViewStates = vi.fn(() => []);
    manager.switchToTab = vi.fn().mockResolvedValue({ tab_id: 'newTab' });
    manager.navigateToPosition = vi.fn().mockResolvedValue({ success: true });
    manager.restoreViewStateTrackVisibility = vi
      .fn()
      .mockResolvedValue({ restored: [{ track: 'genes', visible: true }], warnings: [] });
    manager.restoreViewStateTrackSettings = vi.fn().mockReturnValue({ restored: ['gc'], warnings: [] });

    const result = await manager.restoreViewState({ name: 'benchmark smoke view' });

    expect(result.success).toBe(true);
    expect(result.viewState.id).toBe('new');
    expect(result.matchCount).toBe(2);
    expect(manager.switchToTab).toHaveBeenCalledWith({ tab_id: 'newTab' });
    expect(manager.navigateToPosition).toHaveBeenCalledWith({
      chromosome: 'chr2',
      start: 300,
      end: 450,
    });
    expect(manager.restoreViewStateTrackVisibility).toHaveBeenCalledWith(['genes', 'gc']);
    expect(manager.restoreViewStateTrackSettings).toHaveBeenCalledWith({ gc: { height: 120 } });
  });

  it('adds saved view states to get_bookmarks results', () => {
    const manager = Object.create(ChatManager.prototype);
    const viewState = {
      id: 'state1',
      name: 'saved view',
      chromosome: 'chr1',
      position: { start: 10, end: 20 },
      created: '2026-01-01T00:00:00.000Z',
    };

    manager.configManager = {
      get: vi.fn((path, fallback) => {
        if (path === 'bookmarks') return [];
        if (path === 'viewStates') return [viewState];
        return fallback;
      }),
    };
    manager.getStoredViewStates = vi.fn(() => []);

    const result = manager.getBookmarks({});

    expect(result.totalBookmarks).toBe(0);
    expect(result.totalViewStates).toBe(1);
    expect(result.viewStates).toEqual([viewState]);
  });
});
