import { expect, it, vi } from 'vitest';
import { RecentTabsFeed } from './recent-tabs-feed';

it('tells its subscribers about each view and hue, until they unsubscribe', () => {
  const feed = new RecentTabsFeed();
  const listener = vi.fn();
  const unsubscribe = feed.subscribe(listener);
  const view = { tabs: [{ id: 1, title: 'Tab', url: '' }], selected: 0 };
  feed.show(view);
  feed.tint(150);
  expect(listener).toHaveBeenCalledTimes(2);
  expect(feed.view).toBe(view);
  expect(feed.hue).toBe(150);
  unsubscribe();
  feed.show(null);
  expect(listener).toHaveBeenCalledTimes(2);
  expect(feed.view).toBeNull();
});
