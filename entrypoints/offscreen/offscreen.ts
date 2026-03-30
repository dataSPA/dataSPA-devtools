/**
 * Offscreen document — handles tasks that require a real DOM but cannot run
 * in the MV3 service worker.
 *
 * Supported actions (routed via `message.target === 'offscreen'`):
 *   - `highlight-selectors` — gets the selectors from a patch-elements event
 *   - `copy-to-clipboard`   — writes text to the clipboard (CLIPBOARD reason)
 *   - `render-html-tree`    — parses an HTML string and returns a serialised
 *                             ht-* collapsible tree (DOM_PARSER reason)
 */

import type { SSEEvent } from "@/utils/types";
import {
  COPY_TO_CLIPBOARD,
  HIGHLIGHT_SELECTORS,
  RENDER_HTML_TREE,
} from "~/utils/constants";
import { buildHtmlTree } from "~/utils/html-tree";

type HighlightSelectorsResponse = {
  ok: boolean;
  error?: string;
};

type ClipboardResponse = {
  ok: boolean;
  error?: string;
};

type HtmlTreeResponse = {
  ok: boolean;
  html?: string;
  error?: string;
};

function fragmentFromElements(elements: string) {
  const elementsWithSvgsRemoved = elements.replace(
    /<svg(\s[^>]*>|>)([\s\S]*?)<\/svg>/gim,
    "",
  );
  const hasHtml = /<\/html>/.test(elementsWithSvgsRemoved);
  const hasHead = /<\/head>/.test(elementsWithSvgsRemoved);
  const hasBody = /<\/body>/.test(elementsWithSvgsRemoved);

  const newDocument = new DOMParser().parseFromString(
    hasHtml || hasHead || hasBody
      ? elements
      : `<body><template>${elements}</template></body>`,
    "text/html",
  );
  let newContent = document.createDocumentFragment();
  if (hasHtml) {
    newContent.appendChild(newDocument.documentElement);
  } else if (hasHead && hasBody) {
    newContent.appendChild(newDocument.head);
    newContent.appendChild(newDocument.body);
  } else if (hasHead) {
    newContent.appendChild(newDocument.head);
  } else if (hasBody) {
    newContent.appendChild(newDocument.body);
  } else {
    newContent = newDocument.querySelector("template")!.content;
  }
  return newContent;
}
function fragmentForEvent(event: SSEEvent) {
  if (!event.argsRaw || !event.argsRaw.elements) {
    return;
  }

  const elements = event.argsRaw.elements;

  return fragmentFromElements(elements);
}

function getSelectors(event: SSEEvent) {
  if (event.argsRaw?.selector) {
    return [event.argsRaw.selector];
  }

  const selectors = [];

  const doc = fragmentForEvent(event);
  if (!doc) {
    return [];
  }

  for (const child of doc.children) {
    if (child instanceof HTMLHtmlElement) {
      selectors.push("DOCUMENT");
    } else if (child instanceof HTMLBodyElement) {
      selectors.push("BODY");
    } else if (child instanceof HTMLHeadElement) {
      selectors.push("HEAD");
    } else {
      selectors.push(
        child.id ? `#${CSS.escape(child.id)}` : child.nodeName.toLowerCase(),
      );
    }
  }

  return selectors;
}

export { getSelectors as getSelector };

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

  if (message.action === HIGHLIGHT_SELECTORS) {
    sendResponse(getSelectors(message.event as SSEEvent));
  }
});
