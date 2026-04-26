export abstract class Command {
  abstract readonly signature: string;
  abstract readonly description: string;

  abstract handle(...args: unknown[]): Promise<void> | void;

  info(message: string): void {
    process.stdout.write(`\x1b[36mINFO\x1b[0m  ${message}\n`);
  }

  success(message: string): void {
    process.stdout.write(`\x1b[32mDONE\x1b[0m  ${message}\n`);
  }

  warn(message: string): void {
    process.stdout.write(`\x1b[33mWARN\x1b[0m  ${message}\n`);
  }

  error(message: string): void {
    process.stderr.write(`\x1b[31mERROR\x1b[0m ${message}\n`);
  }

  line(message = ''): void {
    process.stdout.write(`${message}\n`);
  }
}
