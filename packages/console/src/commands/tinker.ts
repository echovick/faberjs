import { createInterface } from 'node:readline';

export async function startTinker(cwd: string): Promise<void> {
  process.stdout.write('\x1b[36mFaberJS Tinker\x1b[0m — Type .exit to quit\n\n');

  try {
    // Dynamically import repl so it only loads when tinker runs
    const repl = await import('node:repl');

    // Try to load the user's app bootstrap for context
    try {
      await import(cwd + '/bootstrap/app.ts');
    } catch {
      // bootstrap is optional — tinker works without it
    }

    const server = repl.start({ prompt: '>>> ', useGlobal: false });

    await new Promise<void>((resolve) => {
      server.on('exit', resolve);
    });
  } catch {
    // Fallback: simple readline REPL if native repl fails
    const rl = createInterface({ input: process.stdin, output: process.stdout });
    rl.setPrompt('>>> ');
    rl.prompt();
    rl.on('line', (line) => {
      if (line.trim() === '.exit') {
        rl.close();
        return;
      }
      try {
        const result = new Function(`return (${line})`)() as unknown;
        process.stdout.write(`${String(result)}\n`);
      } catch (e) {
        process.stderr.write(`${e instanceof Error ? e.message : String(e)}\n`);
      }
      rl.prompt();
    });
    rl.on('close', () => {
      process.exit(0);
    });
  }
}
