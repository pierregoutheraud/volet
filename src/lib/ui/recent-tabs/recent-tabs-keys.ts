import type { RecentTabCycle } from '@/lib/model/recent-tab-cycle';
import { recentTabModifier, type CycleModifier } from '@/lib/model/recent-tab-shortcut';
import { matchesPreviewCloseShortcut } from '@/lib/model/preview-close-shortcut';

/** Track modifier releases before Chrome sends a command, including during async loading. */
export function listenRecentTabKeys(cycle: RecentTabCycle): {
  configure: (closeShortcut: string) => void;
  step: (shortcut: string, offset?: 1 | -1) => void;
  dispose: () => void;
} {
  let held = { metaKey: false, ctrlKey: false, altKey: false };
  let modifier: CycleModifier | undefined;
  let closeShortcut = '';
  const keydown = (event: KeyboardEvent) => {
    held = event;
    if (!cycle.active) return;
    if (matchesPreviewCloseShortcut(event, closeShortcut)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat) cycle.closeSelected();
      return;
    }
    switch (event.key) {
      case 'Escape': cycle.cancel(); break;
      case 'Enter': {
        const target = event.composedPath()[0];
        // Cmd is still held, so handle Enter explicitly instead of relying on a native button click.
        if (target instanceof HTMLElement && target.classList.contains('recent-tab-close')) {
          if (!event.repeat) cycle.closeSelected();
        } else cycle.commit();
        break;
      }
      case 'ArrowRight': cycle.step(1); break;
      case 'ArrowLeft': cycle.step(-1); break;
      default: return;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  const keyup = (event: KeyboardEvent) => {
    held = event;
    if (modifier && !held[modifier]) cycle.commit();
  };
  const cancel = () => {
    held = { metaKey: false, ctrlKey: false, altKey: false };
    cycle.cancel();
  };
  const visibility = () => { if (document.hidden) cancel(); };
  window.addEventListener('keydown', keydown, true);
  window.addEventListener('keyup', keyup, true);
  window.addEventListener('blur', cancel);
  document.addEventListener('visibilitychange', visibility);
  return {
    configure(value) { closeShortcut = value; },
    step(nextShortcut, offset = 1) {
      modifier = recentTabModifier(nextShortcut);
      cycle.step(offset);
      // The command may arrive after the user has already released Cmd.
      if (modifier && !held[modifier]) cycle.commit();
    },
    dispose() {
      cancel();
      window.removeEventListener('keydown', keydown, true);
      window.removeEventListener('keyup', keyup, true);
      window.removeEventListener('blur', cancel);
      document.removeEventListener('visibilitychange', visibility);
    },
  };
}
