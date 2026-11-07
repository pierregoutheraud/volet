<script lang="ts">
  import { SettingsStore } from '@/lib/state/settings.svelte';
  import Button from '../primitives/page/Button.svelte';
  import Card from '../primitives/page/Card.svelte';
  import PageShell from '../primitives/page/PageShell.svelte';
  import RecentTabsSettings from './RecentTabsSettings.svelte';
  import KeyboardShortcutsSettings from './KeyboardShortcutsSettings.svelte';

  const settings = new SettingsStore();
  void settings.load();

  const ARCHIVE_CHOICES = [
    { hours: 1, label: '1 hour' },
    { hours: 6, label: '6 hours' },
    { hours: 12, label: '12 hours' },
    { hours: 24, label: '1 day' },
    { hours: 168, label: '1 week' },
    { hours: 0, label: 'Never close them' },
  ];
</script>

<svelte:window onfocus={() => void settings.refreshShortcuts()} />

<PageShell title="Settings">
  <Card title="Archiving">
    <label class="flex flex-wrap items-center gap-3 text-[14px]">
      Close unpinned tabs I haven't used for
      <select
        class="h-9 rounded-lg bg-hover px-2 text-[14px]"
        value={settings.archiveAfterHours}
        onchange={(event) => void settings.setArchiveAfter(Number(event.currentTarget.value))}
      >
        {#each ARCHIVE_CHOICES as choice (choice.hours)}
          <option value={choice.hours}>{choice.label}</option>
        {/each}
      </select>
    </label>
    <p class="mt-3 text-[13px] leading-relaxed text-ink-muted">
      Closed tabs go to the archive. Find them again with search{settings.searchKeys
        ? ` (${settings.searchKeys})`
        : ' in the sidebar'}.
    </p>
    <div class="mt-4 flex items-center justify-between gap-3">
      <span class="text-[13px] text-ink-muted">
        {settings.archivedCount === 1 ? '1 archived tab' : `${settings.archivedCount} archived tabs`}
      </span>
      <Button disabled={settings.archivedCount === 0} onclick={() => void settings.clearArchive()}>Clear archive</Button>
    </div>
  </Card>

  <RecentTabsSettings />

  <KeyboardShortcutsSettings shortcuts={settings.shortcuts} onedit={() => void settings.editShortcuts()} />

  <Card title="Import">
    <div class="flex items-center justify-between gap-3">
      <p class="text-[14px]">Bring your Spaces, pinned tabs and favorites from Arc.</p>
      <Button onclick={() => void settings.openImport()}>Import from Arc</Button>
    </div>
  </Card>
</PageShell>
