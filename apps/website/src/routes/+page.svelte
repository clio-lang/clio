<script lang="ts">
  import { onDestroy, tick, untrack } from "svelte";
  import { reveal } from "$lib/actions/reveal";
  import CodeEditor from "$lib/components/CodeEditor.svelte";
  import ComputeBackground from "$lib/components/ComputeBackground.svelte";
  import { goto } from "$app/navigation";
  import {
    startPlayground,
    type PlaygroundEvent,
  } from "$lib/playground/client";
  import type { PageData } from "./$types";
  let { data }: { data: PageData } = $props();
  let selected = $state(1);
  let drafts = $state(
    untrack(() => data.examples.map((example) => example.source)),
  );
  let editing = $state(false);
  let busy = $state(false);
  let status = $state("Ready to run");
  let output = $state<string[]>([]);
  let diagnostics = $state<
    Extract<PlaygroundEvent, { kind: "diagnostics" }>["diagnostics"]
  >([]);
  let lastRun = $state<string>();
  let execution: ReturnType<typeof startPlayground> | undefined;
  let generation = 0;
  const example = $derived(data.examples[selected]);
  const changed = $derived(drafts[selected] !== example.source);
  function clear() {
    generation++;
    execution?.stop();
    busy = false;
    output = [];
    diagnostics = [];
    lastRun = undefined;
    status = "Ready to run";
  }
  let workbench: HTMLDivElement;
  let workbenchSpace: HTMLDivElement;
  let tabAnimation: Animation | undefined;
  let tabChange = 0;
  async function select(index: number) {
    const change = ++tabChange;
    const opacity = getComputedStyle(workbench).opacity;
    tabAnimation?.cancel();
    if (index === selected) return;
    const motion = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    // Reserve the panel's space before changing its contents. The remote example
    // is shorter; collapsing it used to move the hero and the page mid-fade.
    workbenchSpace.style.minHeight = `${Math.max(workbenchSpace.getBoundingClientRect().height, workbench.getBoundingClientRect().height)}px`;
    if (motion) {
      tabAnimation = workbench.animate([{ opacity }, { opacity: 0 }], {
        duration: 160,
        easing: "ease-in-out",
        fill: "forwards",
      });
      try {
        await tabAnimation.finished;
      } catch {
        return;
      }
    }
    if (change !== tabChange) return;
    clear();
    selected = index;
    editing = drafts[index] !== data.examples[index].source;
    await tick();
    if (change !== tabChange) return;
    workbenchSpace.style.minHeight = `${Math.max(workbenchSpace.getBoundingClientRect().height, workbench.getBoundingClientRect().height)}px`;
    tabAnimation?.cancel();
    if (motion)
      tabAnimation = workbench.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 300,
        easing: "cubic-bezier(0.22, 1, 0.36, 1)",
      });
  }
  function reset() {
    clear();
    drafts[selected] = example.source;
    editing = false;
  }
  function run() {
    if (busy || selected === 0) return;
    clear();
    const id = generation;
    lastRun = drafts[selected];
    busy = true;
    execution = startPlayground(drafts[selected], (event) => {
      if (id !== generation) return;
      if (event.kind === "diagnostics") diagnostics = event.diagnostics;
      else if (event.kind === "output") output = [...output, event.text];
      else if (event.kind === "loading") status = "Loading compiler…";
      else if (event.kind === "compiling") status = "Compiling…";
      else if (event.kind === "running") status = "Running…";
      else {
        busy = false;
        if (event.kind === "result" || event.kind === "error")
          output = [...output, event.text];
        status =
          event.kind === "result"
            ? "Finished"
            : event.kind === "invalid"
              ? "Check your source"
              : event.kind === "stopped"
                ? "Stopped"
                : "Failed";
      }
    });
  }
  function openPlayground() {
    try {
      sessionStorage.setItem("kalandra-home-source", drafts[selected]);
      void goto("/docs/playground?from=home");
    } catch {
      status =
        "Browser storage is unavailable. Copy your code before opening the playground.";
    }
  }
  onDestroy(() => {
    tabChange++;
    tabAnimation?.cancel();
    generation++;
    execution?.stop();
  });
</script>

<svelte:head>
  <title>Kalandra — Parallel and distributed programming</title>
  <meta
    name="description"
    content="A functional language for parallel and distributed computing. Run typed functions in workers, make remote calls, and compile to JavaScript."
  />
  <link rel="canonical" href="https://kalandra.dev/" />
  <meta property="og:type" content="website" />
  <meta property="og:site_name" content="Kalandra" />
  <meta
    property="og:title"
    content="Kalandra — Parallel and distributed by design"
  />
  <meta
    property="og:description"
    content="A functional language and framework for parallel and distributed applications. Run functions in workers, call remote services, and compile to JavaScript."
  />
  <meta property="og:url" content="https://kalandra.dev/" />
  <meta
    property="og:image"
    content="https://kalandra.dev/social/kalandra.png"
  />
  <meta property="og:image:width" content="1200" />
  <meta property="og:image:height" content="630" />
  <meta property="og:image:type" content="image/png" />
  <meta
    property="og:image:alt"
    content="Kalandra. Functions here. Compute anywhere. A language and framework for parallel and distributed applications."
  />
  <meta name="twitter:card" content="summary_large_image" />
  <meta
    name="twitter:title"
    content="Kalandra — Parallel and distributed by design"
  />
  <meta
    name="twitter:description"
    content="A language and framework for parallel and distributed applications. The next chapter of Clio."
  />
  <meta
    name="twitter:image"
    content="https://kalandra.dev/social/kalandra.png"
  />
  <meta
    name="twitter:image:alt"
    content="Kalandra. Functions here. Compute anywhere."
  />
</svelte:head>

<div class="landing">
  <a class="skip" href="#main">Skip to content</a>
  <header class="shell">
    <a class="wordmark" href="/" aria-label="Kalandra home">kalandra.</a>
    <nav aria-label="Main navigation">
      <a href="/docs">Documentation</a><a href="/docs/playground">Playground</a
      ><a href="/docs/blog">Blog</a><a
        href="https://github.com/kalandra-lang/kalandra">GitHub ↗</a
      >
    </nav>
  </header>
  <main id="main">
    <section
      class="hero shell"
      aria-label="Kalandra introduction and live example"
    >
      <ComputeBackground />
      <div class="intro">
        <p class="eyebrow">FUNCTIONAL · PARALLEL · DISTRIBUTED</p>
        <h1>Parallel and distributed<br />by design.</h1>
        <p class="description">
          Kalandra is a functional language for parallel and distributed
          computing. Run functions in workers, call remote services, and compose
          the results with pipelines—all from a language that compiles to
          JavaScript.
        </p>
        <div class="actions">
          <a
            class="site-control site-control-primary"
            href="/docs/getting-started"
            >Get started <span aria-hidden="true">→</span></a
          ><a class="site-control" href="/docs/guide">Read the language guide</a
          >
        </div>
      </div>
      <div class="demo" aria-label="Try Kalandra">
        <div class="tabs" role="group" aria-label="Choose an example">
          {#each [1, 0, 2] as i}<button
              class:active={selected === i}
              aria-pressed={selected === i}
              onclick={() => select(i)}
              >{["Remote calls", "Parallel calls", "Type checks"][i]}</button
            >{/each}
        </div>
        <div bind:this={workbenchSpace}>
          <div class="workbench" bind:this={workbench}>
            <div class="filebar">
              <span>main.kalandra{changed ? " · edited" : ""}</span>
              {#if selected !== 0}<div>
                  <button
                    class="site-control"
                    onclick={() => (editing = !editing)}
                    disabled={busy || changed}
                    >{editing ? "View code" : "Edit code"}</button
                  ><button class="site-control" onclick={reset}>Reset</button>
                </div>{/if}
            </div>
            {#if editing}
              <CodeEditor
                bind:value={drafts[selected]}
                disabled={busy}
                compact
                onrun={run}
              />
            {:else}
              <pre
                class="source"
                class:remote-preview={selected === 0}
                aria-label="Kalandra source"><code>{@html example.html}</code
                ></pre>
            {/if}
            <div class="demo-caption">
              <p>{example.description}</p>
              {#if selected === 1}<p>
                  <code>|double|</code> dispatches each call to a worker.
                  <code>[await]</code> collects their results.
                </p>{:else}<p>{example.detail}</p>{/if}
            </div>
            {#if selected === 1 && !changed}
              <div
                class="dispatch"
                aria-label="Illustration of three independent calls, not a live worker monitor"
              >
                <span class="dispatch-label">THREE INDEPENDENT CALLS</span>
                <div class="dispatch-calls">
                  {#each [1, 2, 3] as value}<div>
                      <code>double {value}</code><span aria-hidden="true"
                        >→</span
                      ><code>{value * 2}</code>
                    </div>{/each}
                </div>
              </div>
            {/if}
            {#if selected === 0}
              <div class="runbar">
                <a class="site-control site-control-primary" href={example.link}
                  >Run with a service →</a
                ><span>Experimental</span>
              </div>
            {:else}
              <div class="runbar">
                <button
                  class="site-control site-control-primary"
                  onclick={run}
                  disabled={busy}
                  >Run example <span aria-hidden="true">▷</span></button
                >{#if busy}<button
                    class="site-control"
                    onclick={() => execution?.stop()}>Stop</button
                  >{/if}<span role="status">{status}</span>
              </div>
            {/if}
            <div class="result" aria-live="polite">
              {#if lastRun === undefined}<span class="result-label"
                  >{selected === 0
                    ? "EXPECTED WITH THE GUIDE’S CALIBRATION SERVICE"
                    : "EXPECTED"}</span
                ><code>{example.expected}</code>
              {:else}<span class="result-label"
                  >{lastRun !== drafts[selected]
                    ? "PREVIOUS RUN · SOURCE HAS CHANGED"
                    : "OUTPUT"}</span
                >{#each diagnostics as diagnostic}<p class="diagnostic">
                    <strong>{diagnostic.code}</strong>
                    {diagnostic.message}
                  </p>{/each}{#each output as line}<pre>{line}</pre>{/each}{#if busy && !output.length && !diagnostics.length}<span
                    >Working…</span
                  >{/if}{/if}
            </div>
            <div class="editor-footer">
              {#if selected === 0}<span
                  >Requires a running Bun service, client contract, and endpoint
                  bindings.</span
                >{:else}<span>Runs in your browser · 10 second limit</span
                ><button onclick={openPlayground}>Open in playground ↗</button
                >{/if}
            </div>
          </div>
        </div>
      </div>
    </section>
    <aside class="release-announcement shell" aria-label="Latest Kalandra news">
      <a href="/docs/blog/reviving-clio">Kalandra 0.13.0 development preview</a>
      <span>is now available to try. Clio is coming back.</span>
    </aside>
    <section
      use:reveal
      class="chapter shell introduction"
      aria-labelledby="what-title"
    >
      <div class="section-heading">
        <h2 id="what-title">What is Kalandra?</h2>
        <p>
          Kalandra is a functional programming language and a framework for
          parallel and distributed applications. Write functions, run
          independent work in parallel, and call services on other machines—with
          less communication code to assemble yourself.
        </p>
      </div>
      <div class="overview-grid">
        <div>
          <h3>A language built around functions</h3>
          <p>
            Describe your data with types and records, and compose functions
            into programs. <strong
              >Types check the data crossing worker and service boundaries</strong
            > before you run the code.
          </p>
          <a href="/docs/guide">Meet the language →</a>
        </div>
        <div>
          <h3>A framework for distributing work</h3>
          <p>
            Send independent calls to workers, or import a remote service and
            call its functions. <strong
              >The runtime handles task dispatch and serialization</strong
            >; you choose where the work belongs.
          </p>
          <a href="/docs/guide/parallel">Explore the execution model →</a>
        </div>
        <div>
          <h3>Built on JavaScript</h3>
          <p>
            Kalandra <strong>compiles to JavaScript modules</strong> and can use existing
            JavaScript packages. Try it in the browser playground, or use Bun to build
            local projects and experimental remote services.
          </p>
          <a href="/docs/getting-started">Start a project →</a>
        </div>
      </div>
    </section>
    <section use:reveal class="chapter shell" aria-labelledby="program-title">
      <div class="section-heading">
        <p class="eyebrow">WORKERS AND REMOTE CALLS</p>
        <h2 id="program-title">
          Distribute the work. Keep the program in view.
        </h2>
        <p>
          A local worker can call a remote service and collect its results.
          Here, a batch of sensor readings is sent to a calibration service
          through a typed client contract.
        </p>
      </div>
      <div
        class="execution-path"
        aria-label="The main program dispatches batch to a local worker, which calls the remote calibration service"
      >
        <div><span>Main program</span><code>await |batch| 10</code></div>
        <span aria-hidden="true">→</span>
        <div><span>Local worker</span><code>batch</code></div>
        <span aria-hidden="true">→</span>
        <div><span>Remote service</span><code>calibrate</code></div>
      </div>
      <div class="story-grid">
        <div class="story-copy">
          <h3>Two boundaries. Explicit in the source.</h3>
          <p>
            <code>|batch|</code> dispatches a function to a local worker. Inside
            that worker, <code>calibrate</code> makes remote calls because it
            comes from a <code>remote:</code> import.
          </p>
          <p>
            The client contract supplies the record and function types. The
            compiler checks the values crossing those boundaries, and <code
              >[await]</code
            > collects the results of the mapped calls.
          </p>
          <a href="/docs/guide/workflows"
            >Run the complete remote batch example →</a
          >
          <p class="small-note">
            Remote services are experimental. This example requires the Bun
            service, a generated client contract, and endpoint bindings; it does
            not run in the browser playground.
          </p>
        </div>
        <div class="code-sheet">
          <div class="filebar">remote-batch / client / main.kalandra</div>
          <pre class="snippet remote-source"><code
              >{@html data.remoteClient}</code
            ></pre>
          <div class="result">
            <span class="result-label">RESULT · TWO BATCHES</span><code
              >[12, 22, 12, 22]</code
            >
          </div>
        </div>
      </div>
    </section>

    <section use:reveal class="chapter shell" aria-labelledby="js-title">
      <div class="section-heading">
        <p class="eyebrow">PART OF THE JAVASCRIPT WORLD</p>
        <h2 id="js-title">A different source language. Familiar output.</h2>
        <p>
          Kalandra emits JavaScript modules and source maps. Ordinary functions
          stay ordinary functions in the generated code.
        </p>
      </div>
      <div class="code-pair">
        <div class="code-sheet">
          <div class="filebar">double.kalandra</div>
          <pre class="snippet compact"><code>{@html data.compiledSource}</code
            ></pre>
        </div>
        <div class="code-sheet">
          <div class="filebar">
            Generated JavaScript · built by this compiler
          </div>
          <pre class="snippet compact"><code class="syntax-code"
              >{@html data.javascript}</code
            ></pre>
        </div>
      </div>
      <div class="interop-note">
        <div>
          <h3>Bring an existing package.</h3>
          <p>
            Use explicit <code>esm:</code> or <code>cjs:</code> imports. Packages
            can provide Kalandra signatures so their functions have known types. This
            helper is imported by the invoice workflow in the guide:
          </p>
          <a href="/docs/guide/modules">Modules and package imports →</a>
        </div>
        <div class="code-sheet">
          <div class="filebar">invoice-math / index.js</div>
          <pre class="snippet compact"><code class="syntax-code"
              >{@html data.invoiceJs}</code
            ></pre>
        </div>
      </div>
    </section>

    <section use:reveal class="chapter shell" aria-labelledby="runtime-title">
      <div class="section-heading">
        <p class="eyebrow">CHOOSE WHERE THE WORK RUNS</p>
        <h2 id="runtime-title">
          Parallel on your machine. Distributed across services.
        </h2>
      </div>
      <div class="runtime-list">
        <div>
          <h3>In the browser</h3>
          <p>
            The playground compiles and runs a single file, including typed
            parallel calls in browser workers. No installation required.
          </p>
          <a href="/docs/playground">Try a program →</a>
          <p class="small-note">
            Fresh sandbox per run. No package imports or network access.
          </p>
        </div>
        <div>
          <h3>Locally with Bun</h3>
          <p>
            Build multi-file projects, import packages, and run parallel work in
            a bounded subprocess pool. Nested tasks share the scheduler, with
            cancellation and deadlines.
          </p>
          <a href="/docs/getting-started">Install Kalandra →</a>
          <p class="small-note">
            Use project build or run for managed parallel execution.
          </p>
        </div>
        <div>
          <h3>
            Across services <span class="preview-label">Experimental</span>
          </h3>
          <p>
            Expose typed tasks through authenticated Bun services. Generated
            contracts describe what clients can send and receive.
          </p>
          <a href="/docs/guide/workflows">Explore the remote batch example →</a>
          <p class="small-note">
            Verified on loopback HTTP. Public hosting and TLS need separate
            setup.
          </p>
        </div>
      </div>
    </section>

    <section use:reveal class="chapter shell" aria-labelledby="tools-title">
      <div class="story-grid">
        <div class="story-copy">
          <p class="eyebrow">WORK ON A PROJECT</p>
          <h2 id="tools-title">Create. Check. Build. Repeat.</h2>
          <p>
            The CLI creates an offline starter with two modules and a typed
            parallel function. Check source without running it, or rebuild when
            files change.
          </p>
          <p class="muted">
            The language server provides diagnostics, completion, type hover,
            definition lookup, references, and rename. Connect it through your
            editor’s LSP client; editor setup is currently manual.
          </p>
          <a href="/docs/development#editor-support">Set up editor support →</a>
        </div>
        <div class="code-sheet">
          <div class="filebar">With the installed Kalandra CLI</div>
          <pre class="snippet commands"><code class="syntax-code"
              >{@html data.commands}</code
            ></pre>
          <div class="result">
            <span class="result-label">STARTER RESULT</span><code
              >[2, 4, 6]</code
            >
          </div>
        </div>
      </div>
    </section>

    <section use:reveal class="chapter shell" aria-labelledby="learn-title">
      <div class="section-heading">
        <p class="eyebrow">LEARN AT YOUR OWN PACE</p>
        <h2 id="learn-title">Take a closer look.</h2>
        <p>
          Short lessons with executable examples, from a first function to a
          complete project.
        </p>
      </div>
      <div class="lesson-list">
        {#each data.lessons as lesson}<a href={"/docs/guide/" + lesson[0]}
            ><h3>{lesson[1]} <span aria-hidden="true">→</span></h3>
            <p>{lesson[2]}</p>
            <code>{@html lesson[3]}</code></a
          >{/each}
      </div>
    </section>
    <section use:reveal id="project" class="project shell">
      <div>
        <p class="eyebrow">A FRESH BEGINNING</p>
        <h2>Clio, continued.</h2>
      </div>
      <div>
        <p>
          Clio explored parallel and distributed programming. Kalandra brings it
          back with a rebuilt compiler, tooling, and documentation—and a new
          name.
        </p>
        <p class="muted">
          This is a development preview. Start with the browser playground, or
          install the CLI from npm with Bun.
        </p>
        <div class="project-links">
          <a href="/docs/getting-started">Installation →</a><a
            href="/docs/guide/limits">Current limitations →</a
          >
        </div>
      </div>
    </section>
  </main>
  <footer class="shell">
    <a class="wordmark" href="/" aria-label="Kalandra home">kalandra.</a><span
      >Open source · Apache 2.0</span
    ><a href="https://github.com/kalandra-lang/kalandra">GitHub ↗</a><a
      href="/docs">Documentation →</a
    >
  </footer>
</div>

<style>
  .landing {
    color: var(--foreground);
    background: var(--background);
    min-height: 100vh;
  }
  .shell {
    width: min(1120px, calc(100% - 64px));
    margin-inline: auto;
  }
  header {
    height: 96px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid var(--border);
  }
  .wordmark {
    font-size: 26px;
    font-weight: 650;
    letter-spacing: -1.2px;
    text-decoration: none;
  }
  nav,
  .actions,
  .project-links {
    display: flex;
    align-items: center;
    gap: 24px;
  }
  nav {
    font-size: 14px;
  }
  a {
    color: inherit;
    text-underline-offset: 5px;
  }
  a.site-control-primary {
    color: var(--primary-foreground);
  }
  nav a {
    text-decoration: none;
  }
  nav a:hover {
    text-decoration: underline;
  }
  .release-announcement {
    box-sizing: border-box;
    border-radius: var(--radius);
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 4px 7px;
    padding: 20px 24px;
    text-align: center;
    background: var(--muted);
    border-block: 1px solid var(--border);
    font-size: 15px;
    line-height: 1.6;
  }
  .release-announcement a {
    font-weight: 600;
    text-decoration: underline;
  }
  .hero {
    position: relative;
    isolation: isolate;
    display: grid;
    grid-template-columns: minmax(0, 0.85fr) minmax(0, 1.25fr);
    gap: 44px;
    align-items: center;
    padding-block: 56px 64px;
  }
  .intro {
    min-width: 0;
  }
  .demo {
    min-width: 0;
  }
  .source.remote-preview {
    height: auto;
    min-height: 218px;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .demo-caption {
    padding: 0 20px 16px;
    font-size: 13px;
    line-height: 1.6;
    color: var(--muted-foreground);
  }
  .demo-caption p {
    margin: 0 0 6px;
  }
  .demo-caption code {
    color: var(--foreground);
  }
  .dispatch {
    margin: 0 20px 18px;
    padding: 12px 0;
    border-block: 1px solid var(--border);
  }
  .dispatch-label {
    display: block;
    font-size: 10px;
    letter-spacing: 0.08em;
    color: var(--muted-foreground);
    margin-bottom: 10px;
  }
  .dispatch-calls {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 10px;
  }
  .dispatch-calls > div {
    display: flex;
    justify-content: space-between;
    gap: 6px;
    font-size: 12px;
  }
  .dispatch-calls > div + div {
    border-left: 1px solid var(--border);
    padding-left: 10px;
  }

  .eyebrow {
    font-size: 11px;
    letter-spacing: 0.14em;
    font-weight: 650;
    color: var(--muted-foreground);
    margin: 0 0 20px;
  }
  h1 {
    font-size: clamp(38px, 4vw, 52px);
    font-weight: 550;
    letter-spacing: -0.045em;
    line-height: 1.08;
    margin: 0;
  }
  .description {
    max-width: 670px;
    font-size: 17px;
    line-height: 1.65;
    color: var(--muted-foreground);
    margin: 26px 0;
  }
  .actions {
    gap: 12px;
    flex-wrap: wrap;
  }
  .tabs {
    display: flex;
    border-bottom: 1px solid var(--border);
    gap: 24px;
  }
  .tabs button {
    border: 0;
    border-bottom: 2px solid transparent;
    background: none;
    color: var(--muted-foreground);
    padding: 16px 0;
    font: inherit;
    font-size: 14px;
    cursor: pointer;
  }
  .tabs button.active {
    color: var(--foreground);
    border-bottom-color: var(--foreground);
  }
  h2 {
    font-size: 30px;
    line-height: 1.2;
    font-weight: 550;
    letter-spacing: -0.03em;
    margin: 0 0 20px;
  }
  .project p:not(.eyebrow) {
    font-size: 16px;
    line-height: 1.7;
  }
  .muted {
    color: var(--muted-foreground);
  }
  .project-links {
    font-size: 14px;
  }
  .workbench {
    box-sizing: border-box;
    background: var(--background);
    min-width: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .filebar {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 10px 16px;
    background: var(--muted);
    border-bottom: 1px solid var(--border);
    font: 12px var(--font-mono);
  }
  .filebar div {
    display: flex;
    gap: 6px;
  }
  .filebar button {
    font-size: 12px;
    padding: 4px 8px;
  }
  .source {
    box-sizing: border-box;
    display: block;
    width: 100%;
    height: 218px;
    overflow: auto;
    margin: 0;
    padding: 24px;
    font: 500 15px/1.85 var(--font-mono);
    tab-size: 2;
    background: var(--background);
    color: var(--foreground);
    border: 0;
    white-space: pre;
  }
  .runbar {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 0 16px 16px;
  }
  .runbar span {
    font-size: 12px;
    color: var(--muted-foreground);
  }
  .result {
    padding: 18px 24px;
    border-top: 1px solid var(--border);
    background: var(--muted);
    min-height: 90px;
    overflow-wrap: anywhere;
  }
  .result-label {
    display: block;
    font-size: 10px;
    letter-spacing: 0.1em;
    color: var(--muted-foreground);
    margin-bottom: 10px;
  }
  .result code,
  .result pre {
    font: 14px/1.6 var(--font-mono);
    margin: 0;
    white-space: pre-wrap;
  }
  .diagnostic {
    font-size: 13px;
    line-height: 1.6;
    margin: 0 0 10px;
  }
  .editor-footer {
    padding: 12px 16px;
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    justify-content: space-between;
    font-size: 11px;
    color: var(--muted-foreground);
  }
  .editor-footer button {
    border: 0;
    background: none;
    color: var(--foreground);
    padding: 0;
    font: inherit;
    text-decoration: underline;
    text-underline-offset: 3px;
    cursor: pointer;
  }
  .project {
    padding-block: 48px 64px;
    border-top: 1px solid var(--border);
    display: grid;
    grid-template-columns: 0.85fr 1.5fr;
    gap: 56px;
  }
  .project p {
    margin-top: 0;
  }
  .project-links {
    margin-top: 24px;
    flex-wrap: wrap;
  }
  footer {
    border-top: 1px solid var(--border);
    padding-block: 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 20px;
    font-size: 12px;
    color: var(--muted-foreground);
  }
  footer .wordmark {
    font-size: 20px;
  }
  button:disabled {
    opacity: 0.55;
    cursor: default;
  }
  button:focus-visible,
  a:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 3px;
  }
  .skip {
    position: absolute;
    top: -100px;
    padding: 12px;
    background: var(--background);
  }
  .skip:focus {
    top: 0;
  }
  .execution-path {
    display: flex;
    align-items: center;
    gap: 24px;
    padding: 24px 0;
    margin-bottom: 32px;
    border-block: 1px solid var(--border);
  }
  .execution-path div {
    flex: 1;
    display: grid;
    gap: 8px;
  }
  .execution-path div span {
    font-size: 13px;
    color: var(--muted-foreground);
  }
  .execution-path code {
    font-size: 14px;
  }
  .remote-source {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  @media (max-width: 520px) {
    .execution-path {
      gap: 10px;
    }
    .execution-path code {
      font-size: 11px;
    }
    .execution-path div span {
      font-size: 11px;
    }
  }
  .chapter {
    padding-block: 56px;
    border-top: 1px solid var(--border);
  }
  .introduction > .section-heading {
    margin-inline: auto;
    text-align: center;
    margin-bottom: 40px;
  }
  .overview-grid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 36px;
  }
  .overview-grid > div {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
  }
  .overview-grid p {
    font-size: 16px;
    line-height: 1.7;
    color: var(--muted-foreground);
    flex: 1;
  }
  .overview-grid strong {
    color: var(--foreground);
    font-weight: 600;
  }
  .overview-grid a {
    font-size: 14px;
  }
  @media (max-width: 800px) {
    .overview-grid {
      grid-template-columns: 1fr;
      gap: 28px;
    }
    .introduction > .section-heading {
      text-align: left;
    }
  }
  .section-heading {
    max-width: 760px;
    margin-bottom: 32px;
  }
  .section-heading p:not(.eyebrow),
  .story-copy p,
  .interop-note p,
  .runtime-list p {
    font-size: 16px;
    line-height: 1.7;
  }
  .section-heading p:not(.eyebrow) {
    color: var(--muted-foreground);
  }
  .story-grid {
    display: grid;
    grid-template-columns: 0.85fr 1.5fr;
    gap: 56px;
    align-items: start;
  }
  h3 {
    font-size: 19px;
    font-weight: 550;
    letter-spacing: -0.02em;
    margin: 0 0 14px;
  }
  .story-copy p {
    margin: 0 0 20px;
  }
  .story-copy a,
  .interop-note a,
  .runtime-list a {
    font-size: 14px;
  }
  .code-sheet {
    min-width: 0;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    overflow: hidden;
  }
  .snippet {
    margin: 0;
    padding: 24px;
    overflow: auto;
    font: 500 14px/1.85 var(--font-mono);
    background: var(--background);
  }
  .story-copy .small-note,
  .runtime-list .small-note {
    font-size: 12px;
    line-height: 1.65;
    color: var(--muted-foreground);
    margin-top: 20px;
  }
  .code-pair {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 20px;
  }
  .compact {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  }
  .interop-note {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 40px;
    align-items: center;
    margin-top: 36px;
  }
  .runtime-list {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
  }
  .runtime-list > div {
    border-top: 1px solid var(--border);
    padding-top: 24px;
  }
  .preview-label {
    display: block;
    font-size: 11px;
    font-weight: 400;
    color: var(--muted-foreground);
    letter-spacing: 0;
    margin-top: 8px;
  }
  .lesson-list {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 32px;
  }
  .lesson-list a {
    text-decoration: none;
    border-top: 1px solid var(--border);
    padding-top: 22px;
    min-width: 0;
  }
  @media (prefers-reduced-motion: no-preference) {
    .lesson-list a,
    .site-control {
      transition:
        color 160ms ease,
        background-color 160ms ease,
        transform 160ms ease;
    }
    .lesson-list a:hover,
    .site-control:hover {
      transform: translateY(-2px);
    }
    .lesson-list h3 span {
      transition: transform 160ms ease;
    }
    .lesson-list a:hover h3 span {
      transform: translateX(3px);
    }
  }
  .lesson-list a:hover h3 {
    text-decoration: underline;
    text-underline-offset: 5px;
  }
  .lesson-list h3 {
    display: flex;
    justify-content: space-between;
  }
  .lesson-list p {
    font-size: 14px;
    line-height: 1.6;
    color: var(--muted-foreground);
  }
  .lesson-list code {
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  @media (max-width: 800px) {
    .story-grid,
    .code-pair,
    .interop-note {
      grid-template-columns: 1fr;
      gap: 24px;
    }
    .runtime-list,
    .lesson-list {
      grid-template-columns: 1fr 1fr;
    }
  }
  @media (max-width: 520px) {
    .chapter {
      padding-block: 36px;
    }
    .runtime-list,
    .lesson-list {
      grid-template-columns: 1fr;
    }
    .snippet {
      padding: 18px 14px;
      font-size: 12px;
    }
  }
  @media (max-width: 800px) {
    .project {
      grid-template-columns: 1fr;
      gap: 24px;
    }
    .hero {
      grid-template-columns: 1fr;
      gap: 32px;
      padding-block: 36px 48px;
    }
  }
  @media (max-width: 520px) {
    .shell {
      width: calc(100% - 32px);
    }
    header {
      height: 76px;
    }
    nav {
      gap: 16px;
      font-size: 12px;
    }
    nav a:last-child {
      display: none;
    }
    .wordmark {
      font-size: 24px;
    }
    .description {
      font-size: 17px;
    }
    .tabs {
      gap: 0;
      justify-content: space-between;
    }
    .tabs button {
      font-size: 12px;
    }
    .source {
      padding: 18px 14px;
      font-size: 13px;
      height: 220px;
    }
    .actions {
      flex-wrap: wrap;
    }
    footer {
      flex-wrap: wrap;
    }
  }
</style>
