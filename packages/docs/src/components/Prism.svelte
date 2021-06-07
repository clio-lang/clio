<script>
  import { onMount } from "svelte";
  import Prism from "prismjs";
  import "prismjs/components/prism-bash.js";
  import "prismjs/components/prism-toml.js";
  import "prismjs/plugins/line-highlight/prism-line-highlight.js";
  import "prismjs/plugins/file-highlight/prism-file-highlight.js";

  export let language;
  export let code;

  const langClass = `language-${language}`;

  onMount(() => Prism.highlightAll());

</script>

<pre class={langClass}><code class={langClass}>{code}</code></pre>

<style>
  code {
    padding: 0;
    box-sizing: border-box;
    width: 100%;
    white-space: pre;
  }
  code:not(:last-child) {
    margin-bottom: 2em;
  }
  code:not(:first-child) {
    margin-top: 1em;
  }

</style>
