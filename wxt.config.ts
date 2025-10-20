import { defineConfig } from "wxt";
import tailwindcss from "@tailwindcss/vite";
import path from "path";

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
  vite: () => ({
    plugins: [tailwindcss() as any],
    resolve: {
      alias: {
        $lib: path.resolve("./src/lib"),
      },
    },
  }),
});
