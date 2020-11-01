<script>
  export let title;

  import { clio, loadMonaco, pastelsOnDark } from "../monaco";
  import run from "../clio/run";

  import { compile } from "clio-core";
  import inspect from "object-inspect";

  function getCode() {
    return ["export fn main argv:", '  "Hello world" -> console.log'].join(
      "\n"
    );
  }

  let editor;
  let domConsole;

  const compileAndRun = () => {
    const src = editor.getValue();
    const { code } = compile(src, "main.clio");
    const lines = [];
    (() => {
      console.log = async (...args) => {
        lines.push(args.map(inspect).join(" "));
        domConsole.setValue(lines.join("\n"));
      };
      run(code);
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
  .btn {
    color: #dadada;
    text-decoration: none;
    border-radius: 6px;
    border: 2px solid rgb(100, 166, 100);
    padding: 0.5em 1em;
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
</style>

<div class="container">
  <div class="toolbar">
    <img src="/logo-128x128.png" class="logo" alt="logo" />
    <span class="title">{title}</span>
    <div class="spacer" />
    <a href="#?" class="btn" on:click={compileAndRun}> Run </a>
  </div>
  <div class="sep" />
  <div class="editor">
    <div id="left-pane" />
    <div id="right-pane" />
  </div>
</div>
