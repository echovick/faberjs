interface ResponseData {
  readonly body: unknown;
  readonly status: number;
  readonly headers: Record<string, string>;
}

export class Response {
  readonly #body: unknown;
  readonly #status: number;
  readonly #headers: Record<string, string>;

  private constructor(data: ResponseData) {
    this.#body = data.body;
    this.#status = data.status;
    this.#headers = { ...data.headers };
  }

  static json(data: unknown, status = 200): Response {
    return new Response({ body: data, status, headers: { 'content-type': 'application/json' } });
  }

  static noContent(): Response {
    return new Response({ body: null, status: 204, headers: {} });
  }

  static notFound(message = 'Not Found'): Response {
    return Response.json({ message }, 404);
  }

  static error(message: string, status = 500): Response {
    return Response.json({ message }, status);
  }

  static redirect(url: string, status = 302): Response {
    return new Response({ body: null, status, headers: { location: url } });
  }

  static stream(source: AsyncIterable<string>, status = 200): Response {
    return new Response({
      body: source,
      status,
      headers: { 'content-type': 'text/plain; charset=utf-8', 'x-content-type-options': 'nosniff' },
    });
  }

  getStatus(): number {
    return this.#status;
  }

  getBody(): unknown {
    return this.#body;
  }

  getHeaders(): Readonly<Record<string, string>> {
    return this.#headers;
  }
}

export class ResponseFactory {
  json(data: unknown, status = 200): Response {
    return Response.json(data, status);
  }

  noContent(): Response {
    return Response.noContent();
  }

  notFound(message?: string): Response {
    return Response.notFound(message);
  }

  error(message: string, status?: number): Response {
    return Response.error(message, status);
  }

  redirect(url: string, status?: number): Response {
    return Response.redirect(url, status);
  }
}

export function response(): ResponseFactory {
  return new ResponseFactory();
}
