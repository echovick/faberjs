import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearConfigRepository, config, getConfigRepository, setConfigRepository } from './config';
import { ConfigRepository } from './config-repository';
import { ConfigNotInitializedException } from './exceptions';

describe('config() helper', () => {
  beforeEach(() => {
    setConfigRepository(
      new ConfigRepository({
        app: {
          name: 'FaberJS',
          env: 'testing',
          debug: false,
        },
        database: {
          default: 'postgres',
        },
      }),
    );
  });

  afterEach(() => {
    clearConfigRepository();
  });

  it('should resolve config("app.name") from the repository', () => {
    expect(config('app.name')).toBe('FaberJS');
  });

  it('should resolve a top-level key', () => {
    expect(config<string>('database.default')).toBe('postgres');
  });

  it('should return the fallback when the key is not found', () => {
    expect(config('app.missing', 'fallback')).toBe('fallback');
  });

  it('should return undefined when no key and no fallback', () => {
    expect(config('totally.missing')).toBeUndefined();
  });

  it('should throw ConfigNotInitializedException when no repository is set', () => {
    clearConfigRepository();
    expect(() => config('app.name')).toThrow(ConfigNotInitializedException);
  });

  it('getConfigRepository() should return the active repository', () => {
    const repo = getConfigRepository();
    expect(repo.get('app.name')).toBe('FaberJS');
  });

  it('getConfigRepository() should throw when not initialized', () => {
    clearConfigRepository();
    expect(() => getConfigRepository()).toThrow(ConfigNotInitializedException);
  });
});
