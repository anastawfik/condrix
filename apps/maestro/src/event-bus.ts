import { EventEmitter } from 'node:events';
import type { MessageEnvelope } from '@nexus-core/protocol';

/**
 * Internal event bus for Maestro.
 * All Core connections feed events into this bus, and Maestro subsystems
 * subscribe to relevant event patterns.
 */
export class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100);
  }

  publish(event: MessageEnvelope): void {
    this.emitter.emit(event.namespace, event);
    this.emitter.emit('*', event);
  }

  subscribe(namespace: string, handler: (event: MessageEnvelope) => void): () => void {
    this.emitter.on(namespace, handler);
    return () => this.emitter.off(namespace, handler);
  }

  subscribeAll(handler: (event: MessageEnvelope) => void): () => void {
    this.emitter.on('*', handler);
    return () => this.emitter.off('*', handler);
  }
}
