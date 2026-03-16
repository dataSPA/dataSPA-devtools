/**
 * uhtml/worker initialisation for use in the MV3 service worker.
 *
 * uhtml/worker ships a self-contained virtual-DOM implementation — it does not
 * require `document` or any browser globals, making it safe to use in a Chrome
 * MV3 service worker where there is no real DOM.
 *
 * The module default-exports an `initSsr()` factory. Calling it once produces
 * a context with `html`, `render`, and a virtual `document`. We initialise it
 * here and re-export the pieces the background script needs.
 *
 * Usage:
 *   import { html, renderToString } from "~/utils/uhtml-worker";
 *   const markup = renderToString(html`<tr><td>${value}</td></tr>`);
 */

import initSsr from "uhtml/worker";
import type { Hole } from "uhtml";

// The published TypeScript types for uhtml/worker omit the `document` field
// from the return type. Cast through `unknown` to attach the full runtime
// shape we actually need.
type SsrContext = {
  html: (template: TemplateStringsArray, ...values: unknown[]) => Hole;
  render: (container: unknown, fn: () => Hole) => unknown;
  document: {
    createDocumentFragment: () => { toString(): string };
  };
};

const ctx = (initSsr as unknown as () => SsrContext)();

export const { html } = ctx;

/**
 * Render a uhtml `Hole` to an HTML string.
 *
 * Internally renders into a virtual DocumentFragment (no wrapper element)
 * and serialises it with `.toString()`.
 */
export function renderToString(hole: Hole): string {
  const frag = ctx.document.createDocumentFragment();
  ctx.render(frag, () => hole);
  return String(frag);
}
