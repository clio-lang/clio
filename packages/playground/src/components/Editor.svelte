<script>
  export let title;
  export let share = false;
  export let query = "";

  let showConsole = true;
  let showRun = true;
  let showExamples = true;

  import FontFaceObserver from "fontfaceobserver";

  const font = new FontFaceObserver("Fira Code");

  import { clio, loadMonaco, pastelsOnDark } from "../monaco.js";
  import run from "../clio/run.js";

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
        "export fn main argv:",
        "  [39 40 41 42]",
        "    -> * [await] |fib|",
        "    -> * (console.log @it)",
        ,
      ].join("\n");
    },
    parallelFibAlternate() {
      return [
        "fn fib n:",
        "  if n < 2: n",
        "  else: (fib n - 1)",
        "      + (fib n - 2)",
        "",
        "export fn main argv:",
        "  [39 40 41 42]",
        "    -> * |fib|",
        "    -> * .then (console.log @it)",
        ,
      ].join("\n");
    },
    fib() {
      return [
        "fn fib n:",
        "  if n < 2: n",
        "  else: (fib n - 1)",
        "      + (fib n - 2)",
        "",
        "export fn main argv:",
        "  [39 40 41 42]",
        "    -> * fib",
        "    -> * (console.log @it)",
      ].join("\n");
    },
    filter() {
      return [
        "export fn main argv:",
        "  0..10 -> .toArray",
        "        -> .filter (@it % 2)",
        "        -> console.log",
      ].join("\n");
    },
    reduce() {
      return [
        "export fn main argv:",
        "  0..100 -> .toArray",
        "         -> .reduce (@lhs + @rhs)",
        "         -> console.log",
      ].join("\n");
    },
    gradual() {
      return [
        "@returns Number",
        "@params Number Number",
        "fn add a b: a + b",
        "",
        "export fn main argv:",
        "  -- This will throw a type error:",
        `  String foo = add 2 3`,
      ].join("\n");
    },
    implicit() {
      return [
        "export fn main argv:",
        "  -- This will throw a type error:",
        `  Number foo = 2 + "3"`,
      ].join("\n");
    },
    express() {
      return [
        "-- Note: this code doesn't run in the browser!",
        'import "cjs:express"',
        "",
        "fn hello req res:",
        '  "Hello world" -> res.send',
        "",
        "export fn main argv:",
        "  app = express",
        '  app.get "/" hello',
        "  app.listen 3000",
      ].join("\n");
    },
  };

  function getCode() {
    if (query) {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get(query);
      return code || samples.parallelFib();
    }
    return samples.parallelFib();
  }

  function getIsHorizontal() {
    const hz = new URLSearchParams(window.location.search).get("hz");
    if (hz) return hz === "true" || hz === "yes";
    return window.innerWidth < 720;
  }

  function parseQueryParams() {
    const urlParams = new URLSearchParams(window.location.search);
    const examples = urlParams.get("examples");
    if (examples === "false" || examples === "no") {
      showExamples = false;
    }
    const _console = urlParams.get("console");
    if (_console === "false" || _console === "no") {
      showConsole = false;
    }
    const run = urlParams.get("run");
    if (run === "false" || run === "no") {
      showRun = false;
    }
    const _share = urlParams.get("share");
    if (_share === "false" || _share === "no") {
      share = false;
    }
  }

  let editor;
  let domConsole;
  let isHorizontal = false;

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

  const copyShareURL = (event) => {
    event.preventDefault();
    const code = editor.getValue();
    const encoded = encodeURIComponent(code);
    const { origin, pathname } = window.location;
    const url = `${origin}${pathname}?${query}=${encoded}`;
    navigator.clipboard.writeText(url);
    showMessage();
  };

  let lastDispatcher;

  const compileAndRun = (event) => {
    lastDispatcher?.kill();
    domConsole.setValue("");
    event.preventDefault();
    (async () => {
      const lines = [];
      console.log = async (...args) => {
        lines.push(args.map(inspect).join(" "));
        domConsole.setValue(lines.join("\n"));
      };
      console.error = console.log;
      try {
        const src = editor.getValue();
        const { code } = compile(src, "main.clio", {
          sourceDir: null,
          config: {},
          rpcPrefix: "playground",
          file: "<Playground>",
        });
        const { main, dispatcher } = await run(code);
        await main();
        domConsole.setValue(lines.join("\n"));
        lastDispatcher = dispatcher;
      } catch (error) {
        console.trace(error);
        domConsole.setValue(error.message);
      }
    })();
  };

  const makeEditor = async () => {
    parseQueryParams();
    isHorizontal = getIsHorizontal();
    const monaco = window.monaco || (await loadMonaco());
    monaco.languages.register({ id: "clio" });
    monaco.languages.setMonarchTokensProvider("clio", clio);
    monaco.editor.defineTheme("PastelsOnDark", pastelsOnDark);
    monaco.editor.setTheme("PastelsOnDark");
    editor = monaco.editor.create(document.getElementById("clio-pane"), {
      value: getCode(),
      language: "clio",
      fontFamily: "Fira Code",
      fontLigatures: true,
      fontSize: 16,
    });
    domConsole = monaco.editor.create(document.getElementById("console-pane"), {
      value: "",
      language: "javascript",
      fontFamily: "Fira Code",
      fontLigatures: true,
      fontSize: 16,
      readOnly: true,
    });
  };

  font.load().then(makeEditor);
</script>

<div class="container">
  <div class="toolbar">
    <img src="/logo-128x128.png" class="logo" alt="logo" />
    <span class="title">{title}</span>
    <div class="spacer" />
    {#if showExamples}
      <select class="sample" on:change={setSampleCode}>
        <option selected value="parallelFib">Parallel Fib</option>
        <option value="parallelFibAlternate"> Parallel Fib (Alternate) </option>
        <option value="fib">Fib</option>
        <option value="filter">Filter</option>
        <option value="reduce">Reduce</option>
        <option value="gradual">Gradual Typing</option>
        <option value="implicit">No Implicit Coercion</option>
        <option value="express">Express</option>
      </select>
    {/if}
    {#if share}
      <a href="#?" class="btn share" on:click={copyShareURL}> Share </a>
    {/if}
    {#if showRun}
      <a href="#?" class="btn" on:click={compileAndRun}> Run </a>
    {/if}
  </div>
  <div class="sep" />
  <div
    class="editor"
    class:horizontal={isHorizontal}
    class:no-console={!showConsole}
  >
    <div id="clio-pane" />
    <div id="console-pane" />
  </div>
  <div class="copied" class:isActive>Link copied to clipboard</div>
</div>

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
    border: 2px solid #333;
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
    padding: 0.55em 1em;
    margin-bottom: -0.15em;
  }
  .toolbar > *:not(:last-child) {
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
  .editor.horizontal {
    flex-direction: column;
  }
  .editor.horizontal #console-pane {
    padding-top: 1em;
    border-top: 1px solid #404040;
  }
  .editor.no-console #console-pane {
    display: none;
  }
  .editor > div {
    flex: 1;
  }
  .logo {
    margin-right: 1em;
    height: 32px;
  }
  .copied {
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
    color: #dadada !important;
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
  .copied.isActive {
    animation: appear 4s ease-in forwards;
  }
  @media only screen and (max-width: 600px) {
    .sample {
      display: none;
    }
  }
</style>
