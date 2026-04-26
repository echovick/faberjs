import { Injectable } from '@faberjs/core';
import { Response } from '@faberjs/http';

@Injectable()
export abstract class Controller {
  protected json(data: unknown, status = 200): Response {
    return Response.json(data, status);
  }

  protected redirect(url: string, status = 302): Response {
    return Response.redirect(url, status);
  }

  protected noContent(): Response {
    return Response.noContent();
  }
}
