import { previewCloseShortcutItem } from '@/lib/engine/recent-tabs/preview-close-shortcut-storage';

/** Persist the preview close shortcut locally and follow changes from another settings page. */
export class PreviewCloseSettings {
  shortcut = $state('');
  busy = $state(false);
  error = $state('');

  watch(): () => void {
    const update = (value: unknown) => { this.shortcut = typeof value === 'string' ? value : ''; };
    void previewCloseShortcutItem.getValue().then(update).catch(() => { this.error = 'Could not load shortcut.'; });
    return previewCloseShortcutItem.watch(update);
  }

  async save(shortcut: string): Promise<void> {
    this.busy = true;
    this.error = '';
    try {
      await previewCloseShortcutItem.setValue(shortcut);
      this.shortcut = shortcut;
    } catch { this.error = 'Could not save shortcut. Try again.'; }
    finally { this.busy = false; }
  }
}
