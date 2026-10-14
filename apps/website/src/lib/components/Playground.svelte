<script lang="ts">
  import { afterNavigate } from "$app/navigation";
  import CodeEditor from "./CodeEditor.svelte";
  import { onDestroy } from "svelte";
  import {
    startPlayground,
    type PlaygroundEvent,
  } from "$lib/playground/client";
  import { examples, playgroundExampleIndex } from "$lib/playground/examples";

  let selected = $state(0);
  let source = $state<string>(examples[0].source);
  let status = $state("Ready");
  let lastRun = $state<string | undefined>();
  let busy = $state(false);
  let output = $state<string[]>([]);
  let result = $state<string | undefined>();
  let error = $state<string | undefined>();
  let diagnostics = $state<
    Extract<PlaygroundEvent, { kind: "diagnostics" }>["diagnostics"]
  >([]);
  let editor = $state<HTMLTextAreaElement>();
  let execution: ReturnType<typeof startPlayground> | undefined;
  let generation = 0;
  const changed = $derived(source !== examples[selected].source);

  let appliedExample: string | null | undefined;
  afterNavigate(() => {
    const requested = new URLSearchParams(window.location.search).get(
      "example",
    );
    if (requested === appliedExample) return;
    appliedExample = requested;
    selected = playgroundExampleIndex(window.location.search);
    reset();
    if (new URLSearchParams(window.location.search).get("from") === "home") {
      try {
        const transferred = sessionStorage.getItem("kalandra-home-source");
        sessionStorage.removeItem("kalandra-home-source");
        if (transferred && transferred.length <= 65536) source = transferred;
      } catch {
        /* The default example remains available without storage. */
      }
    }
  });

  function stop() {
    execution?.stop();
  }
  function reset() {
    stop();
    generation++;
    source = examples[selected].source;
    output = [];
    diagnostics = [];
    result = undefined;
    error = undefined;
    status = "Ready";
    lastRun = undefined;
  }
  function run() {
    if (busy) return;
    const id = ++generation;
    lastRun = source;
    output = [];
    diagnostics = [];
    result = undefined;
    error = undefined;
    busy = true;
    execution = startPlayground(source, (event) => {
      if (id !== generation) return;
      if (event.kind === "output") output = [...output, event.text];
      else if (event.kind === "diagnostics") diagnostics = event.diagnostics;
      else if (event.kind === "loading") status = "Loading";
      else if (event.kind === "compiling") status = "Compiling";
      else if (event.kind === "running") status = "Running";
      else {
        busy = false;
        if (event.kind === "result") {
          result = event.text;
          status = "Finished";
        }
        if (event.kind === "error") {
          error = event.text;
          status = "Failed";
        }
        if (event.kind === "invalid") status = "Check your source";
        if (event.kind === "stopped") status = "Stopped";
      }
    });
  }
  function location(offset: number) {
    const before = source.slice(0, offset).split("\n");
    return `line ${before.length}, column ${before.at(-1)!.length + 1}`;
  }
  function showDiagnostic(offset: number) {
    editor?.focus();
    editor?.setSelectionRange(offset, offset);
  }
  onDestroy(() => {
    generation++;
    stop();
  });
</script>

<section class="playground not-prose" aria-label="Kalandra playground">
  <div class="example-row">
    <label for="example">Example</label>
    <select id="example" bind:value={selected} onchange={reset} disabled={busy}>
      {#each examples as example, index}
        <option value={index}>{example.name}</option>
      {/each}
    </select>
    <button class="reset" onclick={reset} disabled={busy || !changed}
      >Reset example</button
    >
  </div>
  <p class="description">{examples[selected].description}</p>
  <div class="editor-label">
    <label for="source">main.kalandra</label>
    <span>{changed ? "Edited" : "Example"} · Ctrl/⌘ Enter to run</span>
  </div>
  <CodeEditor
    id="source"
    bind:editor
    bind:value={source}
    disabled={busy}
    describedby="source-help"
    onrun={run}
  />
  <div class="controls">
    <button class="run" onclick={run} disabled={busy || !source.trim()}
      >Run</button
    >
    <button onclick={stop} disabled={!busy}>Stop</button>
    <span role="status" aria-live="polite" class="status"
      ><span class:active={busy} class="dot"></span>{status}</span
    >
  </div>
  <p id="source-help" class="hint">
    Export a main function. Each run starts fresh and stops after 10 seconds.
    Your source stays in this browser.
  </p>

  {#if lastRun !== undefined && source !== lastRun}
    <p class="hint">
      Source changed since the last run. Run again to update these results.
    </p>
  {/if}
  {#if diagnostics.length}
    <div class="diagnostics" aria-label="Compiler diagnostics">
      <h2>Diagnostics <span>{diagnostics.length}</span></h2>
      <ul>
        {#each diagnostics as diagnostic}
          <li class:warning={diagnostic.severity === "warning"}>
            <strong>{diagnostic.severity} · {diagnostic.code}</strong>
            {#if diagnostic.span}
              <button
                class="location"
                disabled={busy || source !== lastRun}
                onclick={() => showDiagnostic(diagnostic.span!.start)}
              >
                {location(diagnostic.span.start)}
              </button>
            {/if}
            <p>{diagnostic.message}</p>
          </li>
        {/each}
      </ul>
    </div>
  {/if}
  <div class="output" aria-label="Program output">
    <h2>Output</h2>
    {#if !output.length && result === undefined && !error}
      <p class="empty">
        {busy
          ? "Waiting for output…"
          : "Run an example to see its result here."}
      </p>
    {/if}
    {#each output as line}<pre>{line}</pre>{/each}
    {#if result !== undefined}
      <div class="result">
        <span>Result</span>
        <pre>{result}</pre>
      </div>
    {/if}
    {#if error}<p class="error" role="alert">{error}</p>{/if}
  </div>
</section>

<style>
  .playground {
    margin: 1.5rem 0 2rem;
    font-family: var(--font-sans);
  }
  .example-row,
  .controls,
  .editor-label {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    flex-wrap: wrap;
  }
  label,
  h2 {
    font-weight: 600;
    font-size: 0.875rem;
  }
  select,
  button {
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    padding: 0.5rem 0.8rem;
    background: var(--background);
    color: var(--foreground);
    font-size: 0.875rem;
  }
  select {
    flex: 1;
    min-width: 10rem;
  }
  button {
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.5;
    cursor: default;
  }
  button:not(:disabled):hover {
    background: var(--muted);
  }
  button:focus-visible,
  select:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 3px;
  }
  .description,
  .hint,
  .empty,
  .editor-label span {
    color: var(--muted-foreground);
    font-size: 0.8rem;
    line-height: 1.6;
  }
  .description {
    margin: 0.75rem 0 1.25rem;
  }
  .editor-label {
    justify-content: space-between;
    padding: 0.7rem 1rem;
    border: 1px solid var(--border);
    border-bottom: 0;
    border-radius: 0.6rem 0.6rem 0 0;
    background: var(--muted);
  }
  .controls {
    margin-top: 1rem;
  }
  .run {
    background: var(--primary);
    color: var(--primary-foreground);
    border-color: var(--primary);
    min-width: 5rem;
    font-weight: 600;
  }
  .run:not(:disabled):hover {
    background: var(--primary);
    filter: brightness(0.9);
  }
  .status {
    display: flex;
    gap: 0.4rem;
    align-items: center;
    margin-left: auto;
    font-size: 0.8rem;
    color: var(--muted-foreground);
  }
  .dot {
    width: 0.4rem;
    height: 0.4rem;
    background: var(--muted-foreground);
    border-radius: 50%;
  }
  .dot.active {
    background: var(--primary);
  }
  .hint {
    margin: 0.8rem 0 1.5rem;
  }
  .output,
  .diagnostics {
    border: 1px solid var(--border);
    border-radius: 0.6rem;
    margin-top: 1rem;
    padding: 1rem;
  }
  h2 {
    margin: 0 0 0.8rem;
  }
  h2 span {
    color: var(--muted-foreground);
    margin-left: 0.4rem;
  }
  pre {
    font-family: var(--font-mono);
    font-size: 0.85rem;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    margin: 0.5rem 0;
  }
  .result {
    border-top: 1px solid var(--border);
    padding-top: 0.8rem;
  }
  .result span {
    font-size: 0.7rem;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: var(--muted-foreground);
  }
  .error {
    color: var(--destructive);
    overflow-wrap: anywhere;
    font-size: 0.875rem;
  }
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
  }
  li {
    border-left: 2px solid var(--destructive);
    padding-left: 0.8rem;
    margin: 1rem 0;
    font-size: 0.8rem;
  }
  li.warning {
    border-color: var(--muted-foreground);
  }
  li p {
    margin-top: 0.4rem;
    overflow-wrap: anywhere;
  }
  .location {
    padding: 0;
    border: 0;
    text-decoration: underline;
    margin-left: 0.5rem;
    font-size: 0.8rem;
  }
</style>
