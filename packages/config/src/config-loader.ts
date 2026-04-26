import * as fs from 'fs';
import * as path from 'path';

import dotenv from 'dotenv';

import { ConfigRepository } from './config-repository';

export class ConfigLoader {
  constructor(private readonly basePath: string) {}

  loadEnv(envPath?: string): void {
    const filePath = envPath ?? path.join(this.basePath, '.env');
    dotenv.config({ path: filePath });
  }

  async load(): Promise<ConfigRepository> {
    const configDir = path.join(this.basePath, 'config');
    const data: Record<string, unknown> = {};

    if (!fs.existsSync(configDir)) {
      return new ConfigRepository(data);
    }

    const files = fs
      .readdirSync(configDir)
      .filter(
        (f) => f.endsWith('.ts') || f.endsWith('.js') || f.endsWith('.mjs') || f.endsWith('.cjs'),
      );

    await Promise.all(
      files.map(async (file) => {
        const name = path.basename(file, path.extname(file));
        const filePath = path.join(configDir, file);
        try {
          const mod = (await import(filePath)) as { default?: unknown };
          data[name] = mod.default ?? mod;
        } catch {
          // skip unloadable config files
        }
      }),
    );

    return new ConfigRepository(data);
  }
}
