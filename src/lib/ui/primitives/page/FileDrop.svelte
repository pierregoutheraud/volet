<script lang="ts">
  interface Props {
    label: string;
    accept?: string;
    onfile: (file: File) => void;
  }

  let { label, accept, onfile }: Props = $props();

  let over = $state(false);
</script>

<!-- Drop a file here, or click (or press Space) to choose one. The label opens the file input. -->
<label
  class={[
    'flex w-full flex-col items-center gap-1 rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors focus-within:border-(--focus)',
    over ? 'border-(--focus) bg-hover' : 'border-rule hover:bg-hover',
  ]}
  ondragover={(event) => {
    event.preventDefault();
    over = true;
  }}
  ondragleave={() => (over = false)}
  ondrop={(event) => {
    event.preventDefault();
    over = false;
    const file = event.dataTransfer?.files[0];
    if (file) onfile(file);
  }}
>
  <span class="text-[14px] font-medium">{label}</span>
  <span class="text-[12px] text-ink-muted">or click to choose it</span>
  <input
    class="sr-only"
    type="file"
    {accept}
    onchange={(event) => {
      const file = event.currentTarget.files?.[0];
      if (file) onfile(file);
      event.currentTarget.value = '';
    }}
  />
</label>
