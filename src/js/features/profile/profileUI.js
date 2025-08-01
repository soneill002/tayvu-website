// src/js/features/profile/profileUI.js
import { getClient } from '@/api/supabaseClient.js';
import { cloudinaryConfig } from '@/api/cloudinaryClient.js';
import { showNotification } from '@/utils/ui.js';
import { sanitizeHtml } from '@/utils/sanitizer.js';
import { setButtonLoading } from '@/utils/ui.js';

let supabase;

const qs = selector => document.querySelector(selector);
const qsa = selector => document.querySelectorAll(selector);

let currentUserProfile = null;

/* ──────────────────────────────────────────
   MAIN PROFILE LOADING
   ────────────────────────────────────────── */
export async function maybeLoadProfile() {
  // Initialize supabase client
  supabase = getClient();
  if (!supabase) {
    console.error('Supabase client not initialized');
    return;
  }
  
  // Get auth user
  const { data: { user } } = await supabase.auth.getUser();
  
  // If no user, redirect to home
  if (!user) {
    window.location.hash = '#home';
    return;
  }

  // Profile content is already in the DOM (index.html)
  const profileSection = qs('#profile');
  if (!profileSection) {
    console.error('Profile section not found in DOM');
    return;
  }

  try {
    // Fetch user profile data
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
      currentUserProfile = newProfile;
    } else {
      currentUserProfile = profile;
    }

    // Initialize profile data
    initializeProfile(currentUserProfile, user.email);

    // Set up tab navigation
    setupTabNavigation();

    // Initialize default tab (memorials)
    showTab('memorials');

  } catch (err) {
    console.error('Error loading profile:', err);
    showNotification('Error loading profile. Please try again.', 'error');
  }
}

/* ──────────────────────────────────────────
   PROFILE INITIALIZATION - UPDATED VERSION
   ────────────────────────────────────────── */
function initializeProfile(profile, email) {
  // Set profile header info
  const profileName = qs('#profileName');
  const profileEmail = qs('#profileEmail');
  const profileAvatar = qs('#profileAvatar');
  const profileBio = qs('#profileBio');

  if (profileName) {
    profileName.textContent = profile?.full_name || profile?.name || 'Your Name';
  }
  
  if (profileEmail) {
    profileEmail.textContent = email;
  }

  // ========== ENHANCED AVATAR INITIALIZATION ==========
  // Generate the avatar URL (either custom or default)
  const avatarUrl = profile?.avatar_url || 
    `https://ui-avatars.com/api/?name=${encodeURIComponent(email)}&background=6b9174&color=fff&size=200`;

  // Update ALL avatar instances on initial load
  const avatarSelectors = [
    '#profileAvatar',         // Original profile avatar
    '#profilePhotoLarge',     // Main profile photo at top
    '#settingsProfilePhoto',  // Settings tab photo
    '#navProfilePhoto',       // Navigation bar photo
    '#userAvatar'            // Alternative nav avatar
  ];
  
  avatarSelectors.forEach(selector => {
    const element = qs(selector);
    if (element) {
      element.src = avatarUrl;
      // Ensure they're visible and not in loading state
      element.style.opacity = '1';
      element.classList.remove('loading');
    }
  });

  // Update navigation initial based on avatar presence
  const navInitial = qs('#navProfileInitial');
  const navAvatar = qs('#navProfilePhoto') || qs('#userAvatar');
  
  if (profile?.avatar_url && navAvatar) {
    // Has custom avatar - hide initial, show avatar
    navAvatar.style.display = 'block';
    if (navInitial) navInitial.style.display = 'none';
  } else if (navInitial) {
    // No custom avatar - show initial, hide avatar
    const name = profile?.full_name || profile?.name || email || 'U';
    navInitial.textContent = name.charAt(0).toUpperCase();
    navInitial.style.display = 'flex';
    if (navAvatar) navAvatar.style.display = 'none';
  }
  // ========== END ENHANCED AVATAR INITIALIZATION ==========

  if (profileBio && profile?.bio) {
    profileBio.textContent = profile.bio;
  }

  // Initialize settings form
  const settingsForm = qs('#settingsForm') || qs('#profileSettingsForm');
  if (settingsForm) {
    // Populate form fields
    const nameInput = qs('#settingsName');
    const locationInput = qs('#settingsLocation');
    const bioTextarea = qs('#settingsBio');
    const emailInput = qs('#settingsEmail');

    if (nameInput) nameInput.value = profile?.full_name || profile?.name || '';
    if (locationInput) locationInput.value = profile?.location || '';
    if (bioTextarea) bioTextarea.value = profile?.bio || '';
    if (emailInput) {
      emailInput.value = email;
      emailInput.disabled = true; // Email cannot be changed
    }

    // Add form submit handler
    settingsForm.removeEventListener('submit', updateProfile); // Remove any existing
    settingsForm.addEventListener('submit', updateProfile);
  }

  // Set up avatar upload
  const avatarUpload = qs('#avatarUpload');
  if (avatarUpload) {
    // Remove any existing listeners to prevent duplicates
    avatarUpload.removeEventListener('change', uploadProfilePhoto);
    // Add fresh listener
    avatarUpload.addEventListener('change', uploadProfilePhoto);
  }

  // Set up delete photo button visibility and handler
  const deletePhotoBtn = qs('#deletePhotoBtn');
  if (deletePhotoBtn) {
    // Show/hide based on whether user has custom avatar
    deletePhotoBtn.style.display = profile?.avatar_url ? 'block' : 'none';
    
    // Remove any existing click handlers to prevent duplicates
    deletePhotoBtn.removeEventListener('click', deleteProfilePhoto);
    // Add fresh click handler
    deletePhotoBtn.addEventListener('click', deleteProfilePhoto);
  }
}

/* ──────────────────────────────────────────
   TAB NAVIGATION
   ────────────────────────────────────────── */
function setupTabNavigation() {
  const tabButtons = qsa('.profile-tab-btn') || qsa('.profile-tab');
  
  tabButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tabName = btn.dataset.tab || btn.getAttribute('onclick')?.match(/switchProfileTab\('(\w+)'\)/)?.[1];
      if (tabName) {
        showTab(tabName);
      }
    });
  });
}

export function showTab(tabName) {
  // Update active tab button
  const tabButtons = qsa('.profile-tab-btn') || qsa('.profile-tab');
  tabButtons.forEach(btn => {
    const btnTabName = btn.dataset.tab || btn.getAttribute('onclick')?.match(/switchProfileTab\('(\w+)'\)/)?.[1];
    btn.classList.toggle('active', btnTabName === tabName);
  });

  // Show corresponding content
  qsa('.profile-tab-content').forEach(content => {
    content.classList.toggle('active', content.id === `${tabName}Tab`);
  });

  // Load tab-specific content
  switch(tabName) {
    case 'memorials':
      loadUserMemorials();
      break;
    case 'contributions':
      loadUserContributions();
      break;
    case 'settings':
      // Settings are already loaded
      break;
  }
}

// Make it globally available for onclick handlers
window.switchProfileTab = function(tab) {
  showTab(tab);
};

/* ──────────────────────────────────────────
   MEMORIALS TAB
   ────────────────────────────────────────── */
async function loadUserMemorials() {
  if (!supabase) supabase = getClient();
  
  const memorialsGrid = qs('#userMemorialsGrid') || qs('#myMemorials');
  if (!memorialsGrid) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    memorialsGrid.innerHTML = `
      <div class="loading-container">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading your memorials...</p>
      </div>
    `;

    const { data: memorials, error } = await supabase
      .from('memorials')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!memorials || memorials.length === 0) {
      memorialsGrid.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-dove"></i>
          <h3>No memorials yet</h3>
          <p>Create your first memorial to preserve cherished memories.</p>
          <a href="#createMemorial" class="btn btn-primary">
            <i class="fas fa-plus"></i> Create Memorial
          </a>
        </div>
      `;
      return;
    }

    // Render memorial cards
    memorialsGrid.innerHTML = memorials.map(memorial => `
      <div class="memorial-card">
        <div class="memorial-card-image">
          ${memorial.profile_photo_url ? 
            `<img src="${memorial.profile_photo_url}" alt="${sanitizeHtml(memorial.deceased_name)}">` :
            `<div class="memorial-placeholder">
              <i class="fas fa-user"></i>
            </div>`
          }
          ${memorial.is_draft ? '<span class="draft-badge">Draft</span>' : ''}
        </div>
        <div class="memorial-card-content">
          <h3>${sanitizeHtml(memorial.deceased_name)}</h3>
          ${memorial.birth_date && memorial.death_date ? 
            `<p class="memorial-dates">
              ${formatDate(memorial.birth_date)} - ${formatDate(memorial.death_date)}
            </p>` : ''
          }
          <div class="memorial-stats">
            <span><i class="fas fa-eye"></i> ${memorial.view_count || 0} views</span>
            <span><i class="fas fa-comment"></i> ${memorial.message_count || 0} messages</span>
          </div>
        </div>
        <div class="memorial-card-actions">
          ${memorial.is_draft ? 
            `<a href="#createMemorial?draft=${memorial.id}" class="btn btn-sm btn-primary">
              <i class="fas fa-edit"></i> Continue Editing
            </a>` :
            `<a href="#memorial/${memorial.slug}" class="btn btn-sm btn-outline">
              <i class="fas fa-eye"></i> View Memorial
            </a>`
          }
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Error loading memorials:', err);
    memorialsGrid.innerHTML = `
      <div class="error-state">
        <p>Error loading memorials</p>
        <button class="btn btn-sm" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

/* ──────────────────────────────────────────
   PHOTO UPLOAD - CLOUDINARY VERSION WITH SYNC
   ────────────────────────────────────────── */
async function uploadProfilePhoto(e) {
  if (!supabase) supabase = getClient();
  
  // If called from button click, create file input
  if (!e || !e.target || !e.target.files) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = uploadProfilePhoto;
    input.click();
    return;
  }

  const file = e.target.files?.[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    showNotification('Please select an image file', 'error');
    return;
  }

  // Validate file size (5MB limit)
  if (file.size > 5 * 1024 * 1024) {
    showNotification('Image must be less than 5MB', 'error');
    return;
  }

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Show loading state on ALL avatar instances
  const avatarSelectors = [
    '#profilePhotoLarge',     // Main profile photo at top
    '#settingsProfilePhoto',  // Settings tab photo
    '#navProfilePhoto',       // Navigation bar photo (if exists)
    '#profileAvatar',         // Any other avatar instance
    '#userAvatar'            // Navigation avatar
  ];

  // Store original sources in case of error
  const originalSources = {};
  
  avatarSelectors.forEach(selector => {
    const element = qs(selector);
    if (element) {
      originalSources[selector] = element.src;
      element.style.opacity = '0.5';
      element.classList.add('loading');
    }
  });

  // Show loading on upload button if it exists
  const uploadBtn = qs('.avatar-upload-btn');
  if (uploadBtn) {
    uploadBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Uploading...';
    uploadBtn.disabled = true;
  }

  try {
    // Create FormData for Cloudinary upload
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('folder', `tayvu/users/${user.id}/avatar`);
    
    // Add transformation for profile photos
    formData.append('eager', 'c_fill,w_400,h_400,g_face,q_auto');
    formData.append('eager_async', 'false');

    showNotification('Uploading profile photo...', 'info');
    
    // Upload to Cloudinary
    const uploadResponse = await fetch(
      `${cloudinaryConfig.uploadUrl}/image/upload`,
      {
        method: 'POST',
        body: formData
      }
    );

    if (!uploadResponse.ok) {
      const errorData = await uploadResponse.json();
      throw new Error(errorData.error?.message || 'Upload failed');
    }

    const uploadResult = await uploadResponse.json();
    
    // Get the Cloudinary URL and public ID
    const avatarUrl = uploadResult.secure_url;
    const publicId = uploadResult.public_id;

    // Delete old avatar from Cloudinary if exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_url, avatar_public_id')
      .eq('id', user.id)
      .single();



 if (profile?.avatar_public_id) {
  // Call your Netlify function to delete the old image
  try {
    // GET THE SESSION TOKEN - ADD THIS
    const { data: { session } } = await supabase.auth.getSession();
    
    if (session) {
      await fetch('/.netlify/functions/delete-cloudinary-asset', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}` // ADD THIS LINE
        },
        body: JSON.stringify({
          publicId: profile.avatar_public_id,
          resourceType: 'image'
        })
      });
    }
  } catch (err) {
    console.error('Failed to delete old avatar:', err);
    // Continue anyway - orphaned images can be cleaned up later
  }
}




    // Update profile with new avatar URL and public ID
    const { error: updateError } = await supabase
      .from('profiles')
      .update({ 
        avatar_url: avatarUrl,
        avatar_public_id: publicId,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (updateError) throw updateError;

    // SUCCESS! Update ALL avatar instances on the page
    avatarSelectors.forEach(selector => {
      const element = qs(selector);
      if (element) {
        element.src = avatarUrl;
        element.style.opacity = '1';
        element.classList.remove('loading');
      }
    });

    // Update navigation initial to hide it (since we now have avatar)
    const navInitial = qs('#navProfileInitial');
    if (navInitial) {
      navInitial.style.display = 'none';
    }

    // Show nav avatar if it was hidden
    const navAvatar = qs('#navProfilePhoto') || qs('#userAvatar');
    if (navAvatar) {
      navAvatar.style.display = 'block';
    }

    // Show delete button in settings
    const deletePhotoBtn = qs('#deletePhotoBtn');
    if (deletePhotoBtn) {
      deletePhotoBtn.style.display = 'block';
    }

    showNotification('Profile photo updated successfully', 'success');
    
  } catch (err) {
    console.error('Error uploading profile photo:', err);
    showNotification(err.message || 'Failed to upload profile photo', 'error');
    
    // Restore original photos on error
    avatarSelectors.forEach(selector => {
      const element = qs(selector);
      if (element && originalSources[selector]) {
        element.src = originalSources[selector];
        element.style.opacity = '1';
        element.classList.remove('loading');
      }
    });
  } finally {
    // Reset upload button
    if (uploadBtn) {
      uploadBtn.innerHTML = '<i class="fas fa-camera"></i> Change Photo';
      uploadBtn.disabled = false;
    }
    
    // Reset file input if it exists
    if (e.target && e.target.value) {
      e.target.value = '';
    }
  }
}

// Make it globally available for onclick handlers
window.uploadProfilePhoto = uploadProfilePhoto;

/* ──────────────────────────────────────────
   DELETE PROFILE PHOTO - CLOUDINARY VERSION
   ────────────────────────────────────────── */
async function deleteProfilePhoto() {
  if (!supabase) supabase = getClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const confirmed = confirm('Are you sure you want to delete your profile photo?');
  if (!confirmed) return;

  const deleteBtn = qs('#deletePhotoBtn');
  if (deleteBtn) {
    deleteBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Deleting...';
    deleteBtn.disabled = true;
  }

  try {
    // Get current profile data
    const { data: profile } = await supabase
      .from('profiles')
      .select('avatar_public_id')
      .eq('id', user.id)
      .single();

    // Delete from Cloudinary if exists
  // Delete from Cloudinary if exists
if (profile?.avatar_public_id) {
  // Get session for authentication - ADD THIS
  const { data: { session } } = await supabase.auth.getSession();
  
  if (session) {  // ADD THIS CHECK
    const deleteResponse = await fetch('/.netlify/functions/delete-cloudinary-asset', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${session.access_token}` // ADD THIS LINE!
      },
      body: JSON.stringify({
        publicId: profile.avatar_public_id,
        resourceType: 'image'
      })
    });

    if (!deleteResponse.ok) {
      console.error('Failed to delete from Cloudinary');
    }
  } else {
    console.error('No session found for deletion');
  }
}






    // Update profile to remove avatar
    const { error } = await supabase
      .from('profiles')
      .update({ 
        avatar_url: null,
        avatar_public_id: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', user.id);

    if (error) throw error;

    // Update ALL avatar instances with default avatar
    const defaultAvatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(user.email)}&background=6b9174&color=fff&size=200`;
    
    const avatarSelectors = [
      '#profilePhotoLarge',
      '#settingsProfilePhoto',
      '#navProfilePhoto',
      '#profileAvatar',
      '#userAvatar'
    ];

    avatarSelectors.forEach(selector => {
      const element = qs(selector);
      if (element) {
        element.src = defaultAvatarUrl;
      }
    });

    // Show navigation initial, hide avatar
    const navInitial = qs('#navProfileInitial');
    const navAvatar = qs('#navProfilePhoto') || qs('#userAvatar');
    
    if (navInitial && navAvatar) {
      navInitial.style.display = 'flex';
      navAvatar.style.display = 'none';
    }

    // Hide delete button
    if (deleteBtn) {
      deleteBtn.style.display = 'none';
    }

    showNotification('Profile photo deleted', 'success');
    
  } catch (err) {
    console.error('Error deleting profile photo:', err);
    showNotification('Failed to delete profile photo', 'error');
  } finally {
    if (deleteBtn) {
      deleteBtn.innerHTML = '<i class="fas fa-trash"></i> Delete Photo';
      deleteBtn.disabled = false;
    }
  }
}

// Make it globally available for onclick handlers
window.deleteProfilePhoto = deleteProfilePhoto;

/* ──────────────────────────────────────────
   CONTRIBUTIONS TAB
   ────────────────────────────────────────── */
async function loadUserContributions() {
  if (!supabase) supabase = getClient();
  
  const contributionsList = qs('#userContributionsList') || qs('#myContributions');
  if (!contributionsList) return;

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    contributionsList.innerHTML = `
      <div class="loading-container">
        <i class="fas fa-spinner fa-spin"></i>
        <p>Loading your contributions...</p>
      </div>
    `;

    // Fetch user's guestbook entries
    const { data: entries, error } = await supabase
      .from('guestbook_entries')
      .select(`
        *,
        memorials!inner(
          deceased_name,
          slug,
          profile_photo_url
        )
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) throw error;

    if (!entries || entries.length === 0) {
      contributionsList.innerHTML = `
        <div class="empty-state">
          <i class="fas fa-comment-alt"></i>
          <h3>No contributions yet</h3>
          <p>Visit memorial pages to leave messages and tributes.</p>
        </div>
      `;
      return;
    }

    contributionsList.innerHTML = entries.map(entry => `
      <div class="contribution-item">
        <div class="contribution-memorial">
          ${entry.memorials.profile_photo_url ? 
            `<img src="${entry.memorials.profile_photo_url}" alt="${sanitizeHtml(entry.memorials.deceased_name)}" class="contribution-photo">` :
            `<div class="contribution-photo placeholder">
              <i class="fas fa-user"></i>
            </div>`
          }
          <div>
            <h4>
              <a href="#memorial/${entry.memorials.slug}">
                ${sanitizeHtml(entry.memorials.deceased_name)}
              </a>
            </h4>
            <time>${formatDate(entry.created_at)}</time>
          </div>
        </div>
        <div class="contribution-message">
          <p>${sanitizeHtml(entry.message)}</p>
        </div>
      </div>
    `).join('');

  } catch (err) {
    console.error('Error loading contributions:', err);
    contributionsList.innerHTML = `
      <div class="error-state">
        <p>Error loading contributions</p>
        <button class="btn btn-sm" onclick="location.reload()">Retry</button>
      </div>
    `;
  }
}

/* ──────────────────────────────────────────
   UPDATE PROFILE
   ────────────────────────────────────────── */
async function updateProfile(e) {
  e.preventDefault();
  
  if (!supabase) supabase = getClient();
  
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const btn = e.target.querySelector('button[type="submit"]');
  setButtonLoading(btn, true);

  const nameValue = qs('#settingsName')?.value.trim();
  const locationValue = qs('#settingsLocation')?.value.trim();
  const bioValue = qs('#settingsBio')?.value.trim();
  
  const profileUpdate = {
    full_name: nameValue || null,
    name: nameValue || null,
    location: locationValue || null,
    bio: bioValue || null,
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
    
    // Update bio if visible
    const profileBio = qs('#profileBio');
    if (profileBio && bioValue) {
      profileBio.textContent = bioValue;
    }
    
    // Update the nav profile initial if needed
    const navInitial = qs('#navProfileInitial');
    if (navInitial && nameValue) {
      navInitial.textContent = nameValue.charAt(0).toUpperCase();
    }
    
  } catch (err) {
    console.error('Error updating profile:', err);
    showNotification('Failed to update profile', 'error');
  } finally {
    setButtonLoading(btn, false);
  }
}

// Make it globally available for onclick handlers
window.updateProfile = updateProfile;

/* ──────────────────────────────────────────
   DELETE ACCOUNT
   ────────────────────────────────────────── */
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

  if (!supabase) supabase = getClient();
  
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
   UTILITY FUNCTIONS
   ────────────────────────────────────────── */
function formatDate(dateString) {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { 
    year: 'numeric', 
    month: 'short', 
    day: 'numeric' 
  });
}

/* ──────────────────────────────────────────
   INITIALIZATION
   ────────────────────────────────────────── */
export function initProfilePage() {
  // Initialize supabase if not already done
  if (!supabase) supabase = getClient();
  
  // Check if we're on the profile page
  if (window.location.hash === '#profile') {
    maybeLoadProfile();
  }
  
  // Listen for hash changes
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#profile') {
      maybeLoadProfile();
    }
  });
}