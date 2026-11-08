import { recentTabKey, type RelayKey } from '@/lib/model/recent-tab-keys';
import type { CycleModifier } from '@/lib/model/recent-tab-shortcut';

const NOTHING_HELD = { metaKey: false, ctrlKey: false, altKey: false };

/**
 * A relay's side of the recent tab switcher, where the keys go while something other than the page has focus: the
 * Volet panel, or a frame of the page (an editor's, an embed's). The page showing the switcher then gets no key
 * events: it asks whether the modifier is held (`holds`), and while it is, the relay sends it the keys, to `target`
 * (the page's tab, for the panel). The panel can also open the switcher itself, with its button (`open`): there's no
 * modifier to let go of then, so it sends the keys until the switcher closes. `onwatch` hears when the keys start and
 * stop going to a switcher.
 */
export function watchRelayedRecentTabKeys<T>(
  send: (target: T, key: RelayKey) => void,
  onwatch?: (watching: boolean) => void,
): {
  configure: (closeShortcut: string) => void;
  holds: (target: T, modifier: CycleModifier) => boolean;
  /** The switcher was opened on `target` by a click: its keys go there until it's chosen from or dismissed. */
  open: (target: T) => void;
  /** Whether the keys go to a switcher now. */
  readonly watching: boolean;
  /** Close the switcher the keys go to. */
  dismiss: () => void;
  /** The switcher on `target` closed on its own (a tab picked on the page, the page hidden): the keys stay here. */
  ended: (target: T) => void;
  dispose: () => void;
} {
  let held = NOTHING_HELD;
  /** Where the keys go, and the modifier whose release ends it (none for a switcher opened by a click). */
  let watching: { target: T; modifier?: CycleModifier } | undefined;
  const watch = (next: typeof watching) => {
    const changed = (next === undefined) !== (watching === undefined);
    watching = next;
    if (changed) onwatch?.(next !== undefined);
  };
  let closeShortcut = '';
  const report = (key: RelayKey, last = false) => {
    if (!watching) return;
    send(watching.target, key);
    if (last) watch(undefined);
  };
  const keydown = (event: KeyboardEvent) => {
    held = event;
    if (!watching) return;
    const key = recentTabKey(event, closeShortcut);
    if (!key) return;
    // The switcher has these keys while it's open: the relay's own handlers (the sidebar's, the editor's) never see them.
    event.preventDefault();
    event.stopImmediatePropagation();
    if (key === 'close' && event.repeat) return;
    report(key, key === 'cancel' || key === 'choose');
  };
  const keyup = (event: KeyboardEvent) => {
    held = event;
    if (watching?.modifier && !event[watching.modifier]) report('release', true);
  };
  const blur = () => {
    held = NOTHING_HELD;
    report('leave', true);
  };
  window.addEventListener('keydown', keydown, true);
  window.addEventListener('keyup', keyup, true);
  window.addEventListener('blur', blur);
  return {
    configure(value) { closeShortcut = value; },
    holds(target, modifier) {
      if (!held[modifier]) return false;
      watch({ target, modifier });
      return true;
    },
    open(target) {
      watch({ target });
    },
    get watching() {
      return watching !== undefined;
    },
    dismiss() {
      report('cancel', true);
    },
    ended(target) {
      if (watching?.target === target) watch(undefined);
    },
    dispose() {
      window.removeEventListener('keydown', keydown, true);
      window.removeEventListener('keyup', keyup, true);
      window.removeEventListener('blur', blur);
    },
  };
}
