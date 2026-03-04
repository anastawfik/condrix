import type { ProjectInfo } from '@nexus-core/protocol';

/**
 * Maintains the registry of projects.
 * Projects can be added/removed dynamically without restarting the Core.
 */
export class ProjectManager {
  private projects = new Map<string, ProjectInfo>();

  async addProject(name: string, path: string): Promise<ProjectInfo> {
    const project: ProjectInfo = {
      id: `proj_${Date.now()}`,
      name,
      path,
      workspaces: [],
    };
    this.projects.set(project.id, project);
    return project;
  }

  getProject(id: string): ProjectInfo | undefined {
    return this.projects.get(id);
  }

  listProjects(): ProjectInfo[] {
    return Array.from(this.projects.values());
  }

  removeProject(id: string): boolean {
    return this.projects.delete(id);
  }
}
