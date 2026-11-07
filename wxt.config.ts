import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'wxt';

// See https://wxt.dev/api/reference/wxt/interfaces/inlineconfig.html
export default defineConfig({
  srcDir: 'src',
  // Builds go to a visible folder, easy to pick in Chrome's "Load unpacked" dialog (WXT's default is `.output`).
  outDir: 'output',
  modules: ['@wxt-dev/module-svelte'],
  // A fixed port: the dev build loaded in Chrome hard-codes it, so it must not change between runs.
  dev: { server: { port: 3311, strictPort: true } },
  // `pnpm dev` opens a fresh Chrome profile with the extension loaded.
  // `pnpm dev:own` skips that: load output/chrome-mv3-dev once in your own profile instead.
  webExt: { disabled: process.env.OWN_PROFILE === '1' },
  vite: () => ({
    plugins: [tailwindcss()],
  }),
  manifest: {
    name: 'Volet',
    // Also the Chrome Web Store summary: 132 characters at most.
    description:
      "Vertical tabs in Chrome's side panel: switch between workspaces (Volets), each with its own pinned tabs, folders and colors.",
    // The source code (GPL-3.0), linked from the store listing and chrome://extensions.
    homepage_url: 'https://github.com/pierregoutheraud/volet',
    // sidePanel.open and setPanelBehavior. Newer side panel events are feature-detected (engine/side-panel.ts).
    minimum_chrome_version: '116',
    // activeTab + scripting: the palette shortcut may show the palette on the current page only.
    permissions: [
      'sidePanel',
      'tabs',
      'tabGroups',
      'bookmarks',
      'storage',
      'alarms',
      'favicon',
      'search',
      'activeTab',
      'scripting',
    ],
    // Opt-in tab switcher: preload release listeners and capture local page previews as tabs are used.
    optional_host_permissions: ['<all_urls>'],
    // The in-page palette shows favicons from Chrome's cache, served from the extension's origin.
    web_accessible_resources: [{ resources: ['_favicon/*'], matches: ['<all_urls>'] }],
    // An action is required so clicking the toolbar icon can open the side panel.
    action: { default_title: 'Open Volet' },
    commands: {
      'toggle-sidebar': { suggested_key: { default: 'Alt+S' }, description: 'Show or hide the sidebar' },
      'open-palette': { suggested_key: { default: 'Alt+T' }, description: 'Search tabs, pins and archived tabs' },
      'cycle-recent-tabs': {
        description: 'Cycle through recent tabs forward',
      },
      'cycle-recent-tabs-previous': { description: 'Cycle through recent tabs backward' },
      'next-space': { description: 'Switch to the next Volet' },
      'previous-space': { description: 'Switch to the previous Volet' },
      'toggle-pin': { suggested_key: { default: 'Alt+P' }, description: 'Pin or unpin the current tab' },
    },
  },
});
