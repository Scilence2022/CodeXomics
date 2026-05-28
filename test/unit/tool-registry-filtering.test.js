import { describe, it, expect, beforeAll } from 'vitest';
import ToolsRegistryManager from '../../tools_registry/registry_manager';
import SystemIntegration from '../../tools_registry/system_integration';

describe('Tools Registry - Coordination Tools Filtering', () => {
  let registryManager;
  let systemIntegration;

  beforeAll(async () => {
    registryManager = new ToolsRegistryManager();
    systemIntegration = new SystemIntegration();
    await registryManager.initializeRegistry();
    await systemIntegration.initialize();
  });

  it('should exclude coordination tools from getCandidateTools when agentSystemEnabled is false', async () => {
    const intent = {
      primary: 'navigation',
      all: [{ intent: 'navigation', confidence: 0.8 }],
      query: 'coordinate tasks and run workflows',
    };
    
    // Default context has agentSystemEnabled undefined/false
    const candidatesDefault = await registryManager.getCandidateTools(intent, {});
    const coordinationToolsDefault = candidatesDefault.filter(t => t.category === 'coordination');
    expect(coordinationToolsDefault.length).toBe(0);

    const candidatesDisabled = await registryManager.getCandidateTools(intent, { agentSystemEnabled: false });
    const coordinationToolsDisabled = candidatesDisabled.filter(t => t.category === 'coordination');
    expect(coordinationToolsDisabled.length).toBe(0);
  });

  it('should include coordination tools from getCandidateTools when agentSystemEnabled is true', async () => {
    const intent = {
      primary: 'navigation',
      all: [{ intent: 'navigation', confidence: 0.8 }],
      query: 'coordinate tasks and run workflows',
    };
    
    const candidatesEnabled = await registryManager.getCandidateTools(intent, { agentSystemEnabled: true });
    // It should include at least coordinate_task or other coordination tools if the query matches
    const coordinationToolsEnabled = candidatesEnabled.filter(t => t.category === 'coordination');
    expect(coordinationToolsEnabled.length).toBeGreaterThan(0);
  });

  it('should exclude coordination tools from generateNonDynamicSystemPrompt when agentSystemEnabled is false', async () => {
    const promptData = await systemIntegration.generateNonDynamicSystemPrompt({ agentSystemEnabled: false });
    const hasCoordination = promptData.systemPrompt.includes('Multi-Agent Coordination') || 
                            promptData.systemPrompt.includes('coordinate_task');
    expect(hasCoordination).toBe(false);
  });

  it('should include coordination tools in generateNonDynamicSystemPrompt when agentSystemEnabled is true', async () => {
    const promptData = await systemIntegration.generateNonDynamicSystemPrompt({ agentSystemEnabled: true });
    const hasCoordination = promptData.systemPrompt.includes('Multi-Agent Coordination') || 
                            promptData.systemPrompt.includes('coordinate_task');
    expect(hasCoordination).toBe(true);
  });
});
