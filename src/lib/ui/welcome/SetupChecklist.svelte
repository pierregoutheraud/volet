<script lang="ts">
  import { normalizeShortcutKeys } from '@/lib/model/shortcut-display';
  import {
    type SetupStep,
    type SetupStepId,
    type WelcomeClient,
    setupProgress,
    setupSteps,
  } from '@/lib/model/welcome';
  import Button from '../primitives/page/Button.svelte';
  import Card from '../primitives/page/Card.svelte';
  import ChecklistStep from '../primitives/page/ChecklistStep.svelte';
  import Kbd from '../primitives/page/Kbd.svelte';

  let { client }: { client: WelcomeClient } = $props();

  const steps = $derived(setupSteps(client));
  const progress = $derived(setupProgress(steps));
  const step = $derived(Object.fromEntries(steps.map((each) => [each.id, each])) as Record<SetupStepId, SetupStep>);
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
    <ChecklistStep title="Open Volet" done={step.open.done} status="Done">
      {#snippet badge()}
        {#if toggleKeys}<Kbd keys={toggleKeys} />{/if}
      {/snippet}
      Volet lives in Chrome's side panel. Open it from here, from its toolbar icon{toggleKeys
        ? `, or with ${toggleKeys} from any page`
        : ''}.
      {#snippet actions()}
        <Button primary onclick={() => client.openPanel()}>Open Volet</Button>
      {/snippet}
    </ChecklistStep>

    <ChecklistStep title="Choose a side" done={step.side.done} status={sideStatus}>
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

    <ChecklistStep title="Pin the icon" done={step.pin.done} optional status="Pinned">
      Keep Volet one click away: click the puzzle piece in Chrome's toolbar, then the pin next to Volet.
    </ChecklistStep>

    <ChecklistStep
      title="Bring your Arc Spaces"
      done={step.arc.done}
      skipped={step.arc.skipped}
      optional
      status={step.arc.done ? 'Imported' : 'Skipped'}
    >
      Coming from Arc? Bring your Spaces, pinned tabs and favorites in a few clicks.
      {#snippet actions()}
        <Button onclick={() => client.openImport()}>Import from Arc</Button>
        <Button onclick={() => client.dismissArc()}>Not using Arc</Button>
      {/snippet}
    </ChecklistStep>
  </ol>

  {#if progress.allDone}
    <p class="mt-2 text-[14px] font-medium">You're all set. Volet is in the side panel whenever you need it.</p>
  {/if}
</Card>
