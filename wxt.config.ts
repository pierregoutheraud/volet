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
    // sidePanel.open and setPanelBehavior (116); the switcher's page script in frames with no address of their own
    // (`matchOriginAsFallback`, 119). Newer side panel events are feature-detected (engine/side-panel.ts).
    minimum_chrome_version: '119',
    // activeTab + scripting: Search over the current page, after its shortcut even without site access (activeTab);
    // from the panel's button, with site access (a click in the panel grants no activeTab).
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
    // The recent tab switcher (on while one of its shortcuts is assigned) listens on websites for the shortcut's modifier
    // being let go, and captures local page previews as tabs are used. Search opened from the panel shows over the page.
    host_permissions: ['<all_urls>'],
    // The in-page palette shows favicons from Chrome's cache, served from the extension's origin.
    web_accessible_resources: [{ resources: ['_favicon/*'], matches: ['<all_urls>'] }],
    // An action is required so clicking the toolbar icon can open the side panel.
    action: { default_title: 'Open Volet' },
    // Chrome refuses to load an extension suggesting more than four shortcuts: the others start unassigned.
    commands: {
      // Control on every platform. A manifest's Ctrl means Command on a Mac (Cmd+Q quits, Cmd+M minimizes), hence
      // MacCtrl there. Chrome never assigns a suggested key that is one of its own shortcuts (Ctrl+F, Ctrl+S...).
      'toggle-sidebar': { suggested_key: { default: 'Ctrl+B', mac: 'MacCtrl+B' }, description: 'Show or hide the sidebar' },
      'open-palette': { suggested_key: { default: 'Ctrl+M', mac: 'MacCtrl+M' }, description: 'Search tabs, pins and archived tabs' },
      // Like Cmd+Tab and Cmd+Shift+Tab. Chrome's shortcuts page lists commands by id, so cycling comes first, as in settings.
      // Punctuation keys are named in manifests (Comma, not ,): Chrome refuses to load the extension otherwise.
      'cycle-recent-tabs': { suggested_key: { default: 'Ctrl+Q', mac: 'MacCtrl+Q' }, description: 'Cycle through recent tabs' },
      'cycle-recent-tabs-reverse': {
        suggested_key: { default: 'Ctrl+Shift+Q', mac: 'MacCtrl+Shift+Q' }, description: 'Cycle through recent tabs in reverse',
      },
      'next-space': { description: 'Switch to the next Volet' },
      'previous-space': { description: 'Switch to the previous Volet' },
      'toggle-pin': { description: 'Pin or unpin the current tab' },
      'copy-url': { description: "Copy the current tab's link" },
    },
  },
});
