(() => {
  const screen = document.getElementById("loading-screen");
  if (!screen) return;

  const startedAt = performance.now();
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  let hidden = false;

  const hide = () => {
    if (hidden) return;
    hidden = true;
    const minimumTime = reducedMotion ? 100 : 1450;
    const elapsed = performance.now() - startedAt;
    window.setTimeout(() => {
      screen.classList.add("is-exiting");
      screen.setAttribute("aria-hidden", "true");
      window.setTimeout(() => screen.remove(), reducedMotion ? 120 : 520);
    }, Math.max(0, minimumTime - elapsed));
  };

  if (document.readyState === "complete") window.setTimeout(hide, 0);
  else window.addEventListener("load", hide, { once: true });
  window.setTimeout(hide, reducedMotion ? 700 : 4200);
})();
