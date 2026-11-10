<script lang="ts">
  import { prefersReducedMotion } from 'svelte/motion';
  import { fade } from 'svelte/transition';
  import Toast from '../primitives/Toast.svelte';
  import type { ToastState } from '../toast/toast-state.svelte';

  let { toast }: { toast: ToastState } = $props();

  const duration = $derived(prefersReducedMotion.current ? 0 : 150);
</script>

<!-- At the top of the panel, over its content, never in the pointer's way. The region stays, so its news is read. -->
<div class="pointer-events-none absolute inset-x-0 top-3 z-50 flex justify-center" role="status">
  {#if toast.message}
    <div transition:fade={{ duration }}>
      <Toast message={toast.message} />
    </div>
  {/if}
</div>
