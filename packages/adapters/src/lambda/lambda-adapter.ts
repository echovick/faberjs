import type { Request as FaberRequest, Response as FaberResponse } from '@faber-js/http';
import { fromLambdaEvent, toLambdaResponse } from './event-bridge';
import type { APIGatewayProxyEvent, APIGatewayProxyResult } from './event-bridge';

interface AppContract {
  boot(): Promise<void>;
  make<T>(abstract: string): T;
  bound(abstract: string): boolean;
}

interface HttpKernelContract {
  handleRequest(req: FaberRequest): Promise<FaberResponse>;
}

export function createLambdaHandler(
  app: AppContract,
): (event: APIGatewayProxyEvent) => Promise<APIGatewayProxyResult> {
  let booted = false;

  return async (event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> => {
    if (!booted) {
      await app.boot();
      booted = true;
    }

    const kernel = app.make<HttpKernelContract>('http.kernel');
    const faberReq = fromLambdaEvent(event);
    const faberRes = await kernel.handleRequest(faberReq);

    return toLambdaResponse(faberRes);
  };
}
