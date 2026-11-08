type SuggestedShortcut = string | { default?: string; mac?: string; windows?: string; linux?: string; chromeos?: string };

/** Normalize Chrome's symbols and recorder strings before comparing or displaying shortcuts. */
export function normalizeShortcutKeys(value: string): string {
  const symbols: Record<string, string> = { '⌘': 'Cmd+', '⌃': 'Ctrl+', '⌥': 'Alt+', '⇧': 'Shift+' };
  const names: Record<string, string> = {
    Command: 'Cmd', Control: 'Ctrl', MacCtrl: 'Ctrl', Option: 'Alt',
    ',': 'Comma', '.': 'Period', '⌫': 'Backspace', '⌦': 'Delete',
    Up: 'ArrowUp', Down: 'ArrowDown', Left: 'ArrowLeft', Right: 'ArrowRight',
  };
  const parts = value.replace(/[⌘⌃⌥⇧]/g, (symbol) => symbols[symbol] ?? symbol)
    .split('+').filter(Boolean).map((part) => names[part] ?? part);
  const modifiers = ['Cmd', 'Ctrl', 'Alt', 'Shift'];
  return [...modifiers.filter((modifier) => parts.includes(modifier)),
    ...parts.filter((part) => !modifiers.includes(part))].join('+');
}

/** Resolve manifest defaults on the current OS, including Chrome's Ctrl-to-Command mapping on macOS. */
export function defaultShortcutKeys(suggested: SuggestedShortcut | undefined, os: string): string {
  const platform = os === 'win' ? 'windows' : os === 'cros' ? 'chromeos' : os;
  const shortcut = typeof suggested === 'string' ? suggested
    : suggested?.[platform === 'mac' || platform === 'windows' || platform === 'linux' || platform === 'chromeos'
      ? platform : 'default'] ?? suggested?.default ?? '';
  return normalizeShortcutKeys(os === 'mac' ? shortcut.replace(/\bCtrl\b/g, 'Command') : shortcut);
}

/** An empty binding stays unassigned even when a manifest default exists. */
export function shortcutBindingKind(value: string, defaultKeys = ''): 'unset' | 'default' | 'custom' {
  if (!value) return 'unset';
  return normalizeShortcutKeys(value) === normalizeShortcutKeys(defaultKeys) ? 'default' : 'custom';
}
