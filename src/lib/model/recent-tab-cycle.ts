import type { RecentTab, RecentTabsClient, RecentTabsView } from './recent-tabs';

interface CycleGesture {
  steps: number;
  canceled: boolean;
  closing: boolean;
  tabs: Promise<RecentTab[]>;
}

/** Serializes quick gestures so each new tap sees the previously committed tab first. */
export class RecentTabCycle {
  #client: RecentTabsClient;
  #onchange: (view: RecentTabsView | null) => void;
  #onerror: (error: unknown) => void;
  #gesture: CycleGesture | undefined;
  /** A gesture let go of, until the presses Chrome reported before that have arrived (`amend`). */
  #settling: CycleGesture | undefined;
  #committed: Promise<void> = Promise.resolve();

  constructor(options: {
    client: RecentTabsClient;
    onchange: (view: RecentTabsView | null) => void;
    onerror: (error: unknown) => void;
  }) {
    this.#client = options.client;
    this.#onchange = options.onchange;
    this.#onerror = options.onerror;
  }

  get active(): boolean {
    return this.#gesture !== undefined;
  }

  /**
   * The highlight starts on the current tab, like the macOS switcher: cycling (1) moves right, so its first press
   * selects the last used tab; in reverse (-1) it moves left, so its first press wraps to the far right, the oldest.
   */
  step(offset = 1): void {
    let gesture = this.#gesture;
    if (!gesture) {
      gesture = { steps: offset, canceled: false, closing: false, tabs: this.#committed.then(() => this.#client.load()) };
      this.#gesture = gesture;
    } else gesture.steps += offset;
    this.#show(gesture);
  }

  /** Mouse hover changes only the highlighted preview, never the active Chrome tab. */
  select(index: number): void {
    if (!this.#gesture || this.#gesture.steps === index) return;
    this.#gesture.steps = index;
    this.#show(this.#gesture);
  }

  /** Close the highlighted tab once, then keep the next preview selected in the same order. */
  closeSelected(): void {
    const gesture = this.#gesture;
    if (!gesture || gesture.closing) return;
    gesture.closing = true;
    const selected = gesture.steps;
    gesture.tabs = gesture.tabs.then(async (tabs) => {
      const index = this.#index({ steps: selected }, tabs.length);
      const tab = tabs[index];
      if (!tab) return tabs;
      try {
        await this.#client.close(tab.id);
      } catch (error: unknown) {
        this.#onerror(error);
        return tabs;
      }
      const highlighted = tabs[this.#index(gesture, tabs.length)];
      const remaining = tabs.filter((item) => item.id !== tab.id);
      const nextIndex = highlighted?.id === tab.id
        ? Math.min(index, remaining.length - 1)
        : remaining.findIndex((item) => item.id === highlighted?.id);
      gesture.steps = Math.max(0, nextIndex);
      if (remaining.length === 0 && this.#gesture === gesture) this.cancel();
      return remaining;
    }).finally(() => { gesture.closing = false; });
    this.#show(gesture);
  }

  #show(gesture: CycleGesture): void {
    void gesture.tabs.then((tabs) => {
      if (this.#gesture === gesture && tabs.length > 0) {
        this.#onchange({ tabs, selected: this.#index(gesture, tabs.length) });
      }
    }).catch((error: unknown) => {
      if (this.#gesture === gesture) this.cancel();
      this.#onerror(error);
    });
  }

  /**
   * Resolve the selection even if the modifier was released before the list arrived. Letting go waits for the presses
   * Chrome reported before that (`amend`); a click (`index`) picks its tab.
   */
  commit(index?: number): void {
    const gesture = this.#gesture;
    if (!gesture) return;
    this.#gesture = undefined;
    this.#onchange(null);
    let settled = Promise.resolve();
    if (index !== undefined) gesture.steps = index;
    else {
      this.#settling = gesture;
      settled = this.#client.settle().catch(() => undefined);
    }
    this.#committed = settled.then(() => {
      if (this.#settling === gesture) this.#settling = undefined;
      return gesture.tabs;
    }).then(async (tabs) => {
      const tab = tabs[this.#index(gesture, tabs.length)];
      if (tab && !gesture.canceled) await this.#client.activate(tab.id);
    }).catch(this.#onerror);
  }

  /**
   * A press made before the modifier was let go can reach the page after it (Chrome reports the press to the worker,
   * which forwards it): until the commit has heard of every such press, one still moves its selection. Returns whether
   * the press went there.
   */
  amend(offset = 1): boolean {
    const gesture = this.#settling;
    if (!gesture || this.#gesture) return false;
    gesture.steps += offset;
    return true;
  }

  cancel(): void {
    if (this.#gesture) this.#gesture.canceled = true;
    this.#gesture = undefined;
    this.#onchange(null);
  }

  #index(gesture: Pick<CycleGesture, 'steps'>, length: number): number {
    return length === 0 ? 0 : ((gesture.steps % length) + length) % length;
  }
}
