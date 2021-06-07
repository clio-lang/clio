<script>
  import Nav from "./components/Nav.svelte";
  import SideNavItem from "./components/SideNavItem.svelte";

  import routes from "./routes.json";

  import "prismjs/plugins/line-numbers/prism-line-numbers.css";
  import "prismjs/plugins/command-line/prism-command-line.css";
  import "prismjs/plugins/line-highlight/prism-line-highlight.css";

  import "prism-material-themes/themes/material-default.css";

  import { Route } from "tinro";
  import { onMount } from "svelte";
  import slugify from "slugify";

  import { writable } from "svelte/store";
  import { setContext } from "svelte";
  import keys from "./api/context";

  const currentSection = writable(null);
  setContext(keys.currentSection, currentSection);

  import V9 from "./routes/v0.9.0/index.svelte";

  let sections = [];
  let menuOpen = false;

  const slug = (title) => slugify(title).toLowerCase();

  onMount(() => {
    menuOpen = window.innerWidth > 640;
  });

</script>

<Nav bind:menuOpen />

<div class="page">
  <div class="sidenav" class:open={menuOpen}>
    <SideNavItem key="." tree={routes["."]} />
  </div>
  <main>
    <V9 bind:sections />
  </main>
  <div class="headnav">
    <div class="sticky">
      <h3>Sections</h3>
      {#each sections as section}
        <a
          href="#{slug(section)}"
          class:active={$currentSection == slug(section)}
          tinro-ignore
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
  main {
    position: relative;
    background: #eee;
    padding: 2em;
    box-sizing: border-box;
    flex: 1;
    box-shadow: -1px -1px 100px 20px rgba(0, 0, 0, 0.2);
    display: flex;
    flex-direction: column;
  }
  .sidenav {
    background: #f5f7f9;
    padding: 2em;
    padding-right: 0;
    padding-left: 1em;
    border-right: 1px solid rgba(0, 0, 0, 0.1);
  }
  .headnav {
    min-width: 220px;
    min-height: 240px;
    border-left: 1px solid rgba(0, 0, 0, 0.1);
    position: sticky;
    top: 0;
    background: #eee;
    padding: 2em;
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
    padding-bottom: 0.5em;
    border-bottom: 1px dashed rgba(0, 0, 0, 0.1);
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
    .sidenav {
      position: fixed;
      height: 100%;
      width: 80%;
      max-width: 400px;
      transform: translateX(-100vh);
      transition: cubic-bezier(0.55, 0.055, 0.675, 0.19) 0.4s all;
      z-index: 4;
      overflow-y: auto;
    }
    .sidenav.open {
      transform: translateX(0);
      box-shadow: 0px 0px 128px 8px rgba(0, 0, 0, 0.3);
    }
    main {
      padding: 1em;
    }
  }

</style>
