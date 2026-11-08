<script lang="ts">
  import { Check, ChevronDown } from '@lucide/svelte';
  import { Select } from 'bits-ui';
  import Leading from '../menu/Leading.svelte';
  import { MENU_ITEM_CLASS } from '../menu/item-class';
  import { MENU_PLACEMENT } from '../menu/placement';
  import { OVERLAY_ROOT } from '../overlay';

  interface Props {
    value: string;
    options: { value: string; label: string }[];
    onchange: (value: string) => void;
    /** Names the choice for screen readers: the sentence around it isn't its label. */
    label: string;
  }

  let { value, options, onchange, label }: Props = $props();

  const selected = $derived(options.find((option) => option.value === value));
</script>

<!-- One choice among a few: a button like the pages' others, opening a list like Volet's menus. -->
<Select.Root type="single" {value} onValueChange={onchange} items={options}>
  <Select.Trigger
    class="flex h-9 cursor-pointer items-center gap-2 rounded-lg bg-hover pr-2.5 pl-3 text-[14px] transition-colors hover:bg-rule data-[state=open]:bg-rule"
    aria-label={label}
  >
    {selected?.label}
    <ChevronDown size={14} strokeWidth={2} class="text-ink-muted" />
  </Select.Trigger>
  <Select.Portal to={OVERLAY_ROOT}>
    <Select.Content class="menu-surface" {...MENU_PLACEMENT} sideOffset={4}>
      <Select.Viewport>
        {#each options as option (option.value)}
          <Select.Item class={MENU_ITEM_CLASS} value={option.value} label={option.label}>
            {#snippet children({ selected: isSelected })}
              <Leading icon={isSelected ? Check : undefined} />
              {option.label}
            {/snippet}
          </Select.Item>
        {/each}
      </Select.Viewport>
    </Select.Content>
  </Select.Portal>
</Select.Root>
