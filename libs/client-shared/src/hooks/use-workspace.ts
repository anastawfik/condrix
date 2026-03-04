import { useState } from 'react';
import type { WorkspaceInfo, AgentMessage } from '@nexus-core/protocol';

/**
 * React hook for managing workspace state and agent interactions.
 */
export function useWorkspace(workspaceId: string | null) {
  const [workspace, setWorkspace] = useState<WorkspaceInfo | null>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);

  const sendMessage = async (_message: string): Promise<void> => {
    // TODO: Send message to workspace agent via Core connection
    setIsStreaming(true);
  };

  const approveAction = async (_actionId: string): Promise<void> => {
    // TODO: Approve agent's pending action
  };

  const rejectAction = async (_actionId: string): Promise<void> => {
    // TODO: Reject agent's pending action
  };

  return { workspace, messages, isStreaming, sendMessage, approveAction, rejectAction };
}
