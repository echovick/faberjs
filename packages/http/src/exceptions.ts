export class HttpException extends Error {
  constructor(
    message: string,
    readonly statusCode: number,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundException extends HttpException {
  constructor(message = 'Not Found') {
    super(message, 404);
  }
}

export class UnauthorizedException extends HttpException {
  constructor(message = 'Unauthorized') {
    super(message, 401);
  }
}

export class ForbiddenException extends HttpException {
  constructor(message = 'Forbidden') {
    super(message, 403);
  }
}

export class ValidationException extends HttpException {
  constructor(
    readonly errors: Record<string, string[]> = {},
    message = 'The given data was invalid.',
  ) {
    super(message, 422, errors);
  }
}

export class ModelNotFoundException extends HttpException {
  constructor(model = 'Model') {
    super(`No query results for model [${model}].`, 404);
  }
}

export class TooManyRequestsException extends HttpException {
  constructor(message = 'Too Many Requests') {
    super(message, 429);
  }
}
