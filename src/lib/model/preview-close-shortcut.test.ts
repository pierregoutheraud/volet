import { describe, expect, it } from 'vitest';
import { keyboardShortcutFromEvent } from './keyboard-shortcut';
import { matchesPreviewCloseShortcut, previewShortcutError } from './preview-close-shortcut';

const backspace = { key: 'Backspace', code: 'Backspace', metaKey: true, ctrlKey: false, altKey: false, shiftKey: false };

describe('preview close shortcut', () => {
  it('stays inactive when unbound and requires an exact key and modifier match', () => {
    expect(matchesPreviewCloseShortcut(backspace, '')).toBe(false);
    expect(matchesPreviewCloseShortcut(backspace, 'Cmd+Backspace')).toBe(true);
    expect(matchesPreviewCloseShortcut({ ...backspace, shiftKey: true }, 'Cmd+Backspace')).toBe(false);
    expect(matchesPreviewCloseShortcut({ ...backspace, metaKey: false }, 'Cmd+Backspace')).toBe(false);
    expect(matchesPreviewCloseShortcut({ ...backspace, key: 'Delete', code: 'Delete' }, 'Cmd+Backspace')).toBe(false);
    expect(matchesPreviewCloseShortcut(backspace, 'Cmd+Delete')).toBe(false);
    expect(matchesPreviewCloseShortcut({ ...backspace, key: 'Delete', code: 'Delete' }, 'Cmd+Delete')).toBe(true);
  });

  it('records custom shortcuts and physical letters on Option layouts', () => {
    expect(keyboardShortcutFromEvent(backspace)).toBe('Cmd+Backspace');
    const event = { ...backspace, key: 'œ', code: 'KeyQ', metaKey: false, altKey: true, shiftKey: true };
    expect(keyboardShortcutFromEvent(event)).toBe('Alt+Shift+Q');
    expect(matchesPreviewCloseShortcut(event, 'Alt+Shift+Q')).toBe(true);
    for (const key of ['Meta', 'Control', 'Alt', 'Shift', 'Escape', 'Tab']) {
      expect(keyboardShortcutFromEvent({ ...backspace, key })).toBe('');
    }
  });

  it('rejects browser-reserved close chords instead of claiming they will close a preview', () => {
    expect(previewShortcutError('Cmd+W')).not.toBe('');
    expect(previewShortcutError('Ctrl+Shift+W')).not.toBe('');
    expect(matchesPreviewCloseShortcut({ ...backspace, key: 'w', code: 'KeyW' }, 'Cmd+W')).toBe(false);
    expect(previewShortcutError('Cmd+Backspace')).toBe('');
  });
});
