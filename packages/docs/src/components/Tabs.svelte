<script>
  import { setContext } from "svelte";
  import { writable } from "svelte/store";
  import { tabsContext } from "../api/context";

  let titleCount = 0;
  let contentCount = 0;
  let current = writable(0);

  const tabs = {
    addTitle() {
      return titleCount++;
    },
    addContent() {
      return contentCount++;
    },
    current,
  };

  setContext(tabsContext, tabs);

</script>

<div class="tabs">
  <slot />
</div>

<style>
  .tabs {
    display: flex;
    flex-direction: column;
    border: 1px solid rgba(0, 0, 0, 0.1);
    margin: 1em 0;
    border-radius: 4px;
  }

</style>
