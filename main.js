/* F42 — main.js · shared utilities */

document.addEventListener('DOMContentLoaded', () => {
  // Inject today's date where needed
  const dateEl = document.getElementById('today-date');
  if (dateEl) {
    dateEl.textContent = new Date().toLocaleDateString('en-GB', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
  }

  // Staggered feed entry animation
  document.querySelectorAll('.feed-entry').forEach((el, i) => {
    el.style.animationDelay = `${i * 60}ms`;
  });
});
