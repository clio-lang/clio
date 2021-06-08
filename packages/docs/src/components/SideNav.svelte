<script>
  import { onMount } from "svelte";
  import SideNavItem from "./SideNavItem.svelte";

  import routes from "../routes.json";
  import variants from "../variants.json";

  export let menuOpen;
  export let currentVariant;

  const latestVariant = variants
    .slice()
    .sort((lhs, rhs) => rhs.localeCompare(lhs))
    .shift();

  onMount(() => {
    currentVariant =
      window.location.pathname.split("/").shift() || latestVariant;
  });

</script>

<div class="sidenav" class:open={menuOpen}>
  <div class="variants">
    <select>
      {#each variants as variant}
        <option value={variant} selected={variant == currentVariant}>
          {variant}
        </option>
      {/each}
    </select>
  </div>
  <SideNavItem key="." tree={routes["."]} />
</div>

<style>
  .sidenav {
    background: #f5f7f9;
    padding: 2em;
    padding-right: 0;
    padding-left: 1em;
    border-right: 1px solid rgba(0, 0, 0, 0.1);
    display: flex;
    flex-direction: column;
  }
  .variants {
    align-self: flex-end;
    padding: 0 1em;
    width: 100%;
    box-sizing: border-box;
    margin-bottom: 1em;
  }
  .variants select {
    border: 1em solid #fff;
    border-radius: 2em;
    padding: 0 1em;
    width: 100%;
    box-shadow: 0px 0px 1px rgb(0 0 0 / 20%);
    outline: none;
  }

  @media (max-width: 768px) {
    .sidenav {
      position: fixed;
      height: 100%;
      width: 80%;
      max-width: 400px;
      transform: translateX(-100vh);
      transition: cubic-bezier(0.55, 0.055, 0.675, 0.19) 0.4s all;
      z-index: 1111;
      overflow-y: auto;
    }
    .sidenav.open {
      transform: translateX(0);
      box-shadow: 0px 0px 128px 8px rgba(0, 0, 0, 0.3);
    }
  }

</style>
