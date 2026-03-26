import type { Notification, NotificationChannel } from '@condrix/protocol';
import { generateMessageId } from '@condrix/protocol';
import type { ClientConnectionManager } from './client-connection-manager.js';
import type { MaestroDatabase } from './database.js';
import type { EventBus } from './event-bus.js';

/**
 * Decides when and how to notify the developer.
 * Monitors for workspace:waiting, agent:error, and workspace:complete events.
 * Includes deduplication and rate-limiting to prevent notification fatigue.
 */
export class NotificationRouter {
  private channels: NotificationChannel[] = ['web'];
  private rateLimitPerHour: number;
  private sentThisHour = 0;
  private hourStart = Date.now();
  private recentKeys = new Set<string>();
  private unsubscribers: (() => void)[] = [];

  constructor(
    private db: MaestroDatabase,
    private clientManager: ClientConnectionManager,
    rateLimitPerHour = 30,
  ) {
    this.rateLimitPerHour = rateLimitPerHour;
  }

  configure(channels: NotificationChannel[], rateLimitPerHour: number): void {
    this.channels = channels;
    this.rateLimitPerHour = rateLimitPerHour;
  }

  /** Wire to event bus to listen for notification-worthy events. */
  wireEventBus(eventBus: EventBus): void {
    // Listen for workspace events relayed from Cores
    this.unsubscribers.push(
      eventBus.subscribe('workspace', (event) => {
        const action = event.action;
        const payload = event.payload as Record<string, unknown>;
        const workspaceId = (payload?.workspaceId ?? payload?.id ?? '') as string;

        if (action === 'state-changed') {
          const newState = payload?.state as string;
          if (newState === 'WAITING') {
            this.notify(workspaceId, 'waiting', `Workspace is waiting for input`);
          } else if (newState === 'ERRORED') {
            this.notify(workspaceId, 'error', `Workspace encountered an error`);
          }
        }
      }),
    );

    this.unsubscribers.push(
      eventBus.subscribe('agent', (event) => {
        const action = event.action;
        const payload = event.payload as Record<string, unknown>;
        const workspaceId = (payload?.workspaceId ?? '') as string;

        if (action === 'error') {
          const message = (payload?.error as string) ?? 'Agent error';
          this.notify(workspaceId, 'error', message);
        } else if (action === 'complete') {
          this.notify(workspaceId, 'complete', 'Agent task completed');
        }
      }),
    );
  }

  /** Send a notification through configured channels. */
  async notify(
    workspaceId: string,
    type: 'waiting' | 'error' | 'complete' | 'info',
    message: string,
  ): Promise<void> {
    // Deduplication: skip if same key sent recently (within 5 min)
    const dedupeKey = `${workspaceId}:${type}:${message}`;
    if (this.recentKeys.has(dedupeKey)) return;
    this.recentKeys.add(dedupeKey);
    setTimeout(() => this.recentKeys.delete(dedupeKey), 5 * 60 * 1000);

    // Rate limiting
    if (Date.now() - this.hourStart > 3600_000) {
      this.sentThisHour = 0;
      this.hourStart = Date.now();
    }
    if (this.sentThisHour >= this.rateLimitPerHour) {
      console.warn('[NotificationRouter] Rate limit reached, dropping notification');
      return;
    }

    for (const channel of this.channels) {
      const notification: Notification = {
        id: generateMessageId(),
        workspaceId,
        type,
        message,
        channel,
        status: 'pending',
      };

      await this.route(notification);
    }
  }

  private async route(notification: Notification): Promise<void> {
    try {
      switch (notification.channel) {
        case 'web':
          // Broadcast to all connected clients
          this.clientManager.broadcastToAll({
            id: notification.id,
            type: 'event',
            namespace: 'maestro',
            action: 'notification',
            payload: {
              type: notification.type,
              message: notification.message,
              workspaceId: notification.workspaceId,
            },
            timestamp: new Date().toISOString(),
          });
          break;

        case 'telegram':
        case 'whatsapp':
        case 'push':
          // External channels require adapter integration
          // For now, log and mark as pending for future adapter implementation
          console.log(`[NotificationRouter] ${notification.channel} adapter not configured, notification logged: ${notification.message}`);
          break;
      }

      notification.status = 'sent';
      notification.sentAt = new Date().toISOString();
      this.sentThisHour++;
    } catch (err) {
      console.error(`[NotificationRouter] Failed to route notification:`, (err as Error).message);
    }
  }

  destroy(): void {
    for (const unsub of this.unsubscribers) unsub();
    this.unsubscribers = [];
  }
}
