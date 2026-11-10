import { pendingPaletteItem } from '@/lib/engine/storage';

/**
 * Toggle Search when the shortcut asks the panel (the worker leaves a flag for this window), now or once the panel
 * opens: the panel had the keyboard, so Search over the page needs its keys, or the page can't show Search.
 */
export function watchPaletteRequests(windowId: number) {
  return (open: () => void): void => {
    const check = async (pending: Record<string, boolean> | null) => {
      if (!pending?.[windowId]) return;
      const { [windowId]: _done, ...rest } = pending;
      await pendingPaletteItem.setValue(rest);
      open();
    };
    void pendingPaletteItem.getValue().then(check);
    pendingPaletteItem.watch((pending) => void check(pending));
  };
}
