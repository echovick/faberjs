import { beforeEach, describe, expect, it, vi } from 'vitest';

import { Container } from './container';
import { Injectable, Inject } from './decorators';
import {
  BindingNotFoundException,
  NotInjectableException,
  UnresolvableDependencyException,
} from './exceptions';

class Logger {
  log(msg: string): string {
    return msg;
  }
}

@Injectable()
class Database {
  readonly name = 'db';
}

@Injectable()
class UserService {
  constructor(public readonly db: Database) {}
}

@Injectable()
class AliasedService {
  constructor(@Inject('logger') public readonly logger: Logger) {}
}

class NotInjectable {
  readonly name = 'not-injectable';
}

describe('Container', () => {
  let container: Container;

  beforeEach(() => {
    container = new Container();
  });

  describe('bind()', () => {
    it('should register a factory and resolve it on make()', () => {
      container.bind('logger', () => new Logger());
      const logger = container.make<Logger>('logger');
      expect(logger).toBeInstanceOf(Logger);
    });

    it('should call the factory each time make() is called', () => {
      const factory = vi.fn(() => new Logger());
      container.bind('logger', factory);

      container.make('logger');
      container.make('logger');

      expect(factory).toHaveBeenCalledTimes(2);
    });

    it('should replace an existing binding and clear the cached instance', () => {
      container.singleton('svc', () => ({ v: 1 }));
      container.make('svc'); // cache it
      container.bind('svc', () => ({ v: 2 }));
      const result = container.make<{ v: number }>('svc');
      expect(result.v).toBe(2);
    });
  });

  describe('singleton()', () => {
    it('should return the same instance on every make() call', () => {
      container.singleton('logger', () => new Logger());
      const a = container.make<Logger>('logger');
      const b = container.make<Logger>('logger');
      expect(a).toBe(b);
    });

    it('should call the factory exactly once', () => {
      const factory = vi.fn(() => new Logger());
      container.singleton('logger', factory);

      container.make('logger');
      container.make('logger');
      container.make('logger');

      expect(factory).toHaveBeenCalledTimes(1);
    });
  });

  describe('instance()', () => {
    it('should return the pre-built instance directly', () => {
      const logger = new Logger();
      container.instance('logger', logger);
      expect(container.make<Logger>('logger')).toBe(logger);
    });
  });

  describe('make()', () => {
    it('should throw BindingNotFoundException for an unregistered string token', () => {
      expect(() => container.make('unknown')).toThrow(BindingNotFoundException);
    });

    it('should throw BindingNotFoundException for an unregistered symbol token', () => {
      const sym = Symbol('test');
      expect(() => container.make(sym)).toThrow(BindingNotFoundException);
    });

    it('should auto-resolve an @Injectable class with no dependencies', () => {
      const db = container.make(Database);
      expect(db).toBeInstanceOf(Database);
      expect(db.name).toBe('db');
    });

    it('should auto-resolve an @Injectable class with constructor dependencies', () => {
      const svc = container.make(UserService);
      expect(svc).toBeInstanceOf(UserService);
      expect(svc.db).toBeInstanceOf(Database);
    });

    it('should throw NotInjectableException for a class without @Injectable', () => {
      expect(() => container.make(NotInjectable)).toThrow(NotInjectableException);
    });

    it('should pass the container itself to the factory', () => {
      container.singleton('db', () => new Database());
      container.bind('user-service', (c) => {
        const db = c.make(Database);
        const svc = new UserService(db);
        return svc;
      });
      const svc = container.make<UserService>('user-service');
      expect(svc.db).toBeInstanceOf(Database);
    });
  });

  describe('@Inject() decorator', () => {
    it('should resolve the injected token instead of the parameter type', () => {
      const logger = new Logger();
      container.instance('logger', logger);
      const svc = container.make(AliasedService);
      expect(svc.logger).toBe(logger);
    });
  });

  describe('bound()', () => {
    it('should return true for a registered factory', () => {
      container.bind('svc', () => ({}));
      expect(container.bound('svc')).toBe(true);
    });

    it('should return true for a registered instance', () => {
      container.instance('svc', {});
      expect(container.bound('svc')).toBe(true);
    });

    it('should return false for an unregistered token', () => {
      expect(container.bound('unknown')).toBe(false);
    });
  });

  describe('forget()', () => {
    it('should remove the binding and cached instance', () => {
      container.singleton('svc', () => ({}));
      container.make('svc');
      container.forget('svc');
      expect(container.bound('svc')).toBe(false);
      expect(() => container.make('svc')).toThrow(BindingNotFoundException);
    });
  });

  describe('forgetInstance()', () => {
    it('should remove a cached singleton instance, causing the factory to run again', () => {
      let count = 0;
      container.singleton('svc', () => ({ id: ++count }));
      container.make('svc');
      container.forgetInstance('svc');
      const result = container.make<{ id: number }>('svc');
      expect(result.id).toBe(2);
    });
  });

  describe('call()', () => {
    it('should call a factory function with the container', () => {
      container.singleton('db', () => new Database());
      const db = container.call((c) => c.make(Database));
      expect(db).toBeInstanceOf(Database);
    });
  });

  describe('UnresolvableDependencyException', () => {
    it('should throw when a parameter type resolves to Object', () => {
      @Injectable()
      class BadService {
        // Parameter typed as `object` — emits Object, not a real type
        constructor(public dep: object) {}
      }

      expect(() => container.make(BadService)).toThrow(UnresolvableDependencyException);
    });
  });
});
