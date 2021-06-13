<script>
  import Search from "./Search.svelte";

  export let metaVariant;
  export let menuOpen;

  const toggleMenu = () => (menuOpen = !menuOpen);
</script>

<div class="head">
  <button class="hamburger" on:click={toggleMenu}>
    <img src="/bars-light.svg" alt="hamburger" />
  </button>
  <div class="logo-container">
    <img src="/logo-512x512.png" alt="Clio" class="logo" />
    <h1>Clio</h1>
  </div>
  <div class="spacer" />
  <Search {metaVariant} />
  <div class="spacer" />
  <nav class="nav">
    <a href="https://github.com/clio-lang/clio">
      <img src="/github.png" alt="Github" />
    </a>
  </nav>
</div>

<style>
  .head {
    display: flex;
    padding: 1em 2em;
    box-shadow: 0px 0px 32px 8px rgba(0, 0, 0, 0.3);
    align-items: center;
    position: sticky;
    top: 0;
    background: #eee;
    z-index: 9999;
    gap: 1em;
  }
  .spacer {
    flex: 1;
  }
  .logo-container {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  h1 {
    font-size: 2em;
    margin: 0;
  }
  .logo {
    height: 44px;
    margin-right: 1em;
  }
  a {
    color: rgb(33, 33, 33);
    text-decoration: none;
    margin-left: 2em;
    transition: cubic-bezier(0.23, 1, 0.32, 1) all 0.17s;
  }
  a:hover {
    color: rgb(204, 42, 64);
  }
  a img {
    height: 32px;
  }
  nav {
    display: flex;
    align-items: center;
  }
  .hamburger {
    display: none;
    border: none;
  }
  .hamburger img {
    height: 2.2em;
  }
  .logo {
    border-radius: 4px;
  }
  @media (max-width: 768px) {
    .hamburger {
      display: block;
      position: absolute;
      left: 1em;
      top: auto;
      bottom: auto;
    }
    .spacer,
    .nav {
      display: none;
    }
    .head {
      align-items: center;
      justify-content: center;
    }
  }
</style>
