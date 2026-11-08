import { keyboardShortcutFromEvent } from './keyboard-shortcut';

/** Keys the switcher already uses while it's open (Escape can't be recorded: it stops recording). */
const SWITCHER_KEYS = ['Enter', 'ArrowLeft', 'ArrowRight'];

/**
 * Why a close shortcut can't work, or '' when it can: Chrome keeps its tab and window commands, the switcher's own
 * keys would stop doing what they do, and the cycling modifier is always held, so a shortcut needs one.
 */
export function previewShortcutError(shortcut: string): string {
  if (/^(Cmd|Ctrl)\+(Shift\+)?[WQTN]$/.test(shortcut)) return 'Chrome reserves this shortcut. Choose another combination.';
  const parts = shortcut.split('+');
  if (SWITCHER_KEYS.includes(parts.at(-1) ?? '')) return "Volet's switcher uses this key. Choose another combination.";
  if (!parts.some((part) => part === 'Cmd' || part === 'Ctrl' || part === 'Alt')) {
    return 'Include the modifier you hold while cycling (Alt, Cmd or Ctrl).';
  }
  return '';
}

/** Empty means unbound; every modifier must match the explicitly recorded close shortcut. */
export function matchesPreviewCloseShortcut(event: Parameters<typeof keyboardShortcutFromEvent>[0], shortcut: string): boolean {
  return shortcut !== '' && !previewShortcutError(shortcut) && keyboardShortcutFromEvent(event) === shortcut;
}
