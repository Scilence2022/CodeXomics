# Security Policy

## Supported Versions

CodeXomics is currently in active beta. Security fixes are applied to the latest
released version only.

| Version | Supported          |
| ------- | ------------------ |
| 0.722.x | :white_check_mark: |
| < 0.722 | :x:                |

## Reporting a Vulnerability

Please report security vulnerabilities **privately** — do not open a public issue
for an unpatched vulnerability.

- Preferred: open a [GitHub private security advisory](https://github.com/Scilence2022/CodeXomics/security/advisories/new).
- Alternatively, email **songlf@tib.cas.cn** with the subject line
  `[CodeXomics Security]`.

Please include:

- A description of the vulnerability and its impact.
- Steps to reproduce (a proof of concept where possible).
- The affected version / commit.

We aim to acknowledge reports within **5 business days** and to provide a
remediation timeline after triage. Please give us a reasonable opportunity to
release a fix before any public disclosure.

## Security Posture

CodeXomics is an Electron desktop application. The current hardening baseline:

- **Renderer isolation:** `contextIsolation: true`, `sandbox: true`,
  `nodeIntegration: false`, `enableRemoteModule: false`, `webSecurity: true`,
  `allowRunningInsecureContent: false` enforced centrally in
  `src/main/security-utils.js`.
- **Content Security Policy:** applied to all renderer responses with
  `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`,
  `form-action 'self'`, no `unsafe-eval`, and an explicit CDN allowlist for
  scripts/styles/fonts (see `RENDERER_CONTENT_SECURITY_POLICY`).
- **Filesystem access:** capability-based `PermissionBroker` plus path-traversal
  guards (`assertInsideRoot`, `assertSafeArchiveEntry`) for file and plugin
  operations.
- **External processes:** BLAST and related tools are launched via `execFile`
  with an executable allowlist — never through a shell.
- **Secrets at rest:** LLM API keys are encrypted with the OS keychain via
  Electron `safeStorage` before being written to disk (`src/main/secret-store.js`).
- **Dependencies:** production dependencies are kept free of known advisories
  (`npm audit --omit=dev`); CI fails on lint, test, and version drift.

## Known Hardening Follow-ups

These are tracked items intended for a future hardening pass. They require manual
GUI/notarization QA that is not yet automated:

1. **Remove `script-src 'unsafe-inline'`** by migrating the remaining inline
   `<script>` blocks and inline event handlers in the renderer and standalone
   tool HTML to external files or per-load nonces.
2. **Vendor CDN libraries locally** (font-awesome, d3, NGL, etc.) and add
   Subresource Integrity, so the app does not depend on third-party CDNs at
   runtime. This would let the CDN hosts be dropped from the CSP entirely.
3. **Migrate the DeepGeneResearch default endpoint to HTTPS.** It currently
   defaults to a plain-HTTP host, which forces `connect-src` to permit `http:`.
4. **Minimize macOS entitlements.** After confirming the notarized app launches
   correctly, evaluate removing `com.apple.security.cs.allow-unsigned-executable-memory`
   and `com.apple.security.cs.disable-library-validation`.
   (`com.apple.security.cs.debugger` has already been removed.)
5. **Audit the full preload IPC surface** (~137 channels) for input validation
   on every handler.
