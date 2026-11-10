# Volet

Arc-like vertical tab Spaces for Chrome, as a side panel extension. A *volet* is a window shutter in French, and the word French software uses for a side panel.
A rewrite inspired by [Arcify](https://github.com/nisargkolhe/arcify) (GPL-3.0), built with
[WXT](https://wxt.dev), Svelte 5, TypeScript, Tailwind v4, Bits UI and dnd-kit.

## What it does

- **Spaces.** Each Space has its own pinned and temporary tabs, and tints the whole sidebar in its color.
  Switch with the shutters at the bottom, a two-finger swipe (the color follows your fingers), the palette, or a shortcut.
  Each window shows its own Space. In Chrome's tab strip, every Space is a tab group, and the inactive ones are collapsed.
- **Pinned tabs and folders.** Pins keep their home page: navigate away and the row shows where you are, with a button back.
  On hover, × closes the tab (the pin stays, dimmed) and the pin-off button unpins it in one click (it becomes a
  regular tab below the divider). Folders nest; a collapsed folder still shows its open tabs (Settings can hide them too).
- **Temporary tabs** sit below the divider. "Clear" closes them all. Unused ones are archived after 12 hours (configurable)
  and can be found again in search.
- **Favorites.** The grid at the top, shared by all Spaces. Open favorites are Chrome's own pinned tabs, so anything you pin
  in Chrome becomes a favorite.
- **Drag and drop** everything: reorder tabs, drag across the divider to pin or unpin, into folders, up to the favorites,
  or onto another Space's shutter (hold it there to switch to that Space and drop it at an exact spot). Nothing moves until
  you let go: a line shows where the tab will land, and a folder lights up when it will go inside (hold it over the
  folder's middle; its top and bottom edges place it before or after). Drag the shutters themselves to reorder your Spaces.
- **Select several rows** like in Chrome's tab strip: <kbd>Shift</kbd>+click selects a range, <kbd>⌘</kbd>/<kbd>Ctrl</kbd>+click
  adds or removes one, <kbd>Esc</kbd> clears. Drag them together (they move as a stack), or right-click to put them in a new
  folder (a selected folder nests inside it), move them to another Space, or close them. A click anywhere else clears it.
- **Right-click menus** on every tab, pin, folder, favorite and Space: rename (or double-click a pin or folder, click a
  Space's name), move to another Space, put a tab in a new folder, add a new folder at the top of the Space (from a
  pin, folder or the Space) or inside a folder, Space colors, reorder and delete Spaces, and more.
- **Search palette.** Press <kbd>Ctrl</kbd>+<kbd>M</kbd> on any page for an Arc-style palette over it: open tabs (all windows),
  pins, favorites, archived tabs, Spaces, actions, a web address, or a web search. From the sidebar (the search button,
  <kbd>⌘K</kbd>/<kbd>Ctrl+K</kbd>, <kbd>/</kbd>, or <kbd>Ctrl</kbd>+<kbd>M</kbd> while it has focus), the same palette
  opens over the page, and you type into it from the sidebar.
- **Import from Arc.** Settings → Import from Arc reads Arc's `StorableSidebar.json` and brings over your Spaces, their
  colors, pinned tabs, folders and favorites. The file never leaves your computer.
- **Recent tab switcher.** Hold <kbd>Ctrl</kbd> and press <kbd>Q</kbd> to cycle through your five most recent tabs
  across Spaces in this window, like Cmd+Tab: a quick tap goes back to the tab you last used, and each further press
  goes one tab further back; let go to switch. Add <kbd>Shift</kbd> to cycle in reverse, like Cmd+Shift+Tab: it starts
  from the far right (the oldest of the five) and moves left. Newly opened background tabs take priority, so opening a
  link with Cmd/Ctrl+click makes it the next selection. A centered preview highlights the selection, the arrow keys
  move it and Escape cancels. Record a close shortcut in Settings → Keyboard shortcuts to close the highlighted tab
  without switching to it, or hover a preview and use its close button (Chrome reserves Cmd+W). Remove both shortcuts
  to turn the switcher off. Screenshots appear after you visit tabs and stay in memory on your device.

Spaces, pins, folders and favorites live in your bookmarks (an "Other bookmarks → Volet" folder), so they sync across
your computers with Chrome sync and survive reinstalling. Space colors and settings sync through Chrome too. Nothing is
sent anywhere else: see the [privacy policy](PRIVACY.md).

### Keyboard shortcuts

| Action | Default |
| --- | --- |
| Show or hide the sidebar | <kbd>Ctrl</kbd>+<kbd>B</kbd> |
| Search tabs, pins and archived tabs | <kbd>Ctrl</kbd>+<kbd>M</kbd> |
| Cycle through recent tabs | <kbd>Ctrl</kbd>+<kbd>Q</kbd> |
| Cycle through recent tabs in reverse | <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Q</kbd> |
| Close highlighted preview tab | not set, record in Volet settings |
| Next / previous Space | not set |
| Pin or unpin the current tab | not set |
| Copy the current tab's link | not set (<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>C</kbd> works well on a Mac) |

Ctrl is the Control key on a Mac too, not Cmd. Change native shortcuts in `chrome://extensions/shortcuts` (Settings
has a link). Chrome lets an extension suggest at most four, so the others start unassigned. Record and clear the preview-only close
shortcut in Volet settings, including the modifier you hold while cycling. This device-local shortcut works only while
the preview is open.

### Limits of a Chrome extension

- Chrome's own tab strip stays at the top. Spaces keep it tidy by collapsing other Spaces' groups; Chrome's built-in
  vertical tabs can replace it if you prefer.
- The side panel's width and side are set by Chrome.
- The palette can't appear on Chrome's own pages (`chrome://`, the new tab page, the Web Store); there it opens in the
  sidebar instead. So it does from the sidebar's search button when Volet's website access is withheld.
- Copying the current tab's link does nothing on Chrome's own pages or with the keyboard in the address bar (Volet
  writes the clipboard from the page or the sidebar, whichever has the keyboard, and asks for no clipboard permission).
- The recent tab switcher cannot overlay Chrome pages or the Web Store: its shortcut switches directly to the previous
  tab there. Holding the modifier to choose needs focus in a website (any of its frames) or the Volet panel: with focus
  in the address bar or elsewhere in Chrome's own interface, a press switches straight to the previous tab.
- Arc's Split View, Peek and Little Arc aren't possible.

## Install

From the Chrome Web Store (coming soon), or build it yourself:

```bash
pnpm install
pnpm build
```

Then open `chrome://extensions`, enable Developer mode, click "Load unpacked" and pick `output/chrome-mv3`.

## Development

```bash
pnpm proto      # sidebar UI as a plain web page on fake data (fast visual iteration)
pnpm dev        # dev mode: opens a fresh Chrome profile with the extension, live reload
pnpm dev:own    # same dev server, no browser: load output/chrome-mv3-dev in your own profile
pnpm check      # svelte-check + TypeScript
pnpm check:extension  # builds, checks runtime diagnostics and reloads in isolated Chromium
pnpm test       # unit tests (Vitest)
pnpm test:e2e   # builds, then drives real Chromium with the extension loaded (Playwright)
pnpm zip        # production build zipped for the Chrome Web Store (output/volet-<version>-chrome.zip)
pnpm store:images  # renders the store screenshots and promo tiles into store/images
```

Releasing to the Chrome Web Store: the listing copy, permission justifications and the update checklist are in
[store/listing.md](store/listing.md).

### Developing in your own Chrome profile

1. `pnpm dev:own`
2. In `chrome://extensions` (Developer mode on), "Load unpacked" → `output/chrome-mv3-dev` (once).
3. Keep `pnpm dev:own` running: the side panel updates as you edit; background and palette changes reload the
   extension (or press <kbd>Alt</kbd>+<kbd>R</kbd>). Without the dev server, the dev build's pages stay blank.

Don't enable the dev build and a production build in the same profile at the same time: both would manage your tabs.

Architecture, coding guidelines and the Svelte MCP setup are in [AGENTS.md](AGENTS.md).

### Checking extension errors

Run `pnpm check:extension` before sharing an extension build. It builds the end-to-end variant (the production build
with open shadow roots, in `output/chrome-mv3-e2e`), opens it in a disposable Chromium profile, exercises the
settings, import, sidebar and tab preview, and reloads the extension twice with website tabs left open. It checks
console warnings/errors, uncaught page errors, and Chrome's own extension runtime and manifest error records. Findings
fail the command and are saved to `test-results/extension-check/report.json`. The check uses local test pages and a
temporary copy of the build: your profile and build stay unchanged. It checks the exercised flows, rather than
guaranteeing that every possible browser interaction is error-free.

To inspect a different built extension without rebuilding, use `node scripts/check-extension.mjs --extension /path/to/build`.

Shadow roots Volet adds to web pages (Search, the tab switcher) are closed, so pages can't read your tabs in them. The
end-to-end tests and `pnpm check:extension` build with `--mode e2e`, which opens them for Playwright: never ship that
build (`pnpm zip` builds its own).

## License

GPL-3.0-or-later. See [LICENSE](LICENSE).
