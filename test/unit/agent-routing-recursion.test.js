/* eslint-disable no-new-func */
/**
 * Unit tests for ToolExecutionService agent routing recursion guards and NavigationAgent parameter validations.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';

// Helper to load classes in a Node-compatible way
function loadClasses() {
  const agentBasePath = path.join(process.cwd(), 'src/renderer/modules/Agents/AgentBase.js');
  const agentBaseContent = fs.readFileSync(agentBasePath, 'utf-8');

  const navAgentPath = path.join(process.cwd(), 'src/renderer/modules/Agents/NavigationAgent.js');
  let navAgentContent = fs.readFileSync(navAgentPath, 'utf-8');
  // Strip node modules export pattern if any
  navAgentContent = navAgentContent.replace('module.exports = NavigationAgent;', '');

  const toolExecPath = path.join(process.cwd(), 'src/renderer/modules/chat/services/ToolExecutionService.js');
  let toolExecContent = fs.readFileSync(toolExecPath, 'utf-8');
  toolExecContent = toolExecContent.replace('window.ToolExecutionService = ToolExecutionService;', '');

  const context = {
    window: {},
    console: console,
    EventTarget: global.EventTarget || class {},
  };

  const evalAgentBase = new Function(
    'global',
    'window',
    'EventTarget',
    `${agentBaseContent}; global.AgentBase = AgentBase;`
  );
  evalAgentBase(context, context.window, context.EventTarget);

  const evalNavAgent = new Function(
    'global',
    'window',
    'AgentBase',
    `${navAgentContent}; global.NavigationAgent = NavigationAgent;`
  );
  evalNavAgent(context, context.window, context.AgentBase);

  const evalToolExec = new Function(
    'global',
    'window',
    `${toolExecContent}; global.ToolExecutionService = ToolExecutionService;`
  );
  evalToolExec(context, context.window);

  return {
    NavigationAgent: context.NavigationAgent,
    ToolExecutionService: context.ToolExecutionService,
  };
}

describe('Agent Routing & Recursion Guards', () => {
  const { NavigationAgent, ToolExecutionService } = loadClasses();

  describe('NavigationAgent toggle_track parameter validation', () => {
    let mockMAS;
    let agent;

    beforeEach(() => {
      mockMAS = {
        app: {},
        configManager: {},
        chatManager: {},
      };
      agent = new NavigationAgent(mockMAS);
    });

    it('should validate correctly with trackName and boolean visible', () => {
      const capability = agent.capabilities.find(c => c.functionName === 'toggle_track');
      expect(capability).toBeDefined();

      expect(() => capability.validateParameters({ trackName: 'genes', visible: true })).not.toThrow();
      expect(() => capability.validateParameters({ trackName: 'genes', visible: false })).not.toThrow();
    });

    it('should validate correctly with track_name and action', () => {
      const capability = agent.capabilities.find(c => c.functionName === 'toggle_track');

      expect(() => capability.validateParameters({ track_name: 'genes', action: 'show' })).not.toThrow();
      expect(() => capability.validateParameters({ track_name: 'genes', action: 'hide' })).not.toThrow();
      expect(() => capability.validateParameters({ track_name: 'genes', action: 'toggle' })).not.toThrow();
    });

    it('should throw an error for invalid parameters', () => {
      const capability = agent.capabilities.find(c => c.functionName === 'toggle_track');

      // Missing track identifiers
      expect(() => capability.validateParameters({ visible: true })).toThrow(
        'trackName or track_name parameter required'
      );

      // Invalid visible type
      expect(() => capability.validateParameters({ trackName: 'genes', visible: 'yes' })).toThrow(
        'visible parameter must be boolean'
      );

      // Invalid action value
      expect(() => capability.validateParameters({ track_name: 'genes', action: 'invalid' })).toThrow(
        'action parameter must be "show", "hide" or "toggle"'
      );
    });
  });

  describe('NavigationAgent local toggle_track execution mapping', () => {
    it('should correctly map trackName/visible and track_name/action combinations', async () => {
      let passedTrackName = null;
      let passedVisible = null;

      const mockApp = {
        genomeBrowser: {
          toggleTrack: async (trackName, visible) => {
            passedTrackName = trackName;
            passedVisible = visible;
            return { success: true };
          },
        },
      };

      const agent = new NavigationAgent({});

      // Case 1: camelCase and visible boolean
      await agent.executeToggleTrack({ trackName: 'genes', visible: true }, mockApp);
      expect(passedTrackName).toBe('genes');
      expect(passedVisible).toBe(true);

      // Case 2: snake_case and action show
      await agent.executeToggleTrack({ track_name: 'reads', action: 'show' }, mockApp);
      expect(passedTrackName).toBe('reads');
      expect(passedVisible).toBe(true);

      // Case 3: snake_case and action hide
      await agent.executeToggleTrack({ track_name: 'variants', action: 'hide' }, mockApp);
      expect(passedTrackName).toBe('variants');
      expect(passedVisible).toBe(false);

      // Case 4: snake_case and action toggle
      await agent.executeToggleTrack({ track_name: 'gc', action: 'toggle' }, mockApp);
      expect(passedTrackName).toBe('gc');
      expect(passedVisible).toBeUndefined();
    });
  });

  describe('ToolExecutionService Routing Recursion Loop Prevention', () => {
    it('should break infinite recursion when agent delegates execution back to ChatManager', async () => {
      const mockChatManager = {
        agentSystemEnabled: true,
        multiAgentSystem: {
          executeTool: async (toolName, parameters) => {
            // Simulator of agent behavior: delegates back to ChatManager.executeToolByName
            // under normal routing this would recurse infinitely
            return await mockChatManager.executeToolByName(toolName, parameters);
          },
        },
        services: {
          file: {},
          annotation: {},
          blast: {},
          protein: {},
          analysis: {},
          primer: {},
        },
        // Native fallback implementation for get_track_status
        getTrackStatus: async parameters => {
          return { success: true, tracks: ['genes', 'variants'] };
        },
        executeToolByName: async (toolName, parameters, options = {}) => {
          return await service.execute(toolName, parameters, options);
        },
      };

      const service = new ToolExecutionService({}, mockChatManager);

      // Verify that calling execute triggers fallback instead of stack overflow
      const result = await service.execute('get_track_status', {});
      expect(result).toEqual({ success: true, tracks: ['genes', 'variants'] });
      expect(service.activeAgentExecutions.size).toBe(0); // Cleaned up in finally block
    });

    it('should respect bypassAgent option directly', async () => {
      let agentCalled = false;
      const mockChatManager = {
        agentSystemEnabled: true,
        multiAgentSystem: {
          executeTool: async (toolName, parameters) => {
            agentCalled = true;
            return { success: true };
          },
        },
        services: {
          file: {},
          annotation: {},
          blast: {},
          protein: {},
          analysis: {},
          primer: {},
        },
        getTrackStatus: async parameters => {
          return { success: true, tracks: ['genes'] };
        },
      };

      const service = new ToolExecutionService({}, mockChatManager);

      const result = await service.execute('get_track_status', {}, { bypassAgent: true });
      expect(agentCalled).toBe(false); // bypassed agent routing
      expect(result).toEqual({ success: true, tracks: ['genes'] });
    });
  });
});
