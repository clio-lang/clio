<script>
  export let title;
  export let share = false;
  export let query = "";

  import { clio, loadMonaco, pastelsOnDark } from "../monaco";
  import run from "../clio/run";

  import { compile } from "clio-core";
  import inspect from "object-inspect";

  const samples = {
    parallelFib() {
      return [
        "fn fib n:",
        "  if n < 2: n",
        "  else: (fib n - 1)",
        "      + (fib n - 2)",
        "",
        "fn print item index array:",
        "  console.log item",
        "",
        "export fn main argv:",
        "  [39 40 41 42]",
        "    -> * await |fib|",
        "    -> * print",
      ].join("\n");
    },
    fib() {
      return [
        "fn fib n:",
        "  if n < 2: n",
        "  else: (fib n - 1)",
        "      + (fib n - 2)",
        "",
        "fn print item index array:",
        "  console.log item",
        "",
        "export fn main argv:",
        "  [39 40 41 42]",
        "    -> * fib",
        "    -> * print",
      ].join("\n");
    },
  };

  function getCode() {
    if (query) {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get(query);
      return code ? decodeURIComponent(code) : samples.parallelFib();
    }
    return samples.parallelFib();
  }

  let editor;
  let domConsole;

  const setSampleCode = (event) => {
    const { value } = event.target || "parallelFib";
    const code = samples[value]();
    editor.setValue(code);
  };

  let isActive = false;

  const showMessage = () => {
    isActive = true;
    setTimeout(() => (isActive = false), 4000);
  };

  const copyShareURL = () => {
    const code = editor.getValue();
    const encoded = encodeURIComponent(code);
    const { origin, pathname } = window.location;
    const url = `${origin}${pathname}?${query}=${encoded}`;
    navigator.clipboard.writeText(url);
    showMessage();
  };

  const compileAndRun = () => {
    const src = editor.getValue();
    const { code } = compile(src, "main.clio");
    const lines = [];
    (async () => {
      console.log = async (...args) => {
        lines.push(args.map(inspect).join(" "));
        domConsole.setValue(lines.join("\n"));
      };
      const now = performance.now();
      await run(code);
      const end = performance.now();
      const time = `Took ${Math.round((end - now) * 100) / 100}ms`;
      lines.push("-".repeat(time));
      lines.push(time);
      domConsole.setValue(lines.join("\n"));
    })();
    return false;
  };

  const makeEditor = async () => {
    const monaco = window.monaco || (await loadMonaco());

    monaco.languages.register({ id: "clio" });
    monaco.languages.setMonarchTokensProvider("clio", clio);
    monaco.editor.defineTheme("PastelsOnDark", pastelsOnDark);
    monaco.editor.setTheme("PastelsOnDark");
    editor = monaco.editor.create(document.getElementById("left-pane"), {
      value: getCode(),
      language: "clio",
      fontFamily: "Fira Code",
      fontLigatures: true,
      fontSize: 16,
    });
    domConsole = monaco.editor.create(document.getElementById("right-pane"), {
      value: "",
      language: "javascript",
      fontFamily: "Fira Code",
      fontLigatures: true,
      fontSize: 16,
      readOnly: true,
    });
  };

  makeEditor();
</script>

<style>
  .container {
    height: 100%;
    width: 100%;
    display: flex;
    flex-direction: column;
    box-sizing: border-box;
    position: relative;
  }
  .toolbar {
    height: 64px;
    padding: 1em;
    box-sizing: border-box;
    background: #211e1e;
    box-shadow: 0px 0px 32px 8px rgba(0, 0, 0, 0.4);
    color: #dadada;
    z-index: 1000;
    display: flex;
    align-items: center;
  }
  .btn,
  .sample {
    color: #dadada;
    text-decoration: none;
    border-radius: 6px;
    border: 2px solid rgb(100, 166, 100);
    padding: 0.5em 1em;
    background: transparent;
  }
  .sample {
    font-size: 0.95em;
    margin-right: 1em;
    outline: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
  }
  .share {
    margin-right: 1em;
  }
  .sep {
    height: 1em;
    box-sizing: border-box;
    background: #211e1e;
    z-index: 999;
  }
  .spacer {
    flex: 1;
  }
  .editor {
    background: #211e1e;
    display: flex;
    flex: 1;
    overflow: hidden;
  }
  .editor > div {
    flex: 1;
  }
  .logo {
    zoom: 0.25;
    margin-right: 64px;
  }
  .saved {
    position: absolute;
    padding: 1em;
    border-radius: 4px;
    box-shadow: 0px 0px 32px 8px rgba(0, 0, 0, 0.4);
    bottom: -10em;
    left: 50%;
    transform: translateX(-50%);
    width: auto;
    z-index: 1000;
    background: #211e1e;
  }
  @keyframes appear {
    0% {
      bottom: -10em;
    }
    10% {
      bottom: 1em;
    }
    70% {
      bottom: 1em;
    }
    100% {
      bottom: -10em;
    }
  }
  .saved.isActive {
    animation: appear 4s ease-in forwards;
  }
</style>

<div class="container">
  <div class="toolbar">
    <img src="/logo-128x128.png" class="logo" alt="logo" />
    <span class="title">{title}</span>
    <div class="spacer" />
    <select class="sample" on:change={setSampleCode}>
      <option selected value="parallelFib">Parallel Fib</option>
      <option value="fib">Fib</option>
    </select>
    {#if share}
      <a href="#?" class="btn share" on:click={copyShareURL}> Share </a>
    {/if}
    <a href="#?" class="btn" on:click={compileAndRun}> Run </a>
  </div>
  <div class="sep" />
  <div class="editor">
    <div id="left-pane" />
    <div id="right-pane" />
  </div>
  <div class="saved" class:isActive>Saved to clipboard</div>
</div>
