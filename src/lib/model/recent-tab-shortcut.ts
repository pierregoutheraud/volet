/** Chrome reports platform-formatted shortcuts, including modifier symbols on macOS. */
export type CycleModifier = 'metaKey' | 'ctrlKey' | 'altKey';

/** Find the primary held modifier from Chrome's configured shortcut. Shift is optional. */
export function recentTabModifier(shortcut: string): CycleModifier | undefined {
  if (/Command|Cmd|⌘/i.test(shortcut)) return 'metaKey';
  if (/Ctrl|Control|⌃/i.test(shortcut)) return 'ctrlKey';
  if (/Alt|Option|⌥/i.test(shortcut)) return 'altKey';
  return undefined;
}

/** The switcher's two shortcuts, like Cmd+Tab and Cmd+Shift+Tab: cycling goes to older tabs, in reverse to newer ones. */
export const CYCLE_COMMAND = 'cycle-recent-tabs';
export const REVERSE_COMMAND = 'cycle-recent-tabs-reverse';
export type RecentTabCommand = typeof CYCLE_COMMAND | typeof REVERSE_COMMAND;

/**
 * A step along the recent tabs, most recent first, from the current tab: cycling goes one tab further into the past
 * (first, the last used tab), in reverse comes back toward the current tab (first, wrapping to the oldest). See
 * `RecentTabCycle.step`.
 */
export function recentTabOffset(command: RecentTabCommand): 1 | -1 {
  return command === CYCLE_COMMAND ? 1 : -1;
}

/** Whether either switcher shortcut is assigned: removing both turns the switcher off. */
export function hasRecentTabShortcut(commands: readonly { name?: string; shortcut?: string }[]): boolean {
  return commands.some((command) => (command.name === CYCLE_COMMAND || command.name === REVERSE_COMMAND) && Boolean(command.shortcut));
}

/** The cycling shortcut as Chrome shows it (`⌃Q` on a Mac, `Ctrl+Q` elsewhere), or empty while unassigned. */
export function cycleShortcut(commands: readonly { name?: string; shortcut?: string }[]): string {
  return commands.find((command) => command.name === CYCLE_COMMAND)?.shortcut ?? '';
}

/** Validate a modifier at the extension message boundary. */
export function isCycleModifier(value: unknown): value is CycleModifier {
  return value === 'metaKey' || value === 'ctrlKey' || value === 'altKey';
}
