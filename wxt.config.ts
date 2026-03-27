import { defineConfig } from 'wxt'

// See https://wxt.dev/api/config.html
export default defineConfig({
  webExt: {
    startUrls: ['https://data-star.dev/'],
  },
  manifest: {
    web_accessible_resources: [
      {
        matches: ['*://*/*'],
        resources: ['injected.js'],
      },
    ],
    content_security_policy: {
      // extension_pages: "script-src 'self' 'unsafe-eval'; object-src 'self'",
    },
    permissions: ['storage', 'offscreen', 'clipboardWrite'],
  },
  vite: () => ({
    resolve: {
      alias: {},
    },
  }),
})
