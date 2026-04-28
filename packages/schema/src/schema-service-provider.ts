import { ServiceProvider } from '@faber-js/core';

export class SchemaServiceProvider extends ServiceProvider {
  register(): void {
    // Schema is stateless — no container bindings needed.
    // This provider exists so apps can register @faber-js/schema
    // in bootstrap/app.ts for future hooks (e.g. migration discovery).
  }
}
