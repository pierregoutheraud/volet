import { matchesPreviewCloseShortcut } from './preview-close-shortcut';

/** What a key does while the switcher is open, wherever it's pressed: on the page, in one of its frames or in the Volet panel. */
export type RecentTabKey = 'cancel' | 'choose' | 'next' | 'previous' | 'close';

/**
 * Keys a relay reports to the page showing the switcher (the Volet panel or a frame of the page, whichever has focus),
 * plus letting go of the modifier and losing focus mid-gesture.
 */
export type RelayKey = RecentTabKey | 'release' | 'leave';

const RELAY_KEYS: readonly RelayKey[] = ['cancel', 'choose', 'next', 'previous', 'close', 'release', 'leave'];

/** The close shortcut must match exactly; the others are plain keys pressed with the modifier still held. */
export function recentTabKey(event: Parameters<typeof matchesPreviewCloseShortcut>[0], closeShortcut: string): RecentTabKey | undefined {
  if (matchesPreviewCloseShortcut(event, closeShortcut)) return 'close';
  switch (event.key) {
    case 'Escape': return 'cancel';
    case 'Enter': return 'choose';
    case 'ArrowRight': return 'next';
    case 'ArrowLeft': return 'previous';
    default: return undefined;
  }
}

/** Validate a relayed key at the extension message boundary. */
export function isRelayKey(value: unknown): value is RelayKey {
  return RELAY_KEYS.includes(value as RelayKey);
}

/** Whether a relay's answer says it holds the modifier (`{ holds: true }`); anything else, or no answer, means no. */
export function holdsModifier(answer: unknown): boolean {
  return typeof answer === 'object' && answer !== null && 'holds' in answer && answer.holds === true;
}
