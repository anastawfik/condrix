/**
 * Test utilities for Core daemon tests.
 */
import { EventEmitter } from 'node:events';
import { CoreDatabase } from '../database.js';

/** Create an in-memory SQLite database for testing. */
export function createTestDatabase(): CoreDatabase {
  return new CoreDatabase({ path: ':memory:' });
}

/** Create a mock event emitter that records emitted events. */
export function createMockEmitter(): EventEmitter & {
  emitted: { event: string; args: unknown[] }[];
} {
  const emitter = new EventEmitter() as EventEmitter & {
    emitted: { event: string; args: unknown[] }[];
  };
  emitter.emitted = [];

  const origEmit = emitter.emit.bind(emitter);
  emitter.emit = (event: string, ...args: unknown[]) => {
    emitter.emitted.push({ event, args });
    return origEmit(event, ...args);
  };

  return emitter;
}
