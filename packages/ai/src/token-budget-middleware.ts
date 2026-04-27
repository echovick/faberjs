import { TooManyRequestsException } from '@faberjs/http';
import type { Middleware, NextFunction, Request, Response } from '@faberjs/http';
import type { TokenBudgetConfig } from './types';

export class TokenBudgetMiddleware implements Middleware {
  readonly #maxTokens: number;
  #usedTokens = 0;

  constructor(config: TokenBudgetConfig) {
    this.#maxTokens = config.maxTokens;
  }

  async handle(request: Request, next: NextFunction): Promise<Response> {
    if (this.#usedTokens >= this.#maxTokens) {
      throw new TooManyRequestsException(
        `Token budget exceeded: ${this.#usedTokens.toString()} of ${this.#maxTokens.toString()} tokens used.`,
      );
    }
    return next(request);
  }

  recordTokens(count: number): void {
    this.#usedTokens += count;
  }

  get usedTokens(): number {
    return this.#usedTokens;
  }

  get remainingTokens(): number {
    return Math.max(0, this.#maxTokens - this.#usedTokens);
  }

  reset(): void {
    this.#usedTokens = 0;
  }
}
