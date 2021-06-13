<script>
  import { onMount } from "svelte";
  import SideNavItem from "./SideNavItem.svelte";

  import variants from "../variants.json";

  export let menuOpen;
  export let currentVariant;
  export let metaVariant;

  const latestVariant = variants
    .slice()
    .sort((lhs, rhs) => rhs.localeCompare(lhs))
    .shift();

  onMount(() => {
    currentVariant =
      window.location.pathname.split("/").shift() || latestVariant;
  });

  let routes;
  $: routes = Object.entries(metaVariant?.routes || {}).map(
    ([route, { title }]) => ({ route, title })
  );

  const set = (tree, parts, data) => {
    const part = parts.shift();
    if (!parts.length) {
      tree[part] = { __meta: data, __subtree: {} };
    } else {
      tree[part] = tree[part] || { __subtree: {} };
      set(tree[part].__subtree, parts, data);
    }
  };

  const treeify = (routes) => {
    const tree = {};
    for (const { route, title } of routes) {
      const parts = route.split("/");
      set(tree, parts, { title, href: "/" + route });
    }
    return tree;
  };

  let tree;
  $: if (routes) tree = treeify(routes)[currentVariant];
</script>

<div class="sidenav" class:open={menuOpen}>
  <div class="variants">
    <select>
      {#each variants as variant}
        <option value={variant} selected={variant == currentVariant}>
          {variant}
        </option>
      {/each}
    </select>
  </div>
  {#if tree}
    <SideNavItem {tree} />
  {/if}
</div>

<style>
  .sidenav {
    background: #f5f7f9;
    padding: 2em;
    padding-right: 0;
    padding-left: 1em;
    border-right: 1px solid rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
  }
  .variants {
    align-self: flex-end;
    padding: 0 1em;
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 1em;
  }
  .variants select {
    border: 1em solid #fff;
    border-radius: 2em;
    padding: 0 1em;
    width: 100%;
    box-shadow: 0px 0px 1px rgb(0 0 0 / 20%);
    outline: none;
  }
  @media (max-width: 768px) {
    .sidenav {
      position: fixed;
      height: 100%;
      width: 80%;
      max-width: 400px;
      transform: translateX(-100vh);
      transition: cubic-bezier(0.55, 0.055, 0.675, 0.19) 0.4s all;
      z-index: 1111;
      overflow-y: auto;
    }
    .sidenav.open {
      transform: translateX(0);
      box-shadow: 0px 0px 128px 8px rgba(0, 0, 0, 0.3);
    }
  }
</style>
