/** Native shortcut values come from Chrome, including empty bindings. */
export interface KeyboardShortcut {
  name: string;
  description: string;
  keys: string;
  defaultKeys?: string;
}

/** The group holding the recent tab switcher's shortcuts, followed in settings by its own notes and close shortcut. */
export const TAB_SWITCHER_GROUP = 'Tab switcher';

/** Settings groups are explicit so opposite actions always appear together. */
export const KEYBOARD_SHORTCUT_GROUPS = [
  { title: 'General', commands: ['toggle-sidebar', 'open-palette'] },
  // Cycling before cycling in reverse, as on Chrome's shortcuts page, which sorts by command id.
  { title: TAB_SWITCHER_GROUP, commands: ['cycle-recent-tabs', 'cycle-recent-tabs-reverse'] },
  { title: 'Volets', commands: ['next-space', 'previous-space'] },
  { title: 'Tabs', commands: ['toggle-pin', 'copy-url'] },
];

/** Keep every declared action visible even when its binding is not set. */
export function groupKeyboardShortcuts(shortcuts: readonly KeyboardShortcut[]) {
  return KEYBOARD_SHORTCUT_GROUPS.map((group) => ({
    title: group.title,
    shortcuts: group.commands.flatMap((name) => shortcuts.filter((shortcut) => shortcut.name === name)),
  }));
}
