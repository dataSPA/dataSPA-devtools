import type { PublicPath } from 'wxt/browser'
import {
  DATASPA_DEVTOOLS,
  GET_SIGNAL_ROOT,
  HIGHLIGHT_SELECTORS,
  HIGHLIGHT_STYLE,
  PAGE_BRIDGE_VERSION,
  REMOVE_HIGHLIGHTS,
  SEND_TO_CONSOLE,
} from '~/utils/constants'
import { isBridgeEventMessage, isRecord } from '~/utils/guards'

type RuntimeActionMessage = {
  action: string
  data?: unknown
}

function isRuntimeActionMessage(msg: unknown): msg is RuntimeActionMessage {
  return isRecord(msg) && typeof msg.action === 'string'
}

function safeQuerySelector(selector: string): Element | null {
  try {
    return document.querySelector(selector)
  } catch {
    return null
  }
}

function safeQuerySelectorAll(selector: string): Element[] {
  try {
    return Array.from(document.querySelectorAll(selector))
  } catch {
    return []
  }
}

function getPostMessageTargetOrigin() {
  return window.location.origin === 'null' ? '*' : window.location.origin
}

export default defineContentScript({
  matches: ['*://*/*'],
  async main() {
    const postMessageTargetOrigin = getPostMessageTargetOrigin()

    browser.runtime.onMessage.addListener((msg: unknown) => {
      if (!isRuntimeActionMessage(msg)) return

      switch (msg.action) {
        case GET_SIGNAL_ROOT:
          window.postMessage(
            {
              source: DATASPA_DEVTOOLS,
              version: PAGE_BRIDGE_VERSION,
              type: GET_SIGNAL_ROOT,
            },
            postMessageTargetOrigin,
          )
          break
        case SEND_TO_CONSOLE: {
          if (!isRecord(msg.data) || typeof msg.data.el !== 'string') {
            return
          }
          const element = safeQuerySelector(msg.data.el)
          console.log({ ...msg.data, el: element })
          break
        }
        case HIGHLIGHT_SELECTORS:
          if (!Array.isArray(msg.data)) return
          for (const selector of msg.data) {
            if (typeof selector !== 'string') continue
            for (const el of safeQuerySelectorAll(selector)) {
              el.classList.add(HIGHLIGHT_STYLE)
            }
          }
          break
        case REMOVE_HIGHLIGHTS: {
          const els = document.querySelectorAll(`.${HIGHLIGHT_STYLE}`)
          for (const el of els) {
            el.classList.remove(HIGHLIGHT_STYLE)
          }
          break
        }
      }
    })

    window.addEventListener('message', async (event: MessageEvent<unknown>) => {
      if (event.source !== window) return
      if (
        event.origin &&
        event.origin !== window.location.origin &&
        event.origin !== 'null'
      ) {
        return
      }

      if (!isBridgeEventMessage(event.data)) return

      try {
        await browser.runtime.sendMessage({ data: JSON.stringify(event.data) })
      } catch (error) {
        console.error('Failed to forward bridge event to background', error)
      }
    })

    const script = document.createElement('script')
    script.src = browser.runtime.getURL('injected.js' as PublicPath)
    script.dataset.source = DATASPA_DEVTOOLS
    ;(document.head || document.documentElement).appendChild(script)

    const style = document.createElement('style')
    style.id = HIGHLIGHT_STYLE
    style.textContent = `
      .${HIGHLIGHT_STYLE} {
      outline: 3px solid magenta !important;
      outline-offset: -3px !important;
      }
      `
    document.head.appendChild(style)
  },
})
