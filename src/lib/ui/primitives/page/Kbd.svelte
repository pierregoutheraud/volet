<script lang="ts">
  /** A keyboard shortcut, as Chrome shows it ("Ctrl+B"). */
  let { keys }: { keys: string } = $props();
</script>

<kbd class="rounded-md bg-hover px-2 py-1 font-sans text-[13px] font-medium whitespace-nowrap">{keys}</kbd>
