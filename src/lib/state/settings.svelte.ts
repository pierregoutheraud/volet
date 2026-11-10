import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, archiveItem, completeSettings, settingsItem, type Settings } from '@/lib/engine/storage';
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
  collapsedFoldersShowOpenTabs = $state(DEFAULT_SETTINGS.collapsedFoldersShowOpenTabs);
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
    this.#show(settings);
    this.archivedCount = archive.length;
    settingsItem.watch((next) => this.#show(next));
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
    await this.#save({ archiveAfterHours: hours });
  }

  async setCollapsedFoldersShowOpenTabs(on: boolean): Promise<void> {
    this.collapsedFoldersShowOpenTabs = on;
    await this.#save({ collapsedFoldersShowOpenTabs: on });
  }

  #show(stored: Partial<Settings> | null): void {
    const settings = completeSettings(stored);
    this.archiveAfterHours = settings.archiveAfterHours;
    this.collapsedFoldersShowOpenTabs = settings.collapsedFoldersShowOpenTabs;
  }

  async #save(change: Partial<Settings>): Promise<void> {
    await settingsItem.setValue({ ...completeSettings(await settingsItem.getValue()), ...change });
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
