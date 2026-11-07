/** Native shortcut values come from Chrome, including empty bindings. */
export interface KeyboardShortcut {
  name: string;
  description: string;
  keys: string;
}

/** Settings groups are explicit so opposite actions always appear together. */
export const KEYBOARD_SHORTCUT_GROUPS = [
  { title: 'General', commands: ['toggle-sidebar', 'open-palette'] },
  { title: 'Cycle through preview', commands: ['cycle-recent-tabs', 'cycle-recent-tabs-previous'] },
  { title: 'Volets', commands: ['next-space', 'previous-space'] },
  { title: 'Tabs', commands: ['toggle-pin'] },
];

/** Keep every declared action visible even when its binding is not set. */
export function groupKeyboardShortcuts(shortcuts: readonly KeyboardShortcut[]) {
  return KEYBOARD_SHORTCUT_GROUPS.map((group) => ({
    title: group.title,
    shortcuts: group.commands.flatMap((name) => shortcuts.filter((shortcut) => shortcut.name === name)),
  }));
}
