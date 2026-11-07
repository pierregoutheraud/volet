import { cp, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium, type BrowserContext, type Page, type Worker } from '@playwright/test';
import { extensionPath, expect, stripState, test as base } from './fixtures';

// Pregrant website access in an isolated copy of the production extension. Chrome's native permission
// prompt cannot be accepted by Playwright. All switcher code still runs unchanged in real Chromium.
const test = base.extend<{ customPrevious: boolean; configuredNext: boolean }>({
  customPrevious: [false, { option: true }],
  configuredNext: [true, { option: true }],
  context: async ({ customPrevious, configuredNext }, use) => {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'volet-recent-tabs-'));
    const extension = path.join(directory, 'extension');
    await cp(extensionPath, extension, { recursive: true });
    const manifestPath = path.join(extension, 'manifest.json');
    const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
    manifest.host_permissions = ['<all_urls>'];
    if (configuredNext) {
      // Assign a shortcut only inside this fixture; production starts with both directions unbound.
      manifest.commands['cycle-recent-tabs'].suggested_key = { default: 'Alt+Q', mac: 'Command+E' };
    }
    if (customPrevious) {
      // Model a user-assigned backward binding. The fixture removes an unrelated suggested default
      // to stay within Chrome's four-default limit; the production manifest keeps all existing defaults.
      delete manifest.commands['toggle-pin'].suggested_key;
      manifest.commands['cycle-recent-tabs-previous'].suggested_key = {
        default: 'Ctrl+Shift+Y', mac: 'Command+Shift+Y',
      };
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
  const ids: number[] = [];
  for (const name of ['A', 'B', 'C', 'D', 'E', 'F']) {
    const tabId = await worker.evaluate(async ({ windowId, name }) => {
      const tab = await chrome.tabs.create({ windowId, url: `https://recent-tabs.test/${name}`, active: true });
      return tab.id!;
    }, { windowId, name });
    ids.push(tabId);
    await expect(await recentPage(context, name)).toHaveTitle(`Recent ${name}`);
  }
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
  // require a real keyboard and are not dispatched by Playwright's page keyboard API.
  await worker.evaluate(async ({ tabId, shortcut, offset }) => {
    await chrome.tabs.sendMessage(tabId, { type: 'recent-tabs:step', shortcut, offset });
  }, { tabId, shortcut, offset });
}

async function activeId(worker: Worker, windowId: number) {
  return (await stripState(worker, windowId)).find((tab) => tab.active)?.id;
}

async function recentPage(context: BrowserContext, name: string): Promise<Page> {
  await expect.poll(() => context.pages().some((page) => page.url() === `https://recent-tabs.test/${name}`)).toBe(true);
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
  await expect(dialog.locator('.recent-tab')).toHaveCount(5);
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

test('an assigned forward shortcut never supplies an unassigned backward shortcut', async ({ context, worker, windowId }) => {
  const commands = await worker.evaluate(() => chrome.commands.getAll());
  expect(commands.find((command) => command.name === 'cycle-recent-tabs')?.shortcut).not.toBe('');
  expect(commands.find((command) => command.name === 'cycle-recent-tabs-previous')?.shortcut).toBe('');
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
  await expect(dialog.locator('.recent-tab-screenshot').first()).toBeVisible();
  await page.screenshot({ path: testInfo.outputPath('recent-tabs.png') });
  await page.keyboard.press('Escape');
  await page.keyboard.up('Meta');
});

test('Cmd+Shift+E starts on the previous tab, reverses subsequent steps, and supports changing direction', async ({ context, worker, windowId }) => {
  const ids = await createRecentPages(context, worker, windowId);
  const page = await recentPage(context, 'F');
  await page.bringToFront();
  await page.keyboard.down('Meta');
  await page.keyboard.down('Shift');
  await step(worker, ids[5]!, '⌘⇧E', -1);
  const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
  await expect(dialog).toBeVisible();
  await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent E');
  await expect(dialog.getByText('Release the shortcut modifier', { exact: false })).toHaveCount(0);
  await step(worker, ids[5]!, '⌘⇧E', -1);
  await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent F');
  await page.keyboard.up('Shift');
  expect(await activeId(worker, windowId)).toBe(ids[5]);
  // Changing direction returns to the previous tab in the same frozen order.
  await step(worker, ids[5]!);
  await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent E');
  await page.keyboard.up('Meta');
  await expect.poll(() => activeId(worker, windowId)).toBe(ids[4]);
  await expect(dialog).toHaveCount(0);
});

test('quick Cmd+Shift+E taps toggle the same two recent tabs as Cmd+E', async ({ context, worker, windowId }) => {
  const ids = await createRecentPages(context, worker, windowId);
  let currentId = ids[5]!;
  for (const expectedId of [ids[4]!, ids[5]!]) {
    const page = await recentPage(context, currentId === ids[5] ? 'F' : 'E');
    await page.bringToFront();
    await page.keyboard.down('Meta');
    await page.keyboard.down('Shift');
    await step(worker, currentId, '⌘⇧E', -1);
    await page.keyboard.up('Shift');
    await page.keyboard.up('Meta');
    await expect.poll(() => activeId(worker, windowId)).toBe(expectedId);
    await expect(page.getByRole('dialog', { name: 'Recent tabs' })).toHaveCount(0);
    currentId = expectedId;
  }
  // Switching the direction on the next gesture keeps the same toggle pair.
  await step(worker, currentId);
  await expect.poll(() => activeId(worker, windowId)).toBe(ids[4]);
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
  await expect(card.locator('.recent-tab-placeholder')).toBeVisible();
  await expect(card.locator('.recent-tab-screenshot')).toHaveCount(0);
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
  await expect(dialog.locator('.recent-tab')).toHaveCount(4);
  await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent D');
  // Delete is a different key and has no implicit close binding.
  await page.keyboard.press('Delete');
  await expect(dialog.locator('.recent-tab')).toHaveCount(4);
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
  await expect.poll(findNewTab).not.toBeUndefined();
  const newTabId = (await findNewTab())!;
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
  const icons = dialog.locator('.recent-tab-caption img');
  await expect(icons).toHaveCount(2);
  await expect.poll(() => icons.evaluateAll((images) => images.every((image) =>
    image instanceof HTMLImageElement && image.complete && image.naturalWidth > 0))).toBe(true);
  expect(errors).toEqual([]);
  await page.keyboard.press('Escape');
  await page.keyboard.up('Meta');
});

test.describe('independent backward shortcut', () => {
  test.use({ customPrevious: true });

  test('a custom backward binding reverses the same frozen list without an implicit Shift binding', async ({ context, worker, windowId }) => {
    const ids = await createRecentPages(context, worker, windowId);
    const commands = await worker.evaluate(() => chrome.commands.getAll());
    const next = commands.find((command) => command.name === 'cycle-recent-tabs')!.shortcut!;
    const previous = commands.find((command) => command.name === 'cycle-recent-tabs-previous')!.shortcut!;
    expect(previous).not.toBe('');
    expect(previous).not.toBe(next);
    const page = await recentPage(context, 'F');
    await page.bringToFront();
    const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
    await page.keyboard.down(modifier);
    await page.keyboard.down('Shift');
    // Shift+forward never hijacks the page; only the assigned native backward command can step.
    await page.keyboard.press(process.platform === 'darwin' ? 'E' : 'Q');
    const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
    await expect(dialog).toHaveCount(0);
    await step(worker, ids[5]!, previous, -1);
    await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent E');
    await step(worker, ids[5]!, previous, -1);
    await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent F');
    await step(worker, ids[5]!, previous, -1);
    await expect(dialog.locator('[aria-current="true"]')).toHaveAttribute('aria-label', 'Recent B');
    await page.keyboard.up('Shift');
    expect(await activeId(worker, windowId)).toBe(ids[5]);
    await page.keyboard.up(modifier);
    await expect.poll(() => activeId(worker, windowId)).toBe(ids[1]);
  });

  test('late backward commands toggle consistently across directions and with only two or one tabs', async ({ context, worker, windowId }) => {
    const ids = await createRecentPages(context, worker, windowId);
    const commands = await worker.evaluate(() => chrome.commands.getAll());
    const next = commands.find((command) => command.name === 'cycle-recent-tabs')!.shortcut!;
    const previous = commands.find((command) => command.name === 'cycle-recent-tabs-previous')!.shortcut!;
    const gestures: { shortcut: string; offset: 1 | -1 }[] = [
      { shortcut: previous, offset: -1 }, { shortcut: previous, offset: -1 },
      { shortcut: next, offset: 1 }, { shortcut: previous, offset: -1 },
    ];
    let currentId = ids[5]!;
    for (const gesture of gestures) {
      const page = await recentPage(context, currentId === ids[5] ? 'F' : 'E');
      const modifier = process.platform === 'darwin' ? 'Meta' : 'Control';
      await page.keyboard.down(modifier);
      await page.keyboard.up(modifier);
      // Deliver the browser command after release, before the async tab query completes.
      await step(worker, currentId, gesture.shortcut, gesture.offset);
      const expectedId = currentId === ids[5] ? ids[4]! : ids[5]!;
      await expect.poll(() => activeId(worker, windowId)).toBe(expectedId);
      currentId = expectedId;
    }
    await worker.evaluate(async ({ windowId, keep }) => {
      const tabs = await chrome.tabs.query({ windowId });
      await chrome.tabs.remove(tabs.filter((tab) => tab.id !== undefined && !keep.includes(tab.id)).map((tab) => tab.id!));
    }, { windowId, keep: [ids[4]!, ids[5]!] });
    await expect.poll(async () => (await stripState(worker, windowId)).length).toBe(2);
    await step(worker, ids[5]!, previous, -1);
    await expect.poll(() => activeId(worker, windowId)).toBe(ids[4]);
    await step(worker, ids[4]!, previous, -1);
    await expect.poll(() => activeId(worker, windowId)).toBe(ids[5]);
    await worker.evaluate((id) => chrome.tabs.remove(id), ids[4]!);
    await expect.poll(async () => (await stripState(worker, windowId)).length).toBe(1);
    await step(worker, ids[5]!, previous, -1);
    expect(await activeId(worker, windowId)).toBe(ids[5]);
    await expect.poll(async () => (await stripState(worker, windowId)).length).toBe(1);
  });
});

test.describe('unassigned preview shortcuts', () => {
  test.use({ configuredNext: false });

  test('fresh installs have no cycling defaults, Shift fallback or implicit close key', async ({ context, worker, windowId }) => {
    const commands = await worker.evaluate(() => chrome.commands.getAll());
    for (const name of ['cycle-recent-tabs', 'cycle-recent-tabs-previous']) {
      expect(commands.find((command) => command.name === name)?.shortcut).toBe('');
    }
    const previous = await context.newPage();
    await previous.goto('https://recent-tabs.test/Previous');
    const page = await context.newPage();
    await page.goto('https://recent-tabs.test/Current');
    const current = (await stripState(worker, windowId)).find((tab) => tab.active)!.id;
    await page.keyboard.press('Meta+E');
    await page.keyboard.press('Meta+Shift+E');
    const dialog = page.getByRole('dialog', { name: 'Recent tabs' });
    await expect(dialog).toHaveCount(0);
    expect(await activeId(worker, windowId)).toBe(current);
    // The command message opens the UI for this assertion without assigning any close shortcut.
    const before = (await stripState(worker, windowId)).map((tab) => tab.id);
    await page.keyboard.down('Meta');
    await step(worker, current);
    await expect(dialog.locator('.recent-tab')).toHaveCount(before.length);
    await page.keyboard.press('Backspace');
    await page.keyboard.press('Delete');
    await expect(dialog.locator('.recent-tab')).toHaveCount(before.length);
    expect((await stripState(worker, windowId)).map((tab) => tab.id)).toEqual(before);
    await page.keyboard.press('Escape');
    await page.keyboard.up('Meta');
  });
});

test('a custom close chord recorded in settings only acts inside the preview, and clearing disables it', async ({ context, worker, windowId }) => {
  const options = await context.newPage();
  await options.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
  const recorder = options.getByRole('button', { name: 'Set close highlighted tab shortcut' });
  await recorder.click();
  await recorder.press('Meta+Shift+K');
  await expect(recorder).toHaveText('Cmd+Shift+K');
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
  const count = await dialog.locator('.recent-tab').count();
  await page.keyboard.press('Shift+K');
  await expect(dialog.locator('.recent-tab')).toHaveCount(count);
  expect(await activeId(worker, windowId)).toBe(current);
  await page.keyboard.press('Escape');
  await page.keyboard.up('Meta');
});
