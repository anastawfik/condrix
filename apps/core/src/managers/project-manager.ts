import type { ProjectInfo } from '@nexus-core/protocol';
import { generateId } from '@nexus-core/protocol';
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

  addProject(name: string, path: string): ProjectInfo {
    const id = generateId('proj');
    this.db.insertProject(id, name, path);
    const project = this.db.getProject(id)!;
    this.emitter.emit('project:created', project);
    return project;
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
