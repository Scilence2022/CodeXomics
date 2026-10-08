# Code quality remediation — 2026-10-08

Branch: `codex/quality-audit-remediation`. Original findings and historical probes are preserved in `CODE_QUALITY_AUDIT_2026-10-08.md`; probes assert the pre-fix defects and are not acceptance tests.

Each row is implemented, tested, and committed separately. Tests run using the installed Vitest with Node 25 Web Storage disabled until the supported Node runtime is available.

| Finding | Resolution | Validation |
| --- | --- | --- |
| A01 | Delegate MCP BLAST to the selected genome client; remove simulated server results. | 41 tests passed; targeted ESLint passed. |
| A02 | Require actual aligned sequences; reject incomplete BLAST output and remove synthetic alignment fallbacks. | 64 tests passed; targeted ESLint passed. |
| A03 | Inspect real JSON/ZIP packages, bind validation and writes to SHA-256, scan real source/permissions, and remove random code and fake vulnerability data. | 54 tests passed under Node 22.23.3; targeted ESLint passed. |
| A04 | Reject plans containing any rejected plugin or validation error; preserve zero source risk for trusted packages. | 12 tests passed under Node 22; targeted ESLint passed. |
| A05 | Resolve only available packages; fail incompatible plans; share semver across plugin version paths. | Version integrity and marketplace regressions; docs validation. |
| A06 | Load shared sequence modules and route MCP and renderer IUPAC complements and translation through them. | 26 IUPAC, translation, GC and coordinate regression tests passed. |
| A07 | Export genomic download window factory, load shipped HTML and remove duplicate generated HTML. | 20 menu window, window management and project IPC tests passed. |
| A08 | Read BLAST queries only from the genome provider; surface missing data and provider errors. | 13 query and alignment integrity tests passed. |
| A09 | Read real loaded-resource snapshots through request-bound IPC; disable unsupported mutations/exports/views and remove UI sample fallbacks. | Resource snapshot behavior and IPC/preload contract tests. |
| A10 | Validate 195 live policy names from ToolCapabilityPolicy; explicitly inventory 28 existing external/compatibility exceptions instead of accepting an empty scan. | Registry consistency command and boundary regression tests passed. |
| A11 | Remove six obsolete duplicate loading schemas, retain built-in file_loading definitions, regenerate manifest and enforce uniqueness. | Registry schemas, service, packaged manifest and consistency checks passed. |
| A12 | Remove unregistered PluginIntegrationService copy; retain the active ChatManager plugin lifecycle. | 10 marketplace installation and package validation tests passed; no loader or callers reference the removed service. |
| A13 | Remove unreachable BLAST fabrication graph and duplicate GenBank generator; preserve live database metadata and compatibility exporter wrappers. | BLAST output, main-process FASTA writing and action execution regressions passed. |
