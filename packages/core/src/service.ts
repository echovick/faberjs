import 'reflect-metadata';
import { Injectable } from './decorators';
import { ApplicationException } from './exceptions';

@Injectable()
export abstract class Service {
  protected abort(statusCode: number, message: string): never {
    throw new ApplicationException(message, statusCode);
  }

  protected notFound(message = 'Not Found'): never {
    throw new ApplicationException(message, 404);
  }

  protected unauthorized(message = 'Unauthorized'): never {
    throw new ApplicationException(message, 401);
  }

  protected forbidden(message = 'Forbidden'): never {
    throw new ApplicationException(message, 403);
  }

  protected unprocessable(
    errors: Record<string, string[]>,
    message = 'The given data was invalid.',
  ): never {
    throw new ApplicationException(message, 422, errors);
  }
}
