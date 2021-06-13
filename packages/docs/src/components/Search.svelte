<script>
  import slugify from "slugify";

  export let metaVariant;

  let query;
  let index;
  let results = [];

  const slug = (title) => slugify(title).toLowerCase();

  const sliceInput = (input, index, maxChars = 255) => {
    const start = Math.min(0, Math.abs(index - 27));
    const end = Math.min(input.length, index + maxChars - 27);
    return [
      start == 0 ? "" : "...",
      input.slice(start, end),
      end == input.length ? "" : "...",
    ].join("");
  };

  const highlight = (text, found) => {
    return text.replace(
      new RegExp(found, "g"),
      (substr) => `<span class="found">${substr}</span>`
    );
  };

  const isSamePage = (route) => {
    return window.location.pathname === "/" + route;
  };

  const formatResult = (match) => {
    const slice = sliceInput(match.input, match.index);
    const highlighted = highlight(slice, match[0]);
    return highlighted;
  };

  $: if (metaVariant) index = metaVariant.index;

  $: if (query && index) {
    const pattern = new RegExp(query.split(/\s+/i).join("|"), "i");
    results = Object.entries(index)
      .map(([route, { sections }]) => {
        const result = [];
        for (const { title, text } of sections) {
          const match = text.match(pattern);
          if (match) result.push({ title, route, match });
        }
        return result.length ? result : null;
      })
      .filter(Boolean)
      .flat();
  } else {
    results = [];
  }
</script>

<div class="search">
  <input placeholder="Search here" bind:value={query} />
  {#if results.length}
    <div class="results">
      {#each results as result}
        {#if isSamePage(result.route)}
          <a
            class="result"
            href="/{result.route}#{slug(result.title)}"
            data-tinro-ignore
          >
            <h4>{result.title}</h4>
            <div>
              {@html formatResult(result.match)}
            </div>
          </a>
        {:else}
          <a class="result" href="/{result.route}#{slug(result.title)}">
            <h4>{result.title}</h4>
            <div>
              {@html formatResult(result.match)}
            </div>
          </a>
        {/if}
      {/each}
    </div>
  {/if}
</div>

<style>
  .search {
    flex: 100;
    display: flex;
    position: relative;
    flex-direction: column;
  }
  .results {
    padding: 1em;
    position: absolute;
    top: 3.5em;
    background: #eee;
    border-radius: 4px;
    border: 1px solid rgba(0, 0, 0, 0.1);
    box-shadow: 0px 0px 32px 4px rgba(0, 0, 0, 0.3);
    width: 100%;
    box-sizing: border-box;
    display: none;
  }
  h4 {
    margin-bottom: 0.5em;
  }
  .result {
    text-decoration: none;
  }
  .result:not(:last-of-type) {
    margin-bottom: 1em;
    padding-bottom: 1em;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  }
  .result :global(.found) {
    color: #317dd5;
  }
  input {
    border: 1px solid rgba(0, 0, 0, 0.1);
    outline: none;
    background: transparent;
    padding: 1em;
    height: 100%;
    box-sizing: border-box;
    width: 100%;
    border-radius: 5px;
    flex: 1;
  }
  input:focus {
    box-shadow: 0px 0px 32px 4px rgba(0, 0, 0, 0.3);
  }
  .results:hover,
  .results:focus,
  input:focus + .results {
    display: flex;
    flex-direction: column;
  }
</style>
