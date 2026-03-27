/**
 * Tool definitions for the Claude API.
 * These define the tools available to the agent during agentic loops.
 */
import type Anthropic from '@anthropic-ai/sdk';

export const agentTools: Anthropic.Tool[] = [
  {
    name: 'file_read',
    description:
      'Read the contents of a file at the given path relative to the workspace root. ' +
      'Returns the file content as text. Use this to understand existing code before making changes.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to the file from the workspace root',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'file_write',
    description:
      'Create or overwrite a file at the given path relative to the workspace root. ' +
      'Creates parent directories automatically if they do not exist.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to the file from the workspace root',
        },
        content: {
          type: 'string',
          description: 'The full content to write to the file',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'file_edit',
    description:
      'Edit a file by replacing an exact string match with new content. ' +
      'The old_string must match exactly (including whitespace and indentation). ' +
      'Use file_read first to see the current content.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to the file from the workspace root',
        },
        old_string: {
          type: 'string',
          description: 'The exact string to find and replace',
        },
        new_string: {
          type: 'string',
          description: 'The replacement string',
        },
      },
      required: ['path', 'old_string', 'new_string'],
    },
  },
  {
    name: 'list_directory',
    description:
      'List the files and directories at a given path relative to the workspace root. ' +
      'Returns names with trailing / for directories. Useful for exploring project structure.',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'Relative path to list. Use "." or "" for the workspace root.',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'terminal_exec',
    description:
      'Execute a shell command in the workspace directory and return its output. ' +
      'Commands run with a 60-second timeout. Use for running builds, tests, git, etc.',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: {
          type: 'string',
          description: 'The shell command to execute',
        },
      },
      required: ['command'],
    },
  },
  {
    name: 'search_files',
    description:
      'Search for files matching a pattern in the workspace. ' +
      'Returns matching file paths relative to the workspace root.',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description:
            'Glob-style pattern or text to search for in filenames (e.g., "*.ts", "component")',
        },
      },
      required: ['pattern'],
    },
  },
];
