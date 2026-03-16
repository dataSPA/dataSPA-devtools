import {
  DATASPA_DEVTOOLS,
  DATASTAR_FETCH_EVENT,
  DATASTAR_SIGNAL_PATCH_EVENT,
  GET_SIGNAL_ROOT,
  GET_SIGNAL_ROOT_REPLY,
  PAGE_BRIDGE_VERSION,
} from "~/utils/constants";
import type { DSFetchDetail, SignalEvent } from "~/utils/types";

type BridgeMessage =
  | {
      source: typeof DATASPA_DEVTOOLS;
      version: number;
      type: typeof DATASTAR_FETCH_EVENT | typeof DATASTAR_SIGNAL_PATCH_EVENT;
      payload: { data: string; el?: string };
    }
  | {
      source: typeof DATASPA_DEVTOOLS;
      version: number;
      type: typeof GET_SIGNAL_ROOT_REPLY;
      payload: { data: string; error?: string };
    };

function cssEscape(value: string) {
  if (typeof CSS !== "undefined" && typeof CSS.escape === "function") {
    return CSS.escape(value);
  }
  return value.replace(/[^a-zA-Z0-9_-]/g, "\\$&");
}

function safeQuerySelectorAll(selector: string): Element[] {
  try {
    return Array.from(document.querySelectorAll(selector));
  } catch {
    return [];
  }
}

function getPostMessageTargetOrigin() {
  return window.location.origin === "null" ? "*" : window.location.origin;
}

function safeJSONStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return JSON.stringify({ error: "Unable to serialize payload" });
  }
}

function postBridgeMessage(message: BridgeMessage) {
  window.postMessage(message, getPostMessageTargetOrigin());
}

function getElementSelector(element: HTMLElement) {
  if (element.id) {
    return `#${cssEscape(element.id)}`;
  }

  if (element.tagName === "BODY") {
    return "body";
  }

  let selector = element.tagName.toLowerCase();

  const classNames = Array.from(element.classList);
  if (classNames.length > 0) {
    selector += `.${classNames.map((name) => cssEscape(name)).join(".")}`;
  }

  if (element.parentNode) {
    const siblings = Array.from(element.parentNode.children);
    const index = siblings.indexOf(element) + 1;
    if (siblings.length > 1) {
      selector += `:nth-child(${index})`;
    }
  }
  return selector;
}

function getUniqueSelector(element: HTMLElement) {
  const selector = getElementSelector(element);
  let elements = safeQuerySelectorAll(selector);

  if (elements.length === 1) {
    return selector;
  }

  let bestSelector = selector;
  let bestCount = elements.length;

  // Try with parents' ids
  let parent = element.parentElement;
  while (parent) {
    if (parent.id) {
      const parentSelector = `#${cssEscape(parent.id)} ${selector}`;
      elements = safeQuerySelectorAll(parentSelector);
      if (elements.length === 1) {
        return parentSelector;
      }
      if (elements.length < bestCount) {
        bestSelector = parentSelector;
        bestCount = elements.length;
      }
    }
    parent = parent.parentElement;
  }

  // Try with parents' classes
  const parentClasses = new Set<string>();
  parent = element.parentElement;
  while (parent && parent.tagName !== "BODY") {
    const classes = Array.from(parent.classList).filter(
      (className) => !parentClasses.has(className),
    );

    for (const className of classes) {
      const parentSelector = `.${cssEscape(className)} ${selector}`;
      elements = safeQuerySelectorAll(parentSelector);
      if (elements.length === 1) {
        return parentSelector;
      }
      if (elements.length < bestCount) {
        bestSelector = parentSelector;
        bestCount = elements.length;
      }
      parentClasses.add(className);
    }
    parent = parent.parentElement;
  }

  // Try with all parents
  parent = element.parentElement;
  let selectors = [selector];
  while (parent && parent.tagName !== "BODY") {
    const newSelectors = [];
    for (const candidateSelector of selectors) {
      const newSelector = `${parent.tagName.toLowerCase()} ${candidateSelector}`;
      newSelectors.push(newSelector);
      elements = safeQuerySelectorAll(newSelector);
      if (elements.length === 1) {
        return newSelector;
      }
      if (elements.length < bestCount) {
        bestSelector = newSelector;
        bestCount = elements.length;
      }
    }
    selectors = newSelectors;
    parent = parent.parentElement;
  }

  if (safeQuerySelectorAll(bestSelector).length === 0) {
    return element.tagName.toLowerCase();
  }

  return bestSelector;
}

function resolveDatastarRoot(): unknown {
  const w = window as unknown as Record<string, unknown>;
  const candidates = [w?.datastar, w?.Datastar, w?.dataStar, w?.__datastar];

  for (const candidate of candidates) {
    if (
      candidate !== undefined &&
      typeof candidate === "object" &&
      candidate !== null &&
      "root" in candidate
    ) {
      return (candidate as Record<string, unknown>).root;
    }
  }

  return null;
}

export default defineUnlistedScript(() => {
  // Forward datastar-fetch events to the content script as raw JSON
  document.addEventListener(DATASTAR_FETCH_EVENT, ((
    event: CustomEvent<DSFetchDetail>,
  ) => {
    const element = event.detail.el;
    const elementSelector = getUniqueSelector(element);

    postBridgeMessage({
      source: DATASPA_DEVTOOLS,
      version: PAGE_BRIDGE_VERSION,
      type: DATASTAR_FETCH_EVENT,
      payload: {
        el: elementSelector,
        data: safeJSONStringify({
          type: event.detail.type,
          argsRaw: event.detail.argsRaw,
          el: elementSelector,
        }),
      },
    });
  }) as EventListener);

  // Forward datastar-signal-patch events to the content script as raw JSON
  document.addEventListener(DATASTAR_SIGNAL_PATCH_EVENT, ((
    event: CustomEvent<SignalEvent>,
  ) => {
    postBridgeMessage({
      source: DATASPA_DEVTOOLS,
      version: PAGE_BRIDGE_VERSION,
      type: DATASTAR_SIGNAL_PATCH_EVENT,
      payload: {
        data: safeJSONStringify(event.detail),
      },
    });
  }) as EventListener);

  // Respond to GET_SIGNAL_ROOT requests from the content script
  window.addEventListener("message", (event: MessageEvent<unknown>) => {
    if (event.source !== window) return;
    if (
      typeof event.data !== "object" ||
      event.data === null ||
      (event.data as Record<string, unknown>).source !== DATASPA_DEVTOOLS ||
      (event.data as Record<string, unknown>).version !== PAGE_BRIDGE_VERSION ||
      (event.data as Record<string, unknown>).type !== GET_SIGNAL_ROOT
    ) {
      return;
    }

    const root = resolveDatastarRoot();
    const data = safeJSONStringify(root);

    postBridgeMessage({
      source: DATASPA_DEVTOOLS,
      version: PAGE_BRIDGE_VERSION,
      type: GET_SIGNAL_ROOT_REPLY,
      payload: {
        data,
        error: data === JSON.stringify(null) ? undefined : undefined,
      },
    });
  });
});
