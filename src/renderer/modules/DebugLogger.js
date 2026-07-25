/**
 * DebugLogger — renderer-side verbose-logging gate.
 *
 * The renderer carries roughly 4,000 `console.log`/`debug`/`info` calls, many of
 * them inside per-frame render loops, per-read draw loops, and per-round LLM
 * paths. In Electron every one of those marshals its arguments to the DevTools
 * protocol even when DevTools is closed, so they cost real time on exactly the
 * paths that need to stay smooth.
 *
 * Rather than delete thousands of call sites (losing the diagnostics), this
 * replaces the three verbose console methods with no-ops unless debug logging is
 * enabled. `warn`, `error`, and `assert` are always left intact — they carry
 * information users and bug reports depend on.
 *
 * Resolution order (first match wins):
 *   1. localStorage 'codexomics:debugLogging' — explicit user override
 *   2. a `?debug=1` query parameter on the page URL
 *   3. whether the app is running in development (`--dev` / NODE_ENV)
 *   4. otherwise: off
 *
 * Toggle at runtime from DevTools without restarting:
 *   CodeXomicsDebug.enable()   // persists, takes effect immediately
 *   CodeXomicsDebug.disable()
 *   CodeXomicsDebug.status()
 *
 * This module must load before any other renderer script so that verbose logging
 * emitted during module construction is gated too.
 */
(function installDebugLoggingGate() {
  const STORAGE_KEY = 'codexomics:debugLogging';
  // Verbose channels only. warn/error/assert are never suppressed.
  const GATED_METHODS = ['log', 'debug', 'info'];

  const original = {};
  for (const method of GATED_METHODS) {
    original[method] = console[method]?.bind(console) || function noop() {};
  }

  const noop = function noop() {};

  const readStoredPreference = () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored === 'true') return true;
      if (stored === 'false') return false;
    } catch {
      // localStorage can be unavailable (file:// with storage disabled); fall through.
    }
    return null;
  };

  const hasDebugQueryParam = () => {
    try {
      return new URLSearchParams(window.location.search).get('debug') === '1';
    } catch {
      return false;
    }
  };

  const isDevelopmentBuild = () => {
    try {
      return window.nodeAPI?.isDevelopment === true;
    } catch {
      return false;
    }
  };

  const resolveInitialState = () => {
    const stored = readStoredPreference();
    if (stored !== null) return stored;
    if (hasDebugQueryParam()) return true;
    return isDevelopmentBuild();
  };

  let enabled = null;

  const apply = value => {
    if (enabled === value) return;
    enabled = value;
    for (const method of GATED_METHODS) {
      console[method] = value ? original[method] : noop;
    }
  };

  apply(resolveInitialState());

  const persist = value => {
    try {
      localStorage.setItem(STORAGE_KEY, String(value));
    } catch {
      // Preference is best-effort; the in-memory state still applies.
    }
  };

  window.CodeXomicsDebug = {
    enable() {
      apply(true);
      persist(true);
      // Uses the captured original so the confirmation always prints.
      original.log('[CodeXomics] Verbose console logging ENABLED.');
      return true;
    },
    disable() {
      persist(false);
      original.log('[CodeXomics] Verbose console logging DISABLED (warnings and errors still show).');
      apply(false);
      return false;
    },
    isEnabled() {
      return enabled;
    },
    status() {
      original.log(
        `[CodeXomics] Verbose console logging is ${enabled ? 'ENABLED' : 'DISABLED'}. ` +
          'Use CodeXomicsDebug.enable() / .disable() to change it.'
      );
      return enabled;
    },
    /** Restores the native console methods entirely (used by tests/tooling). */
    restore() {
      for (const method of GATED_METHODS) {
        console[method] = original[method];
      }
      enabled = true;
    },
  };

  if (!enabled) {
    // Emitted through the original method so there is always one breadcrumb
    // explaining why the console is quiet.
    original.log(
      '[CodeXomics] Verbose console logging is disabled for performance. ' +
        'Run CodeXomicsDebug.enable() to turn it on.'
    );
  }
})();
