import { bookmarkTree, expect, stripState, test } from './fixtures';

const extensionPage = (worker: import('@playwright/test').Worker, path: string) =>
  `chrome-extension://${new URL(worker.url()).host}/${path}`;

/** A small sidebar in Arc's StorableSidebar.json format. */
const arcFile = {
  sidebar: {
    containers: [
      { global: {} },
      {
        topAppsContainerIDs: [{ default: true }, 'top'],
        spaces: [
          'S1',
          {
            id: 'S1',
            title: 'Studio',
            containerIDs: ['pinned', 'P1', 'unpinned', 'U1'],
            customInfo: { windowTheme: { primaryColorPalette: { midTone: { red: 0.1, green: 0.6, blue: 0.3 } } } },
          },
        ],
        items: [
          'P1',
          { id: 'P1', childrenIds: ['t1', 'f1'], data: { itemContainer: {} } },
          't1',
          { id: 't1', title: 'Board', childrenIds: [], data: { tab: { savedURL: 'https://board.example/', savedTitle: 'x' } } },
          'f1',
          { id: 'f1', title: 'Refs', childrenIds: ['t2'], data: { list: {} } },
          't2',
          { id: 't2', childrenIds: [], data: { tab: { savedURL: 'https://refs.example/', savedTitle: 'Refs page' } } },
          'top',
          { id: 'top', childrenIds: ['t3'], data: { itemContainer: {} } },
          't3',
          { id: 't3', childrenIds: [], data: { tab: { savedURL: 'https://mail.example/', savedTitle: 'Mail' } } },
        ],
      },
    ],
  },
};

test('importing an Arc sidebar creates its Spaces, pins, folders and favorites', async ({ context, worker, panel }) => {
  const page = await context.newPage();
  await page.goto(extensionPage(worker, 'import.html'));
  await page.locator('input[type=file]').setInputFiles({
    name: 'StorableSidebar.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(arcFile)),
  });
  await expect(page.getByRole('checkbox', { name: /Studio/ })).toBeChecked();
  await page.getByRole('button', { name: 'Import 1 Volet' }).click();
  await expect(page.getByRole('status')).toContainText('Imported 1 Volet with 2 pins, and 1 favorite');

  const tree = await bookmarkTree(worker);
  expect(tree.children).toEqual([
    { title: 'Favorites', children: [{ title: 'Mail', url: 'https://mail.example/' }] },
    { title: 'Volet 1 (click to rename)', children: [] },
    {
      title: 'Studio',
      children: [
        { title: 'Board', url: 'https://board.example/' },
        { title: 'Refs', children: [{ title: 'Refs page', url: 'https://refs.example/' }] },
      ],
    },
  ]);
  const hue = await worker.evaluate(async () => {
    const { spaceMeta } = (await chrome.storage.sync.get('spaceMeta')) as { spaceMeta: Record<string, { hue: number }> };
    return spaceMeta.Studio!.hue;
  });
  expect(hue).toBeGreaterThan(130);
  expect(hue).toBeLessThan(170);
  await expect(panel.getByRole('button', { name: 'Studio', exact: true })).toBeVisible(); // its dot

  // Its folders arrive closed.
  await panel.getByRole('button', { name: 'Studio', exact: true }).click();
  const folder = panel.locator('section:not([inert])').getByRole('button', { name: 'Refs', exact: true });
  await expect(folder).toHaveAttribute('aria-expanded', 'false');
  await expect(panel.locator('section:not([inert])').getByRole('button', { name: 'Refs page', exact: true })).toHaveCount(0);
});

test('the settings page changes how long unpinned tabs stay open', async ({ context, worker }) => {
  const page = await context.newPage();
  await page.goto(extensionPage(worker, 'options.html'));
  const archive = page.getByRole('combobox', { name: "Close unpinned tabs I haven't used for" });
  await expect(archive).toHaveText('12 hours');
  // A list like Volet's menus, not the system's.
  await archive.click();
  await page.getByRole('option', { name: '1 day' }).click();
  await expect(archive).toHaveText('1 day');
  await expect(page.getByRole('option')).toHaveCount(0);
  await expect
    .poll(() =>
      worker.evaluate(async () => {
        const { settings } = (await chrome.storage.sync.get('settings')) as { settings?: { archiveAfterHours: number } };
        return settings?.archiveAfterHours;
      }),
    )
    .toBe(24);
  await expect(page.getByText('Change shortcuts')).toBeVisible();
});

test("the panel's Settings button, next to Search, opens Volet's settings", async ({ context, panel }) => {
  const bar = panel.getByRole('navigation', { name: 'Volets' });
  const search = await bar.getByRole('button', { name: 'Search tabs and pins (⌘K)' }).boundingBox();
  const settings = bar.getByRole('button', { name: 'Settings', exact: true });
  expect((await settings.boundingBox())!.x).toBeGreaterThan(search!.x);
  await settings.click();
  // Chrome opens them in a new tab, or in the window's empty one (as here).
  const settingsPage = () => context.pages().find((page) => page.url().endsWith('/options.html'));
  await expect.poll(settingsPage).toBeTruthy();
  await expect(settingsPage()!.getByRole('region', { name: 'Tab switcher', exact: true })).toBeVisible();
});

test('both tab cycling directions are listed in settings with their defaults, and configurable in Chrome', async ({ context, worker }) => {
  const page = await context.newPage();
  await page.goto(extensionPage(worker, 'options.html'));
  // Cycling above cycling in reverse, in Volet's settings and on Chrome's shortcuts page (which lists commands by id).
  const cycleFirst = async (target: typeof page) => {
    const [cycle, reverse] = await Promise.all(['Cycle through recent tabs', 'Cycle through recent tabs in reverse']
      .map(async (label) => (await target.getByText(label, { exact: true }).boundingBox())!.y));
    return cycle! < reverse!;
  };
  const preview = page.getByRole('region', { name: 'Tab switcher', exact: true });
  await expect(preview.getByText('Cycle through recent tabs', { exact: true })).toBeVisible();
  await expect(preview.getByText('Cycle through recent tabs in reverse', { exact: true })).toBeVisible();
  await expect(preview.locator('dd')).toHaveText([/Ctrl\+Q\s*Default/, /Ctrl\+Shift\+Q\s*Default/]);
  expect(await cycleFirst(page)).toBe(true);
  await expect(preview.getByRole('button', { name: 'Set close highlighted tab shortcut' })).toHaveText('Not set');
  for (const name of ['General', 'Volets', 'Tabs']) await expect(page.getByRole('region', { name, exact: true })).toBeVisible();
  const opened = context.waitForEvent('page');
  await page.getByRole('button', { name: 'Change shortcuts' }).click();
  const shortcuts = await opened;
  await shortcuts.waitForLoadState();
  await expect(shortcuts).toHaveURL('chrome://extensions/shortcuts');
  await expect(shortcuts.getByText('Cycle through recent tabs', { exact: true })).toBeVisible();
  await expect(shortcuts.getByText('Cycle through recent tabs in reverse', { exact: true })).toBeVisible();
  expect(await cycleFirst(shortcuts)).toBe(true);
});

test('the preview close shortcut can be recorded, persisted, cancelled and cleared', async ({ context, worker }) => {
  const page = await context.newPage();
  await page.goto(extensionPage(worker, 'options.html'));
  const recorder = page.getByRole('button', { name: 'Set close highlighted tab shortcut' });
  await recorder.click();
  await recorder.press('Meta+Backspace');
  await expect(recorder).toContainText('Cmd+Backspace');
  await expect(recorder).toHaveAttribute('data-binding', 'custom');
  await expect.poll(() => worker.evaluate(async () => (await chrome.storage.local.get('previewCloseShortcut')).previewCloseShortcut))
    .toBe('Cmd+Backspace');
  await page.reload();
  await expect(recorder).toContainText('Cmd+Backspace');
  await recorder.click();
  await recorder.press('Escape');
  await expect(recorder).toContainText('Cmd+Backspace');
  await recorder.click();
  // Dispatch locally: a real Cmd+W would close this browser tab before the recorder could see it.
  await recorder.dispatchEvent('keydown', { key: 'w', code: 'KeyW', metaKey: true });
  await expect(page.getByRole('alert')).toHaveText('Chrome reserves this shortcut. Choose another combination.');
  // The switcher's own keys stay its own, and a shortcut without the cycling modifier could never match.
  await recorder.press('Alt+Enter');
  await expect(page.getByRole('alert')).toHaveText("Volet's switcher uses this key. Choose another combination.");
  await recorder.press('Shift+K');
  await expect(page.getByRole('alert')).toHaveText('Include the modifier you hold while cycling (Alt, Cmd or Ctrl).');
  await recorder.press('Escape');
  await page.getByRole('button', { name: 'Clear close highlighted tab shortcut' }).click();
  await expect(recorder).toHaveText('Not set');
  await page.reload();
  await expect(recorder).toHaveText('Not set');
});

test('idle tabs are archived, and the palette reopens them', async ({ worker, windowId, panel }) => {
  test.setTimeout(90_000);
  const tabId = await worker.evaluate(
    async (id) => (await chrome.tabs.create({ windowId: id, url: 'data:text/html,<title>Old notes</title>', active: false })).id!,
    windowId,
  );
  await expect.poll(() => worker.evaluate(async (id) => (await chrome.tabs.get(id)).title, tabId)).toBe('Old notes');
  await worker.evaluate(async (id) => {
    const { tabActivity = {} } = (await chrome.storage.session.get('tabActivity')) as { tabActivity?: Record<string, number> };
    await chrome.storage.session.set({ tabActivity: { ...tabActivity, [id]: Date.now() - 48 * 3_600_000 } });
    await chrome.alarms.create('archive-idle-tabs', { when: Date.now() + 50 });
  }, tabId);
  await expect.poll(async () => (await stripState(worker, windowId)).some((tab) => tab.id === tabId), { timeout: 45_000 }).toBe(false);

  await panel.getByRole('button', { name: /^Search tabs and pins/ }).click();
  await panel.getByRole('combobox').fill('old notes');
  await expect(panel.getByRole('option').first()).toContainText('Archived');
  await panel.getByRole('combobox').press('Enter');
  await expect.poll(async () => (await stripState(worker, windowId)).some((tab) => tab.url.includes('Old notes'))).toBe(true);
});
