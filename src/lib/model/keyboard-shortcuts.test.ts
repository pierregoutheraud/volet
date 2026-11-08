import { expect, it } from 'vitest';
import { groupKeyboardShortcuts } from './keyboard-shortcuts';

it('groups opposite actions together and keeps unassigned actions visible', () => {
  const groups = groupKeyboardShortcuts([
    { name: 'cycle-recent-tabs', description: 'Cycle', keys: '' },
    { name: 'toggle-sidebar', description: 'Sidebar', keys: 'Alt+S' },
    { name: 'cycle-recent-tabs-reverse', description: 'Reverse', keys: '' },
  ]);
  expect(groups.map((group) => group.title)).toEqual(['General', 'Tab switcher', 'Volets', 'Tabs']);
  expect(groups[1]?.shortcuts.map((shortcut) => shortcut.name)).toEqual(['cycle-recent-tabs', 'cycle-recent-tabs-reverse']);
  expect(groups[1]?.shortcuts.every((shortcut) => shortcut.keys === '')).toBe(true);
});
