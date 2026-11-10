<script lang="ts">
  import { Switch } from 'bits-ui';

  interface Props {
    /** For the `<label for>` that names it. */
    id: string;
    checked: boolean;
    onchange: (checked: boolean) => void;
  }

  let { id, checked, onchange }: Props = $props();
</script>

<!-- An on/off setting on Volet's pages: the Volet's color when on, like the pages' main button. -->
<Switch.Root
  {id}
  {checked}
  onCheckedChange={onchange}
  class="inline-flex h-[22px] w-9 flex-none items-center rounded-full bg-ink-muted/40 p-0.5 transition-colors data-[state=checked]:bg-(--focus) motion-reduce:transition-none"
>
  <Switch.Thumb
    class="block size-[18px] rounded-full bg-white shadow-[0_1px_2px_oklch(0_0_0/0.25)] transition-transform data-[state=checked]:translate-x-3.5 motion-reduce:transition-none"
  />
</Switch.Root>
