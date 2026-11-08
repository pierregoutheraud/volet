import path from 'node:path';
import type { BrowserContext } from '@playwright/test';
import { expect, extensionPath, stripState, test } from './fixtures';

test('the palette finds an open tab and switches to it', async ({ worker, windowId, panel }) => {
  await worker.evaluate(async (id) => {
    await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Quarterly plan</title>' });
    await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Elsewhere</title>' });
  }, windowId);
  await expect.poll(async () => (await stripState(worker, windowId)).find((tab) => tab.active)?.url).toContain('Elsewhere');
  await expect
    .poll(() => worker.evaluate(async () => (await chrome.tabs.query({})).some((tab) => tab.title === 'Quarterly plan')))
    .toBe(true);

  await panel.getByRole('button', { name: /^Search tabs and pins/ }).click();
  const input = panel.getByRole('combobox');
  await input.fill('quarterly');
  await expect(panel.getByRole('option').first()).toContainText('Quarterly plan');
  await input.press('Enter');

  await expect(panel.getByRole('combobox')).toHaveCount(0); // closed after running
  await expect.poll(async () => (await stripState(worker, windowId)).find((tab) => tab.active)?.url).toContain('Quarterly');
});

test('typing an address opens it in the active Space', async ({ context, worker, windowId, panel }) => {
  await context.route('https://docs.example/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Docs</title>' }),
  );
  await panel.getByRole('button', { name: /^Search tabs and pins/ }).click();
  const input = panel.getByRole('combobox');
  await input.fill('docs.example/start');
  await expect(panel.getByRole('option').first()).toContainText('Open https://docs.example/start');
  await input.press('Enter');
  await expect
    .poll(async () => (await stripState(worker, windowId)).find((tab) => tab.url.includes('docs.example'))?.group)
    .toBe('Volet 1 (click to rename)');
});

test('the shortcut on a page that cannot host it opens the palette in the panel', async ({ worker, windowId, panel }) => {
  // What the worker does when the shortcut fires on chrome:// pages, the Web Store, etc.
  await worker.evaluate(async (id) => chrome.storage.session.set({ pendingPalette: { [id]: true } }), windowId);
  await expect(panel.getByRole('combobox')).toBeVisible();
  await expect
    .poll(() => worker.evaluate(async () => (await chrome.storage.session.get('pendingPalette')).pendingPalette))
    .toEqual({});
});

/**
 * The palette the shortcut injects into a web page (the built `palette.js`), over a plain page whose root font
 * size is `rootFontSize`, answered by a fake worker. Returns every element's box and corners in its shadow root.
 */
async function paletteLayout(context: BrowserContext, rootFontSize?: string) {
  const page = await context.newPage();
  await page.setViewportSize({ width: 1000, height: 800 });
  await page.setContent(`<!doctype html><html${rootFontSize ? ` style="font-size: ${rootFontSize}"` : ''}><body></body></html>`);
  await page.evaluate(() => {
    const items = [
      { id: 'space:1', kind: 'space', title: 'Switch to Work', hue: 152, ref: '1' },
      { id: 'action:new-tab', kind: 'action', title: 'New tab', ref: 'new-tab' },
      { id: 'tab:1', kind: 'tab', title: 'Quarterly plan', detail: 'Work · docs.example', url: 'https://docs.example/', ref: 1 },
    ];
    // WXT's `browser` is this object when it has a runtime id, so the palette talks to it instead of the worker.
    Object.assign(globalThis, {
      browser: { runtime: { id: 'test', sendMessage: async () => ({ ok: true, value: { hue: 268, items } }) } },
    });
  });
  await page.addScriptTag({ path: path.join(extensionPath, 'palette.js') });
  await expect(page.getByRole('option')).toHaveCount(3);
  const layout = await page.evaluate(() =>
    [...document.querySelector('spaces-palette')!.shadowRoot!.querySelectorAll('*')].map((node) => {
      const { x, y, width, height } = node.getBoundingClientRect();
      return { role: node.getAttribute('role'), x, y, width, height, corners: getComputedStyle(node).borderRadius };
    }),
  );
  await page.close();
  return layout;
}

test('the palette over a page keeps its size when the page changes the root font size', async ({ context }) => {
  // YouTube sets its root font size to 10px: rem-based sizes would shrink by a third.
  const usual = await paletteLayout(context);
  const small = await paletteLayout(context, '10px');
  expect(usual.filter((node) => node.role === 'option').map((node) => node.height)).toEqual([40, 40, 40]);
  expect(small).toEqual(usual);
});

test('the in-page palette shows on a page that hides undefined custom elements, like reddit.com', async ({ context, worker }) => {
  // Sites built from web components hide elements not defined yet; content scripts can't define the palette's host.
  await context.route('https://components.test/**', (route) => route.fulfill({
    contentType: 'text/html',
    body: '<title>Components</title><style>:not(:defined) { display: none !important; visibility: hidden !important; }</style><body>Components</body>',
  }));
  const page = await context.newPage();
  await page.goto('https://components.test/');
  // What the palette shortcut runs on the current page.
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://components.test/*' });
    await chrome.scripting.executeScript({ target: { tabId: tab!.id! }, files: ['/palette.js'] });
  });
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
});

test('the search shortcut opens Search where the keyboard is: in a focused panel, else over the page', async ({ context, worker, windowId, panel }) => {
  await context.route('https://search-shortcut.test/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Page</title><body>Page</body>' }),
  );
  const page = await context.newPage();
  await page.goto('https://search-shortcut.test/');
  await expect.poll(async () => (await stripState(worker, windowId)).find((tab) => tab.active)?.url).toContain('search-shortcut');
  // What Chrome runs on Ctrl+M: the worker's own command listener, on the window's active tab.
  const pressShortcut = () => worker.evaluate(async (id) => {
    const [tab] = await chrome.tabs.query({ windowId: id, active: true });
    (chrome.commands.onCommand as unknown as { dispatch: (name: string, tab: chrome.tabs.Tab) => void }).dispatch('open-palette', tab!);
  }, windowId);
  // Headless Chromium doesn't track focus between the panel and the page: say which one has it.
  const focusPanel = (focused: boolean) => panel.evaluate((value) => { document.hasFocus = () => value; }, focused);

  // The panel has the keyboard: a page next to it would get none of its keys, not even Escape.
  await focusPanel(true);
  await pressShortcut();
  const input = panel.getByRole('combobox');
  await expect(input).toBeFocused();
  await expect(page.locator('spaces-palette')).toHaveCount(0);
  await input.press('Escape');
  await expect(input).toHaveCount(0);

  // The page has it: Search shows over the page.
  await focusPanel(false);
  await pressShortcut();
  await expect(page.locator('spaces-palette')).toHaveCount(1);
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
  await expect(panel.getByRole('combobox')).toHaveCount(0);
});
