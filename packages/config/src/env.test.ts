import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { env } from './env';

describe('env()', () => {
  beforeEach(() => {
    process.env['FABER_TEST_STRING'] = 'hello';
    process.env['FABER_TEST_NUMBER'] = '42';
    process.env['FABER_TEST_BOOL_TRUE'] = 'true';
    process.env['FABER_TEST_BOOL_ONE'] = '1';
    process.env['FABER_TEST_BOOL_FALSE'] = 'false';
    process.env['FABER_TEST_EMPTY'] = '';
  });

  afterEach(() => {
    delete process.env['FABER_TEST_STRING'];
    delete process.env['FABER_TEST_NUMBER'];
    delete process.env['FABER_TEST_BOOL_TRUE'];
    delete process.env['FABER_TEST_BOOL_ONE'];
    delete process.env['FABER_TEST_BOOL_FALSE'];
    delete process.env['FABER_TEST_EMPTY'];
  });

  describe('string values', () => {
    it('should return the string value from process.env', () => {
      expect(env('FABER_TEST_STRING')).toBe('hello');
    });

    it('should return undefined when the variable is not set and no fallback given', () => {
      expect(env('FABER_MISSING')).toBeUndefined();
    });

    it('should return the string fallback when the variable is not set', () => {
      expect(env('FABER_MISSING', 'default')).toBe('default');
    });

    it('should return the fallback when the value is an empty string', () => {
      expect(env('FABER_TEST_EMPTY', 'fallback')).toBe('fallback');
    });
  });

  describe('number coercion', () => {
    it('should coerce to number when the fallback is a number', () => {
      expect(env('FABER_TEST_NUMBER', 0)).toBe(42);
    });

    it('should return the numeric fallback when the variable is not set', () => {
      expect(env('FABER_MISSING', 99)).toBe(99);
    });
  });

  describe('boolean coercion', () => {
    it('should coerce "true" to true when the fallback is a boolean', () => {
      expect(env('FABER_TEST_BOOL_TRUE', false)).toBe(true);
    });

    it('should coerce "1" to true when the fallback is a boolean', () => {
      expect(env('FABER_TEST_BOOL_ONE', false)).toBe(true);
    });

    it('should coerce any other value to false', () => {
      expect(env('FABER_TEST_BOOL_FALSE', true)).toBe(false);
    });

    it('should return the boolean fallback when the variable is not set', () => {
      expect(env('FABER_MISSING', true)).toBe(true);
    });
  });
});
