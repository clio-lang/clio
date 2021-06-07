<script>
  import Prism from "./Prism.svelte";
  import Editor from "clio-playground/src/components/Editor.svelte";

  export let code;
  export let language = "";
  export let inline = false;

</script>

{#if inline}
  <code>{code}</code>
{:else if language !== "clio"}
  <Prism {language} {code} />
{:else}
  <div class="playground">
    <Editor {code} title="Clio Docs" />
  </div>
{/if}

<style>
  .playground {
    height: 400px;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0px 0px 32px 8px rgba(0, 0, 0, 0.3);
    border: 1px solid #333;
    max-width: 1280px;
    margin-bottom: 4em;
  }
  @media (max-width: 960px) {
    .playground {
      max-width: 90%;
      padding: 2em;
    }
  }
  @media (max-width: 640px) {
    .playground {
      display: none;
    }
  }

</style>
