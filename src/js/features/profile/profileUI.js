/*  src/js/features/profile/profileUI.js  */
import { showNotification, qs } from '@/utils/ui.js';
import { getClient } from '@/api/supabaseClient.js';
import { showNotification, qs, setButtonLoading } from '@/utils/ui.js';

let supabase;

/* ──────────────────────────────────────────
   PUBLIC API
   ────────────────────────────────────────── */
export async function initProfilePage() {
  supabase = getClient();

  // Listen for auth state changes
  document.addEventListener('auth:state', maybeLoadProfile);
  
  // Listen for hash changes
  window.addEventListener('hashchange', maybeLoadProfile);
  
  // Initial load
  maybeLoadProfile();

  // Delegated click handlers for photo upload and account deletion
  qs('#profile')?.addEventListener('click', (e) => {
    if (e.target.closest('.profile-photo-edit')) {
      uploadProfilePhoto();
    } else if (e.target.closest('[data-action="delete-account"]')) {
      confirmDeleteAccount();
    }
  });

  // Form submission handler
  qs('#profileSettingsForm')?.addEventListener('submit', updateProfile);
}

/* ──────────────────────────────────────────
   TAB SWITCHER
   ────────────────────────────────────────── */
export function switchProfileTab(tab) {
  // Update tab buttons
  document.querySelectorAll('.profile-tab').forEach((t) => t.classList.remove('active'));
  event.target.closest('.profile-tab').classList.add('active');

  // Update tab content
  document.querySelectorAll('.profile-tab-content').forEach((c) => c.classList.remove('active'));
  const tabContent = document.getElementById(`${tab}Tab`);
  if (tabContent) {
    tabContent.classList.add('active');
    tabContent.style.display = 'block';
    
    // Hide other tabs
    document.querySelectorAll('.profile-tab-content').forEach((c) => {
      if (c.id !== `${tab}Tab`) {
        c.style.display = 'none';
      }
    });
  }
}

// Make it globally available for onclick handlers
window.switchProfileTab = switchProfileTab;

/* ──────────────────────────────────────────
   LOAD PROFILE DATA
   ────────────────────────────────────────── */
async function maybeLoadProfile() {
  if (location.hash !== '#profile') return;
  
// ADD LOADING STATE
  const profileContent = qs('.profile-content');
  if (profileContent) {
    profileContent.innerHTML = `
      <div class="loading-container">
        <div class="loading-spinner">
          <i class="fas fa-spinner fa-spin"></i>
        </div>
        <p>Loading profile<span class="loading-dots"></span></p>
      </div>
    `;
  }
  // END LOADING STATE

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    showNotification('Please sign in to view your profile', 'error');
    window.location.hash = '#home';
    return;
  }

  try {
    // Load profile data
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
      throw error;
    }

    // If no profile exists, create one
    if (!profile) {
      const { data: newProfile, error: createError } = await supabase
        .from('profiles')
        .insert({
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || '',
          name: user.user_metadata?.name || ''
        })
        .select()
        .single();

      if (createError) throw createError;
      renderProfile(newProfile, user);
    } else {
      renderProfile(profile, user);
    }
    
    // Also load user's memorials
    await loadUserMemorials();
    
  } catch (err) {
    console.error('Error loading profile:', err);
    showNotification('Unable to load profile', 'error');
  }
}

/* ──────────────────────────────────────────
   RENDER PROFILE DATA
   ────────────────────────────────────────── */
function renderProfile(profile, user) {
  // Update profile display
  const nameEl = qs('#profileName');
  const emailEl = qs('#profileEmail');
 const photoEl = qs('#profilePhotoLarge');
  
  if (nameEl) {
    nameEl.textContent = profile.full_name || profile.name || 'Your Name';
  }
  
  if (emailEl) {
    emailEl.textContent = user.email || profile.email || '';
  }
  
  if (photoEl && profile.avatar_url) {
    photoEl.src = profile.avatar_url;
  }
  
  // Update form fields
 // Update settings form fields
const settingsNameInput = qs('#settingsName');
const settingsEmailInput = qs('#settingsEmail');

if (settingsNameInput) {
  settingsNameInput.value = profile.full_name || profile.name || '';
}

if (settingsEmailInput) {
  settingsEmailInput.value = user.email || profile.email || '';
}
  
  // Update navigation profile photo/initial
  updateNavProfile(profile, user);
}

/* ──────────────────────────────────────────
   UPDATE NAVIGATION PROFILE
   ────────────────────────────────────────── */
function updateNavProfile(profile, user) {
  const navAvatar = qs('#userAvatar');
  const navInitial = qs('#navProfileInitial');
  
  if (profile.avatar_url && navAvatar) {
    navAvatar.src = profile.avatar_url;
    navAvatar.style.display = 'block';
    if (navInitial) navInitial.style.display = 'none';
  } else if (navInitial) {
    const name = profile.full_name || profile.name || user.email || 'U';
    navInitial.textContent = name.charAt(0).toUpperCase();
    navInitial.style.display = 'flex';
    if (navAvatar) navAvatar.style.display = 'none';
  }
}

/* ──────────────────────────────────────────
   UPDATE PROFILE
   ────────────────────────────────────────── */
async function updateProfile(e) {
  e.preventDefault();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const btn = e.target.querySelector('button[type="submit"]');
  const originalText = btn.textContent;
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

  const nameValue = qs('#settingsName')?.value.trim();
  
  const profileUpdate = {
    full_name: nameValue || null,
    name: nameValue || null,
    updated_at: new Date().toISOString()
  };

  try {
    const { error } = await supabase
      .from('profiles')
      .update(profileUpdate)
      .eq('id', user.id);
      
    if (error) throw error;
    
    showNotification('Profile updated successfully', 'success');
    
    // Update the display name in the profile header
    const profileNameEl = qs('#profileName');
    if (profileNameEl) {
      profileNameEl.textContent = nameValue || 'Your Name';
    }
    
    // Update the nav profile initial if needed
    const navInitial = qs('#navProfileInitial');
    if (navInitial && nameValue) {
      navInitial.textContent = nameValue.charAt(0).toUpperCase();
    }
    
    // Reload profile to show updated data
    maybeLoadProfile();
    
  } catch (err) {
    console.error('Error updating profile:', err);
    showNotification('Failed to update profile', 'error');
  } finally {
    setButtonLoading(btn, false);  // 🔴 CHANGED THIS
  }
}

// Make it globally available for onclick handlers
window.updateProfile = updateProfile;


// Make confirmDeleteAccount globally available
window.confirmDeleteAccount = async function() {
  const confirmed = confirm(
    'Are you sure you want to delete your account?\n\n' +
    'This action cannot be undone. All your memorials and data will be permanently deleted.'
  );
  
  if (!confirmed) return;
  
  // Double confirmation for safety
  const doubleConfirmed = confirm(
    'This is your final warning!\n\n' +
    'Your account and all memorials will be PERMANENTLY DELETED.\n\n' +
    'Are you absolutely sure?'
  );
  
  if (!doubleConfirmed) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    showNotification('Deleting account...', 'info');
    
    // Sign out first
    await supabase.auth.signOut();
    
    // In production, you'd call your edge function here to delete all user data
    // const { error } = await supabase.functions.invoke('delete-user-account', {
    //   body: { userId: user.id }
    // });
    
    showNotification('Account deleted successfully', 'success');
    window.location.hash = '#home';
    
  } catch (err) {
    console.error('Error deleting account:', err);
    showNotification('Unable to delete account. Please contact support.', 'error');
  }
};























/* ──────────────────────────────────────────
   PHOTO UPLOAD
   ────────────────────────────────────────── */
function uploadProfilePhoto() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  
  input.onchange = async ({ target }) => {
    const file = target.files?.[0];
    if (!file) return;
    
    // Validate file
    if (!file.type.startsWith('image/')) {
      showNotification('Please select an image file', 'error');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      showNotification('Image must be less than 5MB', 'error');
      return;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Show loading state
    const photoEl = qs('#profilePhoto');
    const originalSrc = photoEl?.src;
    if (photoEl) {
      photoEl.style.opacity = '0.5';
    }

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${user.id}/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ 
          avatar_url: urlData.publicUrl,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (updateError) throw updateError;

      // Update UI
      if (photoEl) {
        photoEl.src = urlData.publicUrl;
        photoEl.style.opacity = '1';
      }
      
      // Update nav avatar
      const navAvatar = qs('#userAvatar');
      if (navAvatar) {
        navAvatar.src = urlData.publicUrl;
        navAvatar.style.display = 'block';
        const navInitial = qs('#navProfileInitial');
        if (navInitial) navInitial.style.display = 'none';
      }

      showNotification('Profile photo updated', 'success');
      
    } catch (err) {
      console.error('Error uploading photo:', err);
      showNotification('Failed to upload photo', 'error');
      
      // Restore original photo on error
      if (photoEl && originalSrc) {
        photoEl.src = originalSrc;
        photoEl.style.opacity = '1';
      }
    }
  };
  
  input.click();
}

/* ──────────────────────────────────────────
   LOAD USER'S MEMORIALS
   ────────────────────────────────────────── */
async function loadUserMemorials() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    const { data: memorials, error } = await supabase
      .from('memorials')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;
    
    displayUserMemorials(memorials);
  } catch (error) {
    console.error('Error loading memorials:', error);
  }
}

/* ──────────────────────────────────────────
   DISPLAY USER'S MEMORIALS
   ────────────────────────────────────────── */
function displayUserMemorials(memorials) {
  const container = qs('#userMemorials');
  if (!container) return;

  if (!memorials || memorials.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <i class="fas fa-heart"></i>
        <h3>No memorials yet</h3>
        <p>Create your first memorial to honor a loved one.</p>
        
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="memorials-grid">
      ${memorials.map(memorial => {
        const link = `#memorial/${memorial.slug || memorial.id}`;
        const statusClass = memorial.is_published ? 'published' : 'draft';
        const statusText = memorial.is_published ? 'Published' : 'Draft';
        
        // Format dates
        const birthYear = memorial.birth_date ? new Date(memorial.birth_date).getFullYear() : '';
        const deathYear = memorial.death_date ? new Date(memorial.death_date).getFullYear() : '';
        const dateRange = (birthYear || deathYear) ? `${birthYear} - ${deathYear}` : '';
        
        return `
          <div class="memorial-card ${statusClass}">
            <a href="${link}" class="memorial-card-link">
              <div class="memorial-card-image">
                ${memorial.profile_photo_url ? `
                  <img src="${memorial.profile_photo_url}" alt="${memorial.deceased_name}">
                ` : `
                  <div class="placeholder-image">
                    <i class="fas fa-user"></i>
                  </div>
                `}
              </div>
              <div class="memorial-card-content">
                <h3>${memorial.deceased_name}</h3>
                ${dateRange ? `<p class="memorial-dates">${dateRange}</p>` : ''}
                <span class="status-badge ${statusClass}">${statusText}</span>
              </div>
            </a>
            <div class="memorial-card-actions">
              ${memorial.is_published ? `
                <button onclick="shareMemorial('${link}')" class="btn-icon" title="Share">
                  <i class="fas fa-share"></i>
                </button>
              ` : ''}
              <button onclick="editMemorial('${memorial.id}')" class="btn-icon" title="Edit">
                <i class="fas fa-edit"></i>
              </button>
              ${!memorial.is_published ? `
                <button onclick="continueEditing('${memorial.id}')" class="btn-secondary btn-small">
                  <i class="fas fa-arrow-right"></i> Continue Editing
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('')}
    </div>
    
    <div class="memorials-footer">
      <button class="btn-primary" onclick="window.goToCreateMemorial()">
        <i class="fas fa-plus"></i> Create New Memorial
      </button>
    </div>
  `;
}

/* ──────────────────────────────────────────
   MEMORIAL ACTIONS
   ────────────────────────────────────────── */
window.shareMemorial = function(link) {
  const fullUrl = window.location.origin + link;
  
  if (navigator.share) {
    navigator.share({
      title: 'Memorial Page',
      text: 'View this memorial page',
      url: fullUrl
    }).catch(err => {
      // User cancelled or error
      if (err.name !== 'AbortError') {
        copyToClipboard(fullUrl);
      }
    });
  } else {
    copyToClipboard(fullUrl);
  }
};

window.editMemorial = function(memorialId) {
  localStorage.setItem('currentDraftId', memorialId);
  window.location.hash = '#createMemorial';
};

window.continueEditing = function(memorialId) {
  localStorage.setItem('currentDraftId', memorialId);
  window.location.hash = '#createMemorial';
};

function copyToClipboard(text) {
  navigator.clipboard.writeText(text)
    .then(() => showNotification('Link copied to clipboard', 'success'))
    .catch(() => {
      // Fallback for older browsers
      const input = document.createElement('input');
      input.value = text;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showNotification('Link copied to clipboard', 'success');
    });
}

/* ──────────────────────────────────────────
   DELETE ACCOUNT
   ────────────────────────────────────────── */
async function confirmDeleteAccount() {
  const confirmed = confirm(
    'Are you sure you want to delete your account?\n\n' +
    'This action cannot be undone. All your memorials and data will be permanently deleted.'
  );
  
  if (!confirmed) return;
  
  // Double confirmation for safety
  const doubleConfirmed = confirm(
    'This is your final warning!\n\n' +
    'Your account and all memorials will be PERMANENTLY DELETED.\n\n' +
    'Are you absolutely sure?'
  );
  
  if (!doubleConfirmed) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    // Note: You'll need to create a database function or edge function
    // to properly delete the user and all their data
    // For now, we'll just delete from auth
    
    showNotification('Deleting account...', 'info');
    
    // Sign out first
    await supabase.auth.signOut();
    
   // Get the current session
const { data: { session } } = await supabase.auth.getSession();

if (!session) {
  throw new Error('No active session');
}

// Call the edge function
const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/delete-user-account`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${session.access_token}`,
    'Content-Type': 'application/json'
  }
});

if (!response.ok) {
  const error = await response.json();
  throw new Error(error.error || 'Failed to delete account');
}
    
    showNotification('Account deleted successfully', 'success');
    window.location.hash = '#home';
    
  } catch (err) {
    console.error('Error deleting account:', err);
    showNotification('Unable to delete account. Please contact support.', 'error');
  }
}

/* ──────────────────────────────────────────
   INITIALIZATION CHECK
   ────────────────────────────────────────── */
// Check if we're on profile page on load
if (window.location.hash === '#profile') {
  document.addEventListener('DOMContentLoaded', () => {
    initProfilePage();
  });
}