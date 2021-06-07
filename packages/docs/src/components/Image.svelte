<script>
  export let src;
  export let alt;
  export let inline = false;

</script>

<img {src} {alt} class:inline />

<style>
  img:not(.inline) {
    max-width: 100%;
    border-radius: 4px;
    margin-bottom: 1em;
  }
  img.inline {
    display: inline;
    height: 1em;
    vertical-align: text-top;
  }

</style>
