import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createRequire } from 'module';
import fs from 'fs';
import yaml from 'js-yaml';
const require = createRequire(import.meta.url);
const Evo2UI = require('../../src/renderer/modules/Evo2UI');
const Evo2Service = require('../../src/renderer/modules/chat/services/Evo2Service');
const ToolsIntegrator = require('../../src/mcp-tools/ToolsIntegrator');
const ToolCapabilityPolicy = require('../../src/renderer/modules/chat/services/ToolCapabilityPolicy');
const ToolExecutionPolicy = require('../../src/renderer/modules/chat/services/ToolExecutionPolicy');
const BuiltInToolsIntegration = require('../../tools_registry/builtin_tools_integration');

describe('Evo 2 integration', () => {
  it('keeps MCP and built-in schemas identical and routes through the target client', async () => {
    const server = { mode: 'tools', executeToolOnClient: vi.fn().mockResolvedValue({ success: true, job_id: 'job' }) };
    const integrator = new ToolsIntegrator(server);
    for (const name of ['evo2_generate', 'evo2_get_result', 'evo2_cancel']) {
      const definition = yaml.load(fs.readFileSync(`tools_registry/external_apis/${name}.yaml`, 'utf8'));
      expect(integrator.getToolByName(name).inputSchema).toEqual(definition.parameters);
      const params = name === 'evo2_generate' ? { sequence: 'ACTG' } : { job_id: 'job' };
      await integrator.executeTool(name, params, 'client-1');
      expect(server.executeToolOnClient).toHaveBeenLastCalledWith(name, params, 'client-1');
    }
    server.mode = 'agent';
    expect(
      integrator
        .getAvailableTools()
        .map(tool => tool.name)
        .sort()
    ).toEqual(['codexomics_chat', 'list_genome_windows', 'switch_active_window']);
  });
  it('discovers the complete generation workflow from natural language', () => {
    const integration = new BuiltInToolsIntegration();
    const names = integration.analyzeBuiltInToolRelevance('Generate a DNA sequence using Evo 2').map(tool => tool.name);
    expect(names).toEqual(expect.arrayContaining(['evo2_generate', 'evo2_get_result', 'evo2_cancel']));
    expect(integration.getBuiltInToolInfo('evo2_generate').type).toBe('built-in');
  });
  it('allows repeated polling even when global identical-call limits are exhausted', () => {
    const chatManager = {
      configManager: { get: () => undefined },
      getToolExecutionCount: () => 99,
      getToolExecutionCountByName: () => 99,
      wasToolExecutedSuccessfully: () => true,
    };
    const policy = new ToolExecutionPolicy({ chatManager, CapabilityPolicyClass: ToolCapabilityPolicy });
    for (const name of ['evo2_get_result', 'evo2_cancel']) {
      expect(policy.shouldAllowToolExecution({ tool_name: name, parameters: { job_id: 'job' } }, [], 10)).toBe(true);
    }
  });
});

describe('Evo 2 GUI', () => {
  let ui;
  let invoke;
  beforeEach(() => {
    document.body.innerHTML = '<button id="launcher">Open</button>';
    window.Evo2Service = Evo2Service;
    invoke = vi.fn().mockResolvedValue({ success: true, configured: false });
    window.electronAPI = { invoke };
    ui = new Evo2UI({
      currentChromosome: 'test',
      currentSequence: { test: 'ACGTACGT' },
      currentPosition: { start: 2, end: 6 },
    });
  });
  afterEach(() => {
    clearTimeout(ui.timer);
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });
  it('opens configuration, erases entered keys, and uses the visible region correctly', async () => {
    await ui.open();
    expect(ui.element('Credentials').open).toBe(true);
    ui.element('Key').value = 'nvapi-test-fixture';
    invoke.mockResolvedValueOnce({ success: true, configured: true });
    await ui.saveKey();
    expect(ui.element('Key').value).toBe('');
    expect(ui.element('Configured').textContent).toContain('configured');
    ui.useRegion();
    expect(ui.element('Sequence').value).toBe('GTAC');
    expect(ui.element('Source').textContent).toBe('test:3-6 (forward strand)');
  });
  it('submits parameters, polls, and renders provider data as text', async () => {
    await ui.open();
    ui.element('Sequence').value = 'ACGT';
    ui.element('TopK').value = '0';
    ui.element('Seed').value = '0';
    invoke
      .mockResolvedValueOnce({ success: true, status: 'running', job_id: 'job' })
      .mockResolvedValueOnce({ success: true, status: 'running', job_id: 'job', elapsed_ms: 30 });
    await ui.generate();
    expect(invoke).toHaveBeenCalledWith('evo2:generate', expect.objectContaining({ top_k: 0, random_seed: 0 }));
    expect(ui.element('Generate').disabled).toBe(true);
    invoke.mockResolvedValueOnce({
      success: true,
      status: 'completed',
      job_id: 'job',
      result: { sequence: 'ACTG', elapsed_ms: 2 },
    });
    await ui.poll();
    expect(ui.element('Results').hidden).toBe(false);
    expect(ui.element('Output').value).toBe('ACTG');
    expect(ui.element('Generate').disabled).toBe(false);
    expect(ui.app.currentSequence.test).toBe('ACGTACGT');
  });
  it('displays provider failures and permits another submission', async () => {
    await ui.open();
    invoke
      .mockResolvedValueOnce({ success: true, status: 'running', job_id: 'job' })
      .mockResolvedValueOnce({ success: false, status: 'failed', error: 'NVIDIA HTTP 401.' });
    await ui.perform(() => ui.generate());
    expect(ui.element('Status').textContent).toBe('NVIDIA HTTP 401.');
    expect(ui.busy).toBe(false);
    expect(ui.element('Results').hidden).toBe(true);
  });
  it('stops polling on close and resumes the same request on reopen', async () => {
    await ui.open();
    ui.jobId = 'job';
    ui.setBusy(true);
    invoke.mockResolvedValueOnce({ success: true, status: 'running', job_id: 'job', elapsed_ms: 1 });
    await ui.poll();
    ui.close();
    invoke
      .mockResolvedValueOnce({ success: true, configured: true })
      .mockResolvedValueOnce({
        success: true,
        status: 'completed',
        job_id: 'job',
        result: { sequence: 'ACGT', elapsed_ms: 12 },
      });
    await ui.open();
    expect(ui.element('Output').value).toBe('ACGT');
    expect(invoke.mock.calls.filter(([channel]) => channel === 'evo2:generate')).toHaveLength(0);
  });
  it('cancels without editing sequence data', async () => {
    await ui.open();
    ui.jobId = 'job';
    ui.setBusy(true);
    invoke.mockResolvedValueOnce({ success: false, status: 'cancelled', error: 'Stopped locally.' });
    await ui.cancel();
    expect(ui.busy).toBe(false);
    expect(ui.element('Status').textContent).toBe('Stopped locally.');
    expect(ui.app.currentSequence.test).toBe('ACGTACGT');
  });
});
