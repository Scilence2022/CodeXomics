import { afterEach, describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';

const require = createRequire(import.meta.url);
const PluginMarketplace = require('../../src/renderer/modules/PluginMarketplace.js');
const PluginManagerV2 = require('../../src/renderer/modules/PluginManagerV2.js');

describe('plugin marketplace install hardening', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete window.electronAPI;
  });

  it('registers marketplace visualization plugins with a trusted fallback renderer when plugin code is blocked', async () => {
    const registered = [];
    const marketplace = Object.create(PluginMarketplace.prototype);
    marketplace.pluginManager = {
      pathResolver: {
        getInstallPath: pluginId => `/tmp/codexomics-plugins/${pluginId}`,
      },
      registerPlugin: vi.fn(async (pluginId, pluginDefinition) => {
        registered.push({ pluginId, pluginDefinition });
      }),
    };

    window.electronAPI = {
      writePluginFiles: vi.fn(async () => ({
        success: false,
        error: 'plugin install path escapes user plugin directory',
      })),
    };

    const result = await marketplace.installDownloadedPlugin({
      pluginId: 'protein-interaction-network',
      data: {
        'index.js': 'module.exports = {};',
      },
      manifest: {
        id: 'protein-interaction-network',
        name: 'Protein Interaction Network Visualizer',
        description: 'Interactive protein-protein interaction network analysis and visualization',
        version: '1.8.3',
        type: 'visualization',
        supportedDataTypes: ['protein-interaction', 'ppi-network'],
      },
    });

    expect(result.success).toBe(true);
    expect(window.electronAPI.writePluginFiles).toHaveBeenCalledTimes(1);
    expect(marketplace.pluginManager.registerPlugin).toHaveBeenCalledTimes(1);
    expect(registered[0].pluginDefinition.codeExecutionBlocked).toBe(true);
    expect(registered[0].pluginDefinition.supportedDataTypes).toEqual(['protein-interaction', 'ppi-network']);
    expect(typeof registered[0].pluginDefinition.executor).toBe('function');
    expect(registered[0].pluginDefinition.renderNetwork).toBe(registered[0].pluginDefinition.executor);
    expect(registered[0].pluginDefinition.visualize).toBe(registered[0].pluginDefinition.executor);
  });

  it('resolves visualization supported data types from contribution metadata', () => {
    const marketplace = Object.create(PluginMarketplace.prototype);

    const definition = marketplace.preparePluginDefinitionForRegistration('kegg-pathway-viewer', {
      name: 'KEGG Pathway Viewer',
      description: 'Pathway visualization',
      version: '1.0.0',
      type: 'visualization',
      contributes: {
        visualizations: {
          pathway: {
            supportedDataTypes: ['metabolic-pathway', 'kegg-pathway'],
          },
        },
      },
    });

    expect(definition.supportedDataTypes).toEqual(['metabolic-pathway', 'kegg-pathway']);
    expect(typeof definition.executor).toBe('function');
  });

  it('validates visualization plugins against callable visualization methods', () => {
    const validDefinition = {
      name: 'Network Renderer',
      description: 'Renders network data',
      version: '1.0.0',
      type: 'visualization',
      supportedDataTypes: ['network'],
      renderNetwork: () => document.createElement('div'),
    };

    expect(() => PluginManagerV2.prototype.validatePluginDefinition(validDefinition)).not.toThrow();

    expect(() =>
      PluginManagerV2.prototype.validatePluginDefinition({
        ...validDefinition,
        supportedDataTypes: [],
      })
    ).toThrow(/supportedDataTypes and a callable visualization method/);

    expect(() =>
      PluginManagerV2.prototype.validatePluginDefinition({
        ...validDefinition,
        supportedDataTypes: ['network'],
        renderNetwork: undefined,
      })
    ).toThrow(/supportedDataTypes and a callable visualization method/);
  });

  it('keeps development plugin paths aligned with the security-approved plugin root', () => {
    const ipcHandlers = fs.readFileSync(path.join(process.cwd(), 'src/main/ipc-handlers.js'), 'utf8');

    expect(ipcHandlers).toContain('function resolvePluginPaths()');
    expect(ipcHandlers).toContain("path.join(__dirname, '..', 'renderer', 'modules', 'Plugins')");
    expect(ipcHandlers).not.toContain("path.join(__dirname, 'renderer', 'modules', 'Plugins')");
  });
});
