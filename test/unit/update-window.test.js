import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const html = readFileSync(path.join(process.cwd(), 'src/renderer/updates.html'), 'utf8');
const source = readFileSync(path.join(process.cwd(), 'src/renderer/updates.js'), 'utf8');
let render;
let action;
let revision;
const tick = async () => {
  await Promise.resolve();
  await Promise.resolve();
};
const state = (phase, patch = {}) => ({
  phase,
  revision: ++revision,
  currentVersion: '0.722.0',
  version: '0.723.0',
  ...patch,
});

describe('Update status window', () => {
  beforeEach(async () => {
    document.body.innerHTML = html.match(/<body>([\s\S]*)<\/body>/)[1];
    revision = 0;
    action = vi.fn().mockResolvedValue(state('checking'));
    const mockWindow = {
      codeXomicsUpdater: {
        action,
        onState: callback => {
          render = callback;
          return vi.fn();
        },
      },
      addEventListener: vi.fn(),
      close: vi.fn(),
    };
    vm.runInNewContext(source, { window: mockWindow, document });
    await tick();
  });

  it('renders remote release notes as text without executable markup', () => {
    render(state('available', { releaseNotes: '<img src=x onerror="alert(1)"><script>bad()</script>' }));
    expect(document.getElementById('notes').textContent).toContain('<script>');
    expect(document.querySelector('#notes img, #notes script')).toBeNull();
    expect(document.getElementById('primary').textContent).toBe('Download Update');
  });

  it('shows progress and cancel controls, then removes them during verification', async () => {
    render(
      state('downloading', { progress: { percent: 25, transferred: 1048576, total: 4194304, bytesPerSecond: 524288 } })
    );
    expect(document.getElementById('transfer').textContent).toContain('25% · 1.0 MB / 4.0 MB · 512.0 KB/s');
    expect(document.getElementById('cancel').hidden).toBe(false);
    document.getElementById('cancel').click();
    expect(action).toHaveBeenLastCalledWith('cancel');
    render(state('verifying'));
    expect(document.getElementById('cancel').hidden).toBe(true);
    expect(document.getElementById('primary').hidden).toBe(true);
    await tick();
    expect(document.getElementById('status').textContent).toContain('Verifying');
  });

  it('ignores stale IPC replies arriving after a newer state event', () => {
    const old = state('checking');
    render(state('ready', { installOnQuit: true }));
    render(old);
    expect(document.getElementById('status').textContent).toContain('is ready');
    expect(document.getElementById('message').textContent).toContain('next quit');
  });

  it('offers actionable retries and explains installations with no in-app updater', async () => {
    render(state('error', { message: 'The release feed is unavailable.' }));
    expect(document.getElementById('primary').textContent).toBe('Try Again');
    document.getElementById('primary').click();
    expect(action).toHaveBeenLastCalledWith('check');
    render(state('unsupported', { message: 'Use your package manager.' }));
    await tick();
    expect(document.getElementById('primary').hidden).toBe(true);
    expect(document.getElementById('message').textContent).toContain('package manager');
  });

  it('surfaces rejected IPC actions instead of leaving an unhandled rejection', async () => {
    action.mockRejectedValueOnce(new Error('IPC unavailable'));
    document.getElementById('releases').click();
    await tick();
    expect(document.getElementById('actionError').hidden).toBe(false);
  });
});
