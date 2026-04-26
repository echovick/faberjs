import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
    format: ['cjs', 'esm'],
    dts: true,
    clean: true,
    sourcemap: true,
    external: ['reflect-metadata'],
  },
  {
    entry: { bin: 'src/bin.ts' },
    format: ['cjs'],
    dts: false,
    clean: false,
    sourcemap: false,
    banner: { js: '#!/usr/bin/env node' },
    external: ['reflect-metadata'],
  },
]);
