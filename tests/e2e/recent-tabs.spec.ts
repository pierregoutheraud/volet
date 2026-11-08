import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium, type BrowserContext, type Locator, type Page, type Worker } from '@playwright/test';
import { command, extensionPath, expect, stripState, test as base } from './fixtures';

// An isolated copy of the production extension, so a test can model other shortcut bindings. All switcher code still
// runs unchanged in real Chromium.
const test = base.extend<{ customCycle: boolean; customReverse: boolean; clearedCycle: boolean; clearedReverse: boolean }>({
  customCycle: [true, { option: true }],
  customReverse: [false, { option: true }],
  clearedCycle: [false, { option: true }],
  clearedReverse: [false, { option: true }],
  context: async ({ customCycle, customReverse, clearedCycle, clearedReverse }, use) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'volet-recent-tabs-'));
    const extension = path.join(directory, 'extension');
    await cp(extensionPath, extension, { recursive: true });
    const manifestPath = path.join(extension, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    if (customCycle) {
      // Model a user-assigned cycling binding (⌘E on a Mac, which most tests hold); production suggests Ctrl+Q.
      manifest.commands['cycle-recent-tabs'].suggested_key = { default: 'Alt+Q', mac: 'Command+E' };
    }
    if (customReverse) {
      // Model a user-assigned reverse binding; production suggests Ctrl+Shift+Q.
      manifest.commands['cycle-recent-tabs-reverse'].suggested_key = { default: 'Ctrl+Shift+Y', mac: 'Command+Shift+Y' };
    }
    if (clearedCycle) {
      // Model a user who cleared the cycling binding in Chrome.
      delete manifest.commands['cycle-recent-tabs'].suggested_key;
    }
    if (clearedReverse) {
      // Model a user who cleared the reverse binding in Chrome.
      delete manifest.commands['cycle-recent-tabs-reverse'].suggested_key;
    }
    await writeFile(manifestPath, JSON.stringify(manifest));
    const context = await chromium.launchPersistentContext(path.join(directory, 'profile'), {
      channel: 'chromium', headless: !process.env.HEADED,
      args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
    });
    await context.route('https://recent-tabs.test/**', (route) => {
      const name = new URL(route.request().url()).pathname.slice(1);
      return route.fulfill({ contentType: 'text/html', body:
        `<title>Recent ${name}</title><body style="background:#d7e3fa;font:48px system-ui;padding:80px">Page ${name}</body>` });
    });
    await use(context);
    await context.close();
    await rm(directory, { recursive: true, force: true });
  },
});

async function createRecentPages(context: BrowserContext, worker: Worker, windowId: number): Promise<number[]> {
  const names = ['A', 'B', 'C', 'D', 'E', 'F'];
  // Opened by Playwright, each becoming the active tab in turn (F is the most recent): it serves the test pages only
  // once attached to a tab, so a tab the worker opens starts loading too early, and each had to wait about a second.
  for (const name of names) await (await context.newPage()).goto(`https://recent-tabs.test/${name}`);
  const ids = await worker.evaluate(async ({ windowId, names }) => {
    const tabs = await chrome.tabs.query({ windowId });
    return names.map((name) => tabs.find((tab) => tab.url === `https://recent-tabs.test/${name}`)!.id!);
  }, { windowId, names });
  await worker.evaluate(async ({ ids, windowId }) => {
    // Put an older tab in another Space to exercise switching across groups.
    const groupId = await chrome.tabs.group({ tabIds: [ids[3]!], createProperties: { windowId } });
    await chrome.tabGroups.update(groupId, { title: 'Another Volet' });
  }, { ids, windowId });
  await expect.poll(async () => (await stripState(worker, windowId)).find((tab) => tab.active)?.id).toBe(ids[5]);
  return ids;
}

async function step(worker: Worker, tabId: number, shortcut = '⌘E', offset: 1 | -1 = 1) {
  // Exercise the exact message sent by chrome.commands; browser-level shortcut gestures themselves
  // require a real keyboard and are not dispatched by Playwright's page keyboard API. Cycling sends
  // offset 1 (older tabs), cycling in reverse -1 (`recentTabOffset`).
  await worker.evaluate(async ({ tabId, shortcut, offset }) => {
    await chrome.tabs.sendMessage(tabId, { type: 'recent-tabs:step', shortcut, offset }, { frameId: 0 });
  }, { tabId, shortcut, offset });
}

/** Chrome reporting the shortcut: the worker's own listener runs, reads the shortcut, and forwards the press. */
async function press(worker: Worker, tabId: number, command = 'cycle-recent-tabs') {
  await worker.evaluate(async ({ tabId, command }) => {
    const onCommand = chrome.commands.onCommand as unknown as { dispatch: (command: string, tab: chrome.tabs.Tab) => void };
    onCommand.dispatch(command, await chrome.tabs.get(tabId));
  }, { tabId, command });
}

/** Make the worker's `call` to Chrome answer `delay` milliseconds late. */
async function slowDown(worker: Worker, api: 'commands.getAll' | 'bookmarks.create', delay: number) {
  await worker.evaluate(({ api, delay }) => {
    const [namespace, method] = api.split('.') as [string, string];
    const target = (chrome as unknown as Record<string, Record<string, (...args: unknown[]) => Promise<unknown>>>)[namespace]!;
    const original = target[method]!.bind(target);
    target[method] = async (...args) => {
      await new Promise((resolve) => setTimeout(resolve, delay));
      return original(...args);
    };
  }, { api, delay });
}

async function activeId(worker: Worker, windowId: number) {
  return (await stripState(worker, windowId)).find((tab) => tab.active)?.id;
}

async function recentPage(context: BrowserContext, name: string): Promise<Page> {
  // Check often: a new page shows up about a second after its tab opens, and the default backoff waits up to a second more.
  await expect.poll(() => context.pages().some((page) => page.url() === `https://recent-tabs.test/${name}`), { intervals: [50] })
    .toBe(true);
  const page = context.pages().find((page) => page.url() === `https://recent-tabs.test/${name}`)!;
  await page.waitForLoadState();
  return page;
}

test('held Cmd cycles a frozen five-tab preview and commits across Volets on release', async ({ context, worker, windowId, panel }) => {
  const ids = await createRecentPages(context, worker, windowId);
  const page = await recentPage(context, 'F');
  await page.bringToFront();
  await page.keyboard.down('Meta');
  await step(worker, ids[5]!);
  const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[data-recent-tab]')).toHaveCount(5);
  await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent E');
  expect(await activeId(worker, windowId)).toBe(ids[5]);
  await step(worker, ids[5]!);
  await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent D');
  expect(await activeId(worker, windowId)).toBe(ids[5]);
  const bounds = await dialog.boundingBox();
  const viewport = page.viewportSize()!;
  expect(Math.abs(bounds!.x + bounds!.width / 2 - viewport.width / 2)).toBeLessThan(2);
  expect(Math.abs(bounds!.y + bounds!.height / 2 - viewport.height / 2)).toBeLessThan(2);
  await page.keyboard.up('Meta');
  await expect.poll(() => activeId(worker, windowId)).toBe(ids[3]);
  await expect(dialog).toHaveCount(0);
  await expect.poll(async () => (await stripState(worker, windowId)).find((tab) => tab.id === ids[3])?.collapsed).toBe(false);
  await expect(panel.getByText('Another Volet', { exact: true }).first()).toBeVisible();
});

test('previews show at 170 pixels across, whatever root font size the page sets, and shrink so all five fit on a narrower page', async ({ context, worker, windowId }) => {
  const ids = await createRecentPages(context, worker, windowId);
  const page = await recentPage(context, 'F');
  await page.bringToFront();
  // YouTube's root font size: sizes in rem would shrink by a third.
  await page.evaluate(() => { document.documentElement.style.fontSize = '10px'; });
  const previews = page.getByRole('dialog', { name: 'Recent tabs' }).locator('[data-recent-tab-preview]');
  // The Volet panel takes room from the page: 700 pixels is a small window with the panel open.
  for (const width of [1280, 700]) {
    await page.setViewportSize({ width, height: 720 });
    await page.keyboard.down('Meta');
    await step(worker, ids[5]!);
    await expect(previews).toHaveCount(5);
    const boxes = await previews.evaluateAll((nodes) => nodes.map((node) => node.getBoundingClientRect().toJSON() as DOMRect));
    for (const box of boxes) {
      if (width === 1280) expect([box.width, box.height]).toEqual([170, 106.25]);
      expect(box.width / box.height).toBeCloseTo(1.6, 1);
      expect(box.left).toBeGreaterThanOrEqual(0);
      expect(box.right).toBeLessThanOrEqual(width);
    }
    await page.keyboard.press('Escape');
    await page.keyboard.up('Meta');
    await expect(previews).toHaveCount(0);
  }
  expect(await activeId(worker, windowId)).toBe(ids[5]);
});

test('quick taps toggle the two most recent tabs even if the command arrives after release', async ({ context, worker, windowId }) => {
  const ids = await createRecentPages(context, worker, windowId);
  const page = await recentPage(context, 'F');
  await page.bringToFront();
  await page.keyboard.down('Meta');
  await page.keyboard.up('Meta');
  await step(worker, ids[5]!);
  await expect.poll(() => activeId(worker, windowId)).toBe(ids[4]);
  const previous = await recentPage(context, 'E');
  await previous.keyboard.down('Meta');
  await previous.keyboard.up('Meta');
  await step(worker, ids[4]!);
  await expect.poll(() => activeId(worker, windowId)).toBe(ids[5]);
  await expect(page.getByRole('dialog', { name: 'Recent tabs' })).toHaveCount(0);
});

test('a press made just before letting go still counts when the release reaches the page first', async ({ context, worker, windowId }) => {
  const ids = await createRecentPages(context, worker, windowId);
  const page = await recentPage(context, 'F');
  await page.bringToFront();
  await page.keyboard.down('Meta');
  await press(worker, ids[5]!);
  const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
  await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent E');
  // The worker reads Chrome's shortcuts before forwarding a press: slowed down, the release wins the race.
  await slowDown(worker, 'commands.getAll', 500);
  await press(worker, ids[5]!);
  await page.keyboard.up('Meta');
  await expect(dialog).toHaveCount(0);
  // Two presses: D, not E (one press), nor F again (the late press as a quick tap from E).
  await expect.poll(() => activeId(worker, windowId)).toBe(ids[3]);
  await expect(dialog).toHaveCount(0);
});

test('the switcher gets its tabs while the engine is busy with a slow command', async ({ context, worker, windowId }) => {
  await (await context.newPage()).goto('https://recent-tabs.test/Previous');
  await (await context.newPage()).goto('https://recent-tabs.test/Current');
  const current = (await stripState(worker, windowId)).find((tab) => tab.active)!.id;
  await expect.poll(async () => (await queryFrom(worker, current)).length).toBeGreaterThan(1);
  // Pinning the tab holds the engine's queue for 3 seconds (Chrome slow to make the bookmark).
  await slowDown(worker, 'bookmarks.create', 3000);
  await press(worker, current, 'toggle-pin');
  const started = Date.now();
  expect((await queryFrom(worker, current)).length).toBeGreaterThan(1);
  expect(Date.now() - started).toBeLessThan(1500);
});

test.describe('cleared reverse shortcut', () => {
  test.use({ clearedReverse: true });

  test('an assigned cycling shortcut never supplies an unassigned reverse shortcut', async ({ context, worker, windowId }) => {
    const commands = await worker.evaluate(() => chrome.commands.getAll());
    expect(commands.find((command) => command.name === 'cycle-recent-tabs')?.shortcut).not.toBe('');
    expect(commands.find((command) => command.name === 'cycle-recent-tabs-reverse')?.shortcut).toBe('');
    const previous = await context.newPage();
    await previous.goto('https://recent-tabs.test/Previous');
    const page = await context.newPage();
    await page.goto('https://recent-tabs.test/Current');
    const current = (await stripState(worker, windowId)).find((tab) => tab.active)!.id;
    await page.keyboard.press('Meta+Shift+E');
    expect(await activeId(worker, windowId)).toBe(current);
    const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
    await expect(dialog).toHaveCount(0);
    await page.keyboard.down('Meta');
    await step(worker, current);
    await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent Previous');
    await page.keyboard.press('Shift+E');
    await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent Previous');
    await page.keyboard.press('Escape');
    await page.keyboard.up('Meta');
    expect(await activeId(worker, windowId)).toBe(current);
  });
});

test('Escape cancels, arrows wrap, and closed tabs and other windows are excluded', async ({ context, worker, windowId }) => {
  const ids = await createRecentPages(context, worker, windowId);
  await worker.evaluate(async ({ closedId }) => {
    await chrome.tabs.remove(closedId);
    await chrome.windows.create({ url: 'https://recent-tabs.test/OtherWindow' });
  }, { closedId: ids[4]! });
  const page = await recentPage(context, 'F');
  await page.bringToFront();
  await page.keyboard.down('Alt');
  await step(worker, ids[5]!, 'Alt+Q');
  const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('button', { name: 'Recent E', exact: true })).toHaveCount(0);
  await expect(dialog.getByRole('button', { name: 'Recent OtherWindow' })).toHaveCount(0);
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent F');
  await page.keyboard.press('ArrowLeft');
  await expect(dialog.locator('[aria-current="true"]')).not.toHaveAttribute('aria-label', 'Recent F');
  await page.keyboard.press('Escape');
  await page.keyboard.up('Alt');
  await expect(dialog).toHaveCount(0);
  expect(await activeId(worker, windowId)).toBe(ids[5]);
});

test('visited tabs gain local screenshots in the centered preview', async ({ context, worker, windowId }, testInfo) => {
  const ids = await createRecentPages(context, worker, windowId);
  const page = await recentPage(context, 'F');
  await page.bringToFront();
  // Give the visible page's load/activation capture a chance to finish before opening an overlay.
  await expect.poll(async () => {
    const previews = await worker.evaluate(async (id) => {
      const result = await chrome.scripting.executeScript({
        target: { tabId: id },
        func: async () => chrome.runtime.sendMessage({ type: 'recent-tabs:query' }),
      });
      return result[0]?.result;
    }, ids[5]!);
    return previews?.tabs?.some((tab: { preview?: string }) => tab.preview?.startsWith('data:image/jpeg;base64,'));
  }, { timeout: 10_000 }).toBe(true);
  await page.keyboard.down('Meta');
  await step(worker, ids[5]!);
  const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
  await expect(dialog.locator('[data-recent-tab-screenshot]').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('recent-tabs.png') });
  await page.keyboard.press('Escape');
  await page.keyboard.up('Meta');
});

test('in reverse it starts at the far right, the oldest, then moves left, and directions can be mixed', async ({ context, worker, windowId }) => {
  const ids = await createRecentPages(context, worker, windowId);
  const page = await recentPage(context, 'F');
  await page.bringToFront();
  await page.keyboard.down('Meta');
  await page.keyboard.down('Shift');
  await step(worker, ids[5]!, '⌘⇧E', -1);
  const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
  await expect(dialog).toBeVisible();
  // F, E, D, C, B: next wraps from the current tab to the far right, like Cmd+Shift+Tab on a Mac.
  await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent B');
  await expect(dialog.getByText('Release the shortcut modifier', { exact: false })).toHaveCount(0);
  await step(worker, ids[5]!, '⌘⇧E', -1);
  await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent C');
  await page.keyboard.up('Shift');
  expect(await activeId(worker, windowId)).toBe(ids[5]);
  // Cycling moves back right, in the same frozen order.
  await step(worker, ids[5]!);
  await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent B');
  await page.keyboard.up('Meta');
  await expect.poll(() => activeId(worker, windowId)).toBe(ids[1]);
  await expect(dialog).toHaveCount(0);
});

test('a quick tap in reverse switches to the oldest of the five, like Cmd+Shift+Tab, and cycling comes straight back', async ({ context, worker, windowId }) => {
  const ids = await createRecentPages(context, worker, windowId);
  const page = await recentPage(context, 'F');
  await page.bringToFront();
  await page.keyboard.down('Meta');
  await page.keyboard.down('Shift');
  await step(worker, ids[5]!, '⌘⇧E', -1);
  await page.keyboard.up('Shift');
  await page.keyboard.up('Meta');
  // F, E, D, C, B: the far right is B.
  await expect.poll(() => activeId(worker, windowId)).toBe(ids[1]);
  await expect(page.getByRole('dialog', { name: 'Recent tabs' })).toHaveCount(0);
  const oldest = await recentPage(context, 'B');
  await oldest.keyboard.down('Meta');
  await oldest.keyboard.up('Meta');
  await step(worker, ids[1]!);
  await expect.poll(() => activeId(worker, windowId)).toBe(ids[5]);
});

test('tabs without screenshots use favicon placeholders with no visible footer', async ({ context, worker, windowId }, testInfo) => {
  const background = await context.newPage();
  await background.goto('https://recent-tabs.test/Background');
  await expect(background).toHaveTitle('Recent Background');
  const page = await context.newPage();
  await page.goto('https://recent-tabs.test/Foreground');
  // Changing a background tab's address invalidates its snapshot without capturing the new page.
  await background.goto('https://recent-tabs.test/Background#updated');
  await page.keyboard.down('Meta');
  const foregroundId = await worker.evaluate(async (windowId) =>
    (await chrome.tabs.query({ windowId, active: true }))[0]!.id!, windowId);
  await step(worker, foregroundId);
  const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
  const card = dialog.getByRole('button', { name: 'Recent Background', exact: true });
  await expect(card.locator('[data-recent-tab-placeholder]')).toBeVisible();
  await expect(card.locator('[data-recent-tab-screenshot]')).toHaveCount(0);
  await expect(dialog.locator('p')).toHaveCount(0);
  await page.screenshot({ path: testInfo.outputPath('recent-tabs-placeholder.png') });
  await page.keyboard.press('Escape');
  await page.keyboard.up('Meta');
});

test('only the configured close shortcut removes highlighted tabs and live rebinding takes effect', async ({ context, worker, windowId }) => {
  await worker.evaluate(() => chrome.storage.local.set({ previewCloseShortcut: 'Cmd+Backspace' }));
  const ids = await createRecentPages(context, worker, windowId);
  const page = await recentPage(context, 'F');
  await page.bringToFront();
  await page.keyboard.down('Meta');
  await step(worker, ids[5]!);
  const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
  await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent E');
  await page.keyboard.press('Backspace');
  await expect.poll(async () => (await stripState(worker, windowId)).some((tab) => tab.id === ids[4])).toBe(false);
  expect(await activeId(worker, windowId)).toBe(ids[5]);
  await expect(dialog.locator('[data-recent-tab]')).toHaveCount(4);
  await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent D');
  // Delete is a different key and has no implicit close binding.
  await page.keyboard.press('Delete');
  await expect(dialog.locator('[data-recent-tab]')).toHaveCount(4);
  await worker.evaluate(() => chrome.storage.local.set({ previewCloseShortcut: 'Cmd+Delete' }));
  await page.keyboard.press('Delete');
  await expect.poll(async () => (await stripState(worker, windowId)).some((tab) => tab.id === ids[3])).toBe(false);
  expect(await activeId(worker, windowId)).toBe(ids[5]);
  await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent C');
  await page.keyboard.up('Meta');
  await expect.poll(() => activeId(worker, windowId)).toBe(ids[2]);
});

test('hover selects a preview and its close button closes that tab without activating it', async ({ context, worker, windowId }) => {
  await worker.evaluate(() => chrome.storage.local.set({ previewCloseShortcut: 'Cmd+Backspace' }));
  const ids = await createRecentPages(context, worker, windowId);
  const page = await recentPage(context, 'F');
  await page.bringToFront();
  await page.keyboard.down('Meta');
  await step(worker, ids[5]!);
  const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
  await dialog.getByRole('button', { name: 'Recent C', exact: true }).hover();
  await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent C');
  await page.keyboard.press('Backspace');
  await expect.poll(async () => (await stripState(worker, windowId)).some((tab) => tab.id === ids[2])).toBe(false);
  expect(await activeId(worker, windowId)).toBe(ids[5]);
  await dialog.getByRole('button', { name: 'Recent E', exact: true }).hover();
  await dialog.getByRole('button', { name: 'Close Recent E', exact: true }).click();
  await expect.poll(async () => (await stripState(worker, windowId)).some((tab) => tab.id === ids[4])).toBe(false);
  expect(await activeId(worker, windowId)).toBe(ids[5]);
  const closeButton = dialog.getByRole('button', { name: 'Close Recent D', exact: true });
  await closeButton.focus();
  await closeButton.press('Enter');
  await expect.poll(async () => (await stripState(worker, windowId)).some((tab) => tab.id === ids[3])).toBe(false);
  expect(await activeId(worker, windowId)).toBe(ids[5]);
  await expect(dialog).toBeVisible();
  await page.keyboard.press('Escape');
  await page.keyboard.up('Meta');
});

test('a Cmd/Ctrl-clicked link becomes the next selection before previously visited tabs', async ({ context, worker, windowId }) => {
  const ids = await createRecentPages(context, worker, windowId);
  const page = await recentPage(context, 'F');
  await page.bringToFront();
  await page.evaluate(() => {
    const link = document.createElement('a');
    link.href = 'https://recent-tabs.test/New';
    link.textContent = 'Open a background tab';
    document.body.append(link);
  });
  await page.getByRole('link', { name: 'Open a background tab' }).click({
    modifiers: [process.platform === 'darwin' ? 'Meta' : 'Control'],
  });
  const findNewTab = () => worker.evaluate(async (windowId) =>
    (await chrome.tabs.query({ windowId })).find((tab) =>
      (tab.pendingUrl ?? tab.url) === 'https://recent-tabs.test/New')?.id, windowId);
  // Keep the id the poll found: looked up again while the navigation commits, the tab can briefly match neither URL.
  let found: number | undefined;
  await expect.poll(async () => (found = await findNewTab())).not.toBeUndefined();
  const newTabId = found!;
  expect(await activeId(worker, windowId)).toBe(ids[5]);
  await page.keyboard.down('Meta');
  await step(worker, ids[5]!);
  await expect(page.getByRole('dialog', { name: 'Recent tabs' })).toBeVisible();
  expect(await activeId(worker, windowId)).toBe(ids[5]);
  await page.keyboard.up('Meta');
  await expect.poll(() => activeId(worker, windowId)).toBe(newTabId);
  await recentPage(context, 'New');
  // Once visited, another quick tap returns to the original page.
  await step(worker, newTabId);
  await expect.poll(() => activeId(worker, windowId)).toBe(ids[5]);
});

test('several new background tabs are newest first and preserve the original page for toggling', async ({ context, worker, windowId }) => {
  const ids = await createRecentPages(context, worker, windowId);
  const page = await recentPage(context, 'F');
  await page.bringToFront();
  const created = await worker.evaluate(async (windowId) => {
    const ids: number[] = [];
    for (let index = 0; index < 6; index++) {
      const tab = await chrome.tabs.create({ windowId, url: `https://recent-tabs.test/Background${index}`, active: false });
      ids.push(tab.id!);
    }
    return ids;
  }, windowId);
  expect(await activeId(worker, windowId)).toBe(ids[5]);
  await step(worker, ids[5]!);
  await expect.poll(() => activeId(worker, windowId)).toBe(created[5]);
  await recentPage(context, 'Background5');
  await step(worker, created[5]!);
  await expect.poll(() => activeId(worker, windowId)).toBe(ids[5]);
  // Closing the newest tab exposes the next newest background tab, rather than stale history.
  await worker.evaluate((id) => chrome.tabs.remove(id), created[5]!);
  // And it leaves the window's history, where it would take one of the five slots.
  await expect.poll(() => worker.evaluate(async ({ windowId, id }) => {
    const { recentTabs } = await chrome.storage.session.get('recentTabs');
    return ((recentTabs as Record<string, number[]> | undefined)?.[windowId] ?? []).includes(id);
  }, { windowId, id: created[5]! })).toBe(false);
  await step(worker, ids[5]!);
  await expect.poll(() => activeId(worker, windowId)).toBe(created[4]);
});

test('switcher favicons load inline on a page that restricts cross-origin images', async ({ context, worker, windowId }) => {
  await context.route('https://www.youtube.com/**', (route) => route.fulfill({
    contentType: 'text/html',
    headers: { 'Content-Security-Policy': "default-src 'self'; img-src 'self' data:; style-src 'unsafe-inline'" },
    body: '<title>Restricted images</title><body>Restricted page</body>',
  }));
  const previous = await context.newPage();
  await previous.goto('https://recent-tabs.test/Previous');
  const page = await context.newPage();
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error' && /_favicon|chrome-extension:/.test(message.text())) errors.push(message.text());
  });
  await page.goto('https://www.youtube.com/');
  const tabId = (await stripState(worker, windowId)).find((tab) => tab.active)!.id;
  await page.keyboard.down('Meta');
  await step(worker, tabId);
  const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('img[src^="chrome-extension:"]')).toHaveCount(0);
  const icons = dialog.locator('[data-recent-tab-caption] img');
  await expect(icons).toHaveCount(2);
  await expect.poll(() => icons.evaluateAll((images) => images.every((image) =>
    image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
  expect(errors).toEqual([]);
  await page.keyboard.press('Escape');
  await page.keyboard.up('Meta');
});

test.describe('custom reverse shortcut', () => {
  test.use({ customReverse: true });

  test('a custom reverse binding cycles the frozen list in reverse without an implicit Shift binding', async ({ context, worker, windowId }) => {
    const ids = await createRecentPages(context, worker, windowId);
    const commands = await worker.evaluate(() => chrome.commands.getAll());
    const cycle = commands.find((command) => command.name === 'cycle-recent-tabs')!.shortcut!;
    const reverse = commands.find((command) => command.name === 'cycle-recent-tabs-reverse')!.shortcut!;
    expect(reverse).not.toBe('');
    expect(reverse).not.toBe(cycle);
    const page = await recentPage(context, 'F');
    await page.bringToFront();
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.down(modifier);
    await page.keyboard.down('Shift');
    // Shift with the cycling key never hijacks the page; only the assigned native reverse command can step.
    await page.keyboard.press(process.platform === 'darwin' ? 'E' : 'Q');
    const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
    await expect(dialog).toHaveCount(0);
    // F, E, D, C, B: in reverse from the far right, moving left.
    await step(worker, ids[5]!, reverse, -1);
    await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent B');
    await step(worker, ids[5]!, reverse, -1);
    await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent C');
    await step(worker, ids[5]!, reverse, -1);
    await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent D');
    await page.keyboard.up('Shift');
    expect(await activeId(worker, windowId)).toBe(ids[5]);
    await page.keyboard.up(modifier);
    await expect.poll(() => activeId(worker, windowId)).toBe(ids[3]);
  });

  test('late commands switch at once: cycling toggles the last two tabs, in reverse it goes to the oldest, also with two or one tabs', async ({ context, worker, windowId }) => {
    const ids = await createRecentPages(context, worker, windowId);
    const commands = await worker.evaluate(() => chrome.commands.getAll());
    const reverse = commands.find((command) => command.name === 'cycle-recent-tabs-reverse')!.shortcut!;
    const cycle = commands.find((command) => command.name === 'cycle-recent-tabs')!.shortcut!;
    // F, E, D, C, B: cycling toggles F and E, in reverse it goes to the far right (B), and cycling from B returns to F.
    const gestures: { from: string; shortcut: string; offset: 1 | -1; to: number }[] = [
      { from: 'F', shortcut: cycle, offset: 1, to: ids[4]! },
      { from: 'E', shortcut: cycle, offset: 1, to: ids[5]! },
      { from: 'F', shortcut: reverse, offset: -1, to: ids[1]! },
      { from: 'B', shortcut: cycle, offset: 1, to: ids[5]! },
    ];
    let currentId = ids[5]!;
    for (const gesture of gestures) {
      const page = await recentPage(context, gesture.from);
      const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
      await page.keyboard.down(modifier);
      await page.keyboard.up(modifier);
      // Deliver the browser command after release, before the async tab query completes.
      await step(worker, currentId, gesture.shortcut, gesture.offset);
      await expect.poll(() => activeId(worker, windowId)).toBe(gesture.to);
      currentId = gesture.to;
    }
    await worker.evaluate(async ({ windowId, keep }) => {
      const tabs = await chrome.tabs.query({ windowId });
      await chrome.tabs.remove(tabs.filter((tab) => tab.id !== undefined && !keep.includes(tab.id)).map((tab) => tab.id!));
    }, { windowId, keep: [ids[4]!, ids[5]!] });
    await expect.poll(async () => (await stripState(worker, windowId)).length).toBe(2);
    await step(worker, ids[5]!, cycle, 1);
    await expect.poll(() => activeId(worker, windowId)).toBe(ids[4]);
    await step(worker, ids[4]!, cycle, 1);
    await expect.poll(() => activeId(worker, windowId)).toBe(ids[5]);
    await worker.evaluate((id) => chrome.tabs.remove(id), ids[4]!);
    await expect.poll(async () => (await stripState(worker, windowId)).length).toBe(1);
    await step(worker, ids[5]!, cycle, 1);
    expect(await activeId(worker, windowId)).toBe(ids[5]);
    await expect.poll(async () => (await stripState(worker, windowId)).length).toBe(1);
  });
});

test.describe('default preview shortcuts', () => {
  test.use({ customCycle: false });

  test('fresh installs cycle with Ctrl+Q and in reverse with Ctrl+Shift+Q while Control is held, and have no close key until one is recorded', async ({ context, worker, windowId }) => {
    const commands = await worker.evaluate(() => chrome.commands.getAll());
    const shortcut = (name: string) => commands.find((command) => command.name === name)?.shortcut ?? '';
    const cycle = shortcut('cycle-recent-tabs');
    // Control on a Mac too (MacCtrl): a manifest's Ctrl is Command there.
    expect(cycle).toMatch(/^(⌃Q|Ctrl\+Q)$/);
    expect(shortcut('cycle-recent-tabs-reverse')).toMatch(/^(⌃⇧Q|Ctrl\+Shift\+Q)$/);
    expect(shortcut('open-palette')).toMatch(/^(⌃M|Ctrl\+M)$/);
    expect(shortcut('toggle-sidebar')).toMatch(/^(⌃B|Ctrl\+B)$/);
    // Chrome won't load an extension suggesting more than four shortcuts: pinning gave up its default.
    expect(shortcut('toggle-pin')).toBe('');
    const previous = await context.newPage();
    await previous.goto('https://recent-tabs.test/Previous');
    const page = await context.newPage();
    await page.goto('https://recent-tabs.test/Current');
    const before = await stripState(worker, windowId);
    const current = before.find((tab) => tab.active)!.id;
    const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
    await page.keyboard.down('Control');
    await step(worker, current, cycle, 1);
    await expect(dialog.locator('[data-recent-tab]')).toHaveCount(before.length);
    // No close shortcut until one is recorded in settings.
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Delete');
    await expect(dialog.locator('[data-recent-tab]')).toHaveCount(before.length);
    expect((await stripState(worker, windowId)).map((tab) => tab.id)).toEqual(before.map((tab) => tab.id));
    expect(await activeId(worker, windowId)).toBe(current);
    await page.keyboard.up('Control');
    await expect.poll(() => activeId(worker, windowId)).toBe(before.find((tab) => tab.url.endsWith('/Previous'))!.id);
  });

  test('a click on a preview while Control is held switches to it, though a Mac makes that a right-click', async ({ context, worker, windowId }) => {
    const ids = await createRecentPages(context, worker, windowId);
    const page = await recentPage(context, 'F');
    await page.bringToFront();
    const commands = await worker.evaluate(() => chrome.commands.getAll());
    const cycle = commands.find((command) => command.name === 'cycle-recent-tabs')!.shortcut!;
    await page.keyboard.down('Control');
    await step(worker, ids[5]!, cycle);
    const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
    await dialog.getByRole('button', { name: 'Recent C', exact: true }).click({ modifiers: ['Control'] });
    await expect.poll(() => activeId(worker, windowId)).toBe(ids[2]);
    await expect(dialog).toHaveCount(0);
    await page.keyboard.up('Control');
  });
});

test.describe('both shortcuts removed', () => {
  test.use({ customCycle: false, clearedCycle: true, clearedReverse: true });

  test('removing both shortcuts turns the switcher off: Volet takes no previews, and Settings says how', async ({ context, worker, windowId }) => {
    const commands = await worker.evaluate(() => chrome.commands.getAll());
    expect(commands.filter((command) => command.name?.startsWith('cycle-recent-tabs')).map((command) => command.shortcut))
      .toEqual(['', '']);
    const ids = await createRecentPages(context, worker, windowId);
    await (await recentPage(context, 'F')).bringToFront();
    // With a shortcut assigned, a visited tab is captured about 600 ms after it shows: give it several chances.
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const result = await worker.evaluate((id) => chrome.scripting.executeScript({
      target: { tabId: id },
      func: async () => chrome.runtime.sendMessage({ type: 'recent-tabs:query' }),
    }), ids[5]!);
    const tabs = (result[0]?.result as { tabs?: { preview?: string }[] } | undefined)?.tabs ?? [];
    expect(tabs.length).toBeGreaterThan(0);
    expect(tabs.filter((tab) => tab.preview)).toEqual([]);
    const options = await context.newPage();
    await options.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
    await expect(options.getByText('Remove both shortcuts to turn the switcher off', { exact: false })).toBeVisible();
    await expect(options.getByRole('heading', { name: 'Recent tabs' })).toHaveCount(0);
    await expect(options.getByRole('button', { name: /tab switcher/ })).toHaveCount(0);
  });
});

test('a custom close chord recorded in settings only acts inside the preview, and clearing disables it', async ({ context, worker, windowId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
  const recorder = options.getByRole('button', { name: 'Set close highlighted tab shortcut' });
  await recorder.click();
  await recorder.press('Meta+Shift+K');
  await expect(recorder).toContainText('Cmd+Shift+K');
  const previous = await context.newPage();
  await previous.goto('https://recent-tabs.test/Previous');
  const page = await context.newPage();
  await page.goto('https://recent-tabs.test/Current');
  const current = (await stripState(worker, windowId)).find((tab) => tab.active)!.id;
  await page.keyboard.press('Meta+Shift+K');
  expect(await activeId(worker, windowId)).toBe(current);
  expect((await stripState(worker, windowId)).some((tab) => tab.url.endsWith('/Previous'))).toBe(true);
  await page.keyboard.down('Meta');
  await step(worker, current);
  const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
  await expect(dialog.getByRole('button', { name: 'Recent Previous', exact: true })).toBeVisible();
  await page.keyboard.press('K');
  await expect(dialog.getByRole('button', { name: 'Recent Previous', exact: true })).toBeVisible();
  await page.keyboard.press('Shift+K');
  await expect.poll(async () => (await stripState(worker, windowId)).some((tab) => tab.url.endsWith('/Previous'))).toBe(false);
  expect(await activeId(worker, windowId)).toBe(current);
  await page.keyboard.press('Escape');
  await page.keyboard.up('Meta');
  await options.bringToFront();
  await options.getByRole('button', { name: 'Clear close highlighted tab shortcut' }).click();
  await expect(recorder).toHaveText('Not set');
  await page.bringToFront();
  await page.keyboard.down('Meta');
  await step(worker, current);
  await expect(dialog).toBeVisible();
  const count = await dialog.locator('[data-recent-tab]').count();
  await page.keyboard.press('Shift+K');
  await expect(dialog.locator('[data-recent-tab]')).toHaveCount(count);
  expect(await activeId(worker, windowId)).toBe(current);
  await page.keyboard.press('Escape');
  await page.keyboard.up('Meta');
});

test('enabling from the settings tab finishes while a page is still loading, and the panel keeps working', async ({ context, worker, windowId, panel }) => {
  // A parser-blocking script that never arrives keeps this page loading, so it never becomes idle.
  await context.route('https://recent-tabs.test/never.js', () => undefined);
  await context.route('https://recent-tabs.test/Loading', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<title>Recent Loading</title><script src="https://recent-tabs.test/never.js"></script>',
  }));
  await (await context.newPage()).goto('https://recent-tabs.test/Loading', { waitUntil: 'commit' });
  await (await context.newPage()).goto('https://recent-tabs.test/Other');
  // Chrome opens Volet's settings in a tab, so the setup message comes from a sender with a tab.
  const options = await context.newPage();
  await options.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
  expect(await options.evaluate(() => chrome.runtime.sendMessage({ type: 'recent-tabs:setup' }))).toEqual({ ready: true });

  const other = (await stripState(worker, windowId)).find((tab) => tab.url.endsWith('/Other'))!.id;
  const activated = command(panel, { type: 'activateTab', tabId: other });
  await expect.poll(() => activeId(worker, windowId), { timeout: 5000 }).toBe(other);
  expect((await activated).ok).toBe(true);
});

test('with the Volet panel focused, the held modifier shows the previews, panel keys drive them, and release switches', async ({ context, worker, windowId, panel }) => {
  const ids = await createRecentPages(context, worker, windowId);
  const page = await recentPage(context, 'F');
  const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
  const selected = dialog.locator('[aria-current="true"]');
  // Only the panel sees the modifier, as after clicking a row in the sidebar: the page gets no key events.
  await panel.bringToFront();
  await panel.keyboard.down('Meta');
  await step(worker, ids[5]!);
  await expect(dialog.locator('[data-recent-tab]')).toHaveCount(5);
  await expect(selected).toHaveAttribute('aria-label', 'Recent E');
  await step(worker, ids[5]!);
  await expect(selected).toHaveAttribute('aria-label', 'Recent D');
  await panel.keyboard.press('ArrowRight');
  await expect(selected).toHaveAttribute('aria-label', 'Recent C');
  await panel.keyboard.press('ArrowLeft');
  await expect(selected).toHaveAttribute('aria-label', 'Recent D');
  expect(await activeId(worker, windowId)).toBe(ids[5]);
  await panel.keyboard.up('Meta');
  await expect.poll(() => activeId(worker, windowId)).toBe(ids[3]);
  await expect(dialog).toHaveCount(0);

  // Escape in the panel cancels, and a quick tap from the panel still goes straight back to the previous tab.
  const switched = (await recentPage(context, 'D')).getByRole('dialog', { name: 'Recent tabs' });
  await panel.keyboard.down('Meta');
  await step(worker, ids[3]!);
  await expect(switched.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent F');
  await panel.keyboard.press('Escape');
  await expect(switched).toHaveCount(0);
  await panel.keyboard.up('Meta');
  expect(await activeId(worker, windowId)).toBe(ids[3]);
  await panel.keyboard.press('Meta');
  await step(worker, ids[3]!);
  await expect.poll(() => activeId(worker, windowId)).toBe(ids[5]);
});

test('the switcher shows on a page that hides undefined custom elements, like reddit.com', async ({ context, worker, windowId }) => {
  // Sites built from web components hide elements not defined yet; content scripts can't define the switcher's host.
  await context.route('https://recent-tabs.test/Components', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<title>Recent Components</title><style>:not(:defined) { display: none !important; visibility: hidden !important; }</style><body>Components</body>',
  }));
  await (await context.newPage()).goto('https://recent-tabs.test/Previous');
  const page = await context.newPage();
  await page.goto('https://recent-tabs.test/Components');
  const current = (await stripState(worker, windowId)).find((tab) => tab.active)!.id;
  await page.keyboard.down('Meta');
  await step(worker, current);
  const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent Previous');
  await page.keyboard.press('Escape');
  await page.keyboard.up('Meta');
});

test('screenshots are kept in Chrome session storage, so they outlive the background worker', async ({ context, worker, windowId }) => {
  const ids = await createRecentPages(context, worker, windowId);
  const page = await recentPage(context, 'F');
  await page.bringToFront();
  // What the switcher asks for from F's page: recent tabs, each with its screenshot if one is kept. (Opening another
  // tab to ask would move F to the back before its screenshot is taken.)
  const previewed = async () => {
    const [result] = await worker.evaluate((id) => chrome.scripting.executeScript({
      target: { tabId: id },
      func: async () => chrome.runtime.sendMessage({ type: 'recent-tabs:query' }),
    }), ids[5]!);
    return ((result?.result as { tabs?: { title: string; preview?: string }[] } | undefined)?.tabs ?? [])
      .filter((tab) => tab.preview?.startsWith('data:image/jpeg;base64,')).map((tab) => tab.title);
  };
  await expect.poll(previewed, { timeout: 10_000 }).toContain('Recent F');
  // chrome.storage.session holds them, which Chrome keeps across worker restarts (it stops an idle worker after about
  // 30 seconds), and nothing else does: with those keys gone, the switcher has no screenshot left to show.
  const keys = await worker.evaluate(async () =>
    Object.keys(await chrome.storage.session.get(null)).filter((key) => key.startsWith('recentTabPreview')));
  expect(keys).toContain('recentTabPreviews');
  expect(keys).toContain(`recentTabPreview:${ids[5]}`);
  await worker.evaluate((stored) => chrome.storage.session.remove(stored), keys);
  expect(await previewed()).toEqual([]);
});

test('the switcher follows the system color scheme and takes the active Volet\'s color, like the panel', async ({ context, worker, windowId, panel }) => {
  // Give the window's Volet a color other than the switcher's default (268, the first Volet's).
  const spaceId = await worker.evaluate(async () => (await chrome.bookmarks.search({ title: 'Volet 1 (click to rename)' }))[0]!.id);
  expect((await command(panel, { type: 'setSpaceHue', spaceId, hue: 150 })).ok).toBe(true);
  const hueOf = (target: Locator) => target.evaluate((element) => (element as HTMLElement).style.getPropertyValue('--space-hue'));
  await expect.poll(() => hueOf(panel.locator('.sidebar'))).toBe('150');
  await (await context.newPage()).goto('https://recent-tabs.test/Previous');
  const page = await context.newPage();
  await page.goto('https://recent-tabs.test/Current');
  await page.emulateMedia({ colorScheme: 'dark' });
  const current = (await stripState(worker, windowId)).find((tab) => tab.active)!.id;
  await page.keyboard.down('Meta');
  await step(worker, current);
  const root = page.locator('.recent-tabs-root');
  await expect(root).toHaveAttribute('data-scheme', 'dark');
  await expect.poll(() => hueOf(root)).toBe('150');
  await page.emulateMedia({ colorScheme: 'light' });
  await expect(root).toHaveAttribute('data-scheme', 'light');
  await page.keyboard.press('Escape');
  await page.keyboard.up('Meta');
});

/** What the switcher on `tabId`'s page gets from the worker: its recent tabs, each with its screenshot if one is kept. */
async function queryFrom(worker: Worker, tabId: number) {
  const [result] = await worker.evaluate((id) => chrome.scripting.executeScript({
    target: { tabId: id },
    func: async () => chrome.runtime.sendMessage({ type: 'recent-tabs:query' }),
  }), tabId);
  return (result?.result as { tabs?: { id: number; url: string; preview?: string }[] } | undefined)?.tabs ?? [];
}

test('screenshots are kept small, and open pages get the page script once per session', async ({ context, worker, windowId }) => {
  await (await context.newPage()).goto('https://recent-tabs.test/Previous');
  await (await context.newPage()).goto('https://recent-tabs.test/Current');
  const current = (await stripState(worker, windowId)).find((tab) => tab.active)!.id;
  let preview: string | undefined;
  await expect.poll(async () => (preview = (await queryFrom(worker, current)).find((tab) => tab.id === current)?.preview),
    { timeout: 10_000 }).toMatch(/^data:image\/jpeg;base64,/);
  // Captured at the window's full size (1280 pixels here), kept 400 across: enough for a card, a few kilobytes each.
  const width = await worker.evaluate(async (image) => (await createImageBitmap(await (await fetch(image)).blob())).width, preview!);
  expect(width).toBe(400);
  expect(preview!.length).toBeLessThan(60_000);
  // A worker Chrome merely woke up again finds this set, and leaves the open pages alone.
  expect(await worker.evaluate(async () => (await chrome.storage.session.get('recentTabsAttached')).recentTabsAttached)).toBe(true);
});

test('a single-page app moving on gets a fresh screenshot of its new address', async ({ context, worker, windowId }) => {
  await (await context.newPage()).goto('https://recent-tabs.test/Previous');
  const page = await context.newPage();
  await page.goto('https://recent-tabs.test/App');
  const tabId = (await stripState(worker, windowId)).find((tab) => tab.active)!.id;
  const shown = async () => (await queryFrom(worker, tabId)).find((tab) => tab.id === tabId);
  await expect.poll(async () => Boolean((await shown())?.preview), { timeout: 10_000 }).toBe(true);
  // No full load: only the address changes, which drops the screenshot of the page it was.
  await page.evaluate(() => history.pushState(null, '', '/App/next'));
  await expect.poll(async () => {
    const tab = await shown();
    return Boolean(tab?.url.endsWith('/App/next') && tab.preview);
  }, { timeout: 10_000 }).toBe(true);
});

test.describe('with focus in a frame', () => {
  const frames = [
    { name: 'same-origin frame', html: '<iframe id="editor" src="https://recent-tabs.test/Inner"></iframe>' },
    { name: 'cross-origin frame', html: '<iframe id="editor" src="https://other-frame.test/Inner"></iframe>' },
    // Rich editors often type into a frame with no address of its own.
    {
      name: 'frame with no address',
      html: '<iframe id="editor"></iframe><script>document.getElementById("editor").contentDocument.body.innerHTML = "<textarea></textarea>"</script>',
    },
  ];
  for (const frame of frames) {
    test(`a ${frame.name} relays the held modifier and the switcher's keys to the page`, async ({ context, worker, windowId }) => {
      const inner = (route: { fulfill: (options: { contentType: string; body: string }) => Promise<void> }) =>
        route.fulfill({ contentType: 'text/html', body: '<title>Inner</title><textarea></textarea>' });
      await context.route('https://recent-tabs.test/Inner', inner);
      await context.route('https://other-frame.test/Inner', inner);
      await context.route('https://recent-tabs.test/Frames', (route) => route.fulfill({
        contentType: 'text/html', body: `<title>Recent Frames</title><body>${frame.html}</body>`,
      }));
      await (await context.newPage()).goto('https://recent-tabs.test/Older');
      await (await context.newPage()).goto('https://recent-tabs.test/Previous');
      const page = await context.newPage();
      await page.goto('https://recent-tabs.test/Frames');
      const current = (await stripState(worker, windowId)).find((tab) => tab.active)!.id;
      const older = (await stripState(worker, windowId)).find((tab) => tab.url.endsWith('/Older'))!.id;
      // Wait for the frame's own script before typing into it.
      await expect.poll(() => worker.evaluate(async (tabId) => (await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: () => window !== window.top && Boolean((window as { __voletRecentTabs?: unknown }).__voletRecentTabs),
      })).some((result) => result.result === true), current)).toBe(true);
      await page.frameLocator('#editor').locator('textarea').focus();
      await page.keyboard.down('Meta');
      await step(worker, current);
      const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
      const selected = dialog.locator('[aria-current="true"]');
      await expect(selected).toHaveAttribute('aria-label', 'Recent Previous');
      // The frame has the keys: they move the selection instead of reaching its text field.
      await page.keyboard.press('ArrowRight');
      await expect(selected).toHaveAttribute('aria-label', 'Recent Older');
      expect(await page.frameLocator('#editor').locator('textarea').inputValue()).toBe('');
      expect(await activeId(worker, windowId)).toBe(current);
      await page.keyboard.up('Meta');
      await expect.poll(() => activeId(worker, windowId)).toBe(older);
      await expect(dialog).toHaveCount(0);
    });
  }
});
