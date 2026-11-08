/** A recent open tab; previews are optional, local snapshots rather than live pages. */
export interface RecentTab {
  id: number;
  title: string;
  url: string;
  /** Inline favicon resolved by the worker, so a web page never requests the extension's cache directly. */
  icon?: string;
  preview?: string;
}

/** The tab switcher reads one frozen list per gesture and activates only on commit. */
export interface RecentTabsClient {
  load(): Promise<RecentTab[]>;
  activate(tabId: number): Promise<void>;
  close(tabId: number): Promise<void>;
  /** Resolves once the presses Chrome reported so far have reached this page (`RecentTabCycle.amend`). */
  settle(): Promise<void>;
}

/** The selected index refers to the gesture's recent tab order, with closed tabs removed. */
export interface RecentTabsView {
  tabs: RecentTab[];
  selected: number;
}

/** Site access, which the page script and the previews need: required in the manifest, but users can withhold it. */
export const RECENT_TABS_PERMISSION = { origins: ['<all_urls>'] };

/** Put the active tab first, then remembered visits, then Chrome's recency fallback. */
export function orderRecentTabs<T extends { id?: number; active: boolean; lastAccessed?: number }>(
  tabs: T[],
  remembered: number[],
): T[] {
  const ranks = new Map(remembered.map((id, index) => [id, index]));
  return [...tabs]
    .filter((tab) => tab.id !== undefined)
    .sort((a, b) => {
      if (a.active !== b.active) return a.active ? -1 : 1;
      const rankA = ranks.get(a.id ?? -1) ?? Infinity;
      const rankB = ranks.get(b.id ?? -1) ?? Infinity;
      if (rankA !== rankB) return rankA - rankB;
      return (b.lastAccessed ?? 0) - (a.lastAccessed ?? 0);
    })
    .slice(0, 5);
}

/** Validate preview data at the extension message boundary. */
export function isRecentTab(value: unknown): value is RecentTab {
  return typeof value === 'object' && value !== null &&
    'id' in value && typeof value.id === 'number' && Number.isInteger(value.id) &&
    'title' in value && typeof value.title === 'string' &&
    'url' in value && typeof value.url === 'string' &&
    (!('icon' in value) || value.icon === undefined ||
      (typeof value.icon === 'string' && value.icon.startsWith('data:image/png;base64,'))) &&
    (!('preview' in value) || value.preview === undefined ||
      (typeof value.preview === 'string' && value.preview.startsWith('data:image/jpeg;base64,')));
}
