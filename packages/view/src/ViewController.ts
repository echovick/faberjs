import { Injectable } from '@faber-js/core';
import { Controller } from '@faber-js/router';
import type { Response } from '@faber-js/http';
import { ViewResponse } from './ViewResponse';

@Injectable()
export abstract class ViewController extends Controller {
  protected makeView(name: string, data: Record<string, unknown> = {}): ViewResponse {
    return new ViewResponse(name, data);
  }

  protected async view(name: string, data: Record<string, unknown> = {}): Promise<Response> {
    return this.makeView(name, data).toResponse();
  }

  /**
   * Render a view and return only the named fragment as an HTML response.
   * Equivalent to `view(...)->fragment('name')` in Laravel.
   *
   * @example
   * return this.viewFragment('dashboard', 'user-list', { users });
   */
  protected async viewFragment(
    viewName: string,
    fragmentName: string,
    data: Record<string, unknown> = {},
  ): Promise<Response> {
    return this.makeView(viewName, data).toFragmentResponse(fragmentName);
  }

  /**
   * Return the full view response normally, or a fragment response when
   * `condition` is true. Useful for htmx/Turbo partial update requests.
   *
   * @example
   * return this.viewFragmentIf(
   *   request.hasHeader('HX-Request'),
   *   'dashboard',
   *   'user-list',
   *   { users },
   * );
   */
  protected async viewFragmentIf(
    condition: boolean,
    viewName: string,
    fragmentName: string,
    data: Record<string, unknown> = {},
  ): Promise<Response> {
    return this.makeView(viewName, data).toFragmentResponseIf(condition, fragmentName);
  }

  /**
   * Return the full view response normally, or a multi-fragment response
   * (concatenated) when `condition` is true.
   */
  protected async viewFragmentsIf(
    condition: boolean,
    viewName: string,
    fragmentNames: string[],
    data: Record<string, unknown> = {},
  ): Promise<Response> {
    return this.makeView(viewName, data).toFragmentsResponseIf(condition, fragmentNames);
  }
}
