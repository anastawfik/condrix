/**
 * Type-safe routing — maps namespace+action to typed request/response/event payloads.
 */
import type {
  CoreActions,
  CoreEvents,
  ProjectActions,
  ProjectEvents,
  WorkspaceActions,
  WorkspaceEvents,
  AgentActions,
  AgentEvents,
  TerminalActions,
  TerminalEvents,
  FileActions,
  FileEvents,
  GitActions,
  GitEvents,
  MaestroActions,
  MaestroEvents,
} from './messages.js';

// ─── Namespace → Action Map ─────────────────────────────────────────────────

export interface NamespaceActionMap {
  core: CoreActions;
  project: ProjectActions;
  workspace: WorkspaceActions;
  agent: AgentActions;
  terminal: TerminalActions;
  file: FileActions;
  git: GitActions;
  maestro: MaestroActions;
}

// ─── Namespace → Event Map ──────────────────────────────────────────────────

export interface NamespaceEventMap {
  core: CoreEvents;
  project: ProjectEvents;
  workspace: WorkspaceEvents;
  agent: AgentEvents;
  terminal: TerminalEvents;
  file: FileEvents;
  git: GitEvents;
  maestro: MaestroEvents;
}

// ─── Typed Extractors ───────────────────────────────────────────────────────

/** Extract the request payload type for a given namespace and action. */
export type RequestPayload<
  N extends keyof NamespaceActionMap,
  A extends keyof NamespaceActionMap[N],
> = NamespaceActionMap[N][A] extends { request: infer R } ? R : never;

/** Extract the response payload type for a given namespace and action. */
export type ResponsePayload<
  N extends keyof NamespaceActionMap,
  A extends keyof NamespaceActionMap[N],
> = NamespaceActionMap[N][A] extends { response: infer R } ? R : never;

/** Extract the event payload type for a given namespace and event name. */
export type EventPayload<
  N extends keyof NamespaceEventMap,
  E extends keyof NamespaceEventMap[N],
> = NamespaceEventMap[N][E];

// ─── Typed Message Wrappers ─────────────────────────────────────────────────

export interface TypedRequest<
  N extends keyof NamespaceActionMap,
  A extends keyof NamespaceActionMap[N],
> {
  id: string;
  type: 'request';
  namespace: N;
  action: A;
  workspaceId?: string;
  payload: RequestPayload<N, A>;
  timestamp: string;
  correlationId?: string;
}

export interface TypedResponse<
  N extends keyof NamespaceActionMap,
  A extends keyof NamespaceActionMap[N],
> {
  id: string;
  type: 'response';
  namespace: N;
  action: A;
  workspaceId?: string;
  payload: ResponsePayload<N, A>;
  timestamp: string;
  correlationId?: string;
  success: boolean;
  error?: { code: string; message: string; details?: unknown };
}

export interface TypedEvent<
  N extends keyof NamespaceEventMap,
  E extends keyof NamespaceEventMap[N],
> {
  id: string;
  type: 'event';
  namespace: N;
  action: E;
  workspaceId?: string;
  payload: EventPayload<N, E>;
  timestamp: string;
  correlationId?: string;
}
