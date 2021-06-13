<script>
  import { onMount } from "svelte";

  export let tree;
  export let level = 0;

  const keysOf = (tree) => {
    return Object.keys(tree.__subtree).sort((lhs, rhs) => {
      return (
        tree.__subtree[lhs].__meta.order - tree.__subtree[rhs].__meta.order
      );
    });
  };

  const toggleExpand = () => (expanded = !expanded);

  let observer;
  let active;
  let expanded;
  let { pathname } = window.location;

  $: active = pathname.startsWith(tree.__meta?.href);
  $: expanded = active;

  onMount(() => {
    observer = new MutationObserver(() => {
      if (window.location.pathname !== pathname) {
        pathname = window.location.pathname;
      }
    });
    observer.observe(document.getElementById("svelte"), {
      attributes: true,
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  });
</script>

{#if !Object.keys(tree.__subtree).length}
  <a href={tree.__meta.href} class:active class:inner={level}>
    {tree.__meta.title}
  </a>
{:else}
  <a
    class="expandable"
    href={tree.__meta.href}
    class:active
    class:inner={level}
    on:click={toggleExpand}
  >
    <span>{tree.__meta.title}</span>
    {#if expanded}
      <img src="/chevron-down-light.svg" alt="Expanded" />
    {:else}
      <img src="/chevron-right-light.svg" alt="Expand" />
    {/if}
  </a>
  {#if expanded}
    {#each keysOf(tree) as key}
      <svelte:self tree={tree.__subtree[key]} level={level + 1} />
    {/each}
  {/if}
{/if}

<style>
  a {
    text-decoration: none;
    padding: 0.75em;
    display: flex;
    align-items: center;
    padding-right: 4em;
    padding-left: 2em;
    z-index: 2;
    position: relative;
    color: #555;
    width: 100%;
    box-sizing: border-box;
  }
  a:hover {
    color: #222;
  }
  .active {
    color: #4f29f0;
  }
  img {
    height: 1em;
    position: absolute;
    right: 1em;
    pointer-events: none;
    opacity: 0.7;
  }
  .active img {
    opacity: 1;
  }
  .inner {
    margin-left: 1em;
  }
</style>
