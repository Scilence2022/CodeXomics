/**
 * Dynamic tools context coordinate tests
 */
/* eslint-disable no-new-func */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

function extractMethod(content, methodName) {
  const start = content.indexOf(`  ${methodName}(`);
  expect(start, `${methodName} method should be extractable`).toBeGreaterThanOrEqual(0);

  const braceStart = content.indexOf('{', start);
  let depth = 0;
  for (let index = braceStart; index < content.length; index++) {
    if (content[index] === '{') depth++;
    if (content[index] === '}') depth--;
    if (depth === 0) {
      return content.slice(start, index + 1);
    }
  }

  throw new Error(`${methodName} method body was not closed`);
}

function createChatManagerHarness() {
  const managerPath = path.join(process.cwd(), 'src/renderer/modules/ChatManager.js');
  const content = fs.readFileSync(managerPath, 'utf-8');
  const getCurrentContextForDynamicTools = extractMethod(content, 'getCurrentContextForDynamicTools');
  const toExternalGenomePosition = extractMethod(content, 'toExternalGenomePosition');

  const Harness = new Function(
    `return class ChatManagerHarness {${getCurrentContextForDynamicTools}${toExternalGenomePosition}\n}`
  )();

  const manager = new Harness();
  manager.agentSystemEnabled = false;
  manager.getCurrentCategory = () => 'sequence';
  manager.llmConfigManager = {
    getProviderForModelType: () => null,
    providers: {},
  };
  manager.getCurrentContext = () => ({
    genomeBrowser: {
      currentState: {
        currentChromosome: 'U00096',
        currentPosition: { start: 0, end: 10000 },
        viewingRegion: { chromosome: 'U00096', start: 0, end: 10000, length: 10001 },
        visibleTracks: ['genes', 'gc'],
        loadedFiles: [{ name: 'genome.gb' }],
        sequenceLength: 0,
        annotationsCount: 0,
        userDefinedFeaturesCount: 0,
      },
    },
  });

  return manager;
}

describe('dynamic tools current position context', () => {
  it('exposes browser currentPosition as 1-based inclusive coordinates', () => {
    const manager = createChatManagerHarness();

    const context = manager.getCurrentContextForDynamicTools();

    expect(context.genomeBrowser.currentPosition).toEqual({ start: 1, end: 10000 });
    expect(context.currentPosition).toEqual({ start: 1, end: 10000 });
    expect(context.loadedGenome.currentPosition).toEqual({ start: 1, end: 10000 });
    expect(context.loadedGenome.viewingRegion).toMatchObject({ start: 1, end: 10000, length: 10000 });
  });
});
