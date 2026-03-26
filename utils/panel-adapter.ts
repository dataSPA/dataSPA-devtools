import { renderHtmlTree } from '~/entrypoints/datastar-sse-panel/html-tree'
import { DATASTAR_FETCH_EVENT, SHOW_ELEMENTS } from '~/utils/constants'
import { isRecord } from '~/utils/guards'
import type {
  PanelElementsMessage,
  PanelMessage,
  PanelPatchMessage,
} from '~/utils/types'

/**
 * Translates a `PanelPatchMessage` from the background into a `datastar-fetch`
 * CustomEvent that Datastar processes natively in the panel document.
 */
function dispatchPatch(msg: PanelPatchMessage): void {
  document.dispatchEvent(
    new CustomEvent(DATASTAR_FETCH_EVENT, {
      detail: {
        type: 'datastar-patch-elements',
        el: document.body,
        argsRaw: {
          selector: msg.selector ?? '',
          mode: msg.mode ?? 'outer',
          elements: msg.elements,
        },
      },
    }),
  )
}

/**
 * Handles a `PanelElementsMessage` from the background by rendering a
 * collapsible HTML tree into `#elements-tree`. The `patch-elements` message
 * that injects that container always arrives before this message, so we defer
 * with `requestAnimationFrame` to ensure Datastar has flushed the DOM patch.
 */
function handleShowElements(msg: PanelElementsMessage): void {
  if (msg.elements == null) return
  const raw = msg.elements
  requestAnimationFrame(() => {
    const container = document.getElementById('elements-tree')
    if (!(container instanceof HTMLElement)) return
    renderHtmlTree(container, raw)
  })
}

/**
 * Attaches a message listener to the given port. Any `patch-elements` message
 * received from the background is translated to a Datastar DOM patch.
 * Any `show-elements` message triggers the panel-side HTML tree renderer.
 */
export function attachPanelMessageListener(port: Browser.runtime.Port): void {
  port.onMessage.addListener((message: unknown) => {
    if (!isRecord(message) || message.type === undefined) return

    const msg = message as PanelMessage
    if (msg.type === 'patch-elements') {
      dispatchPatch(msg)
      return
    }
    if (msg.type === SHOW_ELEMENTS) {
      handleShowElements(msg)
    }
  })
}
