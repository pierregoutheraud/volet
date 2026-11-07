<script lang="ts">
  import { RecentTabsSettings } from '@/lib/state/recent-tabs-settings.svelte';
  import Button from '../primitives/page/Button.svelte';
  import Card from '../primitives/page/Card.svelte';

  const settings = new RecentTabsSettings();
  void settings.load();
</script>

<svelte:window onfocus={() => void settings.load()} />

<Card title="Recent tabs">
  <p class="text-[14px]">Cycle through your five most recent tabs across Volets in this window.</p>
  <p class="mt-3 text-[13px] leading-relaxed text-ink-muted">
    Set forward and backward bindings independently under Keyboard shortcuts. Hold the shortcut modifier to choose
    a tab, then release it to switch. All preview shortcuts start unassigned, with no implicit bindings.
  </p>
  <p class="mt-3 text-[13px] leading-relaxed text-ink-muted">
    Website access lets Volet detect key releases and keep temporary page previews on this device.
    Previews appear after you visit a tab. Chrome pages and the Web Store switch to the previous tab without a preview.
  </p>
  <div class="mt-4 flex items-center justify-between gap-3">
    <span class="text-[13px] text-ink-muted">{settings.enabled ? 'Enabled' : 'Disabled'}</span>
    <Button disabled={settings.busy} onclick={() => void settings.toggle()}>
      {settings.busy ? 'Updating...' : settings.enabled ? 'Disable tab switcher' : 'Enable tab switcher'}
    </Button>
  </div>
  {#if settings.error}<p role="alert" class="mt-3 text-[13px]">{settings.error}</p>{/if}
</Card>
