<script>
  export let bullet;

</script>

{#if bullet === "bullet"}
  <ul><slot /></ul>
{:else}
  <ol><slot /></ol>
{/if}
