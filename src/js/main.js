
// src/js/main.js
import '@/legacyGlobals/currentUser.js'; // ← must be the very first import
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/components.css';
import { initRouter, showPage } from '@/router.js'; // alias in action
import { initSupabase } from '@/api/supabaseClient.js'; // ADD THIS IMPORT
import { initAuthUI } from '@/auth/authUI.js';
import { showNotification, toggleMobileMenu, showError, formatDate, qs } from '@/utils/ui.js';
import { initWizard } from '@/features/memorials/wizard.js';
import { initMomentsBoard } from '@/features/memorials/moments.js';
import { initGuestbook } from '@/features/guestbook.js';
import { initProfilePage } from '@/features/profile/profileUI.js';
import { initExampleMemorial } from '@/features/memorials/exampleMemorial.js';
import { initPricing } from '@/features/pricing/pricing.js';
import { initScrollFade } from '@/utils/animations.js';
import { openModal } from '@/utils/modal.js';

import '@/dom/pageEnhancements.js'; // side-effect import

window.goToCreateMemorial = function () {
  if (!window.currentUser) {
    openModal('signin');
    return;
  }
  showPage('createMemorial'); // switch section
  initWizard(); // reset wizard state
};

// Initialize Supabase first, then everything else
async function initApp() {
  // Initialize Supabase and wait for it
  await initSupabase();
  
  // Then initialize everything else
  initRouter();
  initAuthUI();

  /* feature boosts */
  initWizard();
  initMomentsBoard();
  initGuestbook();
  initProfilePage();
  initExampleMemorial();
  initPricing();
  initScrollFade();
}

// Start the app
initApp();

/* ── keep global links temporarily so legacy code still works ── */
window.showNotification = showNotification;
window.toggleMobileMenu = toggleMobileMenu;
window.showError = showError;
window.formatDate = formatDate;
window.qs = qs;