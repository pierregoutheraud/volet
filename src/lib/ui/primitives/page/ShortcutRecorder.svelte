<script lang="ts">
  import { keyboardShortcutFromEvent } from '@/lib/model/keyboard-shortcut';

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
  <div class="flex items-center gap-2">
    <button
      type="button"
      class="min-h-9 rounded-lg bg-hover px-3 text-[13px] hover:bg-rule focus-visible:outline-2 focus-visible:outline-(--focus) disabled:opacity-40"
      aria-label={`Set ${label} shortcut`}
      aria-pressed={recording}
      {disabled}
      onclick={() => { recording = true; error = ''; }}
      onkeydown={record}
      onblur={() => { recording = false; }}
    >{recording ? 'Press a shortcut...' : value || 'Not set'}</button>
    {#if value}
      <button
        type="button"
        class="min-h-9 rounded-lg px-2 text-[12px] text-ink-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-(--focus) disabled:opacity-40"
        aria-label={`Clear ${label} shortcut`}
        {disabled}
        onclick={() => { recording = false; error = ''; onrecord(''); }}
      >Clear</button>
    {/if}
  </div>
  {#if error}<p role="alert" class="max-w-64 text-right text-[12px] text-ink-muted">{error}</p>{/if}
</div>
