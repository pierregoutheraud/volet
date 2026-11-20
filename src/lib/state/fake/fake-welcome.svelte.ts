import type { KeyboardShortcut } from '@/lib/model/keyboard-shortcuts';
import type { PanelSide, SetupState, WelcomeClient } from '@/lib/model/welcome';

/**
 * The welcome page for the prototype: a fresh install on a Mac, panel on the right. Its buttons do what the user would
 * then do in Chrome (opening Chrome's settings puts the panel on the left); start from other states with `initial`.
 */
export class FakeWelcomeClient implements WelcomeClient {
  panelSeen = $state(false);
  side = $state<PanelSide | null>('right');
  sideKept = $state(false);
  onToolbar = $state(false);
  arcInvite = $state(true);
  arcImported = $state(false);
  readonly shortcuts: readonly KeyboardShortcut[] = [
    { name: 'toggle-sidebar', description: 'Show or hide the sidebar', keys: '⌃B', defaultKeys: 'Ctrl+B' },
    { name: 'open-palette', description: 'Search tabs, pins and archived tabs', keys: '⌃M', defaultKeys: 'Ctrl+M' },
    { name: 'cycle-recent-tabs', description: 'Cycle through recent tabs', keys: '⌃Q', defaultKeys: 'Ctrl+Q' },
  ];

  constructor(initial: Partial<SetupState> = {}) {
    Object.assign(this, initial);
  }

  openPanel(): void {
    this.panelSeen = true;
  }

  openSideSettings(): void {
    console.info('[proto] Chrome would open its settings, searched for Side panel position, here.');
    this.side = 'left';
  }

  keepSide(): void {
    this.sideKept = true;
  }

  openSettings(): void {
    console.info('[proto] The settings page would open here.');
  }

  async refresh(): Promise<void> {}

  openImport(): void {
    console.info('[proto] The import page would open here; this acts as if Spaces came in.');
    this.arcImported = true;
    this.arcInvite = false;
  }

  dismissArc(): void {
    this.arcInvite = false;
  }
}
