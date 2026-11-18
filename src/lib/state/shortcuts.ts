import { browser } from 'wxt/browser';
import type { KeyboardShortcut } from '@/lib/model/keyboard-shortcuts';
import { defaultShortcutKeys } from '@/lib/model/shortcut-display';

/**
 * The given commands' shortcuts as Chrome has them assigned, in the given order (Chrome returns them in no particular
 * one), each with its manifest default on this platform.
 */
export async function readShortcuts(order: readonly string[]): Promise<KeyboardShortcut[]> {
  const [commands, platform] = await Promise.all([browser.commands.getAll(), browser.runtime.getPlatformInfo()]);
  const defaults = browser.runtime.getManifest().commands;
  return commands
    .filter((command) => order.includes(command.name ?? ''))
    .map((command) => ({
      name: command.name ?? '',
      description: command.description ?? '',
      keys: command.shortcut ?? '',
      defaultKeys: defaultShortcutKeys(defaults?.[command.name ?? '']?.suggested_key, platform.os),
    }))
    .sort((a, b) => order.indexOf(a.name) - order.indexOf(b.name));
}

/** Chrome's own page for assigning extension shortcuts. */
export async function editShortcuts(): Promise<void> {
  await browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
}
