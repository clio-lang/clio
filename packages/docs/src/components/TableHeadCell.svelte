<script>
  export let center = false;
  export let left = false;
  export let right = false;

</script>

<th class:center class:left class:right><slot /></th>

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

  th {
    padding: 1em;
  }

  th:not(:last-of-type) {
    border-right: 1px solid rgba(0, 0, 0, 0.1);
  }

</style>
