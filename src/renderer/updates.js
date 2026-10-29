'use strict';

(() => {
  const bridge = window.codeXomicsUpdater;
  const element = id => document.getElementById(id);
  let primaryAction = null;
  let revision = -1;

  function bytes(value) {
    if (!Number.isFinite(value) || value <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const index = Math.min(3, Math.floor(Math.log(value) / Math.log(1024)));
    return `${(value / Math.pow(1024, index)).toFixed(index ? 1 : 0)} ${units[index]}`;
  }

  function render(state) {
    if (state.revision < revision) return;
    revision = state.revision;
    const titles = {
      idle: 'Ready to check for updates',
      checking: 'Checking for updates…',
      current: 'You’re up to date',
      available: `Version ${state.version} is available`,
      downloading: `Downloading ${state.version}…`,
      cancelling: 'Cancelling download…',
      verifying: 'Verifying and preparing the update…',
      ready: `Version ${state.version} is ready`,
      installing: 'Preparing to restart…',
      error: 'Update could not be completed',
      unsupported: 'Updates for this installation',
    };
    element('version').textContent = `Installed version ${state.currentVersion}`;
    element('status').textContent = titles[state.phase] || 'CodeXomics Updates';
    let message = state.message;
    if (!message && state.phase === 'available') {
      message = 'Download the update when you’re ready. You can continue working while it downloads.';
    }
    if (!message && state.phase === 'current') {
      message = 'No newer compatible release is available for this installation.';
    }
    if (!message && state.phase === 'ready') {
      message = state.installOnQuit
        ? 'Save your work before restarting. This update will also apply when you next quit CodeXomics.'
        : 'Save your work before restarting. Choose Restart and Install to apply the update, or close this window to continue working.';
    }
    if (!message && state.phase === 'verifying') {
      message = 'Please wait while the downloaded package is checked. Keep CodeXomics open.';
    }
    element('message').textContent = message || '';
    const downloading = state.phase === 'downloading';
    element('downloadProgress').hidden = !downloading;
    element('cancel').hidden = !downloading;
    if (state.progress) {
      element('progress').value = state.progress.percent;
      element('transfer').textContent =
        `${state.progress.percent.toFixed(0)}% · ${bytes(state.progress.transferred)} / ${bytes(state.progress.total)} · ${bytes(state.progress.bytesPerSecond)}/s`;
    } else {
      element('progress').removeAttribute('value');
      element('transfer').textContent = 'Preparing download…';
    }
    // Release notes are untrusted remote text. Never interpret them as HTML.
    element('notes').textContent = state.releaseNotes || '';
    element('notesSection').hidden = !state.releaseNotes;
    element('checked').textContent = state.lastChecked
      ? `Last checked ${new Date(state.lastChecked).toLocaleString()}`
      : '';
    primaryAction = ['idle', 'current', 'error'].includes(state.phase)
      ? 'check'
      : state.phase === 'available'
        ? 'download'
        : state.phase === 'ready'
          ? 'install'
          : null;
    element('primary').hidden = !primaryAction;
    element('primary').textContent =
      primaryAction === 'download'
        ? 'Download Update'
        : primaryAction === 'install'
          ? 'Restart and Install'
          : state.phase === 'error'
            ? 'Try Again'
            : 'Check for Updates';
  }

  async function act(action) {
    if (!action) return;
    element('actionError').hidden = true;
    try {
      render(await bridge.action(action));
    } catch (error) {
      element('actionError').textContent =
        'This action could not be completed. Close this window and open Help → Check for Updates to try again.';
      element('actionError').hidden = false;
    }
  }

  element('primary').addEventListener('click', () => act(primaryAction));
  element('cancel').addEventListener('click', () => act('cancel'));
  element('releases').addEventListener('click', () => act('releases'));
  element('close').addEventListener('click', () => window.close());
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') window.close();
  });
  const unsubscribe = bridge.onState(render);
  window.addEventListener('unload', unsubscribe, { once: true });
  void act('state');
})();
