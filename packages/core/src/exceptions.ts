export class BindingNotFoundException extends Error {
  constructor(token: string) {
    super(
      `No binding found for [${token}]. Register it with app.bind(), app.singleton(), or app.instance().`,
    );
    this.name = 'BindingNotFoundException';
  }
}

export class NotInjectableException extends Error {
  constructor(className: string) {
    super(
      `Class [${className}] is not marked as @Injectable(). ` +
        `Apply the @Injectable() decorator to enable auto-resolution.`,
    );
    this.name = 'NotInjectableException';
  }
}

export class UnresolvableDependencyException extends Error {
  constructor(className: string, paramIndex: number) {
    super(
      `Cannot resolve parameter at index ${paramIndex} of [${className}]. ` +
        `Use @Inject(token) to specify the binding token explicitly.`,
    );
    this.name = 'UnresolvableDependencyException';
  }
}

export class ApplicationNotInitializedException extends Error {
  constructor() {
    super(
      'Application has not been initialized. ' +
        'Call `new Application()` or `Application.create()` before resolving bindings.',
    );
    this.name = 'ApplicationNotInitializedException';
  }
}

export class ApplicationException extends Error {
  readonly statusCode: number;
  readonly data?: unknown;

  constructor(message: string, statusCode = 500, data?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.data = data;
  }
}
