import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import type { RouteDefinition } from '@faberjs/http';

export async function listRoutes(cwd: string): Promise<void> {
  const routesDir = join(cwd, 'routes');
  if (!existsSync(routesDir)) {
    process.stdout.write('No routes directory found.\n');
    return;
  }

  try {
    const { Application } = await import('@faberjs/core');
    const { RouterServiceProvider } = await import('@faberjs/router');

    const app = new Application();
    app.register(new RouterServiceProvider(app));

    const files = readdirSync(routesDir).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
    for (const file of files) {
      await import(join(routesDir, file));
    }

    const router = app.make<{ getRoutes(): readonly RouteDefinition[] }>('router');
    const routes = router.getRoutes();

    if (routes.length === 0) {
      process.stdout.write('No routes registered.\n');
      return;
    }

    process.stdout.write('\n');
    process.stdout.write('  Method    Path                           Name\n');
    process.stdout.write('  ────────  ─────────────────────────────  ────────────────\n');
    for (const r of routes) {
      const method = r.method.padEnd(8);
      const path = r.path.padEnd(29);
      const name = r.name ?? '';
      process.stdout.write(`  ${method}  ${path}  ${name}\n`);
    }
    process.stdout.write('\n');
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    process.stderr.write(`\x1b[31mERROR\x1b[0m Could not load routes: ${msg}\n`);
  }
}
