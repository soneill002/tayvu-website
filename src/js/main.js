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
  console.log('Starting app initialization...');
  
  // Initialize Supabase and wait for it
  const supabaseReady = await initSupabase();
  if (!supabaseReady) {
    console.error('Failed to initialize Supabase - check your environment variables');
  }
  
  // Then initialize everything else
  initRouter();
  // Safety check to ensure proper page visibility
document.addEventListener('DOMContentLoaded', () => {
  // Hide all pages except the current one
  const currentHash = window.location.hash.slice(1) || 'home';
  document.querySelectorAll('.page-section').forEach(section => {
    if (section.id === currentHash) {
      section.classList.add('active');
      section.style.display = 'block';
    } else {
      section.classList.remove('active');
      section.style.display = 'none';
    }
  });
});
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


// Blog post click handler
window.openBlogPost = function(postId) {
  // Hide blog grid, show single post view
  const blogSection = document.getElementById('blog');
  const blogPostSection = document.getElementById('blogPost');
  
  if (blogSection) blogSection.classList.remove('active');
  if (blogPostSection) blogPostSection.classList.add('active');
  
  // Update URL
  window.location.hash = '#blogPost';
  
  // Here you would normally load the specific blog post content
  // For now, just show a placeholder
  const singlePostContent = document.getElementById('singlePostContent');
  if (singlePostContent) {
    singlePostContent.innerHTML = `
      <div class="single-post">
        <h1 class="single-post-title">Loading post...</h1>
        <p>Blog post ${postId} content would load here.</p>
      </div>
    `;
  }
};

// Delegate click events for blog posts
document.addEventListener('click', (e) => {
  const blogCard = e.target.closest('.blog-post-card');
  if (blogCard) {
    e.preventDefault();
    const postId = blogCard.dataset.postId || 'default';
    window.openBlogPost(postId);
  }
});

// Temporary blog posts for testing
window.addEventListener('DOMContentLoaded', () => {
  setTimeout(() => {
    const blogGrid = document.getElementById('blogGrid');
    if (blogGrid && blogGrid.children.length === 0) {
      // Add some test blog posts
      blogGrid.innerHTML = `
        <article class="blog-post-card" data-post-id="1">
          <img src="https://images.unsplash.com/photo-1516589091380-5d8e87df6999?w=400&h=200&fit=crop" 
               alt="Memorial Traditions" class="blog-post-image">
          <div class="blog-post-content">
            <span class="blog-post-category">Guidance</span>
            <h3 class="blog-post-title">Creating Meaningful Digital Memorials</h3>
            <p class="blog-post-excerpt">Learn how to create a lasting tribute that honors your loved one's memory...</p>
            <div class="blog-post-meta">
              <span class="blog-post-author">By Sarah Johnson</span>
              <span class="blog-post-date">Dec 15, 2023</span>
            </div>
          </div>
        </article>
      `;
      
      // Hide loading, show grid
      const blogLoading = document.getElementById('blogLoading');
      if (blogLoading) blogLoading.style.display = 'none';
      if (blogGrid) blogGrid.style.display = 'grid';
    }
  }, 1000);
});


/* ── keep global links temporarily so legacy code still works ── */
window.showNotification = showNotification;
window.toggleMobileMenu = toggleMobileMenu;
window.showError = showError;
window.formatDate = formatDate;
window.qs = qs;