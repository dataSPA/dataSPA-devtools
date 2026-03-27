/**
 * Minimal tagged template utility for producing HTML strings safely in
 * environments with no DOM (e.g. the MV3 service worker background script).
 *
 * String interpolations are HTML-escaped automatically. To interpolate
 * already-safe markup (e.g. the result of a nested `html` call), wrap the
 * value with `SafeHtml` or return it from another `html` tagged template —
 * both produce a `SafeHtml` instance that is inserted verbatim.
 *
 * Usage:
 *   import { html } from '~/utils/html'
 *   const markup: string = html`<td>${value}</td>`
 */

/** Opaque wrapper for pre-escaped HTML strings. */
class SafeHtml {
  constructor(readonly value: string) {}
  toString(): string {
    return this.value
  }
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function interpolate(value: unknown): string {
  if (value instanceof SafeHtml) return value.value
  if (Array.isArray(value)) return value.map(interpolate).join('')
  if (value == null || value === false) return ''
  return escapeHtml(String(value))
}

/**
 * Tagged template tag. Returns a `SafeHtml` instance whose `.toString()`
 * yields the full HTML string. This means nested `html` results are inserted
 * verbatim while plain string/number interpolations are escaped.
 */
function html(strings: TemplateStringsArray, ...values: unknown[]): SafeHtml {
  let result = ''
  for (let i = 0; i < strings.length; i++) {
    result += strings[i]
    if (i < values.length) {
      result += interpolate(values[i])
    }
  }
  return new SafeHtml(result)
}

export { html, SafeHtml, escapeHtml }
