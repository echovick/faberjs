import pc from 'picocolors';
import type { Middleware, NextFunction } from './types';
import type { Request } from './request';
import type { Response } from './response';

const METHOD_PAD = 7;
const PATH_PAD = 36;

const METHOD_COLOR: Record<string, (s: string) => string> = {
  GET: pc.green,
  POST: pc.cyan,
  PUT: pc.yellow,
  PATCH: pc.yellow,
  DELETE: pc.red,
  HEAD: pc.dim,
  OPTIONS: pc.dim,
};

function colorStatus(status: number): string {
  const s = String(status);
  if (status >= 500) return pc.red(s);
  if (status >= 400) return pc.yellow(s);
  if (status >= 300) return pc.cyan(s);
  return pc.green(s);
}

function colorDuration(ms: number): string {
  const s = `${ms}ms`.padStart(7);
  if (ms > 2000) return pc.red(s);
  if (ms > 500) return pc.yellow(s);
  return pc.dim(s);
}

function timestamp(): string {
  return pc.dim(new Date().toTimeString().slice(0, 8));
}

function writeLine(request: Request, status: number, ms: number): void {
  const method = request.method();
  const colorMethod = (METHOD_COLOR[method] ?? pc.white)(method.padEnd(METHOD_PAD));
  const path = pc.white(request.path().padEnd(PATH_PAD));
  process.stdout.write(
    `  ${timestamp()}  ${colorMethod}  ${path}  ${colorStatus(status)}  ${colorDuration(ms)}\n`,
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
