import type { KeyboardShortcut } from './keyboard-shortcuts';

/** Where Chrome shows side panels (Settings, Appearance, Side panel position). */
export type PanelSide = 'left' | 'right';

/** What the welcome page's setup checklist reads from Chrome. */
export interface SetupState {
  /** The side panel has shown in some window since the page opened. */
  readonly panelSeen: boolean;
  /** Where Chrome shows side panels; null where Chrome can't tell (before Chrome 140). */
  readonly side: PanelSide | null;
  /** The user chose to keep the panel where it is (`panelSideKeptItem`). */
  readonly sideKept: boolean;
  /** Volet's icon is pinned to Chrome's toolbar. */
  readonly onToolbar: boolean;
}

export type SetupStepId = 'open' | 'side' | 'pin';

export interface SetupStep {
  id: SetupStepId;
  done: boolean;
}

/** The checklist's steps, in page order. Pure. */
export function setupSteps(state: SetupState): SetupStep[] {
  return [
    { id: 'open', done: state.panelSeen },
    { id: 'side', done: state.side === 'left' || state.sideKept },
    { id: 'pin', done: state.onToolbar },
  ];
}

/** How far along the checklist is. */
export function setupProgress(steps: readonly SetupStep[]): { done: number; total: number; allDone: boolean } {
  const done = steps.filter((step) => step.done).length;
  return { done, total: steps.length, allDone: done === steps.length };
}

/** The shortcuts the welcome page lists, in its order: the sidebar, Search, the tab switcher. */
export const WELCOME_SHORTCUTS = ['toggle-sidebar', 'open-palette', 'cycle-recent-tabs'];

/** "12 hours", "a day", "3 days", "a week": how long an unused tab stays open. Empty when tabs are never closed. */
export function archiveDelayText(hours: number): string {
  if (hours <= 0) return '';
  if (hours === 168) return 'a week';
  if (hours % 24 === 0) return hours === 24 ? 'a day' : `${hours / 24} days`;
  return hours === 1 ? 'an hour' : `${hours} hours`;
}

/**
 * The welcome page's link to Chrome: the checklist's live state, the shortcuts and settings it mentions, and the
 * "Coming from Arc?" card (`arcInviteItem`, shared with the sidebar's card).
 */
export interface WelcomeClient extends SetupState {
  /** The `WELCOME_SHORTCUTS`, as Chrome has them assigned. */
  readonly shortcuts: readonly KeyboardShortcut[];
  /** Settings' "Close unpinned tabs I haven't used for" (0: never). */
  readonly archiveAfterHours: number;
  /** Show the "Coming from Arc?" card. */
  readonly arcInvite: boolean;
  /** Open the side panel in the page's window. Call it from the click itself: Chrome needs the gesture. */
  openPanel(): void;
  /** Chrome's settings, searched for Side panel position. */
  openSideSettings(): void;
  /** Keep the panel on its side (the right): the step is done. */
  keepSide(): void;
  editShortcuts(): void;
  openSettings(): void;
  openImport(): void;
  dismissArc(): void;
  /** Read again what may have changed in Chrome's own pages (the page calls it when it comes back to the front). */
  refresh(): Promise<void>;
}
