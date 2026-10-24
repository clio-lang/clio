<script lang="ts">
  import { onDestroy } from "svelte";
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
  const repo = "https://github.com/kalandra-lang/kalandra";
  const docs = "/docs";
  let selected = $state(0);
  let copied = $state(false);
  let copyError = $state(false);
  let menuOpen = $state(false);
  let timer: ReturnType<typeof setTimeout>;
  const example = $derived(data.examples[selected]);
  function tokens(line: string) {
    return line
      .split(
        /(\b(?:fn|try|parallel|spawn|on|await|float32|Tensor|TaskError|matmul|transfer|tensor|reduceSum)\b|\b\d+\b|->)/g,
      )
      .map((text) => ({
        text,
        kind: /^(fn|try|parallel|spawn|on|await)$/.test(text)
          ? "keyword"
          : /^(float32|Tensor|TaskError)$/.test(text)
            ? "type"
            : /^(matmul|transfer|tensor|reduceSum)$/.test(text)
              ? "function"
              : /^(\d+|->)$/.test(text)
                ? "value"
                : "",
      }));
  }
  async function copy() {
    clearTimeout(timer);
    try {
      await navigator.clipboard.writeText(example.source);
      copied = true;
      copyError = false;
    } catch {
      copied = false;
      copyError = true;
    }
    timer = setTimeout(() => {
      copied = false;
      copyError = false;
    }, 2500);
  }
  function select(index: number) {
    selected = index;
    copied = false;
    copyError = false;
    clearTimeout(timer);
  }
  onDestroy(() => clearTimeout(timer));
</script>

{#snippet arrow(external = false)}
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="1.6"
    stroke-linecap="round"
    stroke-linejoin="round"
    aria-hidden="true"
    >{#if external}<path d="M6 18 18 6M6 6h12v12" />{:else}<path
        d="M4 12h15m-6-6 6 6-6 6"
      />{/if}</svg
  >
{/snippet}

<svelte:head>
  <title>Kalandra — Native CPU and GPU programming</title>
  <meta
    name="description"
    content="Kalandra is a native programming language for CPU and GPU computing. Compose typed functions, work with tensors, and place numerical tasks on Apple Metal."
  />
  <link rel="canonical" href="https://kalandra.dev/" />
  <meta property="og:type" content="website" /><meta
    property="og:site_name"
    content="Kalandra"
  />
  <meta
    property="og:title"
    content="Kalandra — Native CPU and GPU programming"
  />
  <meta
    property="og:description"
    content="A shared language for typed CPU workers, resident GPU graphs, and numerical computing."
  />
  <meta property="og:url" content="https://kalandra.dev/" /><meta
    property="og:image"
    content="https://kalandra.dev/social/native.png"
  />
  <meta property="og:image:width" content="1200" /><meta
    property="og:image:height"
    content="630"
  /><meta
    property="og:image:alt"
    content="Kalandra. A native language for CPU and GPU computing."
  />
  <meta name="twitter:card" content="summary_large_image" /><meta
    name="theme-color"
    content="#000000"
  />
</svelte:head>

<div class="language-site">
  <a class="skip" href="#main">Skip to content</a>
  <header>
    <div class="nav-shell">
      <a class="brand" href="/" aria-label="Kalandra home"
        ><span class="brand-mark" aria-hidden="true"></span>Kalandra</a
      ><button
        class="menu"
        aria-expanded={menuOpen}
        aria-controls="main-nav"
        onclick={() => (menuOpen = !menuOpen)}
        >{menuOpen ? "Close" : "Menu"}<svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="1.7"
          aria-hidden="true"
          >{#if menuOpen}<path d="m6 6 12 12M6 18 18 6" />{:else}<path
              d="M4 8h16M4 16h16"
            />{/if}</svg
        ></button
      >
      <nav id="main-nav" class:open={menuOpen} aria-label="Main navigation">
        <a href="/docs">Documentation</a><a href="/docs/gpu">GPU computing</a><a
          href={`${repo}/blob/native/docs/roadmap.md`}>Roadmap</a
        ><a href={repo}>GitHub {@render arrow(true)}</a><a
          class="nav-start"
          href="/docs/getting-started">Get started</a
        >
      </nav>
    </div>
  </header>
  <main id="main">
    <section class="hero" aria-labelledby="hero-title">
      <div class="hero-art" aria-hidden="true"></div>
      <div class="hero-content shell">
        <div class="hero-copy">
          <h1 id="hero-title">One language.<br /><span>CPU and GPU.</span></h1>
          <p class="hero-description">
            Kalandra brings typed functions, structured parallelism and explicit
            GPU placement into a single native language.
          </p>
          <div class="hero-actions">
            <a class="button primary hero-start" href="/docs/getting-started"
              >Get started {@render arrow()}</a
            ><a class="hero-guide" href="/docs/gpu"
              >Explore GPU computing {@render arrow()}</a
            >
          </div>
          <p class="preview-note">
            Open source. Native development preview. <a
              href={`${repo}/blob/native/docs/roadmap.md`}
              >Follow development {@render arrow(true)}</a
            >
          </p>
        </div>
      </div>
    </section>

    <section class="examples shell" aria-labelledby="examples-title">
      <div class="example-intro">
        <h2 id="examples-title">Functions in.<br /> GPU graphs out.</h2>
        <p aria-live="polite">{example.description}</p>
        <a href={`${repo}/blob/native/${example.path}`}
          >View complete source {@render arrow(true)}</a
        >
      </div>
      <div class="code-example" id="examples">
        <div
          class="example-tabs"
          role="group"
          aria-label="Native language examples"
        >
          {#each data.examples as item, i}<button
              class:active={selected === i}
              aria-pressed={selected === i}
              onclick={() => select(i)}>{item.title}</button
            >{/each}
        </div>
        <div class="filebar">
          <span>{example.file}</span><button
            onclick={copy}
            aria-label="Copy source"
            >{copied
              ? "Copied"
              : copyError
                ? "Select source to copy"
                : "Copy"}</button
          ><span class="sr-only" role="status"
            >{copied
              ? "Source copied to clipboard."
              : copyError
                ? "Clipboard unavailable. Select and copy the source manually."
                : ""}</span
          >
        </div>
        <!-- Keyboard focus allows scrolling long native examples. -->
        <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
        <div
          class="source"
          role="region"
          tabindex="0"
          aria-label={`${example.title} source code`}
        >
          <pre><code
              >{#each example.source.split("\n") as line, i}<span
                  class="code-line"
                  ><span class="line-number" aria-hidden="true">{i + 1}</span
                  ><span class="line-content"
                    >{#each tokens(line) as token}<span class={token.kind}
                        >{token.text}</span
                      >{/each}{"\n"}</span
                  ></span
                >{/each}</code
            ></pre>
        </div>
      </div>
    </section>

    <section class="overview shell" aria-labelledby="overview-title">
      <h2 id="overview-title">One language. The whole machine.</h2>
      <p class="section-intro">
        Express the computation as functions. Make execution and data movement
        explicit.
      </p>
      <div class="principles">
        <article>
          <h3>Compose functions.</h3>
          <p>
            Build numerical graphs from typed functions, tensor arithmetic,
            matrix products and reductions. Intermediate results can remain on
            the GPU.
          </p>
          <a href="/docs/gpu">Explore GPU operations {@render arrow()}</a>
        </article>
        <article>
          <h3>Place the work.</h3>
          <p>
            Dispatch CPU workers or place a numerical task on the GPU. Transfer
            tensors explicitly, await results, and keep task lifetimes within
            parallel scopes.
          </p>
          <a href={`${repo}/blob/native/native/README.md`}
            >Read the execution model {@render arrow()}</a
          >
        </article>
        <article>
          <h3>Build native programs.</h3>
          <p>
            Compile to native applications with a source checker, formatter,
            language server and VS Code extension supporting your development
            workflow.
          </p>
          <a href="/docs/getting-started"
            >Set up the toolchain {@render arrow()}</a
          >
        </article>
      </div>
    </section>

    <section class="numerics section-line" id="ai">
      <div class="shell numerical-layout">
        <div>
          <h2>Build the foundations<br /> of AI on the GPU.</h2>
          <p>
            Matrix products, tensor arithmetic and balanced reductions are
            building blocks of modern AI and LLM systems. Kalandra makes these
            operations available in a typed native language, with control over
            where data lives and computation runs.
          </p>
          <p>
            GPU programs support all ten native numeric types and dense tensor
            ranks zero through eight. Metal float32 uses hardware arithmetic;
            float64 requires explicit software fallback. Compose resident
            numerical and control graphs on Apple Metal, with explicit transfers
            between host and device.
          </p>
          <a class="text-link" href="/docs/gpu"
            >Read the GPU guide {@render arrow()}</a
          >
        </div>
        <div class="operation-reference">
          <div>
            <code>matmul(a, b)</code>
            <p>Rank-two matrix products, composed into resident graphs.</p>
          </div>
          <div>
            <code>reduceSum(values)</code>
            <p>Balanced sums over typed numerical tensors.</p>
          </div>
          <div>
            <code>transfer(values, device)</code>
            <p>Explicit data movement between CPU and GPU.</p>
          </div>
          <a href={`${repo}/blob/native/docs/design/native-gpu-capabilities.md`}
            >Supported operations and numerical semantics {@render arrow(
              true,
            )}</a
          >
        </div>
      </div>
      <div class="shell scope-note">
        Apple Metal is the current GPU backend. Model loading, a full LLM
        inference runtime and CUDA remain outside the current scope.
      </div>
    </section>

    <section class="platforms shell" aria-labelledby="platform-title">
      <h2 id="platform-title">Native development across platforms.</h2>
      <p class="section-intro">
        Use the same language and tools for CPU programs, with Apple Metal
        available on supported Macs.
      </p>
      <!-- Keyboard focus allows scrolling the platform table on narrow screens. -->
      <!-- svelte-ignore a11y_no_noninteractive_tabindex -->
      <div
        tabindex="0"
        class="platform-table"
        role="region"
        aria-label="Supported native platforms"
      >
        <table>
          <thead
            ><tr
              ><th scope="col">Platform</th><th scope="col">Execution</th><th
                scope="col">Current baseline</th
              ></tr
            ></thead
          ><tbody
            ><tr
              ><th scope="row">macOS</th><td>CPU and Apple Metal GPU</td><td
                >macOS 26+, Apple silicon</td
              ></tr
            ><tr
              ><th scope="row">Linux</th><td>CPU</td><td
                >x86-64, Ubuntu 24.04 / glibc 2.39</td
              ></tr
            ><tr
              ><th scope="row">Windows</th><td>CPU</td><td
                >x86-64, Windows 11 with C++ build tools</td
              ></tr
            ></tbody
          >
        </table>
      </div>
      <a
        class="text-link"
        href={`${repo}/blob/native/docs/design/native-releases.md`}
        >Distribution and toolchain requirements {@render arrow()}</a
      >
    </section>

    <section class="onboarding section-line">
      <div class="shell onboarding-layout">
        <div>
          <h2>Start with a native project.</h2>
          <p>
            Install the native toolchain, create a project, check its sources,
            and compile an executable. The starter includes two modules and a
            typed parallel map.
          </p>
          <div class="onboarding-links">
            <a class="button primary" href="/docs/getting-started"
              >Installation and setup {@render arrow()}</a
            ><a
              class="text-link"
              href={`${repo}/blob/native/docs/design/native-vscode.md`}
              >Editor integration {@render arrow(true)}</a
            >
          </div>
        </div>
        <div class="terminal">
          <div class="terminal-title">With the native compiler installed</div>
          <pre><code
              >kalandra new my-app
kalandra-check --project my-app/kalandra.toml
kalandra --project my-app/kalandra.toml \
  -o my-app/program
./my-app/program</code
            ></pre>
          <a href={`${repo}/blob/native/docs/design/native-starter.md`}
            >Native starter reference {@render arrow(true)}</a
          >
        </div>
      </div>
    </section>
    <section class="open-source shell">
      <h2>Open source, in development.</h2>
      <p>
        Explore the implementation, read the language design, or contribute to
        the next native milestone.
      </p>
      <div>
        <a href={repo}>Kalandra on GitHub {@render arrow(true)}</a><a
          href={`${repo}/blob/native/docs/roadmap.md`}
          >Development roadmap {@render arrow()}</a
        >
      </div>
    </section>
  </main>
  <footer>
    <div class="shell footer-content">
      <div>
        <a class="brand" href="/">Kalandra</a>
        <p>A native language for CPU and GPU computing.</p>
      </div>
      <nav aria-label="Footer navigation">
        <a href="/docs">Documentation</a><a href="/docs/gpu">GPU guide</a><a
          href={repo}>GitHub</a
        ><a href={`${repo}/blob/native/LICENSE`}>Apache 2.0</a>
      </nav>
    </div>
  </footer>
</div>

<style>
  .language-site {
    --bg: #000;
    --panel: #0d0d10;
    --text: #ededf0;
    --muted: #a5a5af;
    --line: #26262d;
    --accent: #c5b1ff;
    background: var(--bg);
    color: var(--text);
    font-family:
      "Geist Variable", sans-serif; /* impeccable-disable-line overused-font -- User selected Kotlin as the primary visual reference; neutral sans language-site typography. */
    min-height: 100vh;
    overflow: clip;
  }
  .language-site ::selection {
    background: #244b80;
    color: #fff;
  }
  .shell {
    width: min(1200px, calc(100% - 96px));
    margin-inline: auto;
  }
  a {
    color: inherit;
    text-decoration: none;
  }
  button {
    font: inherit;
  }
  a:focus-visible,
  button:focus-visible,
  [tabindex]:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 5px;
  }
  .skip {
    position: fixed;
    top: -100px;
    left: 20px;
    background: #fff;
    color: #000;
    padding: 12px;
    z-index: 50;
  }
  .skip:focus {
    top: 10px;
  }
  header {
    border-bottom: 1px solid var(--line);
    background: #161617;
  }
  .nav-shell {
    width: min(1200px, calc(100% - 64px));
    margin-inline: auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    height: 68px;
    gap: 30px;
  }
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 24px;
    font-weight: 550;
    letter-spacing: -0.025em;
  }
  .brand-mark {
    display: block;
    width: 36px;
    height: 25px;
    background: #e8e8ed;
    mask: url("/brand/kalandra-mark.svg") center/contain no-repeat;
  }
  nav {
    display: flex;
    gap: 26px;
    align-items: center;
    font-size: 14px;
    color: #d0cfd4;
  }
  nav > a {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  nav > a:hover {
    color: #fff;
  }
  .nav-start {
    background: #7c55e8;
    padding: 10px 20px;
    border-radius: 28px;
    color: #fff;
  }
  .nav-start:hover {
    background: #916df2;
  }
  .menu {
    display: none;
  }
  .hero {
    position: relative;
    isolation: isolate;
    min-height: 610px;
  }
  .hero-art {
    position: absolute;
    inset: 0 0 -260px;
    z-index: -1;
    background: url("/art/native-hero.webp") center top / cover no-repeat;
    pointer-events: none;
    mask-image: linear-gradient(#000 75%, transparent);
  }
  .hero-content {
    padding-top: 90px;
    padding-bottom: 90px;
  }
  .hero-copy {
    max-width: 740px;
  }
  .hero h1 {
    font-size: clamp(64px, 7.3vw, 96px);
    font-weight: 500;
    line-height: 1.06;
    letter-spacing: -0.035em;
    margin: 0 0 30px;
  }
  .hero h1 > span {
    color: #c6b2ff;
  }
  .hero-description {
    font-size: 19px;
    line-height: 1.7;
    color: #d0ced9;
    max-width: 490px;
    margin: 0 0 32px;
  }
  .hero-actions {
    display: flex;
    align-items: center;
    gap: 28px;
    flex-wrap: wrap;
  }
  .hero .hero-start {
    font-size: 17px;
    padding: 14px 25px;
    gap: 30px;
  }
  .hero-guide {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    font-size: 14px;
    color: #ddd3fa;
  }
  .hero-guide:hover {
    text-decoration: underline;
    text-underline-offset: 5px;
  }
  .examples {
    position: relative;
    padding-block: 40px 70px;
    display: grid;
    grid-template-columns: 300px minmax(0, 1fr);
    align-items: start;
    gap: 60px;
  }
  .example-intro > a {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    color: var(--accent);
    margin-top: 24px;
  }
  .example-intro > a:hover {
    text-decoration: underline;
    text-underline-offset: 5px;
  }
  .example-intro {
    margin: 0 0 30px;
  }
  .example-intro h2 {
    font-size: 38px;
    margin: 0 0 12px;
  }
  .example-intro > p {
    color: #b8b5c3;
    font-size: 17px;
    margin: 0;
  }
  .button {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 18px;
    padding: 12px 18px;
    border: 1px solid transparent;
    border-radius: 30px;
    font-size: 14px;
    font-weight: 500;
    transition:
      background 0.16s,
      border-color 0.16s;
  }
  .primary {
    background: #7b4fed;
    color: #fff;
    border-color: #7b4fed;
  }
  .primary:hover {
    background: #9067f7;
  }
  .secondary {
    background: #111114;
    border-color: #363640;
    color: #dddde4;
  }
  .secondary:hover {
    background: #1b1b21;
    border-color: #5a5a66;
  }
  .code-example {
    max-width: none;
    margin: 0;
    border: 1px solid #2a2732;
    border-radius: 12px;
    background: #0b0b0e;
    overflow: hidden;
  }
  .example-tabs {
    display: flex;
    gap: 30px;
    padding-inline: 28px;
    background: #111114;
    border-bottom: 1px solid var(--line);
  }
  .example-tabs > button {
    background: none;
    color: #a9a9b6;
    border: 0;
    border-bottom: 2px solid transparent;
    padding: 16px 0;
    font-size: 13px;
    cursor: pointer;
  }
  .example-tabs > button.active {
    border-bottom-color: var(--accent);
    color: #f1f1f4;
  }
  .example-tabs > button:hover {
    color: #fff;
  }
  .filebar {
    padding: 17px 24px 8px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    color: #9999a8;
    font: 11px var(--font-mono);
  }
  .filebar > button {
    display: flex;
    align-items: center;
    gap: 7px;
    min-height: 30px;
    background: none;
    border: 0;
    padding: 3px 0 3px 10px;
    color: #bdbdc8;
    font:
      12px "Geist Variable",
      sans-serif;
    cursor: pointer;
  }
  .filebar > button:hover {
    color: #fff;
  }
  .source {
    min-height: 230px;
    max-height: 360px;
    overflow: auto;
    scrollbar-color: #50505f #0b0b0e;
  }
  .source pre {
    margin: 0;
    padding: 7px 24px 24px;
    font: 13px/1.9 var(--font-mono);
    color: #dadbe4;
    white-space: pre-wrap;
  }
  .code-line {
    display: flex;
  }
  .line-number {
    flex: none;
    width: 31px;
    color: #747482;
    font-size: 10px;
    user-select: none;
  }
  .line-content {
    min-width: 0;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .keyword {
    color: #a2bfff;
  }
  .type {
    color: #c5afe8;
  }
  .function {
    color: #e5cfaa;
  }
  .value {
    color: #e8ad99;
  }
  .preview-note {
    font-size: 11px;
    line-height: 1.9;
    color: #9696a5;
    margin: 24px 0 0;
  }
  .preview-note > a {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    color: var(--accent);
  }
  .preview-note > a:hover {
    text-decoration: underline;
    text-underline-offset: 4px;
  }
  h2 {
    font-size: 44px;
    line-height: 1.16;
    font-weight: 500;
    letter-spacing: -0.025em;
    margin: 0 0 20px;
    text-wrap: balance;
  }
  h3 {
    font-size: 21px;
    line-height: 1.3;
    font-weight: 500;
    letter-spacing: -0.015em;
    margin: 0 0 13px;
  }
  .section-intro {
    font-size: 16px;
    line-height: 1.75;
    color: var(--muted);
    margin: 0;
    max-width: 750px;
  }
  .overview {
    padding-block: 60px 75px;
  }
  .overview > h2 {
    font-size: 44px;
    line-height: 1.15;
  }
  .overview > h2,
  .overview > .section-intro {
    text-align: left;
    margin-inline: 0;
  }
  .principles {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 44px;
    margin-top: 45px;
  }
  .principles article {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .principles p {
    font-size: 14px;
    line-height: 1.85;
    color: var(--muted);
    margin: 0 0 20px;
    flex: 1;
  }
  .principles a,
  .text-link {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 13px;
    color: var(--accent);
  }
  .principles a:hover,
  .text-link:hover {
    text-decoration: underline;
    text-underline-offset: 5px;
  }
  .section-line {
    border-block: 1px solid var(--line);
    background: #08080a;
  }
  .numerics {
    padding-block: 70px 35px;
  }
  .numerical-layout {
    display: grid;
    grid-template-columns: 1.15fr 1fr;
    gap: 90px;
    align-items: start;
  }
  .numerical-layout > div > p {
    font-size: 15px;
    line-height: 1.85;
    color: var(--muted);
    margin: 0 0 19px;
  }
  .operation-reference {
    padding-top: 4px;
  }
  .operation-reference > div {
    padding: 0 0 22px;
    margin-bottom: 22px;
    border-bottom: 1px solid #2b2b32;
  }
  .operation-reference code {
    font-size: 14px;
    color: #c1d3ee;
  }
  .operation-reference p {
    font-size: 13px;
    line-height: 1.7;
    margin: 10px 0 0;
    color: #aaaab4;
  }
  .operation-reference > a {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    color: var(--accent);
  }
  .operation-reference > a:hover {
    text-decoration: underline;
    text-underline-offset: 5px;
  }
  .scope-note {
    border-top: 1px solid #232329;
    margin-top: 42px;
    padding-top: 20px;
    font-size: 12px;
    line-height: 1.7;
    color: #90909f;
  }
  .platforms {
    padding-block: 70px;
  }
  .platform-table {
    margin: 30px 0 24px;
    overflow: auto;
    scrollbar-color: #50505f #000;
  }
  table {
    width: 100%;
    border-collapse: collapse;
    text-align: left;
    font-size: 13px;
    line-height: 1.7;
  }
  th,
  td {
    padding: 17px 20px;
    border-bottom: 1px solid var(--line);
  }
  thead th {
    font-weight: 500;
    background: #101013;
    color: #c2c2cd;
  }
  tbody th {
    font-weight: 500;
    color: #e2e2e8;
  }
  td {
    color: #a5a5b2;
  }
  th:first-child,
  td:first-child {
    padding-left: 20px;
  }
  .onboarding {
    padding-block: 65px;
  }
  .onboarding-layout {
    display: grid;
    grid-template-columns: 1fr 1.1fr;
    gap: 80px;
    align-items: center;
  }
  .onboarding p {
    font-size: 15px;
    line-height: 1.85;
    color: var(--muted);
    max-width: 470px;
    margin: 0 0 25px;
  }
  .onboarding-links {
    display: flex;
    align-items: center;
    gap: 22px;
    flex-wrap: wrap;
  }
  .onboarding .button {
    font-size: 13px;
    padding: 11px 15px;
  }
  .terminal {
    background: #101013;
    border: 1px solid #2c2c35;
    border-radius: 6px;
    overflow: hidden;
  }
  .terminal-title {
    font-size: 12px;
    color: #adadba;
    padding: 17px 20px;
    border-bottom: 1px solid #27272e;
  }
  .terminal pre {
    margin: 0;
    padding: 21px 20px;
    font: 11px/2.15 var(--font-mono);
    overflow: auto;
    color: #d2d4df;
    scrollbar-color: #50505f #101013;
  }
  .terminal > a {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 15px;
    font-size: 12px;
    color: var(--accent);
    padding: 16px 20px;
    border-top: 1px solid #27272e;
  }
  .terminal > a:hover {
    color: #c8daff;
  }
  .open-source {
    text-align: center;
    padding-block: 65px;
  }
  .open-source h2 {
    font-size: 30px;
  }
  .open-source > p {
    font-size: 15px;
    line-height: 1.8;
    color: var(--muted);
    margin: 0 auto 25px;
    max-width: 660px;
  }
  .open-source > div {
    display: flex;
    justify-content: center;
    gap: 30px;
    flex-wrap: wrap;
  }
  .open-source > div > a {
    display: inline-flex;
    gap: 7px;
    align-items: center;
    font-size: 14px;
    color: var(--accent);
  }
  .open-source a:hover {
    text-decoration: underline;
    text-underline-offset: 5px;
  }
  footer {
    border-top: 1px solid var(--line);
    background: #080809;
  }
  .footer-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 40px;
    padding-block: 35px;
  }
  .footer-content .brand {
    font-size: 21px;
  }
  .footer-content p {
    font-size: 12px;
    color: #858592;
    margin: 11px 0 0;
  }
  .footer-content nav {
    gap: 24px;
    font-size: 12px;
  }
  .sr-only {
    position: absolute;
    width: 1px;
    height: 1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
  }
  @media (prefers-reduced-motion: no-preference) {
    .hero-copy {
      animation: enter 0.45s cubic-bezier(0.16, 1, 0.3, 1) both;
    }

    @keyframes enter {
      from {
        transform: translateY(8px);
      }
      to {
        transform: translateY(0);
      }
    }
    .code-example {
      transition: border-color 0.18s;
    }
    .code-example:focus-within {
      border-color: #57749e;
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .language-site * {
      animation: none !important;
      transition: none !important;
    }
  }
  @media (max-width: 1000px) {
    .examples {
      grid-template-columns: 240px minmax(0, 1fr);
      gap: 30px;
    }
    .shell {
      width: calc(100% - 64px);
    }
    .nav-shell {
      width: calc(100% - 48px);
    }
    nav {
      gap: 20px;
      font-size: 12px;
    }
    .hero {
      min-height: 580px;
    }
    .hero-content {
      padding-top: 75px;
      padding-bottom: 75px;
    }
    .hero h1 {
      font-size: clamp(66px, 9vw, 90px);
    }
    .hero-description {
      font-size: 15px;
    }
    .principles {
      gap: 30px;
    }
    .numerical-layout {
      gap: 50px;
    }
    .onboarding-layout {
      gap: 40px;
    }
    .terminal pre {
      font-size: 10px;
    }
  }
  @media (max-width: 760px) {
    .shell {
      width: calc(100% - 40px);
    }
    .nav-shell {
      width: calc(100% - 40px);
      height: 68px;
    }
    .brand {
      font-size: 22px;
    }
    header nav {
      gap: 18px;
    }
    header nav > a:nth-child(3) {
      display: none;
    }
    .hero {
      min-height: 0;
    }
    .hero-content {
      padding-top: 58px;
      padding-bottom: 65px;
    }
    .hero h1 {
      font-size: clamp(47px, 9.2vw, 68px);
      margin-bottom: 25px;
    }
    .hero-description {
      font-size: 15px;
      max-width: 450px;
    }
    .hero-art {
      inset: 0 -220px -100px 0;
      background-position: 35% top;
      opacity: 0.55;
    }
    .hero .hero-start {
      font-size: 16px;
    }
    .examples {
      grid-template-columns: 1fr;
      gap: 28px;
      padding-top: 25px;
      padding-bottom: 40px;
    }
    .example-intro {
      margin: 0;
    }
    .example-intro p {
      max-width: 540px;
    }
    .example-intro h2 {
      font-size: 32px;
    }
    .example-intro h2 br {
      display: none;
    }
    .example-intro > p {
      font-size: 15px;
    }
    .overview > h2 {
      font-size: 34px;
    }
    .desktop-break {
      display: none;
    }
    .button {
      font-size: 13px;
      padding: 12px 15px;
    }
    .code-example {
      margin-top: 22px;
    }
    .example-tabs {
      padding-inline: 20px;
      gap: 26px;
    }
    .example-tabs > button {
      font-size: 12px;
    }
    .filebar {
      padding-inline: 20px;
    }
    .source {
      min-height: 240px;
    }
    .source pre {
      padding-inline: 20px;
      font-size: 11px;
    }
    .overview {
      padding-block: 40px 55px;
    }
    h2 {
      font-size: 29px;
    }
    .section-intro {
      font-size: 15px;
    }
    .principles {
      grid-template-columns: 1fr;
      gap: 30px;
      margin-top: 32px;
    }
    .principles article {
      display: block;
    }
    .principles h3 {
      font-size: 21px;
    }
    .principles p {
      font-size: 14px;
      margin-bottom: 13px;
      max-width: 620px;
    }
    .numerics {
      padding-block: 50px 28px;
    }
    .numerical-layout {
      grid-template-columns: 1fr;
      gap: 35px;
    }
    .numerical-layout > div > p {
      font-size: 14px;
    }
    .numerical-layout h2 > br {
      display: none;
    }
    .operation-reference {
      max-width: 100%;
      padding: 0;
    }
    .scope-note {
      margin-top: 30px;
      font-size: 11px;
    }
    .platforms {
      padding-block: 50px;
    }
    .platform-table {
      margin-top: 25px;
    }
    table {
      font-size: 12px;
      min-width: 570px;
    }
    th,
    td {
      padding: 15px;
    }
    .onboarding {
      padding-block: 50px;
    }
    .onboarding-layout {
      grid-template-columns: 1fr;
      gap: 30px;
    }
    .onboarding p {
      font-size: 14px;
      max-width: 600px;
    }
    .terminal pre {
      font-size: 11px;
    }
    .open-source {
      padding-block: 50px;
    }
    .open-source h2 {
      font-size: 28px;
    }
    .open-source > p {
      font-size: 14px;
    }
    .open-source > div {
      gap: 20px;
    }
    .open-source > div > a {
      font-size: 13px;
    }
    .footer-content {
      align-items: flex-start;
      flex-direction: column;
      gap: 25px;
    }
    .footer-content nav {
      flex-wrap: wrap;
      gap: 23px;
    }
  }
  @media (max-width: 520px) {
    header {
      position: relative;
      z-index: 10;
    }
    .menu {
      display: inline-flex;
      align-items: center;
      gap: 9px;
      border: 1px solid #383842;
      border-radius: 5px;
      padding: 9px 11px;
      background: none;
      color: #d2d2dc;
      font-size: 12px;
    }
    header nav {
      display: none;
    }
    header nav.open {
      display: flex;
      position: absolute;
      top: 67px;
      left: 0;
      right: 0;
      align-items: stretch;
      flex-direction: column;
      gap: 0;
      padding: 10px 20px 18px;
      background: #0b0b0e;
      border-bottom: 1px solid #373740;
    }
    header nav.open > a,
    header nav.open > a:nth-child(3) {
      display: flex;
      padding: 13px 0;
      font-size: 14px;
    }
    header nav.open > .nav-start {
      justify-content: center;
      padding: 12px;
      margin-top: 8px;
    }
    .hero h1 {
      font-size: clamp(40px, 10.5vw, 54px);
      margin-bottom: 24px;
    }
    .hero-description {
      font-size: 15px;
      line-height: 1.7;
      margin-bottom: 25px;
    }

    .example-tabs {
      gap: 19px;
      padding-inline: 16px;
    }
    .example-tabs > button {
      font-size: 11px;
      padding-block: 15px;
    }
    .filebar {
      padding: 13px 16px 6px;
    }
    .source pre {
      padding: 5px 16px 22px;
      font-size: 11px;
    }
    .line-number {
      width: 25px;
    }
    .source {
      min-height: 230px;
      max-height: 330px;
    }
    .preview-note {
      font-size: 11px;
      line-height: 1.7;
    }
    .hero-description,
    .section-intro,
    .numerical-layout > div > p {
      text-wrap: pretty;
    }
    .overview > h2,
    .overview > .section-intro {
      text-align: left;
    }
    .terminal pre {
      font-size: 9px;
    }
    .operation-reference code {
      font-size: 12px;
    }
    .operation-reference p {
      font-size: 12px;
    }
    .onboarding-links {
      gap: 18px;
    }
    .onboarding-links .text-link {
      font-size: 12px;
    }
    .open-source > div {
      align-items: center;
      flex-direction: column;
      gap: 16px;
    }
    .footer-content p {
      font-size: 11px;
    }
    .footer-content nav {
      font-size: 11px;
      gap: 18px;
    }
  }
</style>
