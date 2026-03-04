/**
 * @nexus-core/mcp-configs
 *
 * Pre-configured MCP (Model Context Protocol) server definitions.
 * MCP servers extend agent capabilities by providing tools, resources,
 * and prompts through a standardized interface.
 */

import type { McpServerConfig } from '@nexus-core/protocol';

export const builtinMcpServers: McpServerConfig[] = [
  {
    name: 'filesystem',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-filesystem'],
    scope: 'project',
  },
  {
    name: 'git',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-git'],
    scope: 'project',
  },
  {
    name: 'sqlite',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-sqlite'],
    scope: 'workspace',
  },
  {
    name: 'puppeteer',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-puppeteer'],
    scope: 'workspace',
  },
  {
    name: 'memory',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-memory'],
    scope: 'global',
  },
  {
    name: 'brave-search',
    command: 'npx',
    args: ['-y', '@modelcontextprotocol/server-brave-search'],
    env: { BRAVE_API_KEY: '' },
    scope: 'global',
  },
];

export function getMcpServer(name: string): McpServerConfig | undefined {
  return builtinMcpServers.find((s) => s.name === name);
}

export function listMcpServers(scope?: McpServerConfig['scope']): McpServerConfig[] {
  if (scope) return builtinMcpServers.filter((s) => s.scope === scope);
  return [...builtinMcpServers];
}
