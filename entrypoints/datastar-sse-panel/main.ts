import "./app.css";
import { DATASPA_DEVTOOLS, PORT_INIT } from "~/utils/constants";
import { attachPanelMessageListener } from "~/utils/panel-adapter";
import { PublicPath } from "wxt/browser";

// import dsUrl from "/datastar-csp.js?url";

// Dynamically inject datastar-csp.js as a module script at runtime so that
// Vite never intercepts the src path, and it loads correctly as an ES module
// (export statements require type="module"; a classic script would syntax-error).
// await new Promise<void>((resolve, reject) => {
//   const script = document.createElement("script");
//   script.type = "module";
//   console.log(dsUrl);
//   console.log(browser.runtime.getURL(dsUrl as PublicPath));
//   script.src = browser.runtime.getURL(dsUrl as PublicPath);
//   script.onload = () => resolve();
//   script.onerror = (e) =>
//     reject(new Error(`Failed to load datastar-csp.js: ${e}`));
//   document.head.appendChild(script);
// });

const port = browser.runtime.connect({ name: DATASPA_DEVTOOLS });

port.postMessage({
  action: PORT_INIT,
  tabId: browser.devtools.inspectedWindow.tabId,
});

attachPanelMessageListener(port);
