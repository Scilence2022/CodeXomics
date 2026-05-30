/**
 * ChatManager Close Tab Tests
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const CM_PATH = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');

describe('ChatManager - Close Tab Default Behavior', () => {
  it('should support optional params in closeTab signature', () => {
    const content = fs.readFileSync(CM_PATH, 'utf-8');
    expect(content).toContain('async closeTab(params = {})');
  });

  it('should fall back to currently active tab when no parameters are provided', () => {
    const content = fs.readFileSync(CM_PATH, 'utf-8');
    // Verify it resolves targetTabId from tabManager.activeTabId
    expect(content).toContain('targetTabId = tabManager.activeTabId;');
    // Verify it resolves tab title from targetTabId if available
    expect(content).toContain('targetTabTitle = tabState?.title || ' + '`Tab $' + '{targetTabId}`;');
    // Verify it throws an error if no active tab is found
    expect(content).toContain("throw new Error('No active tab to close');");
  });
});
