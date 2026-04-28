import { fromWorkerRequest, toWorkerResponse } from './request-bridge';
import type { RequestHandler } from '../types';

export interface WorkerHandler {
  fetch(request: globalThis.Request): Promise<globalThis.Response>;
}

export function createWorkerHandler(handler: RequestHandler): WorkerHandler {
  return {
    async fetch(request: globalThis.Request): Promise<globalThis.Response> {
      try {
        const faberReq = await fromWorkerRequest(request);
        const faberRes = await handler(faberReq);
        return toWorkerResponse(faberRes);
      } catch {
        return new globalThis.Response(JSON.stringify({ message: 'Internal Server Error' }), {
          status: 500,
          headers: { 'content-type': 'application/json' },
        });
      }
    },
  };
}
