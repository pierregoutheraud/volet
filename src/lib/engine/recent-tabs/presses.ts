/**
 * Switcher presses on their way to a page. The worker reads Chrome's shortcuts before forwarding a press, so letting
 * go of the modifier right after pressing can reach the page first: the page would switch without that press. So a
 * page that sees the modifier go waits for the presses already on their way (`recent-tabs:settle`) before switching.
 */
export class PressesInFlight {
  #pending = new Map<number, Promise<void>>();

  /** Follow a press to a tab until the page has it, or it failed. Call it as Chrome reports the press. */
  track(tabId: number, delivery: Promise<unknown>): void {
    const done = Promise.all([this.#pending.get(tabId), delivery.catch(() => undefined)]).then(() => undefined);
    this.#pending.set(tabId, done);
    void done.then(() => {
      if (this.#pending.get(tabId) === done) this.#pending.delete(tabId);
    });
  }

  /** Resolves once the presses already on their way to the tab have arrived; later ones don't count. */
  settled(tabId: number): Promise<void> {
    return this.#pending.get(tabId) ?? Promise.resolve();
  }
}
