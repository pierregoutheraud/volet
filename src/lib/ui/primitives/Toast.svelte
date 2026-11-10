<script lang="ts">
  import { Check } from '@lucide/svelte';

  let { message }: { message: string } = $props();
</script>

<!-- A short confirmation: a pill on the menus' surface, shadowed like the panel's pills. Sizes in px: it also shows
     over web pages. -->
<div
  class="flex items-center gap-2 rounded-full bg-(--menu) py-2 pr-3.5 pl-3 text-[13px] leading-none font-medium text-ink [box-shadow:var(--pill-shadow),0_0_0_0.5px_var(--rule)]"
>
  <Check size={14} strokeWidth={2.25} class="text-(--focus)" aria-hidden="true" />
  {message}
</div>
