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
    <Editor {code} title="Clio docs" examples={false} />
  </div>
{/if}

<style>
  .playground {
    height: 400px;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0px 0px 32px 8px rgba(0, 0, 0, 0.3);
    border: 1px solid #333;
    margin-bottom: 1em;
  }
  code {
    background: #263238;
    color: #eee;
    font-family: "Fira Code";
    padding: 0.25em 0.75em;
    border-radius: 4px;
    margin: 0 0.5em;
  }
  @media (max-width: 960px) {
    .playground {
      width: 100%;
    }
  }
</style>
