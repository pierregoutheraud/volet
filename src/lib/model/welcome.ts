import type { KeyboardShortcut } from './keyboard-shortcuts';
import { normalizeShortcutKeys } from './shortcut-display';

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
  /** The Arc import is still offered (`arcInviteItem`, shared with the sidebar's "Coming from Arc?" card). */
  readonly arcInvite: boolean;
  /** Arc Spaces have come in on this device (`importedArcSpacesItem`). */
  readonly arcImported: boolean;
}

export type SetupStepId = 'open' | 'side' | 'pin' | 'arc';

export interface SetupStep {
  id: SetupStepId;
  done: boolean;
  /** Not needed to be set up (the pinned icon, the Arc import): left out of the progress. */
  optional?: true;
  /** An optional step set aside without doing it. */
  skipped?: boolean;
}

/** The checklist's steps, in page order. Pure. */
export function setupSteps(state: SetupState): SetupStep[] {
  return [
    { id: 'open', done: state.panelSeen },
    { id: 'side', done: state.side === 'left' || state.sideKept },
    // Ctrl+B opens Volet as well: the icon is a convenience.
    { id: 'pin', done: state.onToolbar, optional: true },
    { id: 'arc', done: state.arcImported, optional: true, skipped: !state.arcImported && !state.arcInvite },
  ];
}

/** How far along the checklist is, counting the steps it needs (not the optional ones). */
export function setupProgress(steps: readonly SetupStep[]): { done: number; total: number; allDone: boolean } {
  const needed = steps.filter((step) => !step.optional);
  const done = needed.filter((step) => step.done).length;
  return { done, total: needed.length, allDone: done === needed.length };
}

/** The shortcuts the welcome page shows, in its order, by the short name it gives each. */
const WELCOME_SHORTCUT_LABELS: Record<string, string> = {
  'toggle-sidebar': 'Sidebar',
  'open-palette': 'Search',
  'cycle-recent-tabs': 'Recent tabs',
};
export const WELCOME_SHORTCUTS = Object.keys(WELCOME_SHORTCUT_LABELS);

/** The welcome page's row of shortcuts: the assigned ones, in its order, with their short names. Pure. */
export function welcomeShortcuts(shortcuts: readonly KeyboardShortcut[]): { label: string; keys: string }[] {
  return WELCOME_SHORTCUTS.flatMap((name) => {
    const keys = normalizeShortcutKeys(shortcuts.find((shortcut) => shortcut.name === name)?.keys ?? '');
    return keys ? [{ label: WELCOME_SHORTCUT_LABELS[name]!, keys }] : [];
  });
}

/** The welcome page's link to Chrome: the checklist's live state, and the shortcuts it shows. */
export interface WelcomeClient extends SetupState {
  /** The `WELCOME_SHORTCUTS`, as Chrome has them assigned. */
  readonly shortcuts: readonly KeyboardShortcut[];
  /** Open the side panel in the page's window. Call it from the click itself: Chrome needs the gesture. */
  openPanel(): void;
  /** Chrome's settings, searched for Side panel position. */
  openSideSettings(): void;
  /** Keep the panel on its side (the right): the step is done. */
  keepSide(): void;
  openSettings(): void;
  openImport(): void;
  /** Skip the Arc step: the sidebar's "Coming from Arc?" card goes too. */
  dismissArc(): void;
  /** Read again what may have changed in Chrome's own pages (the page calls it when it comes back to the front). */
  refresh(): Promise<void>;
}
