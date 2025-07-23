/* ─────────────────────────────────────────────
   NAVIGATION & FAQ HELPERS (formerly inline)
   ──────────────────────────────────────────── */

import { showNotification, toggleMobileMenu } from '@/utils/ui.js';
import { goToProfile, loadProfileData } from '@/features/profile/profileData.js'; // create later

// keep track of auth state via global for now
const isLoggedIn = () => Boolean(window.currentUser);

/* ---------- page-switcher ---------- */
export function showPage(pageId) {
  if (pageId === 'profile' && !isLoggedIn()) {
    showNotification('Please sign in to view your profile');
    window.openModal?.('signin'); // legacy modal
    return;
  }

  // Hide all sections, then activate the requested one
  document
    .querySelectorAll('.page-section')
    .forEach((s) => s.classList.toggle('active', s.id === pageId));

  history.pushState(null, '', `#${pageId}`);
  window.scrollTo(0, 0);

  if (pageId === 'profile' && isLoggedIn()) loadProfileData();
}

/* ---------- delegated nav clicks ---------- */
export function initRouter() {
  document.addEventListener('click', (e) => {
    /* nav links (desktop + mobile) */
    const link = e.target.closest('[data-page]');
    if (link) {
      e.preventDefault();
      showPage(link.dataset.page);

      // ✅ close the hamburger only if the link lives inside the mobile menu
      const mobileMenu = document.getElementById('mobileMenu');
      if (mobileMenu?.classList.contains('active') && link.closest('#mobileMenu')) {
        toggleMobileMenu();
      }
      return;
    }

    /* -------- profile action -------- */
    const profileBtn = e.target.closest('[data-action="profile"]');
    if (profileBtn) {
      e.preventDefault();
      goToProfile();
      return;
    }

    /* FAQ accordion buttons */
    const faqBtn = e.target.closest('[data-faq-toggle]');
    if (faqBtn) {
      e.preventDefault();
      toggleFaq(faqBtn);
    }
  });

  /* restore page on refresh */
  const initial = location.hash.replace('#', '') || 'home';
  showPage(initial);
}

/* ---------- FAQ accordion ---------- */
function toggleFaq(buttonEl) {
  const faqItem = buttonEl.closest('.faq-item');
  const category = buttonEl.closest('.faq-category');

  // close all items in this category
  category.querySelectorAll('.faq-item').forEach((item) => item.classList.remove('active'));

  // toggle clicked item
  faqItem.classList.toggle('active');
}
