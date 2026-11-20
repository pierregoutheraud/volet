import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { chromium } from '@playwright/test';
import { command, expect, extensionPath, stripState, test } from './fixtures';

test('each window shows its own Space', async ({ context, worker, windowId, panel }) => {
  await panel.getByRole('button', { name: 'New Volet' }).click();
  await expect(panel.locator('section:not([inert])').getByRole('heading')).toHaveText('Volet 2');

  // A second window, with its own panel, stays on the first Volet.
  const secondWindow = await worker.evaluate(async () => {
    const window = await chrome.windows.create({ url: 'data:text/html,<title>Second</title>' });
    return window!.id!;
  });
  const opened = context.waitForEvent('page', (page) => page.url().includes(`windowId=${secondWindow}`));
  await worker.evaluate(async (id) => {
    await chrome.windows.create({ url: `sidepanel.html?windowId=${id}`, type: 'popup', width: 360, height: 700 });
  }, secondWindow);
  const secondPanel = await opened;

  await expect(secondPanel.locator('section:not([inert])').getByRole('heading')).toHaveText(/Volet 1|Volet 2/);
  await expect
    .poll(async () => (await stripState(worker, secondWindow)).every((tab) => tab.group !== null))
    .toBe(true);
  await secondPanel.getByRole('navigation', { name: 'Volets' }).getByRole('button', { name: 'Volet 1 (right-click to rename)' }).click();
  await expect(secondPanel.locator('section:not([inert])').getByRole('heading')).toHaveText('Volet 1 (right-click to rename)');

  // Switching the second window doesn't move the first one.
  await expect(panel.locator('section:not([inert])').getByRole('heading')).toHaveText('Volet 2');
  const active = await worker.evaluate(async () => (await chrome.storage.session.get('activeSpaces')).activeSpaces);
  expect(Object.keys(active as object)).toEqual(expect.arrayContaining([String(windowId), String(secondWindow)]));
});

test.describe('after a browser restart', () => {
  test('restored tabs find their pins and Spaces again', async () => {
    test.setTimeout(90_000);
    const profile = await mkdtemp(path.join(os.tmpdir(), 'spaces-restart-'));

    // First session: pin a tab.
    let context = await launch(profile);
    let worker = await serviceWorker(context);
    const windowId = await worker.evaluate(async () => (await chrome.windows.getAll({ windowTypes: ['normal'] }))[0]!.id!);
    const tabId = await worker.evaluate(
      async (id) => (await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Survivor</title>' })).id!,
      windowId,
    );
    await expect.poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).title, tabId)).toBe('Survivor');
    await expect.poll(async () => (await stripState(worker, windowId)).find((t) => t.id === tabId)?.group).toBe('Volet 1 (right-click to rename)');
    const panel = await openPanel(context, worker, windowId);
    const homeId = await worker.evaluate(async () => {
      const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
      return (await chrome.bookmarks.getChildren(root.rootId)).find((c) => c.title === 'Volet 1 (right-click to rename)')!.id;
    });
    await command(panel, { type: 'pinTab', windowId, tabId, parentId: homeId });
    await panel.close();
    await context.close();

    // "Continue where you left off", then start Chrome again on the same profile.
    const prefsPath = path.join(profile, 'Default', 'Preferences');
    const prefs = JSON.parse(await readFile(prefsPath, 'utf8'));
    await writeFile(prefsPath, JSON.stringify({ ...prefs, session: { ...prefs.session, restore_on_startup: 1 } }));
    context = await launch(profile, true);
    worker = await serviceWorker(context);

    // Restored tabs have new ids: the engine re-attaches them by URL and group title.
    await expect
      .poll(
        () =>
          worker.evaluate(async () => {
            const [tab] = (await chrome.tabs.query({})).filter((t) => t.title === 'Survivor');
            if (!tab) return 'not restored yet';
            const { bindings = {} } = (await chrome.storage.session.get('bindings')) as {
              bindings?: Record<string, { kind: string }>;
            };
            const group = tab.groupId > -1 ? (await chrome.tabGroups.get(tab.groupId)).title : undefined;
            return `${bindings[tab.id!]?.kind} in ${group}`;
          }),
        { timeout: 20_000 },
      )
      .toBe('pin in Volet 1 (right-click to rename)');
    await context.close();
  });

  test("a pin's or favorite's tab that left its page finds it again, without a new favorite", async () => {
    test.setTimeout(90_000);
    const profile = await mkdtemp(path.join(os.tmpdir(), 'spaces-restart-'));

    // First session: a pin and a favorite, each with its tab moved on to another page.
    let context = await launch(profile);
    let worker = await serviceWorker(context);
    // The extension's own pages: Chrome doesn't let extensions navigate tabs to data: URLs.
    const origin = `chrome-extension://${new URL(worker.url()).host}`;
    const home = (who: string) => `${origin}/options.html?for=${who}`;
    const away = (who: string) => `${origin}/import.html?for=${who}`;
    const windowId = await worker.evaluate(async () => (await chrome.windows.getAll({ windowTypes: ['normal'] }))[0]!.id!);
    const urlOf = (id: number) => worker.evaluate(async (tabId) => (await chrome.tabs.get(tabId)).url, id);
    const open = (url: string, pinned = false) =>
      worker.evaluate(async ({ id, url, pinned }) => (await chrome.tabs.create({ windowId: id, url, pinned })).id!, {
        id: windowId,
        url,
        pinned,
      });
    const goTo = (id: number, url: string) => worker.evaluate(({ id, url }) => chrome.tabs.update(id, { url }), { id, url });
    const favorites = () =>
      worker.evaluate(async () => {
        const { root } = (await chrome.storage.local.get('root')) as { root: { favoritesId: string } };
        return (await chrome.bookmarks.getChildren(root.favoritesId)).map((c) => c.url);
      });

    const pinTab = await open(home('pin'));
    await expect.poll(() => urlOf(pinTab)).toBe(home('pin'));
    await expect.poll(async () => (await stripState(worker, windowId)).find((t) => t.id === pinTab)?.group).toBe('Volet 1 (right-click to rename)');
    const panel = await openPanel(context, worker, windowId);
    const homeId = await worker.evaluate(async () => {
      const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
      return (await chrome.bookmarks.getChildren(root.rootId)).find((c) => c.title === 'Volet 1 (right-click to rename)')!.id;
    });
    await command(panel, { type: 'pinTab', windowId, tabId: pinTab, parentId: homeId });
    await goTo(pinTab, away('pin'));
    await expect.poll(() => urlOf(pinTab)).toBe(away('pin'));

    // A tab pinned in Chrome becomes a favorite.
    const favoriteTab = await open(home('favorite'), true);
    await expect.poll(favorites).toEqual([home('favorite')]);
    await goTo(favoriteTab, away('favorite'));
    await expect.poll(() => urlOf(favoriteTab)).toBe(away('favorite'));
    await expect
      .poll(() => worker.evaluate(async () => Object.values((await chrome.storage.local.get('lastPages')).lastPages ?? {}).sort()))
      .toEqual([away('favorite'), away('pin')]);
    await panel.close();
    await context.close();

    const prefsPath = path.join(profile, 'Default', 'Preferences');
    const prefs = JSON.parse(await readFile(prefsPath, 'utf8'));
    await writeFile(prefsPath, JSON.stringify({ ...prefs, session: { ...prefs.session, restore_on_startup: 1 } }));
    context = await launch(profile, true);
    worker = await serviceWorker(context);

    // Each restored tab is its pin's or favorite's again, though neither is on its own page.
    await expect
      .poll(
        () =>
          worker.evaluate(async (urls) => {
            const { bindings = {} } = (await chrome.storage.session.get('bindings')) as {
              bindings?: Record<string, { kind: string }>;
            };
            const tabs = await chrome.tabs.query({});
            return urls.map((url) => {
              const tab = tabs.find((t) => t.url === url);
              return tab ? (bindings[tab.id!]?.kind ?? 'none') : 'not restored yet';
            });
          }, [away('pin'), away('favorite')]),
        { timeout: 20_000 },
      )
      .toEqual(['pin', 'favorite']);
    expect(await favorites()).toEqual([home('favorite')]);
    await context.close();
  });
});

async function launch(profile: string, restore = false) {
  return chromium.launchPersistentContext(profile, {
    channel: 'chromium',
    headless: !process.env.HEADED,
    args: [
      `--disable-extensions-except=${extensionPath}`,
      `--load-extension=${extensionPath}`,
      ...(restore ? ['--restore-last-session'] : []),
    ],
  });
}

async function serviceWorker(context: import('@playwright/test').BrowserContext) {
  const worker = context.serviceWorkers()[0] ?? (await context.waitForEvent('serviceworker'));
  await expect.poll(() => worker.evaluate(async () => Boolean((await chrome.storage.local.get('root')).root))).toBe(true);
  return worker;
}

async function openPanel(context: import('@playwright/test').BrowserContext, worker: import('@playwright/test').Worker, windowId: number) {
  const opened = context.waitForEvent('page', (page) => page.url().includes('sidepanel.html'));
  await worker.evaluate(async (id) => {
    await chrome.windows.create({ url: `sidepanel.html?windowId=${id}`, type: 'popup', width: 360, height: 700 });
  }, windowId);
  const panel = await opened;
  await panel.waitForLoadState();
  return panel;
}
