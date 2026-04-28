import { ServiceProvider } from '@faber-js/core';
import { clearExplainerCache } from './error-explainer';

export class AiServiceProvider extends ServiceProvider {
  register(): void {
    // The AI package uses lazy instantiation — agents are made via app.make(AgentClass).
    // No singleton bindings required; subclasses register their own agents if needed.
  }

  boot(): void {
    // Clear the error explainer cache on each boot so dev-mode explanations stay fresh
    // across server restarts without lingering across requests.
    clearExplainerCache();
  }
}
