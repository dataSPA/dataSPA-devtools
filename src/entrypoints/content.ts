import { storage } from "#imports";
import { PublicPath } from "wxt/browser";

export default defineContentScript({
  matches: ["*://*/*"],
  async main(ctx) {
    browser.runtime.onMessage.addListener((msg, sender, sendResponse) => {
      console.log("Got a message from the devtools", msg);
      switch (msg.action) {
        case "highlightSelectors":
        for (const selector of msg.data) {
          for (const el of  document.querySelectorAll(selector)) {
            el.classList.add("dataSPADevtoolsHighlightStyle");
          }
        }
        break;
        case "removeHighlights":
        var els = document.querySelectorAll('.dataSPADevtoolsHighlightStyle');
        if (!els) return "Element not found";
        for (const el of els) {
          el.classList.remove("dataSPADevtoolsHighlightStyle");
        }
        break;
        case "getPageInfo":
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
