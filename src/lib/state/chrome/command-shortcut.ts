import { browser } from 'wxt/browser';
import { commandShortcut } from '@/lib/model/shortcut-display';

/**
 * Hear a command's shortcut as Chrome shows it (`⌃M`), now and whenever it may have changed. Chrome reports no change
 * to shortcuts, so the panel reads it again as it gets focus or the pointer comes back (maybe from Chrome's page for
 * them).
 */
export function watchCommandShortcut(name: string, onchange: (shortcut: string) => void): void {
  const read = () => {
    browser.commands.getAll().then((commands) => onchange(commandShortcut(commands, name))).catch(() => undefined);
  };
  read();
  document.documentElement.addEventListener('pointerenter', read);
  window.addEventListener('focus', read);
}
