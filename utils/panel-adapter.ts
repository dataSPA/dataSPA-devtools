import { DATASTAR_FETCH_EVENT } from '~/utils/constants'
import { isRecord } from '~/utils/guards'
import type { PanelMessage, PanelPatchMessage } from '~/utils/types'

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
 * Attaches a message listener to the given port. Any `patch-elements` message
 * received from the background is translated to a Datastar DOM patch.
 * The ht-* element tree is now embedded directly in the `patch-elements`
 * payload (rendered by the offscreen document), so no separate handler is
 * needed here.
 */
export function attachPanelMessageListener(port: Browser.runtime.Port): void {
  port.onMessage.addListener((message: unknown) => {
    if (!isRecord(message) || message.type === undefined) return

    const msg = message as PanelMessage
    if (msg.type === 'patch-elements') {
      dispatchPatch(msg)
    }
  })
}
