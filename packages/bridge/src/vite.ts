import { createHash } from 'node:crypto';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { Plugin } from 'vite';

export interface FaberBridgeOptions {
  readonly framework?: 'react' | 'vue' | 'angular';
  readonly input?: string;
  readonly rootView?: string;
  readonly ssr?: boolean;
}

export function faberBridge(options: FaberBridgeOptions = {}): Plugin {
  const { input = 'resources/js/app', ssr = false } = options;

  let root = process.cwd();
  let assetVersion = '';

  return {
    name: 'faber-bridge',

    configResolved(config) {
      root = config.root;
      assetVersion = computeVersion(input, root);
    },

    config() {
      return {
        define: {
          __FABER_BRIDGE_VERSION__: JSON.stringify(assetVersion),
          __FABER_BRIDGE_SSR__: JSON.stringify(ssr),
        },
      };
    },

    configureServer(server) {
      server.middlewares.use((_req, res, next) => {
        res.setHeader('x-faber-bridge-asset-version', assetVersion);
        next();
      });
    },
  };
}

function computeVersion(input: string, projectRoot: string): string {
  const candidates = [
    resolve(projectRoot, `${input}.ts`),
    resolve(projectRoot, `${input}.tsx`),
    resolve(projectRoot, `${input}.js`),
    resolve(projectRoot, input),
  ];
  const found = candidates.find((p) => existsSync(p));
  if (!found) return '';
  try {
    const content = readFileSync(found);
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
  } catch {
    return '';
  }
}
