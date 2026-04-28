import type { Constructor } from '@faber-js/core';
import type { ChannelDefinition, ChannelHandlerTuple, ChannelType } from './types';

function matchPattern(pattern: string, channelName: string): Record<string, string> | null {
  const patternParts = pattern.split('.');
  const nameParts = channelName.split('.');
  if (patternParts.length !== nameParts.length) return null;

  const params: Record<string, string> = {};
  for (let i = 0; i < patternParts.length; i++) {
    const pp = patternParts[i] ?? '';
    const np = nameParts[i] ?? '';
    if (pp.startsWith('{') && pp.endsWith('}')) {
      params[pp.slice(1, -1)] = np;
    } else if (pp !== np) {
      return null;
    }
  }
  return params;
}

export class ChannelRouter {
  readonly #definitions: ChannelDefinition[] = [];

  private add(
    type: ChannelType,
    pattern: string,
    middlewareOrHandler: string[] | ChannelHandlerTuple,
    handler?: ChannelHandlerTuple,
  ): void {
    let middleware: string[];
    let h: ChannelHandlerTuple;

    if (handler !== undefined) {
      middleware = middlewareOrHandler as string[];
      h = handler;
    } else {
      middleware = [];
      h = middlewareOrHandler as ChannelHandlerTuple;
    }

    this.#definitions.push({ pattern, type, middleware, handler: h });
  }

  public(
    pattern: string,
    middlewareOrHandler: string[] | ChannelHandlerTuple,
    handler?: ChannelHandlerTuple,
  ): void {
    this.add('public', pattern, middlewareOrHandler, handler);
  }

  private_(
    pattern: string,
    middlewareOrHandler: string[] | ChannelHandlerTuple,
    handler?: ChannelHandlerTuple,
  ): void {
    this.add('private', pattern, middlewareOrHandler, handler);
  }

  presence(
    pattern: string,
    middlewareOrHandler: string[] | ChannelHandlerTuple,
    handler?: ChannelHandlerTuple,
  ): void {
    this.add('presence', pattern, middlewareOrHandler, handler);
  }

  resolve(
    channelName: string,
  ): { definition: ChannelDefinition; params: Record<string, string> } | null {
    for (const definition of this.#definitions) {
      const params = matchPattern(definition.pattern, channelName);
      if (params !== null) return { definition, params };
    }
    return null;
  }

  getDefinitions(): readonly ChannelDefinition[] {
    return this.#definitions;
  }
}

/** Facade-style static API for registering channels in routes/channels.ts */
export class Channel {
  static #router: ChannelRouter | null = null;

  static setRouter(router: ChannelRouter): void {
    Channel.#router = router;
  }

  static getRouter(): ChannelRouter {
    if (!Channel.#router) Channel.#router = new ChannelRouter();
    return Channel.#router;
  }

  static public(
    pattern: string,
    middlewareOrHandler: string[] | [Constructor, string],
    handler?: [Constructor, string],
  ): void {
    Channel.getRouter().public(
      pattern,
      middlewareOrHandler as string[] | ChannelHandlerTuple,
      handler as ChannelHandlerTuple | undefined,
    );
  }

  static private(
    pattern: string,
    middlewareOrHandler: string[] | [Constructor, string],
    handler?: [Constructor, string],
  ): void {
    Channel.getRouter().private_(
      pattern,
      middlewareOrHandler as string[] | ChannelHandlerTuple,
      handler as ChannelHandlerTuple | undefined,
    );
  }

  static presence(
    pattern: string,
    middlewareOrHandler: string[] | [Constructor, string],
    handler?: [Constructor, string],
  ): void {
    Channel.getRouter().presence(
      pattern,
      middlewareOrHandler as string[] | ChannelHandlerTuple,
      handler as ChannelHandlerTuple | undefined,
    );
  }

  /** Reset the internal router (used in tests) */
  static reset(): void {
    Channel.#router = null;
  }
}
