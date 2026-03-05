import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { WebSocket } from 'ws';
import { CoreRuntime } from '../runtime.js';
import { createRequest } from '@nexus-core/protocol';

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
