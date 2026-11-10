import path from 'node:path';
import type { BrowserContext, Page, Worker } from '@playwright/test';
import { expect, extensionPath, stripState, test } from './fixtures';

/** A website page, active in the window, which Search can show over. */
async function openPage(context: BrowserContext, worker: Worker, windowId: number, name: string): Promise<Page> {
  await context.route('https://search.test/**', (route) => {
    const title = new URL(route.request().url()).pathname.slice(1);
    return route.fulfill({ contentType: 'text/html', body: `<title>${title}</title><body>${title}</body>` });
  });
  const page = await context.newPage();
  await page.goto(`https://search.test/${name}`);
  await expect.poll(async () => (await stripState(worker, windowId)).find((tab) => tab.active)?.url).toContain(name);
  return page;
}

/** A tab Search can find, opened in the background. */
async function backgroundTab(worker: Worker, windowId: number, title: string) {
  await worker.evaluate(async ({ id, title }) => {
    await chrome.tabs.create({ windowId: id, url: `data:text/html,<title>${title}</title>`, active: false });
  }, { id: windowId, title });
  await expect.poll(() => worker.evaluate(async (title) => (await chrome.tabs.query({})).some((tab) => tab.title === title), title))
    .toBe(true);
}

const searchButton = (panel: Page) => panel.getByRole('button', { name: 'Search tabs and pins', exact: true });
/** The panel's hidden field, which takes the typing while Search shows over the page. */
const relayField = (panel: Page) => panel.locator('[data-search-relay]');

/** Open Search over the page from the panel's button, and wait for the panel to have the keyboard for it. */
async function openFromPanel(panel: Page, page: Page) {
  await searchButton(panel).click();
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
  await expect(relayField(panel)).toBeFocused();
  await expect(searchButton(panel)).toHaveAttribute('aria-pressed', 'true');
}

test("the panel's Search button opens Search over the page, and the panel's typing drives it", async ({ context, worker, windowId, panel }) => {
  await backgroundTab(worker, windowId, 'Quarterly plan');
  const page = await openPage(context, worker, windowId, 'Elsewhere');
  await openFromPanel(panel, page);
  // There's one Search, over the page: none in the panel.
  await expect(panel.getByRole('combobox')).toHaveCount(0);

  await panel.keyboard.type('quarterly');
  await expect(page.getByRole('combobox')).toHaveValue('quarterly');
  await expect(page.getByRole('option').first()).toContainText('Quarterly plan');
  await panel.keyboard.press('Enter');

  await expect.poll(async () => (await stripState(worker, windowId)).find((tab) => tab.active)?.url).toContain('Quarterly');
  await expect(page.locator('spaces-palette')).toHaveCount(0);
  await expect(searchButton(panel)).toHaveAttribute('aria-pressed', 'false');
  await expect(relayField(panel)).toHaveCount(0);
});

test('Escape, the button again and a click elsewhere in the panel close Search over the page', async ({ context, worker, windowId, panel }) => {
  const page = await openPage(context, worker, windowId, 'Closing');
  const dialog = page.getByRole('dialog', { name: 'Search' });
  const closed = async () => {
    await expect(dialog).toHaveCount(0);
    await expect(searchButton(panel)).toHaveAttribute('aria-pressed', 'false');
    await expect(relayField(panel)).toHaveCount(0);
  };
  await openFromPanel(panel, page);
  await panel.keyboard.press('Escape');
  await closed();
  await openFromPanel(panel, page);
  await searchButton(panel).click();
  await closed();
  await openFromPanel(panel, page);
  await panel.getByRole('navigation', { name: 'Volets' }).click({ position: { x: 2, y: 2 } });
  await closed();
  expect((await stripState(worker, windowId)).find((tab) => tab.active)?.url).toContain('Closing');
});

test('typing an address from the panel opens it in the active Volet', async ({ context, worker, windowId, panel }) => {
  await context.route('https://docs.example/**', (route) =>
    route.fulfill({ contentType: 'text/html', body: '<title>Docs</title>' }),
  );
  const page = await openPage(context, worker, windowId, 'Start');
  await openFromPanel(panel, page);
  await panel.keyboard.type('docs.example/start');
  await expect(page.getByRole('option').first()).toContainText('Open https://docs.example/start');
  await panel.keyboard.press('Enter');
  await expect
    .poll(async () => (await stripState(worker, windowId)).find((tab) => tab.url.includes('docs.example'))?.group)
    .toBe('Volet 1 (click to rename)');
});

test('arrows from the panel move through the results, and a click into Search carries on typing on the page', async ({ context, worker, windowId, panel }) => {
  await backgroundTab(worker, windowId, 'Plan one');
  await backgroundTab(worker, windowId, 'Plan two');
  const page = await openPage(context, worker, windowId, 'Planning');
  await openFromPanel(panel, page);
  await panel.keyboard.type('plan t');
  const input = page.getByRole('combobox');
  await expect(input).toHaveValue('plan t');
  // The panel's caret, drawn over the page's field (which can't show its own without the keyboard).
  await expect(page.locator('[data-relay-caret]')).toBeVisible();
  await panel.keyboard.press('Backspace');
  await panel.keyboard.press('Backspace');
  await expect(input).toHaveValue('plan');
  const selected = page.locator('[role="option"][aria-selected="true"]');
  const first = await selected.textContent();
  await panel.keyboard.press('ArrowDown');
  await expect(selected).not.toHaveText(first!);

  // The page takes the keyboard: its own field goes on from the panel's text, with its own caret.
  await input.click();
  await expect(page.locator('[data-relay-caret]')).toHaveCount(0);
  await input.press('End');
  await page.keyboard.type(' two');
  await expect(input).toHaveValue('plan two');
  await expect(page.getByRole('option').first()).toContainText('Plan two');
  await input.press('Enter');
  await expect.poll(async () => (await stripState(worker, windowId)).find((tab) => tab.active)?.url).toContain('Plan two');
  await expect(searchButton(panel)).toHaveAttribute('aria-pressed', 'false');
});

test('where nothing can show over the page, Search opens in the panel', async ({ worker, windowId, panel }) => {
  await worker.evaluate(async (id) => chrome.tabs.create({ windowId: id, url: 'chrome://version/', active: true }), windowId);
  await expect.poll(async () => (await stripState(worker, windowId)).find((tab) => tab.active)?.url).toContain('chrome://version');
  await searchButton(panel).click();
  const input = panel.getByRole('combobox');
  await expect(input).toBeFocused();
  await expect(searchButton(panel)).toHaveAttribute('aria-pressed', 'true');
  await input.press('Escape');
  await expect(input).toHaveCount(0);

  // The shortcut there: the worker opens the panel and leaves it a flag.
  await worker.evaluate(async (id) => chrome.storage.session.set({ pendingPalette: { [id]: true } }), windowId);
  await expect(panel.getByRole('combobox')).toBeVisible();
  await expect
    .poll(() => worker.evaluate(async () => (await chrome.storage.session.get('pendingPalette')).pendingPalette))
    .toEqual({});
});

test('the search shortcut opens Search over the page, typed into from the panel when the panel has the keyboard', async ({ context, worker, windowId, panel }) => {
  const page = await openPage(context, worker, windowId, 'Shortcut');
  // What Chrome runs on Ctrl+M: the worker's own command listener, on the window's active tab.
  const pressShortcut = () => worker.evaluate(async (id) => {
    const [tab] = await chrome.tabs.query({ windowId: id, active: true });
    (chrome.commands.onCommand as unknown as { dispatch: (name: string, tab: chrome.tabs.Tab) => void }).dispatch('open-palette', tab!);
  }, windowId);
  // Headless Chromium doesn't track focus between the panel and the page: say which one has it.
  const focusPanel = (focused: boolean) => panel.evaluate((value) => { document.hasFocus = () => value; }, focused);
  const dialog = page.getByRole('dialog', { name: 'Search' });

  // The panel has the keyboard: Search shows over the page all the same, and the panel sends it the keys.
  await focusPanel(true);
  await pressShortcut();
  await expect(dialog).toBeVisible();
  await expect(relayField(panel)).toBeFocused();
  await panel.keyboard.type('short');
  await expect(page.getByRole('combobox')).toHaveValue('short');
  await panel.keyboard.press('Escape');
  await expect(dialog).toHaveCount(0);
  await expect(relayField(panel)).toHaveCount(0);

  // The page has it: Search over the page takes its own keys, and the shortcut closes it again.
  await focusPanel(false);
  await pressShortcut();
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('combobox')).toBeFocused();
  await expect(relayField(panel)).toHaveCount(0);
  await pressShortcut();
  await expect(dialog).toHaveCount(0);
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
    const listeners: ((message: unknown, sender: unknown, respond: () => void) => void)[] = [];
    Object.assign(globalThis, {
      browser: {
        runtime: {
          id: 'test',
          sendMessage: async () => ({ ok: true, value: { hue: 268, items } }),
          onMessage: { addListener: (listener: (typeof listeners)[number]) => listeners.push(listener) },
          onConnect: { addListener: () => undefined },
        },
      },
      // What the shortcut sends once the script is on the page.
      toggleSearch: () => listeners.forEach((listener) => listener({ type: 'palette:toggle' }, {}, () => undefined)),
    });
  });
  await page.addScriptTag({ path: path.join(extensionPath, 'palette.js') });
  await page.evaluate(() => (globalThis as unknown as { toggleSearch: () => void }).toggleSearch());
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
  // What the palette shortcut runs on the current page: add Search, then show it.
  await worker.evaluate(async () => {
    const [tab] = await chrome.tabs.query({ url: 'https://components.test/*' });
    await chrome.scripting.executeScript({ target: { tabId: tab!.id! }, files: ['/palette.js'] });
    await chrome.tabs.sendMessage(tab!.id!, { type: 'palette:toggle' }, { frameId: 0 });
  });
  await expect(page.getByRole('dialog', { name: 'Search' })).toBeVisible();
});
