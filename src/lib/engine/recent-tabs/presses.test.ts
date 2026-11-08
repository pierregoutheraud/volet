import { describe, expect, it } from 'vitest';
import { PressesInFlight } from './presses';

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

/** Whether a promise has settled after pending callbacks ran. */
async function isDone(promise: Promise<unknown>): Promise<boolean> {
  let done = false;
  void promise.then(() => { done = true; });
  await new Promise((resolve) => setTimeout(resolve, 0));
  return done;
}

describe('presses in flight', () => {
  it('settles at once with no press on its way', async () => {
    expect(await isDone(new PressesInFlight().settled(1))).toBe(true);
  });

  it('waits for every press already on its way to that tab, delivered or failed, and only those', async () => {
    const presses = new PressesInFlight();
    const first = deferred();
    const second = deferred();
    const elsewhere = deferred();
    presses.track(1, first.promise);
    presses.track(1, second.promise);
    presses.track(2, elsewhere.promise);
    const settled = presses.settled(1);
    const later = deferred();
    presses.track(1, later.promise);

    second.resolve();
    expect(await isDone(settled)).toBe(false);
    first.reject(new Error('No page script'));
    expect(await isDone(settled)).toBe(true);
    expect(await isDone(presses.settled(2))).toBe(false);
    expect(await isDone(presses.settled(1))).toBe(false);
    later.resolve();
    expect(await isDone(presses.settled(1))).toBe(true);
  });
});
