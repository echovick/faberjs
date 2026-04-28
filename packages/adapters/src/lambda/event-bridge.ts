import { Request as FaberRequest, type Response as FaberResponse } from '@faber-js/http';

export interface APIGatewayProxyEvent {
  httpMethod: string;
  path: string;
  headers: Record<string, string> | null;
  multiValueHeaders: Record<string, string[]> | null;
  queryStringParameters: Record<string, string> | null;
  multiValueQueryStringParameters: Record<string, string[]> | null;
  body: string | null;
  isBase64Encoded: boolean;
  requestContext: {
    identity: {
      sourceIp: string;
    };
  };
  pathParameters: Record<string, string> | null;
}

export interface APIGatewayProxyResult {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  isBase64Encoded: boolean;
}

export function fromLambdaEvent(event: APIGatewayProxyEvent): FaberRequest {
  const queryParams = event.queryStringParameters ?? {};
  const queryString =
    Object.keys(queryParams).length > 0
      ? '?' + new URLSearchParams(queryParams as Record<string, string>).toString()
      : '';

  let body: unknown = {};
  if (event.body !== null && event.body !== undefined) {
    try {
      body = JSON.parse(event.body) as unknown;
    } catch {
      body = {};
    }
  }

  return new FaberRequest({
    method: event.httpMethod,
    path: event.path,
    url: event.path + queryString,
    headers: event.headers ?? {},
    body,
    query: queryParams,
    params: event.pathParameters ?? {},
    ip: event.requestContext.identity.sourceIp,
  });
}

export function toLambdaResponse(response: FaberResponse): APIGatewayProxyResult {
  const body = response.getBody();
  const headers = response.getHeaders() as Record<string, string>;

  let serializedBody: string;
  if (body === null) {
    serializedBody = '';
  } else if (typeof body === 'string') {
    serializedBody = body;
  } else {
    serializedBody = JSON.stringify(body);
  }

  return {
    statusCode: response.getStatus(),
    headers,
    body: serializedBody,
    isBase64Encoded: false,
  };
}
