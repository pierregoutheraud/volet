/**
 * Search over a page, driven from the Volet panel. Chrome can't move the keyboard from the side panel to the page, so
 * while the panel has it, a hidden field in the panel takes the typing (accents, paste, word moves, input methods) and
 * sends its text and selection to the page, which shows them as its own; the keys that move through the results go as
 * keys. Panel and page talk through one port (`PALETTE_RELAY_PORT`), which keeps messages in order and tells either
 * side when the other is gone: the panel lets go (Search toggled off, a click elsewhere in it, the keyboard gone) and
 * Search closes, unless the user clicked into Search's field, where typing goes on; Search closes (a result ran,
 * Escape, its tab hidden) and the panel's field goes.
 */

/** The worker's message to Search on a page (the shortcut, with the page focused): show it, or close it. */
export const PALETTE_TOGGLE = 'palette:toggle';

/** The name of the port the panel opens to the page's top frame. */
export const PALETTE_RELAY_PORT = 'palette-relay';

/** A field's text and selection (the caret when `start` equals `end`). */
export interface RelayedText {
  value: string;
  start: number;
  end: number;
}

/** What a key does in Search, wherever it's typed. */
export type PaletteKey = 'next' | 'previous' | 'choose' | 'close';

/** From the panel: its field, or a key. */
export type PanelToPage = ({ type: 'text' } & RelayedText) | { type: 'key'; key: PaletteKey };

/** From the page: its text when the panel takes over (typed there first), and the highlighted result's title. */
export type PageToPanel = ({ type: 'text' } & RelayedText) | { type: 'selected'; title: string };

export const EMPTY_TEXT: RelayedText = { value: '', start: 0, end: 0 };

/**
 * The keys Search acts on: arrows and Ctrl+N/P move through the results, Enter runs one, Escape closes. None while an
 * input method composes (Enter then confirms the composition).
 */
export function paletteKey(event: {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
  isComposing?: boolean;
}): PaletteKey | undefined {
  if (event.isComposing) return undefined;
  switch (event.key) {
    case 'ArrowDown': return 'next';
    case 'ArrowUp': return 'previous';
    case 'Enter': return 'choose';
    case 'Escape': return 'close';
  }
  if (!event.ctrlKey || event.metaKey || event.altKey) return undefined;
  if (event.key === 'n') return 'next';
  if (event.key === 'p') return 'previous';
  return undefined;
}

const KEYS: readonly PaletteKey[] = ['next', 'previous', 'choose', 'close'];

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

function isRelayedText(value: Record<string, unknown>): boolean {
  const { value: text, start, end } = value;
  return typeof text === 'string' && Number.isInteger(start) && Number.isInteger(end) &&
    (start as number) >= 0 && (start as number) <= (end as number) && (end as number) <= text.length;
}

/** Validate a message from the panel at the port's boundary. */
export function isPanelToPage(value: unknown): value is PanelToPage {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case 'text': return isRelayedText(value);
    case 'key': return KEYS.includes(value.key as PaletteKey);
    default: return false;
  }
}

/** Validate a message from the page at the port's boundary. */
export function isPageToPanel(value: unknown): value is PageToPanel {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case 'text': return isRelayedText(value);
    case 'selected': return typeof value.title === 'string';
    default: return false;
  }
}
