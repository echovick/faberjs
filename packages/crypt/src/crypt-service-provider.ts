import { ServiceProvider } from '@faber-js/core';
import { Crypt } from './crypt';
import { Hash } from './hash';

export class CryptServiceProvider extends ServiceProvider {
  register(): void {
    this.app.instance('hash', Hash);
    this.app.instance('crypt', Crypt);

    const key = process.env['APP_KEY'];
    if (key) Crypt.configure(key);

    const rounds = process.env['BCRYPT_ROUNDS'];
    if (rounds) Hash.configure({ bcryptRounds: parseInt(rounds, 10) });
  }

  boot(): void {
    // Nothing to boot — all bindings are registered in register().
  }
}
