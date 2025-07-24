/*  src/js/router.js
    Navigation, mobile-menu toggle, FAQ, modal delegation
-------------------------------------------------------------------------- */
import { initBlog } from '@/features/blog/blog.js';
import { showNotification, toggleMobileMenu } from '@/utils/ui.js';
import { openModal, closeModal } from '@/utils/modal.js';
import { goToProfile, loadProfileData } from '@/features/profile/profileData.js';

/* simple auth helper (window.currentUser is populated by initSupabase) */
const isLoggedIn = () => Boolean(window.currentUser);

/* ──────────────────────────────────────────
   PAGE SWITCHER
   ────────────────────────────────────────── */
export function showPage(pageId, { skipPush = false } = {}) {
  /* gate-keep the profile page */
  if (pageId === 'profile' && !isLoggedIn()) {
    showNotification('Please sign in to view your profile');
    openModal('signin');
    return;
  }

  /* show / hide page sections */
  document
    .querySelectorAll('.page-section')
    .forEach((s) => s.classList.toggle('active', s.id === pageId));

  /* update URL & scroll position (unless instructed not to) */
  if (!skipPush) history.pushState(null, '', `#${pageId}`);
  window.scrollTo(0, 0);

  /* lazy-load profile data when needed */
  if (pageId === 'profile' && isLoggedIn()) loadProfileData();
  
  /* ===== ADD THESE 2 LINES ===== */
  /* lazy-load blog data when needed */
  if (pageId === 'blog') initBlog();
}

/* ──────────────────────────────────────────
   GLOBAL CLICK DELEGATION
   ────────────────────────────────────────── */
export function initRouter() {
  document.addEventListener('click', (e) => {
    /* ---------- nav links ---------- */
    const link = e.target.closest('[data-page]');
    if (link) {
      e.preventDefault();
      showPage(link.dataset.page); // normal push
      const mobileMenu = document.getElementById('mobileMenu');
      if (mobileMenu?.classList.contains('active') && link.closest('#mobileMenu')) {
        toggleMobileMenu();
      }
      return;
    }

    /* ---------- open / close modals ---------- */
    const opener = e.target.closest('[data-modal]');
    if (opener) {
      e.preventDefault();
      openModal(opener.dataset.modal);
      return;
    }

    const closer = e.target.closest('[data-modal-close]');
    if (closer) {
      e.preventDefault();
      closeModal(closer.dataset.modalClose);
      return;
    }

    /* ---------- profile button ---------- */
    const profileBtn = e.target.closest('[data-action="profile"]');
    if (profileBtn) {
      e.preventDefault();
      goToProfile();
      return;
    }

    /* ---------- FAQ accordion ---------- */
    const faqBtn = e.target.closest('[data-faq-toggle]');
    if (faqBtn) {
      e.preventDefault();
      toggleFaq(faqBtn);
    }
  });

  /* — back / forward browser buttons — */
  window.addEventListener('popstate', () => {
    const page = location.hash.slice(1) || 'home';
    showPage(page, { skipPush: true }); // ⚠️  don’t push again
  });

  /* — initial render on first load — */
  const initial = location.hash.slice(1) || 'home';
  showPage(initial, { skipPush: true });
}

/* ──────────────────────────────────────────
   FAQ ACCORDION (open + close)
   ────────────────────────────────────────── */
function toggleFaq(btn) {
  const item = btn.closest('.faq-item');
  const category = btn.closest('.faq-category');
  const wasOpen = item.classList.contains('active'); // remember state

  /* close ALL items first */
  category.querySelectorAll('.faq-item').forEach((i) => i.classList.remove('active'));

  /* reopen only if it wasn’t already open */
  if (!wasOpen) item.classList.add('active');
}
