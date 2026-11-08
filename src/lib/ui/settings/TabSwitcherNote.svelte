<script lang="ts">
  import { RecentTabsSettings } from '@/lib/state/recent-tabs-settings.svelte';
  import Button from '../primitives/page/Button.svelte';

  /** Under the switcher's shortcuts: how to turn it off, and a way back when Chrome withholds website access. */
  const settings = new RecentTabsSettings();
  void settings.load();
</script>

<svelte:window onfocus={() => void settings.load()} />

<p class="mt-1 text-[12px] leading-relaxed text-ink-muted">
  Hold the modifier to pick one of your five most recent tabs, then let go to switch. Remove both shortcuts to turn the
  switcher off: it then takes no page previews.
</p>
{#if !settings.access}
  <div class="mt-3 flex items-center justify-between gap-3">
    <p class="text-[13px] leading-relaxed">Chrome doesn't let Volet read websites, so tab switching is off.</p>
    <Button disabled={settings.busy} onclick={() => void settings.allow()}>
      {settings.busy ? 'Updating...' : 'Allow website access'}
    </Button>
  </div>
{/if}
{#if settings.error}<p role="alert" class="mt-2 text-[12px]">{settings.error}</p>{/if}
