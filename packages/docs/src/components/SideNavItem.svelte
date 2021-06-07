<script>

  export let tree;
  export let key;
  export let level = 0;

  const href = "/" + (key === "." ? "" : key);

  const keysOf = (tree) => {
    const { index, ...rest } = tree.__subtree;
    return Object.keys(rest).sort((lhs, rhs) => {
      return (
        tree.__subtree[lhs].__meta.order - tree.__subtree[rhs].__meta.order
      );
    });
  };

  let active = false;
  let expanded = false;

  /* $: active = $page.path === href;
  $: expanded = $page.path.startsWith(href); */

  const toggleExpand = () => (expanded = !expanded);

</script>

{#if !tree.__subtree}
  <a {href} class:active class:inner={level}>{tree.__meta.title}</a>
{:else}
  <a
    class="expandable"
    {href}
    class:active
    class:inner={level}
    on:click={toggleExpand}
  >
    <span>{tree.__subtree.index.__meta.title}</span>
    {#if expanded}
      <img src="/chevron-down-light.svg" alt="Expanded" />
    {:else}
      <img src="/chevron-right-light.svg" alt="Expand" />
    {/if}
  </a>
  {#if expanded}
    {#each keysOf(tree) as key}
      <svelte:self {key} tree={tree.__subtree[key]} level={level + 1} />
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
  }
  a:hover {
    color: #222;
  }
  .active {
    background: #fff;
    color: #000;
    box-shadow: -9px 0px 14px 2px rgb(0 0 0 / 11%);
    border-bottom-left-radius: 4px;
    border-top-left-radius: 4px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    margin-right: -1px;
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
