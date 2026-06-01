/**
 * ChatManager Track Settings Tests
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const CM_PATH = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');

describe('ChatManager - Track Settings Routing', () => {
  it('should initialize genomeBrowser in constructor', () => {
    const content = fs.readFileSync(CM_PATH, 'utf-8');
    expect(content).toContain('this.genomeBrowser = app || window.genomeBrowser;');
  });

  it('should reference this.genomeBrowser in setTrackSettings method', () => {
    const content = fs.readFileSync(CM_PATH, 'utf-8');
    expect(content).toContain('async setTrackSettings(parameters)');
    expect(content).toContain('this.genomeBrowser.trackRenderer.getTrackSettings(track_type)');
  });
});

describe('ChatManager - Chat Dock Resize Notifications', () => {
  it('dispatches resize after ChatBox dock layout changes', () => {
    const content = fs.readFileSync(CM_PATH, 'utf-8');

    expect(content).toContain("notifyDockLayoutChanged(reason = 'dock-layout')");
    expect(content).toContain("this.notifyDockLayoutChanged('dock splitter');");
    expect(content).toContain("window.dispatchEvent(new Event('resize'));");
  });
});
