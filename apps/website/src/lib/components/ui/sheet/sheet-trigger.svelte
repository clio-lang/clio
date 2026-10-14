<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    onclick,
    class: className,
    children,
    ...restProps
  }: {
    onclick?: () => void;
    class?: string;
    children?: Snippet;
  } = $props();
</script>

<button {onclick} class={className} {...restProps}>
  {#if children}{@render children()}{/if}
</button>
