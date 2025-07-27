/* src/js/router.js */
import { initBlog } from '@/features/blog/blog.js';
import { initFAQ } from '@/features/faq/faq.js';
import { initMemorialView, cleanupMemorialView } from '@/features/memorials/memorialView.js';

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
    authMessage: 'Please sign in to create a memorial'
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
  // Handle hash changes
  window.addEventListener('hashchange', handleRouteChange);
  
  // Handle initial load
  handleRouteChange();
  
  // Handle browser back/forward buttons
  window.addEventListener('popstate', handleRouteChange);
}

export function showPage(page) {
  // Store previous page for potential redirects
  previousPage = currentPage;
  
  // Handle memorial pages with ID/slug
  if (page.startsWith('memorial/')) {
    showMemorialPage(page);
    return;
  }
  
  // Handle blog post pages
  if (page.startsWith('blog/')) {
    showBlogPost(page);
    return;
  }
  
  // Check if route exists
  if (!routes[page]) {
    console.warn(`Route not found: ${page}`);
    showPage('home');
    return;
  }
  
  const route = routes[page];
  
  // Check authentication
  if (route.requiresAuth && !window.currentUser) {
    import('@/utils/ui.js').then(({ showNotification }) => {
      showNotification(route.authMessage || 'Please sign in to continue');
    });
    
    // Store intended destination for after login
    sessionStorage.setItem('redirectAfterLogin', page);
    
    import('@/utils/modal.js').then(({ openModal }) => {
      openModal('signin');
    });
    return;
  }
  
  // Update page title
  document.title = route.title || 'GatherMemorials';
  
  // Hide all sections
  hideAllSections();
  
  // Show the requested section
  const section = document.getElementById(page);
  if (section) {
    section.style.display = 'block';
    currentPage = page;
    
    // Scroll to top
    window.scrollTo(0, 0);
    
    // Run page-specific initialization if defined
    if (route.init) {
      route.init();
    }
    
    // Update active nav items
    updateActiveNavItems(page);
    
    // Close mobile menu if open
    closeMobileMenu();
    
    // Track page view (analytics)
    trackPageView(page);
  } else {
    console.error(`Section not found: ${page}`);
    showPage('home');
  }
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
  const memorialSection = document.getElementById('memorialView');
  if (!memorialSection) {
    // Create memorial section if it doesn't exist
    createMemorialSection();
  } else {
    memorialSection.style.display = 'block';
  }
  
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
  
  // Show blog section
  hideAllSections();
  const blogSection = document.getElementById('blog');
  if (blogSection) {
    blogSection.style.display = 'block';
    currentPage = page;
    
    // Let blog module handle the specific post
    import('@/features/blog/blog.js').then(({ showBlogPost }) => {
      showBlogPost(postSlug);
    });
    
    updateActiveNavItems('blog');
  }
}

/* ──────────────────────────────────────────
   ROUTE CHANGE HANDLER
   ────────────────────────────────────────── */
function handleRouteChange() {
  const hash = window.location.hash.slice(1); // Remove #
  const page = hash || 'home';
  
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
   UTILITY FUNCTIONS
   ────────────────────────────────────────── */
function hideAllSections() {
  document.querySelectorAll('.page-section').forEach((section) => {
    section.style.display = 'none';
  });
}

function updateActiveNavItems(activePage) {
  // Update desktop nav
  document.querySelectorAll('.nav-menu a').forEach((link) => {
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
      <div class="memorial-background">
        <img id="memorialBackgroundPhoto" src="/assets/default-memorial-bg.jpg" alt="">
      </div>
      <div class="memorial-profile">
        <img id="memorialProfilePhoto" src="/assets/default-avatar.jpg" alt="">
        <h1 id="memorialName"></h1>
        <p id="memorialDates" class="memorial-dates"></p>
      </div>
    </div>

    <div class="memorial-content container">
      <!-- Memorial Info -->
      <section class="memorial-info">
        <div class="info-grid">
          <div class="info-item">
            <span class="info-label">Born</span>
            <span id="memorialBirthDate" class="info-value">-</span>
          </div>
          <div class="info-item">
            <span class="info-label">Passed</span>
            <span id="memorialDeathDate" class="info-value">-</span>
          </div>
        </div>
      </section>

      <!-- Obituary -->
      <section class="memorial-section obituary-section">
        <h2>Obituary</h2>
        <div id="memorialObituary" class="obituary-content"></div>
      </section>

      <!-- Life Story -->
      <section class="memorial-section life-story-section">
        <h2>Life Story</h2>
        <div id="memorialLifeStory" class="life-story-content"></div>
      </section>

      <!-- Services -->
      <section class="memorial-section services-section">
        <h2>Service Information</h2>
        <div id="memorialServices"></div>
      </section>

      <!-- Moments Gallery -->
      <section class="memorial-section moments-section">
        <h2>Memories</h2>
        <div id="memorialMomentsGrid" class="moments-grid"></div>
      </section>

      <!-- Guestbook -->
      <section class="memorial-section guestbook-section">
        <h2>Messages of Love</h2>
        <div class="guestbook-header">
          <p>Share your memories and messages</p>
          <button class="btn-primary" data-action="open-guestbook">
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
export function navigateTo(page) {
  window.location.hash = `#${page}`;
}

export function goBack() {
  if (previousPage) {
    showPage(previousPage);
  } else {
    showPage('home');
  }
}

export function getCurrentPage() {
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
   MAKE FUNCTIONS GLOBAL (for legacy support)
   ────────────────────────────────────────── */
window.showPage = showPage;
window.navigateTo = navigateTo;