import { expect, it } from 'vitest';
import { isPageToPanel, isPanelToPage, paletteKey } from './palette-relay';

const press = (key: string, mods: { ctrlKey?: boolean; metaKey?: boolean; altKey?: boolean; isComposing?: boolean } = {}) =>
  paletteKey({ key, ctrlKey: false, metaKey: false, altKey: false, ...mods });

it('moves with the arrows and Ctrl+N/P, runs on Enter and closes on Escape', () => {
  expect(press('ArrowDown')).toBe('next');
  expect(press('ArrowUp')).toBe('previous');
  expect(press('n', { ctrlKey: true })).toBe('next');
  expect(press('p', { ctrlKey: true })).toBe('previous');
  expect(press('Enter')).toBe('choose');
  expect(press('Escape')).toBe('close');
});

it('leaves every other key to the field, and Enter to an input method composing', () => {
  for (const key of ['a', 'n', 'p', 'ArrowLeft', 'ArrowRight', 'Backspace', 'Tab', 'Home']) expect(press(key)).toBeUndefined();
  expect(press('n', { ctrlKey: true, altKey: true })).toBeUndefined();
  expect(press('p', { ctrlKey: true, metaKey: true })).toBeUndefined();
  expect(press('Enter', { isComposing: true })).toBeUndefined();
});

it('accepts only well-formed messages across the port', () => {
  expect(isPanelToPage({ type: 'text', value: 'déjà', start: 4, end: 4 })).toBe(true);
  expect(isPanelToPage({ type: 'text', value: 'abc', start: 0, end: 3 })).toBe(true);
  expect(isPanelToPage({ type: 'key', key: 'choose' })).toBe(true);
  expect(isPanelToPage({ type: 'leave' })).toBe(false);
  expect(isPanelToPage({ type: 'text', value: 'abc', start: 2, end: 1 })).toBe(false);
  expect(isPanelToPage({ type: 'text', value: 'abc', start: 0, end: 4 })).toBe(false);
  expect(isPanelToPage({ type: 'text', value: 'abc', start: 0.5, end: 1 })).toBe(false);
  expect(isPanelToPage({ type: 'key', key: 'delete' })).toBe(false);
  expect(isPanelToPage({ type: 'selected', title: 'x' })).toBe(false);
  expect(isPanelToPage(null)).toBe(false);

  expect(isPageToPanel({ type: 'text', value: 'q', start: 1, end: 1 })).toBe(true);
  expect(isPageToPanel({ type: 'selected', title: 'Inbox' })).toBe(true);
  expect(isPageToPanel({ type: 'selected' })).toBe(false);
  expect(isPageToPanel({ type: 'leave' })).toBe(false);
});
