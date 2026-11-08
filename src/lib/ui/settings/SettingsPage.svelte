<script lang="ts">
  import { SettingsStore } from '@/lib/state/settings.svelte';
  import Button from '../primitives/page/Button.svelte';
  import Card from '../primitives/page/Card.svelte';
  import PageShell from '../primitives/page/PageShell.svelte';
  import Select from '../primitives/page/Select.svelte';
  import KeyboardShortcutsSettings from './KeyboardShortcutsSettings.svelte';

  const settings = new SettingsStore();
  void settings.load();

  /** In hours; 0 never closes them. */
  const ARCHIVE_CHOICES = [
    { value: '1', label: '1 hour' },
    { value: '6', label: '6 hours' },
    { value: '12', label: '12 hours' },
    { value: '24', label: '1 day' },
    { value: '168', label: '1 week' },
    { value: '0', label: 'Never close them' },
  ];
  const ARCHIVE_LABEL = "Close unpinned tabs I haven't used for";
</script>

<svelte:window onfocus={() => void settings.refreshShortcuts()} />

<PageShell title="Settings">
  <Card title="Archiving">
    <div class="flex flex-wrap items-center gap-3 text-[14px]">
      {ARCHIVE_LABEL}
      <Select
        label={ARCHIVE_LABEL}
        value={String(settings.archiveAfterHours)}
        options={ARCHIVE_CHOICES}
        onchange={(value) => void settings.setArchiveAfter(Number(value))}
      />
    </div>
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

  <KeyboardShortcutsSettings shortcuts={settings.shortcuts} onedit={() => void settings.editShortcuts()} />

  <Card title="Import">
    <div class="flex items-center justify-between gap-3">
      <p class="text-[14px]">Bring your Spaces, pinned tabs and favorites from Arc.</p>
      <Button onclick={() => void settings.openImport()}>Import from Arc</Button>
    </div>
  </Card>
</PageShell>
