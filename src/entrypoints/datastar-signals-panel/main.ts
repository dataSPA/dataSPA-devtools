import { mount } from "svelte";
import App from "./App.svelte";
import "./app.css";

import { signalMessages } from "$lib/stores";

const app = mount(App, {
  target: document.getElementById("app")!,
});

const port = browser.runtime.connect({ name: "dataSPAdevtools" });

port.onMessage.addListener((message: any) => {
  console.log("Signal panel received message:", message);
  signalMessages.update((m) => [...m, message]);
});

export default app;
