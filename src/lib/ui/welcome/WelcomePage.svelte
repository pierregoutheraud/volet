<script lang="ts">
  import type { WelcomeClient } from '@/lib/model/welcome';
  import PageShell from '../primitives/page/PageShell.svelte';
  import GoodToKnow from './GoodToKnow.svelte';
  import SetupChecklist from './SetupChecklist.svelte';
  import WelcomeArc from './WelcomeArc.svelte';

  let { client, scheme }: { client: WelcomeClient; scheme?: 'light' | 'dark' } = $props();
</script>

<!-- Back from Chrome's settings (or its toolbar menu): the side, the icon and the shortcuts may have changed. -->
<svelte:window onfocus={() => void client.refresh()} />
<svelte:document onvisibilitychange={() => document.visibilityState === 'visible' && void client.refresh()} />

<PageShell
  title="Welcome to Volet"
  intro="Your tabs, sorted into Volets, in Chrome's side panel. A minute of setup and you're ready."
  {scheme}
>
  <SetupChecklist {client} />
  <GoodToKnow {client} />
  <WelcomeArc {client} />
</PageShell>
