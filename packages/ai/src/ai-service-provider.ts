import { ServiceProvider } from '@faberjs/core';

export class AiServiceProvider extends ServiceProvider {
  register(): void {
    // The AI package uses lazy instantiation — agents are made via app.make(AgentClass).
    // No singleton bindings required; subclasses register their own agents if needed.
  }
}
