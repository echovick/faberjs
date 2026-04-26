import { existsSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

export class Discoverer {
  constructor(private readonly basePath: string) {}

  async load(relativePath: string): Promise<void> {
    await import(join(this.basePath, relativePath));
  }

  async scanDirectory(relativePath: string): Promise<void> {
    const absPath = join(this.basePath, relativePath);
    if (!existsSync(absPath)) return;
    await this.walk(absPath);
  }

  private async walk(dirPath: string): Promise<void> {
    for (const entry of readdirSync(dirPath)) {
      const fullPath = join(dirPath, entry);
      if (statSync(fullPath).isDirectory()) {
        await this.walk(fullPath);
        continue;
      }
      const ext = extname(entry);
      if (ext !== '.ts' && ext !== '.js') continue;
      if (entry.includes('.test.') || entry.includes('.spec.') || entry.endsWith('.d.ts')) continue;
      await import(fullPath);
    }
  }
}
