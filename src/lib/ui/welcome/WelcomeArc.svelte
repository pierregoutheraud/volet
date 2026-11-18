<script lang="ts">
  import type { WelcomeClient } from '@/lib/model/welcome';
  import Button from '../primitives/page/Button.svelte';
  import Card from '../primitives/page/Card.svelte';

  let { client }: { client: WelcomeClient } = $props();
</script>

<!-- The sidebar's "Coming from Arc?" card, on the page: dismissing or importing in either place clears both. -->
{#if client.arcInvite}
  <Card title="Coming from Arc?">
    <p class="text-[14px] leading-relaxed text-ink-muted">Bring your Spaces, pinned tabs and favorites in a few clicks.</p>
    <div class="mt-3 flex flex-wrap gap-2">
      <Button onclick={() => client.openImport()}>Import from Arc</Button>
      <Button onclick={() => client.dismissArc()}>Dismiss</Button>
    </div>
  </Card>
{/if}
