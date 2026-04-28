import { join } from 'node:path';
import { existsSync, readdirSync } from 'node:fs';
import pc from 'picocolors';
import type { RouteDefinition } from '@faber-js/http';
import { log } from '../ui';

const METHOD_COLORS: Record<string, (s: string) => string> = {
  GET: pc.green,
  POST: pc.cyan,
  PUT: pc.yellow,
  PATCH: pc.yellow,
  DELETE: pc.red,
  HEAD: pc.dim,
  OPTIONS: pc.dim,
};

function colorMethod(method: string): string {
  const color = METHOD_COLORS[method.toUpperCase()] ?? pc.white;
  return color(method.toUpperCase().padEnd(8));
}

export async function listRoutes(cwd: string): Promise<void> {
  const routesDir = join(cwd, 'routes');
  if (!existsSync(routesDir)) {
    process.stdout.write(`  ${pc.dim('No routes directory found.')}\n`);
    return;
  }

  try {
    const { Application } = await import('@faber-js/core');
    const { RouterServiceProvider } = await import('@faber-js/router');

    const app = new Application();
    app.register(new RouterServiceProvider(app));

    const files = readdirSync(routesDir).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));
    for (const file of files) {
      await import(join(routesDir, file));
    }

    const router = app.make<{ getRoutes(): readonly RouteDefinition[] }>('router');
    const routes = router.getRoutes();

    if (routes.length === 0) {
      process.stdout.write(`  ${pc.dim('No routes registered.')}\n`);
      return;
    }

    const COL_PATH = 32;
    const COL_NAME = 20;
    const header =
      `  ${pc.bold(pc.dim('Method'.padEnd(8)))}  ` +
      `${pc.bold(pc.dim('Path'.padEnd(COL_PATH)))}  ` +
      `${pc.bold(pc.dim('Name'.padEnd(COL_NAME)))}`;
    const divider =
      `  ${pc.dim('─'.repeat(8))}  ` +
      `${pc.dim('─'.repeat(COL_PATH))}  ` +
      `${pc.dim('─'.repeat(COL_NAME))}`;

    process.stdout.write('\n');
    process.stdout.write(header + '\n');
    process.stdout.write(divider + '\n');
    for (const r of routes) {
      const method = colorMethod(r.method);
      const path = pc.white(r.path.padEnd(COL_PATH));
      const name = pc.dim((r.name ?? '').padEnd(COL_NAME));
      process.stdout.write(`  ${method}  ${path}  ${name}\n`);
    }
    process.stdout.write('\n');
  } catch (e) {
    log.error(`Could not load routes: ${e instanceof Error ? e.message : String(e)}`);
  }
}
