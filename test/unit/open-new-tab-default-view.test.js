/**
 * open_new_tab with a chromosome but no coordinates means "open the current
 * view"; regression: it threw "Missing required parameters" and killed the
 * tab lifecycle workflow.
 */
import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const ChatManager = require('../../src/renderer/modules/ChatManager.js');

describe('ChatManager.openNewTab', () => {
  it('defaults a chromosome-only call to the current view range', async () => {
    const manager = Object.create(ChatManager.prototype);
    const createTabForPosition = vi.fn(() => 'tab-9');
    globalThis.window = {
      genomeBrowser: {
        currentSequence: { U00096: 'A'.repeat(1000) },
        currentChromosome: 'U00096',
        currentPosition: { start: 123, end: 456 },
        tabManager: { createTabForPosition },
      },
    };

    const result = await manager.openNewTab({ chromosome: 'U00096', title: 'Temporary Analysis Tab' });

    expect(createTabForPosition).toHaveBeenCalledWith('U00096', 123, 456, 'Temporary Analysis Tab');
    expect(result.success).toBe(true);
    expect(result.tabId).toBe('tab-9');
  });

  it('still rejects a chromosome that is not loaded', async () => {
    const manager = Object.create(ChatManager.prototype);
    globalThis.window = {
      genomeBrowser: {
        currentSequence: { U00096: 'A'.repeat(1000) },
        currentChromosome: 'U00096',
        currentPosition: { start: 123, end: 456 },
        tabManager: { createTabForPosition: vi.fn() },
      },
    };

    await expect(manager.openNewTab({ chromosome: 'chr1', title: 'T' })).rejects.toThrow('Chromosome chr1 not found');
  });
});
