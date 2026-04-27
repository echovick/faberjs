import { Application } from '@faberjs/core';
import { UnauthorizedException } from '@faberjs/http';
import type { Middleware, NextFunction, Request, Response } from '@faberjs/http';
import type { GuardContract } from './types';

export class AuthMiddleware implements Middleware {
  async handle(request: Request, next: NextFunction): Promise<Response> {
    const token = request.bearerToken();
    if (!token) throw new UnauthorizedException();

    const guard = Application.getInstance().make<GuardContract>('auth.guard');
    const user = await guard.user(token);
    if (!user) throw new UnauthorizedException();

    request.user = user;
    return next(request);
  }
}
