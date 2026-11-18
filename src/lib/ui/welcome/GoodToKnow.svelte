<script lang="ts">
  import { normalizeShortcutKeys } from '@/lib/model/shortcut-display';
  import { type WelcomeClient, archiveDelayText } from '@/lib/model/welcome';
  import Button from '../primitives/page/Button.svelte';
  import Card from '../primitives/page/Card.svelte';

  let { client }: { client: WelcomeClient } = $props();

  const searchKeys = $derived(
    normalizeShortcutKeys(client.shortcuts.find((shortcut) => shortcut.name === 'open-palette')?.keys ?? ''),
  );
  const archiveDelay = $derived(archiveDelayText(client.archiveAfterHours));
</script>

{#snippet settingsLink(label: string)}
  <button type="button" class="font-medium text-ink underline underline-offset-2" onclick={() => client.openSettings()}>
    {label}
  </button>
{/snippet}

<Card title="Good to know">
  <div class="flex flex-col gap-5 text-[14px] leading-relaxed">
    <section aria-labelledby="welcome-shortcuts">
      <h3 id="welcome-shortcuts" class="font-semibold">Shortcuts</h3>
      <dl class="mt-1 flex flex-col gap-1">
        {#each client.shortcuts as shortcut (shortcut.name)}
          <div class="flex min-h-8 items-center justify-between gap-3">
            <dt class="text-ink-muted">{shortcut.description}</dt>
            <dd>
              <kbd class="rounded-md bg-hover px-2 py-1 font-sans text-[13px] font-medium">
                {normalizeShortcutKeys(shortcut.keys) || 'Not set'}
              </kbd>
            </dd>
          </div>
        {/each}
      </dl>
      <p class="mt-2 text-[13px] text-ink-muted">Ctrl is the Control key, on a Mac too.</p>
      <div class="mt-3"><Button onclick={() => client.editShortcuts()}>Change shortcuts</Button></div>
    </section>

    <section aria-labelledby="welcome-volets">
      <h3 id="welcome-volets" class="font-semibold">Volets</h3>
      <p class="text-ink-muted">
        Each Volet is one of Chrome's tab groups, with its own pinned tabs, folders and color. Switch between them with
        the shutters at the bottom of the sidebar, or swipe sideways on a trackpad.
      </p>
    </section>

    <section aria-labelledby="welcome-pins">
      <h3 id="welcome-pins" class="font-semibold">Pinned tabs and favorites</h3>
      <p class="text-ink-muted">
        They're bookmarks, kept in a Volet folder in Chrome's bookmarks, so they sync like your other bookmarks.
      </p>
    </section>

    <section aria-labelledby="welcome-archive">
      <h3 id="welcome-archive" class="font-semibold">Tabs you stop using</h3>
      <p class="text-ink-muted">
        {#if archiveDelay}
          Unpinned tabs you haven't used for {archiveDelay} close on their own. Search{searchKeys
            ? ` (${searchKeys})`
            : ''} finds them again. Change the delay in {@render settingsLink('Settings')}.
        {:else}
          Volet can close unpinned tabs you haven't used for a while, and Search finds them again. Turn it on in
          {@render settingsLink('Settings')}.
        {/if}
      </p>
    </section>
  </div>
</Card>
