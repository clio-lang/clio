<script>
  import { getContext } from "svelte";
  import { tabsContext } from "../api/context";

  const tabs = getContext(tabsContext);
  const index = tabs.addTitle();
  const current = tabs.current;

  let active = false;
  $: active = $current === index;

  const setActive = () => ($current = index);

</script>

<button class:active on:click={setActive}>
  <h4><slot /></h4>
</button>

<style>
  button {
    padding: 1em;
    border: none;
    outline: none;
  }
  .active {
    background: rgba(0, 0, 0, 0.1);
  }

</style>
