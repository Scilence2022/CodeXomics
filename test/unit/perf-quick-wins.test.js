/* eslint-disable no-new-func */
/**
 * Regression tests for the renderer response-speed quick wins:
 *
 *  - wheel-zoom rendering is coalesced into one commit per animation frame
 *  - updateThinkingMessage appends instead of re-parsing the whole log
 *  - the debug-logging gate silences verbose console output but never warn/error
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import NavigationManager from '../../src/renderer/modules/NavigationManager.js';
import ChatManager from '../../src/renderer/modules/ChatManager.js';

describe('wheel-zoom render coalescing', () => {
  let nm;
  let frameCallbacks;

  beforeEach(() => {
    frameCallbacks = [];
    vi.stubGlobal('requestAnimationFrame', cb => {
      frameCallbacks.push(cb);
      return frameCallbacks.length;
    });

    nm = Object.create(NavigationManager.prototype);
    nm.wheelZoomFrameHandle = null;
    nm.pendingWheelZoom = null;
    nm.commitWheelZoom = vi.fn();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const runFrame = () => {
    const callbacks = frameCallbacks;
    frameCallbacks = [];
    callbacks.forEach(cb => cb());
  };

  it('commits once per frame no matter how many wheel events arrive', () => {
    for (let i = 0; i < 25; i++) {
      nm.scheduleWheelZoomCommit({ currentChr: 'chr1', sequence: 'ACGT', zoomDirection: -1 });
    }

    // Nothing renders until the frame runs.
    expect(nm.commitWheelZoom).not.toHaveBeenCalled();
    expect(frameCallbacks).toHaveLength(1);

    runFrame();

    expect(nm.commitWheelZoom).toHaveBeenCalledTimes(1);
  });

  it('commits the most recent pending state, discarding superseded ones', () => {
    nm.scheduleWheelZoomCommit({ currentChr: 'chr1', sequence: 'A', zoomDirection: -1 });
    nm.scheduleWheelZoomCommit({ currentChr: 'chr2', sequence: 'B', zoomDirection: 1 });

    runFrame();

    expect(nm.commitWheelZoom).toHaveBeenCalledTimes(1);
    expect(nm.commitWheelZoom).toHaveBeenCalledWith({ currentChr: 'chr2', sequence: 'B', zoomDirection: 1 });
  });

  it('schedules a fresh frame for wheel events that arrive after a commit', () => {
    nm.scheduleWheelZoomCommit({ currentChr: 'chr1', sequence: 'A', zoomDirection: -1 });
    runFrame();
    expect(nm.commitWheelZoom).toHaveBeenCalledTimes(1);

    nm.scheduleWheelZoomCommit({ currentChr: 'chr1', sequence: 'A', zoomDirection: 1 });
    expect(frameCallbacks).toHaveLength(1);
    runFrame();

    expect(nm.commitWheelZoom).toHaveBeenCalledTimes(2);
  });

  it('clears pending state so an empty frame cannot double-commit', () => {
    nm.scheduleWheelZoomCommit({ currentChr: 'chr1', sequence: 'A', zoomDirection: -1 });
    runFrame();
    runFrame(); // no new callbacks queued

    expect(nm.commitWheelZoom).toHaveBeenCalledTimes(1);
    expect(nm.pendingWheelZoom).toBeNull();
  });
});

describe('updateThinkingMessage append behaviour', () => {
  let cm;

  beforeEach(() => {
    document.body.innerHTML = '<div id="chatMessages"></div>';

    cm = Object.create(ChatManager.prototype);
    cm.showThinkingProcess = true;
    cm.autoScrollToBottom = false;
    cm.conversationState = { currentRequestId: 'req1' };
    cm.addToEvolutionData = () => {};

    const thinking = document.createElement('div');
    thinking.className = 'thinking-process';
    thinking.id = 'thinkingProcess_req1';
    thinking.innerHTML = '<div class="thinking-content"></div>';
    document.getElementById('chatMessages').appendChild(thinking);
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  const content = () => document.querySelector('.thinking-content');

  it('preserves previously rendered nodes by identity when appending', () => {
    cm.updateThinkingMessage('<span id="first">one</span>');
    const firstNode = document.getElementById('first');
    expect(firstNode).not.toBeNull();

    cm.updateThinkingMessage('<span id="second">two</span>');

    // The decisive check: `innerHTML +=` would have destroyed and rebuilt the
    // first span, so identity equality proves the content was not re-parsed.
    expect(document.getElementById('first')).toBe(firstNode);
    expect(document.getElementById('second')).not.toBeNull();
  });

  it('renders HTML markup rather than escaping it', () => {
    cm.updateThinkingMessage('<strong>bold</strong>');

    expect(content().querySelector('strong')).not.toBeNull();
    expect(content().textContent).toContain('bold');
  });

  it('accumulates every appended step in order', () => {
    cm.updateThinkingMessage('alpha');
    cm.updateThinkingMessage('beta');
    cm.updateThinkingMessage('gamma');

    const text = content().textContent;
    expect(text).toContain('alpha');
    expect(text).toContain('beta');
    expect(text).toContain('gamma');
    expect(text.indexOf('alpha')).toBeLessThan(text.indexOf('beta'));
    expect(text.indexOf('beta')).toBeLessThan(text.indexOf('gamma'));
  });

  it('still appends HTMLElement messages through the element path', () => {
    const el = document.createElement('div');
    el.id = 'dom-message';
    cm.updateThinkingMessage(el);

    expect(content().querySelector('#dom-message')).not.toBeNull();
  });
});

describe('DebugLogger console gate', () => {
  const DEBUG_LOGGER_PATH = path.join(process.cwd(), 'src/renderer/modules/DebugLogger.js');
  let original;

  const loadGate = () => {
    const code = fs.readFileSync(DEBUG_LOGGER_PATH, 'utf-8');
    new Function(code)();
  };

  beforeEach(() => {
    original = { log: console.log, debug: console.debug, info: console.info, warn: console.warn, error: console.error };
    try {
      localStorage.clear();
    } catch {
      /* jsdom always provides localStorage; guard is defensive */
    }
    delete window.CodeXomicsDebug;
    delete window.nodeAPI;
  });

  afterEach(() => {
    Object.assign(console, original);
    delete window.CodeXomicsDebug;
    delete window.nodeAPI;
  });

  it('silences verbose channels by default outside development', () => {
    loadGate();

    expect(window.CodeXomicsDebug.isEnabled()).toBe(false);
    // Replaced with no-ops.
    expect(console.log).not.toBe(original.log);
    expect(console.debug).not.toBe(original.debug);
    expect(console.info).not.toBe(original.info);
  });

  it('never suppresses warnings or errors', () => {
    loadGate();

    expect(console.warn).toBe(original.warn);
    expect(console.error).toBe(original.error);
  });

  it('enables verbose logging automatically in a development build', () => {
    const sink = vi.spyOn(console, 'log').mockImplementation(() => {});
    window.nodeAPI = { isDevelopment: true };
    loadGate();

    expect(window.CodeXomicsDebug.isEnabled()).toBe(true);

    sink.mockClear();
    console.log('visible');
    expect(sink).toHaveBeenCalledWith('visible');

    sink.mockRestore();
  });

  it('honours a persisted preference over the development default', () => {
    window.nodeAPI = { isDevelopment: true };
    localStorage.setItem('codexomics:debugLogging', 'false');
    loadGate();

    expect(window.CodeXomicsDebug.isEnabled()).toBe(false);
  });

  it('actually suppresses and restores delivery of verbose calls', () => {
    // Spy installed before the gate, so the gate captures the spy as its
    // "original" — this asserts real delivery rather than function identity.
    const sink = vi.spyOn(console, 'log').mockImplementation(() => {});
    loadGate();

    sink.mockClear();
    console.log('should be swallowed');
    expect(sink).not.toHaveBeenCalled();

    window.CodeXomicsDebug.enable();
    sink.mockClear();
    console.log('should get through');
    expect(sink).toHaveBeenCalledWith('should get through');
    expect(localStorage.getItem('codexomics:debugLogging')).toBe('true');

    window.CodeXomicsDebug.disable();
    sink.mockClear();
    console.log('swallowed again');
    expect(sink).not.toHaveBeenCalled();
    expect(localStorage.getItem('codexomics:debugLogging')).toBe('false');

    sink.mockRestore();
  });

  it('restores delivery of every verbose channel via restore()', () => {
    const logSink = vi.spyOn(console, 'log').mockImplementation(() => {});
    const debugSink = vi.spyOn(console, 'debug').mockImplementation(() => {});
    const infoSink = vi.spyOn(console, 'info').mockImplementation(() => {});
    loadGate();

    window.CodeXomicsDebug.restore();

    logSink.mockClear();
    debugSink.mockClear();
    infoSink.mockClear();

    console.log('a');
    console.debug('b');
    console.info('c');

    expect(logSink).toHaveBeenCalledWith('a');
    expect(debugSink).toHaveBeenCalledWith('b');
    expect(infoSink).toHaveBeenCalledWith('c');

    logSink.mockRestore();
    debugSink.mockRestore();
    infoSink.mockRestore();
  });

  it('gated console.log accepts calls without throwing', () => {
    loadGate();

    expect(() => console.log('quiet', { a: 1 })).not.toThrow();
  });
});

describe('dev-flag forwarding to renderer webPreferences', () => {
  const require = createRequire(import.meta.url);
  let originalArgv;
  let originalNodeEnv;

  const loadFresh = () => {
    const modulePath = require.resolve('../../src/main/security-utils.js');
    delete require.cache[modulePath];
    return require(modulePath).createSecureWebPreferences;
  };

  beforeEach(() => {
    originalArgv = process.argv;
    originalNodeEnv = process.env.NODE_ENV;
  });

  afterEach(() => {
    process.argv = originalArgv;
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNodeEnv;
  });

  it('forwards --codexomics-dev when the app runs with --dev', () => {
    process.argv = ['electron', '.', '--dev'];
    delete process.env.NODE_ENV;

    const prefs = loadFresh()();

    expect(prefs.additionalArguments).toContain('--codexomics-dev');
  });

  it('omits the dev flag in a normal (packaged) run', () => {
    process.argv = ['electron', '.'];
    delete process.env.NODE_ENV;

    const prefs = loadFresh()();

    expect(prefs.additionalArguments).not.toContain('--codexomics-dev');
  });

  it('preserves caller-supplied additionalArguments', () => {
    process.argv = ['electron', '.', '--dev'];

    const prefs = loadFresh()({ additionalArguments: ['--existing'] });

    expect(prefs.additionalArguments).toContain('--existing');
    expect(prefs.additionalArguments).toContain('--codexomics-dev');
  });

  it('keeps the hardened security settings intact', () => {
    process.argv = ['electron', '.', '--dev'];

    const prefs = loadFresh()();

    expect(prefs.contextIsolation).toBe(true);
    expect(prefs.nodeIntegration).toBe(false);
    expect(prefs.sandbox).toBe(true);
  });
});
