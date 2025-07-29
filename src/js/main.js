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
  console.log('goToCreateMemorial called, currentUser:', window.currentUser);
  
  if (!window.currentUser) {
    sessionStorage.setItem('redirectAfterLogin', 'createMemorial');
    openModal('signin');
    return;
  }
  
  // Clear any existing draft from localStorage to prevent auto-loading
  // This prevents the "draft loaded" message from appearing
  localStorage.removeItem('memorialDraft');
  localStorage.removeItem('currentDraftId');
  
  // Force navigation by updating the hash
  const currentHash = window.location.hash;
  console.log('Current hash:', currentHash);
  
  // If we're already on createMemorial, force a refresh
  if (currentHash === '#createMemorial') {
    // Temporarily change hash to trigger navigation
    window.location.hash = '#temp';
    setTimeout(() => {
      window.location.hash = '#createMemorial';
    }, 10);
  } else {
    // Navigate to createMemorial
    window.location.hash = '#createMemorial';
  }
};

// Initialize Supabase first, then everything else
async function initApp() {
  console.log('Starting app initialization...');
  
  // Initialize Supabase and wait for it
  const supabaseReady = await initSupabase();
  if (!supabaseReady) {
    console.error('Failed to initialize Supabase - check your environment variables');
  }
  
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
  
  console.log('App initialization complete');
}

// Start the app
initApp();

/* ── keep global links temporarily so legacy code still works ── */
window.showNotification = showNotification;
window.toggleMobileMenu = toggleMobileMenu;
window.showError = showError;
window.formatDate = formatDate;
window.qs = qs;