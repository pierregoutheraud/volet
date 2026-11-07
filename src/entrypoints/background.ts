import { archiveIdleTabs } from '@/lib/engine/archive';
import { Engine } from '@/lib/engine/engine';
import { rememberPage } from '@/lib/engine/last-pages';
import { listenForMessages } from '@/lib/engine/messaging';
import { listenForRecentTabs } from '@/lib/engine/recent-tabs/listeners';
import { listenForShortcuts } from '@/lib/engine/shortcuts';
import { forgetGroup, forgetTab, forgetWindow, replaceTab, stampActivity } from '@/lib/engine/session';
import { trackSidePanels } from '@/lib/engine/side-panel';
import { arcInviteItem } from '@/lib/engine/storage';
import { tabIds } from '@/lib/engine/snapshot';
import { refreshBoundTitle } from '@/lib/engine/titles';

const ARCHIVE_ALARM = 'archive-idle-tabs';

export default defineBackground(() => {
  const engine = new Engine();
  const log = (label: string) => (error: unknown) => console.warn(label, error);
  const queue = (label: string, task: () => Promise<void>) => engine.enqueue(task).catch(log(label));

  // Clicking the toolbar icon toggles the side panel.
  browser.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(log('setPanelBehavior'));

  // Install, update, reload and browser restart all clear session storage: rebuild it.
  const startup = async () => {
    await browser.alarms.create(ARCHIVE_ALARM, { periodInMinutes: 5 });
    await engine.reconcileAll({ recover: true });
    const tabs = await browser.tabs.query({});
    await queue('stamp', () => stampActivity(tabIds(tabs)));
    // Session restore can trail behind startup: look again once it has settled.
    setTimeout(() => engine.reconcileAll({ recover: true }).catch(log('late recovery')), 5000);
  };
  browser.runtime.onInstalled.addListener(({ reason }) => {
    // A first install greets people coming from Arc (the sidebar's "Coming from Arc?" card).
    if (reason === 'install') arcInviteItem.setValue(true).catch(log('arc invite'));
    startup().catch(log('install'));
  });
  browser.runtime.onStartup.addListener(() => startup().catch(log('startup')));

  listenForMessages(engine);
  listenForRecentTabs(engine);
  listenForShortcuts(engine);
  trackSidePanels();

  browser.tabs.onCreated.addListener((tab) => {
    queue('stamp', () => stampActivity(tabIds([tab])));
    engine.scheduleReconcile(tab.windowId);
  });
  browser.tabs.onUpdated.addListener((tabId, info, tab) => {
    if ('pinned' in info || 'groupId' in info) engine.scheduleReconcile(tab.windowId);
    if (info.status === 'complete') queue('title', () => refreshBoundTitle(tabId));
    // Where a pin's or favorite's tab goes, to find it again after a restart (`lastPagesItem`).
    const url = info.url;
    if (url) queue('page', () => rememberPage(tabId, url));
  });
  browser.tabs.onAttached.addListener((_tabId, info) => engine.scheduleReconcile(info.newWindowId));
  browser.tabs.onActivated.addListener(({ tabId, windowId }) => {
    engine.onActivated(tabId, windowId).catch(log('activated'));
  });
  browser.tabs.onRemoved.addListener((tabId) => queue('tab removed', () => forgetTab(tabId)));
  browser.tabs.onReplaced.addListener((added, removed) => queue('tab replaced', () => replaceTab(added, removed)));

  browser.tabGroups.onCreated.addListener((group) => engine.scheduleReconcile(group.windowId));
  browser.tabGroups.onUpdated.addListener((group) => engine.scheduleReconcile(group.windowId));
  browser.tabGroups.onRemoved.addListener((group) => queue('group removed', () => forgetGroup(group.id)));

  browser.windows.onRemoved.addListener((windowId) => queue('window removed', () => forgetWindow(windowId)));

  // Renames or deletions made in Chrome's bookmark manager (or arriving through sync). They come in
  // bursts (a session restore refreshes every pin's title): one reconcile per burst.
  const bookmarksChanged = () => engine.scheduleReconcileAll();
  browser.bookmarks.onChanged.addListener(bookmarksChanged);
  browser.bookmarks.onRemoved.addListener(bookmarksChanged);

  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === ARCHIVE_ALARM) queue('archive', () => archiveIdleTabs());
  });
});
