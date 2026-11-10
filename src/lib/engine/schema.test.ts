import { expect, it } from 'vitest';
import { completeSettings, DEFAULT_SETTINGS } from './schema';

it('gives settings saved before a setting existed its default, and keeps what was chosen', () => {
  expect(completeSettings({ archiveAfterHours: 24 })).toEqual({ archiveAfterHours: 24, collapsedFoldersShowOpenTabs: true });
  expect(completeSettings({ archiveAfterHours: 0, collapsedFoldersShowOpenTabs: false }))
    .toEqual({ archiveAfterHours: 0, collapsedFoldersShowOpenTabs: false });
  expect(completeSettings(null)).toEqual(DEFAULT_SETTINGS);
});
