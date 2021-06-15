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

  const toggleExpand = () => {
    expanded = !expanded;
  };

  let observer;
  let active;
  let expanded;
  let { pathname } = window.location;

  $: active = pathname.startsWith(tree.__meta?.href);
  $: expanded = expanded || active;

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
{:else if tree.__meta}
  <div class="expandable" class:expanded>
    <div class="head">
      <a href={tree.__meta.href} class:active class:inner={level}>
        <span>{tree.__meta.title}</span>
      </a>
      {#if expanded}
        <img
          src="/chevron-down-light.svg"
          alt="Expanded"
          on:click={toggleExpand}
        />
      {:else}
        <img
          src="/chevron-right-light.svg"
          alt="Expand"
          on:click={toggleExpand}
        />
      {/if}
    </div>
    {#if expanded}
      {#each keysOf(tree) as key}
        <svelte:self tree={tree.__subtree[key]} level={level + 1} />
      {/each}
    {/if}
  </div>
{:else}
  {#each keysOf(tree) as key}
    <svelte:self tree={tree.__subtree[key]} {level} />
  {/each}
{/if}

<style>
  .expandable {
    display: flex;
    flex-direction: column;
    min-width: 280px;
  }
  .expandable .head {
    display: flex;
    align-items: center;
    padding: 1em;
  }
  .expanded {
    padding-bottom: 1em;
  }
  a {
    text-decoration: none;
    display: flex;
    align-items: center;
    z-index: 2;
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
    opacity: 0.7;
    margin-left: 2em;
  }
  .inner {
    margin-left: 1em;
  }
</style>
