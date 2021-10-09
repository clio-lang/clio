<div class="card">
  <div class="title">
    <slot name="title" />
  </div>
  <div class="body">
    <slot />
  </div>
</div>

<style>
  .card {
    box-shadow: 0px 0px 1px 1px rgba(0, 0, 0, 0.1);
    padding: 1.25em;
    border-radius: 5px;
    transition: all 0.2s cubic-bezier(0.445, 0.75, 0.55, 0.95);
    display: flex;
    flex-direction: column;
  }
  .card:hover {
    box-shadow: 0px 0px 32px 8px rgba(0, 0, 0, 0.3);
    transform: scale(1.02);
  }
  .title {
    font-size: 1.25em;
  }
  .body {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
</style>
