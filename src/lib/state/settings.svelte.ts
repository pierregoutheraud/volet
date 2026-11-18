import { browser } from 'wxt/browser';
import { DEFAULT_SETTINGS, archiveItem, completeSettings, settingsItem, type Settings } from '@/lib/engine/storage';
import { KEYBOARD_SHORTCUT_GROUPS, type KeyboardShortcut } from '@/lib/model/keyboard-shortcuts';
import { editShortcuts, readShortcuts } from './shortcuts';

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
    this.shortcuts = await readShortcuts(SHORTCUT_ORDER);
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
    await editShortcuts();
  }

  async openImport(): Promise<void> {
    await browser.tabs.create({ url: browser.runtime.getURL('/import.html') });
  }

  /** The welcome page: the setup checklist and the basics, as shown after install. */
  async openWelcome(): Promise<void> {
    await browser.tabs.create({ url: browser.runtime.getURL('/welcome.html') });
  }
}
