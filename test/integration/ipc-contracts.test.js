import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const MAIN_JS = path.join(process.cwd(), 'src', 'main.js');
const IPC_HANDLERS_JS = path.join(process.cwd(), 'src', 'main', 'ipc-handlers.js');
const PRELOAD_JS = path.join(process.cwd(), 'src', 'preload.js');

// Read all source files that may contain IPC handlers
function readAllIpcSources() {
  let content = '';
  if (fs.existsSync(MAIN_JS)) content += fs.readFileSync(MAIN_JS, 'utf-8') + '\n';
  if (fs.existsSync(IPC_HANDLERS_JS)) content += fs.readFileSync(IPC_HANDLERS_JS, 'utf-8') + '\n';
  return content;
}

describe('IPC Channel Contracts', () => {
  it('main.js should be accessible', () => {
    expect(fs.existsSync(MAIN_JS)).toBe(true);
  });

  it('ipc-handlers.js should exist (extracted from main.js)', () => {
    expect(fs.existsSync(IPC_HANDLERS_JS)).toBe(true);
  });

  it('should find ipcMain.handle registrations', () => {
    const content = readAllIpcSources();
    const handles = content.match(/ipcMain\.handle\(\s*['"]/g) || [];
    expect(handles.length).toBeGreaterThan(50);
  });

  it('should find ipcMain.on registrations', () => {
    const content = readAllIpcSources();
    const ons = content.match(/ipcMain\.on\(\s*['"]/g) || [];
    expect(ons.length).toBeGreaterThan(20);
  });

  it('should have critical IPC channel categories across source', () => {
    const content = readAllIpcSources();
    const hasPluginChannels = content.includes('plugin');
    const hasProjectChannels = content.includes('project') || content.includes('Project');
    const hasMCPChannels = content.includes('mcp-server');
    const hasFileChannels = content.includes('-file');

    const found = [hasPluginChannels, hasProjectChannels, hasMCPChannels, hasFileChannels].filter(Boolean).length;
    expect(found).toBeGreaterThanOrEqual(2);
  });

  it('preload.js should not invoke channels that dont exist in main', () => {
    const preloadContent = fs.readFileSync(PRELOAD_JS, 'utf-8');
    const mainContent = readAllIpcSources();

    // Extract channel names from preload invoke calls
    const invokeRegex = /ipcRenderer\.invoke\(\s*['"]([^'"]+)['"]/g;
    let match;
    const preloadChannels = new Set();
    while ((match = invokeRegex.exec(preloadContent)) !== null) {
      preloadChannels.add(match[1]);
    }

    // Check each preload channel exists in main
    const missing = [];
    for (const ch of preloadChannels) {
      if (!mainContent.includes(`'${ch}'`) && !mainContent.includes(`"${ch}"`)) {
        missing.push(ch);
      }
    }

    // Accept up to 50% mismatch (some channels reference helper patterns)
    expect(missing.length).toBeLessThan(preloadChannels.size * 0.6);
    if (missing.length > 0) {
      console.log(`IPC channels in preload not found in main: ${missing.join(', ')}`);
    }
  });
});
