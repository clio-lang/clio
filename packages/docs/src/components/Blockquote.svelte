<blockquote>
  <slot />
</blockquote>

<style>
  blockquote {
    width: 100%;
    margin: 1em auto;
    font-style: italic;
    color: #555555;
    padding: 1.2em 3em 1.2em 4em;
    border-left: 8px solid #78c0a8;
    line-height: 1.6;
    position: relative;
    background: #ddd;
    box-sizing: border-box;
    border-radius: 4px;
  }

  blockquote::before {
    font-family: "Ubuntu";
    content: "\201C";
    color: #78c0a8;
    font-size: 4em;
    position: absolute;
    left: 10px;
    top: -10px;
  }

  blockquote::after {
    content: "";
  }

</style>
