/**
 * @nexus-core/skills
 *
 * Built-in skill definitions for NexusCore agents.
 * Skills are composable capability packages that equip agents
 * with domain-specific knowledge and tools.
 *
 * Categories:
 * - Language: TypeScript, Python, Rust, Go, Java
 * - Framework: React, Next.js, FastAPI, Express, Django
 * - Infrastructure: Docker, Kubernetes, Terraform, CI/CD
 * - Analysis: Code review, security audit, performance profiling
 * - Documentation: README generation, API docs, ADRs
 */

import type { SkillDefinition } from '@nexus-core/protocol';

export const builtinSkills: SkillDefinition[] = [
  {
    name: 'typescript-expert',
    version: '1.0.0',
    description: 'Deep TypeScript expertise with type-level programming',
    systemPromptFile: './prompts/typescript-expert.md',
    tools: ['file_read', 'file_write', 'terminal_exec', 'type_check'],
    mcpServers: ['typescript-language-server'],
    config: { strictMode: true, targetVersion: '5.7' },
  },
  {
    name: 'react-specialist',
    version: '1.0.0',
    description: 'React 19 expertise with modern patterns and hooks',
    systemPromptFile: './prompts/react-specialist.md',
    tools: ['file_read', 'file_write', 'terminal_exec', 'browser_preview'],
    config: { reactVersion: '19' },
  },
  {
    name: 'node-backend',
    version: '1.0.0',
    description: 'Node.js backend development with performance focus',
    systemPromptFile: './prompts/node-backend.md',
    tools: ['file_read', 'file_write', 'terminal_exec', 'database_query'],
    config: { nodeVersion: '22' },
  },
  {
    name: 'code-reviewer',
    version: '1.0.0',
    description: 'Thorough code review with security and performance analysis',
    systemPromptFile: './prompts/code-reviewer.md',
    tools: ['file_read', 'git_diff', 'search'],
  },
  {
    name: 'devops',
    version: '1.0.0',
    description: 'Docker, CI/CD, and infrastructure-as-code expertise',
    systemPromptFile: './prompts/devops.md',
    tools: ['file_read', 'file_write', 'terminal_exec'],
    config: { containerRuntime: 'docker' },
  },
];

export function getSkill(name: string): SkillDefinition | undefined {
  return builtinSkills.find((s) => s.name === name);
}

export function listSkills(): SkillDefinition[] {
  return [...builtinSkills];
}
