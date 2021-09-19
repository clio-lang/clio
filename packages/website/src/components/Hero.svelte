<div class="hero">
  <div class="logo">
    <img src="/logo-512x512.png" alt="Clio" />
  </div>
  <div class="body">
    <div class="motto">
      Clio is a fast, distributed, functional programming language!
    </div>

    <div class="install">
      Looking for the installation guide?
      <a
        class="btn"
        href="https://docs.clio-lang.org/versions/develop/install.html"
      >
        Get started now
      </a>
    </div>

    <div class="learn-more">
      Visit our
      <a href="https://docs.clio-lang.org/versions/develop/tutorial/index.html"
        >tutorial page</a
      >
      to learn Clio, or read the
      <a href="https://docs.clio-lang.org">documentation</a>
      to learn more.
    </div>
  </div>
</div>

<style>
  .motto {
    font-size: 2em;
    padding: 1em;
    padding-bottom: 0;
    font-family: "Raleway", sans-serif;
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
  .learn-more {
    padding: 2em;
    padding-top: 0;
    font-size: 1.1em;
  }
  .install {
    font-size: 1.1em;
    padding: 2em;
    display: flex;
    gap: 2em;
    align-items: center;
    flex-wrap: wrap;
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
    display: inline-block;
  }
  .btn:hover {
    transform: scale(1.1);
  }
  .hero {
    display: flex;
    max-width: 1280px;
    margin: 4em auto;
    align-items: center;
    flex-wrap: wrap;
  }
  .logo img {
    height: 210px;
    border-radius: 7px;
  }
  @media (max-width: 640px) {
    .install,
    .hero {
      justify-content: center;
      text-align: center;
      margin-bottom: 0;
    }
    .learn-more {
      line-height: 2em;
      padding-bottom: 0;
    }
  }
</style>
