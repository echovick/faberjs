import { Facade } from './facade';
import type { Logger, LogLevel } from './logger';

export class Log extends Facade {
  protected static getFacadeAccessor(): string {
    return 'log';
  }

  static emergency(message: string, context?: Record<string, unknown>): void {
    this.resolveRoot<Logger>().emergency(message, context);
  }

  static alert(message: string, context?: Record<string, unknown>): void {
    this.resolveRoot<Logger>().alert(message, context);
  }

  static critical(message: string, context?: Record<string, unknown>): void {
    this.resolveRoot<Logger>().critical(message, context);
  }

  static error(message: string, context?: Record<string, unknown>): void {
    this.resolveRoot<Logger>().error(message, context);
  }

  static warning(message: string, context?: Record<string, unknown>): void {
    this.resolveRoot<Logger>().warning(message, context);
  }

  static notice(message: string, context?: Record<string, unknown>): void {
    this.resolveRoot<Logger>().notice(message, context);
  }

  static info(message: string, context?: Record<string, unknown>): void {
    this.resolveRoot<Logger>().info(message, context);
  }

  static debug(message: string, context?: Record<string, unknown>): void {
    this.resolveRoot<Logger>().debug(message, context);
  }

  static log(level: LogLevel, message: string, context?: Record<string, unknown>): void {
    this.resolveRoot<Logger>().log(level, message, context);
  }
}
