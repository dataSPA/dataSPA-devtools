import "./app.css";
import { DATASPA_DEVTOOLS_SSE, PORT_INIT, SHOW_EVENT } from "~/utils/constants";
import { attachPanelMessageListener } from "~/utils/panel-adapter";
import "@awesome.me/webawesome/dist/styles/webawesome.css";
import "@awesome.me/webawesome/dist/components/button/button.js";
import "@awesome.me/webawesome/dist/components/input/input.js";
import "@awesome.me/webawesome/dist/components/split-panel/split-panel.js";
import { registerHelper } from "~/assets/datastar-csp.js";

const tabId = browser.devtools.inspectedWindow.tabId;
const port = browser.runtime.connect({ name: DATASPA_DEVTOOLS_SSE });

port.postMessage({
  action: PORT_INIT,
  tabId,
});

attachPanelMessageListener(port);

registerHelper("showEvent", (evt: MouseEvent | TouchEvent) => {
  const id = (evt.target as HTMLElement)?.closest("tr")?.dataset.eventId;
  port.postMessage({ action: SHOW_EVENT, tabId, data: id });
});

registerHelper("hideEvent", () => {
  port.postMessage({ action: HIDE_EVENT, tabId });
});
registerHelper("highlightSelectors", () => {
  port.postMessage({ action: HIGHLIGHT_SELECTORS, tabId });
});
