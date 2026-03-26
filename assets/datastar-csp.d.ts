/**
 * Type declarations for the bundled Datastar CSP build.
 *
 * Only the exports consumed by TypeScript source files are declared here.
 * The full runtime surface is much larger, but the remaining exports are
 * accessed via dynamic <script> injection and do not need TS types.
 */

/**
 * Register a named helper function callable from Datastar expressions as
 * `#name(...)`.
 */
export declare function registerHelper(
  name: string,
  fn: (...args: any[]) => any,
): void
