import { raw, RawHtml } from './escape';
import { renderChildren } from './jsx-runtime';
import { getRenderContext } from './render-context';

// How it works:
//
// JSX evaluates children *before* calling the parent component function.
// So when a Page component renders:
//
//   <Layout>
//     <Section name="title">My Title</Section>
//     <p>Body</p>
//   </Layout>
//
// The execution order is:
//   1. Section({ name: 'title', children: 'My Title' }) — registers in context → returns ''
//   2. jsx('p', ...) → returns '<p>Body</p>'
//   3. Layout({ children: ['', '<p>Body</p>'] }) is called
//   4. Inside Layout, Yield({ name: 'title' }) reads from context → 'My Title'
//
// This relies on all rendering being synchronous and the render context being
// established by ViewRenderer before any component function executes.

// Token used to mark `<ParentSection />` inside a section body. <Yield> swaps
// the token for the section's default children at render time, so the
// composed output behaves like Blade's `@@parent` directive.
const PARENT_SECTION_TOKEN = '<!--FABER-PARENT-SECTION-->';

// ── Section ───────────────────────────────────────────────────────────

/**
 * Defines a named content section. Equivalent to Blade's @section directive.
 *
 * When rendered inside a layout component's children, the content is registered
 * in the render context and later emitted by <Yield>. Returns empty HTML.
 *
 * Pass `append` or `prepend` to concatenate with a prior registration of the
 * same name (useful when multiple page partials all contribute to the same
 * section).
 *
 * @example
 * <AppLayout>
 *   <Section name="title">My Page</Section>
 *   <p>Body content</p>
 * </AppLayout>
 *
 * @example  // append onto whatever was registered earlier
 * <Section name="scripts" append>
 *   <script src="/extra.js"></script>
 * </Section>
 */
export function Section({
  name,
  append,
  prepend,
  children,
}: {
  name: string;
  append?: boolean;
  prepend?: boolean;
  children?: unknown;
}): RawHtml {
  const ctx = getRenderContext();
  if (!ctx) return raw('');
  const newContent = renderChildren(children);
  if (append || prepend) {
    const existing = ctx.sections.get(name) ?? '';
    ctx.sections.define(name, append ? existing + newContent : newContent + existing);
  } else {
    ctx.sections.define(name, newContent);
  }
  return raw('');
}

// ── ParentSection ─────────────────────────────────────────────────────

/**
 * Placeholder for the parent layout's default section content. When used
 * inside a `<Section>`, it gets replaced at yield time with whatever children
 * the matching `<Yield>` declared as defaults. Equivalent to Blade's
 * `@@parent` token inside a `@section('...')` block.
 *
 * @example
 * <Section name="sidebar">
 *   <ParentSection />
 *   <p>Page-specific extras</p>
 * </Section>
 */
export function ParentSection(): RawHtml {
  return raw(PARENT_SECTION_TOKEN);
}

// ── Yield ─────────────────────────────────────────────────────────────

/**
 * Outputs the content of a named section. Equivalent to Blade's @yield directive.
 * If no section with that name was registered, renders the optional default children.
 *
 * Any `<ParentSection />` token inside the section's content is replaced with
 * this Yield's default children — supporting the Blade `@@parent` pattern.
 *
 * @example
 * <html>
 *   <head><title><Yield name="title">Default Title</Yield></title></head>
 *   <body><Yield name="content" /></body>
 * </html>
 */
export function Yield({ name, children }: { name: string; children?: unknown }): RawHtml {
  const ctx = getRenderContext();
  const defaultContent =
    children !== undefined && children !== null ? renderChildren(children) : '';
  if (ctx) {
    const content = ctx.sections.get(name);
    if (content !== undefined) {
      return raw(content.split(PARENT_SECTION_TOKEN).join(defaultContent));
    }
  }
  return raw(defaultContent);
}

// ── HasSection ────────────────────────────────────────────────────────

/**
 * Renders children only when a section with the given name has been defined.
 * Equivalent to Blade's @hasSection directive.
 *
 * @example
 * <HasSection name="navigation">
 *   <nav><Yield name="navigation" /></nav>
 * </HasSection>
 */
export function HasSection({ name, children }: { name: string; children?: unknown }): RawHtml {
  const ctx = getRenderContext();
  if (!ctx?.sections.has(name)) return raw('');
  return new RawHtml(renderChildren(children));
}

// ── SectionMissing ────────────────────────────────────────────────────

/**
 * Renders children only when no section with the given name was defined.
 * Equivalent to Blade's @sectionMissing directive.
 *
 * @example
 * <SectionMissing name="navigation">
 *   <DefaultNavigation />
 * </SectionMissing>
 */
export function SectionMissing({ name, children }: { name: string; children?: unknown }): RawHtml {
  const ctx = getRenderContext();
  if (ctx?.sections.has(name)) return raw('');
  return new RawHtml(renderChildren(children));
}
