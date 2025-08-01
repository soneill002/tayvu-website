/* src/js/features/memorials/memorialView.js */
import { getClient } from '@/api/supabaseClient.js';
import { showNotification, qs, formatDate } from '@/utils/ui.js';
import { loadGuestbookEntries, subscribeToGuestbookUpdates, unsubscribeFromGuestbook } from '../guestbook.js';
import { showPasswordPrompt, showPasswordError, showAccessGranted } from '@/utils/passwordModal.js';

// Store subscription for cleanup
let guestbookSubscription = null;

/* ──────────────────────────────────────────
   PUBLIC API - Initialize Memorial View
   ────────────────────────────────────────── */
export async function initMemorialView(memorialId) {
  const supabase = getClient();
  if (!supabase) {
    showNotification('Service unavailable', 'error');
    return;
  }

  // Show loading state
  showLoadingState();

  try {
    // Use the RPC function to get by slug or ID
    const { data: memorials, error } = await supabase
      .rpc('get_memorial', { identifier: memorialId });

    if (error) throw error;
    
    if (!memorials || memorials.length === 0) {
      showNotification('Memorial not found', 'error');
      window.location.hash = '#home';
      return;
    }

    const memorial = memorials[0];
    
    // Check if memorial is published or user is owner
    if (!memorial.is_published && memorial.user_id !== window.currentUser?.id) {
      showNotification('This memorial is not yet published', 'error');
      window.location.hash = '#home';
      return;
    }
    
    // PASSWORD PROTECTION CHECK
    // Check if memorial is private and user is not the owner
    if (memorial.privacy_setting === 'private' && memorial.user_id !== window.currentUser?.id) {
      // Check if we have a valid password in session storage
      const sessionKey = `memorial_access_${memorial.id}`;
      const hasAccess = sessionStorage.getItem(sessionKey);
      
      if (!hasAccess) {
        // Hide loading state while showing password prompt
        hideLoadingState();
        
        let attempts = 0;
        const maxAttempts = 3;
        let accessGranted = false;
        
        while (attempts < maxAttempts && !accessGranted) {
          // Prompt for password
          const enteredPassword = await showPasswordPrompt(memorial.deceased_name);
          
          if (!enteredPassword) {
            // User cancelled
            showNotification('Access denied', 'error');
            window.location.hash = '#home';
            return;
          }
          
          // Verify password (simple comparison - in production, use hashing)
          if (enteredPassword === memorial.access_password) {
            // Password correct!
            accessGranted = true;
            sessionStorage.setItem(sessionKey, 'granted');
            showAccessGranted(memorial.deceased_name);
            
            // Show loading state again before continuing
            showLoadingState();
          } else {
            // Password incorrect
            attempts++;
            
            if (attempts < maxAttempts) {
              const tryAgain = await showPasswordError();
              if (!tryAgain) {
                // User chose not to try again
                showNotification('Access denied', 'error');
                window.location.hash = '#home';
                return;
              }
            } else {
              // Max attempts reached
              showNotification('Maximum password attempts exceeded', 'error');
              window.location.hash = '#home';
              return;
            }
          }
        }
        
        if (!accessGranted) {
          // Shouldn't reach here, but just in case
          window.location.hash = '#home';
          return;
        }
      }
    }
    // END PASSWORD PROTECTION CHECK
    
    // Store memorial ID and ownership globally for other components
    window.currentMemorialId = memorial.id;
    window.isMemorialOwner = (memorial.user_id === window.currentUser?.id);
    
    // Increment view count (only for non-owners)
    if (!window.isMemorialOwner) {
      await supabase.rpc('increment_memorial_views', { memorial_id: memorial.id });
    }
    
    // Load all memorial data in parallel
    await Promise.all([
      displayMemorial(memorial),
      loadMemorialMoments(memorial.id),
      loadMemorialServices(memorial.id),
      loadGuestbookEntries(memorial.id)
    ]);
    
    // Subscribe to real-time guestbook updates
    guestbookSubscription = subscribeToGuestbookUpdates(memorial.id);
    
    // Hide loading state
    hideLoadingState();
    
  } catch (error) {
    console.error('Error loading memorial:', error);
    showNotification('Error loading memorial', 'error');
    hideLoadingState();
  }
}

/* ──────────────────────────────────────────
   DISPLAY MEMORIAL INFORMATION
   ────────────────────────────────────────── */
async function displayMemorial(memorial) {
  // Update page title
  document.title = `${memorial.deceased_name} - Memorial | GatherMemorials`;
  
  // Update memorial header
  const nameEl = qs('#memorialName');
  if (nameEl) nameEl.textContent = memorial.deceased_name;
  
  // Format and display dates
  const birthYear = memorial.birth_date ? new Date(memorial.birth_date).getFullYear() : '';
  const deathYear = memorial.death_date ? new Date(memorial.death_date).getFullYear() : '';
  
  const datesEl = qs('#memorialDates');
  if (datesEl && (birthYear || deathYear)) {
    datesEl.textContent = `${birthYear} - ${deathYear}`;
  }
  
  // Display full dates in info section
  const birthDateEl = qs('#memorialBirthDate');
  const deathDateEl = qs('#memorialDeathDate');
  
  if (birthDateEl && memorial.birth_date) {
    birthDateEl.textContent = formatDate(memorial.birth_date);
  }
  
  if (deathDateEl && memorial.death_date) {
    deathDateEl.textContent = formatDate(memorial.death_date);
  }
  
  // Set photos with fallbacks
  const profilePhotoEl = qs('#memorialProfilePhoto');
  if (profilePhotoEl) {
    profilePhotoEl.src = memorial.profile_photo_url || '/assets/default-avatar.jpg';
    profilePhotoEl.alt = memorial.deceased_name;
  }
  
  const backgroundPhotoEl = qs('#memorialBackgroundPhoto');
  if (backgroundPhotoEl) {
    backgroundPhotoEl.src = memorial.background_photo_url || '/assets/default-memorial-bg.jpg';
    backgroundPhotoEl.style.objectFit = 'cover';
  }
  
  // Set obituary and life story
  const obituaryEl = qs('#memorialObituary');
  if (obituaryEl) {
    if (memorial.obituary) {
      obituaryEl.innerHTML = memorial.obituary;
      qs('.obituary-section')?.classList.remove('hidden');
    } else {
      qs('.obituary-section')?.classList.add('hidden');
    }
  }
  
  const lifeStoryEl = qs('#memorialLifeStory');
  if (lifeStoryEl) {
    if (memorial.life_story) {
      lifeStoryEl.innerHTML = memorial.life_story;
      qs('.life-story-section')?.classList.remove('hidden');
    } else {
      qs('.life-story-section')?.classList.add('hidden');
    }
  }
  
  // Show privacy badge if not public
  if (memorial.privacy_setting !== 'public') {
    const privacyBadge = `<span class="privacy-badge ${memorial.privacy_setting}">${memorial.privacy_setting}</span>`;
    nameEl?.insertAdjacentHTML('afterend', privacyBadge);
  }
  
  // Check if user is owner and show controls
  if (window.isMemorialOwner) {
    showOwnerControls(memorial);
  }
  
  // Show share button
  showShareButton(memorial);
  
  // Update meta tags for social sharing
  updateMetaTags(memorial);
}

/* ──────────────────────────────────────────
   LOAD AND DISPLAY MOMENTS
   ────────────────────────────────────────── */
async function loadMemorialMoments(memorialId) {
  const supabase = getClient();
  
  try {
    const { data: moments, error } = await supabase
      .from('memorial_moments')
      .select('*')
      .eq('memorial_id', memorialId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    
    displayMoments(moments);
  } catch (error) {
    console.error('Error loading moments:', error);
  }
}

function displayMoments(moments) {
  const grid = qs('#memorialMomentsGrid');
  const section = qs('.moments-section');
  
  if (!grid || !section) return;
  
  if (!moments || moments.length === 0) {
    section.classList.add('hidden');
    return;
  }
  
  section.classList.remove('hidden');
  
  grid.innerHTML = moments.map(moment => {
    const isVideo = moment.type === 'video';
    const displayUrl = moment.thumbnail_url || moment.url;
    
    return `
      <div class="moment-item ${isVideo ? 'video-moment' : ''}" 
           data-moment-id="${moment.id}"
           onclick="openMomentViewer('${moment.id}')">
        ${isVideo ? `
          <div class="video-thumbnail">
            <img src="${displayUrl}" 
                 alt="${moment.caption || 'Memorial moment'}"
                 loading="lazy">
            <div class="video-play-overlay">
              <i class="fas fa-play-circle"></i>
            </div>
          </div>
        ` : `
          <img src="${displayUrl}" 
               alt="${moment.caption || 'Memorial moment'}"
               loading="lazy">
        `}
        ${moment.caption ? `
          <div class="moment-caption">
            <p>${moment.caption}</p>
            ${moment.date_taken ? `<span class="moment-date">${formatDate(moment.date_taken)}</span>` : ''}
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
  
  // Store moments globally for viewer
  window.memorialMoments = moments;
}

/* ──────────────────────────────────────────
   MOMENT VIEWER MODAL
   ────────────────────────────────────────── */
window.openMomentViewer = function(momentId) {
  const moment = window.memorialMoments?.find(m => m.id === momentId);
  if (!moment) return;
  
  const modal = document.createElement('div');
  modal.className = 'moment-viewer-modal';
  modal.innerHTML = `
    <div class="moment-viewer-content">
      <button class="close-viewer" onclick="this.closest('.moment-viewer-modal').remove()">
        <i class="fas fa-times"></i>
      </button>
      <div class="moment-viewer-media">
        ${moment.type === 'video' ? `
          <video controls autoplay>
            <source src="${moment.url}" type="video/mp4">
            Your browser does not support video playback.
          </video>
        ` : `
          <img src="${moment.url}" alt="${moment.caption || 'Memorial moment'}">
        `}
      </div>
      ${moment.caption || moment.date_taken ? `
        <div class="moment-viewer-info">
          ${moment.caption ? `<p class="moment-caption">${moment.caption}</p>` : ''}
          ${moment.date_taken ? `<span class="moment-date">${formatDate(moment.date_taken)}</span>` : ''}
        </div>
      ` : ''}
    </div>
  `;
  
  document.body.appendChild(modal);
  
  // Close on backdrop click
  modal.addEventListener('click', (e) => {
    if (e.target === modal) modal.remove();
  });
  
  // Close on escape key
  const handleEscape = (e) => {
    if (e.key === 'Escape') {
      modal.remove();
      document.removeEventListener('keydown', handleEscape);
    }
  };
  document.addEventListener('keydown', handleEscape);
};

/* ──────────────────────────────────────────
   LOAD AND DISPLAY SERVICES
   ────────────────────────────────────────── */
async function loadMemorialServices(memorialId) {
  const supabase = getClient();
  
  try {
    const { data: services, error } = await supabase
      .from('memorial_services')
      .select('*')
      .eq('memorial_id', memorialId)
      .order('service_date', { ascending: true });

    if (error) throw error;
    
    displayServices(services);
  } catch (error) {
    console.error('Error loading services:', error);
  }
}

function displayServices(services) {
  const container = qs('#memorialServices');
  const section = qs('.services-section');
  
  if (!container || !section) return;
  
  if (!services || services.length === 0) {
    section.classList.add('hidden');
    return;
  }
  
  section.classList.remove('hidden');
  
  container.innerHTML = services.map(service => {
    const date = service.service_date ? new Date(service.service_date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    }) : '';
    
    const serviceType = service.service_type
      ?.replace(/_/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase());
    
    // Check if service is in the future
    const isFuture = service.service_date && new Date(service.service_date) > new Date();
    
    return `
      <div class="service-card ${isFuture ? 'upcoming-service' : 'past-service'}">
        <div class="service-header">
          <h4>${serviceType || 'Memorial Service'}</h4>
          ${isFuture ? '<span class="upcoming-badge">Upcoming</span>' : ''}
        </div>
        <div class="service-details">
          ${date ? `
            <p class="service-datetime">
              <i class="fas fa-calendar"></i> ${date}
              ${service.service_time ? `at ${formatTime(service.service_time)}` : ''}
            </p>
          ` : ''}
          
          ${service.location_name ? `
            <p class="service-location">
              <i class="fas fa-location-dot"></i> ${service.location_name}
            </p>
          ` : ''}
          
          ${service.location_address ? `
            <p class="service-address">
              ${service.location_address}${service.location_city ? `, ${service.location_city}` : ''}${service.location_state ? `, ${service.location_state}` : ''}${service.location_zip ? ` ${service.location_zip}` : ''}
            </p>
          ` : ''}
          
          ${service.location_details ? `
            <p class="service-directions">
              <i class="fas fa-route"></i> ${service.location_details}
            </p>
          ` : ''}
          
          ${service.is_virtual ? `
            <div class="virtual-service-info">
              <p><i class="fas fa-video"></i> Virtual Service Available</p>
              ${service.virtual_meeting_url && isFuture ? `
                <a href="${service.virtual_meeting_url}" target="_blank" class="btn-secondary btn-small">
                  <i class="fas fa-external-link-alt"></i> Join Virtual Service
                </a>
              ` : ''}
              ${service.virtual_meeting_id ? `
                <p class="meeting-id">Meeting ID: ${service.virtual_meeting_id}</p>
              ` : ''}
            </div>
          ` : ''}
          
          ${service.additional_info ? `
            <p class="service-info">${service.additional_info}</p>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

/* ──────────────────────────────────────────
   OWNER CONTROLS
   ────────────────────────────────────────── */
function showOwnerControls(memorial) {
  const header = qs('.memorial-header');
  if (!header) return;
  
  const controls = document.createElement('div');
  controls.className = 'owner-controls';
  controls.innerHTML = `
    <button class="btn-secondary" onclick="editMemorial('${memorial.id}')">
      <i class="fas fa-edit"></i> Edit Memorial
    </button>
    <button class="btn-secondary" onclick="viewAnalytics('${memorial.id}')">
      <i class="fas fa-chart-line"></i> Analytics
    </button>
    ${memorial.is_published ? `
      <button class="btn-secondary" onclick="unpublishMemorial('${memorial.id}')">
        <i class="fas fa-eye-slash"></i> Unpublish
      </button>
    ` : `
      <button class="btn-primary" onclick="publishMemorial('${memorial.id}')">
        <i class="fas fa-eye"></i> Publish
      </button>
    `}
  `;
  
  header.appendChild(controls);
}

/* ──────────────────────────────────────────
   SHARE FUNCTIONALITY
   ────────────────────────────────────────── */
function showShareButton(memorial) {
  const header = qs('.memorial-header');
  if (!header) return;
  
  const shareBtn = document.createElement('button');
  shareBtn.className = 'btn-share';
  shareBtn.innerHTML = '<i class="fas fa-share"></i> Share';
  shareBtn.onclick = () => shareMemorial(memorial);
  
  header.appendChild(shareBtn);
}

function shareMemorial(memorial) {
  const url = `${window.location.origin}#memorial/${memorial.slug || memorial.id}`;
  const title = `${memorial.deceased_name} - Memorial`;
  const text = `View the memorial page for ${memorial.deceased_name}`;
  
  if (navigator.share) {
    navigator.share({ title, text, url })
      .catch(err => {
        if (err.name !== 'AbortError') {
          copyToClipboard(url);
        }
      });
  } else {
    // Fallback - show share modal
    showShareModal(url, title);
  }
}

function showShareModal(url, title) {
  const modal = document.createElement('div');
  modal.className = 'modal share-modal';
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h3>Share Memorial</h3>
        <button class="close-modal" onclick="this.closest('.modal').remove()">
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="share-options">
        <button onclick="shareToFacebook('${url}', '${title}')" class="share-btn facebook">
          <i class="fab fa-facebook"></i> Facebook
        </button>
        <button onclick="shareToTwitter('${url}', '${title}')" class="share-btn twitter">
          <i class="fab fa-twitter"></i> Twitter
        </button>
        <button onclick="shareToEmail('${url}', '${title}')" class="share-btn email">
          <i class="fas fa-envelope"></i> Email
        </button>
      </div>
      <div class="share-link">
        <input type="text" value="${url}" readonly id="shareUrl">
        <button onclick="copyShareLink()" class="btn-secondary">
          <i class="fas fa-copy"></i> Copy Link
        </button>
      </div>
    </div>
  `;
  
  document.body.appendChild(modal);
}

/* ──────────────────────────────────────────
   UTILITY FUNCTIONS
   ────────────────────────────────────────── */
function formatTime(timeString) {
  if (!timeString) return '';
  const [hours, minutes] = timeString.split(':');
  const hour = parseInt(hours);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${minutes} ${ampm}`;
}

function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => showNotification('Link copied to clipboard', 'success'))
    .catch(() => showNotification('Failed to copy link', 'error'));
}

function updateMetaTags(memorial) {
  // Update Open Graph tags for social sharing
  const updateMetaTag = (property, content) => {
    let tag = document.querySelector(`meta[property="${property}"]`);
    if (!tag) {
      tag = document.createElement('meta');
      tag.setAttribute('property', property);
      document.head.appendChild(tag);
    }
    tag.setAttribute('content', content);
  };
  
  updateMetaTag('og:title', `${memorial.deceased_name} - Memorial`);
  updateMetaTag('og:description', `View the memorial page for ${memorial.deceased_name}`);
  updateMetaTag('og:image', memorial.profile_photo_url || '/assets/default-memorial-share.jpg');
  updateMetaTag('og:url', `${window.location.origin}#memorial/${memorial.slug || memorial.id}`);
  updateMetaTag('og:type', 'website');
}

function showLoadingState() {
  const container = qs('#memorialView');
  if (container) {
    container.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner">
          <i class="fas fa-spinner fa-spin"></i>
        </div>
        <p>Loading memorial<span class="loading-dots"></span></p>
      </div>
    `;
  }
}

// Add skeleton loading function
function showSkeletonLoading() {
  const container = qs('#memorialView');
  if (container) {
    container.innerHTML = `
      <div class="memorial-page">
        <div class="memorial-header-section">
          <div class="skeleton-loader">
            <div class="skeleton-image"></div>
            <div class="skeleton-header"></div>
            <div class="skeleton-text short"></div>
          </div>
        </div>
        <div class="memorial-content">
          <div class="skeleton-loader">
            <div class="skeleton-text"></div>
            <div class="skeleton-text"></div>
            <div class="skeleton-text short"></div>
          </div>
        </div>
      </div>
    `;
  }
}

function hideLoadingState() {
  // This will be called after content is loaded
  // The content will replace the loading state
}

/* ──────────────────────────────────────────
   GLOBAL FUNCTIONS
   ────────────────────────────────────────── */
window.editMemorial = function(memorialId) {
  localStorage.setItem('currentDraftId', memorialId);
  window.location.hash = '#createMemorial';
};

window.viewAnalytics = function(memorialId) {
  // TODO: Implement analytics view
  showNotification('Analytics coming soon', 'info');
};

window.unpublishMemorial = async function(memorialId) {
  if (!confirm('Are you sure you want to unpublish this memorial? It will no longer be visible to others.')) return;
  
  const supabase = getClient();
  try {
    const { error } = await supabase
      .from('memorials')
      .update({ is_published: false })
      .eq('id', memorialId)
      .eq('user_id', window.currentUser.id);
      
    if (error) throw error;
    
    showNotification('Memorial unpublished', 'success');
    window.location.hash = '#profile';
  } catch (error) {
    console.error('Error unpublishing:', error);
    showNotification('Failed to unpublish memorial', 'error');
  }
};

window.publishMemorial = async function(memorialId) {
  const supabase = getClient();
  try {
    const { error } = await supabase
      .from('memorials')
      .update({ 
        is_published: true,
        published_at: new Date().toISOString()
      })
      .eq('id', memorialId)
      .eq('user_id', window.currentUser.id);
      
    if (error) throw error;
    
    showNotification('Memorial published!', 'success');
    location.reload(); // Refresh to show updated state
  } catch (error) {
    console.error('Error publishing:', error);
    showNotification('Failed to publish memorial', 'error');
  }
};

window.shareToFacebook = function(url, title) {
  window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank');
};

window.shareToTwitter = function(url, title) {
  window.open(`https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`, '_blank');
};

window.shareToEmail = function(url, title) {
  window.location.href = `mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(`View this memorial: ${url}`)}`;
};

window.copyShareLink = function() {
  const input = qs('#shareUrl');
  input.select();
  copyToClipboard(input.value);
};

/* ──────────────────────────────────────────
   CLEANUP
   ────────────────────────────────────────── */
export function cleanupMemorialView() {
  // Unsubscribe from real-time updates
  if (guestbookSubscription) {
    unsubscribeFromGuestbook(guestbookSubscription);
    guestbookSubscription = null;
  }
  
  // Clear global variables
  window.currentMemorialId = null;
  window.isMemorialOwner = false;
  window.memorialMoments = null;
}