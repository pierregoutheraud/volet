import { mount } from 'svelte';
import { FakeArcClient } from '@/lib/state/fake/fake-arc.svelte';
import { fakePaletteClient } from '@/lib/state/fake/fake-palette';
import { FakeSearchLauncher } from '@/lib/state/fake/fake-search.svelte';
import { FakeSidebarStore } from '@/lib/state/fake/fake-store.svelte';
import Sidebar from '@/lib/ui/sidebar/Sidebar.svelte';
import '@/app.css';

// ?theme=dark or ?theme=light forces a color scheme; otherwise it follows the system.
const theme = new URLSearchParams(location.search).get('theme');
const scheme = theme === 'dark' || theme === 'light' ? theme : undefined;

const store = new FakeSidebarStore();
mount(Sidebar, {
  target: document.getElementById('app')!,
  props: {
    store,
    search: new FakeSearchLauncher(),
    palette: fakePaletteClient(store),
    arc: new FakeArcClient(store),
    // The switcher shows over web pages, which the prototype has none of (/recent-tabs.html has it on its own).
    recentTabs: { open: false, shortcut: '⌃Q', toggle: () => undefined },
    scheme,
  },
});
