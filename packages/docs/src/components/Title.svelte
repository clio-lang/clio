<script>
  import { getContext, onMount } from "svelte";
  import keys from "../api/context";

  import slugify from "slugify";
  import PageTitle from "./PageTitle.svelte";

  export let level = 1;
  export let title;

  const currentSection = getContext(keys.currentSection);
  const slug = slugify(title).toLowerCase();

  let observer;

  const setCurrent = (entries) => {
    if (entries[0].boundingClientRect.y < 0) {
      $currentSection = slug;
    }
  };

  const observe = (el) => {
    document.addEventListener("readystatechange", () => {
      observer = new IntersectionObserver(setCurrent, {});
      observer.observe(el);
    });
  };

  onMount(() => () => {
    observer?.disconnect();
  });

  if (level === 1) $currentSection = slug;

</script>

{#if level == 1}
  <PageTitle {title} />
{/if}

<a href="#{slug}" id={slug}>
  {#if level == 1}
    <h1 class="title" use:observe>{title}</h1>
  {:else if level == 2}
    <h2 class="title" use:observe>{title}</h2>
  {:else if level == 3}
    <h3 class="title" use:observe>{title}</h3>
  {:else if level == 4}
    <h4 class="title" use:observe>{title}</h4>
  {:else if level == 5}
    <h5 class="title" use:observe>{title}</h5>
  {/if}
</a>
<div class="bar" />

<style>
  .title {
    padding: 0;
    margin: 0;
  }
  .bar {
    padding-bottom: 1em;
    margin-bottom: 1em;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }
  .title:not(:first-child) {
    margin-top: 1em;
  }
  a {
    text-decoration: none;
    display: inline-flex;
    align-self: flex-start;
    scroll-margin-top: 100px;
    outline: none;
  }
  a:not(:first-child) {
    margin-top: 2em;
  }

</style>
