<script lang="ts">
  import { onMount } from "svelte";

  let {
    value = $bindable(""),
    editor = $bindable<HTMLTextAreaElement>(),
    disabled = false,
    compact = false,
    id,
    describedby,
    onrun,
  }: {
    value?: string;
    editor?: HTMLTextAreaElement;
    disabled?: boolean;
    compact?: boolean;
    id?: string;
    describedby?: string;
    onrun: () => void;
  } = $props();
  let paint: HTMLPreElement;
  let highlight = $state<(source: string) => string>();
  const html = $derived(highlight?.(value));
  onMount(() => {
    let mounted = true;
    // Load the same lexer-based highlighter used for static examples only when editing.
    void import("../../../../../scripts/website-highlighting")
      .then((module) => {
        if (mounted) highlight = module.highlightKalandra;
      })
      .catch(() => {
        /* Keep the ordinary textarea usable if loading fails. */
      });
    return () => {
      mounted = false;
    };
  });
  function syncScroll() {
    if (!editor || !paint) return;
    paint.scrollTop = editor.scrollTop;
    paint.scrollLeft = editor.scrollLeft;
  }
</script>

<div
  class="code-editor"
  class:compact
  class:disabled
  class:highlighted={html !== undefined}
>
  <pre bind:this={paint} aria-hidden="true"><code
      >{#if html !== undefined}{@html html + "\n"}{/if}</code
    ></pre>
  <textarea
    {id}
    bind:this={editor}
    bind:value
    {disabled}
    aria-label="Kalandra source"
    aria-describedby={describedby}
    spellcheck="false"
    autocapitalize="off"
    autocomplete="off"
    wrap="off"
    maxlength={65536}
    onscroll={syncScroll}
    onkeydown={(event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        onrun();
      }
    }}
  ></textarea>
</div>

<style>
  .code-editor {
    position: relative;
    height: 20rem;
    min-height: 10rem;
    resize: vertical;
    overflow: hidden;
    border: 1px solid var(--border);
    border-radius: 0 0 0.6rem 0.6rem;
    background: var(--background);
  }
  .code-editor:focus-within {
    outline: 2px solid var(--ring);
    outline-offset: -2px;
  }
  .disabled {
    opacity: 0.8;
  }
  pre,
  textarea {
    position: absolute;
    inset: 0;
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: 1rem;
    margin: 0;
    border: 0;
    border-radius: 0;
    font: 400 14px/1.65 var(--font-mono);
    font-variant-ligatures: common-ligatures contextual;
    font-feature-settings:
      "calt" 1,
      "liga" 1;
    letter-spacing: normal;
    tab-size: 2;
    white-space: pre;
    overflow-wrap: normal;
    word-break: normal;
    text-align: left;
  }
  pre {
    pointer-events: none;
    overflow: hidden;
    background: transparent;
  }
  code {
    font: inherit;
    padding: 0;
    background: transparent;
    white-space: inherit;
  }
  textarea {
    resize: none;
    overflow: auto;
    background: transparent;
    color: var(--foreground);
    caret-color: var(--foreground);
    outline: none;
  }
  .highlighted textarea {
    color: transparent;
    -webkit-text-fill-color: transparent;
  }
  textarea::selection {
    background: color-mix(in srgb, var(--foreground) 22%, transparent);
  }
  .compact {
    height: 218px;
    border: 0;
    border-radius: 0;
  }
  .compact pre,
  .compact textarea {
    padding: 24px;
    font-size: 15px;
    font-weight: 500;
    line-height: 1.85;
  }
  @media (max-width: 520px) {
    .compact {
      height: 220px;
    }
    .compact pre,
    .compact textarea {
      padding: 18px 14px;
      font-size: 13px;
    }
  }
  @media (forced-colors: active) {
    pre {
      display: none;
    }
    .highlighted textarea {
      color: CanvasText;
      -webkit-text-fill-color: CanvasText;
    }
  }
</style>
