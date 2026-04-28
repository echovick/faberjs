import { appendFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { join } from 'node:path';

export type LogLevel =
  | 'emergency'
  | 'alert'
  | 'critical'
  | 'error'
  | 'warning'
  | 'notice'
  | 'info'
  | 'debug';

const SEVERITY: Record<LogLevel, number> = {
  emergency: 0,
  alert: 1,
  critical: 2,
  error: 3,
  warning: 4,
  notice: 5,
  info: 6,
  debug: 7,
};

export interface LoggerConfig {
  readonly channel?: 'daily' | 'single';
  readonly path?: string;
  readonly level?: LogLevel;
}

export class Logger {
  readonly #channel: 'daily' | 'single';
  readonly #basePath: string;
  readonly #minSeverity: number;

  constructor(config: LoggerConfig = {}) {
    this.#channel = config.channel ?? 'daily';
    this.#basePath = config.path ?? join(process.cwd(), 'storage', 'logs', 'faber.log');
    this.#minSeverity = SEVERITY[config.level ?? 'debug'];
  }

  emergency(message: string, context?: Record<string, unknown>): void {
    this.log('emergency', message, context);
  }
  alert(message: string, context?: Record<string, unknown>): void {
    this.log('alert', message, context);
  }
  critical(message: string, context?: Record<string, unknown>): void {
    this.log('critical', message, context);
  }
  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }
  warning(message: string, context?: Record<string, unknown>): void {
    this.log('warning', message, context);
  }
  notice(message: string, context?: Record<string, unknown>): void {
    this.log('notice', message, context);
  }
  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }
  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    if (SEVERITY[level] > this.#minSeverity) return;

    const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const ctx = context && Object.keys(context).length > 0 ? ` ${JSON.stringify(context)}` : '';
    const line = `[${ts}] faber.${level.toUpperCase()}: ${message}${ctx}\n`;

    try {
      const file = this.#resolveFilePath();
      const dir = dirname(file);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      appendFileSync(file, line, 'utf8');
    } catch {
      // Never let a logging failure crash the app
    }
  }

  #resolveFilePath(): string {
    if (this.#channel === 'single') return this.#basePath;
    const date = new Date().toISOString().slice(0, 10);
    return this.#basePath.replace(/\.log$/, `-${date}.log`);
  }
}
