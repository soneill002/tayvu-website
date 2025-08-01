/* src/js/router.js - Fixed version */
import { initBlog } from '@/features/blog/blog.js';
import { initFAQ } from '@/features/faq/faq.js';
import { initMemorialView, cleanupMemorialView } from '@/features/memorials/memorialView.js';
import { qs } from '@/utils/ui.js';

/* ──────────────────────────────────────────
   ROUTE CONFIGURATION
   ────────────────────────────────────────── */
const routes = {
  home: {
    title: 'GatherMemorials - Create Beautiful Online Memorials',
    requiresAuth: false
  },
  about: {
    title: 'About Us - GatherMemorials',
    requiresAuth: false
  },
  createMemorial: {
    title: 'Create Memorial - GatherMemorials',
    requiresAuth: true,
    authMessage: 'Please sign in to create a memorial',
    init: () => {
      // Import and initialize the wizard when the page is shown
      import('@/features/memorials/wizard.js').then(({ initWizard }) => {
        console.log('Initializing wizard from router');
        initWizard();
      });
    }
  },
  profile: {
    title: 'My Profile - GatherMemorials',
    requiresAuth: true,
    authMessage: 'Please sign in to view your profile'
  },
  blog: {
    title: 'Blog - GatherMemorials',
    requiresAuth: false,
    init: initBlog
  },
  blogPost: {
    title: 'Blog Post - GatherMemorials',
    requiresAuth: false
  },
  pricing: {
    title: 'Pricing - GatherMemorials',
    requiresAuth: false
  },
  faq: {
    title: 'FAQ - GatherMemorials',
    requiresAuth: false,
    init: initFAQ
  },
  contact: {
    title: 'Contact Us - GatherMemorials',
    requiresAuth: false
  },
  privacy: {
    title: 'Privacy Policy - GatherMemorials',
    requiresAuth: false
  },
  terms: {
    title: 'Terms of Service - GatherMemorials',
    requiresAuth: false
  },
  exampleMemorial: {
    title: 'Example Memorial - GatherMemorials',
    requiresAuth: false
  }
};

/* ──────────────────────────────────────────
   STATE
   ────────────────────────────────────────── */
let currentPage = null;
let previousPage = null;

/* ──────────────────────────────────────────
   PUBLIC API
   ────────────────────────────────────────── */
export function initRouter() {
  console.log('Initializing router...');
  
  // Handle hash changes
  window.addEventListener('hashchange', handleRouteChange);
  
  // Handle initial load
  handleRouteChange();
  
  // Handle browser back/forward buttons
  window.addEventListener('popstate', handleRouteChange);
  
  // Add click handler for navigation links
  document.addEventListener('click', handleNavigationClick);
  
  // ADD THIS: Handler for data-page buttons
  document.addEventListener('click', handleDataPageClick);
}

/* ──────────────────────────────────────────
   NAVIGATION CLICK HANDLER
   ────────────────────────────────────────── */
function handleNavigationClick(e) {
  // Check if clicked element or its parent is a navigation link
  const link = e.target.closest('a[href^="#"]');
  
  if (link) {
    const href = link.getAttribute('href');
    const page = href.slice(1); // Remove #
    
    // List of routes that should be handled by the router
    const routerPages = Object.keys(routes);
    
    // Check if this is a router page
    if (routerPages.includes(page) || page === '' || page === 'home') {
      // Let the hashchange event handle it - no need to prevent default
      console.log('Navigation click to:', page || 'home');
    }
  }
}

/* ──────────────────────────────────────────
   DATA-PAGE CLICK HANDLER (NEW)
   ────────────────────────────────────────── */
function handleDataPageClick(e) {
  // Check if clicked element or its parent has data-page attribute
  const element = e.target.closest('[data-page]');
  
  if (element) {
    e.preventDefault();
    const page = element.getAttribute('data-page');
    
    console.log('Data-page click detected:', page);
    
    // Navigate to the page
    if (page) {
      // Update the URL hash
      window.location.hash = `#${page}`;
      // The hashchange event will handle showing the page
    }
  }
}

function showPageLoading() {
  // Create or show loading overlay
  let overlay = qs('#pageLoadingOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'pageLoadingOverlay';
    overlay.innerHTML = `
      <div class="page-loading">
        <div class="loading-spinner">
          <i class="fas fa-spinner fa-spin"></i>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
  }
  overlay.style.display = 'flex';
}

function hidePageLoading() {
  const overlay = qs('#pageLoadingOverlay');
  if (overlay) {
    overlay.style.display = 'none';
  }
}

function showPage(page) {
  console.log('showPage called with:', page);
  
  // Show loading overlay
  showPageLoading();  // ADD THIS
  
  // Small delay to show loading state
  setTimeout(() => {  // ADD THIS
    try {  // ADD THIS
      // Update previous page
      previousPage = currentPage;
      currentPage = page;
      
      // Check if page exists in routes
      const route = routes[page];
      if (!route) {
        console.error(`Route not found: ${page}`);
        showPage('home');
        return;
      }
      
      // Check authentication
      if (route.requiresAuth && !window.currentUser) {
        console.log('Authentication required for:', page);
        // Store intended destination
        sessionStorage.setItem('redirectAfterLogin', page);
        // Show auth modal
        import('@/utils/modal.js').then(({ openModal }) => {
          openModal('signin');
        });
        // Show notification
        import('@/utils/ui.js').then(({ showNotification }) => {
          showNotification(route.authMessage || 'Please sign in to continue', 'info');
        });
        hidePageLoading();  // ADD THIS - Hide loading on auth redirect
        return;
      }
      
      // Update page title
      document.title = route.title || 'GatherMemorials';
      
      // Hide all sections first
      hideAllSections();
      
      // Get the section element
      const section = document.getElementById(page);
      if (section) {
        // Clear any previous state for createMemorial page
        if (page === 'createMemorial') {
          // Remove any existing draft indicators when navigating fresh
          const draftIndicators = section.querySelectorAll('.draft-loaded-indicator');
          draftIndicators.forEach(indicator => indicator.remove());
        }
        
        // Show the section
        section.classList.add('active');
        section.style.display = 'block';
        
        // Scroll to top
        window.scrollTo(0, 0);
        
        // Call init function if available
        if (route.init) {
          // Small delay to ensure DOM is ready
          setTimeout(() => {
            route.init();
            hidePageLoading();  // ADD THIS - Hide after init
          }, 100);
        } else {
          hidePageLoading();  // ADD THIS - Hide if no init
        }
        
        // Update active nav items
        updateActiveNavItems(page);
        
        // Close mobile menu if open
        closeMobileMenu();
        
        // Track page view (analytics)
        trackPageView(page);
        
        console.log('Page shown:', page);
      } else {
        console.error(`Section not found: ${page}`);
        hidePageLoading();  // ADD THIS
        showPage('home');
      }
    } catch (error) {  // ADD THIS
      console.error('Error showing page:', error);
      hidePageLoading();
    }
  }, 50);  // ADD THIS - 50ms delay to show loading
}

/* ──────────────────────────────────────────
   MEMORIAL ROUTING
   ────────────────────────────────────────── */
function showMemorialPage(page) {
  const memorialId = page.split('/')[1];
  
  if (!memorialId) {
    showPage('home');
    return;
  }
  
  // Clean up previous memorial view if any
  if (currentPage && currentPage.startsWith('memorial/')) {
    cleanupMemorialView();
  }
  
  // Update page title (will be updated again once memorial loads)
  document.title = 'Loading Memorial... - GatherMemorials';
  
  // Hide all sections
  hideAllSections();
  
  // Show memorial view section
  let memorialSection = document.getElementById('memorialView');
  if (!memorialSection) {
    // Create memorial section if it doesn't exist
    memorialSection = createMemorialSection();
  }
  
  // Add active class to show the section
  memorialSection.classList.add('active');
  memorialSection.style.display = 'block';
  
  currentPage = page;
  
  // Initialize memorial view
  initMemorialView(memorialId);
  
  // Update nav (no nav item for individual memorials)
  updateActiveNavItems('');
  
  // Track memorial view
  trackPageView(`memorial/${memorialId}`);
}

/* ──────────────────────────────────────────
   BLOG POST ROUTING
   ────────────────────────────────────────── */
function showBlogPost(page) {
  const postSlug = page.split('/')[1];
  
  if (!postSlug) {
    showPage('blog');
    return;
  }
  
  // Hide all sections
  hideAllSections();
  
  // Show the blogPost section (not blog section!)
  const blogPostSection = document.getElementById('blogPost');  // ✅ CORRECT - This gets the blog post section!
  if (blogPostSection) {
    blogPostSection.classList.add('active');
    blogPostSection.style.display = 'block';
  }
  
  currentPage = page;
  
  // Let blog module handle the specific post
  import('@/features/blog/blog.js').then(({ showBlogPost }) => {
    showBlogPost(postSlug);
  });
  
  updateActiveNavItems('blog');
}

/* ──────────────────────────────────────────
   ROUTE CHANGE HANDLER - UPDATED WITH AUTH CALLBACK
   ────────────────────────────────────────── */
function handleRouteChange() {
  const hash = window.location.hash.slice(1); // Remove #
  
  // CHECK FOR AUTH CALLBACK TOKENS FIRST
  if (hash.includes('access_token=')) {
    handleAuthCallback();
    return;
  }
  
  const page = hash || 'home';
  
  console.log('Route change detected:', page);
  
  // Handle special routes
  if (page.startsWith('memorial/')) {
    showMemorialPage(page);
    return;
  }
  
  if (page.startsWith('blog/')) {
    showBlogPost(page);
    return;
  }
  
  // Handle query parameters if any
  const [pageName, ...params] = page.split('?');
  
  showPage(pageName);
  
  // Handle post-login redirect
  if (window.currentUser && sessionStorage.getItem('redirectAfterLogin')) {
    const redirect = sessionStorage.getItem('redirectAfterLogin');
    sessionStorage.removeItem('redirectAfterLogin');
    
    // Small delay to ensure auth state is fully updated
    setTimeout(() => {
      showPage(redirect);
    }, 100);
  }
}

/* ──────────────────────────────────────────
   AUTH CALLBACK HANDLER - NEW FUNCTION
   ────────────────────────────────────────── */
async function handleAuthCallback() {
  console.log('Processing auth callback...');
  
  // Parse the URL hash to get tokens
  const hashParams = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = hashParams.get('access_token');
  const refreshToken = hashParams.get('refresh_token');
  const type = hashParams.get('type'); // 'signup' or other auth types
  
  if (!accessToken) {
    console.error('No access token found in callback');
    window.location.hash = '#home';
    return;
  }
  
  try {
    // Import what we need
    const { getClient } = await import('@/api/supabaseClient.js');
    const { showNotification } = await import('@/utils/ui.js');
    const { closeModal } = await import('@/utils/modal.js');
    
    const supabase = getClient();
    
    // Set the session with the tokens from the URL
    const { data: { session }, error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    
    if (error) throw error;
    
    // Get the user data
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
      // Close any open modals
      closeModal('emailVerification');
      closeModal('signin');
      closeModal('signup');
      
      // Show appropriate message
      if (type === 'signup') {
        showNotification('Email verified! Welcome to GatherMemorials!', 'success');
        
        // For new signups, redirect to profile to complete setup
        setTimeout(() => {
          window.location.hash = '#profile';
        }, 1000);
      } else if (type === 'recovery') {
        showNotification('Password reset confirmed. Please set your new password.', 'success');
        // Handle password reset flow
        window.location.hash = '#reset-password';
      } else {
        showNotification('Welcome back!', 'success');
        
        // For returning users, go to home or their intended destination
        const redirect = sessionStorage.getItem('redirectAfterLogin');
        if (redirect) {
          sessionStorage.removeItem('redirectAfterLogin');
          window.location.hash = `#${redirect}`;
        } else {
          window.location.hash = '#home';
        }
      }
    }
    
    // Clean up the URL - remove the tokens
    window.history.replaceState(null, '', window.location.pathname);
    
  } catch (error) {
    console.error('Error processing auth callback:', error);
    
    const { showNotification } = await import('@/utils/ui.js');
    showNotification('Error verifying email. Please try signing in.', 'error');
    
    // Redirect to home
    window.location.hash = '#home';
    
    // Clean up the URL anyway
    window.history.replaceState(null, '', window.location.pathname);
  }
}

/* ──────────────────────────────────────────
   UTILITY FUNCTIONS
   ────────────────────────────────────────── */
function hideAllSections() {
  document.querySelectorAll('.page-section').forEach((section) => {
    section.style.display = 'none';
    section.classList.remove('active'); // Also remove active class
  });
}

function updateActiveNavItems(activePage) {
  // Update desktop nav - Fixed selector
  document.querySelectorAll('.nav-links a').forEach((link) => {
    const linkPage = link.getAttribute('href')?.slice(1) || '';
    if (linkPage === activePage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
  
  // Update mobile nav
  document.querySelectorAll('.mobile-menu a').forEach((link) => {
    const linkPage = link.getAttribute('href')?.slice(1) || '';
    if (linkPage === activePage) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
}

function closeMobileMenu() {
  const mobileMenu = document.querySelector('.mobile-menu');
  const menuToggle = document.querySelector('.mobile-menu-toggle');
  
  if (mobileMenu && mobileMenu.classList.contains('active')) {
    mobileMenu.classList.remove('active');
    if (menuToggle) {
      menuToggle.setAttribute('aria-expanded', 'false');
    }
  }
}

function createMemorialSection() {
  const section = document.createElement('section');
  section.id = 'memorialView';
  section.className = 'page-section memorial-view-page';
  section.style.display = 'none';
  section.innerHTML = `
    <div class="memorial-header">
      <div class="memorial-nav">
        <button onclick="goBack()" class="btn-back">
          <i class="fas fa-arrow-left"></i> Back
        </button>
      </div>
      <div class="memorial-cover-photo" id="memorialCoverPhoto">
        <div class="memorial-overlay"></div>
      </div>
    </div>
    
    <div class="memorial-content">
      <div class="memorial-profile-section">
        <img src="" alt="" class="memorial-profile-photo" id="memorialProfilePhoto">
        <h1 class="memorial-name" id="memorialName">Loading...</h1>
        <p class="memorial-dates" id="memorialDates"></p>
        <p class="memorial-tagline" id="memorialTagline"></p>
      </div>
      
      <div class="memorial-tabs">
        <button class="tab-button active" data-tab="about">About</button>
        <button class="tab-button" data-tab="gallery">Photos & Videos</button>
        <button class="tab-button" data-tab="tributes">Tributes</button>
        <button class="tab-button" data-tab="service">Service Info</button>
      </div>
      
      <div class="memorial-tab-content">
        <div class="tab-pane active" id="about-tab">
          <div class="memorial-section">
            <h2>Life Story</h2>
            <div id="memorialLifeStory" class="memorial-text"></div>
          </div>
        </div>
        
        <div class="tab-pane" id="gallery-tab">
          <div class="memorial-gallery" id="memorialGallery"></div>
        </div>
        
        <div class="tab-pane" id="tributes-tab">
          <div class="memorial-tributes" id="memorialTributes"></div>
        </div>
        
        <div class="tab-pane" id="service-tab">
          <div class="memorial-service-info" id="memorialServiceInfo"></div>
        </div>
      </div>
      
      <section class="guestbook-section">
        <h2>Guestbook</h2>
        <div class="guestbook-actions">
          <button class="btn-primary" onclick="openGuestbookModal()">
            <i class="fas fa-pen"></i> Leave a Message
          </button>
        </div>
        <div class="guestbook-entries"></div>
      </section>
    </div>
  `;
  
  // Add to main content area
  const main = document.querySelector('main') || document.body;
  main.appendChild(section);
  
  return section;
}

function trackPageView(page) {
  // Google Analytics tracking (if implemented)
  if (typeof gtag !== 'undefined') {
    gtag('config', 'GA_MEASUREMENT_ID', {
      page_path: `/#${page}`
    });
  }
  
  // Custom analytics
  console.log(`Page view: ${page}`);
}

/* ──────────────────────────────────────────
   NAVIGATION HELPERS
   ────────────────────────────────────────── */
function navigateTo(page) {
  window.location.hash = `#${page}`;
}

function goBack() {
  if (previousPage) {
    showPage(previousPage);
  } else {
    showPage('home');
  }
}

function getCurrentPage() {
  return currentPage;
}

/* ──────────────────────────────────────────
   AUTH STATE CHANGE HANDLER
   ────────────────────────────────────────── */
// Listen for auth state changes to handle protected routes
document.addEventListener('auth:state', (event) => {
  const { user } = event.detail;
  
  // If user just logged in and we have a redirect
  if (user && sessionStorage.getItem('redirectAfterLogin')) {
    const redirect = sessionStorage.getItem('redirectAfterLogin');
    sessionStorage.removeItem('redirectAfterLogin');
    showPage(redirect);
  }
  
  // If user logged out and on a protected page
  if (!user && currentPage && routes[currentPage]?.requiresAuth) {
    showPage('home');
    import('@/utils/ui.js').then(({ showNotification }) => {
      showNotification('Please sign in to continue');
    });
  }
});

/* ──────────────────────────────────────────
   EXPORTS
   ────────────────────────────────────────── */
export { showPage, navigateTo, goBack, getCurrentPage };

/* ──────────────────────────────────────────
   MAKE FUNCTIONS GLOBAL (for legacy support)
   ────────────────────────────────────────── */
window.showPage = showPage;
window.navigateTo = navigateTo;
window.goBack = goBack;