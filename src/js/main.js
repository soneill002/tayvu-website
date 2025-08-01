// src/js/main.js
import '@/legacyGlobals/currentUser.js'; // ← must be the very first import
import { setupGlobalErrorHandlers, handleError, withErrorHandling } from '@/utils/errorHandler.js'; // ← ADD THIS
import '../styles/base.css';
import '../styles/layout.css';
import '../styles/components.css';

// Initialize error handling first before anything else
setupGlobalErrorHandlers();

import { initRouter, showPage } from '@/router.js'; // alias in action
import { initSupabase } from '@/api/supabaseClient.js';
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

// Wrap goToCreateMemorial with error handling
window.goToCreateMemorial = withErrorHandling(function () {
  console.log('goToCreateMemorial called');
  console.log('Current user:', window.currentUser);
  console.log('Current hash:', window.location.hash);
  
  if (!window.currentUser) {
    console.log('User not authenticated, showing login modal');
    sessionStorage.setItem('redirectAfterLogin', 'createMemorial');
    openModal('signin');
    return;
  }
  
  // Clear any existing draft from localStorage to prevent auto-loading
  console.log('Clearing draft data');
  localStorage.removeItem('memorialDraft');
  localStorage.removeItem('currentDraftId');
  
  // Method 1: Try using the global showPage if available
  if (window.showPage && typeof window.showPage === 'function') {
    console.log('Using window.showPage');
    window.showPage('createMemorial');
  } 
  // Method 2: Use direct hash navigation as fallback
  else {
    console.log('Using hash navigation fallback');
    window.location.hash = '#createMemorial';
  }
}, 'Create Memorial Navigation');

// Initialize Supabase first, then everything else
async function initApp() {
  try {
    console.log('Starting app initialization...');
    
    // Initialize Supabase and wait for it
    const supabaseReady = await initSupabase();
    if (!supabaseReady) {
      console.error('Failed to initialize Supabase - check your environment variables');
      handleError(new Error('Supabase initialization failed'), 'App Initialization');
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
  } catch (error) {
    handleError(error, 'App Initialization');
    // Still try to show something to the user
    console.error('Critical initialization error:', error);
  }
}

// Start the app with error handling
initApp().catch(error => {
  handleError(error, 'App Startup');
  // Show a fallback UI if complete failure
  document.body.innerHTML = `
    <div style="text-align: center; padding: 50px; font-family: system-ui;">
      <h1>Unable to Load Application</h1>
      <p>We're experiencing technical difficulties. Please refresh the page or try again later.</p>
      <button onclick="location.reload()" style="padding: 10px 20px; margin-top: 20px; cursor: pointer;">
        Refresh Page
      </button>
    </div>
  `;
});

/* ── keep global links temporarily so legacy code still works ── */
window.showNotification = showNotification;
window.toggleMobileMenu = toggleMobileMenu;
window.showError = showError;
window.formatDate = formatDate;
window.qs = qs;