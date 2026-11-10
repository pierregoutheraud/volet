<script lang="ts">
  import { prefersReducedMotion } from 'svelte/motion';
  import { fade } from 'svelte/transition';
  import { colorScheme } from '../primitives/color-scheme';
  import Toast from '../primitives/Toast.svelte';
  import type { ToastState } from './toast-state.svelte';

  let { toast }: { toast: ToastState } = $props();

  const duration = $derived(prefersReducedMotion.current ? 0 : 150);
</script>

<!-- At the top of the page, tinted like Search, never in the pointer's way. The region stays, so its news is read. -->
<div
  class="toast-root pointer-events-none fixed inset-x-0 top-4 z-2147483647 flex justify-center font-sans antialiased"
  data-scheme={colorScheme()}
  style:--space-hue={toast.hue}
  role="status"
>
  {#if toast.message}
    <div transition:fade={{ duration }}>
      <Toast message={toast.message} />
    </div>
  {/if}
</div>
