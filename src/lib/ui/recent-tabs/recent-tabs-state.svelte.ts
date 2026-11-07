import { RecentTabCycle } from '@/lib/model/recent-tab-cycle';
import type { RecentTabsClient, RecentTabsView } from '@/lib/model/recent-tabs';

/** Reactive presentation state around the independently testable tab cycle. */
export class RecentTabsState {
  view = $state.raw<RecentTabsView | null>(null);
  readonly cycle: RecentTabCycle;

  constructor(client: RecentTabsClient) {
    this.cycle = new RecentTabCycle({
      client,
      onchange: (view) => { this.view = view; },
      onerror: (error) => console.warn('Recent tab cycle failed', error),
    });
  }
}
