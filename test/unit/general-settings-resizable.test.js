/**
 * General Settings modal: resizing.
 *
 * - GeneralSettingsManager initializes before the async-loaded drag/resize
 *   managers exist, so it must keep retrying instead of silently skipping
 *   registration (which left resetSize() with nothing to restore).
 * - resetSize() must keep the modal resizable: clearing max-width brought back
 *   the stylesheet cap (.modal-content.large) and pinned the width.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import GeneralSettingsManager from '../../src/renderer/modules/GeneralSettingsManager.js';
import '../../src/renderer/modules/ResizableModalManager.js';

const indexHtml = fs.readFileSync(path.join(process.cwd(), 'src/renderer/index.html'), 'utf8');
const parsedIndex = new DOMParser().parseFromString(indexHtml, 'text/html');

function mountModal() {
  document.body.innerHTML = parsedIndex.getElementById('generalSettingsModal').outerHTML;
  return document.querySelector('#generalSettingsModal .modal-content');
}

afterEach(() => {
  vi.useRealTimers();
  delete window.modalDragManager;
  delete window.resizableModalManager;
  document.body.innerHTML = '';
});

describe('General Settings resizable modal', () => {
  it('ships all eight resize handles', () => {
    const content = mountModal();
    const handles = [...content.querySelectorAll('.resize-handle')].map(h => h.className);
    for (const dir of ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw']) {
      expect(handles.some(c => c.split(' ').includes(`resize-handle-${dir}`))).toBe(true);
    }
  });

  it('registers with the managers once they finish loading', () => {
    vi.useFakeTimers();
    mountModal();
    const manager = Object.create(GeneralSettingsManager.prototype);

    manager.registerModalBehavior();
    const makeDraggable = vi.fn();
    const makeResizable = vi.fn();
    window.modalDragManager = { makeDraggable };
    window.resizableModalManager = { makeResizable };
    vi.advanceTimersByTime(250);

    expect(makeDraggable).toHaveBeenCalledWith('#generalSettingsModal');
    expect(makeResizable).toHaveBeenCalledWith('#generalSettingsModal');
  });

  it('wires the header reset button to both position and size', () => {
    const modal = parsedIndex.getElementById('generalSettingsModal');
    expect(modal.querySelector('.reset-position-btn').getAttribute('title')).toContain('Size');

    mountModal();
    const resetPosition = vi.fn();
    const resetSize = vi.fn();
    window.modalDragManager = { makeDraggable: vi.fn(), resetPosition };
    window.resizableModalManager = { makeResizable: vi.fn(), resetSize };
    const manager = Object.create(GeneralSettingsManager.prototype);
    manager.setupModalHandlers();

    document.querySelector('#generalSettingsModal .reset-position-btn').click();
    expect(resetPosition).toHaveBeenCalledWith('#generalSettingsModal');
    expect(resetSize).toHaveBeenCalledWith('#generalSettingsModal');
  });

  it('resetSize restores the authored width and stays resizable', () => {
    const content = mountModal();
    const resizer = new window.ResizableModalManager();
    resizer.makeResizable('#generalSettingsModal');
    expect(content.getAttribute('data-initial-inline-width')).toBe('1080px');

    content.style.width = '1200px';
    content.style.height = '900px';
    content.style.position = 'fixed';
    resizer.resetSize('#generalSettingsModal');

    expect(content.style.height).toBe('');
    expect(content.style.position).toBe('');
    expect(content.style.getPropertyValue('max-width')).toBe('none');
    expect(content.style.getPropertyPriority('max-width')).toBe('important');
  });
});
