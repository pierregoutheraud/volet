import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium, expect } from '@playwright/test';
import { ExtensionDiagnostics } from './extension-diagnostics.mjs';
import { smokeExtensionPages, smokeRecentTabs } from './extension-smoke.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const pathFlag = process.argv.indexOf('--extension');
// The end-to-end build by default (`wxt build --mode e2e`): its shadow roots are open, so the smoke check can reach the switcher.
const source = pathFlag < 0 ? path.join(root, 'output/chrome-mv3-e2e') : process.argv[pathFlag + 1];
if (!source) throw new Error('Extension check needs a path after --extension');
const directory = await mkdtemp(path.join(tmpdir(), 'volet-extension-check-'));
const extension = path.join(directory, 'extension');
const reportPath = path.join(root, 'test-results/extension-check/report.json');
const server = createServer((request, response) => {
  response.setHeader('Content-Type', 'text/html; charset=utf-8');
  response.end(`<title>Extension check ${request.url}</title><h1>Extension check</h1>`);
});
let context;
let diagnostics;

try {
  // A disposable copy, reloaded in a disposable profile: the user's browser and build stay unchanged.
  await cp(source, extension, { recursive: true });
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('Extension check server did not start');
  const baseUrl = `http://127.0.0.1:${address.port}`;
  context = await chromium.launchPersistentContext(path.join(directory, 'profile'), {
    channel: 'chromium', headless: true,
    args: [`--disable-extensions-except=${extension}`, `--load-extension=${extension}`],
  });
  context.setDefaultTimeout(8_000);
  diagnostics = new ExtensionDiagnostics(context);
  let worker = context.serviceWorkers()[0] ?? await context.waitForEvent('serviceworker');
  const extensionId = new URL(worker.url()).host;
  const origin = `chrome-extension://${extensionId}`;
  const manager = await context.newPage();
  await manager.goto('chrome://extensions/');
  await manager.evaluate(async (id) => {
    await chrome.developerPrivate.updateProfileConfiguration({ inDeveloperMode: true });
    await chrome.developerPrivate.updateExtensionConfiguration({ extensionId: id, errorCollection: true });
  }, extensionId);
  const scenario = async (name, action) => {
    diagnostics.phase(name);
    try { await action(); }
    catch (error) { diagnostics.add('scenario', error instanceof Error ? error.message : String(error)); }
    await diagnostics.collect(manager, extensionId);
  };
  const ready = () => expect.poll(() => worker.evaluate(async () =>
    Boolean((await chrome.storage.local.get('root')).root)), { timeout: 10_000 }).toBe(true);
  await scenario('startup and extension pages', async () => {
    await ready();
    await smokeExtensionPages(context, worker, origin);
  });
  const previous = await context.newPage();
  await previous.goto(`${baseUrl}/previous`);
  const current = await context.newPage();
  await current.goto(`${baseUrl}/current`);
  await scenario('website preview', () => smokeRecentTabs(context, worker, current, baseUrl));
  for (let attempt = 1; attempt <= 2; attempt++) {
    await scenario(`extension reload ${attempt}`, async () => {
      const [nextWorker, loadError] = await Promise.all([
        context.waitForEvent('serviceworker', { predicate: (next) => next.url().startsWith(origin) }),
        manager.evaluate((id) => chrome.developerPrivate.reload(id, { failQuietly: true }), extensionId),
      ]);
      if (loadError) throw new Error(`Extension check reload failed: ${JSON.stringify(loadError)}`);
      worker = nextWorker;
      await ready();
      await smokeExtensionPages(context, worker, origin);
      // Keep existing website tabs open: reloading them first would hide stale content-script errors.
      await smokeRecentTabs(context, worker, current, baseUrl);
    });
  }
  await scenario('fresh website after reload', async () => {
    await current.reload();
    await smokeRecentTabs(context, worker, current, baseUrl);
  });
} catch (error) {
  if (diagnostics) diagnostics.add('check', error instanceof Error ? error.stack || error.message : String(error));
  else { console.error(error); process.exitCode = 1; }
} finally {
  if (diagnostics) {
    const entries = diagnostics.entries;
    await mkdir(path.dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify({ extension: source, entries }, null, 2) + '\n');
    for (const entry of entries) console.error(`[${entry.phase}] ${entry.kind}: ${entry.message}\n${entry.source || ''}`);
    console.log(`Extension check: ${entries.length ? `${entries.length} issue(s)` : 'no errors or warnings'}. Report: ${reportPath}`);
    if (entries.length) process.exitCode = 1;
  }
  await context?.close();
  await new Promise((resolve) => server.close(resolve));
  await rm(directory, { recursive: true, force: true });
}
