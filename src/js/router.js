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
    
    // Update window state for backward compatibility
    window.currentUser = user;
    window.currentMemorialId = memorial.id;
    window.isMemorialOwner = (memorial.user_id === currentUserId);
    
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
   DIRECT MEMORIAL DISPLAY - UPDATED TO MATCH EXAMPLE MEMORIAL LAYOUT
   ────────────────────────────────────────── */
function displayMemorialDirect(memorial, container) {
  // Format dates
  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  };
  
  // Get year only for hero display
  const birthYear = memorial.birth_date ? new Date(memorial.birth_date).getFullYear() : '';
  const deathYear = memorial.death_date ? new Date(memorial.death_date).getFullYear() : '';
  
  // Update page title
  document.title = `${memorial.deceased_name} - Memorial | GatherMemorials`;
  
  // Build the memorial HTML using the EXACT same structure as Example Memorial
  container.innerHTML = `
    <section class="memorial-page" id="memorialView">
      <!-- Hero Section - matching exampleMemorial -->
      <div class="memorial-hero" style="background-image: url('${memorial.background_photo_url || 'https://images.unsplash.com/photo-1516475429286-465d815a0df7?w=1200'}');">
        <div class="memorial-hero-overlay"></div>
        <div class="memorial-hero-content">
          <img src="${memorial.profile_photo_url || '/assets/default-avatar.jpg'}" 
               alt="${memorial.deceased_name}" 
               class="memorial-main-photo">
          <h1 class="memorial-main-name">${memorial.deceased_name}</h1>
          <p class="memorial-main-dates">${birthYear} - ${deathYear}</p>
          ${memorial.headline ? `<p class="memorial-headline">"${memorial.headline}"</p>` : ''}
          
          <div class="memorial-hero-actions">
            <button class="memorial-hero-btn" data-action="share-memorial">
              <i class="fas fa-share"></i>
              Share Memorial
            </button>
          </div>
        </div>
      </div>
      
      <!-- Memorial Body -->
      <div class="memorial-body">
        <!-- Tab Navigation -->
        <nav class="memorial-tabs">
          <button class="memorial-tab active" data-tab="about">About</button>
          <button class="memorial-tab" data-tab="gallery">Gallery</button>
          <button class="memorial-tab" data-tab="tributes">Tributes</button>
          <button class="memorial-tab" data-tab="service">Service Info</button>
        </nav>
        
        <!-- Tab Content Wrapper -->
        <div class="memorial-tabs-wrapper">
          <div class="memorial-content">
            <!-- About Tab (default active) -->
            <div class="tab-pane active" id="aboutTab">
              <!-- Opening Statement -->
              ${memorial.opening_statement ? `
                <div class="opening-statement-section">
                  <p class="opening-statement">${memorial.opening_statement}</p>
                </div>
              ` : ''}
              
              <!-- Obituary Section -->
              ${memorial.obituary ? `
                <section class="obituary-section">
                  <div class="obituary-container">
                    <h2 class="obituary-title">Celebrating a Life Well Lived</h2>
                    <div class="obituary-details">
                      ${memorial.obituary}
                    </div>
                  </div>
                </section>
              ` : ''}
              
              <!-- Life Story Section -->
              ${memorial.life_story ? `
                <section class="life-story-section">
                  <h2 class="section-title">Life Story</h2>
                  <div class="life-story-content">
                    ${memorial.life_story}
                  </div>
                </section>
              ` : ''}
              
              <!-- Additional Information -->
              ${memorial.additional_info ? `
                <section class="additional-info-section">
                  <h2>Additional Information</h2>
                  <p>${memorial.additional_info}</p>
                </section>
              ` : ''}
            </div>
            
            <!-- Gallery Tab -->
            <div class="tab-pane" id="galleryTab">
              <h2 class="section-title">Photos & Videos</h2>
              <div id="momentsContent" class="moments-vsco">
                <p class="no-moments-message">No photos or videos have been added yet.</p>
              </div>
            </div>
            
            <!-- Tributes Tab (Guestbook) -->
            <div class="tab-pane" id="tributesTab">
              <section class="guestbook-section">
                <div class="guestbook-container">
                  <h2 class="guestbook-title">Share a Memory</h2>
                  
                  <!-- Leave a Message Form -->
                  ${!window.isMemorialOwner ? `
                    <div class="guestbook-form-card">
                      <form id="guestbookForm" class="guestbook-form">
                        <div class="form-group">
                          <input type="text" id="guestName" placeholder="Your Name" required>
                        </div>
                        <div class="form-group">
                          <input type="email" id="guestEmail" placeholder="Your Email (optional)">
                        </div>
                        <div class="form-group">
                          <textarea id="guestMessage" placeholder="Share a memory or leave a message..." rows="4" required></textarea>
                        </div>
                        <button type="submit" class="btn-primary">
                          <i class="fas fa-paper-plane"></i>
                          Share Memory
                        </button>
                      </form>
                    </div>
                  ` : ''}
                  
                  <!-- Messages Display -->
                  <div id="guestbookEntries" class="guestbook-entries">
                    <p class="no-entries-message">Be the first to share a memory.</p>
                  </div>
                </div>
              </section>
            </div>
            
            <!-- Service Info Tab -->
            <div class="tab-pane" id="serviceTab">
              <section class="service-section">
                <div class="service-container">
                  <h2 class="service-title">Service Information</h2>
                  <div id="servicesContent" class="services-grid">
                    <p class="no-services-message">No service information is available at this time.</p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
      
      <!-- Edit Memorial Button (for owners) -->
      ${window.isMemorialOwner ? `
        <div class="memorial-edit-cta">
          <button class="btn-edit-memorial" onclick="editMemorial('${memorial.id}')">
            <i class="fas fa-edit"></i>
            Edit Memorial
          </button>
        </div>
      ` : ''}
    </section>
  `;
  
  // Now set up tab functionality
  setupMemorialTabs();
  
  // Load additional data
  loadMemorialServices(memorial.id);
  loadMemorialMoments(memorial.id);
  loadGuestbookDirect(memorial.id);
  
  // Set up share functionality
  setupShareFunctionality(memorial);
  
  // Set up guestbook form if user is not owner
  if (!window.isMemorialOwner) {
    setupGuestbookForm(memorial.id);
  }
}

/* ──────────────────────────────────────────
   MEMORIAL TAB FUNCTIONALITY
   ────────────────────────────────────────── */
function setupMemorialTabs() {
  const tabs = document.querySelectorAll('.memorial-tab');
  const panes = document.querySelectorAll('.tab-pane');
  
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      // Remove active class from all tabs and panes
      tabs.forEach(t => t.classList.remove('active'));
      panes.forEach(p => p.classList.remove('active'));
      
      // Add active class to clicked tab
      tab.classList.add('active');
      
      // Show corresponding pane
      const tabName = tab.getAttribute('data-tab');
      const pane = document.getElementById(tabName + 'Tab');
      if (pane) {
        pane.classList.add('active');
      }
    });
  });
}

/* ──────────────────────────────────────────
   SHARE FUNCTIONALITY
   ────────────────────────────────────────── */
function setupShareFunctionality(memorial) {
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="share-memorial"]')) {
      shareMemorial(memorial);
    }
  });
}

function shareMemorial(memorial) {
  const memorialUrl = `${window.location.origin}/#memorial/${memorial.slug || memorial.id}`;
  
  if (navigator.share) {
    navigator.share({
      title: `${memorial.deceased_name} - Memorial`,
      text: `Visit the memorial page for ${memorial.deceased_name}`,
      url: memorialUrl
    });
  } else {
    // Fallback to copying to clipboard
    navigator.clipboard.writeText(memorialUrl).then(() => {
      import('@/utils/ui.js').then(({ showNotification }) => {
        showNotification('Memorial link copied to clipboard!', 'success');
      });
    });
  }
}

/* ──────────────────────────────────────────
   MEMORIAL DATA LOADERS
   ────────────────────────────────────────── */
async function loadMemorialServices(memorialId) {
  try {
    const supabase = getClient();
    const { data: services, error } = await supabase
      .from('memorial_services')
      .select('*')
      .eq('memorial_id', memorialId)
      .order('service_date', { ascending: true });
    
    if (error) throw error;
    
    const container = document.getElementById('servicesContent');
    if (!container) return;
    
    if (services && services.length > 0) {
      container.innerHTML = services.map(service => {
        const serviceDate = new Date(service.service_date);
        const formattedDate = serviceDate.toLocaleDateString('en-US', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        
        return `
          <div class="service-card ${service.is_virtual ? 'virtual-service' : ''}">
            <div class="service-icon">
              <i class="fas ${service.is_virtual ? 'fa-video' : 'fa-location-dot'}"></i>
            </div>
            <h3>${service.service_type.replace('_', ' ').toUpperCase()}</h3>
            <p class="service-date">${formattedDate}</p>
            <p class="service-time">${formatTime(service.start_time)} - ${formatTime(service.end_time)}</p>
            ${service.location_name ? `<p class="service-location">${service.location_name}</p>` : ''}
            ${service.address ? `<p class="service-address">${service.address}</p>` : ''}
            ${service.virtual_meeting_link ? `
              <a href="${service.virtual_meeting_link}" target="_blank" class="virtual-link">
                <i class="fas fa-video"></i> Join Virtual Service
              </a>
            ` : ''}
            ${service.additional_info ? `<p class="service-info">${service.additional_info}</p>` : ''}
          </div>
        `;
      }).join('');
    }
  } catch (error) {
    console.error('Error loading services:', error);
  }
}

async function loadMemorialMoments(memorialId) {
  try {
    const supabase = getClient();
    const { data: moments, error } = await supabase
      .from('memorial_moments')
      .select('*')
      .eq('memorial_id', memorialId)
      .order('display_order', { ascending: true });
    
    if (error) throw error;
    
    const container = document.getElementById('momentsContent');
    if (!container) return;
    
    if (moments && moments.length > 0) {
      container.innerHTML = moments.map(moment => `
        <div class="moment-vsco">
          <img src="${moment.url}" alt="${moment.caption || 'Memorial moment'}">
          ${moment.caption ? `<p class="moment-caption-vsco">${moment.caption}</p>` : ''}
          ${moment.date_taken ? `<p class="moment-date-vsco">${formatDate(moment.date_taken)}</p>` : ''}
        </div>
      `).join('');
      
      // Add click handler for moment details
      container.addEventListener('click', (e) => {
        const card = e.target.closest('.moment-vsco');
        if (card) {
          viewMomentDetail(card);
        }
      });
    }
  } catch (error) {
    console.error('Error loading moments:', error);
  }
}

async function loadGuestbookDirect(memorialId) {
  try {
    const supabase = getClient();
    const { data: entries, error } = await supabase
      .from('guestbook_entries')
      .select('*')
      .eq('memorial_id', memorialId)
      .eq('is_approved', true)
      .order('created_at', { ascending: false });
    
    if (error) throw error;
    
    const container = document.getElementById('guestbookEntries');
    if (!container) return;
    
    if (entries && entries.length > 0) {
      container.innerHTML = entries.map(entry => `
        <div class="guestbook-entry">
          <div class="guestbook-entry-header">
            <h4 class="guestbook-entry-author">${entry.author_name}</h4>
            <time class="guestbook-entry-date">${new Date(entry.created_at).toLocaleDateString()}</time>
          </div>
          <p class="guestbook-entry-message">${entry.message}</p>
        </div>
      `).join('');
    }
  } catch (error) {
    console.error('Error loading guestbook:', error);
  }
}

/* ──────────────────────────────────────────
   GUESTBOOK FORM SETUP
   ────────────────────────────────────────── */
function setupGuestbookForm(memorialId) {
  const form = document.getElementById('guestbookForm');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const name = document.getElementById('guestName').value;
    const email = document.getElementById('guestEmail').value;
    const message = document.getElementById('guestMessage').value;
    
    try {
      const supabase = getClient();
      const { error } = await supabase
        .from('guestbook_entries')
        .insert({
          memorial_id: memorialId,
          author_name: name,
          author_email: email || null,
          message: message,
          is_approved: true // Auto-approve for now
        });
      
      if (error) throw error;
      
      // Clear form
      form.reset();
      
      // Show success message
      import('@/utils/ui.js').then(({ showNotification }) => {
        showNotification('Your memory has been shared. Thank you.', 'success');
      });
      
      // Reload guestbook entries
      loadGuestbookDirect(memorialId);
      
    } catch (error) {
      console.error('Error submitting guestbook entry:', error);
      import('@/utils/ui.js').then(({ showNotification }) => {
        showNotification('Error sharing memory. Please try again.', 'error');
      });
    }
  });
}

/* ──────────────────────────────────────────
   HELPER FUNCTIONS
   ────────────────────────────────────────── */
function formatTime(timeStr) {
  if (!timeStr) return '';
  const [hours, minutes] = timeStr.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
  return `${displayHour}:${minutes} ${ampm}`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
}

function viewMomentDetail(card) {
  const img = card.querySelector('img');
  const date = card.querySelector('.moment-date-vsco')?.textContent || '';
  const caption = card.querySelector('.moment-caption-vsco')?.textContent || '';

  const modal = document.createElement('div');
  modal.className = 'modal';
  modal.style.display = 'block';
  modal.innerHTML = `
    <div class="modal-content" style="max-width:900px;">
      <div class="modal-header">
        <h2>${caption || 'Memorial Moment'}</h2>
        <button class="close-modal">&times;</button>
      </div>
      <img src="${img.src}" style="width:100%;border-radius:10px;margin-bottom:1rem;">
      <p style="text-align:center;color:var(--text-secondary);">${date}</p>
    </div>`;
  
  document.body.appendChild(modal);
  document.body.style.overflow = 'hidden';

  // Close handlers
  modal.querySelector('.close-modal').addEventListener('click', () => {
    modal.remove();
    document.body.style.overflow = 'auto';
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.remove();
      document.body.style.overflow = 'auto';
    }
  });
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
window.editMemorial = function(memorialId) {
  localStorage.setItem('currentDraftId', memorialId);
  window.location.hash = '#createMemorial';
};

/* ──────────────────────────────────────────
   MAKE MEMORIAL FUNCTIONS GLOBAL
   ────────────────────────────────────────── */
window.handleRouteChange = handleRouteChange;
window.loadMemorialDirect = loadMemorialDirect;
window.displayMemorialDirect = displayMemorialDirect;
window.loadGuestbookDirect = loadGuestbookDirect;