import { defineConfig } from "wxt";

// See https://wxt.dev/api/config.html
export default defineConfig({
  srcDir: "src",
  modules: ["@wxt-dev/module-svelte"],
  webExt: {
    startUrls: ["https://data-star.dev/"],
  },
  manifest: {
    web_accessible_resources: [
      {
        matches: ["*://*/*"],
        resources: ["injected.js"],
      },
    ],
    permissions: ["storage"],
  },
});
