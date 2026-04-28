import { readFileSync, existsSync } from 'node:fs';
import { Response } from '@faber-js/http';
import type { Middleware, NextFunction, Request } from '@faber-js/http';
import type { SharedData } from './SharedData';
import type { BridgeConfig, BridgePage } from './types';
import { extractBridgeMeta } from './internal';

const DEFAULT_HTML_TEMPLATE = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>App</title>
</head>
<body>
  <div id="app" data-page="__BRIDGE_PAGE__"></div>
</body>
</html>`;

export class BridgeMiddleware implements Middleware {
  readonly #sharedData: SharedData;
  readonly #config: BridgeConfig;

  constructor(sharedData: SharedData, config: BridgeConfig) {
    this.#sharedData = sharedData;
    this.#config = config;
  }

  async handle(request: Request, next: NextFunction): Promise<Response> {
    const response = await next(request);
    const meta = extractBridgeMeta(response);

    if (!meta) return response;

    const sharedData = await this.#sharedData.all(request);
    const props: Record<string, unknown> = { ...sharedData, ...meta.rawProps };
    const version = this.#config.version;

    const isBridgeRequest = request.header('x-faber-bridge') === 'true';

    if (isBridgeRequest) {
      const clientVersion = request.header('x-faber-bridge-version');
      if (version && clientVersion && clientVersion !== version) {
        return Response.json(null, 409, {
          'x-faber-bridge-location': request.url(),
        });
      }

      const page: BridgePage = {
        component: meta.component,
        props,
        url: request.url(),
        version,
      };

      return Response.json(page, 200, {
        'x-faber-bridge': 'true',
        vary: 'x-faber-bridge',
      });
    }

    const page: BridgePage = {
      component: meta.component,
      props,
      url: request.url(),
      version,
    };

    const html = this.#buildHtml(page);
    return Response.html(html);
  }

  #buildHtml(page: BridgePage): string {
    const pageJson = JSON.stringify(page).replace(/'/g, '&#39;').replace(/</g, '\\u003c');
    const template = this.#loadTemplate();
    return template.replace('__BRIDGE_PAGE__', pageJson);
  }

  #loadTemplate(): string {
    const rootView = this.#config.rootView;
    if (rootView && existsSync(rootView)) {
      return readFileSync(rootView, 'utf-8');
    }
    return DEFAULT_HTML_TEMPLATE;
  }
}
