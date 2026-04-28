import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generateBridgeTypes } from './bridge-types';

function makeFixture(): string {
  const dir = join(tmpdir(), `bridge-types-test-${Date.now()}`);
  mkdirSync(dir, { recursive: true });
  return dir;
}

describe('generateBridgeTypes()', () => {
  let cwd: string;

  beforeEach(() => {
    cwd = makeFixture();
  });

  afterEach(() => {
    rmSync(cwd, { recursive: true, force: true });
  });

  it('creates output file with correct BridgePages type', async () => {
    mkdirSync(join(cwd, 'resources/pages/Users'), { recursive: true });
    mkdirSync(join(cwd, 'resources/pages/Posts'), { recursive: true });
    writeFileSync(join(cwd, 'resources/pages/Users/Index.tsx'), '');
    writeFileSync(join(cwd, 'resources/pages/Posts/Create.vue'), '');

    await generateBridgeTypes(cwd, 'resources/pages', 'resources/types/bridge.generated.ts');

    const outPath = join(cwd, 'resources/types/bridge.generated.ts');
    expect(existsSync(outPath)).toBe(true);

    const content = readFileSync(outPath, 'utf-8');
    expect(content).toContain("'Posts/Create': Record<string, unknown>;");
    expect(content).toContain("'Users/Index': Record<string, unknown>;");
    expect(content).toContain('export type BridgePages =');
    expect(content).toContain('export type BridgePageProps');
  });

  it('creates output directory if it does not exist', async () => {
    mkdirSync(join(cwd, 'resources/pages'), { recursive: true });
    writeFileSync(join(cwd, 'resources/pages/Dashboard.tsx'), '');

    await generateBridgeTypes(cwd, 'resources/pages', 'resources/types/bridge.generated.ts');

    expect(existsSync(join(cwd, 'resources/types'))).toBe(true);
  });

  it('emits nothing and does not create file when no pages found', async () => {
    await generateBridgeTypes(cwd, 'resources/pages', 'resources/types/bridge.generated.ts');

    expect(existsSync(join(cwd, 'resources/types/bridge.generated.ts'))).toBe(false);
  });

  it('sorts component names alphabetically', async () => {
    mkdirSync(join(cwd, 'resources/pages'), { recursive: true });
    writeFileSync(join(cwd, 'resources/pages/Zebra.tsx'), '');
    writeFileSync(join(cwd, 'resources/pages/Alpha.tsx'), '');
    writeFileSync(join(cwd, 'resources/pages/Middle.tsx'), '');

    await generateBridgeTypes(cwd, 'resources/pages', 'resources/types/bridge.generated.ts');

    const content = readFileSync(join(cwd, 'resources/types/bridge.generated.ts'), 'utf-8');
    const alphaIdx = content.indexOf("'Alpha'");
    const middleIdx = content.indexOf("'Middle'");
    const zebraIdx = content.indexOf("'Zebra'");

    expect(alphaIdx).toBeLessThan(middleIdx);
    expect(middleIdx).toBeLessThan(zebraIdx);
  });
});
