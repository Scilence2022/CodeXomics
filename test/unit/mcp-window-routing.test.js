/**
 * Unit tests for MCP server multi-window routing resolution (Layer 1 + Layer 2).
 *
 * These exercise the pure-ish resolution helpers on the class prototype with a
 * stubbed `this`, so no Express/WebSocket server is started.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const StandardClaudeMCPServer = require('../../src/mcp-server.js');
const ToolsIntegrator = require('../../src/mcp-tools/ToolsIntegrator.js');
const InternalMCPServer = require('../../src/renderer/modules/InternalMCPServer.js');

const OPEN = 1; // WebSocket.OPEN

function makeWsClient(windowId, genomeName, readyState = OPEN) {
  return { windowId, genomeName, readyState, send: () => {} };
}

function makeWindowEntry(genomeName, { focused = false, destroyed = false } = {}) {
  return {
    genomeName,
    window: {
      isDestroyed: () => destroyed,
      isFocused: () => focused,
    },
  };
}

function makeCtx() {
  const ctx = Object.create(StandardClaudeMCPServer.prototype);
  ctx.internalClients = new Map();
  ctx.windowRegistry = new Map();
  ctx.mainWindowRegistry = null;
  ctx.internalClient = null;
  ctx.mainWindow = null;
  ctx.sessionWindowPins = new Map();
  ctx.activeWindowId = null;
  return ctx;
}

describe('_attachRoutingMeta', () => {
  const ctx = makeCtx();

  it('merges _meta into object results', () => {
    const out = ctx._attachRoutingMeta({ success: true, value: 42 }, 'win_1', 'ECOLI');
    expect(out.success).toBe(true);
    expect(out.value).toBe(42);
    expect(out._meta).toEqual({ windowId: 'win_1', genomeName: 'ECOLI' });
  });

  it('wraps non-object (array/string) results so meta stays visible', () => {
    const arr = ctx._attachRoutingMeta([1, 2, 3], 'win_2', 'YEAST');
    expect(arr._meta).toEqual({ windowId: 'win_2', genomeName: 'YEAST' });
    expect(arr.result).toEqual([1, 2, 3]);

    const str = ctx._attachRoutingMeta('ok', 'win_3', null);
    expect(str._meta).toEqual({ windowId: 'win_3', genomeName: null });
    expect(str.result).toBe('ok');
  });

  it('does not clobber an existing _meta from the tool', () => {
    const out = ctx._attachRoutingMeta({ _meta: { traceId: 'abc' } }, 'win_4', 'PHAGE');
    expect(out._meta.traceId).toBe('abc');
    expect(out._meta.windowId).toBe('win_4');
    expect(out._meta.genomeName).toBe('PHAGE');
  });
});

describe('resolveInternalClientTarget (WebSocket path)', () => {
  let ctx;
  beforeEach(() => {
    ctx = makeCtx();
  });

  it('routes an explicit, known windowId to that exact client', () => {
    ctx.internalClients.set('win_1', makeWsClient('win_1', 'ECOLI'));
    ctx.internalClients.set('win_2', makeWsClient('win_2', 'YEAST'));
    const { client, windowId } = ctx.resolveInternalClientTarget('get_sequence', 'win_2');
    expect(windowId).toBe('win_2');
    expect(client.genomeName).toBe('YEAST');
  });

  it('throws loudly for an explicit but unknown windowId (no silent retarget)', () => {
    ctx.internalClients.set('win_1', makeWsClient('win_1', 'ECOLI'));
    expect(() => ctx.resolveInternalClientTarget('get_sequence', 'win_999')).toThrow(/not a connected/i);
  });

  it('auto-selects the single live client when none is addressed', () => {
    ctx.internalClients.set('win_1', makeWsClient('win_1', 'ECOLI'));
    const { windowId } = ctx.resolveInternalClientTarget('get_sequence', null);
    expect(windowId).toBe('win_1');
  });

  it('throws loudly when multiple windows are open, none focused, and no windowId is given', () => {
    ctx.internalClients.set('win_1', makeWsClient('win_1', 'ECOLI'));
    ctx.internalClients.set('win_2', makeWsClient('win_2', 'YEAST'));
    expect(() => ctx.resolveInternalClientTarget('get_sequence', null)).toThrow(/ambiguous/i);
  });

  it('does NOT throw for window-agnostic tools (ping) even when ambiguous', () => {
    ctx.internalClients.set('win_1', makeWsClient('win_1', 'ECOLI'));
    ctx.internalClients.set('win_2', makeWsClient('win_2', 'YEAST'));
    const { client } = ctx.resolveInternalClientTarget('ping', null);
    expect(client).toBeTruthy();
  });

  it('prefers the focused genome window when no windowId is given', () => {
    ctx.internalClients.set('win_1', makeWsClient('win_1', 'ECOLI'));
    ctx.internalClients.set('win_2', makeWsClient('win_2', 'YEAST'));
    ctx.windowRegistry.set('win_1', makeWindowEntry('ECOLI', { focused: false }));
    ctx.windowRegistry.set('win_2', makeWindowEntry('YEAST', { focused: true }));
    const { windowId } = ctx.resolveInternalClientTarget('get_sequence', null);
    expect(windowId).toBe('win_2');
  });

  // Regression: focus must be read from the authoritative registry (mainWindowRegistry),
  // the same source list_genome_windows uses — not the empty local windowRegistry cache.
  it('detects focus via the authoritative mainWindowRegistry when the local cache is empty', () => {
    ctx.internalClients.set('win_1', makeWsClient('win_1', 'ECOLI'));
    ctx.internalClients.set('win_2', makeWsClient('win_2', 'YEAST'));
    // Local cache is empty (as it is in-app); authoritative registry has focus state.
    ctx.mainWindowRegistry = new Map([
      ['win_1', makeWindowEntry('ECOLI', { focused: true })],
      ['win_2', makeWindowEntry('YEAST', { focused: false })],
    ]);
    const { windowId } = ctx.resolveInternalClientTarget('codexomics_chat', null);
    expect(windowId).toBe('win_1');
  });

  it('falls back to the last activated window when nothing is focused (background automation)', () => {
    ctx.internalClients.set('win_1', makeWsClient('win_1', 'ECOLI'));
    ctx.internalClients.set('win_2', makeWsClient('win_2', 'YEAST'));
    // No focus anywhere (app in background); switch_active_window set this.
    ctx.activeWindowId = 'win_2';
    const { windowId } = ctx.resolveInternalClientTarget('codexomics_chat', null);
    expect(windowId).toBe('win_2');
  });

  it('still throws ambiguous when nothing is focused and no window was activated', () => {
    ctx.internalClients.set('win_1', makeWsClient('win_1', 'ECOLI'));
    ctx.internalClients.set('win_2', makeWsClient('win_2', 'YEAST'));
    expect(() => ctx.resolveInternalClientTarget('codexomics_chat', null)).toThrow(/ambiguous/i);
  });
});

describe('resolveElectronTarget (IPC path)', () => {
  let ctx;
  beforeEach(() => {
    ctx = makeCtx();
  });

  it('routes an explicit, known windowId to that window', () => {
    ctx.windowRegistry.set('win_1', makeWindowEntry('ECOLI'));
    ctx.windowRegistry.set('win_2', makeWindowEntry('YEAST'));
    const { windowId, genomeName } = ctx.resolveElectronTarget('get_sequence', 'win_2');
    expect(windowId).toBe('win_2');
    expect(genomeName).toBe('YEAST');
  });

  it('throws loudly for an explicit but unknown windowId', () => {
    ctx.windowRegistry.set('win_1', makeWindowEntry('ECOLI'));
    expect(() => ctx.resolveElectronTarget('get_sequence', 'nope')).toThrow(/not a registered/i);
  });

  it('throws loudly on ambiguous default target (multi-window, none focused)', () => {
    ctx.windowRegistry.set('win_1', makeWindowEntry('ECOLI', { focused: false }));
    ctx.windowRegistry.set('win_2', makeWindowEntry('YEAST', { focused: false }));
    expect(() => ctx.resolveElectronTarget('get_sequence', null)).toThrow(/ambiguous/i);
  });

  it('selects the single live window without a windowId', () => {
    ctx.windowRegistry.set('win_1', makeWindowEntry('ECOLI', { focused: false }));
    const { windowId } = ctx.resolveElectronTarget('get_sequence', null);
    expect(windowId).toBe('win_1');
  });

  it('prefers the focused window when several are open', () => {
    ctx.windowRegistry.set('win_1', makeWindowEntry('ECOLI', { focused: false }));
    ctx.windowRegistry.set('win_2', makeWindowEntry('YEAST', { focused: true }));
    const { windowId } = ctx.resolveElectronTarget('get_sequence', null);
    expect(windowId).toBe('win_2');
  });

  it('uses the authoritative mainWindowRegistry and the activeWindowId fallback', () => {
    ctx.mainWindowRegistry = new Map([
      ['win_1', makeWindowEntry('ECOLI', { focused: false })],
      ['win_2', makeWindowEntry('YEAST', { focused: false })],
    ]);
    ctx.activeWindowId = 'win_1';
    const { windowId, genomeName } = ctx.resolveElectronTarget('get_sequence', null);
    expect(windowId).toBe('win_1');
    expect(genomeName).toBe('ECOLI');
  });
});

describe('per-session window pins (Layer 2)', () => {
  let ctx;
  beforeEach(() => {
    ctx = makeCtx();
    ctx.sessionWindowPins = new Map();
  });

  it('stores and returns a pin while the window exists', () => {
    ctx.internalClients.set('win_2', makeWsClient('win_2', 'YEAST'));
    ctx.setSessionWindowPin('clientA', 'win_2');
    expect(ctx.getSessionWindowPin('clientA')).toBe('win_2');
  });

  it('keeps pins isolated per client (no global cross-client bleed)', () => {
    ctx.internalClients.set('win_1', makeWsClient('win_1', 'ECOLI'));
    ctx.internalClients.set('win_2', makeWsClient('win_2', 'YEAST'));
    ctx.setSessionWindowPin('clientA', 'win_1');
    ctx.setSessionWindowPin('clientB', 'win_2');
    expect(ctx.getSessionWindowPin('clientA')).toBe('win_1');
    expect(ctx.getSessionWindowPin('clientB')).toBe('win_2');
  });

  it('drops a stale pin when the target window is gone', () => {
    ctx.setSessionWindowPin('clientA', 'win_ghost');
    expect(ctx.getSessionWindowPin('clientA')).toBeNull();
  });

  it('clears all pins targeting a closed window', () => {
    ctx.internalClients.set('win_1', makeWsClient('win_1', 'ECOLI'));
    ctx.setSessionWindowPin('clientA', 'win_1');
    ctx.setSessionWindowPin('clientB', 'win_1');
    ctx.clearSessionWindowPinsForWindow('win_1');
    expect(ctx.sessionWindowPins.size).toBe(0);
  });
});

describe('server initialize instructions (Layer 2)', () => {
  it('returns standing multi-window guidance', () => {
    const ctx = makeCtx();
    const text = ctx.getServerInstructions();
    expect(text).toMatch(/list_genome_windows/);
    expect(text).toMatch(/windowId/);
    expect(text).toMatch(/expected_genome/);
  });
});

describe('tool schema decoration (Layer 2)', () => {
  const decorate = tool => ToolsIntegrator.prototype._addWindowTargetingParams.call({}, tool);

  it('adds optional windowId and expected_genome to a genome tool', () => {
    const out = decorate({
      name: 'get_sequence',
      inputSchema: { type: 'object', properties: { start: { type: 'number' } }, required: ['start'] },
    });
    expect(out.inputSchema.properties.windowId.type).toBe('string');
    expect(out.inputSchema.properties.expected_genome.type).toBe('string');
    // does not make them required
    expect(out.inputSchema.required).toEqual(['start']);
    // original property preserved
    expect(out.inputSchema.properties.start.type).toBe('number');
  });

  it('does not touch window-management or chat tools', () => {
    for (const name of ['list_genome_windows', 'switch_active_window', 'codexomics_chat']) {
      const tool = { name, inputSchema: { type: 'object', properties: {} } };
      const out = decorate(tool);
      expect(out.inputSchema.properties.windowId).toBeUndefined();
    }
  });
});

describe('genome-identity guard (Layer 2)', () => {
  function makeInternalServer(currentGenomeName, executeToolByName) {
    const ctx = Object.create(InternalMCPServer.prototype);
    ctx.genomeStudio = { currentGenomeName, chatManager: { executeToolByName } };
    return ctx;
  }

  it('throws on genome mismatch instead of answering from the wrong genome', async () => {
    const ctx = makeInternalServer('ECOLI', () => ({ ok: true }));
    await expect(ctx.executeMethod('getSequence', { expected_genome: 'YEAST', start: 1 })).rejects.toThrow(
      /Genome mismatch/i
    );
  });

  it('proceeds and strips expected_genome when the genome matches (case-insensitive)', async () => {
    let captured = null;
    const ctx = makeInternalServer('ECOLI', (toolName, params) => {
      captured = { toolName, params };
      return { sequence: 'ATGC' };
    });
    const result = await ctx.executeMethod('getSequence', { expected_genome: 'ecoli', start: 5 });
    expect(result.success).toBe(true);
    expect(captured.toolName).toBe('get_sequence');
    expect(captured.params.start).toBe(5);
    expect(captured.params.expected_genome).toBeUndefined();
  });
});

describe('fan-out across windows (Layer 3)', () => {
  const safe = name => ToolsIntegrator.prototype.isFanoutSafeTool.call({}, name);

  it('classifies read-only vs unsafe tools', () => {
    for (const ok of ['get_sequence', 'search_features', 'get_current_state', 'compute_gc', 'analyze_codon_usage']) {
      expect(safe(ok), `${ok} should be fan-out safe`).toBe(true);
    }
    for (const bad of [
      'delete_sequence',
      'add_annotation',
      'navigate_to_position',
      'switch_active_window',
      'run_on_windows',
      'export_image',
      'create_track',
    ]) {
      expect(safe(bad), `${bad} should NOT be fan-out safe`).toBe(false);
    }
  });

  it('_mapWithConcurrency preserves order with a bounded pool', async () => {
    const ctx = Object.create(ToolsIntegrator.prototype);
    const out = await ctx._mapWithConcurrency([1, 2, 3, 4, 5], 2, async n => n * 10);
    expect(out).toEqual([10, 20, 30, 40, 50]);
  });

  function makeFanoutCtx(executeToolOnClient) {
    const ctx = Object.create(ToolsIntegrator.prototype);
    ctx.allTools = { search_features: {}, delete_sequence: {} };
    ctx.server = {
      executeToolOnClient,
      listWindows: () => [
        { windowId: 'win_1', genomeName: 'ECOLI', isDestroyed: false },
        { windowId: 'win_2', genomeName: 'YEAST', isDestroyed: false },
      ],
    };
    return ctx;
  }

  it('rejects mutating inner tools', async () => {
    const ctx = makeFanoutCtx(async () => ({}));
    const res = await ctx.executeRunOnWindows({ tool: 'delete_sequence' });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/cannot be fanned out/i);
  });

  it('rejects an inner tool that does not exist', async () => {
    const ctx = makeFanoutCtx(async () => ({}));
    const res = await ctx.executeRunOnWindows({ tool: 'get_unknown_thing' });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/not found/i);
  });

  it('runs across all windows and isolates per-window failures', async () => {
    const ctx = makeFanoutCtx(async (tool, params) => {
      if (params.windowId === 'win_2') throw new Error('boom in yeast');
      return { matched: 3, windowId: params.windowId };
    });
    const res = await ctx.executeRunOnWindows({ tool: 'search_features', parameters: { query: 'dnaA' } });
    expect(res.success).toBe(true);
    expect(res.windowCount).toBe(2);
    expect(res.succeeded).toBe(1);
    expect(res.failed).toBe(1);

    const ecoli = res.results.find(r => r.windowId === 'win_1');
    const yeast = res.results.find(r => r.windowId === 'win_2');
    expect(ecoli.success).toBe(true);
    expect(ecoli.genomeName).toBe('ECOLI');
    expect(yeast.success).toBe(false);
    expect(yeast.error).toMatch(/boom/);
  });

  it('errors on unknown windowIds in the restrict list', async () => {
    const ctx = makeFanoutCtx(async () => ({}));
    const res = await ctx.executeRunOnWindows({ tool: 'search_features', windowIds: ['win_9'] });
    expect(res.success).toBe(false);
    expect(res.error).toMatch(/unknown windowid/i);
  });

  it('passes the explicit windowId (not the inner params windowId) to each call', async () => {
    const seen = [];
    const ctx = makeFanoutCtx(async (tool, params) => {
      seen.push(params.windowId);
      return { ok: true };
    });
    await ctx.executeRunOnWindows({ tool: 'search_features', parameters: { windowId: 'win_bogus' } });
    expect(seen.sort()).toEqual(['win_1', 'win_2']);
  });
});
