import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/scaffold.ts'],
  format: ['cjs'],
  dts: true,
  clean: true,
  sourcemap: true,
  banner: {
    js: '#!/usr/bin/env node',
  },
});
