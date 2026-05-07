# ADR-001: Tool Base Framework & Theme Integration

**Status**: Proposed
**Date**: 2026-05-07
**Authors**: Architecture Review

---

## Context

### Problem 1: Circos Plotter ignores UI Style system

The Circos Genome Plotter (`src/circos-plotter.js`) operates in a separate BrowserWindow with:
- **8 internal themes** (scientific, nature, ocean, sunset, arctic, cosmic, forest, monochrome) — completely independent of ThemeManager
- **No CSS custom properties** — all styling is JS object-based, applied programmatically
- **No `uiStyleChanged` event listener** — when the user switches UI style in the main window, Circos is unaffected
- **Hardcoded colors in MultiTrackGeneManager** — gene track colors (`#3b82f6`, `#10b981`, etc.) don't respond to ANY theme (neither Circos internal nor ThemeManager)
- **No IPC bridge for theme sync** — the main window broadcasts theme to Project Manager but not to Circos

This creates a disjointed user experience: switching from "Midnight" to "Professional" in the main window leaves the Circos window in whatever its own theme was.

### Problem 2: Deep architectural fragmentation

Across the entire CodeXomics tool ecosystem, there are **5 independent tool silos** with no shared base:

| Silo | Count | Shared Base | Duplicated Code |
|------|-------|-------------|-----------------|
| Canvas Renderers | 3 classes | None | ~7 properties, ~4 methods |
| MCP Tool Modules | 13 modules | None | Identical interface, no enforcement |
| YAML Registry | 155 defs | Schema only | Schema drifts from MCP definitions |
| AgentBase hierarchy | 7 agents | AgentBase | Only working hierarchy |
| Circos Plotter | 1 standalone | None | Own theme system, own lifecycle |

**Concrete duplication examples:**
- `setupCanvas()` logic (devicePixelRatio, canvas sizing, transform) is **byte-for-byte identical** across CanvasGenesRenderer, CanvasSequenceRenderer, CanvasReadsRenderer
- `baseColors` map (A/T/G/C/N colors) is **duplicated** in CanvasSequenceRenderer and CanvasReadsRenderer
- `executeClientTool()` method is **identical** across all 13 MCP modules
- Canvas CSS template (`position: absolute; top: 0; left: 0; ...`) is **duplicated** across all renderers

**What we already have that works:**
- `AgentBase` — proves the inheritance pattern works in this codebase (7 subclasses)
- `BenchmarkEvaluatorBase` — proves domain-specific base classes work (4 subclasses)
- `Disposable` system — proves VS Code-style composition patterns work
- `ThemeManager` — proves centralized style propagation works (CSS vars + events + IPC)

---

## Decision

### Part A: Circos Theme Integration (Immediate)

**Circos must respond to the app's UI Style system**, not replace it. The solution is a **bridge pattern**, not a merge:

1. **Add IPC theme bridge** — main window sends `broadcast-theme-to-circos` when `uiStyleChanged` fires, just like it already does for the Project Manager window
2. **Add `CircosThemeBridge`** — a thin adapter in the Circos window that:
   - Listens for `broadcast-theme-to-circos` IPC messages
   - Maps ThemeManager presets to Circos theme selections (e.g., `midnight` → `cosmic`, `professional` → `scientific`, `default` → `nature`)
   - Allows Circos to have its own scientific sub-themes WITHIN a UI style family
3. **Derive Circos colors from CSS variables** — when the bridge detects a style change, it extracts `--primary-color`, `--bg-primary`, `--text-primary` etc. from the computed style and injects them into the Circos theme object
4. **Keep Circos domain themes as sub-presets** — the 8 scientific themes (ocean, forest, etc.) become sub-selections WITHIN each UI style, not replacements for it

**This is a bridge, not a replacement.** The Circos domain-specific themes serve a legitimate scientific purpose (publication-ready color schemes). They should coexist with the app-wide style system, not override it.

### Part B: Tool Base Framework (Strategic)

**Establish a 3-layer inheritance hierarchy** for all tools:

```
ToolBase (foundation)
├── VisualizationToolBase
│   ├── CanvasGenesRenderer
│   ├── CanvasSequenceRenderer
│   ├── CanvasReadsRenderer
│   └── CircosPlotter
├── McpToolModuleBase
│   ├── NavigationTools
│   ├── ProteinTools
│   └── ... (13 total)
└── (future domain layers as needed)
```

#### Layer 1: ToolBase (foundation)

Every tool in the system inherits from `ToolBase`, which provides:

```javascript
class ToolBase {
  // --- Lifecycle ---
  #state = 'uninitialized';  // init → ready → active → disposing → disposed
  #stateTransitions = {
    uninitialized: ['init'],
    init: ['ready', 'error'],
    ready: ['active', 'disposing'],
    active: ['ready', 'disposing'],
    disposing: ['disposed'],
    disposed: [],
  };

  async initialize() { ... }      // Template method: calls performInitialization()
  async dispose() { ... }          // Template method: calls performDisposal()

  // --- Theme Awareness ---
  #themeUnsubscribe = null;

  connectThemeManager(themeManager) {
    this.#themeUnsubscribe = themeManager.onStyleChanged((event) => {
      this.onStyleChanged(event);
    });
  }

  onStyleChanged({ style, preset, isDark }) {
    // Default: no-op. Subclasses override.
  }

  getThemeColors() {
    // Extracts CSS custom properties from :root
    const style = getComputedStyle(document.documentElement);
    return {
      primary: style.getPropertyValue('--primary-color'),
      bgPrimary: style.getPropertyValue('--bg-primary'),
      textPrimary: style.getPropertyValue('--text-primary'),
      // ... standard palette
    };
  }

  // --- Event Bus (local) ---
  #listeners = new Map();
  on(event, handler) { ... }
  off(event, handler) { ... }
  emit(event, data) { ... }

  // --- Performance ---
  #perfMetrics = { renderCount: 0, lastRenderTime: 0 };
  trackPerformance(fn) { ... }
}
```

**Key design decisions:**
- Uses **private fields** (`#state`) to enforce lifecycle invariants — subclasses cannot bypass state transitions
- **Template method pattern** — `initialize()` calls abstract `performInitialization()` that subclasses must implement
- **Theme subscription is opt-in but automatic** — `connectThemeManager()` wires up the listener; the base class handles unsubscription on dispose
- **No inheritance from Disposable** — instead, composes with it. This avoids the fragile-base-class problem

#### Layer 2: Domain-specific bases

**VisualizationToolBase** extracts the ~300 lines of shared Canvas/SVG boilerplate:

```javascript
class VisualizationToolBase extends ToolBase {
  // Shared properties (currently duplicated 3x)
  canvas = null;
  ctx = null;
  devicePixelRatio = window.devicePixelRatio || 1;
  canvasWidth = 0;
  canvasHeight = 0;
  renderingMode = 'canvas';  // 'canvas' | 'svg'

  // Shared lifecycle (currently duplicated 3x)
  setupCanvas() { ... }            // devicePixelRatio handling, sizing, transform
  setupResizeObserver() { ... }    // ResizeObserver + fallback
  destroy() { ... }               // cancel rAF, disconnect observer, remove listeners

  // Theme integration
  onStyleChanged({ style, preset, isDark }) {
    this.currentThemeColors = this.getThemeColors();
    this.redraw();
  }

  // Export (shared pattern)
  exportPNG() { ... }
  exportSVG() { ... }

  // Abstract methods for subclasses
  renderContent() { throw new Error('Must implement renderContent()'); }
}
```

**McpToolModuleBase** extracts the shared MCP module pattern:

```javascript
class McpToolModuleBase extends ToolBase {
  constructor(server) {
    super();
    this.server = server;
  }

  getTools() {
    throw new Error('Must implement getTools()');
  }

  async executeClientTool(toolName, parameters, clientId) {
    return await this.server.executeToolOnClient(toolName, parameters, clientId);
  }

  // Schema validation — currently missing, causes YAML drift
  validateToolSchema(toolDef, yamlSchema) { ... }
}
```

#### Layer 3: Concrete tools

Each concrete tool only implements its **domain-specific logic**:

```javascript
class CanvasGenesRenderer extends VisualizationToolBase {
  // Only gene-specific state
  geneRows = null;
  operons = null;
  gradientCache = new Map();

  renderContent() {
    // Gene-specific rendering only
  }

  onStyleChanged(event) {
    // Override: derive gene colors from theme
    this.geneColors = {
      protein_coding: this.getThemeColors().primary,
      // ...
    };
  }
}
```

---

## Consequences

### What becomes easier

| Before | After |
|--------|-------|
| Adding theme support to a new renderer = 100+ lines of event wiring | `extends VisualizationToolBase` → theme support is automatic |
| Creating a new MCP module = copy-paste + miss `executeClientTool` | `extends McpToolModuleBase` → interface enforced |
| Fixing a canvas setup bug = change in 3 files | Change in 1 file (VisualizationToolBase) |
| Circos ignores UI style switch entirely | Circos responds via IPC bridge + theme bridge |
| YAML schema drifts from MCP definitions silently | McpToolModuleBase validates schema at registration |

### What becomes harder

| Risk | Mitigation |
|------|-----------|
| Deep inheritance hierarchies are fragile | **Hard limit: 3 layers.** No ToolBase → VisualizationToolBase → SpecializedBase → Concrete. If you need a 4th layer, you need the wrong abstraction. |
| Breaking changes in ToolBase cascade everywhere | Use **template methods** not hook callbacks. Base class controls flow; subclasses fill in blanks. Never change the signature of a template method. |
| Private fields (`#state`) prevent monkey-patching in tests | Provide `getState()` accessor. Tests can read state but not mutate it directly. |
| Migration cost: refactoring 17+ existing classes | **Incremental adoption**: new tools extend base classes immediately; existing tools migrate one at a time. No big-bang rewrite. |
| Circos in separate BrowserWindow — CSS variables don't propagate across windows | Use IPC bridge (already proven pattern for Project Manager). Theme bridge extracts CSS vars on main side, sends color values via IPC. |

### What we're giving up

1. **Circos's complete visual independence** — Currently Circos can look totally different from the main app. After the bridge, it will **coordinate** with the app style while keeping domain-specific sub-themes. This is a deliberate reduction of autonomy for consistency.

2. **Zero-cost addition of new tools** — Currently you just write a class. With the framework, you must decide which base to extend, implement required methods, and follow the lifecycle. This is **a feature, not a bug** — the discipline prevents the current chaos.

3. **Flexibility to restructure internals** — Once 17+ classes inherit from ToolBase, changing ToolBase's interface becomes a major migration. This is mitigated by: (a) keeping ToolBase minimal (~80 lines), (b) using template methods with stable signatures, (c) favoring composition over inheritance for cross-cutting concerns.

---

## Alternatives Considered

### A. Composition-only (no inheritance)

Use mixins/traits instead of base classes:
```javascript
class CanvasGenesRenderer {
  // Mix in lifecycle
  lifecycle = new ToolLifecycleMixin();
  // Mix in theme
  theme = new ThemeAwareMixin();
  // Mix in canvas
  canvas = new CanvasRenderingMixin();
}
```

**Verdict: Rejected.** JavaScript lacks native mixin support. The community patterns (Object.assign, class mixins with symbol-keyed methods) are fragile, hard to debug, and provide no IDE support. The existing AgentBase hierarchy proves inheritance works well in this codebase. Composition is good for **cross-cutting concerns** (Disposable, EventMixin), but inheritance is better for **domain hierarchies** (VisualizationToolBase).

### B. Event-driven microkernel

Make everything a plugin that registers with a central kernel:
```javascript
kernel.register('canvas-gene-renderer', {
  type: 'visualization',
  dependencies: ['canvas'],
  onActivate(ctx) { ... },
  onStyleChange(ctx) { ... },
});
```

**Verdict: Rejected.** This is the Eclipse/VS Code extension model, which CodeXomics already has (ExtensionService/ExtensionHost). Adding a second plugin system would create confusion. The base class approach is simpler and doesn't require a central registry.

### C. Status quo (no framework)

Continue with independent classes and copy-paste patterns. When a bug is found, fix it in all copies.

**Verdict: Rejected.** The duplication is already at 3+ renderers and 13 MCP modules. Each new visualization tool (Circos was added recently; more will follow) will increase the maintenance burden linearly. The total cost of the framework (~300 lines of base classes) is less than the current duplication (~600 lines across renderers alone).

---

## Implementation Roadmap

### Phase 1: Circos Theme Bridge (1-2 days)
1. Add `broadcast-theme-to-circos` IPC handler in `main.js`
2. Create `CircosThemeBridge` class in `src/circos-plotter.html`
3. Map ThemeManager presets to Circos theme selections
4. Derive Circos secondary colors from CSS variable values
5. Test: switch UI style → Circos updates within 1 second

### Phase 2: ToolBase Foundation (2-3 days)
1. Create `src/renderer/modules/core/ToolBase.js`
2. Implement lifecycle state machine, theme subscription, event bus
3. Write tests for ToolBase in isolation
4. No existing classes changed yet

### Phase 3: VisualizationToolBase (3-5 days)
1. Extract shared Canvas boilerplate into VisualizationToolBase
2. Migrate CanvasSequenceRenderer (simplest renderer) first
3. Migrate CanvasReadsRenderer
4. Migrate CanvasGenesRenderer (most complex)
5. Migrate CircosPlotter (requires dual-render support)

### Phase 4: McpToolModuleBase (2-3 days)
1. Create McpToolModuleBase
2. Migrate all 13 MCP tool modules
3. Add schema validation hook
4. Update ToolsIntegrator to verify all modules extend base

### Phase 5: Integration & Cleanup (1-2 days)
1. Remove duplicated code from migrated classes
2. Update AGENTS.md with new tool authoring guide
3. Add base class references to existing tool documentation

---

## Success Criteria

1. **Theme propagation**: Switching UI style in settings updates Circos within 1 second
2. **Zero duplication**: Canvas setup code appears in exactly 1 file (VisualizationToolBase)
3. **New tool velocity**: Adding a new Canvas renderer requires < 50 lines of boilerplate (vs ~150 today)
4. **Schema consistency**: MCP tool definitions and YAML registry have automated consistency check
5. **Lifecycle safety**: No tool can enter an invalid lifecycle state (enforced by ToolBase state machine)
