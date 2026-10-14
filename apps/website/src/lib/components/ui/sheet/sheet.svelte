<script lang="ts">
  import type { Snippet } from "svelte";

  let {
    open = $bindable(false),
    children,
  }: {
    open?: boolean;
    children?: Snippet;
  } = $props();
</script>

{#if children}{@render children()}{/if}
