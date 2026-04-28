import { Injectable } from '@faber-js/core';
import { Controller } from '@faber-js/router';
import { Response } from '@faber-js/http';
import { markBridgeResponse } from './internal';

@Injectable()
export abstract class BridgeController extends Controller {
  protected render(component: string, props: Record<string, unknown> = {}): Response {
    const body: Record<string, unknown> = {};
    markBridgeResponse(body, component, props);
    return Response.json(body);
  }
}
