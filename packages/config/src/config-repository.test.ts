import { beforeEach, describe, expect, it } from 'vitest';

import { ConfigRepository } from './config-repository';

describe('ConfigRepository', () => {
  let repo: ConfigRepository;

  beforeEach(() => {
    repo = new ConfigRepository({
      app: {
        name: 'FaberJS',
        env: 'testing',
        debug: true,
        port: 3000,
      },
      database: {
        default: 'postgres',
        connections: {
          postgres: {
            host: 'localhost',
            port: 5432,
          },
        },
      },
    });
  });

  describe('get()', () => {
    it('should resolve a top-level key', () => {
      expect(repo.get('app')).toEqual({
        name: 'FaberJS',
        env: 'testing',
        debug: true,
        port: 3000,
      });
    });

    it('should resolve a nested key using dot notation', () => {
      expect(repo.get('app.name')).toBe('FaberJS');
    });

    it('should resolve deeply nested keys', () => {
      expect(repo.get('database.connections.postgres.host')).toBe('localhost');
    });

    it('should return the fallback when the key does not exist', () => {
      expect(repo.get('app.missing', 'default')).toBe('default');
    });

    it('should return undefined when the key is missing and no fallback is given', () => {
      expect(repo.get('totally.missing')).toBeUndefined();
    });

    it('should return the fallback when an intermediate key is not an object', () => {
      expect(repo.get('app.name.too.deep', 'fallback')).toBe('fallback');
    });

    it('should retrieve boolean values', () => {
      expect(repo.get<boolean>('app.debug')).toBe(true);
    });

    it('should retrieve numeric values', () => {
      expect(repo.get<number>('app.port')).toBe(3000);
    });
  });

  describe('has()', () => {
    it('should return true when the key exists', () => {
      expect(repo.has('app.name')).toBe(true);
    });

    it('should return false when the key does not exist', () => {
      expect(repo.has('app.missing')).toBe(false);
    });
  });

  describe('set()', () => {
    it('should set a top-level key', () => {
      repo.set('cache', { driver: 'redis' });
      expect(repo.get('cache.driver')).toBe('redis');
    });

    it('should set a nested key, creating intermediate objects', () => {
      repo.set('mail.driver', 'smtp');
      expect(repo.get('mail.driver')).toBe('smtp');
    });

    it('should overwrite an existing value', () => {
      repo.set('app.name', 'NewName');
      expect(repo.get('app.name')).toBe('NewName');
    });
  });

  describe('all()', () => {
    it('should return a deep copy of all config data', () => {
      const all = repo.all();
      expect(all['app']).toEqual({ name: 'FaberJS', env: 'testing', debug: true, port: 3000 });
    });

    it('should return a clone, not the original reference', () => {
      const all = repo.all();
      (all['app'] as Record<string, unknown>)['name'] = 'Modified';
      expect(repo.get('app.name')).toBe('FaberJS');
    });
  });

  describe('merge()', () => {
    it('should add a new namespace to the repository', () => {
      repo.merge('queue', { driver: 'redis', connection: 'default' });
      expect(repo.get('queue.driver')).toBe('redis');
    });
  });
});
