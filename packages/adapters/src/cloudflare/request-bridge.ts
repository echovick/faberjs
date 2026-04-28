import { Request as FaberRequest, type Response as FaberResponse } from '@faber-js/http';

export async function fromWorkerRequest(req: globalThis.Request): Promise<FaberRequest> {
  const url = new URL(req.url);
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  let body: unknown = {};
  try {
    const text = await req.text();
    if (text.length > 0) {
      body = JSON.parse(text) as unknown;
    }
  } catch {
    body = {};
  }

  const ip = headers['cf-connecting-ip'] ?? headers['x-forwarded-for'] ?? '127.0.0.1';

  return new FaberRequest({
    method: req.method,
    path: url.pathname,
    url: req.url,
    headers,
    body,
    query: Object.fromEntries(url.searchParams.entries()),
    params: {},
    ip,
  });
}

export function toWorkerResponse(response: FaberResponse): globalThis.Response {
  const status = response.getStatus();
  const headers = response.getHeaders() as Record<string, string>;
  const body = response.getBody();

  if (body === null) {
    return new globalThis.Response(null, { status, headers });
  }

  if (typeof body === 'object' && body !== null && Symbol.asyncIterator in body) {
    const stream = new ReadableStream({
      async start(controller) {
        for await (const chunk of body as AsyncIterable<string>) {
          controller.enqueue(new TextEncoder().encode(chunk));
        }
        controller.close();
      },
    });
    return new globalThis.Response(stream, { status, headers });
  }

  if (typeof body === 'string') {
    return new globalThis.Response(body, { status, headers });
  }

  return new globalThis.Response(JSON.stringify(body), { status, headers });
}
