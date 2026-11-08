<script lang="ts">
  import { normalizeShortcutKeys, shortcutBindingKind } from '@/lib/model/shortcut-display';

  let { value, defaultKeys = '', label, toggle = false, recording = false, disabled = false, onclick, onkeydown, onblur }: {
    value: string;
    defaultKeys?: string;
    label: string;
    /** A recorder, pressed while recording; otherwise a plain button (a native binding opens Chrome's editor). */
    toggle?: boolean;
    recording?: boolean;
    disabled?: boolean;
    onclick: () => void;
    onkeydown?: (event: KeyboardEvent) => void;
    onblur?: () => void;
  } = $props();

  const kind = $derived(shortcutBindingKind(value, defaultKeys));
  const display = $derived(normalizeShortcutKeys(value));
</script>

<button
  type="button"
  class={[
    'flex min-h-9 shrink-0 items-center justify-end gap-2 rounded-lg px-3 text-[13px] focus-visible:outline-2 focus-visible:outline-(--focus) disabled:opacity-40',
    kind === 'custom' && !recording
      ? 'bg-[color-mix(in_oklch,var(--shortcut-custom)_12%,transparent)] text-(--shortcut-custom) hover:bg-[color-mix(in_oklch,var(--shortcut-custom)_20%,transparent)]'
      : 'bg-hover text-ink-muted hover:bg-rule',
  ]}
  aria-label={label}
  aria-pressed={toggle ? recording : undefined}
  data-binding={kind}
  {disabled}
  {onclick}
  {onkeydown}
  {onblur}
>
  <span class="font-medium">{recording ? 'Press a shortcut...' : display || 'Not set'}</span>
  {#if value && !recording}<span class="text-[10px]">{kind === 'default' ? 'Default' : 'Custom'}</span>{/if}
</button>
