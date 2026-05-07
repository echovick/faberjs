export type {
  ViewRendererConfig,
  ViewComponent,
  IViewResponse,
  ComposerFn,
  ComposerClassInstance,
  ComposerClass,
  ComposerHandler,
  HookEntry,
} from './types';
export { ViewNotFoundException } from './ViewNotFoundException';
export { RawHtml, raw, escape } from './escape';
export { ViewRenderer } from './ViewRenderer';
export { ViewResponse } from './ViewResponse';
export { ViewServiceProvider } from './ViewServiceProvider';
export { ViewController } from './ViewController';
export { View } from './ViewFacade';
export { Fragment, h, jsx, jsxs, jsxDEV, Unsafe, renderChildren } from './jsx-runtime';

// ── Render context ────────────────────────────────────────────────────
export type { RenderContextStore } from './render-context';
export { getRenderContext, withRenderContext } from './render-context';

// ── Template helpers ──────────────────────────────────────────────────
export { view, cls, styleMap, checked, selected, disabled, readonly, required } from './helpers';

// ── Loop metadata ─────────────────────────────────────────────────────
export type { LoopMeta } from './loop';
export { loop } from './loop';

// ── Form components ───────────────────────────────────────────────────
export { ValidationErrors, CsrfField, MethodField, FieldError } from './forms';

// ── Named slots ───────────────────────────────────────────────────────
export type { Slots } from './slots';
export { Slot, SlotValue, useSlots } from './slots';

// ── Stacks and @once ─────────────────────────────────────────────────
export { Push, Prepend, PushIf, PushOnce, PrependOnce, Stack, HasStack, Once } from './stacks';

// ── Template inheritance ──────────────────────────────────────────────
export { Section, Yield, HasSection, SectionMissing, ParentSection } from './inheritance';

// ── Fragment rendering ────────────────────────────────────────────────
export { ViewFragment } from './fragments';

// ── Environment components ────────────────────────────────────────────
export { Env, EnvNot, Production } from './env';

// ── Component attribute bag ───────────────────────────────────────────
export { AttributeBag, PrependsValue, attributeBag } from './attribute-bag';

// ── Auth components ───────────────────────────────────────────────────
export type { AuthContext } from './render-context';
export { Auth, Guest, useAuth } from './auth';

// ── Session components ────────────────────────────────────────────────
export type { SessionContext } from './render-context';
export { Session, useSession } from './session';

// ── Aware (parent prop access) ────────────────────────────────────────
export { Aware, useAware, provideAware, pushAware, popAware } from './aware';

// ── Js helper ─────────────────────────────────────────────────────────
export { Js } from './js';

// ── Custom stringable handlers ────────────────────────────────────────
export { registerStringable, clearStringables, findStringable } from './stringable';

// ── Dynamic component ─────────────────────────────────────────────────
export type { ComponentFn } from './dynamic-component';
export {
  DynamicComponent,
  registerComponent,
  resolveComponent,
  clearComponents,
} from './dynamic-component';

// ── Service injection ─────────────────────────────────────────────────
export { useService } from './services';
