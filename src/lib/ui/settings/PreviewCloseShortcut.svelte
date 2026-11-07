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
  <p class="mt-2 text-[12px] leading-relaxed text-ink-muted">
    Record this shortcut here, including the modifier you hold while cycling. It only works while the preview is open.
  </p>
  {#if settings.error}<p role="alert" class="mt-2 text-[12px]">{settings.error}</p>{/if}
</div>
