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
   ROUTE CHANGE HANDLER - UPDATED WITH MEMORIAL HANDLING
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
    // INLINE MEMORIAL HANDLING
    const memorialId = page.split('/')[1];
    
    if (!memorialId) {
      showPage('home');
      return;
    }
    
    // Update previous page
    previousPage = currentPage;
    currentPage = page;
    
    // Update page title
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
    
    // Update nav
    updateActiveNavItems('');
    
    // Track page view
    trackPageView(`memorial/${memorialId}`);
    
    // Load the memorial directly
    loadMemorialDirect(memorialId);
    
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
   DIRECT MEMORIAL LOADER
   ────────────────────────────────────────── */
async function loadMemorialDirect(memorialId) {
  console.log('Loading memorial directly:', memorialId);
  
  const container = document.getElementById('memorialView');
  if (!container) return;
  
  // Show loading state
  container.innerHTML = `
    <div class="loading-container" style="text-align: center; padding: 4rem;">
      <div class="loading-spinner">
        <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #6b9174;"></i>
      </div>
      <p style="color: #4a4238; margin-top: 1rem;">Loading memorial...</p>
    </div>
  `;
  
  try {
    // Get auth token
    const authToken = localStorage.getItem('sb-virtdzxnedksjsmeshyt-auth-token');
    const headers = {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcnRkenhuZWRrc2pzbWVzaHl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY2NzI1OTgsImV4cCI6MjA0MjI0ODU5OH0.aV7oaBj5Z4Cfs-WyZ9cetY-4aaQbicvFxyuN7K5dW1o',
      'Content-Type': 'application/json'
    };
    
    // Add auth header if we have a token
    if (authToken) {
      try {
        const token = JSON.parse(authToken);
        headers['Authorization'] = `Bearer ${token.access_token}`;
      } catch (e) {
        console.warn('Could not parse auth token');
      }
    }
    
    // Fetch memorial data using REST API
    const response = await fetch('https://virtdzxnedksjsmeshyt.supabase.co/rest/v1/rpc/get_memorial', {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({ identifier: memorialId })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const memorials = await response.json();
    
    if (!memorials || memorials.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem;">
          <i class="fas fa-search" style="font-size: 3rem; color: #9b8b7e; margin-bottom: 1rem; display: block;"></i>
          <h2 style="color: #4a4238; margin-bottom: 1rem;">Memorial Not Found</h2>
          <p style="color: #9b8b7e; margin-bottom: 2rem;">We couldn't find the memorial you're looking for.</p>
          <a href="#home" class="btn-primary" style="display: inline-block; padding: 0.75rem 2rem; background: #6b9174; color: white; text-decoration: none; border-radius: 4px;">Return Home</a>
        </div>
      `;
      return;
    }
    
    const memorial = memorials[0];
    console.log('Memorial loaded:', memorial);
    
    // Check if published
    if (!memorial.is_published && (!window.currentUser || memorial.user_id !== window.currentUser.id)) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem;">
          <i class="fas fa-lock" style="font-size: 3rem; color: #9b8b7e; margin-bottom: 1rem; display: block;"></i>
          <h2 style="color: #4a4238; margin-bottom: 1rem;">Memorial Not Published</h2>
          <p style="color: #9b8b7e; margin-bottom: 2rem;">This memorial is not yet available for viewing.</p>
          <a href="#home" class="btn-primary" style="display: inline-block; padding: 0.75rem 2rem; background: #6b9174; color: white; text-decoration: none; border-radius: 4px;">Return Home</a>
        </div>
      `;
      return;
    }
    
    // Display the memorial
    displayMemorialDirect(memorial, container);
    
  } catch (error) {
    console.error('Error loading memorial:', error);
    container.innerHTML = `
      <div style="text-align: center; padding: 4rem;">
        <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #d2755a; margin-bottom: 1rem; display: block;"></i>
        <h2 style="color: #4a4238; margin-bottom: 1rem;">Something Went Wrong</h2>
        <p style="color: #9b8b7e; margin-bottom: 2rem;">We couldn't load the memorial. Please try again later.</p>
        <a href="#home" class="btn-primary" style="display: inline-block; padding: 0.75rem 2rem; background: #6b9174; color: white; text-decoration: none; border-radius: 4px;">Return Home</a>
      </div>
    `;
  }
}

/* ──────────────────────────────────────────
   DIRECT MEMORIAL DISPLAY
   ────────────────────────────────────────── */
function displayMemorialDirect(memorial, container) {
  // Format dates
  const birthYear = memorial.birth_date ? new Date(memorial.birth_date).getFullYear() : '';
  const deathYear = memorial.death_date ? new Date(memorial.death_date).getFullYear() : '';
  const dates = (birthYear || deathYear) ? `${birthYear} - ${deathYear}` : '';
  
  // Update page title
  document.title = `${memorial.deceased_name} - Memorial | GatherMemorials`;
  
  // Build the memorial HTML
  container.innerHTML = `
    <div class="memorial-page">
      <div class="memorial-header-section">
        <div class="memorial-cover-photo" style="
          height: 300px;
          background-image: url('${memorial.background_photo_url || 'https://images.unsplash.com/photo-1516475429286-465d815a0df7?w=1200'}');
          background-size: cover;
          background-position: center;
          position: relative;
        ">
          <div class="memorial-overlay" style="
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.6));
          "></div>
        </div>
      </div>
      
      <div class="memorial-content" style="max-width: 1200px; margin: 0 auto; padding: 0 2rem;">
        <div class="memorial-profile-section" style="text-align: center; margin-top: -80px; position: relative; z-index: 10;">
          <img src="${memorial.profile_photo_url || '/assets/default-avatar.jpg'}" 
               alt="${memorial.deceased_name}" 
               class="memorial-profile-photo" 
               style="width: 160px; height: 160px; border-radius: 50%; border: 4px solid white; margin-bottom: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
          <h1 class="memorial-name" style="color: #4a4238; font-size: 2.5rem; margin-bottom: 0.5rem;">${memorial.deceased_name}</h1>
          ${dates ? `<p class="memorial-dates" style="color: #9b8b7e; font-size: 1.25rem; margin-bottom: 0.5rem;">${dates}</p>` : ''}
          ${memorial.headline ? `<p class="memorial-tagline" style="color: #6b9174; font-style: italic; font-size: 1.1rem;">${memorial.headline}</p>` : ''}
        </div>
        
        <div class="memorial-tabs" style="display: flex; justify-content: center; gap: 2rem; margin: 3rem 0 2rem; border-bottom: 2px solid #e8d5b7; padding-bottom: 0;">
          <button class="tab-button active" data-tab="about" style="
            padding: 0.75rem 1.5rem;
            background: none;
            border: none;
            cursor: pointer;
            color: #6b9174;
            font-weight: 500;
            border-bottom: 3px solid #6b9174;
            margin-bottom: -2px;
            transition: all 0.3s ease;
          ">About</button>
          <button class="tab-button" data-tab="gallery" style="
            padding: 0.75rem 1.5rem;
            background: none;
            border: none;
            cursor: pointer;
            color: #9b8b7e;
            font-weight: 500;
            border-bottom: 3px solid transparent;
            margin-bottom: -2px;
            transition: all 0.3s ease;
          ">Photos & Videos</button>
          <button class="tab-button" data-tab="tributes" style="
            padding: 0.75rem 1.5rem;
            background: none;
            border: none;
            cursor: pointer;
            color: #9b8b7e;
            font-weight: 500;
            border-bottom: 3px solid transparent;
            margin-bottom: -2px;
            transition: all 0.3s ease;
          ">Tributes</button>
          <button class="tab-button" data-tab="service" style="
            padding: 0.75rem 1.5rem;
            background: none;
            border: none;
            cursor: pointer;
            color: #9b8b7e;
            font-weight: 500;
            border-bottom: 3px solid transparent;
            margin-bottom: -2px;
            transition: all 0.3s ease;
          ">Service Info</button>
        </div>
        
        <div class="memorial-tab-content">
          <div class="tab-pane active" id="about-tab">
            ${memorial.opening_statement ? `
              <div class="memorial-section" style="margin-bottom: 2rem;">
                <p class="opening-statement" style="font-size: 1.2rem; color: #4a4238; line-height: 1.8; font-style: italic; text-align: center; padding: 1.5rem; background: #faf8f3; border-radius: 8px;">${memorial.opening_statement}</p>
              </div>
            ` : ''}
            
            ${memorial.obituary ? `
              <div class="memorial-section obituary-section" style="margin-bottom: 2rem;">
                <h2 style="color: #4a4238; font-size: 1.75rem; margin-bottom: 1rem;">Obituary</h2>
                <div class="memorial-text" style="color: #4a4238; line-height: 1.8; font-size: 1.1rem;">${memorial.obituary}</div>
              </div>
            ` : ''}
            
            ${memorial.life_story ? `
              <div class="memorial-section" style="margin-bottom: 2rem;">
                <h2 style="color: #4a4238; font-size: 1.75rem; margin-bottom: 1rem;">Life Story</h2>
                <div class="memorial-text" style="color: #4a4238; line-height: 1.8; font-size: 1.1rem;">${memorial.life_story}</div>
              </div>
            ` : ''}
            
            ${memorial.additional_info ? `
              <div class="memorial-section" style="margin-bottom: 2rem;">
                <h2 style="color: #4a4238; font-size: 1.75rem; margin-bottom: 1rem;">Additional Information</h2>
                <div class="memorial-text" style="color: #4a4238; line-height: 1.8; font-size: 1.1rem;">${memorial.additional_info}</div>
              </div>
            ` : ''}
          </div>
          
          <div class="tab-pane" id="gallery-tab" style="display: none;">
            <div class="memorial-gallery" style="padding: 2rem 0;">
              <p style="text-align: center; color: #9b8b7e; font-size: 1.1rem;">No photos or videos have been added yet.</p>
            </div>
          </div>
          
          <div class="tab-pane" id="tributes-tab" style="display: none;">
            <div class="memorial-tributes" style="padding: 2rem 0;">
              <p style="text-align: center; color: #9b8b7e; font-size: 1.1rem;">No tributes have been shared yet.</p>
            </div>
          </div>
          
          <div class="tab-pane" id="service-tab" style="display: none;">
            <div class="memorial-service-info" style="padding: 2rem 0;">
              <p style="text-align: center; color: #9b8b7e; font-size: 1.1rem;">No service information is available at this time.</p>
            </div>
          </div>
        </div>
        
        ${memorial.user_id === window.currentUser?.id ? `
          <div class="owner-controls" style="margin: 3rem 0; text-align: center;">
            <button onclick="
              localStorage.setItem('currentDraftId', '${memorial.id}');
              window.location.hash='#createMemorial';
            " class="btn-primary" style="
              display: inline-block;
              padding: 0.75rem 2rem;
              background: #6b9174;
              color: white;
              text-decoration: none;
              border: none;
              border-radius: 4px;
              font-size: 1rem;
              cursor: pointer;
              transition: background 0.3s ease;
            ">
              <i class="fas fa-edit"></i> Edit Memorial
            </button>
          </div>
        ` : ''}
        
        <section class="guestbook-section" style="margin-top: 3rem; padding: 3rem 0; border-top: 2px solid #e8d5b7;">
          <h2 style="color: #4a4238; font-size: 2rem; margin-bottom: 1.5rem; text-align: center;">Guestbook</h2>
          <div class="guestbook-actions" style="text-align: center; margin-bottom: 2rem;">
            <button class="btn-primary" onclick="
              import('@/utils/modal.js').then(({ openModal }) => {
                openModal('guestbook');
              }).catch(() => {
                alert('Guestbook feature coming soon!');
              });
            " style="
              display: inline-block;
              padding: 0.75rem 2rem;
              background: #6b9174;
              color: white;
              text-decoration: none;
              border: none;
              border-radius: 4px;
              font-size: 1rem;
              cursor: pointer;
              transition: background 0.3s ease;
            ">
              <i class="fas fa-pen"></i> Leave a Message
            </button>
          </div>
          <div class="guestbook-entries" id="guestbookEntries">
            <p style="text-align: center; color: #9b8b7e; font-size: 1.1rem;">Loading messages...</p>
          </div>
        </section>
      </div>
    </div>
  `;
  
  // Set up tab functionality
  setupMemorialTabsDirect(container);
  
  // Try to load guestbook entries
  loadGuestbookDirect(memorial.id);
}

/* ──────────────────────────────────────────
   DIRECT TAB SETUP
   ────────────────────────────────────────── */
function setupMemorialTabsDirect(container) {
  const tabButtons = container.querySelectorAll('.tab-button');
  const tabPanes = container.querySelectorAll('.tab-pane');
  
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const targetTab = button.getAttribute('data-tab');
      
      // Update active button
      tabButtons.forEach(btn => {
        btn.classList.remove('active');
        btn.style.color = '#9b8b7e';
        btn.style.borderBottomColor = 'transparent';
      });
      button.classList.add('active');
      button.style.color = '#6b9174';
      button.style.borderBottomColor = '#6b9174';
      
      // Update active pane
      tabPanes.forEach(pane => {
        pane.style.display = 'none';
        pane.classList.remove('active');
      });
      
      const targetPane = container.querySelector(`#${targetTab}-tab`);
      if (targetPane) {
        targetPane.style.display = 'block';
        targetPane.classList.add('active');
      }
    });
  });
}

/* ──────────────────────────────────────────
   DIRECT GUESTBOOK LOADER
   ────────────────────────────────────────── */
async function loadGuestbookDirect(memorialId) {
  try {
    const authToken = localStorage.getItem('sb-virtdzxnedksjsmeshyt-auth-token');
    const headers = {
      'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZpcnRkenhuZWRrc2pzbWVzaHl0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjY2NzI1OTgsImV4cCI6MjA0MjI0ODU5OH0.aV7oaBj5Z4Cfs-WyZ9cetY-4aaQbicvFxyuN7K5dW1o',
      'Content-Type': 'application/json'
    };
    
    if (authToken) {
      try {
        const token = JSON.parse(authToken);
        headers['Authorization'] = `Bearer ${token.access_token}`;
      } catch (e) {
        console.warn('Could not parse auth token for guestbook');
      }
    }
    
    const response = await fetch(`https://virtdzxnedksjsmeshyt.supabase.co/rest/v1/guestbook_entries?memorial_id=eq.${memorialId}&is_approved=eq.true&order=created_at.desc`, {
      method: 'GET',
      headers: headers
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const entries = await response.json();
    
    const container = document.getElementById('guestbookEntries');
    if (!container) return;
    
    if (entries && entries.length > 0) {
      container.innerHTML = entries.map(entry => `
        <div class="guestbook-entry" style="background: #faf8f3; padding: 1.5rem; border-radius: 8px; margin-bottom: 1rem;">
          <p style="color: #4a4238; line-height: 1.6; margin-bottom: 0.5rem;">${entry.message}</p>
          <p style="color: #9b8b7e; font-size: 0.9rem;">
            <strong>${entry.author_name}</strong> - 
            ${new Date(entry.created_at).toLocaleDateString()}
          </p>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p style="text-align: center; color: #9b8b7e; font-size: 1.1rem;">No messages yet. Be the first to leave a tribute.</p>';
    }
  } catch (error) {
    console.error('Error loading guestbook:', error);
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