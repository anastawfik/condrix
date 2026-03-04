/**
 * ID generation utilities.
 *
 * Message IDs use UUID v7 (RFC 9562) for sortability, as specified
 * in the architecture document. General-purpose IDs use a prefixed format.
 */
import { v7 as uuidv7 } from 'uuid';

export { uuidv7 };

/** Generate a unique message ID (UUID v7). */
export function generateMessageId(): string {
  return uuidv7();
}

/** Generate a unique ID with the given prefix. Format: `{prefix}_{uuidv7}` */
export function generateId(prefix: string): string {
  return `${prefix}_${uuidv7()}`;
}
