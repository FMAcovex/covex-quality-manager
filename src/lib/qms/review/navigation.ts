const highlightTimers = new WeakMap<HTMLElement, number>();

export function navigateToReviewTarget(href: string, anchorId: string) {
  const destination = new URL(href, window.location.href);
  if (destination.href === window.location.href) return highlightReviewTarget(anchorId);
  // A field link must expose the requested server tab, not a stale RSC tree
  // left by a preceding mutation or drawer navigation.
  window.location.assign(destination.href);
}

export function highlightReviewTarget(anchorId: string) {
  const element = document.getElementById(anchorId);
  if (!element?.classList.contains("review-target")) return;
  const previous = highlightTimers.get(element);
  if (previous !== undefined) window.clearTimeout(previous);
  const frame = requestAnimationFrame(() => {
    element.scrollIntoView({ behavior: "smooth", block: "center" });
    element.classList.add("review-target-highlight");
    element.setAttribute("tabindex", "-1");
    element.focus({ preventScroll: true });
  });
  const timeout = window.setTimeout(() => {
    if (highlightTimers.get(element) !== timeout) return;
    element.classList.remove("review-target-highlight");
    highlightTimers.delete(element);
  }, 3000);
  highlightTimers.set(element, timeout);
  return () => {
    cancelAnimationFrame(frame);
    if (highlightTimers.get(element) !== timeout) return;
    window.clearTimeout(timeout);
    element.classList.remove("review-target-highlight");
    highlightTimers.delete(element);
  };
}
