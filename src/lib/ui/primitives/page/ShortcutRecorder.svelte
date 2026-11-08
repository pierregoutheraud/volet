<script lang="ts">
  import { keyboardShortcutFromEvent } from '@/lib/model/keyboard-shortcut';
  import ShortcutBinding from './ShortcutBinding.svelte';

  let { value, label, disabled = false, validate, onrecord }: {
    value: string;
    label: string;
    disabled?: boolean;
    validate: (shortcut: string) => string;
    onrecord: (shortcut: string) => void;
  } = $props();

  let recording = $state(false);
  let error = $state('');

  function record(event: KeyboardEvent) {
    if (!recording) return;
    if (event.key === 'Tab') { recording = false; return; }
    event.preventDefault();
    event.stopPropagation();
    if (event.key === 'Escape') { recording = false; error = ''; return; }
    if (event.repeat) return;
    const shortcut = keyboardShortcutFromEvent(event);
    if (!shortcut) return;
    error = validate(shortcut);
    if (error) return;
    recording = false;
    onrecord(shortcut);
  }
</script>

<div class="flex flex-col items-end gap-1">
  <ShortcutBinding
    {value}
    label={`Set ${label} shortcut`}
    toggle
    {recording}
    {disabled}
    onclick={() => { recording = true; error = ''; }}
    onkeydown={record}
    onblur={() => { recording = false; error = ''; }}
  />
  {#if error}<p role="alert" class="max-w-64 text-right text-[12px] text-ink-muted">{error}</p>{/if}
</div>
