import { EMPTY_TEXT } from '@/lib/model/palette-relay';
import type { SearchLauncher, SearchMode } from '@/lib/model/search-launcher';

/**
 * Search for the prototype, which has no page to show it over: it shows in the panel, as on Chrome's own pages.
 * (Search over a page is on the store images' palette scene.)
 */
export class FakeSearchLauncher implements SearchLauncher {
  mode = $state<SearchMode>('closed');
  readonly shortcut = '⌃M';
  readonly seed = EMPTY_TEXT;
  readonly announcement = '';

  toggle(): void {
    this.mode = this.mode === 'closed' ? 'panel' : 'closed';
  }

  close(): void {
    this.mode = 'closed';
  }

  text(): void {}
  key(): void {}
  leave(): void {}
}
