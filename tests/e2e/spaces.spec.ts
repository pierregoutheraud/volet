import { bookmarkTree, command, expect, stripState, test } from './fixtures';

const visiblePage = (panel: import('@playwright/test').Page) => panel.locator('section:not([inert])');

test('first run creates the bookmark folders and adopts open tabs into the first Volet', async ({ worker, windowId, panel }) => {
  expect(await bookmarkTree(worker)).toEqual({
    title: 'Volet',
    children: [
      { title: 'Favorites', children: [] },
      { title: 'Volet 1 (right-click to rename)', children: [] },
    ],
  });
  await expect.poll(async () => (await stripState(worker, windowId)).every((tab) => tab.group === 'Volet 1 (right-click to rename)')).toBe(true);
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 1 (right-click to rename)');
});

test('tabs opened outside the sidebar join the active Space', async ({ worker, windowId, panel }) => {
  await worker.evaluate(async (id) => {
    await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>One</title>' });
    await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Two</title>' });
  }, windowId);
  await expect.poll(async () => (await stripState(worker, windowId)).map((tab) => tab.group)).toEqual([
    'Volet 1 (right-click to rename)',
    'Volet 1 (right-click to rename)',
    'Volet 1 (right-click to rename)',
  ]);
  const page = visiblePage(panel);
  await expect(page.getByRole('button', { name: 'One' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Two', exact: true })).toBeVisible();
  // The active tab is highlighted.
  await expect(page.getByRole('button', { name: 'Two', exact: true })).toHaveAttribute('aria-current', 'page');
});

test('a new Volet opens no tab: the page in front stays', async ({ worker, windowId, panel }) => {
  const before = await stripState(worker, windowId);
  await panel.getByRole('button', { name: 'New Volet' }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 2');
  await panel.waitForTimeout(300);
  const after = await stripState(worker, windowId);
  expect(after).toHaveLength(before.length);
  expect(after.find((tab) => tab.active)?.group).toBe('Volet 1 (right-click to rename)');
  await expect(visiblePage(panel).getByRole('button', { name: 'New tab', exact: true })).toBeVisible();
});

test('creating and switching Spaces collapses the other groups', async ({ worker, windowId, panel }) => {
  await panel.getByRole('button', { name: 'New Volet' }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 2');
  // A new Volet opens no tab: give it one.
  await visiblePage(panel).getByRole('button', { name: 'New tab', exact: true }).click();
  await expect
    .poll(async () => {
      const strip = await stripState(worker, windowId);
      return {
        home: strip.filter((tab) => tab.group === 'Volet 1 (right-click to rename)').every((tab) => tab.collapsed),
        second: strip.some((tab) => tab.group === 'Volet 2' && tab.active && !tab.collapsed),
      };
    })
    .toEqual({ home: true, second: true });

  await panel.getByRole('button', { name: 'Volet 1 (right-click to rename)', exact: true }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 1 (right-click to rename)');
  await expect
    .poll(async () => {
      const strip = await stripState(worker, windowId);
      return strip.find((tab) => tab.active)?.group;
    })
    .toBe('Volet 1 (right-click to rename)');
  expect((await stripState(worker, windowId)).filter((tab) => tab.group === 'Volet 2').every((t) => t.collapsed)).toBe(
    true,
  );
});

test('pins keep their entry when their tab closes, and reopen on click', async ({ worker, windowId, panel }) => {
  const tabId = await worker.evaluate(async (id) => {
    const tab = await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Docs</title>' });
    return tab.id!;
  }, windowId);
  const home = (await bookmarkTree(worker)).children!.find((c) => c.title === 'Volet 1 (right-click to rename)')!;
  expect(home).toBeTruthy();
  const homeId = await worker.evaluate(async () => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    const children = await chrome.bookmarks.getChildren(root.rootId);
    return children.find((c) => c.title === 'Volet 1 (right-click to rename)')!.id;
  });
  await expect.poll(async () => (await stripState(worker, windowId)).find((t) => t.id === tabId)?.group).toBe('Volet 1 (right-click to rename)');
  // A pin keeps the title its tab had when it was saved: wait for the page to load.
  await expect.poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).title, tabId)).toBe('Docs');
  const result = await command(panel, { type: 'pinTab', windowId, tabId, parentId: homeId });
  expect(result.ok).toBe(true);

  const page = visiblePage(panel);
  const pin = page.getByRole('button', { name: 'Docs', exact: true });
  await expect(pin).toBeVisible();
  const pinRow = page.getByRole('listitem').filter({ has: panel.getByRole('button', { name: 'Docs', exact: true }) });
  const row = pinRow.locator('[data-row]');
  await expect(row).toHaveAttribute('data-open'); // open: its dot shows
  await pinRow.getByRole('button', { name: 'Close tab' }).click();
  await expect.poll(async () => (await stripState(worker, windowId)).some((t) => t.id === tabId)).toBe(false);
  await expect(page.getByRole('button', { name: 'Docs', exact: true })).toHaveCount(1); // still listed, closed
  // Closed: no dot, and nothing faded (it isn't disabled).
  await expect(row).not.toHaveAttribute('data-open');
  const look = () =>
    pin.evaluate((button) => ({
      title: getComputedStyle(button.querySelector('.truncate')!).color,
      icon: getComputedStyle(button.firstElementChild!).opacity,
    }));
  const closed = await look();
  expect(closed.icon).toBe('1');

  await pin.click();
  await expect
    .poll(async () => (await stripState(worker, windowId)).find((t) => t.active)?.url)
    .toContain('<title>Docs</title>');
  await expect(pinRow.getByRole('button', { name: 'Close tab' })).toBeAttached();
  await expect(row).toHaveAttribute('data-open');
  expect((await look()).title).toBe(closed.title); // same ink, open or closed
});

test('pinning a tab natively in Chrome makes it a favorite', async ({ worker, windowId, panel }) => {
  await worker.evaluate(async (id) => {
    const tab = await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Mail</title>' });
    await chrome.tabs.update(tab.id!, { pinned: true });
  }, windowId);
  await expect
    .poll(async () => (await bookmarkTree(worker)).children!.find((c) => c.title === 'Favorites')!.children!.length)
    .toBe(1);
  await expect(panel.getByRole('list', { name: 'Favorites' }).getByRole('button')).toHaveCount(1);
});

test('closing a temporary tab from the sidebar closes it in Chrome', async ({ worker, windowId, panel }) => {
  await worker.evaluate(async (id) => {
    await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Temp</title>' });
  }, windowId);
  const page = visiblePage(panel);
  const row = page.getByRole('button', { name: 'Temp', exact: true });
  await expect(row).toBeVisible();
  await row.hover();
  // `has` is resolved inside each list item, so it must not be anchored to the page section.
  const item = page.getByRole('listitem').filter({ has: panel.getByRole('button', { name: 'Temp', exact: true }) });
  await item.getByRole('button', { name: 'Close tab' }).click();
  await expect(row).toHaveCount(0);
  await expect.poll(async () => (await stripState(worker, windowId)).some((t) => t.url.includes('Temp'))).toBe(false);
});

/** Close a temporary tab with its row's close button, like the user does. */
async function closeRow(panel: import('@playwright/test').Page, name: string) {
  const page = visiblePage(panel);
  await page.getByRole('button', { name, exact: true }).hover();
  const item = page.getByRole('listitem').filter({ has: panel.getByRole('button', { name, exact: true }) });
  await item.getByRole('button', { name: 'Close tab' }).click();
}

test("closing a Volet's last tab shows a favorite and leaves the Volet empty", async ({ worker, windowId, panel }) => {
  // One favorite, and one temporary tab in the first Volet: the active one.
  await worker.evaluate(async (id) => {
    const others = await chrome.tabs.query({ windowId: id });
    await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Mail</title>', pinned: true });
    await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Last</title>' });
    await chrome.tabs.remove(others.map((tab) => tab.id!));
  }, windowId);
  await expect(panel.getByRole('list', { name: 'Favorites' }).getByRole('button')).toHaveCount(1);
  await expect(visiblePage(panel).getByRole('button', { name: 'Last', exact: true })).toBeVisible();

  await closeRow(panel, 'Last');
  await expect
    .poll(async () => (await stripState(worker, windowId)).map((tab) => ({ pinned: tab.pinned, active: tab.active })))
    .toEqual([{ pinned: true, active: true }]);
  // No tab took its place, and the sidebar stays on the first Volet.
  await panel.waitForTimeout(300);
  expect(await stripState(worker, windowId)).toHaveLength(1);
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 1 (right-click to rename)');
});

test('a lone New Tab page closes instead of coming back', async ({ worker, windowId, panel }) => {
  // A new Volet with one New Tab page, opened from the sidebar; no favorite is open.
  await panel.getByRole('button', { name: 'New Volet' }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 2');
  await visiblePage(panel).getByRole('button', { name: 'New tab', exact: true }).click();
  await expect
    .poll(async () => (await stripState(worker, windowId)).filter((tab) => tab.group === 'Volet 2').length)
    .toBe(1);
  const before = (await stripState(worker, windowId)).length;

  await closeRow(panel, 'New Tab');
  await expect
    .poll(async () => (await stripState(worker, windowId)).some((tab) => tab.group === 'Volet 2'))
    .toBe(false);
  await panel.waitForTimeout(300);
  expect(await stripState(worker, windowId)).toHaveLength(before - 1);
});

test('a new tab from the sidebar stops showing as loading', async ({ panel }) => {
  // Chrome's tabs.query can still say "loading" right after the "complete" event; the panel must not get stuck.
  const page = visiblePage(panel);
  await page.getByRole('button', { name: 'New tab', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New Tab', exact: true })).toBeVisible();
  await expect(page.getByRole('status', { name: 'Loading' })).toHaveCount(0);
});

test('the unpin button turns a pin into a temporary tab in one click', async ({ worker, windowId, panel }) => {
  const tabId = await worker.evaluate(
    async (id) => (await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Draft</title>' })).id!,
    windowId,
  );
  await expect.poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).title, tabId)).toBe('Draft');
  const homeId = await worker.evaluate(async () => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    return (await chrome.bookmarks.getChildren(root.rootId)).find((c) => c.title === 'Volet 1 (right-click to rename)')!.id;
  });
  await command(panel, { type: 'pinTab', windowId, tabId, parentId: homeId });

  const page = visiblePage(panel);
  const pinRow = page.getByRole('listitem').filter({ has: panel.getByRole('button', { name: 'Draft', exact: true }) });
  await pinRow.hover();
  await pinRow.getByRole('button', { name: 'Unpin' }).click();
  await expect.poll(async () => (await bookmarkTree(worker)).children!.find((c) => c.title === 'Volet 1 (right-click to rename)')!.children).toEqual([]);
  // Still open, now below the divider.
  await expect(page.getByRole('button', { name: 'Draft', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Unpin' })).toHaveCount(0);
  expect((await stripState(worker, windowId)).some((tab) => tab.id === tabId)).toBe(true);
});

test('a pin that moved to another page offers a way back', async ({ worker, windowId, panel }) => {
  // Two of the extension's own pages: Chrome doesn't let extensions navigate tabs to data: URLs.
  const origin = `chrome-extension://${new URL(worker.url()).host}`;
  const tabId = await worker.evaluate(async ({ id, url }) => (await chrome.tabs.create({ windowId: id, url })).id!, {
    id: windowId,
    url: `${origin}/options.html`,
  });
  await expect.poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).title, tabId)).toBe('Volet settings');
  const homeId = await worker.evaluate(async () => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    return (await chrome.bookmarks.getChildren(root.rootId)).find((c) => c.title === 'Volet 1 (right-click to rename)')!.id;
  });
  await command(panel, { type: 'pinTab', windowId, tabId, parentId: homeId });

  const page = visiblePage(panel);
  await expect(page.getByRole('button', { name: 'Volet settings', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Back to the pinned page' })).toHaveCount(0); // not moved yet
  await worker.evaluate(async ({ id, url }) => chrome.tabs.update(id, { url }), { id: tabId, url: `${origin}/import.html` });
  const row = page.getByRole('listitem').filter({ has: panel.getByRole('button', { name: 'Import from Arc' }) });
  await expect(row).toContainText('/');
  await row.hover();
  await row.getByRole('button', { name: 'Back to the pinned page' }).click();
  await expect.poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).title, tabId)).toBe('Volet settings');
  await expect(page.getByRole('button', { name: 'Back to the pinned page' })).toHaveCount(0);
});

test("rows show the icon Chrome shows on the tab", async ({ worker, windowId, panel }) => {
  // A page with its own favicon (a 1px PNG), which Chrome's favicon cache doesn't know yet.
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
  await worker.evaluate(
    async ({ id, url }) => chrome.tabs.create({ windowId: id, url }),
    { id: windowId, url: `data:text/html,<title>Iconic</title><link rel="icon" href="${png}">` },
  );
  await expect
    .poll(() => worker.evaluate(async () => (await chrome.tabs.query({})).find((t) => t.title === 'Iconic')?.favIconUrl))
    .toBe(png);
  const row = visiblePage(panel).getByRole('button', { name: 'Iconic', exact: true });
  await expect(row.locator('img')).toHaveAttribute('src', png);
});

/** Adds empty Volets (folders under the root) until there are `total`, named "Extra 2", "Extra 3"... */
function fillVolets(worker: import('@playwright/test').Worker, total: number) {
  return worker.evaluate(async (count) => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string; favoritesId: string } };
    const existing = (await chrome.bookmarks.getChildren(root.rootId)).filter((n) => !n.url && n.id !== root.favoritesId);
    for (let i = existing.length; i < count; i++) await chrome.bookmarks.create({ parentId: root.rootId, title: `Extra ${i + 1}` });
  }, total);
}

test('every tab group made in Chrome becomes a Volet, however many there are', async ({ worker, windowId, panel }) => {
  await fillVolets(worker, 8);
  const dots = panel.getByRole('navigation', { name: 'Volets' }).locator('li button');
  await expect(dots).toHaveCount(8);
  await worker.evaluate(async (id) => {
    const tab = await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Grouped</title>', active: false });
    await chrome.tabs.group({ tabIds: [tab.id!], createProperties: { windowId: id } });
  }, windowId);
  await expect
    .poll(async () => (await stripState(worker, windowId)).find((tab) => tab.url.includes('Grouped'))?.group)
    .toBe('Volet 9');
  await expect(dots).toHaveCount(9);

  await panel.getByRole('button', { name: 'New Volet' }).click();
  await expect(dots).toHaveCount(10);
  expect((await bookmarkTree(worker)).children).toHaveLength(11); // Favorites and ten Volets
});

test('when the Volet shutters stop fitting they narrow, then scroll, keeping the open one in view', async ({
  worker,
  windowId,
  panel,
}) => {
  await panel.setViewportSize({ width: 360, height: 800 }); // a side panel's width (pages default to 1280)
  await fillVolets(worker, 20);
  const strip = panel.getByRole('navigation', { name: 'Volets' }).getByRole('list');
  const dots = strip.locator('li button');
  await expect(dots).toHaveCount(20);
  // The active Volet's shutter is open (wider, showing its name); the closed ones narrowed as far as they go,
  // and the row scrolls, its far edge faded.
  const width = (index: number) => dots.nth(index).evaluate((el) => Math.round(el.getBoundingClientRect().width));
  await expect(dots.first()).toHaveAttribute('aria-current', 'true');
  await expect(dots.first()).toHaveAttribute('data-open', '');
  expect(await width(1)).toBe(20);
  expect(await width(0)).toBeGreaterThan(40);
  expect(await strip.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  await expect(strip).toHaveAttribute('data-hidden-end', '');
  await expect(strip).not.toHaveAttribute('data-hidden-start');

  // Switching to the last Volet (here from the worker, as the palette or a shortcut would) brings its dot into view.
  const lastId = await worker.evaluate(async () => (await chrome.bookmarks.search({ title: 'Extra 20' }))[0]!.id);
  await command(panel, { type: 'switchSpace', windowId, spaceId: lastId });
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Extra 20');
  const shown = (name: string) =>
    strip.getByRole('button', { name, exact: true }).evaluate((el) => {
      const row = el.closest('ul')!.getBoundingClientRect();
      const dot = el.getBoundingClientRect();
      return dot.left >= row.left && dot.right <= row.right;
    });
  await expect.poll(() => shown('Extra 20')).toBe(true);
  await expect(strip).toHaveAttribute('data-hidden-start', '');

  // A sideways swipe over the dots scrolls them instead of switching Volet.
  await strip.hover();
  await panel.mouse.wheel(-2000, 0);
  await expect.poll(() => strip.evaluate((el) => el.scrollLeft)).toBe(0);
  await expect.poll(() => shown('Volet 1 (right-click to rename)')).toBe(true);
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Extra 20');
});

test('a renamed pin keeps its name when its tab moves to another page, and still offers a way back', async ({
  worker,
  windowId,
  panel,
}) => {
  const origin = `chrome-extension://${new URL(worker.url()).host}`;
  const tabId = await worker.evaluate(async ({ id, url }) => (await chrome.tabs.create({ windowId: id, url })).id!, {
    id: windowId,
    url: `${origin}/options.html`,
  });
  await expect.poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).title, tabId)).toBe('Volet settings');
  const homeId = await worker.evaluate(async () => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    return (await chrome.bookmarks.getChildren(root.rootId)).find((c) => c.title === 'Volet 1 (right-click to rename)')!.id;
  });
  const pinId = (await command(panel, { type: 'pinTab', windowId, tabId, parentId: homeId })).value as string;
  await command(panel, { type: 'renameBookmark', id: pinId, title: 'A' });

  const page = visiblePage(panel);
  const pin = page.getByRole('button', { name: 'A', exact: true });
  await expect(pin).toBeVisible();
  await worker.evaluate(async ({ id, url }) => chrome.tabs.update(id, { url }), { id: tabId, url: `${origin}/import.html` });
  await expect.poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).title, tabId)).toBe('Import from Arc');

  // The name stays exactly as given: no page title, no "/".
  const row = page.getByRole('listitem').filter({ has: panel.getByRole('button', { name: 'A', exact: true }) });
  await expect(row.getByRole('button', { name: 'Back to the pinned page' })).toBeAttached();
  await expect(pin).toHaveText('A');
  await expect(page.getByRole('button', { name: 'Import from Arc' })).toHaveCount(0);
  await row.hover();
  await row.getByRole('button', { name: 'Back to the pinned page' }).click();
  await expect.poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).title, tabId)).toBe('Volet settings');
  await expect(pin).toHaveText('A');
});

test("a pin's title never changes on load once someone renamed it, in Volet or in Chrome's bookmarks", async ({
  worker,
  windowId,
  panel,
}) => {
  // One of the extension's own pages: its address doesn't contain its title, unlike a data: URL.
  const url = `chrome-extension://${new URL(worker.url()).host}/options.html`;
  const tabId = await worker.evaluate(async ({ id, url }) => (await chrome.tabs.create({ windowId: id, url })).id!, {
    id: windowId,
    url,
  });
  await expect.poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).title, tabId)).toBe('Volet settings');
  const homeId = await worker.evaluate(async () => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    return (await chrome.bookmarks.getChildren(root.rootId)).find((c) => c.title === 'Volet 1 (right-click to rename)')!.id;
  });
  await command(panel, { type: 'pinTab', windowId, tabId, parentId: homeId });
  const pinId = await worker.evaluate(async (url) => (await chrome.bookmarks.search({ url }))[0]!.id, url);
  const pinTitle = () => worker.evaluate(async (id) => (await chrome.bookmarks.get(id))[0]!.title, pinId);
  const reloadAndWait = async () => {
    await worker.evaluate(async (id) => chrome.tabs.reload(id), tabId);
    await expect.poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).status, tabId)).toBe('complete');
    await panel.waitForTimeout(300); // time for the engine to react to the load
  };

  // Renamed in Chrome's bookmark manager: the page doesn't take it back.
  await worker.evaluate(async (id) => chrome.bookmarks.update(id, { title: 'Settings (manager)' }), pinId);
  await reloadAndWait();
  expect(await pinTitle()).toBe('Settings (manager)');

  // Renamed in Volet: the same.
  await command(panel, { type: 'renameBookmark', id: pinId, title: 'My settings' });
  await reloadAndWait();
  expect(await pinTitle()).toBe('My settings');
  await expect(visiblePage(panel).getByRole('button', { name: 'My settings', exact: true })).toBeVisible();
});

test("the bookmark folder keeps the extension's name", async ({ worker }) => {
  // As an install from before the rename (or a rename in the bookmark manager) would have it.
  const rootId = await worker.evaluate(async () => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    await chrome.bookmarks.update(root.rootId, { title: 'Spaces' });
    return root.rootId;
  });
  await expect.poll(() => worker.evaluate(async (id) => (await chrome.bookmarks.get(id))[0]!.title, rootId)).toBe('Volet');
});

test('removing every Volet folder in Chrome\'s bookmarks leaves a fresh first Volet', async ({ worker, windowId, panel }) => {
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 1 (right-click to rename)');
  // No tab group left to turn back into a Volet, then every Volet folder removed (Favorites stays).
  await worker.evaluate(async (id) => {
    const tabs = await chrome.tabs.query({ windowId: id });
    await chrome.tabs.ungroup(tabs.map((tab) => tab.id!) as [number, ...number[]]);
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string; favoritesId: string } };
    for (const child of await chrome.bookmarks.getChildren(root.rootId)) {
      if (child.id !== root.favoritesId) await chrome.bookmarks.removeTree(child.id);
    }
  }, windowId);

  // As on a first run: one empty Volet, holding the open tabs, and everything works again.
  await expect
    .poll(() => bookmarkTree(worker))
    .toEqual({
      title: 'Volet',
      children: [
        { title: 'Favorites', children: [] },
        { title: 'Volet 1 (right-click to rename)', children: [] },
      ],
    });
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 1 (right-click to rename)');
  await expect.poll(async () => (await stripState(worker, windowId)).every((tab) => tab.group === 'Volet 1 (right-click to rename)')).toBe(true);
  expect(await command(panel, { type: 'newTab', windowId })).toMatchObject({ ok: true });
  await expect.poll(async () => (await stripState(worker, windowId)).length).toBe(2);
});

test('a new active tab at the end of a long list scrolls into view; one opened in the background does not', async ({
  worker,
  windowId,
  panel,
}) => {
  await panel.setViewportSize({ width: 360, height: 500 });
  await worker.evaluate(async (id) => {
    for (let i = 1; i <= 25; i++) {
      await chrome.tabs.create({ windowId: id, url: `data:text/html,<title>Tab ${i}</title>`, active: false });
    }
  }, windowId);
  const list = visiblePage(panel).locator('[data-page-scroll]');
  await expect(list.getByRole('button', { name: 'Tab 25', exact: true })).toBeAttached();
  await list.evaluate((element) => element.scrollTo({ top: 0 }));
  const open = (title: string, active: boolean) =>
    worker.evaluate(
      async ({ id, title, active }) => {
        await chrome.tabs.create({ windowId: id, url: `data:text/html,<title>${title}</title>`, active });
      },
      { id: windowId, title, active },
    );
  const shown = (title: string) =>
    list.getByRole('button', { name: title, exact: true }).evaluate((element) => {
      const row = element.getBoundingClientRect();
      const view = element.closest('[data-page-scroll]')!.getBoundingClientRect();
      return row.top >= view.top && row.bottom <= view.bottom;
    });

  // Opened in the background (like a Cmd+click): the list stays put.
  await open('Background', false);
  await expect(list.getByRole('button', { name: 'Background', exact: true })).toBeAttached();
  await panel.waitForTimeout(300);
  expect(await list.evaluate((element) => element.scrollTop)).toBe(0);

  // A new tab in front (like Cmd+T): the list glides down to it.
  await open('Newest', true);
  await expect.poll(() => shown('Newest')).toBe(true);
});

test('"Clear" shows whenever there are tabs to clear, beside the line', async ({ worker, windowId, panel }) => {
  const scratchId = await worker.evaluate(async (id) => {
    await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Background</title>', active: false });
    return (await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Scratch</title>' })).id!;
  }, windowId);
  const page = visiblePage(panel);
  await expect(page.getByRole('button', { name: 'Scratch', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Background', exact: true })).toBeVisible();
  const clear = page.getByRole('button', { name: 'Clear', exact: true });
  // Shown without hovering anything, and the line stops before it.
  await panel.mouse.move(0, 0);
  await expect(clear).toBeVisible();
  expect(await clear.evaluate((el) => getComputedStyle(el).opacity)).toBe('1');
  const overlap = await clear.evaluate((el) => {
    const line = el.parentElement!.querySelector(':scope > span')!; // the divider's line
    return line.getBoundingClientRect().right - el.getBoundingClientRect().left;
  });
  expect(overlap).toBeLessThanOrEqual(0);

  // Every unpinned tab closes but the active one, which stays in front.
  await clear.click();
  await expect(page.getByRole('button', { name: 'Background', exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Scratch', exact: true })).toBeVisible();
  await expect
    .poll(async () => (await stripState(worker, windowId)).map((tab) => ({ id: tab.id, active: tab.active })))
    .toEqual([{ id: scratchId, active: true }]);
  // Only the active tab is left, and it never clears: no button.
  await expect(clear).toHaveCount(0);

  // Nothing left to clear (only a favorite is open): no button.
  await worker.evaluate(async (id) => {
    const others = await chrome.tabs.query({ windowId: id });
    await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Mail</title>', pinned: true });
    await chrome.tabs.remove(others.map((tab) => tab.id!));
  }, windowId);
  await expect(panel.getByRole('list', { name: 'Favorites' }).getByRole('button')).toHaveCount(1);
  await expect(clear).toHaveCount(0);
});

test("a favorite whose tab moved can take the current page as its own", async ({ worker, windowId, panel }) => {
  const origin = `chrome-extension://${new URL(worker.url()).host}`;
  const tabId = await worker.evaluate(
    async ({ id, url }) => (await chrome.tabs.create({ windowId: id, url, pinned: true })).id!,
    { id: windowId, url: `${origin}/options.html` },
  );
  const tile = panel.getByRole('list', { name: 'Favorites' }).getByRole('button');
  await expect(tile).toHaveCount(1);
  const favorite = () =>
    worker.evaluate(async () => {
      const { root } = (await chrome.storage.local.get('root')) as { root: { favoritesId: string } };
      const [node] = await chrome.bookmarks.getChildren(root.favoritesId);
      return { url: node!.url, title: node!.title };
    });
  const replace = panel.getByRole('menuitem', { name: 'Favorite this page instead' });

  // On its own page: nothing to replace.
  await tile.click({ button: 'right' });
  await expect(panel.getByRole('menuitem', { name: 'Remove from favorites' })).toBeVisible();
  await expect(replace).toHaveCount(0);
  await panel.keyboard.press('Escape');

  await worker.evaluate(async ({ id, url }) => chrome.tabs.update(id, { url }), { id: tabId, url: `${origin}/import.html` });
  await expect
    .poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).status, tabId))
    .toBe('complete');
  await tile.click({ button: 'right' });
  await replace.click();
  await expect.poll(favorite).toEqual({ url: `${origin}/import.html`, title: 'Import from Arc' });

  await tile.click({ button: 'right' });
  await expect(panel.getByRole('menuitem', { name: 'Remove from favorites' })).toBeVisible();
  await expect(replace).toHaveCount(0);
});

test("switching to a Volet with no open tab doesn't open one: the page in front stays", async ({
  worker,
  windowId,
  panel,
}) => {
  const origin = `chrome-extension://${new URL(worker.url()).host}`;
  // A second Volet with a pin and no open tab (like one just brought in from Arc).
  await worker.evaluate(async (url) => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    const space = await chrome.bookmarks.create({ parentId: root.rootId, title: 'Reading' });
    await chrome.bookmarks.create({ parentId: space.id, title: 'Settings', url });
  }, `${origin}/options.html`);
  const before = await stripState(worker, windowId);
  const front = before.find((tab) => tab.active)!;

  await panel.getByRole('navigation', { name: 'Volets' }).getByRole('button', { name: 'Reading', exact: true }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Reading');
  // Something that makes the engine tidy the window: a tab opened in the background joins Reading.
  await worker.evaluate(async (id) => {
    await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Later</title>', active: false });
  }, windowId);
  await expect
    .poll(async () => (await stripState(worker, windowId)).find((tab) => tab.url.includes('Later'))?.group)
    .toBe('Reading');
  const after = await stripState(worker, windowId);
  expect(after).toHaveLength(before.length + 1); // no new tab besides that one
  expect(after.find((tab) => tab.active)?.id).toBe(front.id); // the same page in front
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Reading'); // and the sidebar stays

  // Opening its pin shows it in Reading, and the first Volet folds away in the tab strip.
  await visiblePage(panel).getByRole('button', { name: 'Settings', exact: true }).click();
  await expect.poll(async () => (await stripState(worker, windowId)).find((tab) => tab.active)?.group).toBe('Reading');
  await expect
    .poll(async () =>
      (await stripState(worker, windowId)).filter((tab) => tab.group === 'Volet 1 (right-click to rename)').every((tab) => tab.collapsed),
    )
    .toBe(true);
});

test('the Volet title stays at the top while its pins and tabs scroll under it', async ({ worker, windowId, panel }) => {
  await panel.setViewportSize({ width: 360, height: 500 });
  await worker.evaluate(async (id) => {
    for (let i = 1; i <= 25; i++) {
      await chrome.tabs.create({ windowId: id, url: `data:text/html,<title>Tab ${i}</title>`, active: false });
    }
  }, windowId);
  const page = visiblePage(panel);
  const list = page.locator('[data-page-scroll]');
  const title = page.getByRole('heading');
  await expect(list.getByRole('button', { name: 'Tab 25', exact: true })).toBeAttached();
  await list.evaluate((element) => element.scrollTo({ top: 0 }));
  const top = (await title.boundingBox())!.y;
  await expect(list).not.toHaveAttribute('data-scrolled');

  await list.evaluate((element) => element.scrollTo({ top: element.scrollHeight }));
  await expect(list).toHaveAttribute('data-scrolled', '');
  expect((await title.boundingBox())!.y).toBe(top); // it didn't move
  await expect(title).toBeInViewport();
});

test('a line sets the Volet switcher apart only while the list above it scrolls', async ({ worker, windowId, panel }) => {
  await panel.setViewportSize({ width: 360, height: 500 });
  const list = visiblePage(panel).locator('[data-page-scroll]');
  await expect(list.getByRole('button', { name: 'New tab' })).toBeVisible();
  await expect(list).not.toHaveAttribute('data-overflows');

  const ids = await worker.evaluate(async (id) => {
    const tabs = [];
    for (let i = 1; i <= 25; i++) {
      tabs.push(await chrome.tabs.create({ windowId: id, url: `data:text/html,<title>Tab ${i}</title>`, active: false }));
    }
    return tabs.map((tab) => tab.id!);
  }, windowId);
  await expect(list.getByRole('button', { name: 'Tab 25', exact: true })).toBeAttached();
  await expect(list).toHaveAttribute('data-overflows', '');

  await worker.evaluate((tabIds) => chrome.tabs.remove(tabIds), ids);
  await expect(list.getByRole('button', { name: 'Tab 25', exact: true })).not.toBeAttached();
  await expect(list).not.toHaveAttribute('data-overflows');
});
