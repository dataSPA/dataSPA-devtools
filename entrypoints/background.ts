import type { PublicPath } from "wxt/browser";

import {
  COPY_TO_CLIPBOARD,
  DATASPA_DEVTOOLS,
  DATASTAR_FETCH_EVENT,
  GET_SIGNAL_ROOT,
  GET_SIGNAL_ROOT_REPLY,
  HIDE_EVENT,
  HIGHLIGHT_SELECTORS,
  PORT_INIT,
  REMOVE_HIGHLIGHTS,
  RENDER_HTML_TREE,
  SEND_TO_CONSOLE,
  SHOW_EVENT,
} from "~/utils/constants";
import {
  isBridgeEventMessage,
  isHtmlTreeResponse,
  isRecord,
  parseJson,
} from "~/utils/guards";
import { html, type SafeHtml } from "~/utils/html";
import { type PanelMessage, RingBuffer, type SSEEvent } from "~/utils/types";

type DevtoolsPortMessage = {
  tabId: number;
  action: string;
  data?: unknown;
};

type ClipboardResponse = {
  ok: boolean;
  error?: string;
};

const FORWARDED_TAB_ACTIONS = new Set([
  GET_SIGNAL_ROOT,
  HIGHLIGHT_SELECTORS,
  REMOVE_HIGHLIGHTS,
  SEND_TO_CONSOLE,
]);

function isDevtoolsPortMessage(msg: unknown): msg is DevtoolsPortMessage {
  if (!isRecord(msg)) return false;

  const tabId = msg.tabId;
  if (typeof tabId !== "number" || !Number.isInteger(tabId) || tabId < 0) {
    return false;
  }

  if (typeof msg.action !== "string") return false;

  if (msg.action === PORT_INIT) return true;
  if (msg.action === SHOW_EVENT) return true;
  if (msg.action === HIDE_EVENT) return true;
  if (msg.action === COPY_TO_CLIPBOARD) return typeof msg.data === "string";

  return FORWARDED_TAB_ACTIONS.has(msg.action);
}

function isForwardableRuntimeMessage(msg: unknown): msg is { data: string } {
  return isRecord(msg) && typeof msg.data === "string";
}

function isClipboardResponse(value: unknown): value is ClipboardResponse {
  return isRecord(value) && typeof value.ok === "boolean";
}

// Render the detail pane content for a selected SSE event.
// `treeHtml` is a pre-rendered ht-* HTML string produced by the offscreen doc,
// or null when no elements payload exists for the selected event.
function renderEventDetail(
  event: SSEEvent | undefined,
  treeHtml: string | null,
): SafeHtml {
  if (!event) {
    return html``;
  }
  return html`
    <div>
      <button>Highlight selector</button
      ><button data-on:click="#hideEvent()">Close</button>
    </div>
    ${treeHtml != null
      ? html`<div id="elements-tree" class="ht-tree">${treeHtml}</div>`
      : html``}
  `;
}

// Render the full panel shell containing the event table and detail pane.
function renderContent(
  events: SSEEvent[],
  selectedEvent?: SSEEvent,
  treeHtml?: string | null,
): SafeHtml {
  return html`
    <div id="content">
      <pre
        id="json-signals"
        data-json-signals
        data-signals__ifmissing="{dividerPosition: 50}"
      ></pre>
      ${selectedEvent === undefined
        ? html`<div id="events" slot="start">${renderSseRows(events)}</div>`
        : html` <wa-split-panel
            orientation="vertical"
            data-on:wa-reposition="$dividerPosition = evt.target.position"
            data-attr:position="$dividerPosition"
          >
            <div id="events" slot="start">${renderSseRows(events)}</div>
            <div id="event-detail" slot="end">
              ${renderEventDetail(selectedEvent, treeHtml ?? null)}
            </div>
          </wa-split-panel>`}
    </div>
  `;
}

// Render the full list of SSE events as <tr> rows inside a single <tbody>
function renderSseRows(events: SSEEvent[]): SafeHtml {
  if (events.length === 0) {
    return html`<table>
      <thead>
        <tr>
          <th>Element</th>
          <th>Type</th>
          <th>Selector</th>
          <th>Mode</th>
        </tr>
      </thead>
      <tbody id="events-tbody">
        <tr data-on:click="console.log(evt)">
          <td colspan="4"><em>No events captured yet.</em></td>
        </tr>
      </tbody>
    </table>`;
  }
  return html`<table
    data-on:click="#showEvent(evt.target.closest('tr').dataset.eventId)"
  >
    <thead>
      <tr>
        <th>Element</th>
        <th>Type</th>
        <th>Selector</th>
        <th>Mode</th>
      </tr>
    </thead>
    <tbody id="events-tbody">
      ${events.map(
        (event) => html`
          <tr id="${`event-row-${event.id}`}" data-event-id="${event.id}">
            <td>${event.el ?? ""}</td>
            <td>${event.type}</td>
            <td>${event.argsRaw?.selector ?? ""}</td>
            <td>${event.argsRaw?.mode ?? ""}</td>
          </tr>
        `,
      )}
    </tbody>
  </table>`;
}

// Render a signal patch as a JSON <pre> block (unused while signal broadcast is commented out)
function _renderSignalPatch(patch: unknown): string {
  return String(
    html`<pre id="signal-patch">${JSON.stringify(patch, null, 2)}</pre>`,
  );
}

// Render a signal root snapshot as a JSON <pre> block
function renderSignalRoot(root: unknown): string {
  return String(
    html`<pre id="signal-root">${JSON.stringify(root, null, 2)}</pre>`,
  );
}

export default defineBackground(() => {
  if (browser.storage?.session?.setAccessLevel) {
    void browser.storage.session
      .setAccessLevel({
        accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
      })
      .catch((error) => {
        console.error("Failed to set session storage access level", error);
      });
  }

  const ports: Map<number, Set<Browser.runtime.Port>> = new Map();
  const portToTabId = new Map<Browser.runtime.Port, number>();

  // One ring buffer per tab, persists until tab is closed / removed
  const sseBuffers = new Map<number, RingBuffer<SSEEvent>>();
  // Monotonic counter per tab for assigning stable event IDs
  const sseCounters = new Map<number, number>();
  // Currently selected event per tab (shown in the detail pane)
  const sseSplitOpen = new Map<number, SSEEvent>();
  // Cached ht-* tree HTML for the currently selected event per tab
  const sseSplitOpenTreeHtml = new Map<number, string | null>();

  let creating: Promise<void> | null = null;

  async function ensureOffscreenDocument(path: PublicPath) {
    if (typeof browser.runtime.getContexts !== "function") {
      throw new Error("runtime.getContexts is not available");
    }
    if (!browser.offscreen?.createDocument) {
      throw new Error("offscreen.createDocument is not available");
    }

    const offscreenUrl = browser.runtime.getURL(path);
    const existingContexts = await browser.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl],
    });

    if (existingContexts.length > 0) {
      return;
    }

    if (creating) {
      await creating;
    } else {
      creating = (async () => {
        await browser.offscreen.createDocument({
          url: path,
          reasons: ["CLIPBOARD", "DOM_PARSER"],
          justification:
            "Copy extension-inspected payloads to clipboard; parse HTML payloads into element trees",
        });
      })();
      try {
        await creating;
      } finally {
        creating = null;
      }
    }
  }

  async function copyToClipboard(text: string): Promise<void> {
    await ensureOffscreenDocument("/offscreen.html" as PublicPath);
    const response = await browser.runtime.sendMessage({
      action: COPY_TO_CLIPBOARD,
      target: "offscreen",
      text,
    });

    if (!isClipboardResponse(response) || !response.ok) {
      const error =
        isClipboardResponse(response) && response.error
          ? response.error
          : "Unknown offscreen clipboard error";
      throw new Error(error);
    }
  }

  /**
   * Ask the offscreen document to parse `elements` (raw HTML) and return a
   * serialised ht-* tree HTML string. Returns null on failure.
   */
  async function renderHtmlTree(elements: string): Promise<string | null> {
    try {
      await ensureOffscreenDocument("/offscreen.html" as PublicPath);
      const response = await browser.runtime.sendMessage({
        action: RENDER_HTML_TREE,
        target: "offscreen",
        elements,
      });
      if (!isHtmlTreeResponse(response) || !response.ok) {
        const error =
          isHtmlTreeResponse(response) && response.error
            ? response.error
            : "Unknown offscreen html-tree error";
        console.error("HTML tree render failed", error);
        return null;
      }
      return response.html ?? null;
    } catch (error) {
      console.error("HTML tree render failed", error);
      return null;
    }
  }

  function broadcastToTab(tabId: number, message: PanelMessage) {
    const allPorts = ports.get(tabId);
    if (allPorts) {
      for (const port of allPorts) {
        port.postMessage(message);
      }
    }
  }

  // Clean up SSE buffer when a tab is closed
  browser.tabs.onRemoved.addListener((tabId) => {
    sseBuffers.delete(tabId);
    sseCounters.delete(tabId);
    sseSplitOpen.delete(tabId);
    sseSplitOpenTreeHtml.delete(tabId);
  });

  browser.runtime.onConnect.addListener((port) => {
    if (port.name !== DATASPA_DEVTOOLS) return;

    port.onMessage.addListener(async (msg: unknown) => {
      if (!isDevtoolsPortMessage(msg)) return;

      const { tabId, action, data } = msg;

      if (action === PORT_INIT) {
        if (!ports.has(tabId)) {
          ports.set(tabId, new Set());
        }
        ports.get(tabId)?.add(port);
        portToTabId.set(port, tabId);

        // Send current SSE history to the newly connected panel
        const buffer = sseBuffers.get(tabId);
        if (buffer && !buffer.isEmpty()) {
          const selectedEvent = sseSplitOpen.get(tabId);
          // Use the cached tree HTML — no extra offscreen round-trip needed
          const treeHtml = sseSplitOpenTreeHtml.get(tabId) ?? null;
          port.postMessage({
            type: "patch-elements",
            selector: "",
            mode: "outer",
            elements: String(
              renderContent(buffer.toArray(), selectedEvent, treeHtml),
            ),
          } satisfies PanelMessage);
        }
        return;
      }

      if (action === SHOW_EVENT) {
        if (typeof data !== "string") return;
        const buffer = sseBuffers.get(tabId);
        const events = buffer?.toArray() ?? [];
        const selectedEvent = events.find((e) => e.id === data);
        if (selectedEvent) {
          sseSplitOpen.set(tabId, selectedEvent);
        }

        // Render the HTML tree in the offscreen doc (if the event has elements)
        const rawElements = selectedEvent?.argsRaw?.elements;
        const treeHtml = rawElements ? await renderHtmlTree(rawElements) : null;
        sseSplitOpenTreeHtml.set(tabId, treeHtml);

        port.postMessage({
          type: "patch-elements",
          selector: "",
          mode: "outer",
          elements: String(renderContent(events, selectedEvent, treeHtml)),
        } satisfies PanelMessage);
        return;
      }
      if (action === HIDE_EVENT) {
        const buffer = sseBuffers.get(tabId);
        const events = buffer?.toArray() ?? [];
        sseSplitOpen.delete(tabId);

        port.postMessage({
          type: "patch-elements",
          selector: "",
          mode: "outer",
          elements: String(renderContent(events)),
        } satisfies PanelMessage);
        return;
      }

      if (action === COPY_TO_CLIPBOARD) {
        if (typeof data !== "string") return;
        try {
          await copyToClipboard(data);
        } catch (error) {
          console.error("Clipboard copy failed", error);
        }
        return;
      }

      // Relay message to content script
      try {
        await browser.tabs.sendMessage(tabId, { action, data });
      } catch (error) {
        console.error(`Failed to send tab message for tab ${tabId}`, error);
      }
    });

    port.onDisconnect.addListener(() => {
      const tabId = portToTabId.get(port);
      if (typeof tabId === "number" && ports.has(tabId)) {
        const set = ports.get(tabId);
        if (!set) return;
        set.delete(port);
        if (set.size === 0) ports.delete(tabId);
      }
      portToTabId.delete(port);
    });
  });

  browser.runtime.onMessage.addListener((msg: unknown, sender) => {
    if (sender.id !== browser.runtime.id) return;
    const tabId = sender.tab?.id;
    if (typeof tabId !== "number") return;
    if (!isForwardableRuntimeMessage(msg)) return;

    const parsed = parseJson(msg.data);
    if (!isBridgeEventMessage(parsed)) return;

    const { type, payload } = parsed;

    if (type === DATASTAR_FETCH_EVENT) {
      // Parse the raw SSEEvent JSON from the injected script
      const eventData = parseJson(payload.data);
      if (!isRecord(eventData) || typeof eventData.type !== "string") return;

      if (eventData.type === "started" || eventData.type === "finished") {
        return;
      }

      const nextId = (sseCounters.get(tabId) ?? 0) + 1;
      sseCounters.set(tabId, nextId);

      const sseEvent: SSEEvent = {
        id: String(nextId),
        type: eventData.type,
        el: typeof payload.el === "string" ? payload.el : undefined,
        argsRaw: isRecord(eventData.argsRaw)
          ? {
              selector:
                typeof eventData.argsRaw.selector === "string"
                  ? eventData.argsRaw.selector
                  : undefined,
              elements:
                typeof eventData.argsRaw.elements === "string"
                  ? eventData.argsRaw.elements
                  : undefined,
              mode:
                typeof eventData.argsRaw.mode === "string"
                  ? eventData.argsRaw.mode
                  : undefined,
            }
          : undefined,
      };

      if (!sseBuffers.has(tabId)) {
        sseBuffers.set(tabId, new RingBuffer<SSEEvent>(100));
      }
      sseBuffers.get(tabId)!.push(sseEvent);

      // No event is newly selected on ingest — broadcast without a tree
      broadcastToTab(tabId, {
        type: "patch-elements",
        selector: "",
        mode: "outer",
        elements: String(
          renderContent(
            sseBuffers.get(tabId)!.toArray(),
            sseSplitOpen.get(tabId),
            sseSplitOpenTreeHtml.get(tabId),
          ),
        ),
      });
      // } else if (type === DATASTAR_SIGNAL_PATCH_EVENT) {
      //   const patch = parseJson(payload.data)
      //   broadcastToTab(tabId, {
      //     type: 'patch-elements',
      //     selector: '#signal-patch-container',
      //     mode: 'outer',
      //     elements: _renderSignalPatch(patch),
      //   })
    } else if (type === GET_SIGNAL_ROOT_REPLY) {
      const root = parseJson(payload.data);
      broadcastToTab(tabId, {
        type: "patch-elements",
        selector: "#signal-root-container",
        mode: "outer",
        elements: renderSignalRoot(root),
      });
    }
  });
});
