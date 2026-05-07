import { Application } from '@faber-js/core';
import { Response } from '@faber-js/http';
import type { IViewResponse } from './types';
import type { ViewRenderer } from './ViewRenderer';
import { extractFragment, extractFragments } from './fragments';

export class ViewResponse implements IViewResponse {
  readonly #name: string;
  #data: Record<string, unknown>;

  constructor(name: string, data: Record<string, unknown> = {}) {
    this.#name = name;
    this.#data = { ...data };
    this.#fireCreators();
  }

  with(key: string, value: unknown): this;
  with(data: Record<string, unknown>): this;
  with(keyOrData: string | Record<string, unknown>, value?: unknown): this {
    if (typeof keyOrData === 'string') {
      this.#data[keyOrData] = value;
    } else {
      Object.assign(this.#data, keyOrData);
    }
    return this;
  }

  getName(): string {
    return this.#name;
  }

  getData(): Record<string, unknown> {
    return { ...this.#data };
  }

  async render(): Promise<string> {
    const renderer = Application.getInstance().make<ViewRenderer>('view.renderer');
    return renderer.renderView(this);
  }

  async toResponse(): Promise<Response> {
    const html = await this.render();
    return Response.html(html);
  }

  /**
   * Render and return only the content of the named fragment.
   * Equivalent to Laravel's `view(...)->fragment('name')`.
   */
  async fragment(name: string): Promise<string> {
    const html = await this.render();
    return extractFragment(html, name);
  }

  /**
   * Render and return a Response containing only the named fragment.
   */
  async toFragmentResponse(name: string): Promise<Response> {
    return Response.html(await this.fragment(name));
  }

  /**
   * Render and return concatenated content for multiple named fragments.
   */
  async fragments(names: string[]): Promise<string> {
    const html = await this.render();
    return extractFragments(html, names);
  }

  /**
   * Render and return concatenated content for multiple named fragments when
   * `condition` is true; otherwise return the full rendered view. Mirrors
   * Laravel's `->fragmentsIf(condition, [...names])`.
   */
  async fragmentsIf(condition: boolean, names: string[]): Promise<string> {
    const html = await this.render();
    return condition ? extractFragments(html, names) : html;
  }

  /**
   * Return a full response normally, or a fragment response when `condition`
   * is true. Mirrors Laravel's `->fragmentIf(condition, 'name')`.
   */
  async toFragmentResponseIf(condition: boolean, name: string): Promise<Response> {
    const html = await this.render();
    return Response.html(condition ? extractFragment(html, name) : html);
  }

  /**
   * Return a full response normally, or a multi-fragment response when
   * `condition` is true. Mirrors Laravel's `->fragmentsIf(...)`.
   */
  async toFragmentsResponseIf(condition: boolean, names: string[]): Promise<Response> {
    const html = await this.render();
    return Response.html(condition ? extractFragments(html, names) : html);
  }

  #fireCreators(): void {
    try {
      const renderer = Application.getInstance().make<ViewRenderer>('view.renderer');
      renderer.fireCreators(this);
    } catch {
      // No app context available (e.g. unit tests) — skip creators
    }
  }
}
