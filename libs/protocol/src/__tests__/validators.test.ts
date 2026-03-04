import { describe, expect, it } from 'vitest';

import {
  validateMessage,
  parseMessage,
  safeParseMessage,
  isRequest,
  isResponse,
  isEvent,
  isStream,
  isStreamChunk,
  isStreamEnd,
} from '../helpers/validators.js';

const validRequest = {
  id: 'msg_1',
  type: 'request' as const,
  namespace: 'core' as const,
  action: 'info',
  payload: {},
  timestamp: '2025-01-01T00:00:00.000Z',
};

const validResponse = {
  ...validRequest,
  type: 'response' as const,
  success: true,
};

const validEvent = {
  ...validRequest,
  type: 'event' as const,
  action: 'connected',
};

const validStreamChunk = {
  id: 'msg_2',
  type: 'stream' as const,
  namespace: 'agent' as const,
  action: 'chunk',
  payload: { content: 'Hello', index: 0 },
  timestamp: '2025-01-01T00:00:00.000Z',
};

const validStreamEnd = {
  id: 'msg_3',
  type: 'stream' as const,
  namespace: 'agent' as const,
  action: 'end',
  payload: { totalChunks: 5 },
  timestamp: '2025-01-01T00:00:00.000Z',
};

describe('validateMessage', () => {
  it('parses a valid object', () => {
    const result = validateMessage(validRequest);
    expect(result.id).toBe('msg_1');
  });

  it('parses a valid JSON string', () => {
    const result = validateMessage(JSON.stringify(validRequest));
    expect(result.id).toBe('msg_1');
  });

  it('throws on invalid input', () => {
    expect(() => validateMessage({ id: 'msg_1' })).toThrow();
  });

  it('throws on invalid JSON string', () => {
    expect(() => validateMessage('not json')).toThrow();
  });
});

describe('parseMessage', () => {
  it('is an alias for validateMessage', () => {
    const result = parseMessage(validRequest);
    expect(result.id).toBe('msg_1');
  });
});

describe('safeParseMessage', () => {
  it('returns success for valid input', () => {
    const result = safeParseMessage(validRequest);
    expect(result.success).toBe(true);
  });

  it('returns failure for invalid input', () => {
    const result = safeParseMessage({ id: 'msg_1' });
    expect(result.success).toBe(false);
  });

  it('returns failure for invalid JSON', () => {
    const result = safeParseMessage('not json');
    expect(result.success).toBe(false);
  });

  it('parses JSON strings', () => {
    const result = safeParseMessage(JSON.stringify(validRequest));
    expect(result.success).toBe(true);
  });
});

describe('type guards', () => {
  it('isRequest identifies requests', () => {
    expect(isRequest(validRequest)).toBe(true);
    expect(isRequest(validResponse)).toBe(false);
    expect(isRequest(validEvent)).toBe(false);
  });

  it('isResponse identifies responses', () => {
    expect(isResponse(validResponse)).toBe(true);
    expect(isResponse(validRequest)).toBe(false);
  });

  it('isEvent identifies events', () => {
    expect(isEvent(validEvent)).toBe(true);
    expect(isEvent(validRequest)).toBe(false);
  });

  it('isStream identifies stream messages', () => {
    expect(isStream(validStreamChunk)).toBe(true);
    expect(isStream(validStreamEnd)).toBe(true);
    expect(isStream(validRequest)).toBe(false);
  });

  it('isStreamChunk identifies chunks', () => {
    expect(isStreamChunk(validStreamChunk)).toBe(true);
    expect(isStreamChunk(validStreamEnd)).toBe(false);
  });

  it('isStreamEnd identifies end', () => {
    expect(isStreamEnd(validStreamEnd)).toBe(true);
    expect(isStreamEnd(validStreamChunk)).toBe(false);
  });
});
