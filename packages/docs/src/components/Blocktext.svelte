<script>
  export let type;

  const getColor = (type) => {
    if (type === "check") return "#78c0a8";
    if (type === "exclamation") return "#c02e2e";
    if (type === "info") return "#dd8322";
    if (type === "question") return "#317dd5";
    return "#78c0a8";
  };

  const color = getColor(type);

</script>

<div class="block {type}" style="--color: {color}">
  <div class="icon {type}">
    <img src="/{type}-light.svg" alt={type} />
  </div>
  <div class="content">
    <slot />
  </div>
</div>

<style>
  .block {
    width: 100%;
    margin: 1em auto;
    font-style: italic;
    color: #555555;
    border-left: 8px solid var(--color);
    position: relative;
    background: #ddd;
    box-sizing: border-box;
    border-radius: 4px;
    display: flex;
    align-items: center;
  }

  .icon {
    padding: 1em;
    padding-right: 0em;
    color: var(--color);
  }

  .icon img {
    height: 1.2em;
  }

  .content {
    padding: 1em;
  }

</style>
