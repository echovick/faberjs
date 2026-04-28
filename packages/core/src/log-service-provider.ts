import { ServiceProvider } from './service-provider';
import { Logger } from './logger';
import type { LoggerConfig } from './logger';

export class LogServiceProvider extends ServiceProvider {
  register(): void {
    this.app.singleton('log', () => {
      const config = this.app.bound('config.logging')
        ? this.app.make<LoggerConfig>('config.logging')
        : {};
      return new Logger(config);
    });
  }
}
