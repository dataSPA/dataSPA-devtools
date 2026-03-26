import type { PublicPath } from "wxt/browser";

import {
  COPY_TO_CLIPBOARD,
  DATASPA_DEVTOOLS,
  DATASTAR_FETCH_EVENT,
  DATASTAR_SIGNAL_PATCH_EVENT,
  GET_SIGNAL_ROOT,
  GET_SIGNAL_ROOT_REPLY,
  HIGHLIGHT_SELECTORS,
  PORT_INIT,
  REMOVE_HIGHLIGHTS,
  SEND_TO_CONSOLE,
} from "~/utils/constants";
import { isRecord, isBridgeEventMessage, parseJson } from "~/utils/guards";
import { html, type SafeHtml } from "~/utils/html";
import { type SSEEvent, type PanelMessage, RingBuffer } from "~/utils/types";

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
  if (msg.action === COPY_TO_CLIPBOARD) return typeof msg.data === "string";

  return FORWARDED_TAB_ACTIONS.has(msg.action);
}

function isForwardableRuntimeMessage(msg: unknown): msg is { data: string } {
  return isRecord(msg) && typeof msg.data === "string";
}

function isClipboardResponse(value: unknown): value is ClipboardResponse {
  return isRecord(value) && typeof value.ok === "boolean";
}

// Render the detail pane content for a selected SSE event
function renderEventDetail(event: SSEEvent | undefined): SafeHtml {
  if (!event) {
    return html`<p><em>Select an event to see its details.</em></p>`;
  }
  return html`
    <dl>
      <dt>Type</dt>
      <dd>${event.type}</dd>
      <dt>Element</dt>
      <dd>${event.el ?? ""}</dd>
      <dt>Selector</dt>
      <dd>${event.argsRaw?.selector ?? ""}</dd>
      <dt>Mode</dt>
      <dd>${event.argsRaw?.mode ?? ""}</dd>
    </dl>
    ${event.argsRaw?.elements
      ? html`<pre>${event.argsRaw.elements}</pre>`
      : html``}
  `;
}

// Render the full list of SSE events as <tr> rows inside a single <tbody>
function renderContent(events: SSEEvent[], selectedEvent?: SSEEvent): SafeHtml {
  return html`
    <div id="content">
      <wa-split-panel
        orientation="vertical"
        data-on:wa-reposition="$dividerPosition = evt.target.position"
        data-attr:position="$dividerPosition"
      >
        <div slot="start">${renderSseRows(events)}</div>
        <div slot="end">${renderEventDetail(selectedEvent)}</div>
      </wa-split-panel>
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

// Render a signal patch as a JSON <pre> block
function renderSignalPatch(patch: unknown): string {
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
          reasons: ["CLIPBOARD"],
          justification: "Copy extension-inspected payloads to clipboard",
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
          const patchMsg: PanelMessage = {
            type: "patch-elements",
            selector: "",
            mode: "replace",
            elements: String(renderContent(buffer.toArray())),
          };
          port.postMessage(patchMsg);
        }
        return;
      }

      if (action === SHOW_EVENT) {
        if (typeof data !== "string") return;
        const event = sseBuffers
          .get(tabId)
          ?.toArray()
          .find((e) => e.id === data);
        if (event) {
          port.postMessage({ type: "show-event", event });
        }
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

      broadcastToTab(tabId, {
        type: "patch-elements",
        selector: "",
        mode: "replace",
        elements: String(renderContent(sseBuffers.get(tabId)!.toArray())),
      });
      // } else if (type === DATASTAR_SIGNAL_PATCH_EVENT) {
      //   const patch = parseJson(payload.data);
      //   broadcastToTab(tabId, {
      //     type: "patch-elements",
      //     selector: "#signal-patch-container",
      //     mode: "replace",
      //     elements: renderSignalPatch(patch),
      //   });
    } else if (type === GET_SIGNAL_ROOT_REPLY) {
      const root = parseJson(payload.data);
      broadcastToTab(tabId, {
        type: "patch-elements",
        selector: "#signal-root-container",
        mode: "replace",
        elements: renderSignalRoot(root),
      });
    }
  });
});
