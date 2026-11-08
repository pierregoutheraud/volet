import { mount } from 'svelte';
import { ChromeArcClient } from '@/lib/state/arc.svelte';
import { ChromeSidebarStore } from '@/lib/state/chrome/chrome-store.svelte';
import { chromePaletteClient } from '@/lib/state/chrome/palette-client';
import { answerPanelFocus } from '@/lib/state/chrome/panel-focus';
import { watchPaletteRequests } from '@/lib/state/chrome/palette-requests';
import Sidebar from '@/lib/ui/sidebar/Sidebar.svelte';
import { relayRecentTabKeys } from './recent-tabs.svelte';
import '@/app.css';

async function main() {
  // `?windowId=` lets tests (or a detached panel) drive another window.
  const requested = Number(new URLSearchParams(location.search).get('windowId'));
  const windowId = requested || (await browser.windows.getCurrent()).id!;
  const recentTabs = relayRecentTabKeys(windowId);
  answerPanelFocus(windowId);
  const store = new ChromeSidebarStore(windowId);
  await store.start();
  const palette = { ...chromePaletteClient(windowId), onOpenRequest: watchPaletteRequests(windowId) };
  const arc = new ChromeArcClient();
  await arc.start();
  mount(Sidebar, { target: document.getElementById('app')!, props: { store, palette, arc, recentTabs } });
}

void main();
