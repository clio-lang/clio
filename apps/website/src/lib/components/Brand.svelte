<script lang="ts">
  let { compact = false }: { compact?: boolean } = $props();
</script>

<span class="brand" class:compact>
  <span class="mark" aria-hidden="true"></span>
  <span class="name">kalandra</span>
</span>

<style>
  .brand {
    display: inline-flex;
    align-items: center;
    gap: 11px;
    color: var(--foreground);
  }
  .mark {
    display: block;
    flex: none;
    width: 37px;
    height: 43px;
    background: currentColor;
    mask: url("/brand/kalandra-mark.svg") center / contain no-repeat;
  }
  .name {
    font-size: 26px;
    font-weight: 550;
    letter-spacing: -1.2px;
  }
  .compact .mark {
    width: 27px;
    height: 32px;
  }
  .compact .name {
    font-size: 21px;
  }
  @media (max-width: 520px) {
    .mark {
      width: 29px;
      height: 35px;
    }
    .name {
      font-size: 23px;
    }
    .brand {
      gap: 8px;
    }
  }
</style>
