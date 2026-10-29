# Software update audit — 2026-10-29

The application update path now covers detection, release information, explicit
download, progress, cancellation, verification, retry and confirmed restart.
Operational release instructions live in the canonical
[RELEASING.md](https://github.com/Scilence2022/CodeXomics/blob/main/RELEASING.md).

## Findings and changes

- Manual errors previously went only to the log, and repeated checks had no
  unified download/installation state. One dedicated status window now survives
  menu re-entry and reports actionable errors without duplicate dialogs.
- Checks now run after startup and every six hours. Background failures stay
  quiet. Unsupported installations explain their package-manager or manual
  update route instead of silently skipping or claiming to be current.
- Native Electron requests do not emit Node's socket event, which the upstream
  timeout implementation expected. A real inactivity timeout now covers both
  connection setup and stalled responses. Electron's upload-side `close` event
  must not clear that timer; actual network testing reproduced this distinction.
- On macOS, both electron-updater's download event and its promise can finish
  before Squirrel validates the signature. Readiness now waits for the native
  event as well, with a separate staging timeout and listener cleanup.
- Stable builds reject prereleases, downgrades, insecure download URLs and
  missing SHA512 metadata. Existing updater checksum and native signature checks
  remain enabled. Release notes are rendered as text. Installer actions are
  limited to the dedicated local window's main frame through sandboxed IPC.
- Windows/Linux installation requires an explicit confirmed restart; macOS
  preserves native install-on-quit staging. The confirmation reminds users to
  save work in every window. Closing the status window preserves the operation.
- Release assembly now requires platform manifests, complete architecture
  entries, valid file sizes and hashes. Signed native jobs assemble a draft only
  after all platforms pass. Windows certificate subjects must match the updater
  publisher. Missing Apple notarization credentials fail release builds.
- macOS notarization has one owner, the existing afterSign hook. Local `dist`
  now generates its DMG background before packaging a clean checkout.

## Validation

| Check                                          | Result                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------------------- |
| Node.js 22 full Vitest run with coverage       | 195 files, 2,402 tests passed; 55 updater-specific tests included                  |
| Coverage thresholds                            | Passed; statements 20.49%, branches 18.66%, functions 22.10%, lines 20.53%         |
| ESLint                                         | No errors; four existing warnings outside this change                              |
| Documentation metadata and strict MkDocs build | Passed                                                                             |
| Version consistency                            | Passed; application version remains 0.722.0                                        |
| Real Electron update window                    | Passed: sandbox/preload/IPC, untrusted notes, download progress and ready controls |
| Real Electron network requests                 | Passed: normal response, redirect and stalled-response timeout                     |
| Local macOS packaging                          | Built x64/arm64 ZIPs and DMGs without signing or publication                       |
| Actual macOS update manifest validation        | Passed: both ZIP entries, versions, sizes and SHA512 hashes                        |

The existing `npm run test:e2e` startup smoke test reads an empty window title
before navigation completes on this machine. The same failure was reproduced
from the unchanged base commit in an isolated directory. The focused real
Electron update-window checks above passed separately. Node.js 25's experimental
global web-storage implementation also breaks existing jsdom tests; validation
used the supported Node.js 22 runtime.

## Publication and remaining native QA

The public latest release inspected during this audit was `v0.522beta`, whose
assets did not include updater manifests. Existing public assets were not changed.
A new signed release containing the verified manifests and their referenced
installers is necessary before installed applications can use this update feed.

The new release workflow has not been dispatched. Apple/Windows signing and
notarization, real installation over an older signed build, elevation prompts,
and Windows/Linux native packaging still require their native release runners
and credentials. Local artifacts were unsigned validation builds and were not
published. No live update was installed during this audit.
