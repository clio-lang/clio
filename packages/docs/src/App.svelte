<script>
  import Nav from "./components/Nav.svelte";
  import Main from "./components/Main.svelte";
  import SideNav from "./components/SideNav.svelte";

  import "prismjs/plugins/line-numbers/prism-line-numbers.css";
  import "prismjs/plugins/command-line/prism-command-line.css";
  import "prismjs/plugins/line-highlight/prism-line-highlight.css";

  import "prism-material-themes/themes/material-default.css";

  import { Route } from "tinro";
  import { onMount } from "svelte";

  import dynamicImport from "./imports";
  import slugify from "slugify";

  import { writable } from "svelte/store";
  import { setContext } from "svelte";
  import keys from "./api/context";

  const currentSection = writable(null);
  setContext(keys.currentSection, currentSection);

  let sections = [];
  let menuOpen = false;
  let currentVariant = null;
  let metaVariant;

  const setMetaVariant = (variant) => {
    if (variant)
      dynamicImport(`./meta/${variant}.json`)
        .then((data) => data.default)
        .then((meta) => (metaVariant = meta));
  };

  $: setMetaVariant(currentVariant);

  const slug = (title) => slugify(title).toLowerCase();

  onMount(() => {
    menuOpen = window.innerWidth > 640;
  });
</script>

<Nav bind:menuOpen {metaVariant} />

<div class="page">
  <SideNav {menuOpen} {metaVariant} bind:currentVariant />
  <Route path="/*">
    <Main {metaVariant} bind:currentVariant bind:sections />
  </Route>

  <div class="headnav">
    <div class="sticky">
      <h3>Sections</h3>
      {#each sections as section}
        <a
          href="#{slug(section)}"
          class:active={$currentSection == slug(section)}
          data-tinro-ignore
        >
          <h4>{section}</h4>
        </a>
      {/each}
    </div>
  </div>
</div>

<style>
  .page {
    display: flex;
    flex: 1;
  }
  .headnav {
    min-height: 240px;
    border-left: 1px solid rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    background: #eee;
    padding: 2em;
    box-sizing: border-box;
  }
  .headnav > .sticky > a {
    margin-bottom: 0.5em;
  }
  .sticky {
    position: sticky;
    top: 6em;
    display: flex;
    flex-direction: column;
  }
  h3 {
    margin-bottom: 1em;
  }
  a {
    align-self: flex-start;
    text-decoration: none;
    padding-bottom: 0.25em;
    border-bottom: 1px dotted rgba(0, 0, 0, 0.1);
  }
  a:hover {
    border-bottom: 1px solid rgba(0, 0, 0, 0.8);
  }
  a.active {
    color: rgb(204, 42, 64);
  }
  @media (max-width: 768px) {
    .headnav {
      display: none;
    }
  }
</style>
