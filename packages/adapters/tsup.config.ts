import { defineConfig } from 'tsup';

export default defineConfig({
  entry: [
    'src/index.ts',
    'src/fastify/index.ts',
    'src/bun/index.ts',
    'src/lambda/index.ts',
    'src/cloudflare/index.ts',
  ],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
  external: ['reflect-metadata', '@faber-js/core', '@faber-js/http', 'fastify'],
});
