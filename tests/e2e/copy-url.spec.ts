import type { Page, Worker } from '@playwright/test';
import { expect, stripState, test } from './fixtures';

const ARTICLE = 'https://copy.test/article?id=42#notes';

/** What Chrome runs on the copy shortcut: the worker's own command listener, on the window's active tab. */
const pressCopy = (worker: Worker, windowId: number) => worker.evaluate(async (id) => {
  const [tab] = await chrome.tabs.query({ windowId: id, active: true });
  (chrome.commands.onCommand as unknown as { dispatch: (name: string, tab: chrome.tabs.Tab) => void }).dispatch('copy-url', tab!);
}, windowId);

/** Headless Chromium doesn't track focus between the panel and the page: say whether the panel has it. */
const focusPanel = (panel: Page, focused: boolean) => panel.evaluate((value) => { document.hasFocus = () => value; }, focused);

test.beforeEach(async ({ context }) => {
  // Chrome lets the focused page write the clipboard (Volet asks for no clipboard permission); headless Chromium only
  // does once told. Reading it back needs the read permission.
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://copy.test' });
  await context.route('https://copy.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Article</title><body>Article</body>' }));
});

async function openArticle(context: import('@playwright/test').BrowserContext, worker: Worker, windowId: number) {
  const page = await context.newPage();
  await page.goto(ARTICLE);
  await expect.poll(async () => (await stripState(worker, windowId)).find((tab) => tab.active)?.url).toBe(ARTICLE);
  return page;
}

test('the copy shortcut puts the page link on the clipboard and says so over the page', async ({ context, worker, windowId, panel }) => {
  const page = await openArticle(context, worker, windowId);
  await focusPanel(panel, false);
  await pressCopy(worker, windowId);
  await expect(page.getByRole('status')).toHaveText('Link copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(ARTICLE);
  // It goes after a moment.
  await expect(page.getByRole('status')).toHaveText('');
  // A second copy says so again, from the same script.
  await pressCopy(worker, windowId);
  await expect(page.getByRole('status')).toHaveText('Link copied');
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(ARTICLE);
  await expect(page.locator('volet-toast')).toHaveCount(1);
});

test('with the Volet panel focused, the panel copies the link and says so', async ({ context, worker, windowId, panel }) => {
  const page = await openArticle(context, worker, windowId);
  await focusPanel(panel, true);
  await pressCopy(worker, windowId);
  await expect(panel.getByRole('status').filter({ hasText: 'Link copied' })).toHaveCount(1);
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(ARTICLE);
  await expect(page.locator('volet-toast')).toHaveCount(0);
});
