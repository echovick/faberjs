import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { escape, raw, RawHtml } from './escape';
import { jsx, jsxs, h, Fragment, Unsafe, renderChildren } from './jsx-runtime';
import { ViewRenderer } from './ViewRenderer';
import { ViewResponse } from './ViewResponse';
import { ViewNotFoundException } from './ViewNotFoundException';
import { cls, styleMap, checked, selected, disabled, readonly, required } from './helpers';
import { loop } from './loop';
import { ValidationErrors, CsrfField, MethodField, FieldError } from './forms';
import { Slot, useSlots } from './slots';
import { Push, Prepend, PushIf, PushOnce, PrependOnce, Stack, HasStack, Once } from './stacks';
import { Section, Yield, HasSection, SectionMissing, ParentSection } from './inheritance';
import { ViewFragment } from './fragments';
import { Env, EnvNot, Production } from './env';
import { withRenderContext } from './render-context';
import { AttributeBag, PrependsValue, attributeBag } from './attribute-bag';
import { Auth, Guest, useAuth } from './auth';
import { Session, useSession } from './session';
import { Aware, useAware, provideAware } from './aware';
import { Js } from './js';
import { registerStringable, clearStringables } from './stringable';
import { DynamicComponent, registerComponent, clearComponents } from './dynamic-component';
import { useService } from './services';
import { Application } from '@faber-js/core';

// ── escape() ────────────────────────────────────────────────────────

describe('escape()', () => {
  it('escapes & < > " \' in strings', () => {
    expect(escape('A & <B> "C" \'D\'')).toBe('A &amp; &lt;B&gt; &quot;C&quot; &#39;D&#39;');
  });

  it('returns empty string for null', () => {
    expect(escape(null)).toBe('');
  });

  it('returns empty string for undefined', () => {
    expect(escape(undefined)).toBe('');
  });

  it('returns empty string for false', () => {
    expect(escape(false)).toBe('');
  });

  it('coerces numbers to string without escaping', () => {
    expect(escape(42)).toBe('42');
  });

  it('passes RawHtml through without escaping', () => {
    const r = new RawHtml('<b>bold</b>');
    expect(escape(r)).toBe('<b>bold</b>');
  });
});

// ── h() ─────────────────────────────────────────────────────────────

describe('h()', () => {
  it('renders an intrinsic element with text child', () => {
    expect(h('div', null, 'Hello').html).toBe('<div>Hello</div>');
  });

  it('escapes text children', () => {
    expect(h('p', null, '<script>alert(1)</script>').html).toBe(
      '<p>&lt;script&gt;alert(1)&lt;/script&gt;</p>',
    );
  });

  it('renders element with attributes', () => {
    expect(h('a', { href: '/path', class: 'btn' }, 'Click').html).toBe(
      '<a href="/path" class="btn">Click</a>',
    );
  });

  it('maps className to class', () => {
    expect(h('div', { className: 'container' }).html).toBe('<div class="container"></div>');
  });

  it('renders void elements without closing tag', () => {
    expect(h('br', null).html).toBe('<br>');
    expect(h('img', { src: '/img.png', alt: 'test' }).html).toBe('<img src="/img.png" alt="test">');
  });

  it('renders boolean attributes as bare name when true', () => {
    expect(h('input', { type: 'checkbox', checked: true }).html).toBe(
      '<input type="checkbox" checked>',
    );
  });

  it('omits boolean attributes when false', () => {
    expect(h('input', { type: 'checkbox', checked: false }).html).toBe('<input type="checkbox">');
  });

  it('omits null and undefined attributes', () => {
    expect(h('div', { id: null, class: undefined }).html).toBe('<div></div>');
  });

  it('renders a component function', () => {
    const Greeting = ({ name }: Record<string, unknown>): RawHtml =>
      new RawHtml(`<p>Hello, ${String(name)}!</p>`);
    expect(h(Greeting, { name: 'World' }).html).toBe('<p>Hello, World!</p>');
  });

  it('renders multiple children', () => {
    expect(h('ul', null, h('li', null, 'A'), h('li', null, 'B')).html).toBe(
      '<ul><li>A</li><li>B</li></ul>',
    );
  });

  it('skips null/undefined/false children', () => {
    expect(h('div', null, null, false, undefined, 'text').html).toBe('<div>text</div>');
  });

  it('renders numeric children', () => {
    expect(h('span', null, 42).html).toBe('<span>42</span>');
  });

  it('returns a RawHtml instance', () => {
    expect(h('div', null)).toBeInstanceOf(RawHtml);
  });
});

// ── jsx() ────────────────────────────────────────────────────────────

describe('jsx()', () => {
  it('renders element with children in props', () => {
    expect(jsx('span', { children: 'hi' }).html).toBe('<span>hi</span>');
  });

  it('escapes string children', () => {
    expect(jsx('p', { children: '<evil>' }).html).toBe('<p>&lt;evil&gt;</p>');
  });

  it('renders a component function', () => {
    const Bold = ({ children }: Record<string, unknown>): RawHtml =>
      new RawHtml(`<b>${String(children)}</b>`);
    expect(jsx(Bold, { children: 'text' }).html).toBe('<b>text</b>');
  });

  it('returns a RawHtml instance', () => {
    expect(jsx('div', {})).toBeInstanceOf(RawHtml);
  });
});

// ── jsxs() ───────────────────────────────────────────────────────────

describe('jsxs()', () => {
  it('renders element with array children', () => {
    const a = h('li', null, 'A');
    const b = h('li', null, 'B');
    expect(jsxs('ul', { children: [a, b] }).html).toBe('<ul><li>A</li><li>B</li></ul>');
  });

  it('skips false entries in children array', () => {
    expect(jsxs('div', { children: [false, h('span', null, 'yes')] }).html).toBe(
      '<div><span>yes</span></div>',
    );
  });
});

// ── Fragment ──────────────────────────────────────────────────────────

describe('Fragment', () => {
  it('renders children without a wrapper element', () => {
    const result = Fragment({
      children: [h('span', null, 'A'), h('span', null, 'B')],
    });
    expect(result.html).toBe('<span>A</span><span>B</span>');
  });

  it('returns empty string for no children', () => {
    expect(Fragment({}).html).toBe('');
  });
});

// ── Unsafe ────────────────────────────────────────────────────────────

describe('Unsafe', () => {
  it('renders raw HTML without escaping', () => {
    const result = Unsafe({ html: '<b>bold</b><script>alert(1)</script>' });
    expect(result.html).toBe('<b>bold</b><script>alert(1)</script>');
  });

  it('passes through as-is when used as child of an element', () => {
    const inner = Unsafe({ html: '<em>hi</em>' });
    expect(h('div', null, inner).html).toBe('<div><em>hi</em></div>');
  });

  it('returns a RawHtml instance', () => {
    expect(Unsafe({ html: '' })).toBeInstanceOf(RawHtml);
  });
});

// ── raw() helper ──────────────────────────────────────────────────────

describe('raw()', () => {
  it('creates a RawHtml that is not escaped when used as child', () => {
    const r = raw('<strong>bold</strong>');
    expect(h('p', null, r).html).toBe('<p><strong>bold</strong></p>');
  });
});

// ── ViewRenderer ──────────────────────────────────────────────────────

describe('ViewRenderer', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `faber-view-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  describe('renderComponent()', () => {
    it('calls the component with props and returns HTML string', () => {
      const renderer = new ViewRenderer({ viewsDir: tmpDir });
      const component = ({ title }: { title: string }): RawHtml => new RawHtml(`<h1>${title}</h1>`);
      expect(renderer.renderComponent(component, { title: 'Hello' })).toBe('<h1>Hello</h1>');
    });
  });

  describe('render()', () => {
    it('loads and renders a view file by name', async () => {
      const fileName = `view-${Date.now()}.view.mjs`;
      writeFileSync(
        join(tmpDir, fileName),
        `export default function View({ title }) { return { html: '<h1>' + title + '</h1>' }; }\n`,
      );
      const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: `.view.mjs` });
      const name = fileName.replace('.view.mjs', '');
      const result = await renderer.render(name, { title: 'Hello' });
      expect(result).toBe('<h1>Hello</h1>');
    });

    it('prepends <!DOCTYPE html> when root element begins with <html', async () => {
      const fileName = `page-${Date.now()}.view.mjs`;
      writeFileSync(
        join(tmpDir, fileName),
        `export default function Page() { return { html: '<html><head></head><body>hi</body></html>' }; }\n`,
      );
      const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
      const name = fileName.replace('.view.mjs', '');
      const result = await renderer.render(name, {});
      expect(result).toBe('<!DOCTYPE html><html><head></head><body>hi</body></html>');
    });

    it('throws ViewNotFoundException when view file does not exist', async () => {
      const renderer = new ViewRenderer({ viewsDir: tmpDir });
      await expect(renderer.render('nonexistent', {})).rejects.toThrow(ViewNotFoundException);
    });

    it('includes the attempted path in the ViewNotFoundException message', async () => {
      const renderer = new ViewRenderer({ viewsDir: tmpDir });
      await expect(renderer.render('missing/view', {})).rejects.toThrow(/missing/);
    });

    it('resolves index file for directory-style view names', async () => {
      const subDir = join(tmpDir, 'users');
      mkdirSync(subDir);
      const fileName = `idx-${Date.now()}.view.mjs`;
      writeFileSync(
        join(subDir, fileName),
        `export default function UserIndex({ count }) { return { html: '<p>' + count + ' users</p>' }; }\n`,
      );
      const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
      const name = `users/${fileName.replace('.view.mjs', '')}`;
      const result = await renderer.render(name, { count: 5 });
      expect(result).toBe('<p>5 users</p>');
    });
  });
});

// ── ViewNotFoundException ─────────────────────────────────────────────

describe('ViewNotFoundException', () => {
  it('includes the view name and attempted path in the message', () => {
    const err = new ViewNotFoundException(
      'users/index',
      '/app/resources/views/users/index.view.tsx',
    );
    expect(err.message).toContain('users/index');
    expect(err.message).toContain('/app/resources/views/users/index.view.tsx');
    expect(err.name).toBe('ViewNotFoundException');
  });
});

// ── ViewResponse ──────────────────────────────────────────────────────

describe('ViewResponse', () => {
  it('stores the view name', () => {
    const vr = new ViewResponse('greeting');
    expect(vr.getName()).toBe('greeting');
  });

  it('stores initial data', () => {
    const vr = new ViewResponse('greeting', { name: 'James' });
    expect(vr.getData()).toEqual({ name: 'James' });
  });

  it('with(key, value) adds a single value and returns this', () => {
    const vr = new ViewResponse('greeting');
    const returned = vr.with('name', 'Victoria');
    expect(returned).toBe(vr);
    expect(vr.getData()).toEqual({ name: 'Victoria' });
  });

  it('with(object) merges multiple values', () => {
    const vr = new ViewResponse('greeting');
    vr.with({ name: 'Victoria', occupation: 'Astronaut' });
    expect(vr.getData()).toEqual({ name: 'Victoria', occupation: 'Astronaut' });
  });

  it('getData() returns a copy, not the internal reference', () => {
    const vr = new ViewResponse('greeting', { name: 'James' });
    const data = vr.getData();
    data['name'] = 'mutated';
    expect(vr.getData()['name']).toBe('James');
  });

  it('chains .with() calls fluently', () => {
    const vr = new ViewResponse('greeting')
      .with('name', 'Victoria')
      .with('occupation', 'Astronaut');
    expect(vr.getData()).toEqual({ name: 'Victoria', occupation: 'Astronaut' });
  });
});

// ── ViewRenderer — shared data ─────────────────────────────────────────

describe('ViewRenderer.share()', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `faber-view-share-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it('merges shared data into every render call', async () => {
    const fileName = `shared-${Date.now()}.view.mjs`;
    writeFileSync(
      join(tmpDir, fileName),
      `export default function V({ appName, title }) { return { html: appName + ':' + title }; }\n`,
    );
    const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
    renderer.share('appName', 'FaberJS');
    const name = fileName.replace('.view.mjs', '');
    const result = await renderer.render(name, { title: 'Home' });
    expect(result).toBe('FaberJS:Home');
  });

  it('view-specific data overrides shared data', async () => {
    const fileName = `override-${Date.now()}.view.mjs`;
    writeFileSync(
      join(tmpDir, fileName),
      `export default function V({ key }) { return { html: key }; }\n`,
    );
    const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
    renderer.share('key', 'shared');
    const name = fileName.replace('.view.mjs', '');
    const result = await renderer.render(name, { key: 'specific' });
    expect(result).toBe('specific');
  });
});

// ── ViewRenderer — exists() and findFirst() ────────────────────────────

describe('ViewRenderer.exists()', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `faber-view-exists-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it('returns true when the view file exists', () => {
    writeFileSync(join(tmpDir, 'home.view.mjs'), 'export default () => ({ html: "" });\n');
    const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
    expect(renderer.exists('home')).toBe(true);
  });

  it('returns false when the view file does not exist', () => {
    const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
    expect(renderer.exists('nonexistent')).toBe(false);
  });
});

describe('ViewRenderer.findFirst()', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `faber-view-first-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it('returns the first existing name from the list', () => {
    writeFileSync(join(tmpDir, 'admin.view.mjs'), 'export default () => ({ html: "" });\n');
    const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
    expect(renderer.findFirst(['custom.admin', 'admin'])).toBe('admin');
  });

  it('throws ViewNotFoundException when none exist', () => {
    const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
    expect(() => renderer.findFirst(['a', 'b'])).toThrow(ViewNotFoundException);
  });
});

// ── ViewRenderer — composers ───────────────────────────────────────────

describe('ViewRenderer composers', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `faber-view-compose-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it('fires a closure composer before render and injects data', async () => {
    const fileName = `compose-${Date.now()}.view.mjs`;
    writeFileSync(
      join(tmpDir, fileName),
      `export default function V({ count }) { return { html: String(count) }; }\n`,
    );
    const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
    const viewName = fileName.replace('.view.mjs', '');
    renderer.addComposer(viewName, (v) => {
      v.with('count', 42);
    });

    const vr = new ViewResponse(viewName);
    const result = await renderer.renderView(vr);
    expect(result).toBe('42');
  });

  it('wildcard * composer fires for any view', async () => {
    const fileName = `wildcard-${Date.now()}.view.mjs`;
    writeFileSync(
      join(tmpDir, fileName),
      `export default function V({ tag }) { return { html: tag }; }\n`,
    );
    const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
    const viewName = fileName.replace('.view.mjs', '');
    renderer.addComposer('*', (v) => {
      v.with('tag', 'global');
    });

    const vr = new ViewResponse(viewName);
    const result = await renderer.renderView(vr);
    expect(result).toBe('global');
  });

  it('composer does not fire for non-matching view name', async () => {
    const fileName = `nomatch-${Date.now()}.view.mjs`;
    writeFileSync(
      join(tmpDir, fileName),
      `export default function V({ injected }) { return { html: injected ?? 'none' }; }\n`,
    );
    const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
    const viewName = fileName.replace('.view.mjs', '');
    renderer.addComposer('other.view', (v) => {
      v.with('injected', 'yes');
    });

    const vr = new ViewResponse(viewName);
    const result = await renderer.renderView(vr);
    expect(result).toBe('none');
  });

  it('multiple view names can be attached to one composer', async () => {
    const fn1 = `multi1-${Date.now()}.view.mjs`;
    const fn2 = `multi2-${Date.now()}.view.mjs`;
    const template = `export default function V({ badge }) { return { html: badge }; }\n`;
    writeFileSync(join(tmpDir, fn1), template);
    writeFileSync(join(tmpDir, fn2), template);

    const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
    const v1 = fn1.replace('.view.mjs', '');
    const v2 = fn2.replace('.view.mjs', '');
    renderer.addComposer([v1, v2], (v) => {
      v.with('badge', 'shared-composer');
    });

    for (const name of [v1, v2]) {
      const vr = new ViewResponse(name);
      const result = await renderer.renderView(vr);
      expect(result).toBe('shared-composer');
    }
  });

  it('glob pattern composer (admin.*) fires for matching nested views', async () => {
    mkdirSync(join(tmpDir, 'admin'), { recursive: true });
    const template = `export default function V({ tag }) { return { html: tag ?? 'none' }; }\n`;
    writeFileSync(join(tmpDir, 'admin', 'profile.view.mjs'), template);
    writeFileSync(join(tmpDir, 'admin', 'dashboard.view.mjs'), template);
    writeFileSync(join(tmpDir, 'public.view.mjs'), template);

    const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
    renderer.addComposer('admin.*', (v) => {
      v.with('tag', 'admin-zone');
    });

    expect(await renderer.renderView(new ViewResponse('admin.profile'))).toBe('admin-zone');
    expect(await renderer.renderView(new ViewResponse('admin.dashboard'))).toBe('admin-zone');
    expect(await renderer.renderView(new ViewResponse('public'))).toBe('none');
  });

  it('glob pattern composer (*.profile) matches by suffix segment', async () => {
    mkdirSync(join(tmpDir, 'admin'), { recursive: true });
    mkdirSync(join(tmpDir, 'user'), { recursive: true });
    const template = `export default function V({ tag }) { return { html: tag ?? 'none' }; }\n`;
    writeFileSync(join(tmpDir, 'admin', 'profile.view.mjs'), template);
    writeFileSync(join(tmpDir, 'user', 'profile.view.mjs'), template);
    writeFileSync(join(tmpDir, 'user', 'settings.view.mjs'), template);

    const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
    renderer.addComposer('*.profile', (v) => {
      v.with('tag', 'profile-shared');
    });

    expect(await renderer.renderView(new ViewResponse('admin.profile'))).toBe('profile-shared');
    expect(await renderer.renderView(new ViewResponse('user.profile'))).toBe('profile-shared');
    expect(await renderer.renderView(new ViewResponse('user.settings'))).toBe('none');
  });

  it('glob * matches across multiple dot segments', async () => {
    mkdirSync(join(tmpDir, 'admin', 'users'), { recursive: true });
    const template = `export default function V({ tag }) { return { html: tag ?? 'none' }; }\n`;
    writeFileSync(join(tmpDir, 'admin', 'users', 'index.view.mjs'), template);

    const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
    renderer.addComposer('admin.*', (v) => {
      v.with('tag', 'deep');
    });

    expect(await renderer.renderView(new ViewResponse('admin.users.index'))).toBe('deep');
  });
});

// ── ViewRenderer — view name validation ────────────────────────────────

describe('ViewRenderer view name validation', () => {
  const renderer = new ViewRenderer({ viewsDir: '/tmp/never', extension: '.view.mjs' });

  it('exists() returns false for invalid names with empty segments', () => {
    expect(renderer.exists('.profile')).toBe(false);
    expect(renderer.exists('profile.')).toBe(false);
    expect(renderer.exists('admin..profile')).toBe(false);
    expect(renderer.exists('')).toBe(false);
  });

  it('rendering an invalid view name throws a clear error', async () => {
    await expect(renderer.render('admin..profile', {})).rejects.toThrow(
      /dots are reserved as directory separators/,
    );
    await expect(renderer.render('.profile', {})).rejects.toThrow(
      /dots are reserved as directory separators/,
    );
    await expect(renderer.render('profile.', {})).rejects.toThrow(
      /dots are reserved as directory separators/,
    );
  });

  it('rejects path-traversal attempts via consecutive dots', async () => {
    await expect(renderer.render('users/../etc', {})).rejects.toThrow(
      /dots are reserved as directory separators/,
    );
    await expect(renderer.render('..', {})).rejects.toThrow(
      /dots are reserved as directory separators/,
    );
  });
});

// ── ViewRenderer — creators ────────────────────────────────────────────

describe('ViewRenderer creators', () => {
  it('fires a creator synchronously via fireCreators()', () => {
    const renderer = new ViewRenderer({ viewsDir: '/tmp', extension: '.view.mjs' });
    renderer.addCreator('greeting', (v) => {
      v.with('preloaded', true);
    });

    const vr = new ViewResponse('greeting');
    renderer.fireCreators(vr);
    expect(vr.getData()['preloaded']).toBe(true);
  });

  it('creator does not fire for non-matching view', () => {
    const renderer = new ViewRenderer({ viewsDir: '/tmp', extension: '.view.mjs' });
    renderer.addCreator('dashboard', (v) => {
      v.with('loaded', true);
    });

    const vr = new ViewResponse('profile');
    renderer.fireCreators(vr);
    expect(vr.getData()['loaded']).toBeUndefined();
  });
});

// ── ViewRenderer — mtime cache ─────────────────────────────────────────

describe('ViewRenderer mtime cache', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(
      tmpdir(),
      `faber-view-cache-${Date.now()}-${Math.random().toString(36).slice(2)}`,
    );
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it('renders the same TSX file twice without error (cache hit on second call)', async () => {
    const fileName = 'cacheable.view.tsx';
    writeFileSync(
      join(tmpDir, fileName),
      `/** @jsxImportSource @faber-js/view */\nexport default function V({ msg }: { msg: string }) {\n  return <span>{msg}</span>;\n}\n`,
    );
    const renderer = new ViewRenderer({ viewsDir: tmpDir });
    const result1 = await renderer.render('cacheable', { msg: 'first' });
    const result2 = await renderer.render('cacheable', { msg: 'second' });
    expect(result1).toBe('<span>first</span>');
    expect(result2).toBe('<span>second</span>');
  });
});

// ── cls() ─────────────────────────────────────────────────────────────

describe('cls()', () => {
  it('joins plain string arguments', () => {
    expect(cls('p-4', 'mt-2')).toBe('p-4 mt-2');
  });

  it('includes object keys whose values are truthy', () => {
    expect(cls({ 'font-bold': true, 'text-red': false })).toBe('font-bold');
  });

  it('mixes strings and objects', () => {
    expect(cls('p-4', { 'font-bold': true, 'text-gray': false })).toBe('p-4 font-bold');
  });

  it('ignores falsy arguments', () => {
    expect(cls('a', false, null, undefined, 0, 'b')).toBe('a b');
  });

  it('returns empty string when all arguments are falsy', () => {
    expect(cls(false, null, undefined)).toBe('');
  });
});

// ── styleMap() ────────────────────────────────────────────────────────

describe('styleMap()', () => {
  it('joins rules whose values are truthy', () => {
    expect(styleMap({ 'color: red': true, 'font-weight: bold': false })).toBe('color: red');
  });

  it('joins multiple truthy rules', () => {
    expect(styleMap({ 'color: red': true, 'font-weight: bold': true })).toBe(
      'color: red; font-weight: bold',
    );
  });

  it('returns empty string when all rules are false', () => {
    expect(styleMap({ 'color: red': false })).toBe('');
  });
});

// ── Form attribute helpers ─────────────────────────────────────────────

describe('form attribute helpers', () => {
  it('checked() returns true for a truthy value', () => {
    expect(checked(true)).toBe(true);
    expect(checked(1)).toBe(true);
  });

  it('checked() returns undefined for a falsy value', () => {
    expect(checked(false)).toBeUndefined();
    expect(checked(0)).toBeUndefined();
    expect(checked(null)).toBeUndefined();
  });

  it('selected(), disabled(), readonly(), required() follow the same logic', () => {
    expect(selected(true)).toBe(true);
    expect(selected(false)).toBeUndefined();
    expect(disabled(true)).toBe(true);
    expect(disabled(false)).toBeUndefined();
    expect(readonly(true)).toBe(true);
    expect(readonly(false)).toBeUndefined();
    expect(required(true)).toBe(true);
    expect(required(false)).toBeUndefined();
  });

  it('renders correctly as a JSX boolean attribute', () => {
    expect(h('input', { type: 'checkbox', checked: checked(true) }).html).toBe(
      '<input type="checkbox" checked>',
    );
    expect(h('input', { type: 'checkbox', checked: checked(false) }).html).toBe(
      '<input type="checkbox">',
    );
  });
});

// ── loop() ────────────────────────────────────────────────────────────

describe('loop()', () => {
  it('provides index and iteration', () => {
    const metas = ['a', 'b', 'c'].map(loop((_, $l) => $l));
    expect(metas[0].index).toBe(0);
    expect(metas[0].iteration).toBe(1);
    expect(metas[2].index).toBe(2);
    expect(metas[2].iteration).toBe(3);
  });

  it('provides count, remaining, first, last', () => {
    const metas = [10, 20, 30].map(loop((_, $l) => $l));
    expect(metas[0].count).toBe(3);
    expect(metas[0].first).toBe(true);
    expect(metas[0].last).toBe(false);
    expect(metas[0].remaining).toBe(2);
    expect(metas[2].last).toBe(true);
    expect(metas[2].remaining).toBe(0);
  });

  it('provides even and odd flags', () => {
    const metas = [0, 1, 2, 3].map(loop((_, $l) => $l));
    expect(metas[0].even).toBe(true);
    expect(metas[0].odd).toBe(false);
    expect(metas[1].even).toBe(false);
    expect(metas[1].odd).toBe(true);
  });

  it('tracks depth and parent in nested loops', () => {
    const outer = [
      [1, 2],
      [3, 4],
    ].map(loop((inner, $outer) => inner.map(loop((_, $inner) => ({ $outer, $inner })))));
    const nested = outer[0][0];
    expect(nested.$outer.depth).toBe(1);
    expect(nested.$inner.depth).toBe(2);
    expect(nested.$inner.parent).toBe(nested.$outer);
  });

  it('works with an empty array', () => {
    const result = ([] as number[]).map(loop((_, $l) => $l));
    expect(result).toHaveLength(0);
  });
});

// ── ValidationErrors ──────────────────────────────────────────────────

describe('ValidationErrors', () => {
  it('has() returns true when the field has an error', () => {
    const e = new ValidationErrors({ title: 'required' });
    expect(e.has('title')).toBe(true);
    expect(e.has('body')).toBe(false);
  });

  it('first() returns the first error string', () => {
    const e = new ValidationErrors({ email: ['too short', 'invalid format'] });
    expect(e.first('email')).toBe('too short');
  });

  it('all() returns every error for a field', () => {
    const e = new ValidationErrors({ email: ['too short', 'invalid format'] });
    expect(e.all('email')).toEqual(['too short', 'invalid format']);
  });

  it('isEmpty() and isNotEmpty() reflect the error state', () => {
    expect(new ValidationErrors({}).isEmpty()).toBe(true);
    expect(new ValidationErrors({ x: 'err' }).isNotEmpty()).toBe(true);
  });

  it('first() returns undefined for an unknown field', () => {
    const e = new ValidationErrors({ title: 'required' });
    expect(e.first('unknown')).toBeUndefined();
  });
});

// ── CsrfField ─────────────────────────────────────────────────────────

describe('CsrfField', () => {
  it('renders a hidden input with the given token', () => {
    expect(CsrfField({ token: 'abc123' }).html).toBe(
      '<input type="hidden" name="_token" value="abc123">',
    );
  });

  it('escapes a token that contains HTML special characters', () => {
    expect(CsrfField({ token: '<evil>' }).html).toBe(
      '<input type="hidden" name="_token" value="&lt;evil&gt;">',
    );
  });

  it('reads the token from the render context when no prop is given', () => {
    const html = withRenderContext(() => CsrfField().html, { csrf: 'ctx-token' });
    expect(html).toBe('<input type="hidden" name="_token" value="ctx-token">');
  });
});

// ── MethodField ───────────────────────────────────────────────────────

describe('MethodField', () => {
  it('renders a hidden _method input uppercased', () => {
    expect(MethodField({ method: 'put' }).html).toBe(
      '<input type="hidden" name="_method" value="PUT">',
    );
  });

  it('keeps already-uppercase values', () => {
    expect(MethodField({ method: 'DELETE' }).html).toBe(
      '<input type="hidden" name="_method" value="DELETE">',
    );
  });
});

// ── FieldError ────────────────────────────────────────────────────────

describe('FieldError', () => {
  const errors = new ValidationErrors({ title: 'Title is required.' });

  it('renders default paragraph when there is an error', () => {
    expect(FieldError({ field: 'title', errors }).html).toBe(
      '<p class="faber-error">Title is required.</p>',
    );
  });

  it('returns empty when field has no error', () => {
    expect(FieldError({ field: 'body', errors }).html).toBe('');
  });

  it('calls a render-prop child with the error message', () => {
    const result = FieldError({
      field: 'title',
      errors,
      children: (msg: string) => new RawHtml(`<span>${msg}</span>`),
    });
    expect(result.html).toBe('<span>Title is required.</span>');
  });

  it('reads errors from the render context when no prop is given', () => {
    const html = withRenderContext(() => FieldError({ field: 'email' }).html, {
      errors: { email: 'Invalid email.' },
    });
    expect(html).toBe('<p class="faber-error">Invalid email.</p>');
  });

  it('reads from a named error bag when bag prop is given', () => {
    const html = withRenderContext(() => FieldError({ field: 'email', bag: 'login' }).html, {
      errors: { email: 'default-bag-error' },
      errorBags: {
        login: { email: 'login-bag-error' },
        register: { email: 'register-bag-error' },
      },
    });
    expect(html).toBe('<p class="faber-error">login-bag-error</p>');
  });

  it('returns empty when the named bag has no error for the field', () => {
    const html = withRenderContext(() => FieldError({ field: 'email', bag: 'login' }).html, {
      errorBags: { login: {} },
    });
    expect(html).toBe('');
  });

  it('renders fallback children when no error exists for the field', () => {
    const out = FieldError({
      field: 'body',
      errors,
      fallback: raw('looks-good'),
    });
    expect(out.html).toBe('looks-good');
  });

  it('does not render fallback when an error exists', () => {
    const out = FieldError({
      field: 'title',
      errors,
      fallback: raw('looks-good'),
    });
    expect(out.html).toBe('<p class="faber-error">Title is required.</p>');
  });

  it('class-string usage: error or fallback yields the right class', () => {
    const errBag = new ValidationErrors({ email: 'bad' });
    const errClass = FieldError({
      field: 'email',
      errors: errBag,
      children: 'is-invalid',
      fallback: 'is-valid',
    });
    expect(errClass.html).toBe('is-invalid');

    const okClass = FieldError({
      field: 'name',
      errors: errBag,
      children: 'is-invalid',
      fallback: 'is-valid',
    });
    expect(okClass.html).toBe('is-valid');
  });

  it('ValidationErrors.toRecord returns the underlying map', () => {
    const v = new ValidationErrors({ a: '1', b: ['2', '3'] });
    expect(v.toRecord()).toEqual({ a: '1', b: ['2', '3'] });
  });
});

// ── Slot / useSlots() ─────────────────────────────────────────────────

describe('Slot / useSlots()', () => {
  it('extracts a named slot from children', () => {
    const children = h(
      Fragment,
      null,
      Slot({ name: 'title', children: 'My Title' }),
      h('p', null, 'Body'),
    );
    const { title, slot } = useSlots(children);
    expect(title.html).toBe('My Title');
    expect(slot.html).toBe('<p>Body</p>');
  });

  it('places everything outside named slots in the default slot', () => {
    const children = h(
      Fragment,
      null,
      h('p', null, 'First'),
      Slot({ name: 'footer', children: 'Footer text' }),
      h('p', null, 'Second'),
    );
    const { slot, footer } = useSlots(children);
    expect(footer.html).toBe('Footer text');
    expect(slot.html).toBe('<p>First</p><p>Second</p>');
  });

  it('concatenates multiple occurrences of the same slot name', () => {
    const children = h(
      Fragment,
      null,
      Slot({ name: 'items', children: 'A' }),
      Slot({ name: 'items', children: 'B' }),
    );
    const { items } = useSlots(children);
    expect(items.html).toBe('AB');
  });

  it('returns an empty default slot when all children are named slots', () => {
    const children = Slot({ name: 'head', children: '<meta>' });
    const { slot } = useSlots(children);
    expect(slot.html.trim()).toBe('');
  });

  it('SlotValue exposes isEmpty / hasContent / hasActualContent', () => {
    const children = h(
      Fragment,
      null,
      Slot({ name: 'title', children: 'Hello' }),
      Slot({ name: 'meta', children: raw('<!-- only a comment -->') }),
      Slot({ name: 'blank', children: '' }),
    );
    const { title, meta, blank, slot } = useSlots(children);

    expect(title.isEmpty()).toBe(false);
    expect(title.hasContent()).toBe(true);
    expect(title.hasActualContent()).toBe(true);

    expect(meta.isEmpty()).toBe(false);
    expect(meta.hasContent()).toBe(true);
    expect(meta.hasActualContent()).toBe(false);

    expect(blank.isEmpty()).toBe(true);
    expect(blank.hasContent()).toBe(false);
    expect(blank.hasActualContent()).toBe(false);

    // The default slot ends up empty when only named slots are present
    expect(slot.isEmpty()).toBe(true);
  });

  it('SlotValue interpolates as raw HTML in JSX', () => {
    const { title } = useSlots(Slot({ name: 'title', children: raw('<b>x</b>') }));
    const out = jsx('h1', { children: title }) as RawHtml;
    expect(out.html).toBe('<h1><b>x</b></h1>');
  });
});

// ── Push / Stack / Prepend ────────────────────────────────────────────

describe('Push / Prepend / Stack', () => {
  it('Stack renders pushed content', () => {
    withRenderContext(() => {
      Push({ stack: 'scripts', children: raw('<script src="/app.js"></script>') });
      expect(Stack({ name: 'scripts' }).html).toBe('<script src="/app.js"></script>');
    });
  });

  it('multiple pushes are concatenated in order', () => {
    withRenderContext(() => {
      Push({ stack: 'styles', children: raw('<link rel="a">') });
      Push({ stack: 'styles', children: raw('<link rel="b">') });
      expect(Stack({ name: 'styles' }).html).toBe('<link rel="a"><link rel="b">');
    });
  });

  it('Prepend inserts at the beginning of the stack', () => {
    withRenderContext(() => {
      Push({ stack: 's', children: raw('second') });
      Prepend({ stack: 's', children: raw('first') });
      expect(Stack({ name: 's' }).html).toBe('firstsecond');
    });
  });

  it('Stack returns empty when nothing has been pushed', () => {
    withRenderContext(() => {
      expect(Stack({ name: 'empty' }).html).toBe('');
    });
  });

  it('HasStack renders children only when the stack has content', () => {
    withRenderContext(() => {
      expect(HasStack({ name: 'x', children: raw('yes') }).html).toBe('');
      Push({ stack: 'x', children: raw('item') });
      expect(HasStack({ name: 'x', children: raw('yes') }).html).toBe('yes');
    });
  });
});

// ── PushIf ────────────────────────────────────────────────────────────

describe('PushIf', () => {
  it('pushes when condition is true', () => {
    withRenderContext(() => {
      PushIf({ when: true, stack: 's', children: raw('item') });
      expect(Stack({ name: 's' }).html).toBe('item');
    });
  });

  it('does not push when condition is false', () => {
    withRenderContext(() => {
      PushIf({ when: false, stack: 's', children: raw('item') });
      expect(Stack({ name: 's' }).html).toBe('');
    });
  });
});

// ── PushOnce / PrependOnce ────────────────────────────────────────────

describe('PushOnce / PrependOnce', () => {
  it('PushOnce only pushes the first occurrence of an id', () => {
    withRenderContext(() => {
      PushOnce({ stack: 's', id: 'chart', children: raw('<script>') });
      PushOnce({ stack: 's', id: 'chart', children: raw('<script>') });
      expect(Stack({ name: 's' }).html).toBe('<script>');
    });
  });

  it('PrependOnce only prepends the first occurrence of an id', () => {
    withRenderContext(() => {
      Push({ stack: 's', children: raw('last') });
      PrependOnce({ stack: 's', id: 'head', children: raw('first') });
      PrependOnce({ stack: 's', id: 'head', children: raw('first') });
      expect(Stack({ name: 's' }).html).toBe('firstlast');
    });
  });
});

// ── Once ──────────────────────────────────────────────────────────────

describe('Once', () => {
  it('renders content the first time and empty on subsequent calls', () => {
    withRenderContext(() => {
      const first = Once({ id: 'test', children: raw('<script>') });
      const second = Once({ id: 'test', children: raw('<script>') });
      expect(first.html).toBe('<script>');
      expect(second.html).toBe('');
    });
  });

  it('renders without context (no deduplication)', () => {
    const result = Once({ id: 'no-ctx', children: raw('<b>') });
    expect(result.html).toBe('<b>');
  });
});

// ── Section / Yield ───────────────────────────────────────────────────

describe('Section / Yield', () => {
  it('Yield outputs section content registered by Section', () => {
    withRenderContext(() => {
      Section({ name: 'title', children: 'My Title' });
      expect(Yield({ name: 'title' }).html).toBe('My Title');
    });
  });

  it('Yield renders default children when no section is defined', () => {
    withRenderContext(() => {
      expect(Yield({ name: 'missing', children: raw('Default') }).html).toBe('Default');
    });
  });

  it('Yield returns empty when no section and no default', () => {
    withRenderContext(() => {
      expect(Yield({ name: 'nothing' }).html).toBe('');
    });
  });

  it('Section append concatenates with prior registration', () => {
    withRenderContext(() => {
      Section({ name: 'scripts', children: raw('<a></a>') });
      Section({ name: 'scripts', append: true, children: raw('<b></b>') });
      expect(Yield({ name: 'scripts' }).html).toBe('<a></a><b></b>');
    });
  });

  it('Section prepend places content before prior registration', () => {
    withRenderContext(() => {
      Section({ name: 's', children: raw('<a></a>') });
      Section({ name: 's', prepend: true, children: raw('<b></b>') });
      expect(Yield({ name: 's' }).html).toBe('<b></b><a></a>');
    });
  });

  it('ParentSection token is replaced by the Yield default children', () => {
    withRenderContext(() => {
      Section({
        name: 'sidebar',
        children: h(Fragment, null, ParentSection(), raw('<p>Extra</p>')),
      });
      const out = Yield({ name: 'sidebar', children: raw('<nav>Master</nav>') });
      expect(out.html).toBe('<nav>Master</nav><p>Extra</p>');
    });
  });

  it('ParentSection inside an unregistered section is not echoed', () => {
    withRenderContext(() => {
      const out = Yield({ name: 'never', children: raw('master') });
      expect(out.html).toBe('master');
    });
  });

  it('multiple ParentSection tokens are all replaced', () => {
    withRenderContext(() => {
      Section({
        name: 'x',
        children: h(Fragment, null, ParentSection(), raw('|'), ParentSection()),
      });
      expect(Yield({ name: 'x', children: raw('M') }).html).toBe('M|M');
    });
  });
});

// ── HasSection / SectionMissing ───────────────────────────────────────

describe('HasSection / SectionMissing', () => {
  it('HasSection renders when the section exists', () => {
    withRenderContext(() => {
      Section({ name: 'nav', children: raw('<nav>') });
      expect(HasSection({ name: 'nav', children: raw('yes') }).html).toBe('yes');
    });
  });

  it('HasSection returns empty when the section does not exist', () => {
    withRenderContext(() => {
      expect(HasSection({ name: 'nav', children: raw('yes') }).html).toBe('');
    });
  });

  it('SectionMissing renders when the section is absent', () => {
    withRenderContext(() => {
      expect(SectionMissing({ name: 'sidebar', children: raw('default') }).html).toBe('default');
    });
  });

  it('SectionMissing returns empty when the section exists', () => {
    withRenderContext(() => {
      Section({ name: 'sidebar', children: raw('<aside>') });
      expect(SectionMissing({ name: 'sidebar', children: raw('default') }).html).toBe('');
    });
  });
});

// ── ViewFragment ──────────────────────────────────────────────────────

describe('ViewFragment', () => {
  it('wraps content with sentinel HTML comments', () => {
    const result = ViewFragment({ name: 'user-list', children: raw('<ul></ul>') });
    expect(result.html).toBe(
      '<!--FABER-FRAGMENT:user-list:S--><ul></ul><!--FABER-FRAGMENT:user-list:E-->',
    );
  });

  it('contains the rendered children between sentinels', () => {
    const child = h('li', null, 'Item');
    const result = ViewFragment({ name: 'items', children: child });
    expect(result.html).toContain('<li>Item</li>');
  });
});

// ── ViewRenderer.renderFragment() ─────────────────────────────────────

describe('ViewRenderer.renderFragment()', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `faber-frag-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it('returns only the named fragment content', async () => {
    writeFileSync(
      join(tmpDir, 'page.view.mjs'),
      `export default function Page({ items }) {
         return { html:
           '<header>Header</header>' +
           '<!--FABER-FRAGMENT:list:S--><ul>' + items.join('') + '</ul><!--FABER-FRAGMENT:list:E-->'
         };
       }`,
    );
    const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
    const result = await renderer.renderFragment('list', 'page', { items: ['<li>A</li>'] });
    expect(result).toBe('<ul><li>A</li></ul>');
  });

  it('throws when the fragment does not exist in the rendered output', async () => {
    writeFileSync(
      join(tmpDir, 'simple.view.mjs'),
      `export default function S() { return { html: '<p>hello</p>' }; }`,
    );
    const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
    await expect(renderer.renderFragment('missing', 'simple', {})).rejects.toThrow('missing');
  });

  it('renderFragmentsIf returns full view when condition is false', async () => {
    writeFileSync(
      join(tmpDir, 'multi.view.mjs'),
      `export default function P() {
         return { html:
           '<!--FABER-FRAGMENT:a:S--><a/><!--FABER-FRAGMENT:a:E-->' +
           '<!--FABER-FRAGMENT:b:S--><b/><!--FABER-FRAGMENT:b:E-->'
         };
       }`,
    );
    const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
    const html = await renderer.renderFragmentsIf(false, ['a', 'b'], 'multi', {});
    expect(html).toContain('<!--FABER-FRAGMENT:a:S-->');
    expect(html).toContain('<!--FABER-FRAGMENT:b:S-->');
  });

  it('renderFragmentsIf returns concatenated fragments when condition is true', async () => {
    writeFileSync(
      join(tmpDir, 'multi2.view.mjs'),
      `export default function P() {
         return { html:
           '<header/>' +
           '<!--FABER-FRAGMENT:a:S--><a/><!--FABER-FRAGMENT:a:E-->' +
           '<!--FABER-FRAGMENT:b:S--><b/><!--FABER-FRAGMENT:b:E-->'
         };
       }`,
    );
    const renderer = new ViewRenderer({ viewsDir: tmpDir, extension: '.view.mjs' });
    const html = await renderer.renderFragmentsIf(true, ['a', 'b'], 'multi2', {});
    expect(html).toBe('<a/><b/>');
  });
});

// ── ViewResponse.fragmentsIf() ───────────────────────────────────────

describe('ViewResponse.fragmentsIf', () => {
  it('extractFragments path: condition true → concatenated', async () => {
    const html =
      '<x/>' +
      '<!--FABER-FRAGMENT:a:S--><a/><!--FABER-FRAGMENT:a:E-->' +
      '<!--FABER-FRAGMENT:b:S--><b/><!--FABER-FRAGMENT:b:E-->';
    // Simulate by creating a ViewResponse subclass that returns canned html
    class FakeResponse extends ViewResponse {
      override async render(): Promise<string> {
        return html;
      }
    }
    const vr = new FakeResponse('x');
    expect(await vr.fragmentsIf(true, ['a', 'b'])).toBe('<a/><b/>');
    expect(await vr.fragmentsIf(false, ['a', 'b'])).toBe(html);
  });
});

// ── ViewRenderer.renderString() ───────────────────────────────────────

describe('ViewRenderer.renderString()', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = join(tmpdir(), `faber-inline-${Date.now()}-${Math.random().toString(36).slice(2)}`);
    mkdirSync(tmpDir, { recursive: true });
  });

  afterEach(() => {
    if (existsSync(tmpDir)) rmSync(tmpDir, { recursive: true });
  });

  it('compiles and renders an inline TSX string', async () => {
    const renderer = new ViewRenderer({ viewsDir: tmpDir });
    const html = await renderer.renderString(
      `/** @jsxImportSource @faber-js/view */
       export default function({ name }: { name: string }) {
         return <p>Hello {name}</p>;
       }`,
      { name: 'Julian' },
    );
    expect(html).toBe('<p>Hello Julian</p>');
  });
});

// ── Env / EnvNot / Production ─────────────────────────────────────────

describe('Env / EnvNot / Production', () => {
  const originalEnv = process.env['APP_ENV'];

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env['APP_ENV'];
    } else {
      process.env['APP_ENV'] = originalEnv;
    }
  });

  it('Env renders children when the environment matches', () => {
    process.env['APP_ENV'] = 'staging';
    expect(Env({ name: 'staging', children: raw('<b>staging</b>') }).html).toBe('<b>staging</b>');
  });

  it('Env returns empty when the environment does not match', () => {
    process.env['APP_ENV'] = 'production';
    expect(Env({ name: 'staging', children: raw('<b>staging</b>') }).html).toBe('');
  });

  it('Env accepts an array of environment names', () => {
    process.env['APP_ENV'] = 'staging';
    expect(Env({ name: ['staging', 'production'], children: raw('ok') }).html).toBe('ok');
  });

  it('EnvNot renders when environment does NOT match', () => {
    process.env['APP_ENV'] = 'development';
    expect(EnvNot({ name: 'production', children: raw('dev only') }).html).toBe('dev only');
  });

  it('Production renders only in production', () => {
    process.env['APP_ENV'] = 'production';
    expect(Production({ children: raw('prod') }).html).toBe('prod');
    process.env['APP_ENV'] = 'development';
    expect(Production({ children: raw('prod') }).html).toBe('');
  });
});

// ── AttributeBag ──────────────────────────────────────────────────────

describe('AttributeBag', () => {
  it('exposes attrs as own enumerable props for JSX spread', () => {
    const bag = attributeBag({ id: 'a', 'data-x': '1' });
    const spread = { ...bag };
    expect(spread).toEqual({ id: 'a', 'data-x': '1' });
  });

  it('normalizes className to class on input', () => {
    const bag = attributeBag({ className: 'btn' });
    expect(bag.get('class')).toBe('btn');
    expect(bag.has('className')).toBe(true);
  });

  it('drops undefined values but keeps null/false (rendered later)', () => {
    const bag = attributeBag({ a: undefined, b: null, c: false, d: 'ok' });
    expect(bag.has('a')).toBe(false);
    expect(bag.has('b')).toBe(true);
    expect(bag.has('c')).toBe(true);
    expect(bag.has('d')).toBe(true);
  });

  it('toString renders escaped attributes with leading space', () => {
    const bag = attributeBag({ class: 'a"b', 'data-x': '<x>' });
    expect(bag.toString()).toBe(' class="a&quot;b" data-x="&lt;x&gt;"');
  });

  it('toString returns empty string for an empty bag', () => {
    expect(attributeBag().toString()).toBe('');
  });

  it('toString emits boolean true as bare attribute', () => {
    expect(attributeBag({ disabled: true, hidden: true }).toString()).toBe(' disabled hidden');
  });

  it('toString skips false/null/undefined values', () => {
    expect(attributeBag({ a: 'x', b: false, c: null }).toString()).toBe(' a="x"');
  });

  it('renders directly when echoed in JSX children', () => {
    const bag = attributeBag({ class: 'btn' });
    const out = jsx('div', { children: bag }) as RawHtml;
    expect(out.html).toBe('<div> class="btn"</div>');
  });

  it('merge concatenates classes (default first)', () => {
    const bag = attributeBag({ class: 'mt-4' });
    const merged = bag.merge({ class: 'alert alert-error' });
    expect(merged.get('class')).toBe('alert alert-error mt-4');
  });

  it('merge keeps existing non-class value when one is provided', () => {
    const bag = attributeBag({ type: 'submit' });
    const merged = bag.merge({ type: 'button' });
    expect(merged.get('type')).toBe('submit');
  });

  it('merge fills in default for non-class when value is missing', () => {
    const bag = attributeBag({});
    const merged = bag.merge({ type: 'button' });
    expect(merged.get('type')).toBe('button');
  });

  it('prepends marks a default value to be prepended onto incoming', () => {
    const bag = attributeBag({ 'data-controller': 'extra' });
    const merged = bag.merge({ 'data-controller': bag.prepends('profile-controller') });
    expect(merged.get('data-controller')).toBe('profile-controller extra');
  });

  it('prepends used with no incoming value sets just the prepended value', () => {
    const bag = attributeBag({});
    const merged = bag.merge({ 'data-controller': bag.prepends('only') });
    expect(merged.get('data-controller')).toBe('only');
  });

  it('prepends() returns a PrependsValue', () => {
    expect(attributeBag().prepends('x')).toBeInstanceOf(PrependsValue);
  });

  it('classes() conditionally merges classes with existing class attr', () => {
    const bag = attributeBag({ class: 'p-4' });
    const out = bag.classes(['btn', { 'bg-red': true, hidden: false }]);
    expect(out.get('class')).toBe('btn bg-red p-4');
  });

  it('filter retains attributes matching the predicate', () => {
    const bag = attributeBag({ a: 1, b: 2, c: 3 });
    const out = bag.filter((_, k) => k !== 'b');
    expect({ ...out }).toEqual({ a: 1, c: 3 });
  });

  it('whereStartsWith keeps only matching keys', () => {
    const bag = attributeBag({ 'wire:model': 'x', 'wire:click': 'y', class: 'p-4' });
    expect({ ...bag.whereStartsWith('wire:') }).toEqual({
      'wire:model': 'x',
      'wire:click': 'y',
    });
  });

  it('whereDoesntStartWith excludes matching keys', () => {
    const bag = attributeBag({ 'wire:model': 'x', class: 'p-4' });
    expect({ ...bag.whereDoesntStartWith('wire:') }).toEqual({ class: 'p-4' });
  });

  it('first returns the first attribute value', () => {
    const bag = attributeBag({ 'wire:model': 'foo', 'wire:click': 'bar' });
    expect(bag.whereStartsWith('wire:').first()).toBe('foo');
  });

  it('first returns undefined for an empty bag', () => {
    expect(attributeBag().first()).toBeUndefined();
  });

  it('has(key) and has([keys]) check membership', () => {
    const bag = attributeBag({ name: 'x', class: 'y' });
    expect(bag.has('name')).toBe(true);
    expect(bag.has(['name', 'class'])).toBe(true);
    expect(bag.has(['name', 'missing'])).toBe(false);
  });

  it('hasAny returns true when at least one key is present', () => {
    const bag = attributeBag({ href: '/x' });
    expect(bag.hasAny(['href', ':href', 'v-bind:href'])).toBe(true);
    expect(bag.hasAny(['target', 'rel'])).toBe(false);
  });

  it('only and except produce subset bags', () => {
    const bag = attributeBag({ a: 1, b: 2, c: 3 });
    expect({ ...bag.only(['a', 'b']) }).toEqual({ a: 1, b: 2 });
    expect({ ...bag.except(['a']) }).toEqual({ b: 2, c: 3 });
  });

  it('isEmpty / isNotEmpty work as expected', () => {
    expect(attributeBag().isEmpty()).toBe(true);
    expect(attributeBag({ x: 1 }).isNotEmpty()).toBe(true);
  });

  it('AttributeBag instance is an instance of AttributeBag', () => {
    expect(attributeBag()).toBeInstanceOf(AttributeBag);
  });

  it('end-to-end: JSX component using attribute bag merges classes', () => {
    function Alert(props: { type: string; message: string; [k: string]: unknown }): RawHtml {
      const { type, message, ...rest } = props;
      const attrs = attributeBag(rest);
      return jsx('div', {
        ...attrs.merge({ class: `alert alert-${type}` }),
        children: message,
      }) as RawHtml;
    }
    const out = (Alert as unknown as (p: Record<string, unknown>) => RawHtml)({
      type: 'error',
      message: 'Oops',
      class: 'mb-4',
      id: 'x',
    });
    expect(out.html).toBe('<div class="alert alert-error mb-4" id="x">Oops</div>');
  });
});

// ── Auth / Guest ──────────────────────────────────────────────────────

describe('Auth / Guest', () => {
  it('Auth renders children when user is authenticated', () => {
    withRenderContext(
      () => {
        expect(Auth({ children: raw('signed-in') }).html).toBe('signed-in');
      },
      { auth: { user: { id: 1 }, check: () => true } },
    );
  });

  it('Auth renders empty when user is not authenticated', () => {
    withRenderContext(
      () => {
        expect(Auth({ children: raw('signed-in') }).html).toBe('');
      },
      { auth: { check: () => false } },
    );
  });

  it('Auth renders empty when no auth context is set', () => {
    withRenderContext(() => {
      expect(Auth({ children: raw('x') }).html).toBe('');
    });
  });

  it('Auth passes guard to check()', () => {
    let receivedGuard: string | undefined = 'unset';
    withRenderContext(
      () => {
        Auth({ guard: 'admin', children: raw('') });
      },
      {
        auth: {
          check: (guard) => {
            receivedGuard = guard;
            return false;
          },
        },
      },
    );
    expect(receivedGuard).toBe('admin');
  });

  it('Guest renders children only when not authenticated', () => {
    withRenderContext(
      () => {
        expect(Guest({ children: raw('hi guest') }).html).toBe('hi guest');
      },
      { auth: { check: () => false } },
    );
    withRenderContext(
      () => {
        expect(Guest({ children: raw('hi guest') }).html).toBe('');
      },
      { auth: { check: () => true } },
    );
  });

  it('Guest renders children when there is no auth context', () => {
    withRenderContext(() => {
      expect(Guest({ children: raw('hi') }).html).toBe('hi');
    });
  });

  it('useAuth returns the current AuthContext from render context', () => {
    const ctx = { user: { id: 99 }, check: () => true };
    withRenderContext(
      () => {
        expect(useAuth()).toBe(ctx);
      },
      { auth: ctx },
    );
  });

  it('useAuth returns undefined outside a render context', () => {
    expect(useAuth()).toBeUndefined();
  });
});

// ── Session ───────────────────────────────────────────────────────────

describe('Session component', () => {
  function makeSession(values: Record<string, unknown>): {
    has: (k: string) => boolean;
    get: (k: string) => unknown;
  } {
    return {
      has: (k: string): boolean => k in values,
      get: (k: string): unknown => values[k],
    };
  }

  it('renders children when the session value exists', () => {
    withRenderContext(
      () => {
        expect(Session({ name: 'status', children: raw('ok') }).html).toBe('ok');
      },
      { session: makeSession({ status: 'saved' }) },
    );
  });

  it('renders empty when the session key does not exist', () => {
    withRenderContext(
      () => {
        expect(Session({ name: 'status', children: raw('ok') }).html).toBe('');
      },
      { session: makeSession({}) },
    );
  });

  it('passes the session value into a function child', () => {
    withRenderContext(
      () => {
        const out = Session({
          name: 'flash',
          children: (v: unknown) => raw(`<p>${String(v)}</p>`),
        });
        expect(out.html).toBe('<p>hi!</p>');
      },
      { session: makeSession({ flash: 'hi!' }) },
    );
  });

  it('renders empty when no session context is set', () => {
    withRenderContext(() => {
      expect(Session({ name: 'status', children: raw('x') }).html).toBe('');
    });
  });

  it('useSession returns the current SessionContext', () => {
    const session = makeSession({ k: 'v' });
    withRenderContext(
      () => {
        expect(useSession()).toBe(session);
      },
      { session },
    );
  });
});

// ── Aware ──────────────────────────────────────────────────────────────

describe('Aware', () => {
  it('useAware returns undefined when no frame is pushed', () => {
    expect(useAware('color')).toBeUndefined();
  });

  it('Aware exposes values to descendants rendered through a thunk', () => {
    function Item(): RawHtml {
      return raw(`color=${String(useAware<string>('color'))}`);
    }
    const out = Aware({
      values: { color: 'purple' },
      children: () => Item(),
    });
    expect(out.html).toBe('color=purple');
  });

  it('Aware pops its frame after rendering (no leakage to siblings)', () => {
    Aware({ values: { color: 'red' }, children: () => raw('') });
    expect(useAware('color')).toBeUndefined();
  });

  it('Aware pops its frame even when the thunk throws', () => {
    expect(() =>
      Aware({
        values: { color: 'red' },
        children: () => {
          throw new Error('boom');
        },
      }),
    ).toThrow(/boom/);
    expect(useAware('color')).toBeUndefined();
  });

  it('nested Aware shadows outer values within the inner scope', () => {
    function Probe(): RawHtml {
      return raw(String(useAware<string>('color')));
    }
    const out = Aware({
      values: { color: 'outer' },
      children: () =>
        h(
          Fragment,
          null,
          Probe(),
          Aware({ values: { color: 'inner' }, children: () => Probe() }),
          Probe(),
        ),
    });
    expect(out.html).toBe('outerinnerouter');
  });

  it('provideAware runs a function with values pushed onto the stack', () => {
    const result = provideAware({ color: 'blue' }, () => useAware<string>('color'));
    expect(result).toBe('blue');
    expect(useAware('color')).toBeUndefined();
  });

  it('Aware accepts non-function children for static interpolation', () => {
    const out = Aware({ values: { color: 'red' }, children: raw('static') });
    expect(out.html).toBe('static');
  });
});

// ── Js.from ────────────────────────────────────────────────────────────

describe('Js.from', () => {
  it('produces a JSON.parse expression that round-trips through eval', () => {
    const data = { name: 'Bob', age: 42 };
    const out = Js.from(data) as RawHtml;
    const parsed = new Function(`return ${out.html}`)() as Record<string, unknown>;
    expect(parsed).toEqual(data);
  });

  it('escapes HTML-sensitive characters to prevent script tag breakouts', () => {
    const out = Js.from({ html: '</script><script>x</script>' }) as RawHtml;
    expect(out.html).not.toContain('</script>');
    expect(out.html).not.toContain('<script>');
    const parsed = new Function(`return ${out.html}`)() as { html: string };
    expect(parsed.html).toBe('</script><script>x</script>');
  });

  it('escapes & to prevent HTML entity ambiguity', () => {
    const out = Js.from('a&b') as RawHtml;
    expect(out.html).not.toMatch(/[^\\]&/);
  });

  it('escapes U+2028 and U+2029 (otherwise illegal in JS string literals)', () => {
    const out = Js.from({ s: '  ' }) as RawHtml;
    expect(out.html).toContain('\\u2028');
    expect(out.html).toContain('\\u2029');
    expect(out.html).not.toContain(' ');
    expect(out.html).not.toContain(' ');
  });

  it('renders null for undefined values', () => {
    const out = Js.from(undefined) as RawHtml;
    const parsed = new Function(`return ${out.html}`)();
    expect(parsed).toBeNull();
  });

  it('returns a RawHtml so JSX does not double-escape it', () => {
    const inner = Js.from({ ok: true });
    const out = jsx('script', { children: inner }) as RawHtml;
    expect(out.html).toBe(`<script>${(inner as RawHtml).html}</script>`);
  });
});

// ── Stringable handlers ────────────────────────────────────────────────

describe('Custom stringable handlers', () => {
  class Money {
    constructor(
      readonly amount: number,
      readonly currency: string,
    ) {}
  }

  afterEach(() => {
    clearStringables();
  });

  it('escape() uses a registered handler instead of String(value)', () => {
    registerStringable(Money, (m: Money) => `${m.amount.toFixed(2)} ${m.currency}`);
    expect(escape(new Money(12.5, 'USD'))).toBe('12.50 USD');
  });

  it('handler output is HTML-escaped', () => {
    registerStringable(Money, () => '<script>x</script>');
    expect(escape(new Money(0, ''))).toBe('&lt;script&gt;x&lt;/script&gt;');
  });

  it('renderChildren applies handler when echoing instances in JSX', () => {
    registerStringable(Money, (m: Money) => `$${m.amount}`);
    const out = jsx('span', { children: new Money(5, 'USD') }) as RawHtml;
    expect(out.html).toBe('<span>$5</span>');
  });

  it('last-registered handler wins for the same class', () => {
    registerStringable(Money, () => 'first');
    registerStringable(Money, () => 'second');
    expect(escape(new Money(0, ''))).toBe('second');
  });

  it('subclasses inherit registrations on the parent class', () => {
    class Cents extends Money {}
    registerStringable(Money, (m: Money) => `${m.amount}c`);
    expect(escape(new Cents(99, 'USD'))).toBe('99c');
  });

  it('clearStringables removes all registrations', () => {
    registerStringable(Money, () => 'x');
    clearStringables();
    expect(escape(new Money(0, ''))).toBe('[object Object]');
  });
});

// ── DynamicComponent ───────────────────────────────────────────────────

describe('DynamicComponent', () => {
  afterEach(() => {
    clearComponents();
  });

  it('renders a component passed as a function reference', () => {
    const Greet = (props: Record<string, unknown>): RawHtml =>
      raw(`Hello ${String(props['name'])}`);
    const out = DynamicComponent({ component: Greet, name: 'Bob' });
    expect(out.html).toBe('Hello Bob');
  });

  it('renders a component looked up by registered name', () => {
    function Alert({ type, children }: { type: string; children?: unknown }): RawHtml {
      return raw(`<div class="alert-${type}">${renderChildren(children)}</div>`);
    }
    registerComponent('alert', Alert as (p: Record<string, unknown>) => RawHtml);
    const out = DynamicComponent({
      component: 'alert',
      type: 'error',
      children: 'Oops',
    });
    expect(out.html).toBe('<div class="alert-error">Oops</div>');
  });

  it('throws when the component name is not registered', () => {
    expect(() => DynamicComponent({ component: 'nope' })).toThrow(/no component registered/);
  });

  it('throws when component is not a function or string', () => {
    expect(() => DynamicComponent({ component: 42 as unknown as string })).toThrow(
      /must be a function or a registered name/,
    );
  });

  it('forwards remaining props to the resolved component', () => {
    function Probe(props: Record<string, unknown>): RawHtml {
      return raw(JSON.stringify(props));
    }
    const out = DynamicComponent({
      component: Probe,
      a: 1,
      b: 'x',
      children: 'kids',
    });
    expect(out.html).toBe('{"a":1,"b":"x","children":"kids"}');
  });

  it('wraps a string return value in RawHtml', () => {
    const Inline = (): string => '<b>raw</b>';
    const out = DynamicComponent({ component: Inline });
    expect(out.html).toBe('<b>raw</b>');
  });
});

// ── useService ─────────────────────────────────────────────────────────

describe('useService', () => {
  afterEach(() => {
    Application.clearInstance();
  });

  it('resolves a service from the IoC container by token', () => {
    const app = new Application();
    const metrics = { monthlyRevenue: () => 42 };
    app.instance('metrics', metrics);

    const resolved = useService<{ monthlyRevenue: () => number }>('metrics');
    expect(resolved).toBe(metrics);
    expect(resolved.monthlyRevenue()).toBe(42);
  });

  it('throws ApplicationNotInitializedException when no app exists', () => {
    Application.clearInstance();
    expect(() => useService('any')).toThrow();
  });
});
