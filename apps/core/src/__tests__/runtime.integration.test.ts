import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { CoreRuntime } from '../runtime.js';
import { createRequest } from '@condrix/protocol';

function findFreePort(): number {
  // Use a random port in the ephemeral range
  return 10000 + Math.floor(Math.random() * 50000);
}

function waitForOpen(ws: WebSocket): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.on('open', resolve);
    ws.on('error', reject);
  });
}

function sendAndWait(ws: WebSocket, msg: unknown): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('Timeout waiting for response')), 5000);
    const requestId = (msg as Record<string, unknown>).id;
    const handler = (data: Buffer | string) => {
      const parsed = JSON.parse(data.toString()) as Record<string, unknown>;
      // Only resolve on response messages matching our request
      if (parsed.type === 'response' && parsed.correlationId === requestId) {
        clearTimeout(timeout);
        ws.off('message', handler);
        resolve(parsed);
      }
    };
    ws.on('message', handler);
    ws.send(JSON.stringify(msg));
  });
}

describe('CoreRuntime Integration', () => {
  let runtime: CoreRuntime;
  let port: number;
  let ws: WebSocket;

  beforeEach(async () => {
    port = findFreePort();
    runtime = new CoreRuntime({
      coreId: 'test-core',
      displayName: 'TestCore',
      host: '127.0.0.1',
      port,
      dbPath: ':memory:',
      devMode: true,
    });
    await runtime.start();
  });

  afterEach(async () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.close();
    }
    await runtime.stop();
  });

  it('should accept WebSocket connections', async () => {
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForOpen(ws);
    expect(ws.readyState).toBe(WebSocket.OPEN);
  });

  it('should respond to core:info request', async () => {
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForOpen(ws);

    const request = createRequest('core', 'info', {});
    const response = await sendAndWait(ws, request);

    expect(response.success).toBe(true);
    expect(response.correlationId).toBe(request.id);
    const payload = response.payload as Record<string, unknown>;
    expect(payload.coreId).toBe('test-core');
    expect(payload.status).toBe('online');
  });

  it('should respond to core:health request', async () => {
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForOpen(ws);

    const request = createRequest('core', 'health', {});
    const response = await sendAndWait(ws, request);

    expect(response.success).toBe(true);
    const payload = response.payload as Record<string, unknown>;
    expect(payload.healthy).toBe(true);
    expect(typeof payload.uptime).toBe('number');
  });

  it('should handle project CRUD via WebSocket', async () => {
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForOpen(ws);

    // Create project
    const createReq = createRequest('project', 'create', {
      name: 'TestProject',
      path: '/tmp/test',
    });
    const createRes = await sendAndWait(ws, createReq);
    expect(createRes.success).toBe(true);
    const project = createRes.payload as { id: string; name: string };
    expect(project.name).toBe('TestProject');

    // List projects
    const listReq = createRequest('project', 'list', {});
    const listRes = await sendAndWait(ws, listReq);
    expect(listRes.success).toBe(true);
    const listPayload = listRes.payload as { projects: unknown[] };
    expect(listPayload.projects).toHaveLength(1);

    // Delete project
    const deleteReq = createRequest('project', 'delete', {
      projectId: project.id,
    });
    const deleteRes = await sendAndWait(ws, deleteReq);
    expect(deleteRes.success).toBe(true);
  });

  it('should handle workspace lifecycle via WebSocket', async () => {
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForOpen(ws);

    // Create project first
    const projReq = createRequest('project', 'create', {
      name: 'TestProject',
      path: '/tmp/test',
    });
    const projRes = await sendAndWait(ws, projReq);
    const projectId = (projRes.payload as { id: string }).id;

    // Create workspace
    const createReq = createRequest('workspace', 'create', {
      projectId,
      name: 'MainWorkspace',
    });
    const createRes = await sendAndWait(ws, createReq);
    expect(createRes.success).toBe(true);
    const workspace = createRes.payload as { id: string; state: string };
    expect(workspace.state).toBe('IDLE');

    // List workspaces
    const listReq = createRequest('workspace', 'list', { projectId });
    const listRes = await sendAndWait(ws, listReq);
    expect(listRes.success).toBe(true);

    // Destroy workspace
    const destroyReq = createRequest('workspace', 'destroy', {
      workspaceId: workspace.id,
    });
    const destroyRes = await sendAndWait(ws, destroyReq);
    expect(destroyRes.success).toBe(true);
  });

  it('should set and get config values', async () => {
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForOpen(ws);

    // Set a config value
    const setReq = createRequest('core', 'config.set', {
      key: 'model.id',
      value: 'claude-opus-4-5',
    });
    const setRes = await sendAndWait(ws, setReq);
    expect(setRes.success).toBe(true);
    const setPayload = setRes.payload as { key: string; value: unknown };
    expect(setPayload.key).toBe('model.id');
    expect(setPayload.value).toBe('claude-opus-4-5');

    // Get the config value back
    const getReq = createRequest('core', 'config.get', { key: 'model.id' });
    const getRes = await sendAndWait(ws, getReq);
    expect(getRes.success).toBe(true);
    const getPayload = getRes.payload as { key: string; value: unknown };
    expect(getPayload.value).toBe('claude-opus-4-5');
  });

  it('should list config values with prefix filter', async () => {
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForOpen(ws);

    // Set multiple config values
    await sendAndWait(
      ws,
      createRequest('core', 'config.set', { key: 'model.id', value: 'claude-sonnet-4-5' }),
    );
    await sendAndWait(
      ws,
      createRequest('core', 'config.set', { key: 'model.maxTokens', value: 4096 }),
    );
    await sendAndWait(
      ws,
      createRequest('core', 'config.set', { key: 'general.theme', value: 'dark' }),
    );

    // List all
    const allReq = createRequest('core', 'config.list', {});
    const allRes = await sendAndWait(ws, allReq);
    expect(allRes.success).toBe(true);
    const allPayload = allRes.payload as { settings: Record<string, unknown> };
    expect(Object.keys(allPayload.settings).length).toBeGreaterThanOrEqual(3);

    // List with prefix
    const prefixReq = createRequest('core', 'config.list', { prefix: 'model.' });
    const prefixRes = await sendAndWait(ws, prefixReq);
    expect(prefixRes.success).toBe(true);
    const prefixPayload = prefixRes.payload as { settings: Record<string, unknown> };
    expect(prefixPayload.settings['model.id']).toBe('claude-sonnet-4-5');
    expect(prefixPayload.settings['model.maxTokens']).toBe(4096);
    expect(prefixPayload.settings['general.theme']).toBeUndefined();
  });

  it('should mask API key in config responses', async () => {
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForOpen(ws);

    // Set an API key
    await sendAndWait(
      ws,
      createRequest('core', 'config.set', {
        key: 'model.apiKey',
        value: 'sk-ant-api03-realkey1234',
      }),
    );

    // Get should return masked value
    const getRes = await sendAndWait(
      ws,
      createRequest('core', 'config.get', { key: 'model.apiKey' }),
    );
    expect(getRes.success).toBe(true);
    const payload = getRes.payload as { key: string; value: string };
    expect(payload.value).toMatch(/^••••/);
    expect(payload.value).toContain('1234');
    expect(payload.value).not.toContain('realkey');

    // List should also mask it
    const listRes = await sendAndWait(
      ws,
      createRequest('core', 'config.list', { prefix: 'model.' }),
    );
    const listPayload = listRes.payload as { settings: Record<string, unknown> };
    expect(listPayload.settings['model.apiKey']).toMatch(/^••••/);
  });

  it('should return error for unknown actions', async () => {
    ws = new WebSocket(`ws://127.0.0.1:${port}`);
    await waitForOpen(ws);

    const msg = {
      id: 'test-id',
      type: 'request',
      namespace: 'core',
      action: 'nonexistent',
      payload: {},
      timestamp: new Date().toISOString(),
    };
    const response = await sendAndWait(ws, msg);
    expect(response.success).toBe(false);
  });
});
