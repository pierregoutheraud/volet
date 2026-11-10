import { expect, it } from 'vitest';
import { commandShortcut, defaultShortcutKeys, normalizeShortcutKeys, shortcutBindingKind } from './shortcut-display';

it('formats native and recorded shortcuts with the same key names', () => {
  expect(normalizeShortcutKeys('⇧⌘E')).toBe('Cmd+Shift+E');
  expect(normalizeShortcutKeys('⌘⇧E')).toBe('Cmd+Shift+E');
  expect(normalizeShortcutKeys('Cmd+Backspace')).toBe('Cmd+Backspace');
  expect(normalizeShortcutKeys('⌥S')).toBe('Alt+S');
});

it('distinguishes defaults, custom assignments and cleared defaults', () => {
  expect(shortcutBindingKind('⌥S', 'Alt+S')).toBe('default');
  expect(shortcutBindingKind('⇧⌘E', 'Command+Shift+E')).toBe('default');
  expect(shortcutBindingKind('⌘S', 'Alt+S')).toBe('custom');
  expect(shortcutBindingKind('⌘E')).toBe('custom');
  expect(shortcutBindingKind('', 'Alt+S')).toBe('unset');
});

it('resolves real manifest defaults for each platform instead of hardcoding a shortcut table', () => {
  expect(defaultShortcutKeys({ default: 'Alt+S', mac: 'Command+S' }, 'mac')).toBe('Cmd+S');
  expect(defaultShortcutKeys({ default: 'Ctrl+S' }, 'mac')).toBe('Cmd+S');
  expect(defaultShortcutKeys({ default: 'Alt+S', windows: 'Ctrl+S' }, 'win')).toBe('Ctrl+S');
  expect(defaultShortcutKeys({ default: 'Alt+S' }, 'linux')).toBe('Alt+S');
  expect(defaultShortcutKeys({ mac: 'MacCtrl+S' }, 'mac')).toBe('Ctrl+S');
  expect(defaultShortcutKeys(undefined, 'mac')).toBe('');
});

it("shows a command's shortcut as Chrome does, and none while it's unassigned", () => {
  const commands = (search?: string) => [
    { name: 'toggle-sidebar', shortcut: '⌃B' },
    { name: 'open-palette', shortcut: search },
  ];
  expect(commandShortcut(commands('⌃M'), 'open-palette')).toBe('⌃M');
  expect(commandShortcut(commands('Ctrl+M'), 'open-palette')).toBe('Ctrl+M');
  expect(commandShortcut(commands(''), 'open-palette')).toBe('');
  expect(commandShortcut(commands(), 'open-palette')).toBe('');
  expect(commandShortcut(commands('⌃M'), 'cycle-recent-tabs')).toBe('');
});
