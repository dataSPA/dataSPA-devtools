import { storage } from "#imports";
import { PublicPath } from "wxt/browser";

export default defineContentScript({
  matches: ["*://*/*"],
  async main(ctx) {
    browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      console.log("Got a message from the devtools", msg);
      if (msg.action === "getPageInfo") {
        const info = { title: document.title };
        browser.runtime.sendMessage(info);
      }
    });
    window.addEventListener("message", async (event) => {
      if (event.source !== window) return;
      if (event.data.type === "datastar-fetch") {
        await browser.runtime.sendMessage({ data: JSON.stringify(event.data) });
      }
    });
    const script = document.createElement("script");
    script.src = browser.runtime.getURL("injected.js" as PublicPath);
    (document.head || document.documentElement).appendChild(script);
    const style = document.createElement("style");
    style.id = "dataSPADevtoolsHighlightStyle";
    style.textContent = `
      .dataSPADevtoolsHighlightStyle {
        outline: 3px solid magenta !important;
        outline-offset: -3px !important;
      }
    `;
    document.head.appendChild(style);
  },
});
