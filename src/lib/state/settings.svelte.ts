import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, archiveItem, settingsItem } from '@/lib/engine/storage';
import { KEYBOARD_SHORTCUT_GROUPS, type KeyboardShortcut } from '@/lib/model/keyboard-shortcuts';
import { defaultShortcutKeys } from '@/lib/model/shortcut-display';

/**
 * The shortcuts the manifest declares, listed in this order (Chrome returns them in no particular one). Chrome also
 * lists `_execute_action` (clicking the toolbar icon), which the sidebar shortcut already covers.
 */
const SHORTCUT_ORDER = KEYBOARD_SHORTCUT_GROUPS.flatMap((group) => group.commands);

/** The settings page's data: preferences, shortcuts, the archive. Preferences are written directly. */
export class SettingsStore {
  archiveAfterHours = $state(DEFAULT_SETTINGS.archiveAfterHours);
  shortcuts = $state.raw<KeyboardShortcut[]>([]);
  archivedCount = $state(0);
  /** The keys that open search, if assigned. */
  readonly searchKeys = $derived(this.shortcuts.find((shortcut) => shortcut.name === 'open-palette')?.keys ?? '');

  async load(): Promise<void> {
    const [settings, , archive] = await Promise.all([
      settingsItem.getValue(),
      this.refreshShortcuts(),
      archiveItem.getValue(),
    ]);
    this.archiveAfterHours = settings.archiveAfterHours;
    this.archivedCount = archive.length;
    settingsItem.watch((next) => (this.archiveAfterHours = next.archiveAfterHours));
    archiveItem.watch((next) => (this.archivedCount = next.length));
  }

  /** Refresh bindings after returning from Chrome's shortcut editor. */
  async refreshShortcuts(): Promise<void> {
    const [commands, platform] = await Promise.all([browser.commands.getAll(), browser.runtime.getPlatformInfo()]);
    const defaults = browser.runtime.getManifest().commands;
    this.shortcuts = commands
      .filter((command) => SHORTCUT_ORDER.includes(command.name ?? ''))
      .map((command) => ({
        name: command.name ?? '',
        description: command.description ?? '',
        keys: command.shortcut ?? '',
        defaultKeys: defaultShortcutKeys(defaults?.[command.name ?? '']?.suggested_key, platform.os),
      }))
      .sort((a, b) => SHORTCUT_ORDER.indexOf(a.name) - SHORTCUT_ORDER.indexOf(b.name));
  }

  async setArchiveAfter(hours: number): Promise<void> {
    this.archiveAfterHours = hours;
    await settingsItem.setValue({ ...(await settingsItem.getValue()), archiveAfterHours: hours });
  }

  async clearArchive(): Promise<void> {
    this.archivedCount = 0;
    await archiveItem.setValue([]);
  }

  /** Chrome's own page for assigning extension shortcuts. */
  async editShortcuts(): Promise<void> {
    await browser.tabs.create({ url: 'chrome://extensions/shortcuts' });
  }

  async openImport(): Promise<void> {
    await browser.tabs.create({ url: browser.runtime.getURL('/import.html') });
  }
}
