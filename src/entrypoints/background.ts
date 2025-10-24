import type { PublicPath } from "wxt/browser";

export default defineBackground(() => {
  browser.storage.session.setAccessLevel({
    accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
  });

  const ports: Browser.runtime.Port[] = [];

  let creating: Promise<void> | null; // A global promise to avoid concurrency issues
  async function ensureOffscreenDocument(path: PublicPath) {
    // Check all windows controlled by the service worker to see if one
    // of them is the offscreen document with the given path
    const offscreenUrl = browser.runtime.getURL(path);
    const existingContexts = await browser.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [offscreenUrl],
    });

    if (existingContexts.length > 0) {
      return;
    }

    // create offscreen document
    if (creating) {
      await creating;
    } else {
      creating = browser.offscreen.createDocument({
        url: path,
        reasons: ["CLIPBOARD"],
        justification: "reason for needing the document",
      });
      await creating;
      creating = null;
    }
  }
  browser.runtime.onConnect.addListener((port) => {
    if (port.name === "dataSPAdevtools") {
      port.onDisconnect.addListener(() => {
        const tabId = port.sender?.tab?.id;
        if (tabId) {
          delete ports[tabId];
        }
      });

      port.onMessage.addListener(async (msg) => {
        const { tabId, action, data } = msg;
        if (action === "copyToClipboard") {
          await ensureOffscreenDocument("/offscreen.html" as PublicPath);
          browser.runtime.sendMessage({
            action: "copy-to-clipboard",
            text: data,
            target: "offscreen",
          });
          return;
        }
        ports[tabId] = port;

        // Relay message to content script
        browser.tabs.sendMessage(tabId, { action, data });
      });
    }
  });

  browser.runtime.onMessage.addListener((msg, sender) => {
    if (sender.tab && sender.tab.id && ports[sender.tab.id]) {
      ports[sender.tab.id].postMessage(msg);
    }
  });
});
