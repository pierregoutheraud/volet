import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  testMatch: '*.spec.ts',
  timeout: 45_000,
  expect: { timeout: 7_000 },
  // Each test launches its own Chromium with the extension and a fresh profile: they run side by side, tests of one file
  // too. More workers than 4 barely helps (each Chromium is busy), and adds load that timing-sensitive tests feel.
  fullyParallel: true,
  workers: 4,
  reporter: [['list']],
});
