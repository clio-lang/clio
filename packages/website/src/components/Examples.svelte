<script>
  import Card from "./Card.svelte";
</script>

<div class="title">
  <h2>Examples</h2>
</div>

<div class="examples">
  <div class="example">
    <Card>
      <h3 slot="title">Multi-threaded Mandelbrot</h3>
      <img src="/mandelbrot.png" alt="Mandelbrot" />
      <p>
        Mandelbrot set calculated in multiple threads and rendered into a
        canvas, notice how the rows are rendered one after another as soon as a
        thread yields the results for that row!
      </p>
      <div class="spacer" />
      <div class="actions">
        <a class="btn" href="https://clio-mandelbrot.vercel.app">
          View Example
        </a>
        <a
          class="btn"
          href="https://github.com/clio-lang/examples/tree/master/mandelbrot"
        >
          View Code
        </a>
      </div>
    </Card>
  </div>
  <div class="example">
    <Card>
      <h3 slot="title">Multi-threaded Game of Life</h3>
      <img src="/game-of-life.png" alt="Game of Life" />
      <p>
        A 128x128 game of life board running in multiple threads, watch how
        16384 cells born, live and die!
      </p>
      <div class="spacer" />
      <div class="actions">
        <a class="btn" href="https://clio-game-of-life.vercel.app">
          View Example
        </a>
        <a
          class="btn"
          href="https://github.com/clio-lang/examples/tree/master/game"
        >
          View Code
        </a>
      </div>
    </Card>
  </div>
  <div class="example">
    <Card>
      <h3 slot="title">Realtime Todo App</h3>
      <video src="/todo.mp4" autoplay loop muted playsinline>
        <track kind="captions" />
      </video>
      <p>
        Learn how to make a realtime, reactive todo app with Clio in just 20
        lines of server code and under 40 lines of client code!
      </p>
      <div class="spacer" />
      <div class="actions">
        <!--a class="btn" href="https://clio-game-of-life.vercel.app">
          Read More
        </a-->
        <a
          class="btn"
          href="https://github.com/clio-lang/examples/tree/master/todo"
        >
          View Code
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
  .examples {
    max-width: 1280px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    grid-auto-rows: 1fr;
    grid-column-gap: 1em;
    grid-row-gap: 1em;
    margin-bottom: 4em;
  }
  .example {
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
    gap: 2em;
    flex-wrap: wrap;
  }
  .btn {
    padding: 1em 2em;
    border-radius: 7px;
    color: rgb(33, 33, 33);
    text-decoration: none;
    background: #4f29f0;
    color: #fff;
    border-radius: 10px;
    box-shadow: 0px 0px 16px 1px rgb(0 0 0 / 40%);
    transition: cubic-bezier(0.39, 0.575, 0.565, 1) all 0.2s;
  }
  .btn:hover {
    transform: scale(1.1);
  }
  .spacer {
    flex: 1;
  }
  video,
  img {
    max-width: 100%;
    border-radius: 5px;
    box-shadow: 0px 0px 16px 1px rgb(0 0 0 / 40%);
    transition: cubic-bezier(0.39, 0.575, 0.565, 1) all 0.2s;
  }
  video:hover,
  img:hover {
    transform: scale(1.02);
  }
  @media (max-width: 960px) {
    .examples {
      padding: 1em;
      grid-template-columns: repeat(2, 1fr);
    }
  }
  @media (max-width: 640px) {
    .examples {
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
