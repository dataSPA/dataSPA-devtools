import "./app.css";
import {
  DATASPA_DEVTOOLS_SIGNALS,
  GET_SIGNAL_ROOT,
  EDIT_SIGNAL,
  SAVE_SIGNAL,
  PORT_INIT,
} from "~/utils/constants";
import { registerHelper } from "~/assets/datastar-csp.js";
import { attachPanelMessageListener } from "~/utils/panel-adapter";

const tabId = browser.devtools.inspectedWindow.tabId;
const port = browser.runtime.connect({ name: DATASPA_DEVTOOLS_SIGNALS });

port.postMessage({
  action: PORT_INIT,
  tabId,
});

port.postMessage({
  action: GET_SIGNAL_ROOT,
  tabId,
});

attachPanelMessageListener(port);

registerHelper("editSignal", (signalPath: string) => {
  port.postMessage({
    action: EDIT_SIGNAL,
    tabId,
    data: signalPath,
  });
});

registerHelper("saveSignal", (path: string, value: any) => {
  port.postMessage({
    action: SAVE_SIGNAL,
    tabId,
    data: { [path]: value },
  });
});
