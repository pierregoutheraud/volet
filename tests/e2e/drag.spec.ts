import type { Locator, Page, Worker } from '@playwright/test';
import { bookmarkTree, command, expect, stripState, test } from './fixtures';

const visiblePage = (panel: Page) => panel.locator('section:not([inert])');

/** Drag with real pointer events, the way a person would (past dnd-kit's activation distance). */
/**
 * Waits for the panel to stop moving (pages sliding after a Volet switch, shutters opening and closing),
 * so a drag grabs and aims where things will stay. Endless animations (a loading tab's spinner) don't count.
 */
async function settled(panel: Page) {
  await panel.evaluate(() =>
    Promise.all(
      document
        .getAnimations()
        .filter((animation) => animation.effect?.getComputedTiming().endTime !== Infinity)
        .map((animation) => animation.finished.catch(() => {})),
    ).then(() => {}),
  );
}

async function drag(
  panel: Page,
  from: Locator,
  to: Locator,
  { offsetY = 0, beforeDrop }: { offsetY?: number; beforeDrop?: () => Promise<void> } = {},
) {
  await settled(panel);
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await panel.mouse.move(a.x + 30, a.y + a.height / 2);
  await panel.mouse.down();
  await panel.mouse.move(a.x + 30, a.y + a.height / 2 + 10, { steps: 4 });
  // Wide targets (rows) are aimed near their left edge, small ones (dots, tiles) at their center.
  await panel.mouse.move(b.x + (b.width > 80 ? 30 : b.width / 2), b.y + b.height / 2 + offsetY, { steps: 15 });
  await panel.waitForTimeout(150);
  await beforeDrop?.();
  await panel.mouse.up();
}

async function openTabs(worker: Worker, windowId: number, titles: string[]) {
  await worker.evaluate(
    async ({ id, titles }) => {
      for (const title of titles) await chrome.tabs.create({ windowId: id, url: `data:text/html,<title>${title}</title>` });
    },
    { id: windowId, titles },
  );
}

const row = (panel: Page, name: string) => visiblePage(panel).getByRole('button', { name, exact: true });

/** The row block (`SortableEntry`) holding the row named `name`. */
const block = (panel: Page, name: string) =>
  visiblePage(panel).locator('[data-entry]', { has: panel.getByRole('button', { name, exact: true }) });

test('reordering temporary tabs reorders them in Chrome', async ({ worker, windowId, panel }) => {
  await openTabs(worker, windowId, ['Alpha', 'Beta', 'Gamma']);
  await expect(row(panel, 'Gamma')).toBeVisible();
  const alphaTop = (await row(panel, 'Alpha').boundingBox())!.y;
  // The upper half of a row means "before it".
  await drag(panel, row(panel, 'Gamma'), row(panel, 'Alpha'), {
    offsetY: -8,
    beforeDrop: async () => {
      // Mid-drag, nothing moves: a line shows where the tab will go.
      await expect(block(panel, 'Alpha').locator('[data-drop-line="before"]')).toBeVisible();
      await expect(panel.locator('[data-drop-line]')).toHaveCount(1);
      expect((await row(panel, 'Alpha').boundingBox())!.y).toBe(alphaTop);
    },
  });
  await expect
    .poll(async () => (await stripState(worker, windowId)).map((tab) => tab.url.match(/<title>(\w+)/)?.[1]).filter(Boolean))
    .toEqual(['Gamma', 'Alpha', 'Beta']);
});

test('dragging a tab into the pinned area pins it, and back out unpins it', async ({ worker, windowId, panel }) => {
  await openTabs(worker, windowId, ['Keeper']);
  await expect(row(panel, 'Keeper')).toBeVisible();
  const hint = visiblePage(panel).getByText('Drag tabs here to pin them');
  let overlap: Promise<number> | undefined;
  await drag(panel, row(panel, 'Keeper'), hint, {
    beforeDrop: async () => {
      // The empty list lights up exactly where its dotted hint is.
      const lit = visiblePage(panel).locator('.bg-hover', { has: panel.getByText('Drag tabs here to pin them') });
      await expect(lit).toHaveCount(1);
      const [a, b] = [(await lit.boundingBox())!, (await hint.boundingBox())!];
      expect([a.x, a.y, a.width, a.height]).toEqual([b.x, b.y, b.width, b.height]);
      // Watch every frame of the drop: the hint and the dropped row never show together.
      overlap = panel.evaluate(
        () =>
          new Promise<number>((resolve) => {
            let frames = 0;
            const end = performance.now() + 500;
            const sample = () => {
              const page = document.querySelector('section:not([inert])');
              const hinted = [...(page?.querySelectorAll('p') ?? [])].some((p) => p.textContent?.includes('Drag tabs here'));
              if (hinted && page?.querySelector('[data-list^="pins:"]')) frames++;
              if (performance.now() < end) requestAnimationFrame(sample);
              else resolve(frames);
            };
            sample();
          }),
      );
    },
  });
  expect(await overlap).toBe(0);
  await expect
    .poll(async () => (await bookmarkTree(worker)).children!.find((c) => c.title === 'Volet 1 (click to rename)')!.children!.map((c) => c.title))
    .toEqual(['Keeper']);
  await expect(visiblePage(panel).getByRole('button', { name: 'Unpin' })).toBeAttached();

  // Back down below the divider: the pin goes, the tab stays.
  await drag(panel, row(panel, 'Keeper'), visiblePage(panel).getByRole('button', { name: 'New tab' }), { offsetY: -20 });
  await expect
    .poll(async () => (await bookmarkTree(worker)).children!.find((c) => c.title === 'Volet 1 (click to rename)')!.children!.length)
    .toBe(0);
  expect((await stripState(worker, windowId)).some((tab) => tab.url.includes('Keeper'))).toBe(true);
});

test('an empty unpinned list shows a drop line, and takes a pin dropped there', async ({ worker, windowId, panel }) => {
  await worker.evaluate(async (id) => {
    const [blank] = await chrome.tabs.query({ windowId: id });
    await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Keeper</title>' });
    await chrome.tabs.remove(blank!.id!);
  }, windowId);
  await expect(row(panel, 'Keeper')).toBeVisible();
  await drag(panel, row(panel, 'Keeper'), visiblePage(panel).getByText('Drag tabs here to pin them'));
  await expect(visiblePage(panel).getByRole('button', { name: 'Unpin' })).toBeAttached();
  await expect(visiblePage(panel).locator('[data-list^="temp:"]')).toHaveCount(0);

  // Just above "New tab": the line marks the top of the empty list.
  await drag(panel, row(panel, 'Keeper'), visiblePage(panel).getByRole('button', { name: 'New tab' }), {
    offsetY: -20,
    beforeDrop: async () => {
      await expect(panel.locator('[data-drop-line]')).toHaveCount(1);
      await expect(visiblePage(panel).locator('[data-drop-line]')).toBeVisible();
    },
  });
  await expect
    .poll(async () => (await bookmarkTree(worker)).children!.find((c) => c.title === 'Volet 1 (click to rename)')!.children!.length)
    .toBe(0);
  await expect(visiblePage(panel).locator('[data-list^="temp:"]')).toHaveCount(1);
});

test('a pin dropped below the last temporary tab becomes the last one', async ({ worker, windowId, panel }) => {
  await openTabs(worker, windowId, ['Keeper', 'Other']);
  await expect(row(panel, 'Other')).toBeVisible();
  await drag(panel, row(panel, 'Keeper'), visiblePage(panel).getByText('Drag tabs here to pin them'));
  await expect(visiblePage(panel).getByRole('button', { name: 'Unpin' })).toBeAttached();

  // Its tab still sits before "Other" in Chrome's tab strip: it has to move after it.
  await drag(panel, row(panel, 'Keeper'), row(panel, 'Other'), { offsetY: 8 });
  const titled = async () =>
    (await stripState(worker, windowId)).flatMap((tab) => {
      const title = tab.url.match(/<title>(\w+)/)?.[1];
      return title ? [{ title, group: tab.group }] : [];
    });
  await expect.poll(titled).toEqual([
    { title: 'Other', group: 'Volet 1 (click to rename)' },
    { title: 'Keeper', group: 'Volet 1 (click to rename)' },
  ]);
  await expect(visiblePage(panel).locator('[data-entry]')).toHaveCount(3);
});

test('dragging a tab to the favorites area makes it a favorite', async ({ worker, windowId, panel }) => {
  await openTabs(worker, windowId, ['Mail']);
  await worker.evaluate(async (id) => {
    // A first favorite so the grid has a visible target.
    const tab = await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Calendar</title>' });
    await chrome.tabs.update(tab.id!, { pinned: true });
  }, windowId);
  const grid = panel.getByRole('list', { name: 'Favorites' });
  await expect(grid.getByRole('button')).toHaveCount(1);
  await drag(panel, row(panel, 'Mail'), grid.getByRole('button').first());
  await expect(grid.getByRole('button')).toHaveCount(2);
  await expect
    .poll(async () => (await stripState(worker, windowId)).find((tab) => tab.url.includes('Mail'))?.pinned)
    .toBe(true);
});

test('dropping a tab on a Space dot moves it to that Space', async ({ worker, windowId, panel }) => {
  await panel.getByRole('button', { name: 'New Volet' }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 2');
  await panel.getByRole('button', { name: 'Volet 1 (click to rename)', exact: true }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 1 (click to rename)');
  await openTabs(worker, windowId, ['Traveler']);
  await expect(row(panel, 'Traveler')).toBeVisible();
  // Let the engine finish placing the new tab before dragging it.
  await expect
    .poll(async () => (await stripState(worker, windowId)).find((tab) => tab.url.includes('Traveler'))?.group)
    .toBe('Volet 1 (click to rename)');
  const dot = panel.getByRole('navigation', { name: 'Volets' }).getByRole('button', { name: 'Volet 2', exact: true });
  // Release only once the dot shows it's the drop target, as a person would.
  await drag(panel, row(panel, 'Traveler'), dot, { beforeDrop: () => expect(dot).toHaveClass(/scale-110/) });
  await expect
    .poll(async () => (await stripState(worker, windowId)).find((tab) => tab.url.includes('Traveler'))?.group)
    .toBe('Volet 2');
});

/** Pin data: URL tabs in the first Volet, in order, once their titles have loaded. */
async function pinned(worker: Worker, windowId: number, panel: Page, titles: string[]) {
  const homeId = await worker.evaluate(async () => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    return (await chrome.bookmarks.getChildren(root.rootId)).find((c) => c.title === 'Volet 1 (click to rename)')!.id;
  });
  for (const title of titles) {
    const tabId = await worker.evaluate(
      async ({ id, title }) => (await chrome.tabs.create({ windowId: id, url: `data:text/html,<title>${title}</title>` })).id!,
      { id: windowId, title },
    );
    await expect.poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).title, tabId)).toBe(title);
    await panel.evaluate((cmd) => chrome.runtime.sendMessage({ type: 'command', command: cmd }), {
      type: 'pinTab',
      windowId,
      tabId,
      parentId: homeId,
    });
  }
}

const homePins = async (worker: Worker) =>
  (await bookmarkTree(worker)).children!.find((c) => c.title === 'Volet 1 (click to rename)')!.children!.map((c) => c.title);

test('a tab can be dropped as the last pin', async ({ worker, windowId, panel }) => {
  await pinned(worker, windowId, panel, ['First', 'Second']);
  await openTabs(worker, windowId, ['Newcomer']);
  await expect(row(panel, 'Newcomer')).toBeVisible();
  // The lower half of the last pin means "after it".
  await drag(panel, row(panel, 'Newcomer'), row(panel, 'Second'), { offsetY: 10 });
  await expect.poll(() => homePins(worker)).toEqual(['First', 'Second', 'Newcomer']);
});

/** Whether `locator` lies inside its scrolling page's visible box (`toBeVisible` doesn't count clipping). */
const insidePage = (locator: Locator) =>
  locator.evaluate((node) => {
    const page = node.closest<HTMLElement>('[data-page-scroll]')!;
    const [box, frame] = [node.getBoundingClientRect(), page.getBoundingClientRect()];
    return box.top >= frame.top + page.clientTop && box.bottom <= frame.top + page.clientTop + page.clientHeight;
  });

test('a tab can be dropped as the first pin, and the line shows above it', async ({ worker, windowId, panel }) => {
  await pinned(worker, windowId, panel, ['First', 'Second']);
  await openTabs(worker, windowId, ['Newcomer']);
  await expect(row(panel, 'Newcomer')).toBeVisible();
  // The upper half of the first pin means "before it".
  await drag(panel, row(panel, 'Newcomer'), row(panel, 'First'), {
    offsetY: -8,
    beforeDrop: async () => {
      const line = block(panel, 'First').locator('[data-drop-line="before"]');
      await expect(line).toBeVisible();
      // It sits above the first row, at the top of the scrolling page: still on screen.
      expect(await insidePage(line)).toBe(true);
    },
  });
  await expect.poll(() => homePins(worker)).toEqual(['Newcomer', 'First', 'Second']);
});

test('dropping a tab on the middle of a folder puts it inside, and the folder lights up meanwhile', async ({
  worker,
  windowId,
  panel,
}) => {
  await pinned(worker, windowId, panel, ['Kept']);
  const home = await worker.evaluate(async () => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    return (await chrome.bookmarks.getChildren(root.rootId)).find((c) => c.title === 'Volet 1 (click to rename)')!.id;
  });
  await command(panel, { type: 'createFolder', parentId: home, index: 0, title: 'Docs' });
  await openTabs(worker, windowId, ['Stray']);
  await expect(row(panel, 'Stray')).toBeVisible();
  const folder = row(panel, 'Docs');
  await drag(panel, row(panel, 'Stray'), folder, {
    beforeDrop: async () => {
      await expect(folder).toHaveClass(/(^|\s)bg-hover(\s|$)/);
      await expect(panel.locator('[data-drop-line]')).toHaveCount(0);
    },
  });
  await expect
    .poll(async () => (await bookmarkTree(worker)).children!.find((c) => c.title === 'Volet 1 (click to rename)')!.children!.map((c) => [c.title, c.children?.map((d) => d.title)]))
    .toEqual([['Docs', ['Stray']], ['Kept', undefined]]);
  await expect(folder).not.toHaveClass(/(^|\s)bg-hover(\s|$)/);
});

test('a pin can be moved to the end of the pinned list', async ({ worker, windowId, panel }) => {
  await pinned(worker, windowId, panel, ['Alpha', 'Beta', 'Gamma']);
  await expect(row(panel, 'Gamma')).toBeVisible();
  await drag(panel, row(panel, 'Alpha'), row(panel, 'Gamma'), { offsetY: 10 });
  await expect.poll(() => homePins(worker)).toEqual(['Beta', 'Gamma', 'Alpha']);
});

test('the pin shortcut pins the current tab, and unpins it the second time', async ({ worker, windowId, panel }) => {
  // chrome.commands can't be pressed from a test; send what the shortcut sends.
  const tabId = await worker.evaluate(
    async (id) => (await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Toggled</title>' })).id!,
    windowId,
  );
  await expect.poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).title, tabId)).toBe('Toggled');
  const toggle = () =>
    panel.evaluate((cmd) => chrome.runtime.sendMessage({ type: 'command', command: cmd }), { type: 'togglePin', windowId, tabId });
  await toggle();
  await expect.poll(() => homePins(worker)).toEqual(['Toggled']);
  await toggle();
  await expect.poll(() => homePins(worker)).toEqual([]);
  expect((await stripState(worker, windowId)).find((tab) => tab.id === tabId)?.group).toBe('Volet 1 (click to rename)'); // still open
});

test('with no favorites, the area explains itself and accepts a dragged tab', async ({ worker, windowId, panel }) => {
  const hint = panel.getByText('Drag a tab here to make it a favorite');
  await expect(hint).toBeVisible();
  await openTabs(worker, windowId, ['First favorite']);
  await expect(row(panel, 'First favorite')).toBeVisible();
  await drag(panel, row(panel, 'First favorite'), hint);
  await expect(panel.getByRole('list', { name: 'Favorites' }).getByRole('button')).toHaveCount(1);
  await expect(hint).toHaveCount(0);
  await expect
    .poll(async () => (await stripState(worker, windowId)).find((tab) => tab.url.includes('First'))?.pinned)
    .toBe(true);
});

test('a pin added to the favorites leaves its Space', async ({ worker, windowId, panel }) => {
  await pinned(worker, windowId, panel, ['Moves up']);
  const pinRow = row(panel, 'Moves up');
  await pinRow.click({ button: 'right' });
  await panel.getByRole('menuitem', { name: 'Add to favorites' }).click();
  await expect(panel.getByRole('list', { name: 'Favorites' }).getByRole('button', { name: 'Moves up' })).toBeVisible();
  await expect(pinRow).toHaveCount(0);
  await expect.poll(() => homePins(worker)).toEqual([]);
  const favorites = (await bookmarkTree(worker)).children!.find((c) => c.title === 'Favorites')!.children!;
  expect(favorites.map((f) => f.title)).toEqual(['Moves up']);
  // Its tab went with it: now one of Chrome's pinned tabs.
  expect((await stripState(worker, windowId)).find((tab) => tab.url.includes('Moves up'))?.pinned).toBe(true);
});

test('a closed pin can be dragged to the favorites too', async ({ worker, windowId, panel }) => {
  await pinned(worker, windowId, panel, ['Closed pin']);
  const pinRow = visiblePage(panel).getByRole('listitem').filter({ has: panel.getByRole('button', { name: 'Closed pin', exact: true }) });
  await pinRow.hover();
  await pinRow.getByRole('button', { name: 'Close tab' }).click();
  await expect.poll(async () => (await stripState(worker, windowId)).some((tab) => tab.url.includes('Closed pin'))).toBe(false);
  await drag(panel, row(panel, 'Closed pin'), panel.getByText('Drag a tab here to make it a favorite'));
  await expect(panel.getByRole('list', { name: 'Favorites' }).getByRole('button', { name: 'Closed pin' })).toBeVisible();
  await expect.poll(() => homePins(worker)).toEqual([]);
});

test('holding a tab over a Space dot switches to it, so the tab can be placed there', async ({ worker, windowId, panel }) => {
  await panel.getByRole('button', { name: 'New Volet' }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 2');
  await panel.getByRole('navigation', { name: 'Volets' }).getByRole('button', { name: 'Volet 1 (click to rename)' }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 1 (click to rename)');
  await openTabs(worker, windowId, ['Mover']);
  const mover = row(panel, 'Mover');
  await expect(mover).toBeVisible();
  await expect
    .poll(async () => (await stripState(worker, windowId)).find((tab) => tab.url.includes('Mover'))?.group)
    .toBe('Volet 1 (click to rename)');

  // Grab the tab, hold it over Volet 2's dot until Volet 2 shows, then drop it on Volet 2's pinned area.
  const dot = panel.getByRole('navigation', { name: 'Volets' }).getByRole('button', { name: 'Volet 2' });
  await settled(panel);
  const a = (await mover.boundingBox())!;
  const d = (await dot.boundingBox())!;
  await panel.mouse.move(a.x + 30, a.y + a.height / 2);
  await panel.mouse.down();
  await panel.mouse.move(a.x + 30, a.y + a.height / 2 + 10, { steps: 4 });
  await panel.mouse.move(d.x + d.width / 2, d.y + d.height / 2, { steps: 15 });
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 2');
  // Mid-drag the shutters keep their shape (Volet 2's stays closed), so none moves under the pointer.
  await expect(dot).toHaveAttribute('aria-current', 'true');
  await expect(dot).not.toHaveAttribute('data-open');
  await panel.waitForTimeout(600); // the pages finish sliding
  const hint = visiblePage(panel).getByText('Drag tabs here to pin them to Volet 2');
  const h = (await hint.boundingBox())!;
  await panel.mouse.move(h.x + 40, h.y + h.height / 2, { steps: 15 });
  await panel.waitForTimeout(200);
  await panel.mouse.up();

  await expect
    .poll(async () => (await bookmarkTree(worker)).children!.find((c) => c.title === 'Volet 2')!.children!.map((c) => c.title))
    .toEqual(['Mover']);
  await expect(dot).toHaveAttribute('data-open', ''); // opened once the drag is over
  await expect
    .poll(async () => (await stripState(worker, windowId)).find((tab) => tab.url.includes('Mover'))?.group)
    .toBe('Volet 2');
});

test('dragging a Space dot reorders the Spaces', async ({ worker, panel }) => {
  await panel.getByRole('button', { name: 'New Volet' }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 2');
  const shutters = panel.getByRole('navigation', { name: 'Volets' });
  const dots = shutters.locator('li button');
  await expect(dots).toHaveCount(2);
  // The new Volet's shutter opens as the first one closes, and the centered row shifts while their widths animate:
  // measure them once they've settled.
  await expect.poll(() => shutters.evaluate((nav) => nav.getAnimations({ subtree: true }).length)).toBe(0);

  // Drag the second dot onto the left half of the first.
  const from = (await dots.nth(1).boundingBox())!;
  const to = (await dots.nth(0).boundingBox())!;
  await panel.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await panel.mouse.down();
  await panel.mouse.move(from.x + from.width / 2 - 6, from.y + from.height / 2, { steps: 3 });
  await panel.mouse.move(to.x + 4, to.y + to.height / 2, { steps: 8 });
  await panel.waitForTimeout(100);
  await panel.mouse.up();

  await expect(dots.nth(0)).toHaveAttribute('aria-label', 'Volet 2');
  await expect.poll(async () => (await bookmarkTree(worker)).children!.map((c) => c.title)).toEqual(['Favorites', 'Volet 2', 'Volet 1 (click to rename)']);
  // Still on the same Space.
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 2');
});
