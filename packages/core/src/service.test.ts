import 'reflect-metadata';
import { afterEach, describe, expect, it } from 'vitest';
import { Application } from './application';
import { Injectable } from './decorators';
import { Service } from './service';

class UserService extends Service {
  greet(): string {
    return 'hello';
  }
}

// Scaffolded code always includes @Injectable — this is what faber make:service generates.
// The decorator emits constructor param type metadata required for DI resolution.
@Injectable()
class PostService extends Service {
  constructor(private readonly users: UserService) {
    super();
  }

  getGreeting(): string {
    return this.users.greet();
  }
}

describe('Service', () => {
  afterEach(() => {
    Application.clearInstance();
  });

  it('makes subclasses injectable via prototype-chain metadata', () => {
    expect(Reflect.hasMetadata('injectable', UserService)).toBe(true);
  });

  it('resolves a service with no constructor deps from the container', () => {
    new Application();
    const svc = Application.getInstance().make(UserService);
    expect(svc).toBeInstanceOf(UserService);
    expect(svc.greet()).toBe('hello');
  });

  it('resolves constructor deps when the subclass carries @Injectable (scaffolded)', () => {
    new Application();
    const svc = Application.getInstance().make(PostService);
    expect(svc).toBeInstanceOf(PostService);
    expect(svc.getGreeting()).toBe('hello');
  });
});
