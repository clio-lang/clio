<script>
  import Editor from "clio-playground/src/components/Editor.svelte";
  import "@fortawesome/fontawesome-free/js/all.js";
</script>

<main>
  <div class="hero">
    <div class="head">
      <div class="logo-container">
        <img src="/logo-512x512.png" alt="Clio" class="logo" />
        <h1>Clio</h1>
      </div>
      <div class="sep" />
      <div class="intro">
        <p>
          Clio is a functional, distributed programming language that compiles
          to JavaScript. It runs in the browser and on the server and is made to
          be a suitable language for scientific programming. Clio takes
          advantage of multiple CPUs and multiple CPU cores (parallelism) by
          default, is able to use network resources, is easy to run on clusters
          and on the cloud.
        </p>
        <nav class="nav">
          <ul>
            <li><a href="https://medium.com/@pouyae"> Blog </a></li>
            <li><a href="https://forum.clio-lang.org"> Forums </a></li>
            <li><a href="https://docs.clio-lang.org/install"> Install </a></li>
            <li>
              <a href="https://docs.clio-lang.org/learn/official-tutorial">
                Learn
              </a>
            </li>
            <li><a href="https://docs.clio-lang.org"> Documentation </a></li>
            <li>
              <a href="https://docs.clio-lang.org/links/links/community">
                Community
              </a>
            </li>
            <li>
              <a href="https://docs.clio-lang.org/tools/tools-and-editors">
                Tools
              </a>
            </li>
            <li>
              <a href="https://docs.clio-lang.org/support-clio"> Donate </a>
            </li>
          </ul>
        </nav>
      </div>
    </div>
    <div class="tail">
      <p>
        Visit our
        <a href="https://docs.clio-lang.org/tutorial">tutorial page</a>
        to learn Clio, or read the
        <a href="https://docs.clio-lang.org">documentation</a>
        to learn more.
      </p>
    </div>
  </div>
  <div class="playground">
    <Editor title="Clio" share={true} query="code" />
  </div>
  <div class="section features">
    <p>
      Clio has a clean, noise-free syntax, and it makes distributed and parallel
      programming a lot easier.
    </p>
    <p class="hide-on-small">
      The Parallel Fib example above uses the sandwich syntax
      <code>|fib|</code>
      to run fib function in parallel, unlike the regular fib example it does not
      block the browser and it runs twice faster!
    </p>
    <p>
      Read the
      <a href="https://medium.com">introduction article</a>
      on our blog to learn more.
    </p>
  </div>
  <div class="fluid-sections">
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
        <a
          href="https://docs.clio-lang.org/tools/tools-and-editors/vscode"
          class="icon"
        >
          <img src="/vscode.svg" alt="vscode" />
          <span>VSCode</span>
        </a>
      </div>
    </div>
    <div class="section">
      <h2>Support Clio</h2>
      <p>
        Clio is a work in progress and it's not production ready yet, but you
        can help make it happen faster. If you want to help this project you can
        get
        <a href="#?">more details here</a>.
      </p>
    </div>
  </div>
  <footer class="section">
    Clio is released under Apache licence version 2.0, this website and all
    related content have the same licencing terms.
  </footer>
</main>

<style>
  main {
    padding: 1em 4em;
    margin: 0 auto;
    font-size: 1em;
  }

  h1,
  h2 {
    color: rgb(204 42 64);
    font-size: 4em;
    font-weight: 100;
    margin: 0;
    padding: 0;
  }

  h2 {
    font-size: 3em;
  }

  main {
    max-width: 73%;
  }

  .playground {
    height: 400px;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0px 0px 32px 8px rgba(0, 0, 0, 0.3);
    border: 1px solid #333;
  }

  .hero {
    padding: 1em 0;
  }
  .logo {
    height: 128px;
  }
  .hero .tail {
    flex: 1;
    box-sizing: border-box;
    margin-top: 2em;
  }
  .hero .head {
    display: flex;
    align-items: center;
  }
  .hero .head .logo-container {
    display: flex;
    align-items: center;
  }
  .hero .head .sep {
    border-left: 4px solid rgba(0, 0, 0, 0.6);
    margin-left: 3em;
    margin-right: 3em;
    width: 2px;
    height: 128px;
  }
  .hero .head .intro {
    display: flex;
    flex-direction: column;
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
  }
  a.icon img {
    height: 48px;
    margin-bottom: 1em;
  }
  footer {
    padding: 1em 0;
    padding-top: 2em;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
  }
  nav ul {
    margin-top: 1em;
    padding: 0;
    display: flex;
    gap: 1.4em;
    align-items: center;
    justify-content: flex-start;
    flex-wrap: wrap;
  }
  nav ul li {
    list-style: none;
  }
  .fluid-sections {
    display: flex;
    flex-wrap: wrap;
    gap: 1em 6em;
  }

  @media (max-width: 960px) {
    main {
      max-width: 90%;
      padding: 2em;
    }
  }
  @media (max-width: 853px) {
    .hero .head {
      flex-direction: column;
    }
    .hero .head .logo-container {
      justify-content: flex-start;
      width: 100%;
    }
    .hero .head .sep {
      border-left: none;
      height: 1em;
    }
  }
  @media (max-width: 640px) {
    main {
      max-width: 100%;
      padding: 2em;
      line-height: 1.6em;
    }
    .hero .head .logo-container {
      flex-direction: column;
      align-items: flex-start;
    }
    .hero .head .logo-container h1 {
      margin-left: 0em;
      margin-top: 0.5em;
    }
    .playground,
    .hide-on-small {
      display: none;
    }
  }
</style>
