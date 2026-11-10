import type { Page, Worker } from '@playwright/test';
import { command, expect, stripState, test } from './fixtures';

const visiblePage = (panel: Page) => panel.locator('section:not([inert])');
const row = (panel: Page, name: string) => visiblePage(panel).getByRole('button', { name, exact: true });
const tabTitle = (url: string) => url.match(/<title>(\w+)/)?.[1];

/** An open folder, "Dashboard", with the pins Alpha and Beta (their tabs open) and Gamma (its tab closed). */
async function dashboard(worker: Worker, windowId: number, panel: Page) {
  const ids = await worker.evaluate(async (id) => {
    const titles = ['Alpha', 'Beta', 'Gamma'];
    return Promise.all(
      titles.map(async (title) => (await chrome.tabs.create({ windowId: id, url: `data:text/html,<title>${title}</title>` })).id!),
    );
  }, windowId);
  await expect(row(panel, 'Gamma')).toBeVisible();
  const home = await worker.evaluate(async () => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    return (await chrome.bookmarks.getChildren(root.rootId)).find((c) => c.title === 'Volet 1 (click to rename)')!.id;
  });
  const items = ids.map((id) => ({ kind: 'tab', id }));
  await command(panel, { type: 'createFolderWith', windowId, parentId: home, title: 'Dashboard', items });
  // Close Gamma's tab: its pin stays in the folder, unloaded.
  await worker.evaluate((id) => chrome.tabs.remove(id), ids[2]!);
  await expect.poll(async () => (await stripState(worker, windowId)).filter((tab) => tabTitle(tab.url)).length).toBe(2);
  await expect(row(panel, 'Gamma')).toBeVisible();
}

test('a collapsed folder still shows its open tabs', async ({ worker, windowId, panel }) => {
  await dashboard(worker, windowId, panel);

  // Count Alpha's rows on every frame while the folder collapses: it stays put, never copied.
  const most = panel.evaluate(
    () =>
      new Promise<number>((resolve) => {
        let most = 0;
        const end = performance.now() + 400;
        const sample = () => {
          most = Math.max(most, document.querySelectorAll('section:not([inert]) button[title="Alpha"]').length);
          if (performance.now() < end) requestAnimationFrame(sample);
          else resolve(most);
        };
        sample();
      }),
  );
  await row(panel, 'Dashboard').click();
  await expect(row(panel, 'Dashboard')).toHaveAttribute('aria-expanded', 'false');
  expect(await most).toBe(1);
  // Only the pins with an open tab are left.
  await expect(row(panel, 'Gamma')).toHaveCount(0);
  await expect(row(panel, 'Alpha')).toBeVisible();
  await expect(row(panel, 'Beta')).toBeVisible();
});

test("Volet's settings can hide a collapsed folder's open tabs too, and the panel follows at once", async ({ context, worker, windowId, panel }) => {
  await dashboard(worker, windowId, panel);
  const settings = await context.newPage();
  await settings.goto(`chrome-extension://${new URL(worker.url()).host}/options.html`);
  const toggle = settings.getByRole('switch', { name: 'Show open tabs in collapsed folders' });
  await expect(toggle).toBeChecked();
  await toggle.click();
  await expect(toggle).not.toBeChecked();
  await expect
    .poll(() => worker.evaluate(async () => {
      const { settings } = (await chrome.storage.sync.get('settings')) as { settings?: { collapsedFoldersShowOpenTabs?: boolean } };
      return settings?.collapsedFoldersShowOpenTabs;
    }))
    .toBe(false);

  await row(panel, 'Dashboard').click();
  await expect(row(panel, 'Dashboard')).toHaveAttribute('aria-expanded', 'false');
  for (const name of ['Alpha', 'Beta', 'Gamma']) await expect(row(panel, name)).toHaveCount(0);

  // Back on, from its label: the pins with an open tab come back in the collapsed folder.
  await settings.getByText('Show open tabs in collapsed folders', { exact: true }).click();
  await expect(toggle).toBeChecked();
  await expect(row(panel, 'Alpha')).toBeVisible();
  await expect(row(panel, 'Beta')).toBeVisible();
  await expect(row(panel, 'Gamma')).toHaveCount(0);
});

test("double-clicking a folder doesn't rename it; its menu does", async ({ worker, windowId, panel }) => {
  const tabId = await worker.evaluate(
    async (id) => (await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Inside</title>' })).id!,
    windowId,
  );
  await expect(row(panel, 'Inside')).toBeVisible();
  const home = await worker.evaluate(async () => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    return (await chrome.bookmarks.getChildren(root.rootId)).find((c) => c.title === 'Volet 1 (click to rename)')!.id;
  });
  await command(panel, { type: 'createFolderWith', windowId, parentId: home, title: 'Dashboard', items: [{ kind: 'tab', id: tabId }] });
  const folder = row(panel, 'Dashboard');
  const field = visiblePage(panel).getByRole('textbox', { name: 'Folder name' });

  // Opening and closing it quickly is a double-click: it just toggles.
  await folder.dblclick();
  await expect(field).toHaveCount(0);
  await expect(folder).toHaveAttribute('aria-expanded', 'true');

  await folder.click({ button: 'right' });
  await panel.getByRole('menuitem', { name: 'Rename' }).click();
  await expect(field).toBeFocused();
  await field.fill('Reports');
  await field.press('Enter');
  await expect(row(panel, 'Reports')).toBeVisible();
});

test('a folder Volet didn\'t make starts collapsed; opening it shows its many pins (over a few frames)', async ({
  worker,
  panel,
}) => {
  await worker.evaluate(async () => {
    const { root } = (await chrome.storage.local.get('root')) as { root: { rootId: string } };
    const home = (await chrome.bookmarks.getChildren(root.rootId)).find((c) => c.title === 'Volet 1 (click to rename)')!.id;
    const folder = await chrome.bookmarks.create({ parentId: home, title: 'Archive' });
    for (let i = 1; i <= 60; i++) await chrome.bookmarks.create({ parentId: folder.id, title: `Page ${i}`, url: `https://p${i}.example/` });
  });
  // Made in Chrome's bookmarks (like after a reinstall, or through sync): collapsed.
  const folder = row(panel, 'Archive');
  await expect(folder).toHaveAttribute('aria-expanded', 'false');
  await expect(row(panel, 'Page 1')).toHaveCount(0);

  await folder.click();
  await expect(folder).toHaveAttribute('aria-expanded', 'true');
  await expect(row(panel, 'Page 60')).toBeAttached();
  await expect(visiblePage(panel).getByRole('button', { name: /^Page \d+$/ })).toHaveCount(60);
});
