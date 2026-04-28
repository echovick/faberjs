import { describe, it, expect } from 'vitest';
import { Str } from './str';

describe('Str', () => {
  describe('camel', () => {
    it('converts snake_case to camelCase', () => {
      expect(Str.camel('hello_world')).toBe('helloWorld');
    });

    it('converts kebab-case to camelCase', () => {
      expect(Str.camel('hello-world')).toBe('helloWorld');
    });
  });

  describe('snake', () => {
    it('converts camelCase to snake_case', () => {
      expect(Str.snake('helloWorld')).toBe('hello_world');
    });

    it('converts PascalCase to snake_case', () => {
      expect(Str.snake('HelloWorld')).toBe('hello_world');
    });
  });

  describe('kebab', () => {
    it('converts camelCase to kebab-case', () => {
      expect(Str.kebab('helloWorld')).toBe('hello-world');
    });
  });

  describe('studly', () => {
    it('converts snake_case to StudlyCase', () => {
      expect(Str.studly('hello_world')).toBe('HelloWorld');
    });

    it('converts kebab-case to StudlyCase', () => {
      expect(Str.studly('hello-world')).toBe('HelloWorld');
    });
  });

  describe('slug', () => {
    it('converts a spaced string to a slug', () => {
      expect(Str.slug('Hello World')).toBe('hello-world');
    });

    it('removes special characters', () => {
      expect(Str.slug('Hello, World!')).toBe('hello-world');
    });

    it('accepts a custom separator', () => {
      expect(Str.slug('Hello World', '_')).toBe('hello_world');
    });
  });

  describe('limit', () => {
    it('truncates and appends ellipsis', () => {
      expect(Str.limit('Hello World', 5)).toBe('Hello...');
    });

    it('does not truncate when string is at or under limit', () => {
      expect(Str.limit('Hi', 5)).toBe('Hi');
    });

    it('uses a custom end string', () => {
      expect(Str.limit('Hello World', 5, ' →')).toBe('Hello →');
    });
  });

  describe('contains', () => {
    it('returns true when haystack contains needle', () => {
      expect(Str.contains('hello world', 'world')).toBe(true);
    });

    it('returns false when haystack does not contain needle', () => {
      expect(Str.contains('hello world', 'xyz')).toBe(false);
    });

    it('accepts an array of needles (any match)', () => {
      expect(Str.contains('hello world', ['xyz', 'world'])).toBe(true);
    });
  });

  describe('startsWith', () => {
    it('returns true when string starts with the needle', () => {
      expect(Str.startsWith('hello', 'hel')).toBe(true);
    });

    it('returns false when string does not start with the needle', () => {
      expect(Str.startsWith('hello', 'xyz')).toBe(false);
    });
  });

  describe('uuid', () => {
    it('returns a string matching UUID pattern', () => {
      const id = Str.uuid();
      expect(id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it('generates unique values', () => {
      expect(Str.uuid()).not.toBe(Str.uuid());
    });
  });

  describe('random', () => {
    it('returns a string of the specified length', () => {
      expect(Str.random(16)).toHaveLength(16);
    });

    it('defaults to 16 characters', () => {
      expect(Str.random()).toHaveLength(16);
    });

    it('generates different values on each call', () => {
      expect(Str.random(16)).not.toBe(Str.random(16));
    });
  });

  describe('Str.of() fluent interface', () => {
    it('chains camel() and returns via toString()', () => {
      expect(Str.of('hello_world').camel().toString()).toBe('helloWorld');
    });

    it('chains snake() and returns via toString()', () => {
      expect(Str.of('helloWorld').snake().toString()).toBe('hello_world');
    });

    it('chains kebab() and returns via toString()', () => {
      expect(Str.of('helloWorld').kebab().toString()).toBe('hello-world');
    });

    it('chains studly() and returns via toString()', () => {
      expect(Str.of('hello_world').studly().toString()).toBe('HelloWorld');
    });

    it('chains limit()', () => {
      expect(Str.of('Hello World').limit(5).toString()).toBe('Hello...');
    });
  });

  describe('additional static methods', () => {
    it('endsWith returns true', () => {
      expect(Str.endsWith('hello', 'llo')).toBe(true);
    });

    it('title capitalises each word', () => {
      expect(Str.title('hello world')).toBe('Hello World');
    });

    it('after returns substring after search', () => {
      expect(Str.after('hello world', 'hello ')).toBe('world');
    });

    it('before returns substring before search', () => {
      expect(Str.before('hello world', ' world')).toBe('hello');
    });

    it('isJson returns true for valid JSON', () => {
      expect(Str.isJson('{"a":1}')).toBe(true);
    });

    it('isJson returns false for non-JSON', () => {
      expect(Str.isJson('not json')).toBe(false);
    });

    it('isUuid validates a UUID', () => {
      expect(Str.isUuid(Str.uuid())).toBe(true);
    });
  });
});
