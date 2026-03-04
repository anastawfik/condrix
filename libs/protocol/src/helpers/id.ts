/**
 * ID generation utilities.
 *
 * Message IDs use UUID v7 (RFC 9562) for sortability, as specified
 * in the architecture document. General-purpose IDs use a prefixed format.
 */

/**
 * Generate a UUID v7 — a time-sortable UUID with 48-bit millisecond
 * timestamp and 74 bits of randomness. Format: `xxxxxxxx-xxxx-7xxx-yxxx-xxxxxxxxxxxx`
 */
export function uuidv7(): string {
  const now = Date.now();

  // 48-bit timestamp split into parts
  const timeLow = now & 0xffff_ffff;
  const timeHigh = (now / 0x1_0000_0000) & 0xffff;

  // Random bytes for the rest
  const rand = new Uint8Array(10);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(rand);
  } else {
    for (let i = 0; i < 10; i++) {
      rand[i] = Math.floor(Math.random() * 256);
    }
  }

  // Build 16-byte UUID
  const bytes = new Uint8Array(16);

  // Bytes 0-3: time_high (32 bits of 48-bit timestamp)
  bytes[0] = (timeLow >>> 24) & 0xff;
  bytes[1] = (timeLow >>> 16) & 0xff;
  bytes[2] = (timeLow >>> 8) & 0xff;
  bytes[3] = timeLow & 0xff;

  // Bytes 4-5: time_mid (upper 16 bits of 48-bit timestamp)
  bytes[4] = (timeHigh >>> 8) & 0xff;
  bytes[5] = timeHigh & 0xff;

  // Bytes 6-7: version (7) + random
  bytes[6] = 0x70 | (rand[0]! & 0x0f); // version 7
  bytes[7] = rand[1]!;

  // Bytes 8-9: variant (10xx) + random
  bytes[8] = 0x80 | (rand[2]! & 0x3f); // variant 10
  bytes[9] = rand[3]!;

  // Bytes 10-15: random
  bytes[10] = rand[4]!;
  bytes[11] = rand[5]!;
  bytes[12] = rand[6]!;
  bytes[13] = rand[7]!;
  bytes[14] = rand[8]!;
  bytes[15] = rand[9]!;

  // Format as hex string with dashes
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Generate a unique message ID (UUID v7). */
export function generateMessageId(): string {
  return uuidv7();
}

/** Generate a unique ID with the given prefix. Format: `{prefix}_{uuidv7}` */
export function generateId(prefix: string): string {
  return `${prefix}_${uuidv7()}`;
}
