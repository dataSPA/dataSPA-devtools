import "./app.css";
import {
  DATASPA_DEVTOOLS_SIGNALS,
  GET_SIGNAL_ROOT,
  PORT_INIT,
} from "~/utils/constants";
import { attachPanelMessageListener } from "~/utils/panel-adapter";

// Dynamically inject datastar-csp.js as a module script at runtime so that
// Vite never intercepts the src path, and it loads correctly as an ES module
// (export statements require type="module"; a classic script would syntax-error).
const port = browser.runtime.connect({ name: DATASPA_DEVTOOLS_SIGNALS });

port.postMessage({
  action: PORT_INIT,
  tabId: browser.devtools.inspectedWindow.tabId,
});

port.postMessage({
  action: GET_SIGNAL_ROOT,
  tabId: browser.devtools.inspectedWindow.tabId,
});

attachPanelMessageListener(port);
