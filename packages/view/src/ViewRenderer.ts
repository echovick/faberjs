import { existsSync, readFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';
import { transformSync } from 'esbuild';
import { Application } from '@faber-js/core';
import type {
  ViewRendererConfig,
  ViewComponent,
  ComposerHandler,
  HookEntry,
  IViewResponse,
  ComposerClassInstance,
  ComposerClass,
} from './types';
import type { RawHtml } from './escape';
import { ViewNotFoundException } from './ViewNotFoundException';
import { renderStorage, createRenderContext } from './render-context';
import type { RenderContextStore } from './render-context';
import { extractFragment, extractFragments } from './fragments';

// Module-level mtime cache: reuses compiled output within a process when source is unchanged
const moduleCache = new Map<string, { mtime: number; exports: { default?: unknown } }>();

function isComposerClass(fn: ComposerHandler): fn is ComposerClass {
  return (
    typeof fn === 'function' &&
    fn.prototype !== undefined &&
    typeof (fn.prototype as Record<string, unknown>)['compose'] === 'function'
  );
}

export class ViewRenderer {
  readonly #config: ViewRendererConfig;
  readonly #sharedData: Record<string, unknown> = {};
  readonly #composers: HookEntry[] = [];
  readonly #creators: HookEntry[] = [];

  constructor(config: ViewRendererConfig) {
    this.#config = config;
  }

  get driver(): 'tsx' | 'ejs' {
    return this.#config.driver ?? 'tsx';
  }

  // ── Shared data ────────────────────────────────────────────────────

  share(key: string, value: unknown): void {
    this.#sharedData[key] = value;
  }

  // ── Composer / creator registration ───────────────────────────────

  addComposer(views: string | string[], handler: ComposerHandler): void {
    const patterns = Array.isArray(views) ? views : [views];
    for (const pattern of patterns) {
      this.#composers.push({ pattern, handler });
    }
  }

  addCreator(views: string | string[], handler: ComposerHandler): void {
    const patterns = Array.isArray(views) ? views : [views];
    for (const pattern of patterns) {
      this.#creators.push({ pattern, handler });
    }
  }

  // ── View existence checks ──────────────────────────────────────────

  exists(name: string): boolean {
    try {
      this.#resolveViewPath(name);
      return true;
    } catch {
      return false;
    }
  }

  findFirst(names: string[]): string {
    for (const name of names) {
      if (this.exists(name)) return name;
    }
    throw new ViewNotFoundException(names[0] ?? 'unknown', '(none of the candidates exist)');
  }

  // ── Hook firing ────────────────────────────────────────────────────

  fireCreators(view: IViewResponse): void {
    for (const entry of this.#creators) {
      if (!this.#matchesPattern(entry.pattern, view.getName())) continue;
      this.#invokeHandler(entry.handler, view);
    }
  }

  async fireComposers(view: IViewResponse): Promise<void> {
    for (const entry of this.#composers) {
      if (!this.#matchesPattern(entry.pattern, view.getName())) continue;
      await this.#invokeHandlerAsync(entry.handler, view);
    }
  }

  // ── High-level render (for ViewResponse) ──────────────────────────

  async renderView(
    viewResponse: IViewResponse,
    contextOptions: Partial<
      Pick<RenderContextStore, 'csrf' | 'errors' | 'errorBags' | 'auth' | 'session'>
    > = {},
  ): Promise<string> {
    await this.fireComposers(viewResponse);
    const data = { ...this.#sharedData, ...viewResponse.getData() };
    return renderStorage.run(createRenderContext(contextOptions), () =>
      this.#renderInternal(viewResponse.getName(), data),
    );
  }

  // ── Low-level render (direct name + props) ─────────────────────────

  renderComponent<P extends Record<string, unknown>>(
    component: ViewComponent<P>,
    props: P,
    contextOptions: Partial<
      Pick<RenderContextStore, 'csrf' | 'errors' | 'errorBags' | 'auth' | 'session'>
    > = {},
  ): string {
    return renderStorage.run(createRenderContext(contextOptions), () => component(props).html);
  }

  async render<P extends Record<string, unknown>>(
    name: string,
    props: P,
    contextOptions: Partial<
      Pick<RenderContextStore, 'csrf' | 'errors' | 'errorBags' | 'auth' | 'session'>
    > = {},
  ): Promise<string> {
    const merged = { ...this.#sharedData, ...props };
    return renderStorage.run(createRenderContext(contextOptions), () =>
      this.#renderInternal(name, merged),
    );
  }

  // ── Fragment rendering ─────────────────────────────────────────────

  /**
   * Renders a view and returns only the content of the named fragment.
   * Equivalent to: `view('dashboard', data)->fragment('user-list')` in Laravel.
   */
  async renderFragment<P extends Record<string, unknown>>(
    fragmentName: string,
    viewName: string,
    props: P,
    contextOptions: Partial<
      Pick<RenderContextStore, 'csrf' | 'errors' | 'errorBags' | 'auth' | 'session'>
    > = {},
  ): Promise<string> {
    const html = await this.render(viewName, props, contextOptions);
    return extractFragment(html, fragmentName);
  }

  /**
   * Renders a view and returns concatenated content for multiple named fragments.
   */
  async renderFragments<P extends Record<string, unknown>>(
    fragmentNames: string[],
    viewName: string,
    props: P,
    contextOptions: Partial<
      Pick<RenderContextStore, 'csrf' | 'errors' | 'errorBags' | 'auth' | 'session'>
    > = {},
  ): Promise<string> {
    const html = await this.render(viewName, props, contextOptions);
    return extractFragments(html, fragmentNames);
  }

  /**
   * Renders only the named fragment when `condition` is true; otherwise
   * renders the full view.
   */
  async renderFragmentIf<P extends Record<string, unknown>>(
    condition: boolean,
    fragmentName: string,
    viewName: string,
    props: P,
    contextOptions: Partial<
      Pick<RenderContextStore, 'csrf' | 'errors' | 'errorBags' | 'auth' | 'session'>
    > = {},
  ): Promise<string> {
    const html = await this.render(viewName, props, contextOptions);
    if (!condition) return html;
    return extractFragment(html, fragmentName);
  }

  /**
   * Renders only the named fragments (concatenated) when `condition` is
   * true; otherwise renders the full view.
   */
  async renderFragmentsIf<P extends Record<string, unknown>>(
    condition: boolean,
    fragmentNames: string[],
    viewName: string,
    props: P,
    contextOptions: Partial<
      Pick<RenderContextStore, 'csrf' | 'errors' | 'errorBags' | 'auth' | 'session'>
    > = {},
  ): Promise<string> {
    const html = await this.render(viewName, props, contextOptions);
    if (!condition) return html;
    return extractFragments(html, fragmentNames);
  }

  // ── Inline rendering ───────────────────────────────────────────────

  /**
   * Compiles and renders an inline TSX template string. The template must
   * export a default function component. The views directory is used as the
   * base path for module resolution.
   *
   * @example
   * await renderer.renderString(
   *   `export default function({ name }: { name: string }) {
   *     return <p>Hello {name}</p>;
   *   }`,
   *   { name: 'Julian' },
   * )
   */
  async renderString<P extends Record<string, unknown>>(
    template: string,
    props: P,
    contextOptions: Partial<
      Pick<RenderContextStore, 'csrf' | 'errors' | 'errorBags' | 'auth' | 'session'>
    > = {},
  ): Promise<string> {
    const mod = this.#compileInlineString<P>(template);
    if (typeof mod.default !== 'function') {
      throw new Error('renderString: the template must export a default function component.');
    }
    return renderStorage.run(createRenderContext(contextOptions), () => {
      const result = (mod.default as ViewComponent<P>)(props);
      return result.html;
    });
  }

  // ── Internals ──────────────────────────────────────────────────────

  async #renderInternal(name: string, data: Record<string, unknown>): Promise<string> {
    const resolved = this.#resolveViewPath(name);

    if (this.driver === 'ejs') {
      return this.#renderEjs(resolved, data);
    }

    const mod =
      resolved.endsWith('.tsx') || resolved.endsWith('.ts')
        ? this.#compileTsxModule(resolved)
        : ((await import(pathToFileURL(resolved).href)) as {
            default?:
              | ViewComponent<Record<string, unknown>>
              | ((props: Record<string, unknown>) => RawHtml);
          });

    if (typeof mod.default !== 'function') {
      throw new ViewNotFoundException(name, resolved);
    }

    const result = mod.default(data);
    const html = result.html;
    return html.trimStart().startsWith('<html') ? `<!DOCTYPE html>${html}` : html;
  }

  #compileTsxModule(filePath: string): {
    default?:
      | ViewComponent<Record<string, unknown>>
      | ((props: Record<string, unknown>) => RawHtml);
  } {
    // Check disk cache first (written by view:cache)
    const diskCached = this.#loadDiskCache(filePath);
    if (diskCached) return diskCached;

    // Check in-memory mtime cache
    const mtime = statSync(filePath).mtimeMs;
    const cached = moduleCache.get(filePath);
    if (cached && cached.mtime === mtime) {
      return cached.exports as { default?: ViewComponent<Record<string, unknown>> };
    }

    const source = readFileSync(filePath, 'utf8');
    const { code } = transformSync(source, {
      loader: 'tsx',
      format: 'cjs',
      jsx: 'automatic',
      jsxImportSource: '@faber-js/view',
      target: 'node16',
    });

    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const NodeModule = require('module') as any;
    const m = new NodeModule(filePath) as {
      filename: string;
      paths: string[];
      require: NodeRequire;
      exports: unknown;
      _compile(code: string, filename: string): void;
    };
    m.filename = filePath;
    m.paths = NodeModule._nodeModulePaths(dirname(filePath)) as string[];
    m.require = createRequire(filePath);
    m._compile(code, filePath);

    const exports = m.exports as { default?: ViewComponent<Record<string, unknown>> };
    moduleCache.set(filePath, { mtime, exports });
    return exports;
  }

  #compileInlineString<P extends Record<string, unknown>>(
    template: string,
  ): { default?: ViewComponent<P> | ((props: P) => RawHtml) } {
    const { code } = transformSync(template, {
      loader: 'tsx',
      format: 'cjs',
      jsx: 'automatic',
      jsxImportSource: '@faber-js/view',
      target: 'node16',
    });
    // Use the views directory as the base so node_modules resolve correctly.
    const virtualPath = join(this.#config.viewsDir, '__inline_render__.tsx');
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const NodeModule = require('module') as any;
    const m = new NodeModule(virtualPath) as {
      filename: string;
      paths: string[];
      require: NodeRequire;
      exports: unknown;
      _compile(code: string, filename: string): void;
    };
    m.filename = virtualPath;
    m.paths = NodeModule._nodeModulePaths(dirname(virtualPath)) as string[];
    m.require = createRequire(virtualPath);
    m._compile(code, virtualPath);
    return m.exports as { default?: ViewComponent<P> | ((props: P) => RawHtml) };
  }

  #loadDiskCache(filePath: string): { default?: ViewComponent<Record<string, unknown>> } | null {
    if (!this.#config.cacheDir) return null;

    const viewsDir = this.#config.viewsDir;
    const relative = filePath.startsWith(viewsDir) ? filePath.slice(viewsDir.length + 1) : null;
    if (!relative) return null;

    const cacheFile = join(this.#config.cacheDir, `${relative}.js`);
    if (!existsSync(cacheFile)) return null;

    const sourceMtime = statSync(filePath).mtimeMs;
    const cacheMtime = statSync(cacheFile).mtimeMs;
    if (cacheMtime <= sourceMtime) return null;

    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-explicit-any
    const NodeModule = require('module') as any;
    const m = new NodeModule(cacheFile) as {
      filename: string;
      paths: string[];
      require: NodeRequire;
      exports: unknown;
      _compile(code: string, filename: string): void;
    };
    m.filename = cacheFile;
    m.paths = NodeModule._nodeModulePaths(dirname(cacheFile)) as string[];
    m.require = createRequire(cacheFile);
    const code = readFileSync(cacheFile, 'utf8');
    m._compile(code, cacheFile);
    return m.exports as { default?: ViewComponent<Record<string, unknown>> };
  }

  #renderEjs(filePath: string, props: Record<string, unknown>): string {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const ejs = require('ejs') as {
      render(
        template: string,
        data: Record<string, unknown>,
        opts?: Record<string, unknown>,
      ): string;
    };
    const template = readFileSync(filePath, 'utf8');
    return ejs.render(template, props, { filename: filePath });
  }

  #resolveViewPath(name: string): string {
    this.#validateViewName(name);
    const defaultExt = this.driver === 'ejs' ? '.view.ejs' : '.view.tsx';
    const ext = this.#config.extension ?? defaultExt;
    const normalized = name.replace(/\./g, '/');
    const base = join(this.#config.viewsDir, normalized);
    const candidates = [`${base}${ext}`, join(base, `index${ext}`)];

    for (const candidate of candidates) {
      if (existsSync(candidate)) return candidate;
    }

    throw new ViewNotFoundException(name, candidates[0]);
  }

  // Dots are reserved as directory separators (Laravel parity), so a name
  // like `admin..profile`, `.profile`, or `profile.` produces an empty path
  // segment after splitting. The same check rejects `..` traversal attempts
  // (e.g. `users/../etc`) since they always contain consecutive dots.
  #validateViewName(name: string): void {
    if (typeof name !== 'string' || name.length === 0) {
      throw new Error('View name must be a non-empty string.');
    }
    const segments = name.split('.');
    for (const segment of segments) {
      if (segment.length === 0) {
        throw new Error(
          `Invalid view name "${name}": dots are reserved as directory separators, so leading, trailing, or consecutive dots are not allowed. View directory names must not contain "."`,
        );
      }
    }
  }

  // Glob-style match: `*` matches any sequence of characters (including dots),
  // matching Laravel's `Str::is()` semantics. Other regex metacharacters are
  // escaped, so patterns like `admin.*` and `*.profile` work as expected.
  #matchesPattern(pattern: string, viewName: string): boolean {
    if (pattern === '*' || pattern === viewName) return true;
    if (!pattern.includes('*')) return false;
    const regex = new RegExp(
      '^' + pattern.replace(/[\\^$.()+?|[\]{}]/g, '\\$&').replace(/\*/g, '.*') + '$',
    );
    return regex.test(viewName);
  }

  #invokeHandler(handler: ComposerHandler, view: IViewResponse): void {
    if (isComposerClass(handler)) {
      try {
        const instance = Application.getInstance().make<ComposerClassInstance>(
          handler as unknown as string,
        );
        void instance.compose(view);
      } catch {
        const instance = new (handler as ComposerClass)();
        void instance.compose(view);
      }
    } else {
      void (handler as (v: IViewResponse) => void | Promise<void>)(view);
    }
  }

  async #invokeHandlerAsync(handler: ComposerHandler, view: IViewResponse): Promise<void> {
    if (isComposerClass(handler)) {
      try {
        const instance = Application.getInstance().make<ComposerClassInstance>(
          handler as unknown as string,
        );
        await instance.compose(view);
      } catch {
        const instance = new (handler as ComposerClass)();
        await instance.compose(view);
      }
    } else {
      await (handler as (v: IViewResponse) => void | Promise<void>)(view);
    }
  }
}
