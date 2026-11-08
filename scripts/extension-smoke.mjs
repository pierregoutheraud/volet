import { expect } from '@playwright/test';

/** Exercise extension pages and preview messages without changing the application's engine or queue. */
export async function smokeExtensionPages(context, worker, origin) {
  for (const name of ['options', 'import']) {
    const page = await context.newPage();
    await page.goto(`${origin}/${name}.html`);
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await page.close();
  }
  const windowId = await worker.evaluate(async () => (await chrome.windows.getAll({ windowTypes: ['normal'] }))[0].id);
  const panel = await context.newPage();
  await panel.goto(`${origin}/sidepanel.html?windowId=${windowId}`);
  await expect(panel.locator('.sidebar')).toBeVisible();
  await panel.close();
}

/** Native keyboard commands are browser gestures; send the identical message while holding the modifier. */
export async function smokeRecentTabs(context, worker, currentPage, baseUrl) {
  await currentPage.bringToFront();
  const tabId = await worker.evaluate(async (url) =>
    (await chrome.tabs.query({})).find((tab) => (tab.url || tab.pendingUrl) === url)?.id, currentPage.url());
  if (tabId === undefined) throw new Error('Extension check could not find the current test tab');
  const openedPages = context.pages().filter((page) => page.url().startsWith(baseUrl));
  if (openedPages.length < 2) throw new Error('Extension check needs two website tabs');
  await currentPage.keyboard.down('Meta');
  try {
    await worker.evaluate(async (id) => {
      await chrome.tabs.sendMessage(id, { type: 'recent-tabs:step', shortcut: 'Cmd+E', offset: 1 }, { frameId: 0 });
    }, tabId);
    const dialog = currentPage.getByRole('dialog', { name: 'Recent tabs' });
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('[data-recent-tab]').first()).toBeVisible();
    await currentPage.keyboard.press('ArrowLeft');
    await currentPage.keyboard.press('ArrowRight');
    const selected = await dialog.locator('[aria-current="true"]').getAttribute('aria-label');
    await currentPage.keyboard.up('Meta');
    await expect(dialog).toHaveCount(0);
    await expect.poll(() => worker.evaluate(async () => (await chrome.tabs.query({ active: true }))[0]?.title)).toBe(selected);
    await currentPage.bringToFront();
  } finally {
    await currentPage.keyboard.up('Meta');
  }
}
