<div class="footer">
  <div class="links">
    <div class="section">
      <h3>Social</h3>
      <a href="https://t.me/joinchat/B0kZo0kVldcBimGD4NLfVw"> Telegram </a>
      <a href="https://forum.clio-lang.org/"> Forums </a>
      <a href="https://twitter.com/clio_lang"> Twitter </a>
      <a href="https://www.reddit.com/r/cliolang/"> Reddit </a>
    </div>
    <div class="section">
      <h3>Resources</h3>
      <a href="https://docs.clio-lang.org"> Docs </a>
      <a href="https://playground.clio-lang.org"> Playground </a>
      <a href="https://medium.com/@pouyae"> Medium </a>
      <a href="http://rosettacode.org/wiki/Clio"> Rosetta Code </a>
      <a href="https://github.com/clio-lang/clio"> Source </a>
    </div>
  </div>
  <footer>
    Clio is released under Apache licence version 2.0, this website and all
    related content have the same licencing terms.
  </footer>
</div>

<style>
  .footer {
    display: flex;
    align-items: center;
    padding: 1em;
    border-top: 1px solid rgba(0, 0, 0, 0.1);
    flex-direction: column;
  }
  .section {
    display: flex;
    flex-direction: column;
    padding: 1em;
  }
  footer,
  .links {
    max-width: 1280px;
    width: 100%;
  }
  .links {
    display: flex;
    flex-wrap: wrap;
    gap: 2em;
    margin-bottom: 2em;
  }
  a {
    color: rgb(33, 33, 33);
    border-bottom: 1px dotted rgba(33, 33, 33, 0.4);
    text-decoration: none;
    padding-bottom: 2px;
    margin-bottom: 0.5em;
    transition: cubic-bezier(0.23, 1, 0.32, 1) color 0.17s;
    display: inline-block;
    align-self: flex-start;
  }
  a:hover {
    color: rgb(204, 42, 64);
    border-bottom: 2px solid rgb(204, 42, 64);
    padding-bottom: 2px;
    margin-bottom: calc(0.5em - 1px);
  }
</style>
