import { browser } from 'wxt/browser';
import {
  DEFAULT_SETTINGS,
  arcInviteItem,
  completeSettings,
  openPanelsItem,
  panelSideKeptItem,
  settingsItem,
} from '@/lib/engine/storage';
import type { KeyboardShortcut } from '@/lib/model/keyboard-shortcuts';
import { type PanelSide, WELCOME_SHORTCUTS, type WelcomeClient } from '@/lib/model/welcome';
import { editShortcuts, readShortcuts } from './shortcuts';

/**
 * The welcome page's data, read from Chrome. What the user changes in Chrome's own UI (the panel's side, the pinned
 * icon, shortcuts) has no event to follow, or not on every Chrome: the page asks again when it comes back to the
 * front (`refresh`).
 */
export class ChromeWelcomeClient implements WelcomeClient {
  panelSeen = $state(false);
  side = $state<PanelSide | null>(null);
  sideKept = $state(false);
  onToolbar = $state(false);
  shortcuts = $state.raw<KeyboardShortcut[]>([]);
  archiveAfterHours = $state(DEFAULT_SETTINGS.archiveAfterHours);
  arcInvite = $state(false);

  /** The page's window, read ahead: `sidePanel.open` must run in the click itself, with no await before it. */
  #windowId: number | undefined;

  async start(): Promise<void> {
    const [openPanels, sideKept, settings, arcInvite] = await Promise.all([
      openPanelsItem.getValue(),
      panelSideKeptItem.getValue(),
      settingsItem.getValue(),
      arcInviteItem.getValue(),
      this.refresh(),
    ]);
    this.#seePanels(openPanels);
    this.sideKept = sideKept;
    this.archiveAfterHours = completeSettings(settings).archiveAfterHours;
    this.arcInvite = arcInvite;
    openPanelsItem.watch((next) => this.#seePanels(next));
    panelSideKeptItem.watch((next) => (this.sideKept = next));
    settingsItem.watch((next) => (this.archiveAfterHours = completeSettings(next).archiveAfterHours));
    arcInviteItem.watch((next) => (this.arcInvite = next));
    // Chrome 130: the icon pinned or unpinned while the page shows.
    browser.action.onUserSettingsChanged?.addListener(({ isOnToolbar }) => {
      if (isOnToolbar !== undefined) this.onToolbar = isOnToolbar;
    });
  }

  /** Read again what the user may have changed in Chrome's own pages: the panel's side, the icon, shortcuts. */
  async refresh(): Promise<void> {
    const [window, side, userSettings, shortcuts] = await Promise.all([
      browser.windows.getCurrent(),
      panelSide(),
      browser.action.getUserSettings(),
      readShortcuts(WELCOME_SHORTCUTS),
    ]);
    this.#windowId = window.id;
    this.side = side;
    this.onToolbar = userSettings.isOnToolbar;
    this.shortcuts = shortcuts;
  }

  openPanel(): void {
    // Done once asked, also where Chrome doesn't report the panel opening (before Chrome 141).
    this.panelSeen = true;
    if (this.#windowId === undefined) return;
    browser.sidePanel.open({ windowId: this.#windowId }).catch((error) => console.warn('open side panel', error));
  }

  openSideSettings(): void {
    // Chrome's settings searched for the option: it shows alone, highlighted, wherever Chrome files it.
    void browser.tabs.create({ url: 'chrome://settings/?search=Side+panel+position' });
  }

  keepSide(): void {
    this.sideKept = true;
    void panelSideKeptItem.setValue(true);
  }

  editShortcuts(): void {
    void editShortcuts();
  }

  openSettings(): void {
    void browser.runtime.openOptionsPage();
  }

  openImport(): void {
    void browser.tabs.create({ url: browser.runtime.getURL('/import.html') });
  }

  dismissArc(): void {
    this.arcInvite = false;
    void arcInviteItem.setValue(false);
  }

  /** Once the panel has shown in any window, the step stays done, even after it's closed. */
  #seePanels(panels: Record<string, true>): void {
    if (Object.keys(panels).length > 0) this.panelSeen = true;
  }
}

/** Where Chrome shows side panels, or null where it can't say (`getLayout` arrived in Chrome 140). */
async function panelSide(): Promise<PanelSide | null> {
  if (!browser.sidePanel.getLayout) return null;
  try {
    return (await browser.sidePanel.getLayout()).side;
  } catch {
    return null;
  }
}
