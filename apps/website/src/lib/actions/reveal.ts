/** Reveal content groups when they enter the reading area, not the whole section. */
export function reveal(node: HTMLElement) {
  const preference = matchMedia("(prefers-reduced-motion: reduce)");
  const animations = new Set<Animation>();
  const pending = new Set<HTMLElement>();
  const targets = Array.from(node.children).flatMap((child) => {
    if (child.matches(".overview-grid, .lesson-list, .runtime-list"))
      return Array.from(child.children) as HTMLElement[];
    return [child as HTMLElement];
  });
  const observer = new IntersectionObserver(
    (entries) => {
      let stagger = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const element = entry.target as HTMLElement;
        observer.unobserve(element);
        if (!pending.delete(element)) continue;
        element.style.removeProperty("opacity");
        if (preference.matches) continue;
        const animation = element.animate(
          [
            { opacity: 0, transform: "translateY(32px)" },
            { opacity: 1, transform: "translateY(0)" },
          ],
          {
            duration: 750,
            delay: stagger++ * 80,
            easing: "cubic-bezier(0.16, 1, 0.3, 1)",
            fill: "backwards",
          },
        );
        animations.add(animation);
        animation.finished
          .then(() => animations.delete(animation))
          .catch(() => {});
      }
    },
    { rootMargin: "0px 0px -70px 0px", threshold: 0 },
  );

  for (const target of targets) {
    // Don't hide content already on screen (including direct anchor navigation).
    if (
      preference.matches ||
      target.getBoundingClientRect().top < innerHeight - 70
    )
      continue;
    target.style.opacity = "0";
    pending.add(target);
    observer.observe(target);
  }
  function showAll() {
    observer.disconnect();
    for (const target of pending) target.style.removeProperty("opacity");
    pending.clear();
    for (const animation of animations) animation.cancel();
    animations.clear();
  }
  function motionChanged() {
    if (preference.matches) showAll();
  }
  preference.addEventListener("change", motionChanged);
  node.addEventListener("focusin", showAll);
  return {
    destroy() {
      showAll();
      preference.removeEventListener("change", motionChanged);
      node.removeEventListener("focusin", showAll);
    },
  };
}
