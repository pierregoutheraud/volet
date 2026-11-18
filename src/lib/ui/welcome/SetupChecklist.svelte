<script lang="ts">
  import { normalizeShortcutKeys } from '@/lib/model/shortcut-display';
  import { type SetupStepId, type WelcomeClient, setupProgress, setupSteps } from '@/lib/model/welcome';
  import Button from '../primitives/page/Button.svelte';
  import Card from '../primitives/page/Card.svelte';
  import ChecklistStep from '../primitives/page/ChecklistStep.svelte';

  let { client }: { client: WelcomeClient } = $props();

  const steps = $derived(setupSteps(client));
  const progress = $derived(setupProgress(steps));
  const done = $derived(Object.fromEntries(steps.map((step) => [step.id, step.done])) as Record<SetupStepId, boolean>);
  const toggleKeys = $derived(
    normalizeShortcutKeys(client.shortcuts.find((shortcut) => shortcut.name === 'toggle-sidebar')?.keys ?? ''),
  );
  const sideStatus = $derived(
    client.side === 'left' ? 'On the left' : client.side === 'right' ? 'On the right' : 'Done',
  );
</script>

<Card>
  <div class="flex items-baseline justify-between gap-3">
    <h2 class="font-display text-[16px] font-bold">Set up</h2>
    <span class="text-[13px] text-ink-muted" role="status">{progress.done} of {progress.total}</span>
  </div>

  <ol class="mt-1 divide-y divide-rule">
    <ChecklistStep title="Open Volet" done={done.open} status="Done">
      Volet lives in Chrome's side panel. Open it from here, from its toolbar icon{toggleKeys
        ? `, or with ${toggleKeys}`
        : ''}.
      {#snippet actions()}
        <Button primary onclick={() => client.openPanel()}>Open Volet</Button>
      {/snippet}
    </ChecklistStep>

    <ChecklistStep title="Choose a side" done={done.side} status={sideStatus}>
      {#if client.side === 'right'}
        Volet is on the right. Like Arc, it can sit on the left: in Chrome's settings, set Side panel position to Left.
      {:else}
        Chrome shows side panels on the right unless you change it: in Chrome's settings, under Appearance, set Side
        panel position to Left.
      {/if}
      {#snippet actions()}
        {#if client.side === 'right'}
          <Button onclick={() => client.openSideSettings()}>Move to the left</Button>
          <Button onclick={() => client.keepSide()}>Keep it on the right</Button>
        {:else}
          <Button onclick={() => client.openSideSettings()}>Open Chrome settings</Button>
          <Button onclick={() => client.keepSide()}>Got it</Button>
        {/if}
      {/snippet}
    </ChecklistStep>

    <ChecklistStep title="Pin the icon" done={done.pin} status="Pinned">
      Keep Volet one click away: click the puzzle piece in Chrome's toolbar, then the pin next to Volet.
    </ChecklistStep>
  </ol>

  {#if progress.allDone}
    <p class="mt-2 text-[14px] font-medium">You're all set. Volet is in the side panel whenever you need it.</p>
  {/if}
</Card>
