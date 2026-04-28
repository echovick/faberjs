import { Application } from '@faber-js/core';
import { UnauthorizedException } from '@faber-js/http';
import type { Middleware, NextFunction, Request, Response } from '@faber-js/http';
import type { GuardContract } from './types';

export class AuthMiddleware implements Middleware {
  async handle(request: Request, next: NextFunction): Promise<Response> {
    const token = request.bearerToken();
    if (!token) throw new UnauthorizedException();

    const guard = Application.getInstance().make<GuardContract>('auth.guard');
    const user = await guard.user(token);
    if (!user) throw new UnauthorizedException();

    request.setUser(user);
    return next(request);
  }
}
