import { describe, expect, it } from 'vitest';

import {
  createRequest,
  createResponse,
  createEvent,
  createStreamChunk,
  createStreamEnd,
} from '../helpers/message-factory.js';

import {
  RequestEnvelopeSchema,
  ResponseEnvelopeSchema,
  EventEnvelopeSchema,
  StreamChunkSchema,
  StreamEndSchema,
} from '../schemas/envelope.js';

describe('createRequest', () => {
  it('creates a valid request envelope', () => {
    const req = createRequest('core', 'info', {});
    expect(req.type).toBe('request');
    expect(req.namespace).toBe('core');
    expect(req.action).toBe('info');
    expect(req.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
    expect(req.timestamp).toBeDefined();
  });

  it('validates against RequestEnvelopeSchema', () => {
    const req = createRequest('project', 'create', { name: 'Test', path: '/test' });
    const result = RequestEnvelopeSchema.safeParse(req);
    expect(result.success).toBe(true);
  });

  it('includes optional fields', () => {
    const req = createRequest('workspace', 'enter', { workspaceId: 'ws_1' }, {
      workspaceId: 'ws_1',
      correlationId: 'corr_1',
    });
    expect(req.workspaceId).toBe('ws_1');
    expect(req.correlationId).toBe('corr_1');
  });
});

describe('createResponse', () => {
  it('creates a valid response envelope', () => {
    const res = createResponse('core', 'info', {
      coreId: 'c_1',
      displayName: 'Test',
      host: 'localhost',
      port: 9100,
      status: 'online',
      lastHeartbeat: new Date().toISOString(),
    }, { correlationId: 'corr_1' });
    expect(res.type).toBe('response');
    expect(res.success).toBe(true);
    expect(res.correlationId).toBe('corr_1');
  });

  it('validates against ResponseEnvelopeSchema', () => {
    const res = createResponse('core', 'health', {
      healthy: true,
      uptime: 1000,
      memoryUsage: 50,
      activeWorkspaces: 2,
    }, { correlationId: 'corr_1' });
    const result = ResponseEnvelopeSchema.safeParse(res);
    expect(result.success).toBe(true);
  });

  it('can create error responses', () => {
    const res = createResponse('core', 'info', {} as any, {
      correlationId: 'corr_1',
      success: false,
      error: { code: 'NOT_FOUND', message: 'Core not found' },
    });
    expect(res.success).toBe(false);
    expect(res.error?.code).toBe('NOT_FOUND');
  });
});

describe('createEvent', () => {
  it('creates a valid event envelope', () => {
    const evt = createEvent('project', 'created', {
      id: 'proj_1',
      name: 'Test',
      path: '/test',
      workspaces: [],
    });
    expect(evt.type).toBe('event');
    expect(evt.namespace).toBe('project');
    expect(evt.action).toBe('created');
  });

  it('validates against EventEnvelopeSchema', () => {
    const evt = createEvent('workspace', 'stateChanged', {
      workspaceId: 'ws_1',
      previousState: 'IDLE',
      newState: 'ACTIVE',
    });
    const result = EventEnvelopeSchema.safeParse(evt);
    expect(result.success).toBe(true);
  });
});

describe('createStreamChunk', () => {
  it('creates a valid stream chunk', () => {
    const chunk = createStreamChunk('agent', 'Hello', 0);
    expect(chunk.type).toBe('stream');
    expect(chunk.action).toBe('chunk');
    expect(chunk.payload.content).toBe('Hello');
    expect(chunk.payload.index).toBe(0);
  });

  it('validates against StreamChunkSchema', () => {
    const chunk = createStreamChunk('agent', 'World', 1, { correlationId: 'c_1' });
    const result = StreamChunkSchema.safeParse(chunk);
    expect(result.success).toBe(true);
  });
});

describe('createStreamEnd', () => {
  it('creates a valid stream end', () => {
    const end = createStreamEnd('agent', 5);
    expect(end.type).toBe('stream');
    expect(end.action).toBe('end');
    expect(end.payload.totalChunks).toBe(5);
  });

  it('includes optional finalContent', () => {
    const end = createStreamEnd('agent', 3, { finalContent: 'Done' });
    expect(end.payload.finalContent).toBe('Done');
  });

  it('validates against StreamEndSchema', () => {
    const end = createStreamEnd('agent', 10, { correlationId: 'c_1' });
    const result = StreamEndSchema.safeParse(end);
    expect(result.success).toBe(true);
  });
});
