/**
 * Structured logger for Maestro.
 * Wraps console with timestamps, levels, and sensitive data masking.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

let minLevel: LogLevel = (process.env.NEXUS_LOG_LEVEL as LogLevel) ?? 'info';

function shouldLog(level: LogLevel): boolean {
  return LEVELS[level] >= LEVELS[minLevel];
}

function sanitize(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(/sk-ant-\S{8,}/g, 'sk-ant-***').replace(/nxm_\S{8,}/g, 'nxm_***');
  }
  if (value instanceof Error) {
    return { message: value.message, stack: value.stack };
  }
  return value;
}

function formatArgs(args: unknown[]): unknown[] {
  return args.map(sanitize);
}

function timestamp(): string {
  return new Date().toISOString();
}

export const logger = {
  setLevel(level: LogLevel): void {
    minLevel = level;
  },

  debug(prefix: string, ...args: unknown[]): void {
    if (!shouldLog('debug')) return;
    console.debug(`${timestamp()} [DEBUG] ${prefix}`, ...formatArgs(args));
  },

  info(prefix: string, ...args: unknown[]): void {
    if (!shouldLog('info')) return;
    console.log(`${timestamp()} [INFO] ${prefix}`, ...formatArgs(args));
  },

  warn(prefix: string, ...args: unknown[]): void {
    if (!shouldLog('warn')) return;
    console.warn(`${timestamp()} [WARN] ${prefix}`, ...formatArgs(args));
  },

  error(prefix: string, ...args: unknown[]): void {
    if (!shouldLog('error')) return;
    console.error(`${timestamp()} [ERROR] ${prefix}`, ...formatArgs(args));
  },

  fatal(prefix: string, ...args: unknown[]): void {
    console.error(`${timestamp()} [FATAL] ${prefix}`, ...formatArgs(args));
  },
};
