import { ServiceProvider } from '@faber-js/core';
import { SharedData } from './SharedData';
import { BridgeMiddleware } from './BridgeMiddleware';
import type { BridgeConfig } from './types';
import type { HttpKernelContract } from '@faber-js/http';

export class BridgeServiceProvider extends ServiceProvider {
  register(): void {
    this.app.singleton('bridge.shared', () => new SharedData());
    this.app.singleton('bridge.config', () => {
      const config: BridgeConfig = {
        version: '',
        rootView: 'resources/views/app.html',
      };
      return config;
    });
    this.app.singleton('bridge.middleware', () => {
      const sharedData = this.app.make<SharedData>('bridge.shared');
      const config = this.app.make<BridgeConfig>('bridge.config');
      return new BridgeMiddleware(sharedData, config);
    });
  }

  boot(): void {
    if (this.app.bound('http.kernel')) {
      const kernel = this.app.make<HttpKernelContract>('http.kernel');
      const middleware = this.app.make<BridgeMiddleware>('bridge.middleware');
      kernel.use(middleware);
    }
  }
}
