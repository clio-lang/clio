<script lang="ts">
  import { onMount } from "svelte";

  let canvas: HTMLCanvasElement;
  let paused = $state(false);
  let reducedMotion = $state(false);
  let refresh: (() => void) | undefined;

  onMount(() => {
    const context = canvas.getContext("2d");
    const hero = canvas.closest("section");
    if (!context || !hero) return;
    const motion = matchMedia("(prefers-reduced-motion: reduce)");
    let width = 0,
      height = 0,
      frame = 0,
      last = 0,
      elapsed = 0;
    let visible = true;
    let pointer = { x: -1000, y: -1000 };
    let dark = document.documentElement.classList.contains("dark");
    // A deterministic cloud follows a shared flow, with individual depth and drift.
    // There are no edges: the moving particles themselves describe the swarm.
    const noise = (seed: number) => {
      const n = Math.sin(seed * 127.1 + 311.7) * 43758.5453;
      return n - Math.floor(n);
    };
    const particles = Array.from({ length: 1000 }, (_, i) => ({
      phase: noise(i + 1),
      spread: noise(i + 20) + noise(i + 200) - 1,
      depth: noise(i + 400),
      lane: i % 3,
      dx: 0,
      dy: 0,
    }));

    function draw() {
      if (!context || !width || !height) return;
      context.clearRect(0, 0, width, height);
      const time = reducedMotion ? 0 : elapsed / 1000;
      const count = width < 600 ? 600 : particles.length;
      for (let i = 0; i < count; i++) {
        const particle = particles[i];
        const u =
          (particle.phase + time * (0.014 + particle.depth * 0.005)) % 1;
        const angle = u * Math.PI * 2;
        const wave = Math.sin(angle + time * 0.16 + particle.lane * 0.65);
        const fold = Math.cos(angle * 2 - time * 0.12);
        const x = u * (width + 160) - 80;
        const center = height * (0.49 + 0.34 * wave);
        const spread = (22 + 32 * (1 + fold)) * particle.spread;
        const y =
          center +
          spread +
          (particle.lane - 1) * 18 * Math.sin(angle + time * 0.22);
        const vx = x - pointer.x,
          vy = y - pointer.y;
        const distance = Math.hypot(vx, vy);
        const force = Math.max(0, 1 - distance / 160);
        const targetX = distance > 0 ? (vx / distance) * force * 55 : 0;
        const targetY = distance > 0 ? (vy / distance) * force * 55 : 0;
        if (!paused && !reducedMotion) {
          particle.dx += (targetX - particle.dx) * 0.075;
          particle.dy += (targetY - particle.dy) * 0.075;
        }
        // Quiet the cloud beneath the introduction so its text remains legible.
        const textZone =
          x < width * 0.43 && y > height * 0.24 && y < height * 0.74;
        const opacity = (0.2 + particle.depth * 0.55) * (textZone ? 0.28 : 1);
        const color = dark
          ? particle.lane === 0
            ? "143, 159, 246"
            : particle.lane === 1
              ? "115, 203, 222"
              : "190, 171, 245"
          : particle.lane === 0
            ? "83, 75, 170"
            : particle.lane === 1
              ? "26, 113, 139"
              : "125, 71, 162";
        const px = x + particle.dx,
          py = y + particle.dy;
        const radius = 0.55 + particle.depth * 0.85;
        if (particle.depth > 0.88) {
          context.fillStyle = `rgba(${color},${opacity * 0.08})`;
          context.beginPath();
          context.arc(px, py, radius * 4, 0, Math.PI * 2);
          context.fill();
        }
        context.fillStyle = `rgba(${color},${opacity})`;
        context.beginPath();
        context.arc(px, py, radius, 0, Math.PI * 2);
        context.fill();
      }
    }
    function tick(now: number) {
      if (now - last >= 1000 / 30) {
        elapsed += last ? Math.min(now - last, 80) : 0;
        last = now;
        draw();
      }
      frame = requestAnimationFrame(tick);
    }
    function sync() {
      cancelAnimationFrame(frame);
      last = 0;
      draw();
      if (!paused && !reducedMotion && visible && !document.hidden)
        frame = requestAnimationFrame(tick);
    }
    refresh = sync;
    function resize() {
      const rect = canvas.getBoundingClientRect();
      width = rect.width;
      height = rect.height;
      const ratio = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      context!.setTransform(ratio, 0, 0, ratio, 0, 0);
      sync();
    }
    function move(event: PointerEvent) {
      if (reducedMotion || paused || event.pointerType === "touch") return;
      const rect = canvas.getBoundingClientRect();
      pointer = { x: event.clientX - rect.left, y: event.clientY - rect.top };
    }
    function leave() {
      pointer = { x: -1000, y: -1000 };
    }
    function motionChanged() {
      reducedMotion = motion.matches;
      leave();
      sync();
    }
    const resizeObserver = new ResizeObserver(resize);
    const intersection = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      sync();
    });
    const theme = new MutationObserver(() => {
      dark = document.documentElement.classList.contains("dark");
      draw();
    });
    resizeObserver.observe(canvas);
    intersection.observe(hero);
    theme.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    hero.addEventListener("pointermove", move);
    hero.addEventListener("pointerleave", leave);
    document.addEventListener("visibilitychange", sync);
    motion.addEventListener("change", motionChanged);
    motionChanged();
    resize();
    return () => {
      cancelAnimationFrame(frame);
      refresh = undefined;
      resizeObserver.disconnect();
      intersection.disconnect();
      theme.disconnect();
      hero.removeEventListener("pointermove", move);
      hero.removeEventListener("pointerleave", leave);
      document.removeEventListener("visibilitychange", sync);
      motion.removeEventListener("change", motionChanged);
    };
  });
</script>

<canvas bind:this={canvas} aria-hidden="true"></canvas>
{#if !reducedMotion}
  <button
    class="background-toggle"
    aria-pressed={paused}
    onclick={() => {
      paused = !paused;
      refresh?.();
    }}
  >
    {paused ? "Resume background" : "Pause background"}
  </button>
{/if}

<style>
  canvas {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
    z-index: -1;
    mask-image: linear-gradient(
      to bottom,
      transparent,
      black 9%,
      black 91%,
      transparent
    );
  }
  .background-toggle {
    position: absolute;
    bottom: 16px;
    left: 32px;
    font: 11px var(--font-sans);
    color: var(--muted-foreground);
    background: var(--background);
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 4px 8px;
    cursor: pointer;
  }
  .background-toggle:hover {
    color: var(--foreground);
  }
  .background-toggle:focus-visible {
    outline: 2px solid var(--ring);
    outline-offset: 3px;
  }
</style>
