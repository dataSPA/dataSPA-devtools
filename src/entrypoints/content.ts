import { storage } from "#imports";

export default defineContentScript({
  matches: ["*://*/"],
  async main(ctx) {
    let elm = document.createElement("div");
    elm.setAttribute("id", "dsDevtoolsContent");
    elm.setAttribute("style", "display: none;");
    elm.setAttribute("data-json-signals", "");
    elm.setAttribute("data-signals-devtools.nested", "'test'");
    elm.setAttribute(
      "data-on-signal-patch",
      `document.dispatchEvent(
        new CustomEvent("dsDevtools:signals", {
          detail: dsDevtoolsContent.textContent,
        }));`,
    );
    elm.setAttribute(
      "data-on-datastar-fetch",
      `let uuid = window.getCachedElement(evt.detail.el);
      if (!uuid) {
        uuid = crypto.randomUUID();
        window.__domCache.set(uuid, evt.detail.el);
      }
      console.log('fetch details', evt.detail);
      console.log(uuid);
      document.dispatchEvent(
        new CustomEvent("dsDevtools:sseEvent", {
        detail: {
        type: evt.detail.type,
        el: uuid,
        argsRaw: evt.detail.argsRaw,
        }}));
      `,
    );

    document.body.appendChild(elm);
    await injectScript("/injected.js", { keepInDom: true });
    let signals = storage.defineItem("session:signals", { fallback: {} });

    ctx.addEventListener(document, "dsDevtools:signals", async ({ detail }) => {
      await signals.setValue(detail);
    });

    let sseEvents = storage.defineItem<Array<Object>>("session:sseEvents", {
      fallback: [],
    });
    document.addEventListener("dsDevtools:sseEventFlush", async (evt) => {
      console.log("flushing events", evt.detail);
      await sseEvents.setValue(evt.detail);
    });
  },
});
