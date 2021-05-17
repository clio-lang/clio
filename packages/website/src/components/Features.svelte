<script>
  import Card from "./Card.svelte";

</script>

<div class="title">
  <h2>Features</h2>
</div>

<div class="features">
  <div class="feature">
    <Card>
      <h3 slot="title">Distributed programming</h3>
      <p>
        Easily distribute your code to multiple processors and threads, use
        network resources, make your functions available over the network or
        import functions over the network with ease!
      </p>
      <div class="spacer" />
      <div class="actions">
        <a class="btn" href="https://docs.clio-lang.org/parallelism">
          Learn more
        </a>
      </div>
    </Card>
  </div>
  <div class="feature">
    <Card>
      <h3 slot="title">Noise-free and clean</h3>
      <p>
        Clio is a noise-free language and it comes with a clean and
        distraction-free syntax! Enjoy a neat minimal syntax that actually makes
        sense!
      </p>
      <div class="spacer" />
      <div class="actions">
        <a class="btn" href="https://github.com/clio-lang/examples">
          View examples
        </a>
      </div>
    </Card>
  </div>
  <div class="feature">
    <Card>
      <h3 slot="title">Compiles to JavaScript</h3>
      <p>
        Clio compiles to JavaScript, runs on top of Node.js and also in the
        browser. Import your existing JavaScript code into Clio and mix it with
        Clio's features to get a performance you've never experienced before!
      </p>
      <div class="spacer" />
      <div class="actions">
        <a class="btn" href="https://docs.clio-lang.org/install">
          Install now
        </a>
      </div>
    </Card>
  </div>
</div>

<style>
  h2 {
    color: rgb(204 42 64);
    font-size: 3em;
    margin-bottom: 1em;
  }
  h3 {
    margin-top: 0;
    font-family: "Raleway", sans-serif;
  }
  .title {
    max-width: 1280px;
    margin: 0 auto;
  }
  .features {
    max-width: 1280px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: 1fr;
    grid-column-gap: 1em;
    grid-row-gap: 1em;
    margin-bottom: 4em;
  }
  .feature {
    display: flex;
  }
  a:not(.btn) {
    color: rgb(33, 33, 33);
    border-bottom: 1px dotted rgba(33, 33, 33, 0.4);
    text-decoration: none;
    padding-bottom: 2px;
    margin-bottom: -3px;
    transition: cubic-bezier(0.23, 1, 0.32, 1) color 0.17s;
  }
  a:not(.btn):hover {
    color: rgb(204, 42, 64);
    border-bottom: 2px solid rgb(204, 42, 64);
    padding-bottom: 2px;
    margin-bottom: -4px;
  }
  p {
    font-size: 1.1em;
    color: #333;
  }
  .actions {
    display: flex;
    justify-content: flex-end;
    width: 100%;
  }
  .btn {
    padding: 1em 2em;
    border-radius: 7px;
    color: rgb(33, 33, 33);
    text-decoration: none;
    background: #4f29f0;
    color: #fff;
    border-radius: 2em;
    box-shadow: 0px 0px 16px 1px rgb(0 0 0 / 40%);
    transition: cubic-bezier(0.39, 0.575, 0.565, 1) all 0.2s;
  }
  .btn:hover {
    transform: scale(1.1);
  }
  .spacer {
    flex: 1;
  }
  @media (max-width: 960px) {
    .features {
      padding: 1em;
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 640px) {
    .features {
      padding: 1em;
      display: flex;
      flex-direction: column;
      margin-bottom: 1em;
    }
    .title {
      text-align: center;
    }
    h2 {
      margin: 0.5em;
    }
  }

</style>
