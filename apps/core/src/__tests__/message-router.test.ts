import { describe, it, expect } from 'vitest';
import { MessageRouter } from '../message-router.js';
import { createRequest } from '@nexus-core/protocol';

describe('MessageRouter', () => {
  it('should register and dispatch a handler', async () => {
    const router = new MessageRouter();
    router.register('core', 'info', async () => ({ coreId: 'test' }));

    const request = createRequest('core', 'info', {});
    let response: Record<string, unknown> | null = null;

    await router.dispatch(JSON.stringify(request), (r) => {
      response = r as Record<string, unknown>;
    });

    expect(response).not.toBeNull();
    expect(response!.success).toBe(true);
    expect(response!.correlationId).toBe(request.id);
    expect((response!.payload as Record<string, unknown>).coreId).toBe('test');
  });

  it('should return error for unknown action', async () => {
    const router = new MessageRouter();
    const request = createRequest('core', 'info', {});
    let response: Record<string, unknown> | null = null;

    await router.dispatch(JSON.stringify(request), (r) => {
      response = r as Record<string, unknown>;
    });

    expect(response!.success).toBe(false);
    const error = response!.error as { code: string; message: string };
    expect(error.code).toBe('UNKNOWN_ACTION');
  });

  it('should return error for invalid JSON', async () => {
    const router = new MessageRouter();
    let response: Record<string, unknown> | null = null;

    await router.dispatch('not json at all', (r) => {
      response = r as Record<string, unknown>;
    });

    expect(response!.success).toBe(false);
    const error = response!.error as { code: string };
    expect(error.code).toBe('INVALID_MESSAGE');
  });

  it('should catch handler errors and return error response', async () => {
    const router = new MessageRouter();
    router.register('core', 'info', async () => {
      throw new Error('Something broke');
    });

    const request = createRequest('core', 'info', {});
    let response: Record<string, unknown> | null = null;

    await router.dispatch(JSON.stringify(request), (r) => {
      response = r as Record<string, unknown>;
    });

    expect(response!.success).toBe(false);
    const error = response!.error as { code: string; message: string };
    expect(error.code).toBe('HANDLER_ERROR');
    expect(error.message).toBe('Something broke');
  });

  it('should report registered routes', () => {
    const router = new MessageRouter();
    expect(router.has('core', 'info')).toBe(false);
    router.register('core', 'info', async () => ({}));
    expect(router.has('core', 'info')).toBe(true);
  });

  it('should ignore non-request messages', async () => {
    const router = new MessageRouter();
    let called = false;
    router.register('core', 'info', async () => {
      called = true;
      return {};
    });

    // Send an event (not a request)
    const event = {
      id: 'test',
      type: 'event',
      namespace: 'core',
      action: 'info',
      payload: {},
      timestamp: new Date().toISOString(),
    };

    await router.dispatch(JSON.stringify(event), () => {});
    expect(called).toBe(false);
  });
});
