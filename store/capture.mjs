// Renders the Chrome Web Store images into store/images/ (`pnpm store:images`).
// The scenes live in proto/store.ts (copy, starting state) and proto/StoreFrame.svelte (layout); this script serves
// them with the prototype's Vite config and drives them with Playwright (palette, menus, a drag in progress).
// The prototype loads favicons from Google's favicon service, so it needs the network.
import { mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { createServer } from 'vite';

const root = new URL('../', import.meta.url);
const output = new URL('images/', import.meta.url);
mkdirSync(output, { recursive: true });

/**
 * Screenshots are laid out at 1024x640 and captured at 1.25x: 1280x800 pixels, everything scaled alike.
 * The order is the listing's.
 */
const SHOTS = [
  { file: '1-sidebar.png', scene: 'sidebar' },
  { file: '2-volets.png', scene: 'volets' },
  { file: '3-palette.png', scene: 'palette', act: openPalette },
  { file: '4-drag.png', scene: 'drag', act: dragTabToPins },
  { file: '5-arc.png', scene: 'arc' },
  { file: 'promo-440x280.png', scene: 'promo', size: [440, 280], scale: 1 },
  { file: 'marquee-1400x560.png', scene: 'marquee', size: [1400, 560], scale: 1 },
];

/** Search shows under the headline with the keyboard in it, as over a page: type into it. */
async function openPalette(page) {
  await page.keyboard.type('de', { delay: 40 });
}

/** Hold a tab mid-drag over the pins: the preview follows the pointer and a line shows where it would land. */
async function dragTabToPins(page) {
  // A row well away from the list's bottom edge, which would scroll the list.
  const from = await page.getByRole('button', { name: /Svelte Docs/ }).first().boundingBox();
  const to = await page.getByRole('button', { name: /My issues/ }).first().boundingBox();
  const x = from.x + 24;
  await page.mouse.move(x, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(x, from.y + from.height / 2 - 10, { steps: 4 });
  // The lower edge of "My issues": the line shows between it and the next pin. A little to the right, as a hand
  // would drag, so the line shows past the preview's left end.
  await page.mouse.move(x + 60, to.y + to.height - 3, { steps: 20 });
}

const server = await createServer({
  configFile: fileURLToPath(new URL('vite.proto.config.ts', root)),
  server: { port: 0 },
  logLevel: 'warn',
});
await server.listen();
const base = server.resolvedUrls.local[0];

const browser = await chromium.launch();
try {
  for (const { file, scene, act, size = [1024, 640], scale = 1.25 } of SHOTS) {
    const page = await browser.newPage({ viewport: { width: size[0], height: size[1] }, deviceScaleFactor: scale });
    await page.goto(`${base}store.html?scene=${scene}`);
    await page.waitForLoadState('networkidle');
    await page.evaluate(() => document.fonts.ready);
    await act?.(page);
    // Let transitions (tint, menus, the drag preview) settle.
    await page.waitForTimeout(700);
    await page.screenshot({ path: fileURLToPath(new URL(file, output)) });
    await page.close();
    console.log(`Rendered store/images/${file}`);
  }
} finally {
  await browser.close();
  await server.close();
}
