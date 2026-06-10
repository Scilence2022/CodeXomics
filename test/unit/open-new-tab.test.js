/**
 * open_new_tab tool contract tests
 */
/* eslint-disable no-new-func */
import { describe, it, expect, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import yaml from 'js-yaml';

const require = createRequire(import.meta.url);
const originalGenomeBrowser = window.genomeBrowser;

function loadOpenNewTabHarness() {
  const managerPath = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');
  const content = fs.readFileSync(managerPath, 'utf-8');
  const methodStart = content.indexOf('  async openNewTab(params) {');
  const methodEnd = content.indexOf('\n  // NOTE: switchToTab', methodStart);
  const methodSource = content.substring(methodStart, methodEnd);

  return new Function(`return class OpenNewTabHarness {\n${methodSource}\n}`)();
}

function loadTabManagerClass() {
  const managerPath = path.join(process.cwd(), 'src/renderer/modules/TabManager.js');
  const content = fs.readFileSync(managerPath, 'utf-8');
  return new Function('window', `${content}; return TabManager;`)({});
}

afterEach(() => {
  window.genomeBrowser = originalGenomeBrowser;
});

describe('open_new_tab tool', () => {
  it('keeps the built-in YAML and MCP parameter schemas synchronized', () => {
    const yamlPath = path.join(process.cwd(), 'tools_registry/navigation/open_new_tab.yaml');
    const definition = yaml.load(fs.readFileSync(yamlPath, 'utf-8'));
    const NavigationTools = require('../../src/mcp-tools/navigation/NavigationTools.js');
    const mcpDefinition = new NavigationTools({}).getTools().open_new_tab;
    const expectedProperties = ['chromosome', 'clientId', 'end', 'geneName', 'position', 'start', 'title'];

    expect(Object.keys(definition.parameters.properties).sort()).toEqual(expectedProperties);
    expect(Object.keys(mcpDefinition.parameters.properties).sort()).toEqual(expectedProperties);
    expect(definition.parameters.properties).not.toHaveProperty('count');
    expect(definition.parameters.properties).not.toHaveProperty('copy_current_view');
    expect(definition.parameters.properties).not.toHaveProperty('initial_position');
  });

  it('preserves a custom title when creating a tab for the current view', async () => {
    const OpenNewTabHarness = loadOpenNewTabHarness();
    let receivedTitle = null;
    window.genomeBrowser = {
      tabManager: {
        tabStates: new Map(),
        createNewTab: title => {
          receivedTitle = title;
          return 'tab-2';
        },
      },
    };

    const result = await new OpenNewTabHarness().openNewTab({ title: 'Comparison View' });

    expect(receivedTitle).toBe('Comparison View');
    expect(result).toMatchObject({ success: true, tabId: 'tab-2', title: 'Comparison View' });
  });

  it('reports the generated tab title and rejects failed tab creation', async () => {
    const OpenNewTabHarness = loadOpenNewTabHarness();
    window.genomeBrowser = {
      tabManager: {
        tabStates: new Map([['tab-3', { title: 'U00096:1-1,000' }]]),
        createNewTab: () => 'tab-3',
      },
    };

    const result = await new OpenNewTabHarness().openNewTab({});
    expect(result.title).toBe('U00096:1-1,000');

    window.genomeBrowser.tabManager.createNewTab = () => null;
    await expect(new OpenNewTabHarness().openNewTab({})).rejects.toThrow('did not create a new tab');
  });

  it('carries the requested chromosome into position-based tab state', () => {
    const TabManager = loadTabManagerClass();
    const tabManager = Object.create(TabManager.prototype);
    let receivedPosition = null;
    tabManager.createNewTab = (title, position) => {
      receivedPosition = position;
      return 'tab-4';
    };

    const tabId = tabManager.createTabForPosition('chr2', 100, 200, 'chr2 region');

    expect(tabId).toBe('tab-4');
    expect(receivedPosition).toEqual({ chromosome: 'chr2', start: 99, end: 200 });
  });

  it('preserves a custom title for gene-focused tabs', () => {
    const TabManager = loadTabManagerClass();
    const tabManager = Object.create(TabManager.prototype);
    tabManager.genomeBrowser = { currentChromosome: 'chr1' };
    let receivedTitle = null;
    tabManager.createTabForPosition = (chromosome, start, end, title) => {
      receivedTitle = title;
      return 'tab-5';
    };

    const tabId = tabManager.createTabForGene(
      { name: 'lacZ', chromosome: 'chr1', start: 1000, end: 2000 },
      500,
      'Lactose metabolism'
    );

    expect(tabId).toBe('tab-5');
    expect(receivedTitle).toBe('Lactose metabolism');
  });
});
