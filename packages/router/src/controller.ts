import { Application, Injectable } from '@faber-js/core';
import { ForbiddenException, Response } from '@faber-js/http';
import type { AuthUser } from '@faber-js/http';

interface GateResolvable {
  allows(ability: string, user: AuthUser | null, model?: unknown): Promise<boolean>;
}

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

  protected sse(source: AsyncIterable<string>, status = 200): Response {
    return Response.sse(source, status);
  }

  protected async authorize(
    user: AuthUser | null,
    ability: string,
    model?: unknown,
  ): Promise<void> {
    const gate = Application.getInstance().make<GateResolvable>('gate');
    const allowed = await gate.allows(ability, user, model);
    if (!allowed) throw new ForbiddenException();
  }
}
