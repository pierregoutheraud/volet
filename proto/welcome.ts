import { mount } from 'svelte';
import { FakeWelcomeClient } from '@/lib/state/fake/fake-welcome.svelte';
import WelcomePage from '@/lib/ui/welcome/WelcomePage.svelte';
import '@/styles/page.css';

// ?theme=dark or ?theme=light forces a color scheme; otherwise it follows the system.
// ?done starts with every step done; ?side=unknown is a Chrome too old to tell the panel's side (before 140).
// ?arc=imported or ?arc=skipped starts the optional Arc step settled.
const params = new URLSearchParams(location.search);
const theme = params.get('theme');
const scheme = theme === 'dark' || theme === 'light' ? theme : undefined;
const arc = params.get('arc');
const client = new FakeWelcomeClient({
  ...(params.has('done') ? { panelSeen: true, side: 'left' as const, onToolbar: true } : {}),
  ...(params.get('side') === 'unknown' ? { side: null } : {}),
  ...(arc === 'imported' ? { arcInvite: false, arcImported: true } : arc === 'skipped' ? { arcInvite: false } : {}),
});

mount(WelcomePage, { target: document.getElementById('app')!, props: { client, scheme } });
