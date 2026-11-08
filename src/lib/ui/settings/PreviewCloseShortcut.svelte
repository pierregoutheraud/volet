<script lang="ts">
  import { previewShortcutError } from '@/lib/model/preview-close-shortcut';
  import { PreviewCloseSettings } from '@/lib/state/preview-close-settings.svelte';
  import ShortcutRecorder from '../primitives/page/ShortcutRecorder.svelte';

  const settings = new PreviewCloseSettings();
</script>

<div {@attach () => settings.watch()}>
  <div class="flex min-h-10 items-center justify-between gap-3 text-[14px]">
    <span>Close highlighted tab</span>
    <ShortcutRecorder
      value={settings.shortcut}
      label="close highlighted tab"
      disabled={settings.busy}
      validate={previewShortcutError}
      onrecord={(shortcut) => void settings.save(shortcut)}
    />
  </div>
  <div class="mt-2 flex items-start justify-between gap-3">
    <p class="text-[12px] leading-relaxed text-ink-muted">
      Record this shortcut here, including the modifier you hold while cycling. It only works while the preview is open.
    </p>
    {#if settings.shortcut}
      <button
        type="button"
        class="shrink-0 rounded-md px-2 py-1 text-[12px] text-ink-muted hover:bg-hover focus-visible:outline-2 focus-visible:outline-(--focus) disabled:opacity-40"
        aria-label="Clear close highlighted tab shortcut"
        disabled={settings.busy}
        onclick={() => void settings.save('')}
      >Clear</button>
    {/if}
  </div>
  {#if settings.error}<p role="alert" class="mt-2 text-[12px]">{settings.error}</p>{/if}
</div>
