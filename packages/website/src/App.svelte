<script>
  import Editor from "clio-playground/src/components/Editor.svelte";
  import Head from "./components/Head.svelte.js";
  import Hero from "./components/Hero.svelte.js";
  import Features from "./components/Features.svelte.js";
  import Examples from "./components/Examples.svelte.js";
  import Social from "./components/Social.svelte.js";
  import Footer from "./components/Footer.svelte.js";
  import Performance from "./components/Performance.svelte.js";

</script>

<Head />
<Hero />

<div class="playground">
  <Editor title="Clio" share={true} query="code" />
</div>

<Features />
<Examples />
<Performance />
<Social />
<Footer />

<style>
  .playground {
    height: 400px;
    border-radius: 4px;
    overflow: hidden;
    box-shadow: 0px 0px 32px 8px rgba(0, 0, 0, 0.3);
    border: 1px solid #333;
    max-width: 1280px;
    margin: 0 auto;
    margin-bottom: 4em;
  }
  @media (max-width: 960px) {
    .playground {
      max-width: 90%;
      padding: 2em;
    }
  }
  @media (max-width: 640px) {
    .playground {
      display: none;
    }
  }

</style>
