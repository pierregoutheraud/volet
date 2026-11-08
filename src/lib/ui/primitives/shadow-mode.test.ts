import { expect, it } from 'vitest';
import { shadowMode } from './shadow-mode';

it('closes shadow roots on web pages everywhere but the end-to-end build', () => {
  expect(shadowMode('production')).toBe('closed');
  expect(shadowMode('development')).toBe('closed');
  expect(shadowMode('e2e')).toBe('open');
});
