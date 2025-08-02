/* src/js/router.js - Fixed version using Supabase client */
import { initBlog } from '@/features/blog/blog.js';
import { initFAQ } from '@/features/faq/faq.js';
import { initMemorialView, cleanupMemorialView } from '@/features/memorials/memorialView.js';
import { qs } from '@/utils/ui.js';
import { getClient } from '@/api/supabaseClient.js';

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
   DIRECT MEMORIAL LOADER - FIXED TO USE SUPABASE CLIENT
   ────────────────────────────────────────── */
async function loadMemorialDirect(memorialId) {
  console.log('Loading memorial directly:', memorialId);
  
  const container = document.getElementById('memorialView');
  if (!container) return;
  
  // Show loading state
  container.innerHTML = `
    <div class="page-container">
      <div class="loading-container" style="text-align: center; padding: 4rem;">
        <div class="loading-spinner">
          <i class="fas fa-spinner fa-spin" style="font-size: 2rem; color: #6b9174;"></i>
        </div>
        <p style="color: #4a4238; margin-top: 1rem;">Loading memorial...</p>
      </div>
    </div>
  `;
  
  try {
    // Get Supabase client
    const supabase = getClient();
    
    if (!supabase) {
      throw new Error('Supabase client not initialized. Please check your environment variables.');
    }
    
    // Try to use RPC function first (if it exists)
    let memorials, error;
    
    // First attempt: Try RPC function
    const rpcResult = await supabase.rpc('get_memorial', { identifier: memorialId });
    
    if (rpcResult.error) {
      console.log('RPC function failed, falling back to direct query:', rpcResult.error.message);
      
      // Fallback: Direct query
      const queryResult = await supabase
        .from('memorials')
        .select('*')
        .eq('slug', memorialId);
        
      memorials = queryResult.data;
      error = queryResult.error;
    } else {
      memorials = rpcResult.data;
      error = rpcResult.error;
    }
    
    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }
    
    if (!memorials || memorials.length === 0) {
      container.innerHTML = `
        <div class="page-container">
          <div style="text-align: center; padding: 4rem;">
            <i class="fas fa-search" style="font-size: 3rem; color: #9b8b7e; margin-bottom: 1rem; display: block;"></i>
            <h2 style="color: #4a4238; margin-bottom: 1rem;">Memorial Not Found</h2>
            <p style="color: #9b8b7e; margin-bottom: 2rem;">We couldn't find the memorial you're looking for.</p>
            <a href="#home" class="btn-primary" style="display: inline-block; padding: 0.75rem 2rem; background: #6b9174; color: white; text-decoration: none; border-radius: 4px;">Return Home</a>
          </div>
        </div>
      `;
      return;
    }
    
    const memorial = memorials[0];
    console.log('Memorial loaded:', memorial);
    
    // Get current user for permission checks
    const { data: { user } } = await supabase.auth.getUser();
    const currentUserId = user?.id;
    
    // Check if memorial is private and user needs to enter password
    if (memorial.privacy_setting === 'private' && memorial.user_id !== currentUserId) {
      // Check if we have access in session
      const accessKey = `memorial_access_${memorial.id}`;
      const hasAccess = sessionStorage.getItem(accessKey) === 'granted';
      
      if (!hasAccess && memorial.access_password) {
        // Show password prompt
        container.innerHTML = `
          <div class="page-container">
            <div style="text-align: center; padding: 4rem;">
              <i class="fas fa-lock" style="font-size: 3rem; color: #9b8b7e; margin-bottom: 1rem; display: block;"></i>
              <h2 style="color: #4a4238; margin-bottom: 1rem;">Private Memorial</h2>
              <p style="color: #9b8b7e; margin-bottom: 2rem;">This memorial is private. Please enter the password to view.</p>
              <div style="max-width: 400px; margin: 0 auto;">
                <input type="password" id="memorialPassword" placeholder="Enter password" style="width: 100%; padding: 0.75rem; border: 2px solid #e8d5b7; border-radius: 4px; margin-bottom: 1rem;">
                <button onclick="checkMemorialPassword('${memorial.id}', '${memorial.access_password}')" class="btn-primary" style="display: inline-block; padding: 0.75rem 2rem; background: #6b9174; color: white; text-decoration: none; border: none; border-radius: 4px; cursor: pointer;">
                  Enter
                </button>
                <a href="#home" style="display: block; margin-top: 1rem; color: #9b8b7e;">Return Home</a>
              </div>
            </div>
          </div>
        `;
        return;
      }
    }
    
    // Check if published
    if (!memorial.is_published && memorial.user_id !== currentUserId) {
      container.innerHTML = `
        <div class="page-container">
          <div style="text-align: center; padding: 4rem;">
            <i class="fas fa-lock" style="font-size: 3rem; color: #9b8b7e; margin-bottom: 1rem; display: block;"></i>
            <h2 style="color: #4a4238; margin-bottom: 1rem;">Memorial Not Published</h2>
            <p style="color: #9b8b7e; margin-bottom: 2rem;">This memorial is not yet available for viewing.</p>
            <a href="#home" class="btn-primary" style="display: inline-block; padding: 0.75rem 2rem; background: #6b9174; color: white; text-decoration: none; border-radius: 4px;">Return Home</a>
          </div>
        </div>
      `;
      return;
    }
    
    // Update window.currentUser for backward compatibility
    window.currentUser = user;
    
    // Store memorial data globally for other functions
    window.currentMemorial = memorial;
    
    // Display the memorial
    displayMemorialDirect(memorial, container);
    
  } catch (error) {
    console.error('Error loading memorial:', error);
    container.innerHTML = `
      <div class="page-container">
        <div style="text-align: center; padding: 4rem;">
          <i class="fas fa-exclamation-triangle" style="font-size: 3rem; color: #d2755a; margin-bottom: 1rem; display: block;"></i>
          <h2 style="color: #4a4238; margin-bottom: 1rem;">Something Went Wrong</h2>
          <p style="color: #9b8b7e; margin-bottom: 2rem;">We couldn't load the memorial. Please try again later.</p>
          <a href="#home" class="btn-primary" style="display: inline-block; padding: 0.75rem 2rem; background: #6b9174; color: white; text-decoration: none; border-radius: 4px;">Return Home</a>
        </div>
      </div>
    `;
  }
}

/* ──────────────────────────────────────────
   PASSWORD CHECK FUNCTION
   ────────────────────────────────────────── */
window.checkMemorialPassword = function(memorialId, correctPassword) {
  const input = document.getElementById('memorialPassword');
  const enteredPassword = input.value;
  
  if (enteredPassword === correctPassword) {
    // Grant access
    sessionStorage.setItem(`memorial_access_${memorialId}`, 'granted');
    // Reload the memorial
    loadMemorialDirect(window.location.hash.split('/')[1]);
  } else {
    // Show error
    import('@/utils/ui.js').then(({ showNotification }) => {
      showNotification('Incorrect password. Please try again.', 'error');
    });
    input.value = '';
    input.focus();
  }
};

/* ──────────────────────────────────────────
   DIRECT MEMORIAL DISPLAY - CORRECTED TO MATCH EXAMPLE MEMORIAL
   ────────────────────────────────────────── */
function displayMemorialDirect(memorial, container) {
  // Format dates helper functions
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('en-US', options);
  };

  const formatTime = (timeStr) => {
    if (!timeStr) return '';
    const [hours, minutes] = timeStr.split(':');
    const hour = parseInt(hours);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
    return `${displayHour}:${minutes} ${ampm}`;
  };

  // Format full dates for display (like "March 15, 1945")
  const birthDateFormatted = memorial.birth_date ? formatDate(memorial.birth_date) : '';
  const deathDateFormatted = memorial.death_date ? formatDate(memorial.death_date) : '';
  const fullDates = `${birthDateFormatted} - ${deathDateFormatted}`;
  
  // Update page title
  document.title = `${memorial.deceased_name} - Memorial | GatherMemorials`;
  
  // Build the memorial HTML matching the EXACT example memorial structure
  container.innerHTML = `
    <section id="exampleMemorial" class="page-section memorial-page">
      <!-- Hero Section with background image -->
      <div class="memorial-hero" style="background-image: url('${memorial.background_photo_url || 'https://images.unsplash.com/photo-1516589091380-5d8e87df6999?w=1600&h=600&fit=crop'}');">
        <div class="memorial-hero-overlay"></div>
        <div class="memorial-hero-content">
          <img
            src="${memorial.profile_photo_url || 'https://images.unsplash.com/photo-1566616213894-2d4e1baee5d8?w=200&h=200&fit=crop'}"
            alt="${memorial.deceased_name}"
            class="memorial-main-photo"
          />
          <h1 class="memorial-main-name">${memorial.deceased_name}</h1>
          <p class="memorial-main-dates">${fullDates}</p>
          ${memorial.headline ? `<p class="memorial-headline">"${memorial.headline}"</p>` : ''}

          <div class="memorial-hero-actions">
            <button class="memorial-hero-btn" onclick="shareMemorial()">
              <i class="fas fa-share"></i>
              Share Memorial
            </button>
            ${window.currentUser?.id === memorial.user_id ? `
              <button class="memorial-hero-btn" onclick="editMemorial('${memorial.id}')">
                <i class="fas fa-edit"></i>
                Edit Memorial
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <div class="memorial-body">
        <!-- Obituary Section (always shown, with hero gradient background) -->
        <section class="obituary-section">
          <div class="obituary-container">
            <h2 class="obituary-title">Celebrating a Life of Love and Compassion</h2>
            <div class="obituary-content">
              ${memorial.opening_statement ? `
                <p class="obituary-lead serif-text">
                  ${memorial.opening_statement}
                </p>
              ` : ''}
              ${memorial.obituary ? `
                <div class="obituary-details">
                  ${memorial.obituary}
                  ${memorial.obituary && !memorial.obituary.includes('class="obituary-closing"') ? `
                    <p class="obituary-closing">
                      Forever in our hearts, your memory will continue to inspire and guide us.
                    </p>
                  ` : ''}
                </div>
              ` : `
                <div class="obituary-details">
                  <p>A beautiful life that came to an end.</p>
                  <p>They died as they lived, everyone's friend.</p>
                  <p class="obituary-closing">
                    In our hearts a memory will always be kept, of one we loved, and will never forget.
                  </p>
                </div>
              `}
            </div>
          </div>
        </section>

        <!-- Service Information Section -->
        <section class="service-section">
          <div class="service-container">
            <div class="service-card-container">
              <h2 class="service-title">Service Information</h2>
              <div id="memorialServices" class="service-cards">
                <!-- Services will be loaded here -->
              </div>
            </div>
          </div>
        </section>

        <!-- Photo Gallery Section (VSCO style) -->
        <section class="memories-section">
          <div class="memories-container">
            <h2 class="section-title" style="font-family: 'Montserrat', sans-serif; font-weight: 300; letter-spacing: 4px; text-transform: uppercase;">
              Memories
            </h2>
            
            <div id="memorialGallery" class="moments-grid-vsco">
              <!-- Photos will be loaded here -->
            </div>
            
            <!-- Load More button -->
            <div class="load-more-vsco" style="display: none;">
              <button class="load-more-btn" onclick="loadMoreMemories()">load more memories</button>
            </div>
          </div>
        </section>

        <!-- Guest Book Section -->
        <section class="guestbook-section">
          <div class="guestbook-container">
            <h2 class="section-title">Messages of Love</h2>
            <div class="guestbook-header">
              <p class="guestbook-intro">
                Share your memories and messages for the ${memorial.deceased_name.split(' ').pop()} family
              </p>
              <button class="btn-primary" data-action="open-guestbook" onclick="showGuestbookForm()">
                <i class="fas fa-pen"></i>
                Leave a Message
              </button>
            </div>

            <div id="guestbookEntries" class="guestbook-entries">
              <!-- Guestbook entries will be loaded here -->
            </div>
          </div>
        </section>
      </div>
    </section>
  `;
  
  // After DOM is rendered, load additional data
  setTimeout(() => {
    if (memorial.id) {
      loadMemorialServicesDirect(memorial.id);
      loadMemorialMomentsDirect(memorial.id);
      loadGuestbookDirect(memorial.id);
    }
  }, 100);
}

/* ──────────────────────────────────────────
   SERVICE LOADER FUNCTION (MATCHING EXAMPLE'S CARD STYLE)
   ────────────────────────────────────────── */
async function loadMemorialServicesDirect(memorialId) {
  try {
    const supabase = getClient();
    if (!supabase) return;
    
    const { data: services, error } = await supabase
      .from('memorial_services')
      .select('*')
      .eq('memorial_id', memorialId)
      .order('service_date', { ascending: true });
    
    if (error) throw error;
    
    const container = document.getElementById('memorialServices');
    if (!container) return;
    
    // Helper to format date
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        weekday: 'long',
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };

    // Helper to format time
    const formatTime = (timeStr) => {
      if (!timeStr) return '';
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    };
    
    if (services && services.length > 0) {
      container.innerHTML = services.map(service => {
        const serviceDate = service.service_date ? formatDate(service.service_date) : '';
        const serviceTime = service.service_time ? formatTime(service.service_time) : '';
        
        return `
          <div class="service-card">
            <div class="service-icon">
              <i class="fas ${service.is_virtual ? 'fa-video' : 'fa-calendar-alt'}"></i>
            </div>
            <div class="service-details">
              <h3>${service.service_type || 'Memorial Service'}</h3>
              ${serviceDate || serviceTime ? `
                <p class="service-date">
                  <i class="far fa-clock"></i>
                  ${serviceDate}${serviceTime ? ` at ${serviceTime}` : ''}
                </p>
              ` : ''}
              ${service.location_name ? `
                <p class="service-location">
                  <i class="fas fa-map-marker-alt"></i>
                  ${service.location_name}
                  ${service.location_address ? `<br>${service.location_address}` : ''}
                  ${service.location_city || service.location_state ? `
                    <br>${[service.location_city, service.location_state].filter(Boolean).join(', ')}
                  ` : ''}
                </p>
              ` : ''}
              ${service.is_virtual && service.virtual_meeting_url ? `
                <p class="service-virtual">
                  <i class="fas fa-link"></i>
                  <a href="${service.virtual_meeting_url}" target="_blank">Join Virtual Service</a>
                </p>
              ` : ''}
              ${service.additional_info ? `
                <p class="service-notes">${service.additional_info}</p>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = '<p class="text-center text-gray-500">Service information will be updated soon.</p>';
    }
  } catch (error) {
    console.error('Error loading services:', error);
    const container = document.getElementById('memorialServices');
    if (container) {
      container.innerHTML = '<p class="text-center text-gray-500">Unable to load service information.</p>';
    }
  }
}

/* ──────────────────────────────────────────
   LOAD MEMORIAL PHOTOS (VSCO STYLE GALLERY)
   ────────────────────────────────────────── */
async function loadMemorialMomentsDirect(memorialId) {
  try {
    const supabase = getClient();
    if (!supabase) return;
    
    const { data: moments, error } = await supabase
      .from('memorial_moments')
      .select('*')
      .eq('memorial_id', memorialId)
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    
    const galleryContainer = document.getElementById('memorialGallery');
    if (!galleryContainer) return;
    
    // Helper to format date
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };
    
    if (moments && moments.length > 0) {
      galleryContainer.innerHTML = moments.map((moment, index) => {
        // Add variety to layout - some images span wider
        const isWide = index % 5 === 0;
        const isTall = index % 7 === 2;
        
        return `
          <div class="moment-vsco ${isWide ? 'wide' : ''} ${isTall ? 'tall' : ''}">
            <img
              src="${moment.url}"
              alt="${moment.caption || 'Memory'}"
            />
            <div class="moment-overlay-vsco">
              ${moment.date_taken ? `<div class="moment-date-vsco">${formatDate(moment.date_taken)}</div>` : ''}
              ${moment.caption ? `<div class="moment-caption-vsco">${moment.caption}</div>` : ''}
            </div>
          </div>
        `;
      }).join('');
      
      // Show load more button if many photos
      if (moments.length > 12) {
        const loadMoreEl = galleryContainer.parentElement.querySelector('.load-more-vsco');
        if (loadMoreEl) loadMoreEl.style.display = 'block';
      }
    } else {
      galleryContainer.innerHTML = `
        <div class="empty-moments">
          <p>No photos have been added yet.</p>
          ${window.currentUser?.id === window.currentMemorial?.user_id ? `
            <button class="btn-primary" onclick="window.location.hash='#createMemorial'">
              <i class="fas fa-plus"></i> Add Photos
            </button>
          ` : ''}
        </div>
      `;
    }
  } catch (error) {
    console.error('Error loading moments:', error);
  }
}

/* ──────────────────────────────────────────
   LOAD GUESTBOOK ENTRIES
   ────────────────────────────────────────── */
async function loadGuestbookDirect(memorialId) {
  try {
    const supabase = getClient();
    if (!supabase) return;
    
    const { data: entries, error } = await supabase
      .from('guestbook_entries')
      .select('*')
      .eq('memorial_id', memorialId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    const container = document.getElementById('guestbookEntries');
    if (!container) return;
    
    // Helper to format date
    const formatDate = (dateStr) => {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      });
    };
    
    if (entries && entries.length > 0) {
      container.innerHTML = entries.map(entry => `
        <div class="guestbook-entry">
          <div class="entry-header">
            <img
              src="https://ui-avatars.com/api/?name=${encodeURIComponent(entry.author_name)}&background=6b9174&color=fff"
              alt="${entry.author_name}"
            />
            <div class="entry-info">
              <h4>${entry.author_name}</h4>
              <p class="entry-date">${formatDate(entry.created_at)}</p>
            </div>
          </div>
          <p class="entry-message">${entry.message}</p>
          <div class="entry-actions">
            <button class="action-btn"><i class="fas fa-heart"></i> ${entry.likes || 0}</button>
          </div>
        </div>
      `).join('');
    } else {
      container.innerHTML = '<p class="text-center text-gray-500">Be the first to leave a message of love.</p>';
    }
  } catch (error) {
    console.error('Error loading guestbook:', error);
  }
}

/* ──────────────────────────────────────────
   GLOBAL HELPER FUNCTIONS
   ────────────────────────────────────────── */
window.shareMemorial = function() {
  const url = window.location.href;
  
  if (navigator.share) {
    navigator.share({
      title: document.title,
      url: url
    }).catch(err => console.log('Error sharing:', err));
  } else {
    navigator.clipboard.writeText(url)
      .then(() => {
        // Show toast notification instead of alert
        const toast = document.createElement('div');
        toast.className = 'toast-notification';
        toast.innerHTML = '<i class="fas fa-check"></i> Memorial link copied to clipboard!';
        toast.style.cssText = `
          position: fixed;
          bottom: 20px;
          right: 20px;
          background: #6b9174;
          color: white;
          padding: 1rem 1.5rem;
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
          z-index: 9999;
          animation: slideIn 0.3s ease;
        `;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), 3000);
      })
      .catch(() => alert('Please copy this link: ' + url));
  }
};

window.editMemorial = function(memorialId) {
  localStorage.setItem('currentDraftId', memorialId);
  window.location.hash = '#createMemorial';
};

window.showGuestbookForm = function() {
  // This would open a modal or expand a form for leaving a message
  alert('Guestbook form coming soon!');
};

window.loadMoreMemories = function() {
  // This would load additional photos
  console.log('Loading more memories...');
};

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
  section.className = 'page-section';
  section.style.display = 'none';
  
  // Don't add any content here - let displayMemorialDirect handle it
  section.innerHTML = '';
  
  // Find the right place to insert - after the main tag but before footer
  const main = document.querySelector('main');
  if (main) {
    // Insert after main
    main.parentNode.insertBefore(section, main.nextSibling);
  } else {
    // Fallback - insert before footer
    const footer = document.querySelector('footer');
    if (footer) {
      footer.parentNode.insertBefore(section, footer);
    } else {
      // Last resort
      document.body.appendChild(section);
    }
  }
  
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

/* ──────────────────────────────────────────
   MAKE MEMORIAL FUNCTIONS GLOBAL
   ────────────────────────────────────────── */
window.handleRouteChange = handleRouteChange;
window.loadMemorialDirect = loadMemorialDirect;
window.displayMemorialDirect = displayMemorialDirect;
window.loadGuestbookDirect = loadGuestbookDirect;
window.loadMemorialMomentsDirect = loadMemorialMomentsDirect;
window.loadMemorialServicesDirect = loadMemorialServicesDirect;