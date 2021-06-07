<script>
  import { getContext } from "svelte";
  import { tabsContext } from "../api/context";

  const tabs = getContext(tabsContext);
  const index = tabs.addContent();
  const current = tabs.current;

  let active = false;
  $: active = $current === index;

</script>

{#if active}
  <div class="tab-content"><slot /></div>
{/if}

<style>
  .tab-content {
    display: flex;
    flex-direction: column;
  }

</style>
