import { describe, expect, it } from 'vitest';
import { holdsModifier, isRelayKey, recentTabKey } from './recent-tab-keys';
import { isCycleModifier } from './recent-tab-shortcut';

const key = (value: string, modifiers: Partial<Record<'metaKey' | 'ctrlKey' | 'altKey' | 'shiftKey', boolean>> = {}) => ({
  key: value, code: '', metaKey: false, ctrlKey: false, altKey: false, shiftKey: false, ...modifiers,
});

describe('recentTabKey', () => {
  it('maps the switcher keys the same way with the modifier still held', () => {
    expect(recentTabKey(key('Escape', { metaKey: true }), '')).toBe('cancel');
    expect(recentTabKey(key('Enter', { metaKey: true }), '')).toBe('choose');
    expect(recentTabKey(key('ArrowRight', { metaKey: true }), '')).toBe('next');
    expect(recentTabKey(key('ArrowLeft', { metaKey: true }), '')).toBe('previous');
    expect(recentTabKey(key('a', { metaKey: true }), '')).toBeUndefined();
    expect(recentTabKey(key('constructor'), '')).toBeUndefined();
  });

  it('closes only on the exact recorded shortcut', () => {
    expect(recentTabKey(key('Backspace', { metaKey: true }), 'Cmd+Backspace')).toBe('close');
    expect(recentTabKey(key('Backspace', { metaKey: true, shiftKey: true }), 'Cmd+Backspace')).toBeUndefined();
    expect(recentTabKey(key('Backspace', { metaKey: true }), '')).toBeUndefined();
  });
});

it('validates relayed keys, modifiers and answers at the message boundary', () => {
  for (const value of ['cancel', 'choose', 'next', 'previous', 'close', 'release', 'leave']) expect(isRelayKey(value)).toBe(true);
  for (const value of ['commit', '', undefined, 1, null]) expect(isRelayKey(value)).toBe(false);
  expect(holdsModifier({ holds: true })).toBe(true);
  for (const value of [{ holds: false }, { holds: 'true' }, undefined, null, true]) expect(holdsModifier(value)).toBe(false);
  for (const value of ['metaKey', 'ctrlKey', 'altKey']) expect(isCycleModifier(value)).toBe(true);
  for (const value of ['shiftKey', 'Meta', undefined]) expect(isCycleModifier(value)).toBe(false);
});
