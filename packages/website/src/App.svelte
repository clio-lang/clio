<script>
  import Editor from "clio-playground/src/components/Editor.svelte";
  import "@fortawesome/fontawesome-free/js/all.js";
</script>

<style>
  main {
    padding: 1em 4em;
    margin: 0 auto;
  }

  h1,
  h2 {
    color: rgb(204 42 64);
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
    margin: 0;
    padding: 0;
  }

  h2 {
    font-size: 3em;
  }

  @media (min-width: 640px) {
    main {
      max-width: none;
    }
  }

  .playground {
    height: 400px;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0px 0px 32px 8px rgba(0, 0, 0, 0.4);
    border: 1px solid #333;
  }

  .hero {
    padding: 2em 0;
  }
  .logo {
    zoom: 0.5;
  }
  .hero .tail {
    flex: 1;
    box-sizing: border-box;
  }
  .hero .head {
    display: flex;
    align-items: center;
  }
  .hero h1 {
    margin-left: 0.5em;
  }

  .section {
    margin-top: 2em;
  }
  .icons {
    margin-top: 2em;
    display: flex;
    flex-wrap: wrap;
    gap: 2em;
  }
  a.icon {
    font-size: 1em;
    display: inline-flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    color: rgb(100, 166, 100);
  }
  a.icon:hover {
    color: rgb(204 42 64);
  }
  a.icon img {
    height: 48px;
    margin-bottom: 1em;
    filter: drop-shadow(0px 0px 6px black) grayscale(1) opacity(0.5);
  }
  a.icon:hover img {
    transition: ease-in 0.2s all;
    filter: none;
  }
</style>

<main>
  <div class="hero">
    <div class="head">
      <img src="/logo-128x128.png" alt="Clio" class="logo" />
      <h1>Clio</h1>
    </div>
    <div class="tail">
      <p>
        Visit the
        <a href="https://cliolang.org/tutorial">Clio tutorial</a>
        to learn how to build Clio apps.
      </p>
    </div>
  </div>
  <div class="playground">
    <Editor title="Clio" share={true} query="code" />
  </div>
  <div class="section">
    <h2>Community</h2>
    <div class="icons">
      <a href="https://github.com/clio-lang/clio" class="icon">
        <img src="/octocat.svg" alt="GitHub" />
        <span>Source</span>
      </a>
      <a href="https://forum.clio-lang.org/" class="icon">
        <img src="/discourse.svg" alt="Discourse" />
        <span>Forums</span>
      </a>
      <a href="https://t.me/joinchat/B0kZo0kVldcBimGD4NLfVw" class="icon">
        <img src="/telegram.svg" alt="Telegram" />
        <span>Telegram</span>
      </a>
      <a href="http://rosettacode.org/wiki/Clio" class="icon">
        <img src="/binary.svg" alt="Rosetta Code" />
        <span>Rosetta Code</span>
      </a>
      <a href="https://medium.com/@pouyae" class="icon">
        <img src="/medium.svg" alt="Medium" />
        <span>Medium</span>
      </a>
      <a href="https://www.reddit.com/r/cliolang/" class="icon">
        <img src="/reddit.svg" alt="Reddit" />
        <span>Reddit</span>
      </a>
      <a href="https://twitter.com/clio_lang" class="icon">
        <img src="/twitter.svg" alt="Twitter" />
        <span>Twitter</span>
      </a>
    </div>
  </div>
  <div class="section">
    <h2>Tools</h2>
    <div class="icons">
      <a href="#?" class="icon">
        <img src="/vscode.svg" alt="vscode" />
        <span>VSCode</span>
      </a>
    </div>
  </div>
</main>
