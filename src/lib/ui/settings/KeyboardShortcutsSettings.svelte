<script lang="ts">
  import { TAB_SWITCHER_GROUP, groupKeyboardShortcuts, type KeyboardShortcut } from '@/lib/model/keyboard-shortcuts';
  import Button from '../primitives/page/Button.svelte';
  import Card from '../primitives/page/Card.svelte';
  import ShortcutBinding from '../primitives/page/ShortcutBinding.svelte';
  import PreviewCloseShortcut from './PreviewCloseShortcut.svelte';
  import TabSwitcherNote from './TabSwitcherNote.svelte';

  let { shortcuts, onedit }: { shortcuts: readonly KeyboardShortcut[]; onedit: () => void } = $props();
  const groups = $derived(groupKeyboardShortcuts(shortcuts));
</script>

<Card title="Keyboard shortcuts">
  <div class="flex flex-col gap-5">
    {#each groups as group (group.title)}
      <section aria-label={group.title}>
        <h3 class="mb-1 text-[12px] font-semibold text-ink-muted">{group.title}</h3>
        <dl class="flex flex-col gap-1">
          {#each group.shortcuts as shortcut (shortcut.name)}
            <div class="flex min-h-9 items-center justify-between gap-3 text-[14px]">
              <dt>{shortcut.description}</dt>
              <dd>
                <ShortcutBinding
                  value={shortcut.keys}
                  defaultKeys={shortcut.defaultKeys}
                  label={`Change ${shortcut.description.toLowerCase()} shortcut`}
                  onclick={onedit}
                />
              </dd>
            </div>
          {/each}
        </dl>
        {#if group.title === TAB_SWITCHER_GROUP}
          <TabSwitcherNote />
          <div class="mt-3"><PreviewCloseShortcut /></div>
        {/if}
      </section>
    {/each}
  </div>
  <div class="mt-4 flex justify-end">
    <Button onclick={onedit}>Change shortcuts</Button>
  </div>
</Card>
