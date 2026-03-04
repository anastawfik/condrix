import { describe, expect, it } from 'vitest';

import {
  MessageEnvelopeSchema,
  RequestEnvelopeSchema,
  ResponseEnvelopeSchema,
  EventEnvelopeSchema,
  StreamChunkSchema,
  StreamEndSchema,
  CoreInfoSchema,
  ProjectInfoSchema,
  WorkspaceInfoSchema,
  AgentMessageSchema,
  AgentToolCallSchema,
  TerminalInfoSchema,
  FileEntrySchema,
  FileChangeSchema,
  GitStatusEntrySchema,
  GitBranchInfoSchema,
  NotificationSchema,
  SkillDefinitionSchema,
  McpServerConfigSchema,
  ErrorPayloadSchema,
  AuthTokenSchema,
} from '../schemas/index.js';

// ─── MessageEnvelope ────────────────────────────────────────────────────────

describe('MessageEnvelopeSchema', () => {
  const validEnvelope = {
    id: 'msg_123',
    type: 'request',
    namespace: 'core',
    action: 'info',
    payload: {},
    timestamp: '2025-01-01T00:00:00.000Z',
  };

  it('parses a valid envelope', () => {
    const result = MessageEnvelopeSchema.safeParse(validEnvelope);
    expect(result.success).toBe(true);
  });

  it('accepts optional fields', () => {
    const result = MessageEnvelopeSchema.safeParse({
      ...validEnvelope,
      workspaceId: 'ws_1',
      correlationId: 'corr_1',
    });
    expect(result.success).toBe(true);
  });

  it('rejects missing id', () => {
    const { id: _, ...without } = validEnvelope;
    const result = MessageEnvelopeSchema.safeParse(without);
    expect(result.success).toBe(false);
  });

  it('rejects invalid type', () => {
    const result = MessageEnvelopeSchema.safeParse({ ...validEnvelope, type: 'invalid' });
    expect(result.success).toBe(false);
  });

  it('rejects invalid namespace', () => {
    const result = MessageEnvelopeSchema.safeParse({ ...validEnvelope, namespace: 'bad' });
    expect(result.success).toBe(false);
  });

  it('rejects empty action', () => {
    const result = MessageEnvelopeSchema.safeParse({ ...validEnvelope, action: '' });
    expect(result.success).toBe(false);
  });
});

// ─── Typed Envelopes ────────────────────────────────────────────────────────

describe('RequestEnvelopeSchema', () => {
  it('requires type=request', () => {
    const result = RequestEnvelopeSchema.safeParse({
      id: 'msg_1',
      type: 'request',
      namespace: 'core',
      action: 'info',
      payload: {},
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects type=response', () => {
    const result = RequestEnvelopeSchema.safeParse({
      id: 'msg_1',
      type: 'response',
      namespace: 'core',
      action: 'info',
      payload: {},
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});

describe('ResponseEnvelopeSchema', () => {
  it('parses a valid response', () => {
    const result = ResponseEnvelopeSchema.safeParse({
      id: 'msg_1',
      type: 'response',
      namespace: 'core',
      action: 'info',
      payload: {},
      timestamp: new Date().toISOString(),
      success: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts error field', () => {
    const result = ResponseEnvelopeSchema.safeParse({
      id: 'msg_1',
      type: 'response',
      namespace: 'core',
      action: 'info',
      payload: {},
      timestamp: new Date().toISOString(),
      success: false,
      error: { code: 'NOT_FOUND', message: 'Not found' },
    });
    expect(result.success).toBe(true);
  });
});

describe('EventEnvelopeSchema', () => {
  it('requires type=event', () => {
    const result = EventEnvelopeSchema.safeParse({
      id: 'msg_1',
      type: 'event',
      namespace: 'project',
      action: 'created',
      payload: {},
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });
});

describe('StreamChunkSchema', () => {
  it('parses a valid stream chunk', () => {
    const result = StreamChunkSchema.safeParse({
      id: 'msg_1',
      type: 'stream',
      namespace: 'agent',
      action: 'chunk',
      payload: { content: 'Hello', index: 0 },
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects negative index', () => {
    const result = StreamChunkSchema.safeParse({
      id: 'msg_1',
      type: 'stream',
      namespace: 'agent',
      action: 'chunk',
      payload: { content: 'Hello', index: -1 },
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});

describe('StreamEndSchema', () => {
  it('parses with optional finalContent', () => {
    const result = StreamEndSchema.safeParse({
      id: 'msg_1',
      type: 'stream',
      namespace: 'agent',
      action: 'end',
      payload: { totalChunks: 5, finalContent: 'Done' },
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });
});

describe('ErrorPayloadSchema', () => {
  it('parses a valid error', () => {
    const result = ErrorPayloadSchema.safeParse({
      code: 'ERR_001',
      message: 'Something went wrong',
    });
    expect(result.success).toBe(true);
  });
});

// ─── Domain Schemas ─────────────────────────────────────────────────────────

describe('CoreInfoSchema', () => {
  it('parses valid core info', () => {
    const result = CoreInfoSchema.safeParse({
      coreId: 'core_1',
      displayName: 'My Core',
      host: 'localhost',
      port: 9100,
      status: 'online',
      lastHeartbeat: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid status', () => {
    const result = CoreInfoSchema.safeParse({
      coreId: 'core_1',
      displayName: 'My Core',
      host: 'localhost',
      port: 9100,
      status: 'unknown',
      lastHeartbeat: new Date().toISOString(),
    });
    expect(result.success).toBe(false);
  });
});

describe('ProjectInfoSchema', () => {
  it('parses valid project with workspaces', () => {
    const result = ProjectInfoSchema.safeParse({
      id: 'proj_1',
      name: 'Test Project',
      path: '/home/user/project',
      workspaces: [
        {
          id: 'ws_1',
          projectId: 'proj_1',
          name: 'main',
          state: 'IDLE',
        },
      ],
    });
    expect(result.success).toBe(true);
  });
});

describe('WorkspaceInfoSchema', () => {
  it('parses with optional fields', () => {
    const result = WorkspaceInfoSchema.safeParse({
      id: 'ws_1',
      projectId: 'proj_1',
      name: 'dev',
      state: 'ACTIVE',
      branch: 'main',
      agentProvider: 'claude',
    });
    expect(result.success).toBe(true);
  });

  it('rejects invalid state', () => {
    const result = WorkspaceInfoSchema.safeParse({
      id: 'ws_1',
      projectId: 'proj_1',
      name: 'dev',
      state: 'INVALID',
    });
    expect(result.success).toBe(false);
  });
});

describe('AgentMessageSchema', () => {
  it('parses valid agent message', () => {
    const result = AgentMessageSchema.safeParse({
      role: 'assistant',
      content: 'Hello!',
      timestamp: new Date().toISOString(),
    });
    expect(result.success).toBe(true);
  });
});

describe('AgentToolCallSchema', () => {
  it('parses valid tool call', () => {
    const result = AgentToolCallSchema.safeParse({
      id: 'tc_1',
      name: 'readFile',
      arguments: { path: '/test.ts' },
      status: 'pending',
    });
    expect(result.success).toBe(true);
  });
});

describe('TerminalInfoSchema', () => {
  it('parses valid terminal', () => {
    const result = TerminalInfoSchema.safeParse({
      id: 'term_1',
      workspaceId: 'ws_1',
      shell: '/bin/bash',
      cols: 80,
      rows: 24,
      pid: 1234,
    });
    expect(result.success).toBe(true);
  });
});

describe('FileEntrySchema', () => {
  it('parses valid file entry', () => {
    const result = FileEntrySchema.safeParse({
      path: '/src/index.ts',
      name: 'index.ts',
      type: 'file',
      size: 1024,
    });
    expect(result.success).toBe(true);
  });
});

describe('FileChangeSchema', () => {
  it('parses rename with oldPath', () => {
    const result = FileChangeSchema.safeParse({
      path: '/src/new.ts',
      type: 'renamed',
      oldPath: '/src/old.ts',
    });
    expect(result.success).toBe(true);
  });
});

describe('GitStatusEntrySchema', () => {
  it('parses valid git status', () => {
    const result = GitStatusEntrySchema.safeParse({
      path: 'src/index.ts',
      status: 'modified',
      staged: true,
    });
    expect(result.success).toBe(true);
  });
});

describe('GitBranchInfoSchema', () => {
  it('parses valid branch info', () => {
    const result = GitBranchInfoSchema.safeParse({
      name: 'main',
      current: true,
      remote: 'origin/main',
      ahead: 0,
      behind: 2,
    });
    expect(result.success).toBe(true);
  });
});

describe('NotificationSchema', () => {
  it('parses valid notification', () => {
    const result = NotificationSchema.safeParse({
      id: 'notif_1',
      workspaceId: 'ws_1',
      type: 'waiting',
      message: 'Awaiting approval',
      channel: 'telegram',
      status: 'pending',
    });
    expect(result.success).toBe(true);
  });
});

describe('AuthTokenSchema', () => {
  it('parses valid auth token', () => {
    const result = AuthTokenSchema.safeParse({
      token: 'abc123',
      scopes: ['read:files', 'chat:agent'],
    });
    expect(result.success).toBe(true);
  });
});

describe('SkillDefinitionSchema', () => {
  it('parses valid skill', () => {
    const result = SkillDefinitionSchema.safeParse({
      name: 'code-review',
      version: '1.0.0',
      description: 'Reviews code',
      systemPromptFile: 'prompts/review.md',
      tools: ['readFile', 'writeFile'],
    });
    expect(result.success).toBe(true);
  });
});

describe('McpServerConfigSchema', () => {
  it('parses valid MCP config', () => {
    const result = McpServerConfigSchema.safeParse({
      name: 'my-server',
      command: 'npx',
      args: ['-y', '@mcp/server'],
      env: { API_KEY: 'test' },
      scope: 'project',
    });
    expect(result.success).toBe(true);
  });
});
