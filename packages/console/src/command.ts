import { log } from './ui';

export abstract class Command {
  abstract readonly signature: string;
  abstract readonly description: string;

  abstract handle(...args: unknown[]): Promise<void> | void;

  info(message: string): void {
    log.info(message);
  }
  success(message: string): void {
    log.done(message);
  }
  warn(message: string): void {
    log.warn(message);
  }
  error(message: string): void {
    log.error(message);
  }

  line(message = ''): void {
    process.stdout.write(`${message}\n`);
  }
}
