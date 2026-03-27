import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { createTestDatabase } from './helpers.js';
import type { CoreDatabase } from '../database.js';

describe('CoreDatabase', () => {
  let db: CoreDatabase;

  beforeEach(() => {
    db = createTestDatabase();
  });

  afterEach(() => {
    db.close();
  });

  describe('projects', () => {
    it('should insert and retrieve a project', () => {
      db.insertProject('proj_1', 'TestProject', '/tmp/test');
      const project = db.getProject('proj_1');
      expect(project).toBeDefined();
      expect(project!.id).toBe('proj_1');
      expect(project!.name).toBe('TestProject');
      expect(project!.path).toBe('/tmp/test');
      expect(project!.workspaces).toEqual([]);
    });

    it('should list all projects', () => {
      db.insertProject('proj_1', 'A', '/a');
      db.insertProject('proj_2', 'B', '/b');
      const projects = db.listProjects();
      expect(projects).toHaveLength(2);
    });

    it('should delete a project', () => {
      db.insertProject('proj_1', 'A', '/a');
      const deleted = db.deleteProject('proj_1');
      expect(deleted).toBe(true);
      expect(db.getProject('proj_1')).toBeUndefined();
    });

    it('should return false when deleting non-existent project', () => {
      const deleted = db.deleteProject('proj_nope');
      expect(deleted).toBe(false);
    });
  });

  describe('workspaces', () => {
    beforeEach(() => {
      db.insertProject('proj_1', 'TestProject', '/tmp/test');
    });

    it('should insert and retrieve a workspace', () => {
      db.insertWorkspace('ws_1', 'proj_1', 'Main', 'IDLE');
      const ws = db.getWorkspace('ws_1');
      expect(ws).toBeDefined();
      expect(ws!.id).toBe('ws_1');
      expect(ws!.projectId).toBe('proj_1');
      expect(ws!.state).toBe('IDLE');
    });

    it('should list workspaces by project', () => {
      db.insertWorkspace('ws_1', 'proj_1', 'A', 'IDLE');
      db.insertWorkspace('ws_2', 'proj_1', 'B', 'IDLE');
      const list = db.listWorkspaces('proj_1');
      expect(list).toHaveLength(2);
    });

    it('should update workspace state', () => {
      db.insertWorkspace('ws_1', 'proj_1', 'Main', 'IDLE');
      db.updateWorkspaceState('ws_1', 'ACTIVE');
      const ws = db.getWorkspace('ws_1');
      expect(ws!.state).toBe('ACTIVE');
    });

    it('should cascade delete workspaces when project is deleted', () => {
      db.insertWorkspace('ws_1', 'proj_1', 'Main', 'IDLE');
      db.deleteProject('proj_1');
      expect(db.getWorkspace('ws_1')).toBeUndefined();
    });

    it('should handle optional branch and agentProvider', () => {
      db.insertWorkspace('ws_1', 'proj_1', 'Main', 'IDLE', 'feature/x', 'claude');
      const ws = db.getWorkspace('ws_1');
      expect(ws!.branch).toBe('feature/x');
      expect(ws!.agentProvider).toBe('claude');
    });
  });

  describe('conversations', () => {
    beforeEach(() => {
      db.insertProject('proj_1', 'P', '/p');
      db.insertWorkspace('ws_1', 'proj_1', 'W', 'IDLE');
    });

    it('should insert and retrieve conversation messages', () => {
      db.insertConversation('msg_1', 'ws_1', 'user', 'Hello', '2024-01-01T00:00:00Z');
      db.insertConversation('msg_2', 'ws_1', 'assistant', 'Hi!', '2024-01-01T00:00:01Z');
      const history = db.getConversationHistory('ws_1');
      expect(history).toHaveLength(2);
      expect(history[0].role).toBe('user');
      expect(history[1].role).toBe('assistant');
    });

    it('should support limit and before parameters', () => {
      db.insertConversation('msg_1', 'ws_1', 'user', 'A', '2024-01-01T00:00:00Z');
      db.insertConversation('msg_2', 'ws_1', 'user', 'B', '2024-01-01T00:00:01Z');
      db.insertConversation('msg_3', 'ws_1', 'user', 'C', '2024-01-01T00:00:02Z');

      const limited = db.getConversationHistory('ws_1', 2);
      expect(limited).toHaveLength(2);

      const before = db.getConversationHistory('ws_1', undefined, '2024-01-01T00:00:02Z');
      expect(before).toHaveLength(2);
    });

    it('should store and retrieve JSON metadata', () => {
      db.insertConversation('msg_1', 'ws_1', 'user', 'test', '2024-01-01T00:00:00Z', {
        key: 'value',
      });
      const history = db.getConversationHistory('ws_1');
      expect(history[0].metadata).toEqual({ key: 'value' });
    });

    it('should cascade delete conversations when workspace is deleted', () => {
      db.insertConversation('msg_1', 'ws_1', 'user', 'test', '2024-01-01T00:00:00Z');
      db.deleteWorkspace('ws_1');
      const history = db.getConversationHistory('ws_1');
      expect(history).toHaveLength(0);
    });
  });

  describe('settings', () => {
    it('should set and get a string setting', () => {
      db.setSetting('model.apiKey', 'sk-ant-test-1234');
      const value = db.getSetting('model.apiKey');
      expect(value).toBe('sk-ant-test-1234');
    });

    it('should set and get a numeric setting', () => {
      db.setSetting('model.maxTokens', 4096);
      const value = db.getSetting('model.maxTokens');
      expect(value).toBe(4096);
    });

    it('should return undefined for missing setting', () => {
      const value = db.getSetting('nonexistent.key');
      expect(value).toBeUndefined();
    });

    it('should upsert existing setting', () => {
      db.setSetting('model.id', 'claude-sonnet-4-5');
      db.setSetting('model.id', 'claude-opus-4-5');
      const value = db.getSetting('model.id');
      expect(value).toBe('claude-opus-4-5');
    });

    it('should get all settings', () => {
      db.setSetting('model.id', 'claude-sonnet-4-5');
      db.setSetting('model.maxTokens', 8192);
      db.setSetting('general.theme', 'dark');
      const all = db.getAllSettings();
      expect(Object.keys(all)).toHaveLength(3);
      expect(all['model.id']).toBe('claude-sonnet-4-5');
      expect(all['general.theme']).toBe('dark');
    });

    it('should get settings by prefix', () => {
      db.setSetting('model.id', 'claude-sonnet-4-5');
      db.setSetting('model.maxTokens', 8192);
      db.setSetting('general.theme', 'dark');
      const modelSettings = db.getSettingsByPrefix('model.');
      expect(Object.keys(modelSettings)).toHaveLength(2);
      expect(modelSettings['model.id']).toBe('claude-sonnet-4-5');
      expect(modelSettings['model.maxTokens']).toBe(8192);
      expect(modelSettings['general.theme']).toBeUndefined();
    });

    it('should delete a setting', () => {
      db.setSetting('model.id', 'claude-sonnet-4-5');
      const deleted = db.deleteSetting('model.id');
      expect(deleted).toBe(true);
      expect(db.getSetting('model.id')).toBeUndefined();
    });

    it('should return false when deleting non-existent setting', () => {
      const deleted = db.deleteSetting('nope');
      expect(deleted).toBe(false);
    });

    it('should handle complex JSON values', () => {
      db.setSetting('complex.value', { nested: { array: [1, 2, 3], flag: true } });
      const value = db.getSetting('complex.value') as Record<string, unknown>;
      expect(value).toEqual({ nested: { array: [1, 2, 3], flag: true } });
    });
  });

  describe('events', () => {
    it('should insert events with JSON payload', () => {
      db.insertEvent('project', 'created', { id: 'proj_1', name: 'Test' });
      // No retrieval API needed for now, just verify no error
    });
  });

  describe('agent_state', () => {
    beforeEach(() => {
      db.insertProject('proj_1', 'P', '/p');
      db.insertWorkspace('ws_1', 'proj_1', 'W', 'IDLE');
    });

    it('should upsert and retrieve agent state', () => {
      db.upsertAgentState('ws_1', 'echo', 'default');
      const state = db.getAgentState('ws_1');
      expect(state).toBeDefined();
      expect(state!.provider).toBe('echo');
    });

    it('should update existing agent state', () => {
      db.upsertAgentState('ws_1', 'echo');
      db.upsertAgentState('ws_1', 'claude', 'opus');
      const state = db.getAgentState('ws_1');
      expect(state!.provider).toBe('claude');
      expect(state!.model).toBe('opus');
    });
  });
});
