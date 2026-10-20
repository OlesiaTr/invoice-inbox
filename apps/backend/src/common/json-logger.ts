import { ConsoleLogger, type LoggerService } from '@nestjs/common';
import { currentContext } from './request-context';

type Level = 'log' | 'error' | 'warn' | 'debug' | 'verbose' | 'fatal';

/**
 * One JSON object per line, with the correlation id of the surrounding unit of work
 * attached. Log aggregators can then follow a single invoice from upload through the
 * worker to a failure, which interpolated strings don't allow.
 *
 * Development keeps Nest's coloured console output — structured logs are for production,
 * where something is actually reading them.
 */
export class JsonLogger implements LoggerService {
  private write(level: Level, message: unknown, params: unknown[]) {
    const ctx = currentContext();
    // Nest passes the logging context (usually the class name) as the last argument.
    const last = params.length > 0 ? params[params.length - 1] : undefined;
    const context = typeof last === 'string' ? last : undefined;
    const extra = context ? params.slice(0, -1) : params;

    const entry = {
      level,
      time: new Date().toISOString(),
      context,
      message: typeof message === 'string' ? message : safeString(message),
      correlationId: ctx?.correlationId,
      invoiceId: ctx?.invoiceId,
      // Stack traces and anything else Nest hands through alongside the message.
      detail: extra.length > 0 ? extra.map(safeString) : undefined,
    };
    // JSON.stringify already omits undefined values on an object.
    const line = JSON.stringify(entry);
    if (level === 'error' || level === 'fatal') process.stderr.write(`${line}\n`);
    else process.stdout.write(`${line}\n`);
  }

  log(message: unknown, ...params: unknown[]) {
    this.write('log', message, params);
  }
  error(message: unknown, ...params: unknown[]) {
    this.write('error', message, params);
  }
  warn(message: unknown, ...params: unknown[]) {
    this.write('warn', message, params);
  }
  debug(message: unknown, ...params: unknown[]) {
    this.write('debug', message, params);
  }
  verbose(message: unknown, ...params: unknown[]) {
    this.write('verbose', message, params);
  }
  fatal(message: unknown, ...params: unknown[]) {
    this.write('fatal', message, params);
  }
}

function safeString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack ?? value.message;
  try {
    return JSON.stringify(value) ?? String(value);
  } catch {
    return String(value);
  }
}

/** Human-readable in development, machine-readable in production. */
export function createLogger(nodeEnv: string): LoggerService {
  return nodeEnv === 'production' ? new JsonLogger() : new ConsoleLogger();
}
