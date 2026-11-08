# AGENTS.md

Volet: Arc-like vertical tab Spaces for Chrome, a side panel extension built with WXT, Svelte 5, TypeScript and Tailwind v4.

## Commands

```bash
pnpm proto          # sidebar UI as a plain web page on fake data (fast visual iteration); /recent-tabs.html: the tab switcher
pnpm dev            # extension dev mode: launches a fresh Chrome profile, live reload
pnpm dev:own        # same, without launching Chrome (load output/chrome-mv3-dev in your own profile)
pnpm build          # production build in output/chrome-mv3
pnpm check          # svelte-check + TypeScript
pnpm check:extension # runtime diagnostics and extension reload smoke check (on the e2e build)
pnpm test           # unit tests (Vitest)
pnpm test:e2e       # builds with --mode e2e (output/chrome-mv3-e2e), then drives real Chromium with it (Playwright)
pnpm zip            # production build zipped for the Chrome Web Store
pnpm store:images   # store screenshots and promo tiles (proto/store.html, rendered by store/capture.mjs)
```

Store listing copy, permission justifications and the release checklist: `store/listing.md`. Keep its permission
list in step with the manifest, and `PRIVACY.md` in step with what Volet reads and stores.

## Svelte MCP

Before Svelte work, read the official project-local skills in `.agents/skills/`:

- `svelte-code-writer/SKILL.md`: documentation lookup and autofixer workflow.
- `svelte-core-bestpractices/SKILL.md`: modern Svelte reactivity and component guidance, with references.

The Svelte MCP server is configured for this project in `.mcp.json` (remote, `https://mcp.svelte.dev/mcp`).
In Claude Code it is equivalent to `claude mcp add -t http -s project svelte https://mcp.svelte.dev/mcp`.
Approve it when Claude Code asks on first launch in this repo.

Use it whenever you write or change Svelte code:

1. **list-sections**: call it first on any Svelte or SvelteKit question to find the relevant documentation sections.
2. **get-documentation**: fetch every section relevant to the task before writing code that depends on it. Prefer it over memory: Svelte 5 APIs change.
3. **svelte-autofixer**: run it on every `.svelte` and `.svelte.ts` file you create or edit, and keep fixing and re-running until it reports no issues or suggestions. Pass the Svelte version from `package.json`.
4. **playground-link**: only when the user asks for a playground, and never for code that lives in this repo.

## Architecture

Three layers, each with a single job. Dependencies point downward only.

| Layer | Where | Job |
| --- | --- | --- |
| UI: primitives | `src/lib/ui/primitives/` | Presentational components (`TabRow`, `FolderRow`, `FavoriteTile`, `SpaceDot`, `Pager`...). Props in, callbacks and snippets out. Know nothing about the store. |
| UI: containers | `src/lib/ui/sidebar/` | Thin components that read `SidebarStore` (via `getSidebar()`) and wire primitives to its actions, plus UI state modules (`space-swipe`, `space-tint`). |
| Model | `src/lib/model/` | Domain types (`SidebarStore` contract), context, and small pure helpers (`hue`, `url`, `pinned`). |
| State | `src/lib/state/` | `SidebarStore` implementations: `chrome/` (reads Chrome, sends commands, optimistic updates) and `fake/` (prototype data). Pure update helpers in `tree.ts`, shared by both stores (the Chrome store's optimistic updates are the fake store's whole implementation). |
| Business logic | `src/lib/engine/` | Pure derivation (`derive.ts`, `snapshot.ts`, `schema.ts`, `colors.ts`) and the service worker engine: `engine.ts` (queue), `commands/` (one file per area), `reconcile.ts`, `groups.ts`, `tab-ops.ts`, `session.ts`. The only code that writes to Chrome. |

- **Reads are local, writes are central.** Each side panel derives its state from Chrome's events. Every change is a `Command` (see `engine/commands.ts`) sent to the service worker, which runs commands one at a time through a serial queue and retries calls Chrome rejects while the user drags a tab.
- **A refresh does as little as it can**: the panel reloads its snapshot only for changes it shows. A tab's title,
  icon, loading state, URL or sound patches that tab alone (`isLiveChange`, `TabOverlay.patch`), storage changes
  count only for the items `loadSnapshot` reads (`changesSnapshot`), and each command waits for one reload
  (`RefreshGate.settled`). A reload keeps every object that didn't change (`state/reuse.ts`), so rows showing
  them do nothing.
- **Lookups go through cached indexes**: `tree.ts` (pins, folders, a tab's Space) indexes each `spaces` array, and
  `snapshot.ts` (`findBookmark`, `spaceOfBookmark`) each bookmark tree, the first time they're asked. So never
  change a `spaces` array, a pin or folder, or a bookmark tree in place: make a new one (every helper already does).
- **Bookmarks are the source of truth**: the `Volet` folder holds `Favorites` and one folder per Space; pins are bookmarks. Session-only links (tab to pin, group to Space, active Space per window) live in `chrome.storage.session` and are rebuilt after restarts.
  Restarting Chrome and installing, updating or reloading the extension all clear them, so tabs find their pin or
  favorite again by URL (`ownerOf`): the bookmark's own page, else the page its tab was last on (`lastPagesItem`,
  local, recorded as bound tabs navigate). Without that, a favorite's tab that had moved on would come back as a new
  favorite, and a pin's as a temporary tab.
- **Switching to a Space with no open tab opens none**: the page in front stays (it's parked, `parkedTabsItem`), and
  the sidebar doesn't follow it back to its own Space; picking any other tab ends that. A new Volet is no different: it
  opens no tab. Never collapse the group holding the active tab (`collapseOtherSpaces` skips it): Chrome would pick, or
  open, another tab.
- **Pin titles follow the page, until renamed**: when a pin's or favorite's tab finishes loading the bookmark's own
  URL, the engine gives the bookmark the page's title (`engine/titles.ts`), but only while its title is still the one
  Volet gave it from its page (`autoTitlesItem`, per bookmark id: pinning a tab, an import, an earlier refresh). Once
  anyone renames it (in Volet, in Chrome's bookmarks, a custom name from Arc), it never changes again; a title Volet
  didn't give counts as the user's too. When code creates a pin or favorite titled after its page, call
  `rememberAutoTitles`. Its row never changes it either: when a pin's tab moves to another page, a pin titled after
  its page shows that page's title after a "/", but a pin someone named keeps its name (`Pin.named`, derived from
  `autoTitlesItem`); both offer the way back.
- **Arc import**: `import/arc.ts` parses Arc's `StorableSidebar.json` (pure). The import page reads it with a plain
  file input (Chrome's File System Access picker refuses anything under `~/Library`, where Arc keeps it, so no lasting
  file handle either) and remembers what's in it (`arcSidebarItem`), to review again without the file; the engine
  records which Arc Spaces came in (`importedArcSpacesItem`). The side panel gets an `ArcClient` (`model/arc.ts`, passed to `Sidebar` like the
  palette client): while Arc Spaces are left, the New Volet button opens a menu offering them, and after install a
  "Coming from Arc?" card (`ArcInvite`, `arcInviteItem`) opens the import until it's dismissed or used.
- **Pure logic is kept pure** (`derive.ts`, `snapshot.ts`, `colors.ts`, importers, search ranking) so it can be unit tested without Chrome.
- **Entry points** (`src/entrypoints/`): `background.ts` (the engine), `sidepanel/` (the sidebar), `palette.ts`
  (unlisted script injected into the current page by the palette shortcut, rendered in a shadow root; with the panel
  focused, the shortcut opens the panel's own palette instead, as the page would get none of its keys:
  `panelHasFocus`, answered by `state/chrome/panel-focus.ts`), `options/` (settings) and `import/` (Arc import).
- **Drag and drop** (`ui/sidebar/drag/`): nothing moves while dragging. `DragState.drop` is where the rows would
  land, shown as a line in the gap next to a row (`DropLine`, drawn by `SortableEntry`), a lit-up folder row (its
  middle drops into it) or a lit-up empty list (`DropZone`; the unpinned tabs have no empty hint to light up, so
  they show a line at their top instead, `empty="line"`). Hit testing is by pointer only (`pointerIntersection`),
  and a row's drop target is its row button (`attachTarget`), so a folder's contents don't count as the folder;
  between rows, `drop-geometry.ts` picks the closest row from the DOM (`data-entry`, `data-list`). The slot rules
  (`zoneAt`, `slotAt`, `resolveDrop`) and the drop-to-action mapping (`groupDrop`) are pure (`model/dnd.ts`). On
  drop, the draft shows the result at once, its rows hidden, and `land` (`group-motion.ts`) flies a copy of the
  preview from where it was let go onto the row's new place (measured every frame, as lists around it may still
  move), where the row fades in under it; the other rows slide to make room. The store may already have changed a
  dropped entry (a pin turned into a tab): the draft's rows look entries up through `DragState.find`, which falls
  back to the content as it was when let go (`kept`), so they never render empty mid-flight. dnd-kit shows no
  feedback (`feedback: 'none'`, its DOM-moving sorting is off too, and so is its slide of rows whose index changed,
  `transition: null`, which would move a dropped row under the copy flying onto it): `DragPreview` is a full-size copy of the row
  (rows mark their root `data-row`; the copy sets `data-hovered` to keep the hover look), held where the pointer took
  it and slightly see-through, like Arc, so the drop line or folder under it shows. DragLayer hands its shape to
  dnd-kit each frame (dnd-kit only re-checks collisions when the dragged shape changes, and reports moves before
  updating the pointer). Row buttons are the drag handles; give action buttons and inputs `data-no-drag`. Holding
  a dragged row over a Space dot switches to that Space after a short dwell (`drag-state.svelte.ts`), so it can be
  dropped there.
  The dots are sortable too (`SortableSpaceDot`, type `SPACE_DOT`, reordered by `space-order.svelte.ts`); rows and
  lists refuse them with `accept: notSpaceDot`, so give any new droppable that filter.
- **Folders start collapsed**: Volet remembers which folders are open (`openFoldersItem`, `SidebarStore.openFolders`),
  so any folder it didn't make starts collapsed: an import, folders made in Chrome's bookmarks or arriving through
  sync, and every folder after a reinstall (removing the extension clears its storage, the bookmarks stay). Folders
  made in Volet start open (the `createFolder` and `createFolderWith` commands record them so).
- **Folders**: a collapsed folder keeps rendering its list as `folded` (`PinnedList`): rows without an open tab
  slide away and the open ones stay in place (`hasOpenTab` in `model/pinned.ts`). Those slides are local
  transitions on purpose, so rows added or removed for other reasons (drags, optimistic ids) just appear.
- **Volet switcher**: there's no limit on Volets; every tab group in Chrome is one, so a first run starts with the
  user's groups. Each one is a shutter (`SpaceDot`, a volet; the code still calls them dots): closed, a small panel in
  its color with its initial (`spaceInitial`); the active one opens into a pill with its name, its width animating
  (`interpolate-size`). While a row is dragged, the shutter open at its start stays open (`DragState.startSpaceId`):
  hovering another one switches Space, and opening it then would move the shutters under the pointer. Closed shutters narrow from 26px slots to 20px to fit next to the open one,
  centered between the tools (Search, then Settings, in the corner) and New Volet (`SpaceSwitcher`), then the row scrolls (`primitives/scroll-strip.ts`): no scrollbar, a fade on each edge
  that hides shutters, the wheel scrolls it, and the open shutter is kept in view (again once it has opened). Wheel
  events the row uses stop there, so they don't also swipe Spaces.
- **Menus are data** (`model/menu.ts`), built by plain functions in `ui/sidebar/menus/` and rendered by the generic
  `primitives/menu/ContextMenu.svelte` (right-click) or `DropdownMenu.svelte` (from a button, like New Volet); a
  `group` item puts items under a small heading in the menu itself. A `swatches` item with `onPreview` adds a slider
  for any hue (`HueSlider`, a Volet's color): the panel and the Volet's shutter follow it through `HuePreview`
  (`ui/sidebar/hue-preview.svelte.ts`, purely visual), and it's saved with one command once it settles (let go, a
  pause after a key, or left). Overlays portal into `[data-overlay-root]` inside `.sidebar` to keep the tint (the
  pages' `PageShell` has one too). The pages' choices use `primitives/page/Select.svelte` (Bits UI's Select), listed on
  the menus' surface and rows (`styles/menu-surface.css`, `MENU_ITEM_CLASS`), never a native `<select>`.
  Every menu is placed by `primitives/menu/placement.ts` (`MENU_PLACEMENT`): menus open below the pointer so they can
  slide sideways and flip up to stay inside the panel, and scroll when taller than it. Submenus expand in place under
  their item (`SubMenu.svelte`) instead of flying out: there's no room beside a menu in a side panel, and one laid
  over it would hide its other items.
  A right-click doesn't give the side panel focus (macOS), and nothing can, so menus must work in an unfocused
  panel (`primitives/menu/dismiss.ts`): they close on blur or, without focus, when the pointer leaves the panel,
  and their items also highlight on hover while `<html data-unfocused>` is set (Bits UI highlights through focus
  events, which an unfocused panel never gets). Give new menu item styles the same hover rule. While a menu is open,
  the row it opened on keeps its hover look: `ContextMenu` sets `data-hovered` on its trigger's first element, which
  rows style like hover (give new rows the same rule). Closing a menu sends focus back where it was,
  except when an item just focused a text field (an inline rename): that field keeps it (`keepFieldFocus`).
- **Active row in view**: the active tab's row scrolls its page to show itself when it becomes active or appears
  (a new tab at the end of a long list), gliding (`primitives/reveal-row.ts`, attached by `TabRow`). It scrolls only
  the page: `scrollIntoView` would also move the overflow-hidden strip the pages slide in.
- **Big lists stay smooth**: rows are costly to mount (a sortable, a menu, tooltips), so a folder opening on a hundred
  pins would freeze the panel. Pinned rows mount through the sidebar's `MountQueue` (`primitives/mount-queue.ts`,
  `Deferred`): up to 16 per frame, the rest a frame later each, top to bottom, behind a same-height placeholder (the
  first render has no limit). Menus and tooltips mount their content (portal, floating layer) the first time they
  open, then keep it: keep new ones lazy the same way.
- **Tooltips**: wrap a trigger in `primitives/tooltip/Tooltip.svelte` instead of a native `title` (`IconButton` does it
  for you). They show right away, close as soon as the pointer leaves the trigger, and fade in and out
  (`.tooltip-surface` in `app.css`); one `Tooltip.Provider` sits in `Sidebar.svelte`. Wrap neighboring triggers in a
  `TooltipGroup` (the Space dots, a row's buttons) and they share one tooltip that glides between them; keep those
  triggers touching (no gap, inner icons `pointer-events-none`) or the tooltip closes in between.
- **Selection**: `ui/sidebar/selection/selection.svelte.ts` holds the selected rows of the active Space (Shift and
  Cmd/Ctrl+click, Chrome's tab strip model). Rows ask it first on click (`selection.click`), menus switch to the
  selection's menu through `rowMenu`, and a drag that starts on a selected row carries the whole selection
  (`DragState.group`, landed in order by the pure `groupDrop`). `drag/group-motion.ts` animates it (DOM only, rows
  found by `data-entry`): copies of the rows fly into the preview's stack on grab (the rows stay in place, faded),
  and on drop copies fly out of its cards onto the rows, like the dragged row's; `DragState.hold` keeps the draft
  until they have landed. Page order and placement rules are pure
  (`model/selection.ts`). `SelectionDismiss` clears it on a click outside the selected rows, on panel blur, and on
  an Escape nothing else handled. Mark new menus or dialogs' containers so they stay inside `[data-overlay-root]`.
- **Recent tab switcher** (`engine/recent-tabs/`, `ui/recent-tabs/`): on while either of its shortcuts is assigned and
  Chrome grants site access (`<all_urls>`, required, but users can withhold it): `recentTabsEnabled` gates the
  previews and the shortcut. The page script follows site access only: Chrome reports no change to shortcuts, and
  without one the script stays idle. Chrome's commands only report the shortcut, never letting go of the modifier, so
  a script on every website, in every frame (`entrypoints/recent-tabs.ts`, registered at `document_start`), watches
  it; the worker forwards each press to the active page's top frame (`recent-tabs:step`). That script stays small (no
  Svelte): the overlay is its own script (`entrypoints/recent-tabs-overlay.ts`), which the worker adds to a page on its
  first press (`recent-tabs:overlay`), reading the switcher the page script left on its window
  (`ui/recent-tabs/host.ts`, Volet's isolated world) through a plain `RecentTabsFeed`. A page that didn't see the
  modifier go down asks whoever has focus instead (`relayHoldsModifier`): its window's Volet panel
  (`recent-tabs:panel-holds`) and its own frames, through the worker (`recent-tabs:frames-hold`); the one holding it
  sends the page its keys (`ui/recent-tabs/relay-keys.ts`, `recent-tabs:relay-key`, the only message a frame may
  send). All read keys through `model/recent-tab-keys.ts`, so they mean the same everywhere. The worker reads Chrome's
  shortcuts once per press before forwarding it, so letting go right after a press can reach the page first: the
  worker follows each press until the page has it (`engine/recent-tabs/presses.ts`), the page waits for those before
  switching (`recent-tabs:settle`), and one arriving meanwhile still counts (`RecentTabCycle.amend`). Only switching
  and closing tabs wait for the engine queue: history has its own (`history.ts`), and the tabs and hue a page asks for
  are read outside it, like Search's. Open pages get the script once per session (`attachToOpenPagesOnce`), not each
  time the worker wakes, and out of the engine queue too: a page still loading would hold every command. Screenshots
  are shrunk to 400 pixels across (`engine/image.ts`) and live in `chrome.storage.session` (`preview-store.ts`, one
  key each plus a small index), so they outlive the worker, which Chrome stops after about 30 seconds idle; that
  storage also holds the engine's session state, so keep them small.
- **Styles**: `styles/tokens.css` (design tokens on `.sidebar`, `.palette-root`, `.page-root`, `.recent-tabs-root`),
  `styles/theme.css` (Tailwind theme), then one entry stylesheet per surface (`app.css`, `ui/palette/palette.css`,
  `ui/recent-tabs/recent-tabs.css`, `styles/page.css`). Surfaces over web pages (palette, tab switcher) take the
  active Volet's hue from the worker's answers and the system's color scheme, like the panel.
  They use Tailwind too, with two limits inside their shadow roots. `rem` there is the page's root font size, not ours
  (YouTube's is 10px), so `styles/page-scales.css` sets Tailwind's spacing, radius and text scales in px: size
  anything else in px too (e2e tests render both over a 10px root). And Chrome doesn't register `@property` there, so
  utilities built on it (`shadow-*`, `ring-*`, transforms, border widths) do nothing: write those as arbitrary
  properties (`[box-shadow:var(--overlay-shadow)]`).
  Shadow roots Volet adds to web pages (palette, recent tab switcher) are closed (`shadowMode`), so the page's own
  scripts can't read the tabs shown in them; only the e2e build (`--mode e2e`) opens them, for Playwright. They start
  with `:host { all: initial !important; }`: the page's own rules for the host win over a normal `:host` rule, and
  sites built from web components hide undefined elements (`:not(:defined)`, reddit), which a content script's host
  always is.

## Coding guidelines

Prioritize **modularity, reusability, and separation of concerns**.

- **Opposite actions get separate bindings.** Expose both directions (such as next/previous) as independently
  configurable shortcuts in Settings. An unassigned action has no implicit modifier binding. Chrome refuses to load an
  extension that suggests more than four shortcuts (`suggested_key`), so the rest start unassigned. Suggest Control
  everywhere (`MacCtrl` for a Mac: a manifest's `Ctrl` is Command there), and never one of Chrome's own shortcuts
  (Ctrl+F, Ctrl+S, Cmd+Q...), which Chrome silently leaves unassigned. Chrome's shortcuts page lists commands by id,
  so name opposite ones to sort the way Settings lists them (`cycle-recent-tabs`, then `cycle-recent-tabs-reverse`).
- **One responsibility per component, kept small and focused.** When a component or module grows, extract helpers, sub-components, or state modules instead of expanding it. Never add "just one more thing" to a file when it deserves its own abstraction.
- **Generic and data-driven.** Components take clear inputs (props) and outputs (callback props or snippets). No hardcoded business rules or tight coupling: presentational components (`TabRow`, `IconButton`, `Favicon`, ...) know nothing about the store; thin container components connect them to `SidebarStore`.
- **UI, state, and business logic stay separate.** UI components never call `browser.*`. State modules never render. Engine code never imports Svelte.
- **Composition over monoliths.** Build features by composing small pieces (snippets, sub-components, helper modules), not by adding branches to existing ones.
- **Readability, maintainability, scalability** come before cleverness. Name things by what they mean to the user (Space, pin, favorite), not by how Chrome implements them.

Svelte specifics:

- Svelte 5 runes only (`$state`, `$derived`, `$props`, `$effect` as a last resort), snippets instead of slots, callback props instead of events.
- Prefer `$derived` over `$effect` for computed values.
- Tailwind utilities for all styling, on every surface (the panel, Volet's pages, Search and the tab switcher over web
  pages); design tokens are CSS variables (`styles/tokens.css`, all tinted by `--space-hue`). Keep stylesheets to what
  utilities can't express, in Tailwind's own terms where it has them: `@theme`, base styles, `:host`, `@property` and
  `@keyframes`, custom utilities (`@utility scroll-strip`), and surfaces shared by several components that utilities
  adjust where they're used (`@layer components`: `.menu-surface` in `styles/menu-surface.css`, `.tooltip-surface`).
  No component `<style>` blocks. Hooks for tests and code are data attributes (`data-row`, `data-recent-tab`), not
  class names.
- Accessibility floor: real buttons, labels on icon-only buttons, visible focus, respect `prefers-reduced-motion`.

Engine specifics:

- Every Chrome write goes through the engine queue. Call Chrome tab APIs that can hit the drag lock through `retry()`.
- Read a tab's URL with `tabUrl()` (`snapshot.ts`): Chrome leaves `tab.url` empty until the first navigation commits.
- Bring a tab to the front with `activate()` (`tab-ops.ts`), and load the root folder's tree with `loadRoot()`.
- When a command removes a tab and its binding, close the tab first, then unbind: never let a closing tab show up as
  a temporary tab in between.
- Settings and purely visual state (open folders) are written directly from the UI's state modules; everything
  that touches tabs, groups or bookmarks is a command.
- Reconcile must stay idempotent: running it twice changes nothing.

## Tests

- Unit tests (`*.test.ts`, Vitest) next to pure modules.
- End-to-end tests (`tests/e2e/*.spec.ts`, Playwright) load `output/chrome-mv3-e2e` (the production build with open
  shadow roots, `NODE_ENV=production wxt build --mode e2e`: any other mode would otherwise compile Svelte for
  development) into Chromium, open the panel page in its own window (`sidepanel.html?windowId=<id>`), and assert on Chrome's real state from the service worker.
- New behavior in the engine gets an e2e test; new pure logic gets a unit test.
- E2e tests run in parallel (4 workers, `fullyParallel`, about 50 seconds in all): each test has its own Chromium and
  profile, but they share the CPU, so write them for a loaded machine. Wait for a state, never for a delay; set things
  up the way Volet does (a command sent from a page, as the panel would) rather than with Chrome calls the engine may
  undo while it reconciles; and match names exactly where a wrapper could share them (dnd-kit makes a row's wrapper a
  button until its own button takes over as the drag handle).
- `tests/e2e/resilience.spec.ts` covers multiple windows and a real browser restart (same profile, session restored).
- Playwright can't press Volet's shortcuts (browser-level gestures), but the worker can run its own handling of one:
  `chrome.commands.onCommand.dispatch(name, tab)` (`press` in `recent-tabs.spec.ts`). The palette's in-page overlay
  is tested on its own; the panel palette exercises the same components and worker messages.

## Writing style

Never use the em dash character in code, comments, docs, UI copy or commit messages. Use a colon, parentheses, a comma, or separate sentences. UI copy is sentence case and names what the user controls.

In UI copy, a Space is called a Volet (plural Volets), like the extension itself: "New Volet", "Move to Volet".
Code, comments and docs keep "Space". The bookmarks root folder is named `Volet` (`ROOT_TITLE`), after the
extension, so it's clear what it's for; the engine names it back if it's renamed. Copy about Arc's own data keeps
Arc's word ("Bring your Arc Spaces").
