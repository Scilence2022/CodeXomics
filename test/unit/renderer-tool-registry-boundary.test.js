import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const CHAT_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');
const ADAPTER_PATH = path.join(process.cwd(), 'src/renderer/modules/DynamicToolsSnapshotAdapter.js');
const INDEX_PATH = path.join(process.cwd(), 'src/renderer/index.html');

describe('Renderer Tool Registry Boundary', () => {
  it('loads dynamic tool definitions through preload IPC instead of renderer filesystem require', () => {
    const content = fs.readFileSync(CHAT_MANAGER_PATH, 'utf-8');
    const adapterContent = fs.readFileSync(ADAPTER_PATH, 'utf-8');
    const indexContent = fs.readFileSync(INDEX_PATH, 'utf-8');

    expect(content).toContain('getToolRegistrySnapshot');
    expect(content).toContain('createDynamicToolsSnapshotAdapter');
    expect(content).toContain('new DynamicToolsSnapshotAdapter(snapshot, this)');
    expect(indexContent).toContain('modules/DynamicToolsSnapshotAdapter.js');
    expect(adapterContent).toContain('class DynamicToolsSnapshotAdapter');
    expect(content).not.toContain('tools_registry/system_integration');
    expect(content).not.toContain("window.require('fs')");
    expect(content).not.toContain('window.require("fs")');
    expect(adapterContent).not.toContain("require('fs')");
    expect(adapterContent).not.toContain('require("fs")');
  });
});
