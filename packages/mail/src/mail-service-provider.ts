import { ServiceProvider } from '@faber-js/core';
import { Mailer } from './mailer';
import { Mail } from './mail';

export class MailServiceProvider extends ServiceProvider {
  register(): void {
    this.app.singleton('mailer', () => Mailer.fromEnv());
  }

  boot(): void {
    Mail.setInstance(this.app.make<Mailer>('mailer'));
  }
}
