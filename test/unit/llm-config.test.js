/* eslint-disable no-new-func */
import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';

const CONFIG_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/ConfigManager.js');
const LLM_CONFIG_MANAGER_PATH = path.join(process.cwd(), 'src/renderer/modules/LLMConfigManager.js');

function loadConfigManager() {
  const code = fs.readFileSync(CONFIG_MANAGER_PATH, 'utf-8');
  // Simple injection of dummy/mock dependencies if needed, or class instantiation
  const fn = new Function(`${code}; return ConfigManager;`);
  return fn();
}

function loadLLMConfigManager() {
  const code = fs.readFileSync(LLM_CONFIG_MANAGER_PATH, 'utf-8');
  const fn = new Function(`${code}; return LLMConfigManager;`);
  return fn();
}

describe('MiniMax Provider Configuration', () => {
  let ConfigManagerClass;
  let LLMConfigManagerClass;

  beforeAll(() => {
    ConfigManagerClass = loadConfigManager();
    LLMConfigManagerClass = loadLLMConfigManager();
  });

  it('ConfigManager should include minimax and minimax_cn default configurations', () => {
    const configManager = new ConfigManagerClass();
    const defaultConfig = configManager.getDefaultConfig();

    expect(defaultConfig.llm.providers.minimax).toBeDefined();
    expect(defaultConfig.llm.providers.minimax.name).toBe('MiniMax (Global)');
    expect(defaultConfig.llm.providers.minimax.baseUrl).toBe('https://api.minimax.io/v1');
    expect(defaultConfig.llm.providers.minimax.model).toBe('MiniMax-M2.7');

    expect(defaultConfig.llm.providers.minimax_cn).toBeDefined();
    expect(defaultConfig.llm.providers.minimax_cn.name).toBe('MiniMax CN');
    expect(defaultConfig.llm.providers.minimax_cn.baseUrl).toBe('https://api.minimaxi.com/v1');
    expect(defaultConfig.llm.providers.minimax_cn.model).toBe('MiniMax-M2.7');
  });

  it('LLMConfigManager should include minimax and minimax_cn definitions', () => {
    const mockGenomeBrowser = {};
    const mockConfigManager = {
      get: () => null,
      set: () => null,
    };

    // Instantiate LLMConfigManager with mock genomeBrowser and configManager
    const llmConfigManager = new LLMConfigManagerClass(mockGenomeBrowser, mockConfigManager);

    expect(llmConfigManager.providers.minimax).toBeDefined();
    expect(llmConfigManager.providers.minimax.name).toBe('MiniMax (Global)');
    expect(llmConfigManager.providers.minimax.baseUrl).toBe('https://api.minimax.io/v1');

    expect(llmConfigManager.providers.minimax_cn).toBeDefined();
    expect(llmConfigManager.providers.minimax_cn.name).toBe('MiniMax CN');
    expect(llmConfigManager.providers.minimax_cn.baseUrl).toBe('https://api.minimaxi.com/v1');
  });

  it('LLMConfigManager should have minimax and minimax_cn modelTypes configuration', () => {
    const mockGenomeBrowser = {};
    const llmConfigManager = new LLMConfigManagerClass(mockGenomeBrowser, null);

    // Check reasoning task type
    expect(llmConfigManager.modelTypes.reasoning.preferredProviders).toContain('minimax');
    expect(llmConfigManager.modelTypes.reasoning.preferredProviders).toContain('minimax_cn');
    expect(llmConfigManager.modelTypes.reasoning.preferredModels.minimax).toBe('MiniMax-M2.7');
    expect(llmConfigManager.modelTypes.reasoning.preferredModels.minimax_cn).toBe('MiniMax-M2.7');

    // Check task type
    expect(llmConfigManager.modelTypes.task.preferredProviders).toContain('minimax');
    expect(llmConfigManager.modelTypes.task.preferredProviders).toContain('minimax_cn');
    expect(llmConfigManager.modelTypes.task.preferredModels.minimax).toBe('MiniMax-M2.7');
    expect(llmConfigManager.modelTypes.task.preferredModels.minimax_cn).toBe('MiniMax-M2.7');

    // Check code type
    expect(llmConfigManager.modelTypes.code.preferredProviders).toContain('minimax');
    expect(llmConfigManager.modelTypes.code.preferredProviders).toContain('minimax_cn');
    expect(llmConfigManager.modelTypes.code.preferredModels.minimax).toBe('MiniMax-M2.7');
    expect(llmConfigManager.modelTypes.code.preferredModels.minimax_cn).toBe('MiniMax-M2.7');
  });

  it('LLMConfigManager should have connection test methods for MiniMax', () => {
    const mockGenomeBrowser = {};
    const llmConfigManager = new LLMConfigManagerClass(mockGenomeBrowser, null);

    expect(typeof llmConfigManager.testMinimax).toBe('function');
    expect(typeof llmConfigManager.testMinimax_cn).toBe('function');
  });

  it('LLMConfigManager should have send message methods for MiniMax', () => {
    const mockGenomeBrowser = {};
    const llmConfigManager = new LLMConfigManagerClass(mockGenomeBrowser, null);

    expect(typeof llmConfigManager.sendMinimaxMessage).toBe('function');
    expect(typeof llmConfigManager.sendMinimaxMessageWithHistory).toBe('function');
    expect(typeof llmConfigManager.sendMinimax_cnMessage).toBe('function');
    expect(typeof llmConfigManager.sendMinimax_cnMessageWithHistory).toBe('function');
  });
});
