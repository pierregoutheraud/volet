/** Chrome reports platform-formatted shortcuts, including modifier symbols on macOS. */
export type CycleModifier = 'metaKey' | 'ctrlKey' | 'altKey';

/** Find the primary held modifier from Chrome's configured shortcut. Shift is optional. */
export function recentTabModifier(shortcut: string): CycleModifier | undefined {
  if (/Command|Cmd|⌘/i.test(shortcut)) return 'metaKey';
  if (/Ctrl|Control|⌃/i.test(shortcut)) return 'ctrlKey';
  if (/Alt|Option|⌥/i.test(shortcut)) return 'altKey';
  return undefined;
}
