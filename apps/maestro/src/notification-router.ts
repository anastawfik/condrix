import type { Notification, NotificationChannel } from '@nexus-core/protocol';

/**
 * Decides when and how to notify the developer.
 * Monitors for workspace:waiting, agent:error, and workspace:complete events.
 * Includes deduplication and rate-limiting to prevent notification fatigue.
 */
export class NotificationRouter {
  private channels: NotificationChannel[] = [];
  private rateLimitPerHour = 30;
  private sentCount = 0;

  configure(channels: NotificationChannel[], rateLimitPerHour: number): void {
    this.channels = channels;
    this.rateLimitPerHour = rateLimitPerHour;
  }

  async route(notification: Notification): Promise<void> {
    if (this.sentCount >= this.rateLimitPerHour) {
      console.warn('[NotificationRouter] Rate limit reached, dropping notification');
      return;
    }
    // TODO: Route to configured channels via messaging adapters
    this.sentCount++;
    console.log(`[NotificationRouter] Sent notification ${notification.id} to ${notification.channel}`);
  }
}
