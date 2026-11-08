import type { Page, Worker } from '@playwright/test';
import { bookmarkTree, command, expect, stripState, test } from './fixtures';

const visiblePage = (panel: Page) => panel.locator('section:not([inert])');
const menuItem = (panel: Page, name: string) => panel.getByRole('menuitem', { name, exact: true });

test('renaming a Space renames its bookmark folder and tab group', async ({ worker, windowId, panel }) => {
  // One click on the name starts renaming.
  await visiblePage(panel).getByRole('heading').click();
  const field = panel.getByRole('textbox', { name: 'Volet name' });
  await field.fill('Studio');
  await field.press('Enter');
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Studio');
  await expect.poll(async () => (await bookmarkTree(worker)).children!.map((c) => c.title)).toEqual(['Favorites', 'Studio']);
  await expect.poll(async () => (await stripState(worker, windowId))[0]?.group).toBe('Studio');
});

test('"Rename Volet" in a dot menu focuses the name field, also for another Volet', async ({ worker, panel }) => {
  await panel.getByRole('button', { name: 'New Volet' }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 2');
  const dots = panel.getByRole('navigation', { name: 'Volets' });
  const field = panel.getByRole('textbox', { name: 'Volet name' });

  // The active Volet's dot: typing replaces the name right away.
  await dots.getByRole('button', { name: 'Volet 2' }).click({ button: 'right' });
  await menuItem(panel, 'Rename Volet').click();
  await expect(field).toBeFocused();
  await panel.keyboard.type('Studio');
  await panel.keyboard.press('Enter');
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Studio');

  // Another Volet's dot: its page comes into view with the field focused.
  await dots.getByRole('button', { name: 'Volet 1 (click to rename)', exact: true }).click({ button: 'right' });
  await menuItem(panel, 'Rename Volet').click();
  await expect(field).toBeFocused();
  await panel.keyboard.type('Base');
  await panel.keyboard.press('Enter');
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Base');
  await expect.poll(async () => (await bookmarkTree(worker)).children!.map((c) => c.title)).toEqual(['Favorites', 'Base', 'Studio']);
});

test('the Space menu recolors the Space and its tab group', async ({ worker, windowId, panel }) => {
  await visiblePage(panel).getByRole('heading').click({ button: 'right' });
  await panel.getByRole('menuitem', { name: 'Hue 152' }).click();
  await expect
    .poll(() => worker.evaluate(async () => (await chrome.storage.sync.get('spaceMeta')).spaceMeta))
    .toEqual({ 'Volet 1 (click to rename)': { hue: 152 } });
  await expect
    .poll(() =>
      worker.evaluate(async (id) => (await chrome.tabGroups.query({ windowId: id }))[0]?.color, windowId),
    )
    .toBe('green');
  expect((await stripState(worker, windowId)).length).toBeGreaterThan(0);
});

const spaceMeta = (worker: Worker) =>
  worker.evaluate(async () => (await chrome.storage.sync.get('spaceMeta')).spaceMeta as Record<string, { hue: number }>);
const panelHue = (panel: Page) =>
  panel.locator('.sidebar').evaluate((node) => getComputedStyle(node).getPropertyValue('--space-hue'));

test('the Space menu slider picks any hue: shown while it moves, saved once let go', async ({ worker, windowId, panel }) => {
  await visiblePage(panel).getByRole('heading').click({ button: 'right' });
  const slider = panel.getByRole('slider', { name: 'Custom color' });

  // While it moves, the panel shows the hue (without its glide) but nothing is saved yet.
  await slider.evaluate((input: HTMLInputElement) => {
    input.value = '123';
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await expect.poll(() => panelHue(panel)).toBe('123');
  await expect(panel.locator('.sidebar')).toHaveAttribute('data-tint-live');
  expect((await spaceMeta(worker))?.['Volet 1 (click to rename)']?.hue).not.toBe(123);

  // Let go: saved, with the closest tab group color, and the menu stays open to fine-tune.
  await slider.evaluate((input) => input.dispatchEvent(new Event('change', { bubbles: true })));
  await expect.poll(() => spaceMeta(worker)).toEqual({ 'Volet 1 (click to rename)': { hue: 123 } });
  await expect
    .poll(() => worker.evaluate(async (id) => (await chrome.tabGroups.query({ windowId: id }))[0]?.color, windowId))
    .toBe('green');
  await expect(panel.locator('.sidebar')).not.toHaveAttribute('data-tint-live');
  expect(await panelHue(panel)).toBe('123');
  await expect(slider).toBeVisible();
});

test('the Space menu slider works from the keyboard', async ({ worker, panel }) => {
  await visiblePage(panel).getByRole('heading').click({ button: 'right' });
  const slider = panel.getByRole('slider', { name: 'Custom color' });
  const start = Number(await slider.inputValue());

  // Down from the last swatch reaches the slider; Left and Right change the hue, saved after a pause.
  await panel.getByRole('menuitem', { name: 'Hue 205' }).focus();
  await panel.keyboard.press('ArrowDown');
  await expect(slider).toBeFocused();
  for (let step = 0; step < 3; step++) await panel.keyboard.press('ArrowRight');
  await expect(slider).toHaveValue(String(start + 3));
  await expect.poll(() => spaceMeta(worker)).toEqual({ 'Volet 1 (click to rename)': { hue: start + 3 } });

  // Up goes back to the swatches.
  await panel.keyboard.press('ArrowUp');
  await expect(panel.getByRole('menuitem', { name: 'Hue 205' })).toBeFocused();
});

test('deleting a Space asks first, then closes its tabs', async ({ worker, windowId, panel }) => {
  await panel.getByRole('button', { name: 'New Volet' }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 2');
  await visiblePage(panel).getByRole('heading').click({ button: 'right' });
  await menuItem(panel, 'Delete Volet').click();
  await expect(panel.getByRole('alertdialog')).toContainText('Delete “Volet 2”?');
  await panel.getByRole('button', { name: 'Delete Volet' }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 1 (click to rename)');
  await expect.poll(async () => (await bookmarkTree(worker)).children!.map((c) => c.title)).toEqual(['Favorites', 'Volet 1 (click to rename)']);
  await expect.poll(async () => (await stripState(worker, windowId)).every((tab) => tab.group === 'Volet 1 (click to rename)')).toBe(true);
});

test('pins can be renamed and folders created from menus', async ({ worker, windowId, panel }) => {
  const tabId = await worker.evaluate(
    async (id) => (await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Report</title>' })).id!,
    windowId,
  );
  await expect.poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).title, tabId)).toBe('Report');
  const homeId = await worker.evaluate(async () => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    return (await chrome.bookmarks.getChildren(root.rootId)).find((c) => c.title === 'Volet 1 (click to rename)')!.id;
  });
  await command(panel, { type: 'pinTab', windowId, tabId, parentId: homeId });

  await visiblePage(panel).getByRole('button', { name: 'Report', exact: true }).click({ button: 'right' });
  await menuItem(panel, 'Rename').click();
  const field = panel.getByRole('textbox', { name: 'Pin name' });
  await field.fill('Weekly report');
  await field.press('Enter');
  await visiblePage(panel).getByRole('heading').click({ button: 'right' });
  await menuItem(panel, 'New folder').click();
  // The new folder opens for renaming, ready to type.
  const folderName = panel.getByRole('textbox', { name: 'Folder name' });
  await expect(folderName).toBeFocused();
  await folderName.press('Enter');

  await expect
    .poll(async () => (await bookmarkTree(worker)).children!.find((c) => c.title === 'Volet 1 (click to rename)')!.children!.map((c) => c.title))
    .toEqual(['New folder', 'Weekly report']);
  // Exactly: until its row's button takes over as the drag handle, dnd-kit makes the folder's wrapper a button too.
  await expect(visiblePage(panel).getByRole('button', { name: 'New folder', exact: true })).toBeVisible();
});

test('"New folder" on a folder adds one at the top of the Space; on a tab, puts the tab in it', async ({
  worker,
  windowId,
  panel,
}) => {
  const home = await worker.evaluate(async () => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    return (await chrome.bookmarks.getChildren(root.rootId)).find((c) => c.title === 'Volet 1 (click to rename)')!.id;
  });
  await command(panel, { type: 'createFolder', parentId: home, index: 0, title: 'Docs' });
  await worker.evaluate((id) => chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Loose</title>' }), windowId);
  const homeOutline = async () =>
    (await bookmarkTree(worker)).children!.find((c) => c.title === 'Volet 1 (click to rename)')!.children!.map((c) => [c.title, c.children?.length]);

  // Each new folder opens for renaming right away: typing names it.
  const folderName = panel.getByRole('textbox', { name: 'Folder name' });
  await visiblePage(panel).getByRole('button', { name: 'Docs', exact: true }).click({ button: 'right' });
  await menuItem(panel, 'New folder').click();
  await expect(folderName).toBeFocused();
  await panel.keyboard.type('Inbox');
  await panel.keyboard.press('Enter');
  await expect.poll(homeOutline).toEqual([['Inbox', 0], ['Docs', 0]]);

  // A tab goes into its new folder, pinned, and the folder lands after the pins (where the tab was).
  await visiblePage(panel).getByRole('button', { name: 'Loose', exact: true }).click({ button: 'right' });
  await menuItem(panel, 'New folder').click();
  await expect(folderName).toBeFocused();
  await panel.keyboard.press('Escape');
  await expect.poll(homeOutline).toEqual([['Inbox', 0], ['Docs', 0], ['New folder', 1]]);
  const space = (await bookmarkTree(worker)).children!.find((c) => c.title === 'Volet 1 (click to rename)')!;
  expect(space.children!.at(-1)!.children!.map((c) => c.title)).toEqual(['Loose']);
  // The tab stays open, now as the folder's pin.
  await expect(visiblePage(panel).getByRole('button', { name: 'Unpin', exact: true })).toHaveCount(1);
});

test('a row keeps its hover look while its menu is open', async ({ worker, panel }) => {
  const home = await worker.evaluate(async () => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    return (await chrome.bookmarks.getChildren(root.rootId)).find((c) => c.title === 'Volet 1 (click to rename)')!.id;
  });
  await command(panel, { type: 'createFolder', parentId: home, index: 0, title: 'Docs' });
  const folder = visiblePage(panel).getByRole('button', { name: 'Docs', exact: true });
  const background = () => folder.evaluate((node) => getComputedStyle(node).backgroundColor);
  const resting = await background();

  await folder.click({ button: 'right' });
  // The pointer leaves the row for the menu: the row still looks hovered.
  await menuItem(panel, 'Rename').hover();
  await expect(folder).toHaveAttribute('data-hovered');
  await expect.poll(background).not.toBe(resting);

  await panel.keyboard.press('Escape');
  await expect(folder).not.toHaveAttribute('data-hovered');
});

test('menus stay inside a narrow panel, even from its corner', async ({ panel }) => {
  await panel.setViewportSize({ width: 300, height: 500 });
  await panel.getByRole('button', { name: 'New Volet' }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 2');
  // The last dot sits near the bottom-right corner.
  await panel.getByRole('navigation', { name: 'Volets' }).getByRole('button', { name: 'Volet 2' }).click({ button: 'right' });
  const menu = panel.getByRole('menu');
  await expect(menu).toBeVisible();
  const box = (await menu.boundingBox())!;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.y).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(300);
  expect(box.y + box.height).toBeLessThanOrEqual(500);
});

test('a submenu expands in place, without covering the items below it', async ({ worker, windowId, panel }) => {
  await panel.setViewportSize({ width: 300, height: 600 });
  await panel.getByRole('button', { name: 'New Volet' }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 2');
  await panel.getByRole('button', { name: 'Volet 1 (click to rename)', exact: true }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 1 (click to rename)');
  const tabId = await worker.evaluate(
    async (id) => (await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Report</title>' })).id!,
    windowId,
  );
  await expect.poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).title, tabId)).toBe('Report');
  await visiblePage(panel).getByRole('button', { name: 'Report', exact: true }).click({ button: 'right' });

  const move = menuItem(panel, 'Move to Volet');
  const close = menuItem(panel, 'Close tab');
  const closeBefore = (await close.boundingBox())!;
  await move.click();
  await expect(move).toHaveAttribute('aria-expanded', 'true');
  const target = menuItem(panel, 'Volet 2');
  await expect(target).toBeVisible();
  // Its items sit between "Move to Volet" and the items after it, which moved down and stay visible.
  const [moveBox, targetBox] = [(await move.boundingBox())!, (await target.boundingBox())!];
  await expect.poll(async () => (await close.boundingBox())!.y).toBeGreaterThan(closeBefore.y);
  const closeAfter = (await close.boundingBox())!;
  expect(targetBox.y).toBeGreaterThanOrEqual(moveBox.y + moveBox.height);
  expect(closeAfter.y).toBeGreaterThanOrEqual(targetBox.y + targetBox.height);

  await target.click();
  await expect.poll(async () => (await stripState(worker, windowId)).find((tab) => tab.id === tabId)?.group).toBe('Volet 2');
});

test('a submenu opens and closes with the arrow keys', async ({ panel }) => {
  await panel.getByRole('button', { name: 'New Volet' }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 2');
  await panel.getByRole('navigation', { name: 'Volets' }).getByRole('button', { name: 'Volet 1 (click to rename)', exact: true }).click();
  await expect(visiblePage(panel).getByRole('heading')).toHaveText('Volet 1 (click to rename)');
  // A Space's menu has no submenu, a folder's or a tab's does: use the New tab row's tab.
  await visiblePage(panel).getByRole('button', { name: 'about:blank' }).click({ button: 'right' });
  const move = menuItem(panel, 'Move to Volet');
  await move.focus();
  await panel.keyboard.press('ArrowRight');
  await expect(move).toHaveAttribute('aria-expanded', 'true');
  await expect(menuItem(panel, 'Volet 2')).toBeVisible();
  await menuItem(panel, 'Volet 2').focus();
  await panel.keyboard.press('ArrowLeft');
  await expect(move).toHaveAttribute('aria-expanded', 'false');
  await expect(move).toBeFocused();
});

test('a menu closes when the panel loses focus (a click in the page)', async ({ panel }) => {
  await visiblePage(panel).getByRole('heading').click({ button: 'right' });
  await expect(panel.getByRole('menu')).toBeVisible();
  // A click in the web page happens in another document: the panel only sees itself lose focus.
  await panel.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(panel.getByRole('menu')).toHaveCount(0);
});

test('a menu closes when the pointer leaves an unfocused panel, unless it comes back', async ({ panel }) => {
  const menu = panel.getByRole('menu');
  // A right-click doesn't focus the panel (macOS), so a click in the page would never blur it.
  const unfocus = () => panel.evaluate(() => (document.hasFocus = () => false));
  const leave = () =>
    panel.evaluate(() =>
      document.body.dispatchEvent(new PointerEvent('pointerout', { bubbles: true, relatedTarget: null })),
    );

  await visiblePage(panel).getByRole('heading').click({ button: 'right' });
  await expect(menu).toBeVisible();
  await unfocus();
  await leave();
  // Back over the panel before the grace period ends: it stays.
  await panel.evaluate(() => document.body.dispatchEvent(new PointerEvent('pointerover', { bubbles: true })));
  await panel.waitForTimeout(500);
  await expect(menu).toBeVisible();

  await leave();
  await expect(menu).toHaveCount(0);
});

test('menu items highlight on hover even when the panel has no focus', async ({ panel }) => {
  await visiblePage(panel).getByRole('heading').click({ button: 'right' });
  const rename = menuItem(panel, 'Rename Volet');
  await expect(rename).toBeVisible();
  // As after a right-click from the web page: the panel has no focus, and focusing the
  // hovered item (what Bits UI does to highlight it) has no effect.
  await panel.evaluate(() => {
    document.hasFocus = () => false;
    HTMLElement.prototype.focus = () => undefined;
    window.dispatchEvent(new Event('focus')); // any focus change re-checks hasFocus
  });
  await expect(panel.locator('html')).toHaveAttribute('data-unfocused');
  await rename.hover();
  await expect(rename).not.toHaveAttribute('data-highlighted');
  const hovered = await rename.evaluate((node) => getComputedStyle(node).backgroundColor);
  const other = await menuItem(panel, 'New folder').evaluate((node) => getComputedStyle(node).backgroundColor);
  expect(hovered).not.toBe(other);

  await panel.keyboard.press('Escape');
  await expect(panel.locator('html')).not.toHaveAttribute('data-unfocused');
});

test('hovering a Space dot shows its name', async ({ panel }) => {
  await panel.getByRole('navigation', { name: 'Volets' }).getByRole('button', { name: 'Volet 1 (click to rename)' }).hover();
  await expect(panel.locator('[data-tooltip-content]')).toHaveText('Volet 1 (click to rename)');
});

/** Record every tooltip mount and state change in the panel from now on. */
const watchTooltips = (panel: Page) =>
  panel.evaluate(() => {
    const log: string[] = ((window as unknown as { tooltipLog: string[] }).tooltipLog = []);
    new MutationObserver((mutations) => {
      for (const m of mutations) {
        if (m.type === 'childList' && m.addedNodes.length) log.push('mounted');
        if (m.type === 'attributes') log.push((m.target as HTMLElement).dataset.state ?? '');
      }
    }).observe(document.querySelector('[data-overlay-root]')!, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: ['data-state'],
    });
  });
const tooltipLog = (panel: Page) => panel.evaluate(() => (window as unknown as { tooltipLog: string[] }).tooltipLog);

test('the Space dots share one tooltip, which moves to the hovered dot', async ({ panel }) => {
  await panel.getByRole('button', { name: 'New Volet' }).click();
  const dots = panel.getByRole('navigation', { name: 'Volets' }).locator('li button');
  await expect(dots).toHaveCount(2);
  // (The New Space button's own tooltip may still be fading out.)
  const tooltip = panel.locator('[data-tooltip-content]:not([data-state="closed"])');

  await dots.nth(0).hover();
  await expect(tooltip).toHaveText('Volet 1 (click to rename)');
  await watchTooltips(panel);
  await dots.nth(1).hover();
  await expect(tooltip).toHaveText((await dots.nth(1).getAttribute('aria-label'))!);
  await expect(tooltip).toHaveCount(1);
  // It never closed or remounted on the way: the same tooltip moved.
  expect(await tooltipLog(panel)).toEqual([]);
});

test("a row's buttons share one tooltip, gone as soon as the pointer leaves them", async ({ worker, windowId, panel }) => {
  const tabId = await worker.evaluate(
    async (id) => (await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Report</title>' })).id!,
    windowId,
  );
  await expect.poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).title, tabId)).toBe('Report');
  const homeId = await worker.evaluate(async () => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    return (await chrome.bookmarks.getChildren(root.rootId)).find((c) => c.title === 'Volet 1 (click to rename)')!.id;
  });
  await command(panel, { type: 'pinTab', windowId, tabId, parentId: homeId });
  const tooltip = panel.locator('[data-tooltip-content]');
  const pinRow = visiblePage(panel).locator('li', { has: panel.getByRole('button', { name: 'Report', exact: true }) });

  await pinRow.hover();
  await pinRow.getByRole('button', { name: 'Unpin' }).hover();
  await expect(tooltip).toHaveText('Unpin (it moves to the tabs below)');
  await watchTooltips(panel);
  const close = pinRow.getByRole('button', { name: 'Close tab' });
  await close.hover();
  await expect(tooltip).toHaveText('Close tab (it stays pinned)');
  expect(await tooltipLog(panel)).toEqual([]);

  // Up toward the row above, through where the tooltip sits: it is already gone.
  const box = (await close.boundingBox())!;
  await panel.mouse.move(box.x + box.width / 2, box.y - 14);
  await expect(tooltip).toHaveCount(0);
});
