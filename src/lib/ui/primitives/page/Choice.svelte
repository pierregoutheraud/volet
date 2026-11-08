<script lang="ts">
  interface Props {
    label: string;
    /** Secondary text, e.g. a count. */
    detail?: string;
    /** Shows a color dot. */
    hue?: number;
    checked: boolean;
    ontoggle: () => void;
  }

  let { label, detail, hue, checked, ontoggle }: Props = $props();
</script>

<label class="flex h-9 items-center gap-3 rounded-lg px-2 hover:bg-hover">
  <input type="checkbox" class="size-4 accent-(--focus)" {checked} onchange={ontoggle} />
  {#if hue !== undefined}
    <span class="block size-2.5 flex-none rounded-full" style:background="oklch(var(--dot-l) var(--dot-c) {hue})"></span>
  {/if}
  <span class="min-w-0 flex-1 truncate text-[14px]">{label}</span>
  {#if detail}<span class="text-[12px] text-ink-muted">{detail}</span>{/if}
</label>
