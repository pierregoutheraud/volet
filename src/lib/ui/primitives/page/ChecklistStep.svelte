<script lang="ts">
  import { Check, Minus } from '@lucide/svelte';
  import type { Snippet } from 'svelte';

  interface Props {
    title: string;
    done: boolean;
    /** Set aside without doing it (an optional step): folded away like a done one, without the check mark. */
    skipped?: boolean;
    /** Not needed to finish the checklist: says so until it's done or skipped. */
    optional?: boolean;
    /** Shown once done or skipped, next to the title ("Pinned", "On the left", "Skipped"). */
    status: string;
    /** Shown right after the title, done or not (the step's shortcut). */
    badge?: Snippet;
    /** What to do, shown until done or skipped. */
    children: Snippet;
    /** The step's buttons, shown until done or skipped. */
    actions?: Snippet;
  }

  let { title, done, skipped = false, optional = false, status, badge, children, actions }: Props = $props();

  const settled = $derived(done || skipped);
  const label = $derived(settled ? status : optional ? 'Optional' : 'To do');
</script>

<!-- One step of a checklist: what to do until it's done (or skipped), then a mark and where things stand. -->
<li class="flex gap-3 py-3" data-step={done ? 'done' : skipped ? 'skipped' : 'todo'} aria-label={title}>
  <span
    class={[
      'mt-px grid size-5 flex-none place-items-center rounded-full',
      done ? 'bg-(--focus) text-(--dot-ink)' : 'border-[1.5px] border-ink-muted/45 text-ink-muted',
    ]}
    aria-hidden="true"
  >
    {#if done}
      <Check size={12} strokeWidth={3} />
    {:else if skipped}
      <Minus size={12} strokeWidth={3} />
    {/if}
  </span>
  <div class="min-w-0 flex-1">
    <div class="flex items-baseline justify-between gap-3">
      <div class="flex items-baseline gap-2">
        <h3 class={['text-[14px] font-semibold', skipped && 'text-ink-muted']}>{title}</h3>
        {#if badge}{@render badge()}{/if}
      </div>
      <span class={['text-[13px]', settled || optional ? 'text-ink-muted' : 'sr-only']}>{label}</span>
    </div>
    {#if !settled}
      <div class="mt-1 text-[13px] leading-relaxed text-ink-muted">{@render children()}</div>
      {#if actions}<div class="mt-3 flex flex-wrap gap-2">{@render actions()}</div>{/if}
    {/if}
  </div>
</li>
