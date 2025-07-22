/**
 * Delegated nav & hash router.
 * Relies on the legacy global showPage(pageId) that already
 * toggles .active on .page-section elements.
 */
export function initRouter() {
  // Delegated clicks for any element carrying data-page
  document.addEventListener('click', (e) => {
    const link = e.target.closest('[data-page]');
    if (!link) return;
    e.preventDefault();
    const page = link.dataset.page;
    window.showPage?.(page);          // call the global version
  });

  // Restore view on hard-refresh / direct hash
  const initial = location.hash.replace('#', '') || 'home';
  window.showPage?.(initial);
}
