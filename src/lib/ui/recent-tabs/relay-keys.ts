import { recentTabKey, type RelayKey } from '@/lib/model/recent-tab-keys';
import type { CycleModifier } from '@/lib/model/recent-tab-shortcut';

const NOTHING_HELD = { metaKey: false, ctrlKey: false, altKey: false };

/**
 * A relay's side of the recent tab switcher, where the keys go while something other than the page has focus: the
 * Volet panel, or a frame of the page (an editor's, an embed's). The page showing the switcher then gets no key
 * events: it asks whether the modifier is held (`holds`), and while it is, the relay sends it the keys, to `target`
 * (the page's tab, for the panel).
 */
export function watchRelayedRecentTabKeys<T>(send: (target: T, key: RelayKey) => void): {
  configure: (closeShortcut: string) => void;
  holds: (target: T, modifier: CycleModifier) => boolean;
  dispose: () => void;
} {
  let held = NOTHING_HELD;
  let watching: { target: T; modifier: CycleModifier } | undefined;
  let closeShortcut = '';
  const report = (key: RelayKey, last = false) => {
    if (!watching) return;
    send(watching.target, key);
    if (last) watching = undefined;
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
    if (watching && !event[watching.modifier]) report('release', true);
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
      watching = { target, modifier };
      return true;
    },
    dispose() {
      window.removeEventListener('keydown', keydown, true);
      window.removeEventListener('keyup', keyup, true);
      window.removeEventListener('blur', blur);
    },
  };
}
