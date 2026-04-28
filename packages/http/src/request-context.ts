import { AsyncLocalStorage } from 'node:async_hooks';
import type { Request } from './request';

const store = new AsyncLocalStorage<Request>();

export function runWithRequest<T>(request: Request, fn: () => Promise<T>): Promise<T> {
  return store.run(request, fn);
}

export function getCurrentRequest(): Request | undefined {
  return store.getStore();
}
