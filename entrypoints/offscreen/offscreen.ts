/**
 * Offscreen document — handles tasks that require a real DOM but cannot run
 * in the MV3 service worker.
 *
 * Supported actions (routed via `message.target === 'offscreen'`):
 *   - `copy-to-clipboard`  — writes text to the clipboard (CLIPBOARD reason)
 *   - `render-html-tree`   — parses an HTML string and returns a serialised
 *                            ht-* collapsible tree (DOM_PARSER reason)
 */

import { COPY_TO_CLIPBOARD, RENDER_HTML_TREE } from "~/utils/constants";
import { buildHtmlTree } from "~/utils/html-tree";

type ClipboardResponse = {
  ok: boolean;
  error?: string;
};

type HtmlTreeResponse = {
  ok: boolean;
  html?: string;
  error?: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

async function copyText(text: string): Promise<ClipboardResponse> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return { ok: true };
    }

    const textarea = document.getElementById(
      "clipboard-textarea",
    ) as HTMLTextAreaElement | null;

    if (!textarea) {
      return { ok: false, error: "Offscreen clipboard textarea is missing" };
    }

    textarea.value = text;
    textarea.select();

    const copied = document.execCommand("copy");
    if (!copied) {
      return {
        ok: false,
        error: "document.execCommand('copy') returned false",
      };
    }

    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Clipboard write failed",
    };
  }
}

function renderHtmlTree(elements: string): HtmlTreeResponse {
  try {
    const html = buildHtmlTree(elements);
    return { ok: true, html };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "HTML tree render failed",
    };
  }
}

browser.runtime.onMessage.addListener((message: unknown, _, sendResponse) => {
  if (!isRecord(message)) return;
  if (message.target !== "offscreen") return;

  if (message.action === COPY_TO_CLIPBOARD) {
    if (typeof message.text !== "string") {
      return Promise.resolve({
        ok: false,
        error: "Invalid clipboard payload",
      } satisfies ClipboardResponse);
    }
    return sendResponse(copyText(message.text));
  }

  if (message.action === RENDER_HTML_TREE) {
    if (typeof message.elements !== "string") {
      return Promise.resolve({
        ok: false,
        error: "Invalid html-tree payload",
      } satisfies HtmlTreeResponse);
    }
    sendResponse(renderHtmlTree(message.elements));
  }
});
