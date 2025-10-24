import { mount } from "svelte";
import App from "./App.svelte";
import "./app.css";
import { sseMessages } from "$lib/stores";

const app = mount(App, {
  target: document.getElementById("app")!,
});

const port = browser.runtime.connect({ name: "dataSPAdevtools" });

port.onMessage.addListener((message: any) => {
  if (!message.data) return;
  const data = JSON.parse(message.data);
  if (data.type !== "datastar-fetch") return;
  const dataData = { ...JSON.parse(data.data), el: data.el };
  sseMessages.update((m) => [...m, dataData]);
});

port.postMessage({
  tabId: browser.devtools.inspectedWindow.tabId,
  action: "getPageInfo",
});

export { app, port };
