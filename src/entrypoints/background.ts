export default defineBackground(() => {
  browser.storage.session.setAccessLevel({
    accessLevel: "TRUSTED_AND_UNTRUSTED_CONTEXTS",
  });

  const ports: Browser.runtime.Port[] = [];

  browser.runtime.onConnect.addListener((port) => {
    if (port.name === "dataSPAdevtools") {
      port.onDisconnect.addListener(() => {
        const tabId = port.sender?.tab?.id;
        if (tabId) {
          delete ports[tabId];
        }
      });

      port.onMessage.addListener((msg) => {
        console.log("got some messages", msg);
        const { tabId, action } = msg;
        ports[tabId] = port;

        // Relay message to content script
        browser.tabs.sendMessage(tabId, { action });
      });
    }
  });

  // browser.runtime.onMessage.addListener(console.log);
  browser.runtime.onMessage.addListener((msg, sender) => {
    if (sender.tab && sender.tab.id && ports[sender.tab.id]) {
      ports[sender.tab.id].postMessage(msg);
    }
  });
});
