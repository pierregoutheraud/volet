<script lang="ts">
  import { Check } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    done: boolean;
    /** Shown once done, next to the title ("Pinned", "On the left"). */
    status: string;
    /** What to do, shown until done. */
    children: Snippet;
    /** The step's buttons, shown until done. */
    actions?: Snippet;
  }

  let { title, done, status, children, actions }: Props = $props();
</script>

<!-- One step of a checklist: what to do until it's done, then a check mark and where things stand. -->
<li class="flex gap-3 py-3" data-step={done ? 'done' : 'todo'} aria-label={title}>
  <span
    class={[
      'mt-px grid size-5 flex-none place-items-center rounded-full',
      done ? 'bg-(--focus) text-(--dot-ink)' : 'border-[1.5px] border-ink-muted/45',
    ]}
    aria-hidden="true"
  >
    {#if done}<Check size={12} strokeWidth={3} />{/if}
  </span>
  <div class="min-w-0 flex-1">
    <div class="flex items-baseline justify-between gap-3">
      <h3 class="text-[14px] font-semibold">{title}</h3>
      <span class={['text-[13px]', done ? 'text-ink-muted' : 'sr-only']}>{done ? status : 'To do'}</span>
    </div>
    {#if !done}
      <div class="mt-1 text-[13px] leading-relaxed text-ink-muted">{@render children()}</div>
      {#if actions}<div class="mt-3 flex flex-wrap gap-2">{@render actions()}</div>{/if}
    {/if}
  </div>
</li>
