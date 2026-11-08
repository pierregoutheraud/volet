type ShortcutKeyEvent = Pick<KeyboardEvent, 'key' | 'code' | 'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey'>;

/** Record physical letter keys so an Option-based layout keeps the shortcut's identity. */
export function keyboardShortcutFromEvent(event: ShortcutKeyEvent): string {
  if (['Meta', 'Control', 'Alt', 'Shift', 'Escape', 'Tab'].includes(event.key)) return '';
  const key = /^(Key[A-Z]|Digit[0-9])$/.test(event.code)
    ? event.code.replace(/^(Key|Digit)/, '')
    : event.key === ' ' ? 'Space' : event.key;
  return [event.metaKey && 'Cmd', event.ctrlKey && 'Ctrl', event.altKey && 'Alt',
    event.shiftKey && 'Shift', key].filter(Boolean).join('+');
}
