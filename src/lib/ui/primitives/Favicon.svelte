<script lang="ts">
  import { Globe } from '@lucide/svelte';
  import { faviconSources } from '@/lib/model/favicon';
  import { hostOf } from '@/lib/model/url';

  interface Props {
    url: string;
    /** The icon Chrome shows on the open tab, when there is one: preferred over the cache. */
    icon?: string;
    size?: number;
    /** Fully resolved image sources for a host that cannot request the favicon cache directly. Empty means fallback only. */
    sources?: string[];
  }

  let { url, icon, size = 16, sources }: Props = $props();

  /** Browser pages (new tab, settings) have no site favicon. */
  const internal = $derived(/^(chrome|about|edge|brave):/.test(url));
  /** Sources that failed to load; the next one is tried. */
  let failed = $state.raw<string[]>([]);
  const src = $derived((sources ?? faviconSources(url, size, icon)).find((candidate) => !failed.includes(candidate)));
</script>

{#if internal}
  <span class="grid flex-none place-items-center text-ink-muted" style:width="{size}px" style:height="{size}px">
    <Globe size={size - 1} strokeWidth={1.75} />
  </span>
{:else if src}
  <img
    class="block flex-none rounded-[3px]"
    {src}
    alt=""
    width={size}
    height={size}
    draggable="false"
    onerror={() => (failed = [...failed, src])}
  />
{:else}
  <span
    class="grid flex-none place-items-center rounded-[4px] bg-rule leading-none font-semibold text-ink-muted"
    style:width="{size}px"
    style:height="{size}px"
    style:font-size="{size * 0.62}px"
    aria-hidden="true"
  >
    {hostOf(url).charAt(0).toUpperCase()}
  </span>
{/if}
