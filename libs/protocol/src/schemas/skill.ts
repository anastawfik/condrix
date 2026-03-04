/**
 * Skill and MCP server configuration schemas.
 */
import { z } from 'zod';

export const SkillDefinitionSchema = z.object({
  name: z.string(),
  version: z.string(),
  description: z.string(),
  systemPromptFile: z.string(),
  tools: z.array(z.string()),
  mcpServers: z.array(z.string()).optional(),
  config: z.record(z.unknown()).optional(),
});

export const McpServerConfigSchema = z.object({
  name: z.string(),
  command: z.string(),
  args: z.array(z.string()).optional(),
  env: z.record(z.string()).optional(),
  scope: z.enum(['global', 'project', 'workspace']),
});
