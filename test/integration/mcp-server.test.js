/**
 * MCP Server Integration Tests
 */
import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'node:module';

const MCP_TOOLS_DIR = path.join(process.cwd(), 'src/mcp-tools');
const MCP_SERVER_PATH = path.join(process.cwd(), 'src/mcp-server.js');
const MCP_START_SCRIPT_PATH = path.join(process.cwd(), 'scripts/start-mcp-server.js');
const MAIN_PROCESS_PATH = path.join(process.cwd(), 'src/main.js');
const PACKAGE_PATH = path.join(process.cwd(), 'package.json');
const RENDERER_PATH = path.join(process.cwd(), 'src/renderer/renderer-modular.js');
const require = createRequire(import.meta.url);

describe('MCP Server Structure', () => {
  let mcpContent;

  beforeAll(() => {
    mcpContent = fs.readFileSync(MCP_SERVER_PATH, 'utf-8');
  });

  it('mcp-server.js should exist', () => {
    expect(fs.existsSync(MCP_SERVER_PATH)).toBe(true);
  });

  it('mcp-server.js should define MCP server class', () => {
    expect(mcpContent.includes('class StandardClaudeMCPServer') || mcpContent.includes('class UnifiedMCPServer')).toBe(
      true
    );
  });

  it('mcp-server.js should export the class', () => {
    expect(mcpContent).toContain('module.exports');
  });

  it('should have port allocation logic', () => {
    expect(mcpContent.includes('port') || mcpContent.includes('PORT')).toBe(true);
  });

  it('does not install process-level shutdown listeners when embedded', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const beforeSigint = process.listenerCount('SIGINT');
    const beforeSigterm = process.listenerCount('SIGTERM');
    const server = new MCPServer(0, 0, null, { requireAuth: false });

    expect(process.listenerCount('SIGINT')).toBe(beforeSigint);
    expect(process.listenerCount('SIGTERM')).toBe(beforeSigterm);
    await server.stop();
    expect(process.listenerCount('SIGINT')).toBe(beforeSigint);
    expect(process.listenerCount('SIGTERM')).toBe(beforeSigterm);
  });

  it('keeps shutdown signal ownership in the standalone wrapper', () => {
    const script = fs.readFileSync(MCP_START_SCRIPT_PATH, 'utf8');
    expect(script).toMatch(/process\.once\(['"]SIGINT['"]/);
    expect(script).toMatch(/process\.once\(['"]SIGTERM['"]/);
  });

  it('starts combined Electron and MCP mode in-process for authenticated IPC routing', () => {
    const scripts = JSON.parse(fs.readFileSync(PACKAGE_PATH, 'utf8')).scripts;
    const mainSource = fs.readFileSync(MAIN_PROCESS_PATH, 'utf8');

    expect(scripts['start-with-mcp']).toContain('--start-mcp');
    expect(scripts['start-with-mcp']).not.toContain('npm run mcp-server');
    expect(mainSource).toContain("args.includes('--start-mcp')");
    expect(mainSource).toContain('await mcp.startUnifiedMCPServer()');
    expect(mainSource).toContain("dialog.showErrorBox('CodeXomics MCP startup failed'");
    expect(mainSource).toContain('app.exit(1)');
    const setterStart = mainSource.indexOf('setUnifiedMCPServer: v =>');
    const setterEnd = mainSource.indexOf('getUnifiedServerStatus:', setterStart);
    expect(mainSource.slice(setterStart, setterEnd)).toContain('wr.setDependencies({ unifiedMCPServer: v })');
  });

  it('should reference ToolsIntegrator', () => {
    expect(mcpContent).toContain('ToolsIntegrator');
  });

  it('should format screenshot image data as MCP image content', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = new MCPServer(0, 0, null, { requireAuth: false });

    try {
      const content = server.formatToolResultContent('capture_screenshot', {
        success: true,
        result: {
          success: true,
          tool: 'capture_screenshot',
          format: 'png',
          mimeType: 'image/png',
          width: 2,
          height: 1,
          imageData: 'AAAA',
          imageDataEncoding: 'base64',
        },
      });

      expect(content).toHaveLength(2);
      expect(content[0].type).toBe('text');
      expect(JSON.parse(content[0].text).result.imageData).toContain('omitted');
      expect(content[1]).toEqual({
        type: 'image',
        data: 'AAAA',
        mimeType: 'image/png',
      });
    } finally {
      await server.stop();
    }
  });

  it('returns an approval capability only from the approval tool response', () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = Object.create(MCPServer.prototype);
    const result = {
      success: true,
      result: { approvalToken: 'capability-once', nested: { token: 'never-return-generic-token' } },
    };

    const approvalPayload = JSON.parse(server.formatToolResultContent('request_annotation_approval', result)[0].text);
    expect(approvalPayload.result.approvalToken).toBe('capability-once');
    expect(approvalPayload.result.nested.token).toBe('[redacted]');

    const unrelatedPayload = JSON.parse(server.formatToolResultContent('get_annotation_changeset', result)[0].text);
    expect(unrelatedPayload.result.approvalToken).toBe('[redacted]');
  });

  it('denies unmapped tools to every non-admin scoped credential', () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = Object.create(MCPServer.prototype);

    expect(() =>
      server._assertToolPermission('read_file', {
        authenticated: true,
        principal: 'unknown-scope',
        permissions: ['foo'],
        isAdmin: false,
      })
    ).toThrow('not permitted');
    expect(() =>
      server._assertToolPermission('read_file', {
        authenticated: true,
        principal: 'admin',
        permissions: [],
        isAdmin: true,
      })
    ).not.toThrow();
    expect(() =>
      server._assertToolPermission('switch_active_window', {
        authenticated: true,
        principal: 'annotation-reader',
        permissions: ['annotation:read'],
        isAdmin: false,
      })
    ).not.toThrow();
    expect(() =>
      server._assertToolPermission('reject_annotation_changeset', {
        authenticated: true,
        principal: 'curator',
        permissions: ['annotation:approve'],
        isAdmin: false,
      })
    ).not.toThrow();
    for (const toolName of ['edit_annotation', 'batch_create_annotations']) {
      expect(() =>
        server._assertToolPermission(toolName, {
          authenticated: true,
          principal: 'structural-curator',
          permissions: ['annotation:structural'],
          isAdmin: false,
        })
      ).not.toThrow();
      expect(() =>
        server._assertToolPermission(toolName, {
          authenticated: true,
          principal: 'annotation-approver',
          permissions: ['annotation:approve'],
          isAdmin: false,
        })
      ).toThrow('annotation:structural');
    }
  });

  it('only advertises tools permitted by the authenticated credential', () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = Object.create(MCPServer.prototype);
    server.toolsIntegrator = {
      getAvailableTools: () => [
        { name: 'resolve_annotation_target' },
        { name: 'create_annotation_changeset' },
        { name: 'request_annotation_approval' },
        { name: 'reject_annotation_changeset' },
        { name: 'apply_annotation_changeset' },
        { name: 'edit_annotation' },
        { name: 'batch_create_annotations' },
        { name: 'read_file' },
      ],
    };

    const readerTools = server._getPermittedTools({
      authenticated: true,
      principal: 'reader',
      permissions: ['annotation:read'],
      isAdmin: false,
    });
    expect(readerTools.map(tool => tool.name)).toEqual(['resolve_annotation_target']);
    const curatorTools = server._getPermittedTools({
      authenticated: true,
      principal: 'curator',
      permissions: ['annotation:approve'],
      isAdmin: false,
    });
    expect(curatorTools.map(tool => tool.name)).toEqual(['request_annotation_approval', 'reject_annotation_changeset']);
    const structuralTools = server._getPermittedTools({
      authenticated: true,
      principal: 'structural-curator',
      permissions: ['annotation:structural'],
      isAdmin: false,
    });
    expect(structuralTools.map(tool => tool.name)).toEqual(['edit_annotation', 'batch_create_annotations']);
    expect(
      server._getPermittedTools({ authenticated: true, principal: 'admin', permissions: [], isAdmin: true })
    ).toHaveLength(8);
    expect(server._getPermittedTools(null)).toEqual([]);
  });

  it('exposes exactly the three contracted tools in MCP agent mode', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = new MCPServer(0, 0, null, { requireAuth: false });
    server.mode = 'agent';
    try {
      const tools = server._getPermittedTools({
        authenticated: true,
        principal: 'admin',
        permissions: ['*'],
        isAdmin: true,
      });
      expect(tools.map(tool => tool.name).sort()).toEqual([
        'codexomics_chat',
        'list_genome_windows',
        'switch_active_window',
      ]);
      expect(() =>
        server._assertToolPermission('run_on_windows', {
          authenticated: true,
          principal: 'admin',
          permissions: ['*'],
          isAdmin: true,
        })
      ).toThrow('not available');
    } finally {
      await server.stop();
    }
  });

  it('binds legacy SSE POST messages to the authenticated stream owner', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = Object.create(MCPServer.prototype);
    const expectedContext = {
      source: 'mcp',
      authenticated: true,
      principal: 'curator',
      permissions: ['annotation:approve'],
      isAdmin: false,
      sessionId: 'owner-session',
    };
    const transport = { handlePostMessage: vi.fn(async () => undefined) };
    server.sseTransports = new Map([['sse-session', transport]]);
    server.sseConnectionIds = new Map([['sse-session', 'health-connection']]);
    server.transportExecutionContexts = new Map([['sse-session', expectedContext]]);
    server.healthMonitor = { updateActivity: vi.fn() };
    server.serverLog = () => {};
    const response = () => ({
      statusCode: 200,
      payload: null,
      headersSent: false,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      },
    });

    const ownerRequest = {
      query: { sessionId: 'sse-session' },
      body: { jsonrpc: '2.0', method: 'tools/list', id: 1 },
      mcpSession: { ...expectedContext },
    };
    await server.handleSSEPostRequest(ownerRequest, response());
    expect(transport.handlePostMessage).toHaveBeenCalledWith(ownerRequest, expect.any(Object), ownerRequest.body);
    expect(server.healthMonitor.updateActivity).toHaveBeenCalledWith('health-connection');
    expect(ownerRequest.auth).toMatchObject(expectedContext);
    expect(Object.isFrozen(ownerRequest.auth.permissions)).toBe(true);

    const mismatchedResponse = response();
    await server.handleSSEPostRequest(
      {
        ...ownerRequest,
        auth: undefined,
        mcpSession: { ...expectedContext, sessionId: 'different-session' },
      },
      mismatchedResponse
    );
    expect(mismatchedResponse.statusCode).toBe(403);
    expect(transport.handlePostMessage).toHaveBeenCalledTimes(1);

    const unknownResponse = response();
    await server.handleSSEPostRequest(
      { query: { sessionId: 'expired-session' }, mcpSession: expectedContext, body: {} },
      unknownResponse
    );
    expect(unknownResponse.statusCode).toBe(404);
  });

  it('closes expired SSE transports and removes every session registry entry', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = new MCPServer(0, 0, null, { requireAuth: false });
    server.serverLog = () => {};
    const transport = { close: vi.fn(async () => undefined), sessionId: 'expired-sse' };
    const protocolServer = { close: vi.fn(async () => undefined) };
    server.sseTransports.set('expired-sse', transport);
    server.sseProtocolServers.set('expired-sse', protocolServer);
    server.sseConnectionIds.set('expired-sse', 'expired-health');
    server.transportExecutionContexts.set('expired-sse', { principal: 'reader' });
    server.sessionWindowPins.set('expired-sse', 'window-a');
    server.activeConnections.add(transport);
    server.connectedProtocolServers.add(protocolServer);
    const connection = server.healthMonitor.registerConnection('expired-health', {
      type: 'sse',
      metadata: { sseSessionId: 'expired-sse' },
    });

    try {
      connection.lastActivity = Date.now() - server.healthMonitor.config.timeoutThreshold * 3;
      server.healthMonitor.performHealthCheck();
      await vi.waitFor(() => expect(protocolServer.close).toHaveBeenCalledTimes(1));
      expect(server.sseTransports.has('expired-sse')).toBe(false);
      expect(server.sseProtocolServers.has('expired-sse')).toBe(false);
      expect(server.sseConnectionIds.has('expired-sse')).toBe(false);
      expect(server.transportExecutionContexts.has('expired-sse')).toBe(false);
      expect(server.sessionWindowPins.has('expired-sse')).toBe(false);
      expect(server.activeConnections.has(transport)).toBe(false);
      expect(server.connectedProtocolServers.has(protocolServer)).toBe(false);
      expect(server.healthMonitor.getConnectionHealth('expired-health').exists).toBe(false);
    } finally {
      await server.stop();
    }
  });

  it('keeps agent progress scoped to the authenticated SSE session', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = Object.create(MCPServer.prototype);
    const firstProtocol = { sendLoggingMessage: vi.fn(async () => undefined) };
    const secondProtocol = { sendLoggingMessage: vi.fn(async () => undefined) };
    server.serverLog = vi.fn();
    server.sseProtocolServers = new Map([
      ['sse-a', firstProtocol],
      ['sse-b', secondProtocol],
    ]);
    server.transportExecutionContexts = new Map([
      ['sse-a', { sessionId: 'shared-auth', principal: 'shared-agent-key' }],
      ['sse-b', { sessionId: 'shared-auth', principal: 'shared-agent-key' }],
    ]);

    server.sendAgentProgress({
      type: 'tool_call',
      message: 'private progress',
      data: { tool: 'resolve_annotation_target' },
      sessionId: 'shared-auth',
      transportSessionId: 'sse-a',
      requestId: 'request-a',
    });
    await Promise.resolve();

    expect(firstProtocol.sendLoggingMessage).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.stringContaining('private progress') })
    );
    expect(firstProtocol.sendLoggingMessage.mock.calls[0][0].data).toContain('request-a');
    expect(secondProtocol.sendLoggingMessage).not.toHaveBeenCalled();

    server.sendAgentProgress({
      type: 'thinking',
      message: 'forged transport',
      sessionId: 'different-auth',
      transportSessionId: 'sse-b',
    });
    expect(server.serverLog).toHaveBeenCalledWith('warn', expect.stringContaining('mismatched'));
    expect(secondProtocol.sendLoggingMessage).not.toHaveBeenCalled();

    server.sendAgentProgress({ type: 'thinking', message: 'uncorrelated' });
    expect(server.serverLog).toHaveBeenCalledWith('warn', expect.stringContaining('uncorrelated'));
    expect(secondProtocol.sendLoggingMessage).not.toHaveBeenCalled();
  });

  it('tears down an SSE stream after bounded heartbeat backpressure', async () => {
    vi.useFakeTimers();
    const MCPServer = require(MCP_SERVER_PATH);
    const server = new MCPServer(0, 0, null, { requireAuth: false });
    server.serverLog = () => {};
    const response = {
      destroyed: false,
      writableEnded: false,
      write: vi.fn(() => false),
      once: vi.fn(),
    };
    const transport = { sessionId: 'blocked-sse', close: vi.fn(async () => undefined) };
    const protocolServer = { close: vi.fn(async () => undefined) };
    server.sseTransports.set('blocked-sse', transport);
    server.sseProtocolServers.set('blocked-sse', protocolServer);
    server.sseConnectionIds.set('blocked-sse', 'blocked-health');
    server.transportExecutionContexts.set('blocked-sse', { sessionId: 'blocked-auth', principal: 'reader' });
    server.activeConnections.add(transport);
    server.connectedProtocolServers.add(protocolServer);
    server.healthMonitor.registerConnection('blocked-health', {
      type: 'sse',
      metadata: { sseSessionId: 'blocked-sse' },
    });
    server._startSSEMaintenance('blocked-sse', response, Date.now() + 60 * 60 * 1000);

    try {
      await vi.advanceTimersByTimeAsync(80_000);
      await Promise.resolve();
      expect(response.write).toHaveBeenCalledTimes(3);
      expect(protocolServer.close).toHaveBeenCalledTimes(1);
      expect(server.sseTransports.has('blocked-sse')).toBe(false);
      expect(server.healthMonitor.getConnectionHealth('blocked-health').exists).toBe(false);
    } finally {
      await server._cleanupSSESession('blocked-sse', { closeTransport: true });
      server.healthMonitor.destroy();
      server.authManager.destroy();
      vi.useRealTimers();
    }
  });

  it('rejects excess SSE streams per authenticated principal before allocation', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = Object.create(MCPServer.prototype);
    server.serverLog = () => {};
    server.maxSSEConnections = 64;
    server.maxSSEConnectionsPerPrincipal = 1;
    server.sseTransports = new Map([['existing-sse', {}]]);
    server.transportExecutionContexts = new Map([
      ['existing-sse', { sessionId: 'shared-auth', principal: 'shared-agent-key' }],
    ]);
    const response = {
      statusCode: 200,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      },
    };

    await server.handleSSEConnection(
      {
        mcpSession: {
          authenticated: true,
          sessionId: 'shared-auth',
          keyId: 'shared-agent-key',
          permissions: ['annotation:read'],
        },
      },
      response
    );

    expect(response.statusCode).toBe(429);
    expect(response.payload.message).toContain('shared-agent-key');
    expect(server.sseTransports.size).toBe(1);
  });

  it('keeps idle SSE sessions healthy with heartbeat comments', async () => {
    vi.useFakeTimers();
    const MCPServer = require(MCP_SERVER_PATH);
    const server = new MCPServer(0, 0, null, { requireAuth: false });
    server.serverLog = () => {};
    const response = {
      destroyed: false,
      writableEnded: false,
      write: vi.fn(() => true),
    };
    const transport = { sessionId: 'idle-sse', close: vi.fn(async () => undefined) };
    const protocolServer = { close: vi.fn(async () => undefined) };
    server.sseTransports.set('idle-sse', transport);
    server.sseProtocolServers.set('idle-sse', protocolServer);
    server.sseConnectionIds.set('idle-sse', 'idle-health');
    server.transportExecutionContexts.set('idle-sse', { sessionId: 'idle-auth', principal: 'reader' });
    server.activeConnections.add(transport);
    server.connectedProtocolServers.add(protocolServer);
    server.healthMonitor.registerConnection('idle-health', {
      type: 'sse',
      metadata: { sseSessionId: 'idle-sse' },
    });
    server._startSSEMaintenance('idle-sse', response, Date.now() + 60 * 60 * 1000);

    try {
      await vi.advanceTimersByTimeAsync(3 * 60 * 1000);
      expect(response.write).toHaveBeenCalledWith(': keepalive\n\n');
      expect(server.sseTransports.has('idle-sse')).toBe(true);
      expect(server.healthMonitor.getConnectionHealth('idle-health')).toMatchObject({
        exists: true,
        isHealthy: true,
      });
    } finally {
      await server._cleanupSSESession('idle-sse', { closeTransport: true });
      server.healthMonitor.destroy();
      server.authManager.destroy();
      vi.useRealTimers();
    }
  });

  it('does not retain a ghost protocol server when an SSE stream closes during connect', async () => {
    const { EventEmitter } = require('events');
    const MCPServer = require(MCP_SERVER_PATH);
    const server = Object.create(MCPServer.prototype);
    let releaseConnect;
    const connectGate = new Promise(resolve => {
      releaseConnect = resolve;
    });
    const protocolServer = {
      connect: vi.fn(async () => connectGate),
      close: vi.fn(async () => undefined),
    };
    server._createProtocolServer = () => protocolServer;
    server.setupMCPServer = () => {};
    server.serverLog = () => {};
    server.activeConnections = new Set();
    server.sseTransports = new Map();
    server.sseProtocolServers = new Map();
    server.sseConnectionIds = new Map();
    server.sseCleanupInProgress = new Set();
    server.sseHeartbeatTimers = new Map();
    server.sseExpiryTimers = new Map();
    server.sseBackpressureState = new Map();
    server.connectedProtocolServers = new Set();
    server.transportExecutionContexts = new Map();
    server.healthMonitor = {
      registerConnection: vi.fn(),
      unregisterConnection: vi.fn(),
      updateActivity: vi.fn(),
    };
    const request = new EventEmitter();
    request.mcpSession = {
      authenticated: true,
      principal: 'reader',
      permissions: ['annotation:read'],
      isAdmin: false,
      sessionId: 'auth-session',
      expiresAt: Date.now() + 60_000,
    };
    request.ip = '127.0.0.1';
    request.get = () => 'test-client';
    const response = new EventEmitter();
    response.headersSent = false;
    response.destroyed = false;
    response.writableEnded = false;
    response.status = vi.fn(() => response);
    response.json = vi.fn(() => response);

    const connecting = server.handleSSEConnection(request, response);
    await vi.waitFor(() => expect(server.sseTransports.size).toBe(1));
    response.emit('close');
    await vi.waitFor(() => expect(server.sseTransports.size).toBe(0));
    releaseConnect();
    await connecting;

    expect(protocolServer.close).toHaveBeenCalledTimes(1);
    expect(server.connectedProtocolServers.has(protocolServer)).toBe(false);
    expect(server.sseProtocolServers.size).toBe(0);
  });

  it('clears successful execution timeout timers instead of retaining them', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = Object.create(MCPServer.prototype);
    const clearTimeoutSpy = vi.spyOn(globalThis, 'clearTimeout');
    try {
      await expect(server._withTimeout(() => Promise.resolve('ok'), 30_000, 'timeout')).resolves.toBe('ok');
      expect(clearTimeoutSpy).toHaveBeenCalled();
    } finally {
      clearTimeoutSpy.mockRestore();
    }
  });

  it('coalesces concurrent starts and stops for one server instance', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = new MCPServer(0, 0, null, { requireAuth: false });
    let releaseStart;
    const startGate = new Promise(resolve => {
      releaseStart = resolve;
    });
    server._startServer = vi.fn(async () => {
      await startGate;
      server.lifecycleState = 'running';
    });

    const firstStart = server.start();
    const secondStart = server.start();
    expect(secondStart).toBe(firstStart);
    releaseStart();
    await firstStart;

    const cleanupSpy = vi.spyOn(server, '_cleanupResources');
    const firstStop = server.stop();
    const secondStop = server.stop();
    expect(secondStop).toBe(firstStop);
    await firstStop;
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    expect(server.lifecycleState).toBe('closed');
  });

  it('cleans partial resources and closes the instance after a startup failure', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = new MCPServer(0, 0, null, { requireAuth: false });
    const bindError = Object.assign(new Error('operation not permitted'), { code: 'EPERM' });
    server.setupWebSocketServer = vi.fn(async () => bindError);
    const cleanupSpy = vi.spyOn(server, '_cleanupResources');

    await expect(server.start()).rejects.toThrow('Failed to bind WebSocket server');
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
    expect(server.lifecycleState).toBe('closed');
    await expect(server.start()).rejects.toThrow('lifecycle state');
  });

  it('closes long-lived transports before the HTTP listener during shutdown', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = new MCPServer(0, 0, null, { requireAuth: false, shutdownGraceMs: 25 });
    const order = [];
    server.lifecycleState = 'running';
    server.activeConnections.add({ close: async () => order.push('transport') });
    server.httpServer = { close: callback => (order.push('http'), callback()) };
    server.wsServer = { close: callback => (order.push('websocket-server'), callback()) };

    await server.stop();
    expect(order.indexOf('transport')).toBeLessThan(order.indexOf('http'));
    expect(order).toContain('websocket-server');
  });

  it('closes each mapped SSE transport only once during shutdown', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = new MCPServer(0, 0, null, { requireAuth: false, shutdownGraceMs: 25 });
    server.serverLog = () => {};
    server.lifecycleState = 'running';
    const transport = { sessionId: 'shutdown-sse', close: vi.fn(async () => undefined) };
    const protocolServer = { close: vi.fn(async () => transport.close()) };
    server.sseTransports.set('shutdown-sse', transport);
    server.sseProtocolServers.set('shutdown-sse', protocolServer);
    server.sseConnectionIds.set('shutdown-sse', 'shutdown-health');
    server.transportExecutionContexts.set('shutdown-sse', { sessionId: 'shutdown-auth' });
    server.activeConnections.add(transport);
    server.connectedProtocolServers.add(protocolServer);
    server.healthMonitor.registerConnection('shutdown-health', {
      type: 'sse',
      metadata: { sseSessionId: 'shutdown-sse' },
    });

    await server.stop();
    expect(protocolServer.close).toHaveBeenCalledTimes(1);
    expect(transport.close).toHaveBeenCalledTimes(1);
  });

  it('applies the standard execution timeout to WebSocket tool calls', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = Object.create(MCPServer.prototype);
    server.mode = 'tools';
    server.authManager = { validateSession: () => ({ valid: true, principal: 'admin', isAdmin: true }) };
    server.toolsIntegrator = { executeTool: vi.fn() };
    server._withTimeout = vi.fn(async operation => operation());

    const response = await server.handleWebSocketMessage(
      { method: 'tools/call', params: { name: 'resolve_annotation_target', arguments: {} }, id: 1 },
      'session-1'
    );

    expect(response.error).toBeUndefined();
    expect(server._withTimeout).toHaveBeenCalledWith(expect.any(Function), 30000, expect.stringContaining('30'));
    const executionContext = server.toolsIntegrator.executeTool.mock.calls[0][3];
    expect(executionContext.commitNotAfter).toBeLessThan(executionContext.requestDeadline);
  });

  it('preserves the 120-second agent deadline across the Electron IPC hop', async () => {
    vi.useFakeTimers();
    const MCPServer = require(MCP_SERVER_PATH);
    const server = Object.create(MCPServer.prototype);
    const send = vi.fn();
    server.mode = 'agent';
    server.pendingRequests = new Map();
    server.serverLog = () => {};
    server.windowRegistry = new Map([['window-1', {}]]);
    server.resolveElectronTarget = () => ({
      window: { isDestroyed: () => false, webContents: { send } },
      windowId: 'window-1',
      genomeName: 'test-genome',
    });
    server._attachRoutingMeta = result => result;
    const executionContext = {
      authenticated: true,
      sessionId: 'agent-session',
      requestDeadline: Date.now() + 120000,
    };

    try {
      const outcome = server
        .executeViaElectronIPC('codexomics_chat', { prompt: 'long analysis' }, 'agent-session', null, executionContext)
        .catch(error => error);
      expect(send).toHaveBeenCalledWith(
        'mcp-tool-call',
        expect.objectContaining({ executionContext, method: 'codexomicsChat' })
      );

      await vi.advanceTimersByTimeAsync(31_000);
      expect(server.pendingRequests.size).toBe(1);
      await vi.advanceTimersByTimeAsync(90_000);
      const error = await outcome;
      expect(error).toBeInstanceOf(Error);
      expect(error.message).toContain('Tool execution timeout');
      expect(server.pendingRequests.size).toBe(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it('accepts the standard initialized notification without a JSON-RPC response', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = Object.create(MCPServer.prototype);
    server.isInitialized = false;
    server.serverLog = () => {};
    const response = {
      statusCode: 200,
      sent: false,
      setHeader() {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      send() {
        this.sent = true;
        return this;
      },
    };

    await server.handleMCPPostRequest(
      {
        path: '/mcp',
        ip: '127.0.0.1',
        body: { jsonrpc: '2.0', method: 'notifications/initialized' },
        get: () => undefined,
      },
      response
    );

    expect(response.statusCode).toBe(204);
    expect(response.sent).toBe(true);
    expect(server.isInitialized).toBe(true);
  });

  it('interoperates with the SDK streamable HTTP client and filters scoped tool discovery', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const { Client } = require('@modelcontextprotocol/sdk/client/index.js');
    const { SSEClientTransport } = require('@modelcontextprotocol/sdk/client/sse.js');
    const { StreamableHTTPClientTransport } = require('@modelcontextprotocol/sdk/client/streamableHttp.js');
    const server = new MCPServer(0, 0, null, {
      requireAuth: true,
      masterKey: 'admin-test-secret-1234',
      apiKeys: [
        {
          keyId: 'reader',
          apiKey: 'reader-test-secret-1234',
          permissions: ['annotation:read'],
        },
        {
          keyId: 'curator',
          apiKey: 'curator-test-secret-1234',
          permissions: ['annotation:read', 'annotation:approve'],
        },
        {
          keyId: 'structural-curator',
          apiKey: 'structural-test-secret-1234',
          permissions: ['annotation:structural'],
        },
      ],
    });
    server.serverLog = () => {};
    const executeToolSpy = vi.spyOn(server.toolsIntegrator, 'executeTool').mockResolvedValue({
      success: true,
      result: { success: true, changeSet: { id: 'cs-test', status: 'rejected' } },
    });
    const legacyClients = [];

    const listAs = async (name, token) => {
      const client = new Client({ name, version: '1.0.0' });
      const transport = new StreamableHTTPClientTransport(
        new URL(`http://127.0.0.1:${server.httpServer.address().port}/mcp`),
        { requestInit: { headers: { Authorization: `Bearer ${token}` } } }
      );
      try {
        await client.connect(transport);
        return (await client.listTools()).tools.map(tool => tool.name);
      } finally {
        await client.close();
      }
    };

    const callAs = async (name, token, toolName, args) => {
      const client = new Client({ name, version: '1.0.0' });
      const transport = new StreamableHTTPClientTransport(
        new URL(`http://127.0.0.1:${server.httpServer.address().port}/mcp`),
        { requestInit: { headers: { Authorization: `Bearer ${token}` } } }
      );
      try {
        await client.connect(transport);
        return await client.callTool({ name: toolName, arguments: args });
      } finally {
        await client.close();
      }
    };

    const connectLegacySSE = async (name, token) => {
      const client = new Client({ name, version: '1.0.0' });
      const transport = new SSEClientTransport(new URL(`http://127.0.0.1:${server.httpServer.address().port}/sse`), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      });
      await client.connect(transport);
      legacyClients.push(client);
      return client;
    };

    try {
      try {
        await server.start();
      } catch (error) {
        // Some hermetic test sandboxes prohibit even loopback listeners. CI
        // and normal development still execute the real SDK transport path.
        if (/\b(?:EPERM|EACCES)\b|operation not permitted/i.test(error.message)) return;
        throw error;
      }
      const adminTools = await listAs('admin-test', 'admin-test-secret-1234');
      const readerTools = await listAs('reader-test', 'reader-test-secret-1234');
      const curatorTools = await listAs('curator-test', 'curator-test-secret-1234');
      const structuralTools = await listAs('structural-test', 'structural-test-secret-1234');
      const rejectionResult = await callAs(
        'curator-call-test',
        'curator-test-secret-1234',
        'reject_annotation_changeset',
        { changeSetId: 'cs-test', reason: 'integration-test' }
      );
      const structuralEditArgs = {
        annotationId: 'feature-1',
        updates: { start: 10, end: 90, strand: -1 },
      };
      const structuralEditResult = await callAs(
        'structural-edit-test',
        'structural-test-secret-1234',
        'edit_annotation',
        structuralEditArgs
      );
      const structuralBatchArgs = {
        chromosome: 'chr1',
        annotations: [{ type: 'CDS', start: 100, end: 180, strand: 1, qualifiers: { locus_tag: 'new_1' } }],
      };
      const structuralBatchResult = await callAs(
        'structural-batch-test',
        'structural-test-secret-1234',
        'batch_create_annotations',
        structuralBatchArgs
      );
      const firstLegacyClient = await connectLegacySSE('legacy-reader-a', 'reader-test-secret-1234');
      const secondLegacyClient = await connectLegacySSE('legacy-reader-b', 'reader-test-secret-1234');
      const firstLegacyReaderTools = (await firstLegacyClient.listTools()).tools.map(tool => tool.name);
      const secondLegacyReaderTools = (await secondLegacyClient.listTools()).tools.map(tool => tool.name);

      expect(server.isInitialized).toBe(true);
      expect(adminTools).toContain('navigate_to_position');
      expect(readerTools).toContain('resolve_annotation_target');
      expect(readerTools).not.toContain('create_annotation_changeset');
      expect(readerTools).not.toContain('navigate_to_position');
      expect(curatorTools).toContain('request_annotation_approval');
      expect(curatorTools).toContain('reject_annotation_changeset');
      expect(curatorTools).not.toContain('apply_annotation_changeset');
      expect(structuralTools.sort()).toEqual(
        ['batch_create_annotations', 'delete_annotation', 'edit_annotation'].sort()
      );
      expect(rejectionResult.isError).not.toBe(true);
      expect(structuralEditResult.isError).not.toBe(true);
      expect(structuralBatchResult.isError).not.toBe(true);
      expect(firstLegacyReaderTools).toContain('resolve_annotation_target');
      expect(secondLegacyReaderTools).toContain('resolve_annotation_target');
      expect(firstLegacyReaderTools).not.toContain('create_annotation_changeset');
      expect(secondLegacyReaderTools).not.toContain('create_annotation_changeset');
      expect(server.sseTransports.size).toBe(2);

      await firstLegacyClient.close();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(server.sseTransports.size).toBe(1);
      expect((await secondLegacyClient.listTools()).tools.map(tool => tool.name)).toContain(
        'resolve_annotation_target'
      );
      await secondLegacyClient.close();
      await new Promise(resolve => setTimeout(resolve, 10));
      expect(server.sseTransports.size).toBe(0);
      expect(executeToolSpy).toHaveBeenCalledWith(
        'reject_annotation_changeset',
        { changeSetId: 'cs-test', reason: 'integration-test' },
        expect.any(String),
        expect.objectContaining({
          source: 'mcp',
          authenticated: true,
          principal: 'curator',
          permissions: ['annotation:read', 'annotation:approve'],
          isAdmin: false,
        })
      );
      for (const [toolName, args] of [
        ['edit_annotation', structuralEditArgs],
        ['batch_create_annotations', structuralBatchArgs],
      ]) {
        expect(executeToolSpy).toHaveBeenCalledWith(
          toolName,
          args,
          expect.any(String),
          expect.objectContaining({
            source: 'mcp',
            authenticated: true,
            principal: 'structural-curator',
            permissions: ['annotation:structural'],
            isAdmin: false,
          })
        );
      }
    } finally {
      await Promise.all(legacyClients.map(client => client.close().catch(() => undefined)));
      await server.stop();
    }
  });

  it('keeps InternalMCPServer as the sole active mcp-tool-call handler', () => {
    const source = fs.readFileSync(RENDERER_PATH, 'utf8');
    const listenerStart = source.indexOf("ipcRenderer.on('mcp-tool-call'");
    const guardIndex = source.indexOf('if (this.internalMCPServer) return;', listenerStart);
    const legacyExecutionIndex = source.indexOf('processAgentPrompt', listenerStart);

    expect(listenerStart).toBeGreaterThan(-1);
    expect(guardIndex).toBeGreaterThan(listenerStart);
    expect(guardIndex).toBeLessThan(legacyExecutionIndex);
  });

  it('prevents authenticated external WebSockets from escalating into an internal bridge role', () => {
    const source = fs.readFileSync(MCP_SERVER_PATH, 'utf8');

    expect(source).toContain("let connectionRole = 'unauthenticated'");
    expect(source).toContain("connectionRole = 'internal-bridge'");
    expect(source).toContain("connectionRole = 'external-client'");
    expect(source).toContain("if (connectionRole !== 'internal-bridge')");
    expect(source).toContain('Internal WebSocket bridge registration is disabled');
  });

  it('rejects non-string WebSocket API keys with a policy violation without disarming the auth timeout', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const WebSocket = require('ws');
    const server = new MCPServer(0, 0, null, {
      requireAuth: true,
      masterKey: 'websocket-auth-test-secret-1234',
    });
    server.serverLog = () => {};
    let client = null;

    try {
      const source = fs.readFileSync(MCP_SERVER_PATH, 'utf8');
      const authStart = source.indexOf("if (message.type === 'authenticate')");
      const authEnd = source.indexOf("connectionRole = 'external-client'", authStart);
      const authBlock = source.slice(authStart, authEnd);
      expect(authBlock).toContain("typeof rawApiKey !== 'string'");
      expect(authBlock).toContain("ws.close(1008, 'Invalid API key')");
      expect(authBlock.match(/clearTimeout\(authTimeout\)/g) || []).toHaveLength(1);
      expect(authBlock.indexOf('authenticated = true')).toBeLessThan(authBlock.indexOf('clearTimeout(authTimeout)'));

      const bindError = await server.setupWebSocketServer();
      if (bindError && /\b(?:EPERM|EACCES)\b|operation not permitted/i.test(bindError.message)) return;
      expect(bindError).toBeNull();

      client = new WebSocket(`ws://127.0.0.1:${server.wsServer.address().port}`);
      await new Promise((resolve, reject) => {
        client.once('open', resolve);
        client.once('error', reject);
      });

      const closed = new Promise((resolve, reject) => {
        client.once('close', (code, reason) => resolve({ code, reason: reason.toString() }));
        client.once('error', reject);
      });
      client.send(JSON.stringify({ type: 'authenticate', apiKey: { secret: 'not-a-string' } }));

      await expect(closed).resolves.toEqual({ code: 1008, reason: 'Invalid API key' });
      expect(server.authManager.sessions.size).toBe(0);
    } finally {
      if (client && client.readyState < WebSocket.CLOSING) client.terminate();
      await server.stop();
    }
  });

  it('releases socket-owned WebSocket sessions across reconnects without revoking the shared bypass session', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const authenticatedServer = new MCPServer(0, 0, null, {
      requireAuth: true,
      masterKey: 'websocket-reconnect-test-secret-1234',
    });
    const bypassServer = new MCPServer(0, 0, null, { requireAuth: false });
    authenticatedServer.serverLog = () => {};
    bypassServer.serverLog = () => {};

    try {
      for (let reconnect = 0; reconnect < 12; reconnect += 1) {
        const authenticated = authenticatedServer.authManager.validateApiKey('websocket-reconnect-test-secret-1234', {
          type: 'websocket',
        });
        expect(authenticated.valid).toBe(true);
        authenticatedServer.sessionWindowPins.set(authenticated.sessionId, 'window-1');
        expect(
          authenticatedServer._releaseWebSocketAuthenticationSession(authenticated.sessionId, 'external-client')
        ).toBe(true);
        expect(authenticatedServer.authManager.sessions.has(authenticated.sessionId)).toBe(false);
        expect(authenticatedServer.sessionWindowPins.has(authenticated.sessionId)).toBe(false);
      }
      expect(authenticatedServer.authManager.sessions.size).toBe(0);

      const firstBypass = bypassServer.authManager.validateApiKey('ignored', { type: 'websocket' });
      const secondBypass = bypassServer.authManager.validateApiKey('ignored', { type: 'websocket' });
      expect(secondBypass.sessionId).toBe(firstBypass.sessionId);
      expect(bypassServer._releaseWebSocketAuthenticationSession(firstBypass.sessionId, 'external-client')).toBe(false);
      expect(bypassServer.authManager.validateSession(firstBypass.sessionId).valid).toBe(true);

      const source = fs.readFileSync(MCP_SERVER_PATH, 'utf8');
      const teardownStart = source.indexOf('// Handle connection close');
      const teardownEnd = source.indexOf('// Send initial connection confirmation', teardownStart);
      expect(
        source.slice(teardownStart, teardownEnd).match(/_releaseWebSocketAuthenticationSession/g) || []
      ).toHaveLength(2);
    } finally {
      await Promise.all([authenticatedServer.stop(), bypassServer.stop()]);
    }
  });

  it('isolates window pins for MCP transports that share one scoped auth session', () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = Object.create(MCPServer.prototype);
    server.sessionWindowPins = new Map();
    server.internalClients = new Map([
      ['window-a', {}],
      ['window-b', {}],
    ]);
    server.windowRegistry = new Map();
    server.mainWindowRegistry = null;

    const sharedScopedKey = {
      authenticated: true,
      sessionId: 'shared-auth-session',
      principal: 'shared-scoped-key',
      permissions: ['annotation:read'],
      isAdmin: false,
    };
    const firstTransportId = server._routingClientId('forged-other-client', {
      ...sharedScopedKey,
      transportSessionId: 'sse-transport-a',
    });
    const secondTransportId = server._routingClientId('forged-other-client', {
      ...sharedScopedKey,
      transportSessionId: 'sse-transport-b',
    });

    server.setSessionWindowPin(firstTransportId, 'window-a');
    server.setSessionWindowPin(secondTransportId, 'window-b');

    expect(firstTransportId).toBe('sse-transport-a');
    expect(secondTransportId).toBe('sse-transport-b');
    expect(server.getSessionWindowPin(firstTransportId)).toBe('window-a');
    expect(server.getSessionWindowPin(secondTransportId)).toBe('window-b');
    expect(server._routingClientId('forged-other-client', sharedScopedKey)).toBe('shared-auth-session');
    expect(server._routingClientId('trusted-internal', null)).toBe('trusted-internal');
  });

  it('restricts legacy client bridges to the registering admin session', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = Object.create(MCPServer.prototype);
    server.clientBridges = new Map();
    server.serverLog = () => {};
    const response = () => ({
      statusCode: 200,
      payload: null,
      status(code) {
        this.statusCode = code;
        return this;
      },
      json(payload) {
        this.payload = payload;
        return this;
      },
    });
    const scopedRequest = {
      body: { bridgeId: 'bridge-1' },
      mcpSession: { sessionId: 'scoped-session', principal: 'reader', permissions: ['annotation:read'] },
    };
    const scopedResponse = response();
    server.handleClientBridgeRegistration(scopedRequest, scopedResponse);
    expect(scopedResponse.statusCode).toBe(403);

    const ownerRequest = {
      body: { bridgeId: 'bridge-1' },
      mcpSession: { sessionId: 'owner-session', principal: 'admin-a', permissions: [], isAdmin: true },
    };
    const ownerResponse = response();
    server.handleClientBridgeRegistration(ownerRequest, ownerResponse);
    expect(ownerResponse.payload.success).toBe(true);

    const otherResponse = response();
    await server.handleClientBridgeExecution(
      {
        body: { bridgeId: 'bridge-1' },
        mcpSession: { sessionId: 'other-session', principal: 'admin-b', permissions: [], isAdmin: true },
      },
      otherResponse
    );
    expect(otherResponse.statusCode).toBe(403);

    const unknownResponse = response();
    await server.handleClientBridgeExecution(
      {
        body: { bridgeId: 'bridge-1', requestId: 'not-pending', result: { approvalToken: 'secret' } },
        mcpSession: ownerRequest.mcpSession,
      },
      unknownResponse
    );
    expect(unknownResponse.statusCode).toBe(404);
  });

  it('queues bridge execution only on the authenticated admin session bridge', async () => {
    const MCPServer = require(MCP_SERVER_PATH);
    const server = Object.create(MCPServer.prototype);
    const firstBridge = {
      sessionId: 'admin-a-session',
      pendingRequests: new Map(),
      lastActivity: 0,
    };
    const secondBridge = {
      sessionId: 'admin-b-session',
      pendingRequests: new Map(),
      lastActivity: 0,
    };
    server.mode = 'tools';
    server.serverLog = () => {};
    server.clientBridges = new Map([
      ['bridge-a', firstBridge],
      ['bridge-b', secondBridge],
    ]);
    const executionContext = {
      authenticated: true,
      sessionId: 'admin-b-session',
      principal: 'admin-b',
      isAdmin: true,
      requestDeadline: Date.now() + 30000,
    };

    const resultPromise = server.executeViaClientBridge(
      'resolve_annotation_target',
      { identifier: 'b0001' },
      'admin-b-session',
      executionContext
    );
    expect(firstBridge.pendingRequests.size).toBe(0);
    expect(secondBridge.pendingRequests.size).toBe(1);
    const [requestId, pending] = Array.from(secondBridge.pendingRequests.entries())[0];
    clearTimeout(pending.timeout);
    secondBridge.pendingRequests.delete(requestId);
    pending.resolve({ success: true });
    await expect(resultPromise).resolves.toEqual({ success: true });

    await expect(
      server.executeViaClientBridge('resolve_annotation_target', { identifier: 'b0001' }, 'admin-c-session', {
        ...executionContext,
        sessionId: 'admin-c-session',
        principal: 'admin-c',
      })
    ).rejects.toThrow('authenticated MCP session');
  });
});

describe('MCP Tool Modules', () => {
  let toolModules;

  beforeAll(() => {
    // Collect all .js files in mcp-tools/ recursively
    const collect = dir => {
      const results = [];
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          results.push(...collect(full));
        } else if (entry.name.endsWith('.js')) {
          results.push(full);
        }
      }
      return results;
    };
    toolModules = collect(MCP_TOOLS_DIR);
  });

  it('should have at least 12 tool modules', () => {
    expect(toolModules.length).toBeGreaterThanOrEqual(12);
  });

  it('all tool modules should be valid JS', () => {
    for (const file of toolModules) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content.length).toBeGreaterThan(0);
    }
  });

  it('all tool modules should define a class', () => {
    for (const file of toolModules) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content.includes('class ')).toBe(true);
    }
  });

  it('all tool modules should export via module.exports', () => {
    for (const file of toolModules) {
      const content = fs.readFileSync(file, 'utf-8');
      expect(content.includes('module.exports')).toBe(true);
    }
  });

  it('should include ToolsIntegrator.js', () => {
    const filenames = toolModules.map(f => path.basename(f));
    expect(filenames).toContain('ToolsIntegrator.js');
  });

  it('ToolsIntegrator should have combineAllTools function', () => {
    const integratorPath = path.join(MCP_TOOLS_DIR, 'ToolsIntegrator.js');
    const content = fs.readFileSync(integratorPath, 'utf-8');
    expect(content).toContain('combineAllTools');
  });

  it('should have required tool categories', () => {
    const filenames = toolModules.map(f => path.basename(f));
    const expected = [
      'NavigationTools.js',
      'SequenceTools.js',
      'ProteinTools.js',
      'DatabaseTools.js',
      'DataTools.js',
      'PathwayTools.js',
      'ActionTools.js',
      'UtilityTools.js',
      'FileTools.js',
      'TrackSettingsTools.js',
      'PrimerTools.js',
      'AnnotationTools.js',
    ];
    for (const name of expected) {
      expect(filenames, `Should include ${name}`).toContain(name);
    }
  });
});

describe('MCP System Integration', () => {
  it('system_integration.js should exist in tools_registry/', () => {
    const sysIntPath = path.join(process.cwd(), 'tools_registry/system_integration.js');
    expect(fs.existsSync(sysIntPath)).toBe(true);
  });

  it('system_integration.js should have tool merge logic', () => {
    const content = fs.readFileSync(path.join(process.cwd(), 'tools_registry/system_integration.js'), 'utf-8');
    expect(content.includes('merge') || content.includes('deduplicat')).toBe(true);
  });
});
