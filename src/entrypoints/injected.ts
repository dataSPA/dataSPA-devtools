export default defineUnlistedScript(() => {
  window.__domCache = new Map<string, Element>();
  window.__eventsBuffer = [];
  window.__eventsBufferFlusherTimer = null;

  window.__flushEventsBuffer = () => {
    document.dispatchEvent(
      new CustomEvent("dsDevtools:sseEventFlush", {
        detail: window.__eventsBuffer,
      }),
    );
  };

  window.getCachedElement = function (el: Element): string | undefined {
    let result = [...window.__domCache].find(([key, value]) => value === el);
    if (result) {
      return result[0];
    }
    return undefined;
  };

  window.addEventListener("beforeunload", () => {
    window.__eventsBuffer = [];
    window.__flushEventsBuffer();
  });

  document.addEventListener("dsDevtools:sseEvent", async (evt) => {
    console.log("putting an event in the buffer");
    window.__eventsBuffer.push(evt.detail);
    if (window.__eventsBufferFlusherTimer) {
      clearTimeout(window.__eventsBufferFlusherTimer);
    }
    window.__eventsBufferFlusherTimer = setTimeout(
      window.__flushEventsBuffer,
      200,
    );
  });
});
