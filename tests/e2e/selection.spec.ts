import type { Locator, Page, Worker } from '@playwright/test';
import { bookmarkTree, command, expect, stripState, test } from './fixtures';

const visiblePage = (panel: Page) => panel.locator('section:not([inert])');
const row = (panel: Page, name: string) => visiblePage(panel).getByRole('button', { name, exact: true });
const selected = (panel: Page) => visiblePage(panel).locator('[data-selected]');
const menuItem = (panel: Page, name: string) => panel.getByRole('menuitem', { name, exact: true });

async function openTabs(worker: Worker, windowId: number, titles: string[]) {
  await worker.evaluate(
    async ({ id, titles }) => {
      for (const title of titles) await chrome.tabs.create({ windowId: id, url: `data:text/html,<title>${title}</title>` });
    },
    { id: windowId, titles },
  );
}

const homeId = (worker: Worker) =>
  worker.evaluate(async () => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    return (await chrome.bookmarks.getChildren(root.rootId)).find((c) => c.title === 'Volet 1 (right-click to rename)')!.id;
  });

type Tree = { title: string; url?: string; children?: Tree[] };
/** The first Volet's pins and folders, as titles (folders as `{ title: [children] }`). */
const homeOutline = async (worker: Worker) => {
  const outline = (nodes: Tree[]): unknown[] =>
    nodes.map((node) => (node.children ? { [node.title]: outline(node.children) } : node.title));
  return outline((await bookmarkTree(worker)).children!.find((c) => c.title === 'Volet 1 (right-click to rename)')!.children!);
};

const tabTitle = (url: string) => url.match(/<title>(\w+)/)?.[1];

test('Shift selects a range, Cmd adds to it, and Escape clears it', async ({ worker, windowId, panel }) => {
  await openTabs(worker, windowId, ['Alpha', 'Beta', 'Gamma', 'Delta']);
  await expect(row(panel, 'Delta')).toBeVisible();

  await row(panel, 'Alpha').click();
  await row(panel, 'Gamma').click({ modifiers: ['Shift'] });
  await expect(selected(panel)).toHaveCount(3);
  // A selection gesture doesn't switch tabs.
  await expect.poll(async () => tabTitle((await stripState(worker, windowId)).find((tab) => tab.active)!.url)).toBe('Alpha');

  await row(panel, 'Beta').click({ modifiers: ['ControlOrMeta'] });
  await expect(selected(panel)).toHaveCount(2);
  await panel.keyboard.press('Escape');
  await expect(selected(panel)).toHaveCount(0);
});

test('a click outside the selected rows clears the selection', async ({ worker, windowId, panel }) => {
  await openTabs(worker, windowId, ['Alpha', 'Beta', 'Gamma']);
  await expect(row(panel, 'Gamma')).toBeVisible();
  await row(panel, 'Alpha').click();
  await row(panel, 'Gamma').click({ modifiers: ['Shift'] });
  await expect(selected(panel)).toHaveCount(3);

  // Clicking a selected row's own button, or opening its menu, keeps the selection.
  await row(panel, 'Beta').click({ button: 'right' });
  await panel.keyboard.press('Escape');
  await expect(selected(panel)).toHaveCount(3);

  // Empty space in the panel.
  const page = (await visiblePage(panel).boundingBox())!;
  await panel.mouse.click(page.x + page.width / 2, page.y + page.height - 20);
  await expect(selected(panel)).toHaveCount(0);

  // A click in the web page: the panel only sees itself lose focus.
  await row(panel, 'Alpha').click();
  await row(panel, 'Beta').click({ modifiers: ['Shift'] });
  await expect(selected(panel)).toHaveCount(2);
  await panel.evaluate(() => window.dispatchEvent(new Event('blur')));
  await expect(selected(panel)).toHaveCount(0);
});

test('selected tabs become a new folder of pins, in order', async ({ worker, windowId, panel }) => {
  await openTabs(worker, windowId, ['Alpha', 'Beta', 'Gamma']);
  await expect(row(panel, 'Gamma')).toBeVisible();
  await row(panel, 'Alpha').click();
  await row(panel, 'Gamma').click({ modifiers: ['Shift'] });

  await row(panel, 'Beta').click({ button: 'right' });
  await menuItem(panel, 'New folder with 3 tabs').click();
  // The new folder opens for renaming.
  const field = panel.getByRole('textbox', { name: 'Folder name' });
  await field.fill('Reading');
  await field.press('Enter');

  await expect.poll(() => homeOutline(worker)).toEqual([{ Reading: ['Alpha', 'Beta', 'Gamma'] }]);
  // The tabs stay open, now as the folder's pins.
  await expect(visiblePage(panel).getByRole('button', { name: 'Unpin', exact: true })).toHaveCount(3);
  expect((await stripState(worker, windowId)).filter((tab) => tabTitle(tab.url)).length).toBe(3);
});

test('a selected folder goes inside the new folder (nested folders)', async ({ worker, windowId, panel }) => {
  await openTabs(worker, windowId, ['Alpha']);
  const tabId = (await stripState(worker, windowId)).find((tab) => tabTitle(tab.url) === 'Alpha')!.id;
  await expect.poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).title, tabId)).toBe('Alpha');
  const home = await homeId(worker);
  await command(panel, { type: 'createFolder', parentId: home, index: 0, title: 'Docs' });
  await command(panel, { type: 'pinTab', windowId, tabId, parentId: home });
  await expect(row(panel, 'Alpha')).toBeVisible();

  // Cmd+click adds to the current tab (Alpha, a pin here), like Chrome's tab strip.
  const folder = visiblePage(panel).getByRole('button', { name: 'Docs' });
  await folder.click({ modifiers: ['ControlOrMeta'] });
  await expect(selected(panel)).toHaveCount(2);
  await folder.click({ button: 'right' });
  await menuItem(panel, 'New folder with 2 items').click();
  await panel.keyboard.press('Escape');

  await expect.poll(() => homeOutline(worker)).toEqual([{ 'New folder': [{ Docs: [] }, 'Alpha'] }]);
});

test('dragging one of several selected tabs moves them all, shown as a stack', async ({ worker, windowId, panel }) => {
  await openTabs(worker, windowId, ['Alpha', 'Beta', 'Gamma']);
  await expect(row(panel, 'Gamma')).toBeVisible();
  await row(panel, 'Alpha').click();
  await row(panel, 'Gamma').click({ modifiers: ['ControlOrMeta'] });
  await expect(selected(panel)).toHaveCount(2);

  const hint = visiblePage(panel).getByText('Drag tabs here to pin them');
  await drag(panel, row(panel, 'Gamma'), hint, async () => {
    // Mid-drag: the dragged row carries a count; the other selected row stays in place, faded.
    await expect(panel.locator('[data-drag-preview]').getByText('2', { exact: true })).toBeVisible();
    const alpha = visiblePage(panel).locator('[data-entry]', { has: panel.getByRole('button', { name: 'Alpha', exact: true }) });
    await expect(alpha).toHaveClass(/opacity-35/);
  });

  await expect.poll(() => homeOutline(worker)).toEqual(['Alpha', 'Gamma']);
  await expect(selected(panel)).toHaveCount(0);
  // The unselected tab stays a temporary tab, and the rows that flew into the stack left no copies behind.
  await expect(row(panel, 'Beta')).toBeVisible();
  await expect(panel.locator('[data-overlay-root] > [inert]')).toHaveCount(0);
});

/** Drag with real pointer events (past dnd-kit's activation distance), checking things before the drop. */
async function drag(panel: Page, from: Locator, to: Locator, beforeDrop: () => Promise<void>) {
  const a = (await from.boundingBox())!;
  const b = (await to.boundingBox())!;
  await panel.mouse.move(a.x + 30, a.y + a.height / 2);
  await panel.mouse.down();
  await panel.mouse.move(a.x + 30, a.y + a.height / 2 + 10, { steps: 4 });
  await panel.mouse.move(b.x + 30, b.y + b.height / 2, { steps: 15 });
  await panel.waitForTimeout(150);
  await beforeDrop();
  await panel.mouse.up();
}
