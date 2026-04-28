import { ServiceProvider } from '@faber-js/core';
import { MemoryAdapter } from './adapters/memory-adapter';
import { PresenceStore } from './presence-store';
import { Channel } from './router';
import type { ChannelsConfig } from './types';

export class ChannelsServiceProvider extends ServiceProvider {
  register(): void {
    this.app.singleton('channels.presence', () => new PresenceStore());

    this.app.singleton('channels.adapter', () => {
      const cfg = this.#config();
      if (cfg.driver === 'redis' && cfg.redis) {
        return this.#buildRedisAdapter(cfg);
      }
      return new MemoryAdapter();
    });

    this.app.singleton('channels.router', () => Channel.getRouter());
  }

  #config(): ChannelsConfig {
    if (this.app.bound('config')) {
      const configRepo = this.app.make<{ get(key: string, def?: unknown): unknown }>('config');
      const driver = configRepo.get('channels.driver', 'memory') as string;
      const rawRedis = configRepo.get('channels.redis') as
        | { host: string; port: number; channel: string; password?: string }
        | undefined;

      if (rawRedis !== undefined) {
        return { driver: driver as 'memory' | 'redis', redis: rawRedis };
      }
      return { driver: driver as 'memory' | 'redis' };
    }
    return { driver: 'memory' };
  }

  #buildRedisAdapter(cfg: ChannelsConfig): MemoryAdapter {
    try {
      const redisCfg = cfg.redis;
      if (!redisCfg) return new MemoryAdapter();
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { default: Redis } = require('ioredis') as {
        default: new (opts: { host: string; port: number; password?: string }) => unknown;
      };
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { RedisAdapter } = require('./adapters/redis-adapter') as {
        RedisAdapter: new (pub: unknown, sub: unknown, channel: string) => MemoryAdapter;
      };
      const redisOpts: { host: string; port: number; password?: string } = {
        host: redisCfg.host,
        port: redisCfg.port,
      };
      if (redisCfg.password !== undefined) {
        redisOpts.password = redisCfg.password;
      }
      const pub = new Redis(redisOpts);
      const sub = new Redis(redisOpts);
      return new RedisAdapter(pub, sub, redisCfg.channel ?? 'faberjs_channels');
    } catch {
      return new MemoryAdapter();
    }
  }
}
