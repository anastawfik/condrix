import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, createMockEmitter } from './helpers.js';
import { WorkspaceManager } from '../managers/workspace-manager.js';
import type { CoreDatabase } from '../database.js';

describe('WorkspaceManager', () => {
  let db: CoreDatabase;
  let emitter: ReturnType<typeof createMockEmitter>;
  let manager: WorkspaceManager;

  beforeEach(() => {
    db = createTestDatabase();
    emitter = createMockEmitter();
    manager = new WorkspaceManager(db, emitter);
    // Create parent project
    db.insertProject('proj_1', 'TestProject', '/tmp/test');
  });

  afterEach(() => {
    db.close();
  });

  it('should create a workspace in IDLE state', () => {
    const ws = manager.createWorkspace('proj_1', 'Main');
    expect(ws.id).toMatch(/^ws_/);
    expect(ws.projectId).toBe('proj_1');
    expect(ws.state).toBe('IDLE');
  });

  it('should emit workspace:created event', () => {
    manager.createWorkspace('proj_1', 'Main');
    const created = emitter.emitted.find((e) => e.event === 'workspace:created');
    expect(created).toBeDefined();
  });

  it('should list workspaces by project', () => {
    manager.createWorkspace('proj_1', 'A');
    manager.createWorkspace('proj_1', 'B');
    const list = manager.listWorkspaces('proj_1');
    expect(list).toHaveLength(2);
  });

  it('should allow valid state transitions', () => {
    const ws = manager.createWorkspace('proj_1', 'Main');
    // IDLE → ACTIVE
    const active = manager.transitionState(ws.id, 'ACTIVE');
    expect(active.state).toBe('ACTIVE');
    // ACTIVE → WAITING
    const waiting = manager.transitionState(ws.id, 'WAITING');
    expect(waiting.state).toBe('WAITING');
    // WAITING → ACTIVE
    const active2 = manager.transitionState(ws.id, 'ACTIVE');
    expect(active2.state).toBe('ACTIVE');
  });

  it('should reject invalid state transitions', () => {
    const ws = manager.createWorkspace('proj_1', 'Main');
    // IDLE → WAITING is not valid
    expect(() => manager.transitionState(ws.id, 'WAITING')).toThrow('Invalid transition');
  });

  it('should emit workspace:stateChanged event', () => {
    const ws = manager.createWorkspace('proj_1', 'Main');
    manager.transitionState(ws.id, 'ACTIVE');
    const changed = emitter.emitted.find((e) => e.event === 'workspace:stateChanged');
    expect(changed).toBeDefined();
    expect((changed!.args[0] as Record<string, unknown>).previousState).toBe('IDLE');
    expect((changed!.args[0] as Record<string, unknown>).newState).toBe('ACTIVE');
  });

  it('should throw when transitioning non-existent workspace', () => {
    expect(() => manager.transitionState('ws_nope', 'ACTIVE')).toThrow('not found');
  });

  it('should destroy a workspace', () => {
    const ws = manager.createWorkspace('proj_1', 'Main');
    const destroyed = manager.destroyWorkspace(ws.id);
    expect(destroyed).toBe(true);
    expect(manager.getWorkspace(ws.id)).toBeUndefined();
  });

  it('should emit workspace:destroyed event', () => {
    const ws = manager.createWorkspace('proj_1', 'Main');
    manager.destroyWorkspace(ws.id);
    const destroyedEvent = emitter.emitted.find((e) => e.event === 'workspace:destroyed');
    expect(destroyedEvent).toBeDefined();
  });

  it('should handle optional branch and provider', () => {
    const ws = manager.createWorkspace('proj_1', 'Main', 'feature/x', 'claude');
    expect(ws.branch).toBe('feature/x');
    expect(ws.agentProvider).toBe('claude');
  });

  it('should support IDLE → SUSPENDED → IDLE cycle', () => {
    const ws = manager.createWorkspace('proj_1', 'Main');
    manager.transitionState(ws.id, 'SUSPENDED');
    const resumed = manager.transitionState(ws.id, 'IDLE');
    expect(resumed.state).toBe('IDLE');
  });
});
