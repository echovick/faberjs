import pc from 'picocolors';
import type { Middleware, NextFunction } from './types';
import type { Request } from './request';
import type { Response } from './response';

const PATH_PAD = 42;

const METHOD_BADGE: Record<string, (s: string) => string> = {
  GET: (s) => pc.bold(pc.green(s)),
  POST: (s) => pc.bold(pc.cyan(s)),
  PUT: (s) => pc.bold(pc.yellow(s)),
  PATCH: (s) => pc.bold(pc.magenta(s)),
  DELETE: (s) => pc.bold(pc.red(s)),
  HEAD: (s) => pc.dim(s),
  OPTIONS: (s) => pc.dim(s),
};

function colorStatus(status: number): string {
  const s = String(status);
  if (status >= 500) return pc.bold(pc.red(s));
  if (status >= 400) return pc.bold(pc.yellow(s));
  if (status >= 300) return pc.bold(pc.cyan(s));
  return pc.bold(pc.green(s));
}

function colorDuration(ms: number): string {
  const s = `${ms}ms`;
  if (ms > 2000) return pc.red(s);
  if (ms > 500) return pc.yellow(s);
  return pc.dim(s);
}

function timestamp(): string {
  return pc.dim(new Date().toTimeString().slice(0, 8));
}

function writeLine(request: Request, status: number, ms: number): void {
  const method = request.method();
  const badge = (METHOD_BADGE[method] ?? pc.white)(method.padEnd(7));
  const path = pc.white(request.path().padEnd(PATH_PAD));
  const arrow = pc.dim('→');

  process.stdout.write(
    `  ${timestamp()}  ${badge}  ${path}  ${arrow}  ${colorStatus(status)}  ${colorDuration(ms)}\n`,
  );
}

export class HttpLogger implements Middleware {
  async handle(request: Request, next: NextFunction): Promise<Response> {
    const start = Date.now();
    try {
      const response = await next(request);
      writeLine(request, response.getStatus(), Date.now() - start);
      return response;
    } catch (error) {
      writeLine(request, 500, Date.now() - start);
      throw error;
    }
  }
}
