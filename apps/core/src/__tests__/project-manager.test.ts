import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase, createMockEmitter } from './helpers.js';
import { ProjectManager } from '../managers/project-manager.js';
import type { CoreDatabase } from '../database.js';

describe('ProjectManager', () => {
  let db: CoreDatabase;
  let emitter: ReturnType<typeof createMockEmitter>;
  let manager: ProjectManager;

  beforeEach(() => {
    db = createTestDatabase();
    emitter = createMockEmitter();
    manager = new ProjectManager(db, emitter);
  });

  afterEach(() => {
    db.close();
  });

  it('should add a project', () => {
    const project = manager.addProject('MyProject', '/tmp/myproject');
    expect(project.id).toMatch(/^proj_/);
    expect(project.name).toBe('MyProject');
    expect(project.path).toBe('/tmp/myproject');
    expect(project.workspaces).toEqual([]);
  });

  it('should emit project:created event', () => {
    manager.addProject('Test', '/tmp');
    const created = emitter.emitted.find((e) => e.event === 'project:created');
    expect(created).toBeDefined();
  });

  it('should get a project by id', () => {
    const project = manager.addProject('Test', '/tmp');
    const retrieved = manager.getProject(project.id);
    expect(retrieved).toBeDefined();
    expect(retrieved!.id).toBe(project.id);
  });

  it('should return undefined for unknown project', () => {
    expect(manager.getProject('proj_nonexistent')).toBeUndefined();
  });

  it('should list all projects', () => {
    manager.addProject('A', '/a');
    manager.addProject('B', '/b');
    const list = manager.listProjects();
    expect(list).toHaveLength(2);
  });

  it('should remove a project', () => {
    const project = manager.addProject('Test', '/tmp');
    const removed = manager.removeProject(project.id);
    expect(removed).toBe(true);
    expect(manager.getProject(project.id)).toBeUndefined();
  });

  it('should emit project:deleted event', () => {
    const project = manager.addProject('Test', '/tmp');
    manager.removeProject(project.id);
    const deleted = emitter.emitted.find((e) => e.event === 'project:deleted');
    expect(deleted).toBeDefined();
  });

  it('should return false when removing non-existent project', () => {
    expect(manager.removeProject('proj_nope')).toBe(false);
  });
});
