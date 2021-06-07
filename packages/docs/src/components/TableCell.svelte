<script>
  export let center = false;
  export let left = false;
  export let right = false;

</script>

<td class:center class:left class:right><slot /></td>

<style>
  .center {
    text-align: center;
  }
  .left {
    text-align: left;
  }
  .right {
    text-align: right;
  }

  td {
    padding: 1em;
  }

  td:not(:last-of-type) {
    border-right: 1px solid rgba(0, 0, 0, 0.1);
  }

</style>
