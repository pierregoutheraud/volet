import { expect, it } from 'vitest';
import { CYCLE_COMMAND, REVERSE_COMMAND, cycleShortcut, hasRecentTabShortcut, recentTabOffset } from './recent-tab-shortcut';

it('cycles to older tabs, and in reverse to newer ones, like Cmd+Tab and Cmd+Shift+Tab', () => {
  // Visiting A, B, then C lists C, B, A: cycling twice goes from C to B to A.
  expect(recentTabOffset(CYCLE_COMMAND)).toBe(1);
  expect(recentTabOffset(REVERSE_COMMAND)).toBe(-1);
});

it('is on while either shortcut is assigned, and off once both are removed', () => {
  const commands = (cycle: string, reverse: string) => [
    { name: 'toggle-sidebar', shortcut: '⌥S' },
    { name: CYCLE_COMMAND, shortcut: cycle },
    { name: REVERSE_COMMAND, shortcut: reverse }
  ];
  expect(hasRecentTabShortcut(commands('⌥,', '⌥.'))).toBe(true);
  expect(hasRecentTabShortcut(commands('', '⌥.'))).toBe(true);
  expect(hasRecentTabShortcut(commands('⌥,', ''))).toBe(true);
  expect(hasRecentTabShortcut(commands('', ''))).toBe(false);
  expect(hasRecentTabShortcut([{ name: 'toggle-sidebar', shortcut: '⌥S' }])).toBe(false);
});

it("shows the cycling shortcut as Chrome does, and none while it's unassigned", () => {
  const commands = (cycle?: string) => [
    { name: 'toggle-sidebar', shortcut: '⌃B' },
    { name: REVERSE_COMMAND, shortcut: '⌃⇧Q' },
    { name: CYCLE_COMMAND, shortcut: cycle },
  ];
  expect(cycleShortcut(commands('⌃Q'))).toBe('⌃Q');
  expect(cycleShortcut(commands('Ctrl+Q'))).toBe('Ctrl+Q');
  expect(cycleShortcut(commands(''))).toBe('');
  expect(cycleShortcut(commands())).toBe('');
});
