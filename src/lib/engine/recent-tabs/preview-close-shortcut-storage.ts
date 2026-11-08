import { storage } from 'wxt/utils/storage';

/** The preview-only close shortcut is device-local and unbound until the user records one. */
export const previewCloseShortcutItem = storage.defineItem<string>('local:previewCloseShortcut', { fallback: '' });
