import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const MCPBridge = require('../../src/renderer/modules/MCPBridge.js');

// Minimal mock of the browser WebSocket used by MCPBridge.
class MockWebSocket {
  constructor() {
    this.readyState = MockWebSocket.CONNECTING;
    this.sent = [];
    this.onopen = null;
    this.onmessage = null;
    this.onclose = null;
    this.onerror = null;
  }

  send(data) {
    this.sent.push(JSON.parse(data));
  }

  close() {
    this.readyState = MockWebSocket.CLOSED;
    if (this.onclose) this.onclose();
  }

  // Test helper: simulate the server accepting the connection.
  open() {
    this.readyState = MockWebSocket.OPEN;
    if (this.onopen) this.onopen();
  }
}
MockWebSocket.CONNECTING = 0;
MockWebSocket.OPEN = 1;
MockWebSocket.CLOSED = 3;

function genomeMessages(ws) {
  return ws.sent.filter(m => m.type === 'genome-loaded').map(m => m.genomeName);
}

describe('MCPBridge genome name resync', () => {
  let sockets;

  beforeEach(() => {
    sockets = [];
    global.WebSocket = vi.fn(function () {
      const ws = new MockWebSocket();
      sockets.push(ws);
      return ws;
    });
    // MCPBridge references the global WebSocket constants via WebSocket.OPEN etc.
    global.WebSocket.OPEN = MockWebSocket.OPEN;
    global.WebSocket.CONNECTING = MockWebSocket.CONNECTING;
    global.WebSocket.CLOSED = MockWebSocket.CLOSED;
    global.window = { dispatchEvent: () => {}, CustomEvent: function () {} };
  });

  it('replays a genome loaded before the bridge connected', () => {
    const bridge = new MCPBridge();
    // Genome loaded while the socket is not yet open.
    bridge.reportGenomeLoaded('ECOLI.gbk');
    expect(bridge.currentGenomeName).toBe('ECOLI.gbk');

    bridge.start();
    sockets[0].open();

    expect(genomeMessages(sockets[0])).toContain('ECOLI.gbk');
  });

  it('re-sends the genome name on reconnect (not one-shot)', () => {
    const bridge = new MCPBridge();
    bridge.reportGenomeLoaded('ECOLI.gbk');

    bridge.start();
    sockets[0].open();
    expect(genomeMessages(sockets[0])).toContain('ECOLI.gbk');

    // Drop the connection and reconnect (e.g. standalone MCP server restarted).
    sockets[0].close();
    bridge.connect();
    sockets[1].open();

    // The second socket must also receive the genome name.
    expect(genomeMessages(sockets[1])).toContain('ECOLI.gbk');
  });

  it('sends immediately when reporting while already connected', () => {
    const bridge = new MCPBridge();
    bridge.start();
    sockets[0].open();

    bridge.reportGenomeLoaded('PHAGE.fasta');

    expect(genomeMessages(sockets[0])).toContain('PHAGE.fasta');
  });
});
