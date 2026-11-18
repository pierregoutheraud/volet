import type { Page, Worker } from '@playwright/test';
import { expect, test } from './fixtures';

// The e2e build doesn't open the welcome page on install (every test installs anew): these open it themselves.

const extensionPage = (worker: Worker, path: string) => `chrome-extension://${new URL(worker.url()).host}/${path}`;

async function openWelcome(page: Page, worker: Worker) {
  await page.goto(extensionPage(worker, 'welcome.html'));
  await expect(page.getByRole('heading', { name: 'Welcome to Volet', level: 1 })).toBeVisible();
}

const step = (page: Page, title: string) => page.getByRole('listitem', { name: title, exact: true });

function sidePanelCount(worker: Worker) {
  return worker.evaluate(
    async () =>
      (await chrome.runtime.getContexts({ contextTypes: ['SIDE_PANEL' as chrome.runtime.ContextType] })).length,
  );
}

test('the checklist opens the side panel from the page', async ({ context, worker }) => {
  const page = await context.newPage();
  await openWelcome(page, worker);
  await expect(page.getByText('0 of 3')).toBeVisible();
  await expect(step(page, 'Open Volet')).toHaveAttribute('data-step', 'todo');

  await page.getByRole('button', { name: 'Open Volet' }).click();
  await expect.poll(() => sidePanelCount(worker)).toBe(1);
  await expect(step(page, 'Open Volet')).toHaveAttribute('data-step', 'done');
  await expect(page.getByText('1 of 3')).toBeVisible();
});

test('the side step follows Chrome, and keeping the panel on the right settles it for good', async ({
  context,
  worker,
}) => {
  const side = await worker.evaluate(async () => (await chrome.sidePanel.getLayout()).side);
  expect(side).toBe('right');
  const page = await context.newPage();
  await openWelcome(page, worker);
  await expect(step(page, 'Choose a side')).toContainText('Volet is on the right');

  await page.getByRole('button', { name: 'Keep it on the right' }).click();
  await expect(step(page, 'Choose a side')).toHaveAttribute('data-step', 'done');
  await expect(step(page, 'Choose a side')).toContainText('On the right');
  await expect
    .poll(() => worker.evaluate(async () => (await chrome.storage.local.get('panelSideKept')).panelSideKept))
    .toBe(true);

  await page.reload();
  await expect(step(page, 'Choose a side')).toHaveAttribute('data-step', 'done');
});

test("the side step's settings button opens Chrome's settings, searched for the option", async ({ context, worker }) => {
  const page = await context.newPage();
  await openWelcome(page, worker);
  const opened = context.waitForEvent('page', (next) => next.url() === 'chrome://settings/?search=Side+panel+position');
  await page.getByRole('button', { name: 'Move to the left' }).click();
  await opened;
});

test('the Arc card shares its flag with the sidebar', async ({ context, worker, panel }) => {
  // A first install sets the flag, so the panel shows its card too.
  await expect(panel.getByRole('complementary', { name: 'Coming from Arc?' })).toBeVisible();
  const page = await context.newPage();
  await openWelcome(page, worker);
  await expect(page.getByRole('heading', { name: 'Coming from Arc?' })).toBeVisible();

  await page.getByRole('button', { name: 'Dismiss' }).click();
  await expect(page.getByRole('heading', { name: 'Coming from Arc?' })).toBeHidden();
  await expect(panel.getByRole('complementary', { name: 'Coming from Arc?' })).toBeHidden();
  expect(await worker.evaluate(async () => (await chrome.storage.local.get('arcInvite')).arcInvite)).toBe(false);
});

test('settings open the welcome page again', async ({ context, worker }) => {
  const settings = await context.newPage();
  await settings.goto(extensionPage(worker, 'options.html'));
  const opened = context.waitForEvent('page', (next) => next.url().endsWith('/welcome.html'));
  await settings.getByRole('button', { name: 'Open the welcome page' }).click();
  const page = await opened;
  await expect(page.getByRole('heading', { name: 'Welcome to Volet', level: 1 })).toBeVisible();
});
