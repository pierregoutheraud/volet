<script lang="ts">
  import { groupKeyboardShortcuts, type KeyboardShortcut } from '@/lib/model/keyboard-shortcuts';
  import Button from '../primitives/page/Button.svelte';
  import Card from '../primitives/page/Card.svelte';
  import PreviewCloseShortcut from './PreviewCloseShortcut.svelte';

  let { shortcuts, onedit }: { shortcuts: readonly KeyboardShortcut[]; onedit: () => void } = $props();
  const groups = $derived(groupKeyboardShortcuts(shortcuts));
</script>

<Card title="Keyboard shortcuts">
  <div class="flex flex-col gap-5">
    {#each groups as group (group.title)}
      <section aria-label={group.title}>
        <h3 class="mb-1 text-[12px] font-semibold text-ink-muted">{group.title}</h3>
        <dl>
          {#each group.shortcuts as shortcut (shortcut.name)}
            <div class="flex min-h-9 items-center justify-between gap-3 text-[14px]">
              <dt>{shortcut.description}</dt>
              <dd class={shortcut.keys ? 'font-medium' : 'text-ink-muted'}>{shortcut.keys || 'Not set'}</dd>
            </div>
          {/each}
        </dl>
        {#if group.title === 'Cycle through preview'}
          <PreviewCloseShortcut />
        {/if}
      </section>
    {/each}
  </div>
  <div class="mt-4 flex justify-end">
    <Button onclick={onedit}>Change shortcuts</Button>
  </div>
</Card>
