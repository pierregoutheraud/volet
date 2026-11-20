<script lang="ts">
  import { Settings } from '@lucide/svelte';
  import type { WelcomeClient } from '@/lib/model/welcome';
  import Button from '../primitives/page/Button.svelte';
  import PageShell from '../primitives/page/PageShell.svelte';
  import SetupChecklist from './SetupChecklist.svelte';
  import WelcomeShortcuts from './WelcomeShortcuts.svelte';

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
  <footer class="flex flex-wrap items-center justify-between gap-3 px-1">
    <WelcomeShortcuts {client} />
    <div class="ml-auto">
      <Button onclick={() => client.openSettings()}>
        <span class="inline-flex items-center gap-1.5">
          <Settings size={15} strokeWidth={2} aria-hidden="true" />
          Open settings
        </span>
      </Button>
    </div>
  </footer>
</PageShell>
