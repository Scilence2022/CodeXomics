import fs from 'fs';
import path from 'path';
import { describe, expect, it } from 'vitest';

const RENDERER_PATH = path.join(process.cwd(), 'src/renderer/renderer-modular.js');

describe('MCP Bridge startup', () => {
  it('starts the bridge even when the MCP WebSocket port is not listening yet', () => {
    const source = fs.readFileSync(RENDERER_PATH, 'utf-8');

    expect(source).toContain('startMCPBridgeWithAvailabilityCheck');
    expect(source).toContain('this.mcpBridge.start();');
    expect(source).toContain('retrying until MCP WebSocket port');
    expect(source).not.toContain('but not started (MCP WebSocket port');
  });

  it('uses the configured MCP WebSocket port for the bridge URL', () => {
    const source = fs.readFileSync(RENDERER_PATH, 'utf-8');

    expect(source).toContain('wsPort = settings?.wsPort || 3003');
    expect(source).toMatch(/this\.mcpBridge\.wsUrl = `ws:\/\/localhost:\$\{wsPort\}`/);
  });
});
