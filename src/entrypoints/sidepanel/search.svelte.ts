import { EMPTY_TEXT, type RelayedText } from '@/lib/model/palette-relay';
import type { SearchLauncher, SearchMode } from '@/lib/model/search-launcher';
import { watchCommandShortcut } from '@/lib/state/chrome/command-shortcut';
import { chromeSearchPanel, type SearchConnection } from '@/lib/state/chrome/search-panel';

/**
 * The panel's Search: over the page in front, where the panel, which keeps the keyboard (nothing can move it to the
 * page), sends it the keys from a hidden field (`RelayInput`); in the panel, only where nothing can show over the
 * page. `requests` hears the shortcut asking (`watchPaletteRequests`).
 */
export function panelSearch(windowId: number, requests: (toggle: () => void) => void): SearchLauncher {
  const client = chromeSearchPanel(windowId);
  let mode = $state<SearchMode>('closed');
  let shortcut = $state('');
  let seed = $state<RelayedText>(EMPTY_TEXT);
  let announcement = $state('');
  let connection: SearchConnection | undefined;
  /** Whether the panel's field sent anything yet: from then on, it has the last word over what the page held. */
  let typed = false;
  let opening = false;

  watchCommandShortcut('open-palette', (value) => { shortcut = value; });

  const ended = () => {
    connection = undefined;
    announcement = '';
    mode = 'closed';
  };
  const close = () => {
    const current = connection;
    if (mode === 'page') ended();
    else mode = 'closed';
    current?.close();
  };
  const open = async () => {
    if (opening) return;
    opening = true;
    try {
      const where = await client.open();
      if (!('tabId' in where)) {
        mode = 'panel';
        return;
      }
      seed = EMPTY_TEXT;
      announcement = '';
      typed = false;
      const current = client.connect(
        where.tabId,
        (message) => {
          if (connection !== current) return;
          if (message.type === 'selected') announcement = message.title;
          else if (!typed) seed = { value: message.value, start: message.start, end: message.end };
        },
        () => {
          if (connection === current) ended();
        },
      );
      connection = current;
      mode = 'page';
    } catch (error) {
      console.warn('Search failed to open', error);
    } finally {
      opening = false;
    }
  };

  const launcher: SearchLauncher = {
    get mode() {
      return mode;
    },
    get shortcut() {
      return shortcut;
    },
    get seed() {
      return seed;
    },
    get announcement() {
      return announcement;
    },
    toggle() {
      if (mode === 'closed') void open();
      else close();
    },
    close,
    text(state) {
      typed = true;
      connection?.post({ type: 'text', ...state });
    },
    key(key) {
      connection?.post({ type: 'key', key });
    },
    leave() {
      if (mode === 'page') close();
    },
  };
  requests(() => launcher.toggle());
  return launcher;
}
