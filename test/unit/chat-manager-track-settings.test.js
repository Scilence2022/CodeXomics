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
