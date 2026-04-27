import { createInterface } from 'node:readline';
import path from 'node:path';
import pc from 'picocolors';
import { scaffoldProject } from './scaffold';
import type { ScaffoldOptions } from './scaffold';

async function prompt(question: string, fallback = ''): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    const display = fallback ? `${question} (${fallback}): ` : `${question}: `;
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
  const display = `${question} [${choices.join('/')}] (${fallback}): `;
  const answer = await prompt(display.replace(': ', ''));
  const normalized = answer.trim().toLowerCase() as T;
  return choices.includes(normalized) ? normalized : fallback;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  process.stdout.write(`\n${pc.bold(pc.cyan('Welcome to FaberJS!'))}\n\n`);

  const projectName = args[0] ?? (await prompt('Project name', 'my-faberjs-app'));

  const targetDir = path.resolve(process.cwd(), projectName);

  const dbDriver = await promptChoice(
    'Database driver',
    ['sqlite', 'postgres', 'mysql'] as const,
    'sqlite',
  );

  const authAnswer = await prompt('Include auth scaffolding? (y/n)', 'y');
  const includeAuth = authAnswer.toLowerCase() !== 'n';

  const opts: ScaffoldOptions = {
    projectName,
    targetDir,
    dbDriver,
    includeAuth,
  };

  process.stdout.write(`\n${pc.dim('Creating project...')}\n`);
  const written = await scaffoldProject(opts);

  process.stdout.write(`\n${pc.green('✓')} Created ${written.length.toString()} files\n`);
  process.stdout.write(`\n${pc.bold('Next steps:')}\n`);
  process.stdout.write(`  ${pc.cyan('cd')} ${projectName}\n`);
  process.stdout.write(`  ${pc.cyan('pnpm install')}\n`);
  process.stdout.write(`  ${pc.cyan('faber db migrate')}\n`);
  process.stdout.write(`  ${pc.cyan('faber serve')}\n\n`);
}

main().catch((err: unknown) => {
  process.stderr.write(`${pc.red('Error:')} ${err instanceof Error ? err.message : String(err)}\n`);
  process.exit(1);
});
