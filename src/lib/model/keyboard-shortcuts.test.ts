import { expect, it } from 'vitest';
import { groupKeyboardShortcuts } from './keyboard-shortcuts';

it('groups opposite actions together and keeps unassigned actions visible', () => {
  const groups = groupKeyboardShortcuts([
    { name: 'cycle-recent-tabs-previous', description: 'Backward', keys: '' },
    { name: 'toggle-sidebar', description: 'Sidebar', keys: 'Alt+S' },
    { name: 'cycle-recent-tabs', description: 'Forward', keys: '' },
  ]);
  expect(groups.map((group) => group.title)).toEqual(['General', 'Cycle through preview', 'Volets', 'Tabs']);
  expect(groups[1]?.shortcuts.map((shortcut) => shortcut.name)).toEqual(['cycle-recent-tabs', 'cycle-recent-tabs-previous']);
  expect(groups[1]?.shortcuts.every((shortcut) => shortcut.keys === '')).toBe(true);
});
