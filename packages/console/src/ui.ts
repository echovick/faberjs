import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import pc from 'picocolors';

// F lettermark — mirrors the geometric construction-line SVG logo
const LOGO = [
  '  ◉─────────◉', // top crossbar
  '  │', // spine
  '  ◉──────◉', // mid crossbar (~34% down)
  '  │', // spine
  '  ◉', // base
];

const LOGO_W = Math.max(...LOGO.map((l) => l.length));

export function getVersion(): string {
  try {
    const pkg = JSON.parse(readFileSync(join(__dirname, '..', 'package.json'), 'utf8')) as {
      version: string;
    };
    return pkg.version;
  } catch {
    return '0.0.0';
  }
}

export function bannerLines(version?: string): string {
  const name = pc.bold(pc.cyan('FaberJS'));
  const ver = version ? '  ' + pc.dim(`v${version}`) : '';
  const tag = pc.dim('Laravel-inspired Node.js framework');

  const lines: string[] = [''];
  for (let i = 0; i < LOGO.length; i++) {
    const glyph = pc.cyan(LOGO[i]);
    const pad = ' '.repeat(LOGO_W - LOGO[i].length);
    if (i === 1) {
      lines.push(glyph + pad + '  ' + name + ver);
    } else if (i === 3) {
      lines.push(glyph + pad + '  ' + tag);
    } else {
      lines.push(glyph);
    }
  }
  lines.push('');
  return lines.join('\n');
}

export function printBanner(version?: string): void {
  process.stdout.write(bannerLines(version) + '\n');
}

// ── Aligned output labels ─────────────────────────────────────────────────────

function badge(color: (s: string) => string, label: string, msg: string): void {
  process.stdout.write(`  ${pc.bold(color(label.padEnd(11)))} ${msg}\n`);
}

function badgeErr(msg: string): void {
  process.stderr.write(`  ${pc.bold(pc.red('ERROR'.padEnd(11)))} ${msg}\n`);
}

export const log = {
  created: (msg: string) => badge(pc.green, 'CREATED', msg),
  migrated: (msg: string) => badge(pc.green, 'MIGRATED', msg),
  rolledBack: (msg: string) => badge(pc.yellow, 'ROLLED BACK', msg),
  seeded: (msg: string) => badge(pc.green, 'SEEDED', msg),
  info: (msg: string) => badge(pc.cyan, 'INFO', msg),
  done: (msg: string) => badge(pc.green, 'DONE', msg),
  warn: (msg: string) => badge(pc.yellow, 'WARN', msg),
  error: (msg: string) => badgeErr(msg),
};
