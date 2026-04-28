import { createInterface } from 'node:readline';
import path from 'node:path';
import pc from 'picocolors';
import { scaffoldProject } from './scaffold';
import type { ScaffoldOptions } from './scaffold';

// F lettermark — heavy lines for the welcome banner
const WELCOME_LOGO = ['  ◉━━━━━━━━━━━━━━━━◉', '  ┃', '  ◉━━━━━━━━━━━━◉', '  ┃', '  ◉'];
const LOGO_W = Math.max(...WELCOME_LOGO.map((l) => l.length));

function printWelcome(): void {
  const name = pc.bold(pc.cyan('FaberJS'));
  const tagline = pc.dim('A Laravel-inspired backend framework');
  const sub = pc.dim('for Node.js + TypeScript');

  process.stdout.write('\n');
  for (let i = 0; i < WELCOME_LOGO.length; i++) {
    const glyph = pc.cyan(WELCOME_LOGO[i]);
    const pad = ' '.repeat(LOGO_W - WELCOME_LOGO[i].length);
    if (i === 0) {
      process.stdout.write(`${glyph}${pad}   ${pc.bold('Welcome to')} ${name}\n`);
    } else if (i === 2) {
      process.stdout.write(`${glyph}${pad}   ${tagline}\n`);
    } else if (i === 4) {
      process.stdout.write(`${glyph}${pad}   ${sub}\n`);
    } else {
      process.stdout.write(`${glyph}\n`);
    }
  }
  process.stdout.write('\n');
}

async function prompt(question: string, fallback = ''): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    const display = fallback
      ? `  ${pc.dim('?')} ${question} ${pc.dim(`(${fallback})`)}: `
      : `  ${pc.dim('?')} ${question}: `;
    rl.question(display, (answer) => {
      rl.close();
      resolve(answer.trim() || fallback);
    });
  });
}

async function promptChoice<T extends string>(
  question: string,
  choices: readonly T[],
  fallback: T,
): Promise<T> {
  const choiceStr = choices.map((c) => (c === fallback ? pc.cyan(c) : pc.dim(c))).join(pc.dim('/'));
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(
      `  ${pc.dim('?')} ${question} ${pc.dim('[')}${choiceStr}${pc.dim(']')}: `,
      (answer) => {
        rl.close();
        const normalized = answer.trim().toLowerCase() as T;
        resolve(choices.includes(normalized) ? normalized : fallback);
      },
    );
  });
}

type Agent = 'claude' | 'cursor' | 'copilot' | 'windsurf';
const VALID_AGENTS: Agent[] = ['claude', 'cursor', 'copilot', 'windsurf'];

function parseAgents(input: string): Agent[] {
  if (input.trim().toLowerCase() === 'none') return [];
  return input
    .split(',')
    .map((s) => s.trim().toLowerCase() as Agent)
    .filter((s): s is Agent => VALID_AGENTS.includes(s));
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  printWelcome();

  const projectName = args[0] ?? (await prompt('Project name', 'my-faberjs-app'));
  process.stdout.write('\n');

  const dbDriver = await promptChoice(
    'Database driver',
    ['sqlite', 'sqlite-wasm', 'postgres', 'mysql'] as const,
    'sqlite',
  );

  const authRaw = await prompt('Include auth scaffolding? (y/n)', 'y');
  const includeAuth = authRaw.toLowerCase() !== 'n';

  // Ask which coding agents to support
  process.stdout.write('\n');
  const agentInput = await prompt(
    `Coding agent support ${pc.dim('[claude/cursor/copilot/windsurf/none]')}`,
    'claude',
  );
  const agents = parseAgents(agentInput);

  const targetDir = path.resolve(process.cwd(), projectName);
  const opts: ScaffoldOptions = { projectName, targetDir, dbDriver, includeAuth, agents };

  process.stdout.write(
    `\n  ${pc.dim('Scaffolding')} ${pc.bold(pc.cyan(projectName))}${pc.dim('...')}\n\n`,
  );

  const written = await scaffoldProject(opts);

  for (const file of written) {
    const rel = file.startsWith(targetDir) ? file.slice(targetDir.length + 1) : file;
    process.stdout.write(`  ${pc.green('+')} ${pc.dim(rel)}\n`);
  }

  process.stdout.write(
    `\n  ${pc.green('✓')} ${pc.bold(`Created ${written.length.toString()} files`)}\n`,
  );

  process.stdout.write(`\n  ${pc.bold('Next steps:')}\n\n`);
  process.stdout.write(`    ${pc.cyan('cd')} ${pc.white(projectName)}\n`);
  process.stdout.write(`    ${pc.cyan('pnpm install')}\n`);
  process.stdout.write(`    ${pc.cyan('npx faber db:migrate')}\n`);
  process.stdout.write(`    ${pc.cyan('npx faber serve')}\n`);
  process.stdout.write(`\n  ${pc.dim('Docs')}  ${pc.dim('https://faberjs.dev')}\n\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(
    `\n  ${pc.bold(pc.red('Error'))}  ${err instanceof Error ? err.message : String(err)}\n\n`,
  );
  process.exit(1);
});
