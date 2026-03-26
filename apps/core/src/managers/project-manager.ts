import type { ProjectInfo } from '@condrix/protocol';
import { generateId } from '@condrix/protocol';
import type { EventEmitter } from 'node:events';

import type { CoreDatabase } from '../database.js';

/**
 * Maintains the registry of projects.
 * Projects can be added/removed dynamically without restarting the Core.
 */
export class ProjectManager {
  constructor(
    private db: CoreDatabase,
    private emitter: EventEmitter,
  ) {}

  addProject(name: string, path: string, url?: string): ProjectInfo {
    // Duplicate check: reject if a project with the same path or URL already exists
    if (path) {
      const existing = this.db.findProjectByPath(path);
      if (existing) {
        throw new Error(`A project with this path already exists: "${existing.name}"`);
      }
    }
    if (url) {
      const existing = this.db.findProjectByUrl(url);
      if (existing) {
        throw new Error(`A project with this URL already exists: "${existing.name}"`);
      }
    }

    const id = generateId('proj');
    this.db.insertProject(id, name, path, url);
    const project = this.db.getProject(id)!;
    this.emitter.emit('project:created', project);
    return project;
  }

  updateProjectPath(id: string, path: string): void {
    this.db.updateProjectPath(id, path);
  }

  getProject(id: string): ProjectInfo | undefined {
    return this.db.getProject(id);
  }

  listProjects(): ProjectInfo[] {
    return this.db.listProjects();
  }

  removeProject(id: string): boolean {
    const deleted = this.db.deleteProject(id);
    if (deleted) {
      this.emitter.emit('project:deleted', { projectId: id });
    }
    return deleted;
  }
}
