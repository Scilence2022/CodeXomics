import { describe, expect, it, vi } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const BuiltInToolsIntegration = require('../../tools_registry/builtin_tools_integration.js');
const AnnotationTools = require('../../src/mcp-tools/annotation/AnnotationTools.js');
const ToolsIntegrator = require('../../src/mcp-tools/ToolsIntegrator.js');
const ToolCapabilityPolicy = require('../../src/renderer/modules/chat/services/ToolCapabilityPolicy.js');

describe('structural annotation tool registration', () => {
  it('keeps built-in, MCP, relevance, and execution-policy registries synchronized', () => {
    const integration = new BuiltInToolsIntegration();
    const mcpTools = new AnnotationTools({}).getTools();
    const policy = new ToolCapabilityPolicy();

    expect(integration.builtInToolsMap.get('edit_annotation')).toMatchObject({
      method: 'editAnnotation',
      category: 'annotation',
      type: 'built-in',
    });
    expect(integration.builtInToolsMap.get('batch_create_annotations')).toMatchObject({
      method: 'batchCreateAnnotations',
      category: 'annotation',
      type: 'built-in',
    });
    expect(mcpTools.edit_annotation.inputSchema.required).toEqual(['annotationId', 'updates']);
    expect(mcpTools.batch_create_annotations.inputSchema.required).toEqual(['annotations']);
    expect(policy.getPolicyForTool('edit_annotation')).toMatchObject({
      name: 'annotation_structural_operations',
    });
    expect(policy.getPolicyForTool('batch_create_annotations')).toMatchObject({
      name: 'annotation_structural_operations',
    });

    expect(
      integration
        .analyzeBuiltInToolRelevance('Change the start and strand of annotation feature-1')
        .map(tool => tool.name)
    ).toContain('edit_annotation');
    expect(
      integration
        .analyzeBuiltInToolRelevance('Batch create multiple gene annotations on chromosome 1')
        .map(tool => tool.name)
    ).toContain('batch_create_annotations');
  });

  it('routes both structural tools to the renderer with the authenticated context intact', async () => {
    const executionContext = Object.freeze({
      source: 'mcp',
      authenticated: true,
      principal: 'structural-curator',
      permissions: Object.freeze(['annotation:structural']),
      isAdmin: false,
    });
    const server = {
      mode: 'tools',
      executeToolOnClient: vi.fn(async (toolName, parameters, clientId, context) => ({
        toolName,
        parameters,
        clientId,
        context,
      })),
    };
    const integrator = new ToolsIntegrator(server);
    const editArgs = { annotationId: 'feature-1', updates: { start: 10, end: 90 } };
    const batchArgs = { chromosome: 'chr1', annotations: [{ type: 'gene', start: 100, end: 180 }] };

    await expect(
      integrator.executeTool('edit_annotation', editArgs, 'client-1', executionContext)
    ).resolves.toMatchObject({
      toolName: 'edit_annotation',
      parameters: editArgs,
      clientId: 'client-1',
      context: executionContext,
    });
    await expect(
      integrator.executeTool('batch_create_annotations', batchArgs, 'client-1', executionContext)
    ).resolves.toMatchObject({
      toolName: 'batch_create_annotations',
      parameters: batchArgs,
      clientId: 'client-1',
      context: executionContext,
    });
    expect(server.executeToolOnClient).toHaveBeenCalledTimes(2);
  });
});
