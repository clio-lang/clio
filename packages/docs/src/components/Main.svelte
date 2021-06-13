<script>
  import { meta } from "tinro/cmp/index";
  import dynamicImport from "../imports";

  export let metaVariant;
  export let currentVariant;
  export let sections;

  let getRoute;

  const setGetRoute = (variant) => {
    if (variant)
      dynamicImport(`./meta/${variant}.js`)
        .then((data) => data.default)
        .then((fn) => (getRoute = fn));
  };

  $: setGetRoute(currentVariant);

  const setComponent = async (route) => {
    const pathname = route.url.replace(/#.*$/, "").replace(/\/$/, "");
    const url = pathname.match(/^\/v\d+(\.\d+){2}/)
      ? pathname.slice(1)
      : currentVariant + pathname;
    const { filename } = metaVariant.routes[url];
    const module = await getRoute(filename);
    component = module.default;
  };

  const route = meta();

  let component;
  $: if (metaVariant && getRoute) setComponent($route);
</script>

<main>
  {#if metaVariant && component}
    <svelte:component this={component} bind:sections />
  {/if}
</main>

<style>
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
  @media (max-width: 768px) {
    main {
      padding: 1em;
    }
  }
</style>
