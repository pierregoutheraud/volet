import { keyboardShortcutFromEvent } from './keyboard-shortcut';

/** Browser-reserved tab and window commands cannot close a highlighted preview safely. */
export function previewShortcutError(shortcut: string): string {
  return /^(Cmd|Ctrl)\+(Shift\+)?[WQTN]$/.test(shortcut)
    ? 'Chrome reserves this shortcut. Choose another combination.' : '';
}

/** Empty means unbound; every modifier must match the explicitly recorded close shortcut. */
export function matchesPreviewCloseShortcut(event: Parameters<typeof keyboardShortcutFromEvent>[0], shortcut: string): boolean {
  return shortcut !== '' && !previewShortcutError(shortcut) && keyboardShortcutFromEvent(event) === shortcut;
}
