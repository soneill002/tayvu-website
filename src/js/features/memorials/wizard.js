/*  src/js/features/memorials/wizard.js  */
let clickHandlerBound = false;
import {
  showNotification,
  qs,
  showToast
} from '@/utils/ui.js';
import { MemorialSanitizer } from '@/utils/sanitizer.js';
import { cloudinaryConfig } from '@/api/cloudinaryClient.js';
import { getClient } from '@/api/supabaseClient.js';
import { handleError, withErrorHandling, retryOperation } from '@/utils/errorHandler.js';

/* ──────────────────────────────────────────
     STATE
     ────────────────────────────────────────── */
let currentStep = 1;
// Always count however many .form-step panels you actually have
let totalSteps = 0;

const memorialData = {
  basic: {},
  story: {},
  services: [],
  moments: [],
  settings: {}
};

/* ──────────────────────────────────────────
     PUBLIC API
     ────────────────────────────────────────── */
export const initWizard = withErrorHandling(async function() {
  console.log('initWizard() called from features/memorials/wizard.js');
  
  // Check if we're on the correct page
  const createMemorialSection = document.getElementById('createMemorial');
  if (!createMemorialSection || !createMemorialSection.classList.contains('active')) {
    console.log('Create memorial section not active, skipping initialization');
    return;
  }
  
  try {
    // Count total steps
    totalSteps = document.querySelectorAll('.form-step').length;
    if (totalSteps === 0) {
      throw new Error('No form steps found');
    }
    
    // Wire up delegated event handlers
    wireDelegatedClicks();
    
    // Set up photo upload handlers
    wirePhotoUploadHandlers();
    
    // Initialize moments board
    wireMoments();
    
    // Set up privacy password handlers
    setupPrivacyHandlers();

    // IMPORTANT: Check if we should load a draft
    // Only load draft if there's a currentDraftId in localStorage
    // This prevents auto-loading drafts when user clicks "Create Memorial"
    const currentDraftId = localStorage.getItem('currentDraftId');
    const memorialDraft = localStorage.getItem('memorialDraft');
    
    // Load from Supabase if we have a draft ID
    if (currentDraftId && window.currentUser) {
      console.log('Loading draft from Supabase...');
      const loaded = await loadDraftFromSupabase();
      if (loaded) {
        showToast('Draft loaded', 'success');
      }
    } 
    // Load from localStorage if we have a local draft but no Supabase draft
    else if (memorialDraft && !currentDraftId) {
      console.log('Loading draft from localStorage...');
      loadDraft();
      showToast('Draft loaded from local storage', 'success');
    }
    // Otherwise, start fresh
    else {
      console.log('Starting new memorial...');
      resetWizard();
    }
    
    // Always update progress to show current step
    updateProgress();
    updatePreview();
  } catch (error) {
    handleError(error, 'Initialize Wizard');
  }
}, 'Initialize Wizard');

export { nextStep, previousStep }; // consumed elsewhere if needed

/* ──────────────────────────────────────────
     CLOUDINARY UPLOAD FUNCTIONS
     ────────────────────────────────────────── */
const uploadImage = withErrorHandling(async function(type) {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  
  input.onchange = async ({ target }) => {
    const file = target.files?.[0];
    if (!file) return;
    
    // Validate file
    if (!file.type.startsWith('image/')) {
      showToast('Please select an image file', 'error');
      return;
    }
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit for profile/background
      showToast('Image size must be less than 10MB', 'error');
      return;
    }
    
    try {
      showToast('Uploading image...', 'info');
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', cloudinaryConfig.uploadPreset);
      
      // Use memorial ID if available, otherwise use 'draft'
      const memorialId = window.currentMemorialId || 'draft';
      formData.append('folder', `tayvu/memorials/${memorialId}/${type}`);
      
      // Use retry logic for upload
      const response = await retryOperation(async () => {
        const res = await fetch(
          `${cloudinaryConfig.uploadUrl}/image/upload`,
          { method: 'POST', body: formData }
        );
        
        if (!res.ok) {
          throw new Error(`Upload failed: ${res.statusText}`);
        }
        
        return res;
      }, 3, 2000);
      
      const data = await response.json();
      
      // Update preview based on type
      if (type === 'profile') {
        const preview = qs('#profilePhotoPreview');
        if (preview) {
          // Apply profile photo transformation
          const transformedUrl = cloudinaryConfig.getTransformedUrl(
            data.secure_url,
            cloudinaryConfig.transformations.profilePhoto
          );
          preview.src = transformedUrl;
          preview.style.display = 'block';
          preview.dataset.publicId = data.public_id;
          preview.dataset.originalUrl = data.secure_url;
        }
      } else if (type === 'background') {
        const preview = qs('#backgroundPhotoPreview');
        if (preview) {
          // Apply background transformation
          const transformedUrl = cloudinaryConfig.getTransformedUrl(
            data.secure_url,
            cloudinaryConfig.transformations.backgroundImage
          );
          preview.src = transformedUrl;
          preview.style.display = 'block';
          preview.dataset.publicId = data.public_id;
          preview.dataset.originalUrl = data.secure_url;
        }
      }
      
      showToast('Image uploaded successfully!', 'success');
      
    } catch (error) {
      console.error('Upload error:', error);
      handleError(error, 'Image Upload');
    }
  };
  
  input.click();
}, 'Upload Image');

// Make uploadImage globally available for onclick handlers
window.uploadImage = uploadImage;

// Function to select default background
function selectDefaultBackground(bgUrl) {
  try {
    const preview = qs('#backgroundPhotoPreview');
    if (preview) {
      preview.src = bgUrl;
      preview.style.display = 'block';
      preview.dataset.isDefault = 'true';
    }
    
    // Update UI to show selection
    document.querySelectorAll('.default-bg-option').forEach(opt => {
      opt.classList.remove('selected');
    });
    event.target.closest('.default-bg-option')?.classList.add('selected');
  } catch (error) {
    handleError(error, 'Select Background');
  }
}

// Make it globally available
window.selectDefaultBackground = selectDefaultBackground;


// Function to add a new service item
function addServiceItem() {
  try {
    const serviceItemsContainer = document.getElementById('serviceItems');
    if (!serviceItemsContainer) return;
    
    // Count existing service items
    const existingServices = serviceItemsContainer.querySelectorAll('.service-item-form').length;
    const serviceNumber = existingServices + 1;
    
    // Create new service item HTML
    const newServiceHTML = `
      <div class="service-item-form">
        <div class="service-header">
          <h3>Service ${serviceNumber}</h3>
          <button type="button" class="btn-remove" onclick="removeServiceItem(this)">
            <i class="fas fa-times"></i>
          </button>
        </div>
        <div class="form-grid">
          <div class="form-group">
            <label>Service Type</label>
            <select name="serviceType">
              <option value="">Select type...</option>
              <option value="viewing">Viewing & Visitation</option>
              <option value="funeral">Funeral Service</option>
              <option value="memorial">Memorial Service</option>
              <option value="celebration">Celebration of Life</option>
              <option value="reception">Reception</option>
              <option value="burial">Burial</option>
            </select>
          </div>
          <div class="form-group">
            <label>Date</label>
            <input type="date" name="serviceDate" />
          </div>
          <div class="form-group">
            <label>Time</label>
            <input type="time" name="serviceTime" />
          </div>
          <div class="form-group">
            <label>Location Name</label>
            <input type="text" name="locationName" placeholder="e.g., St. Mary's Church" />
          </div>
          <div class="form-group full-width">
            <label>Address</label>
            <input type="text" name="locationAddress" placeholder="Full address" />
          </div>
          <div class="form-group full-width">
            <label>Additional Information (Optional)</label>
            <textarea name="additionalInfo" rows="2" placeholder="Any special instructions or details..."></textarea>
          </div>
        </div>
      </div>
    `;
    
    // Add the new service item to the container
    serviceItemsContainer.insertAdjacentHTML('beforeend', newServiceHTML);
    
    // Scroll to the new service item
    const newServiceItem = serviceItemsContainer.lastElementChild;
    newServiceItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (error) {
    handleError(error, 'Add Service Item');
  }
}

// Function to remove a service item
function removeServiceItem(button) {
  try {
    const serviceItem = button.closest('.service-item-form');
    if (serviceItem) {
      // Don't remove if it's the only service item
      const allServiceItems = document.querySelectorAll('.service-item-form');
      if (allServiceItems.length > 1) {
        serviceItem.remove();
        
        // Renumber remaining services
        renumberServices();
      } else {
        showToast('At least one service must remain', 'info');
      }
    }
  } catch (error) {
    handleError(error, 'Remove Service Item');
  }
}

// Function to renumber services after adding/removing
function renumberServices() {
  const serviceItems = document.querySelectorAll('.service-item-form');
  serviceItems.forEach((item, index) => {
    const header = item.querySelector('h3');
    if (header) {
      header.textContent = `Service ${index + 1}`;
    }
  });
}

// Make functions globally available
window.addServiceItem = addServiceItem;
window.removeServiceItem = removeServiceItem;

// Date validation function for inline HTML handlers
function validateDates() {
  try {
    const birthDateInput = document.getElementById('birthDate');
    const deathDateInput = document.getElementById('deathDate');
    const birthDateError = document.getElementById('birthDateError');
    const deathDateError = document.getElementById('deathDateError');
    
    if (!birthDateInput || !deathDateInput) return;
    
    const birthDate = birthDateInput.value ? new Date(birthDateInput.value) : null;
    const deathDate = deathDateInput.value ? new Date(deathDateInput.value) : null;
    const today = new Date();
    
    // Clear previous errors
    if (birthDateError) {
      birthDateError.style.display = 'none';
      birthDateError.textContent = '';
    }
    if (deathDateError) {
      deathDateError.style.display = 'none';
      deathDateError.textContent = '';
    }
    
    // Remove error classes
    birthDateInput.classList.remove('error');
    deathDateInput.classList.remove('error');
    
    // Validate birth date
    if (birthDate) {
      if (birthDate > today) {
        if (birthDateError) {
          birthDateError.textContent = 'Birth date cannot be in the future';
          birthDateError.style.display = 'block';
        }
        birthDateInput.classList.add('error');
        return false;
      }
      
      // If both dates exist, check if birth is before death
      if (deathDate && birthDate > deathDate) {
        if (birthDateError) {
          birthDateError.textContent = 'Birth date must be before death date';
          birthDateError.style.display = 'block';
        }
        birthDateInput.classList.add('error');
        return false;
      }
    }
    
    // Validate death date
    if (deathDate) {
      if (deathDate > today) {
        if (deathDateError) {
          deathDateError.textContent = 'Death date cannot be in the future';
          deathDateError.style.display = 'block';
        }
        deathDateInput.classList.add('error');
        return false;
      }
      
      // If both dates exist, check if death is after birth
      if (birthDate && deathDate < birthDate) {
        if (deathDateError) {
          deathDateError.textContent = 'Death date must be after birth date';
          deathDateError.style.display = 'block';
        }
        deathDateInput.classList.add('error');
        return false;
      }
    }
    
    // Set max date for birth date (can't be after death date if death date is set)
    if (deathDate) {
      birthDateInput.max = deathDateInput.value;
    } else {
      birthDateInput.max = today.toISOString().split('T')[0];
    }
    
    // Set min date for death date (can't be before birth date if birth date is set)
    if (birthDate) {
      deathDateInput.min = birthDateInput.value;
    }
    
    // Set max date for death date (can't be in the future)
    deathDateInput.max = today.toISOString().split('T')[0];
    
    return true;
  } catch (error) {
    console.error('Error in validateDates:', error);
    // Don't show error to user, just log it
    return true;
  }
}

// Make validateDates globally available for the HTML onchange/oninput handlers
window.validateDates = validateDates;


/* ──────────────────────────────────────────
   DRAFT MANAGEMENT WITH SUPABASE
   ────────────────────────────────────────── */
const saveDraftToSupabase = withErrorHandling(async function() {
  const supabase = getClient();
  if (!supabase) {
    console.log('Cannot save draft - Supabase not initialized');
    return;
  }

  // CRITICAL FIX: Use supabase.auth.getUser() instead of window.currentUser
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    console.log('Cannot save draft - user not authenticated');
    return;
  }

  try {
    // Prepare draft data
    const draftData = {
      user_id: user.id,  // FIXED: Use user.id from supabase.auth.getUser()
      deceased_name: memorialData.basic.name || 'Untitled Memorial',
      birth_date: memorialData.basic.birthDate || null,
      death_date: memorialData.basic.deathDate || null,
      headline: memorialData.basic.headline || null,
      opening_statement: memorialData.basic.openingStatement || null,
      additional_info: memorialData.additionalInfo || null,
      profile_photo_url: qs('#profilePhotoPreview')?.src || null,
      profile_photo_public_id: qs('#profilePhotoPreview')?.dataset.publicId || null,
      background_photo_url: qs('#backgroundPhotoPreview')?.src || null,
      background_photo_public_id: qs('#backgroundPhotoPreview')?.dataset.publicId || null,
      obituary: memorialData.story.obituary || '',
      life_story: memorialData.story.lifeStory || '',
      privacy_setting: memorialData.settings.privacy || 'public',
      access_password: memorialData.settings.password || null,
      is_published: false,
      is_draft: true
    };

    // Check if we already have a draft ID
    let draftId = localStorage.getItem('currentDraftId');
    
    // Use retry logic for save operation
    await retryOperation(async () => {
      if (draftId) {
        // Update existing draft
        const { error } = await supabase
          .from('memorials')
          .update(draftData)
          .eq('id', draftId)
          .eq('user_id', user.id);  // FIXED: Use user.id here too
          
        if (error) throw error;
      } else {
        // Create new draft
        const { data, error } = await supabase
          .from('memorials')
          .insert(draftData)
          .select()
          .single();
          
        if (error) throw error;
        
        // Store draft ID for future updates
        localStorage.setItem('currentDraftId', data.id);
        window.currentMemorialId = data.id;
      }
    }, 3, 2000);
    
    showToast('Draft saved', 'success');
  } catch (error) {
    console.error('Error saving draft:', error);
    handleError(error, 'Save Draft');
    // Fall back to localStorage if Supabase fails
    localStorage.setItem('memorialDraft', JSON.stringify(memorialData));
    showToast('Draft saved locally', 'info');
  }
}, 'Save Draft to Supabase');

// Replace the existing saveDraft function
const saveDraft = withErrorHandling(async function() {
  saveStepData();
  await saveDraftToSupabase();
}, 'Save Draft');

// Add function to load draft from Supabase
const loadDraftFromSupabase = withErrorHandling(async function() {
  const supabase = getClient();
  if (!supabase) return false;

  // CRITICAL FIX: Use supabase.auth.getUser() instead of window.currentUser
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) return false;

  try {
    // Find user's most recent draft
    const { data: drafts, error } = await supabase
      .from('memorials')
      .select('*')
      .eq('user_id', user.id)  // FIXED: Use user.id from supabase.auth.getUser()
      .eq('is_draft', true)
      .eq('is_published', false)
      .order('updated_at', { ascending: false })
      .limit(1);

    if (error) throw error;
    
    if (drafts && drafts.length > 0) {
      const draft = drafts[0];
      
      // Store draft ID
      localStorage.setItem('currentDraftId', draft.id);
      window.currentMemorialId = draft.id;
      
      // Populate memorial data
      memorialData.basic = {
        name: draft.deceased_name,
        birthDate: draft.birth_date,
        deathDate: draft.death_date,
        headline: draft.headline,
        openingStatement: draft.opening_statement
      };
      
      memorialData.story = {
        obituary: draft.obituary || '',
        lifeStory: draft.life_story || ''
      };
      
      memorialData.settings = {
        privacy: draft.privacy_setting || 'public',
        password: draft.access_password || null
      };
      
      memorialData.additionalInfo = draft.additional_info || '';
      
      // Load photos into preview
      if (draft.profile_photo_url) {
        const profilePreview = qs('#profilePhotoPreview');
        if (profilePreview) {
          profilePreview.src = draft.profile_photo_url;
          profilePreview.style.display = 'block';
          profilePreview.dataset.publicId = draft.profile_photo_public_id || '';
        }
      }
      
      if (draft.background_photo_url) {
        const bgPreview = qs('#backgroundPhotoPreview');
        if (bgPreview) {
          bgPreview.src = draft.background_photo_url;
          bgPreview.style.display = 'block';
          bgPreview.dataset.publicId = draft.background_photo_public_id || '';
        }
      }
      
      // Load any saved moments
      await loadDraftMoments(draft.id);
      
      // Load any saved services
      await loadDraftServices(draft.id);
      
      // Populate form fields
      populateFormFromData();
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error loading draft from Supabase:', error);
    handleError(error, 'Load Draft');
    return false;
  }
}, 'Load Draft from Supabase');

// Add function to load draft moments
async function loadDraftMoments(memorialId) {
  const supabase = getClient();
  if (!supabase) return;

  try {
    const { data: moments, error } = await supabase
      .from('memorial_moments')
      .select('*')
      .eq('memorial_id', memorialId)
      .order('display_order');

    if (error) throw error;
    
    if (moments && moments.length > 0) {
      // Pass moments to the moments module
      window.loadExistingMoments?.(moments);
    }
  } catch (error) {
    console.error('Error loading draft moments:', error);
  }
}

// Add function to load draft services
async function loadDraftServices(memorialId) {
  const supabase = getClient();
  if (!supabase) return;

  try {
    const { data: services, error } = await supabase
      .from('memorial_services')
      .select('*')
      .eq('memorial_id', memorialId);

    if (error) throw error;
    
    if (services && services.length > 0) {
      memorialData.services = services.map(s => ({
        type: s.service_type,
        date: s.service_date,
        time: s.service_time,
        locationName: s.location_name,
        address: s.location_address,
        city: s.location_city,
        state: s.location_state,
        additionalInfo: s.additional_info,
        isVirtual: s.is_virtual,
        virtualUrl: s.virtual_meeting_url
      }));
    }
  } catch (error) {
    console.error('Error loading draft services:', error);
  }
}

// Function to populate form fields from loaded data
function populateFormFromData() {
  try {
    // Basic info
    if (memorialData.basic.name) {
      const nameParts = memorialData.basic.name.split(' ');
      if (qs('#firstName')) qs('#firstName').value = nameParts[0] || '';
      if (qs('#lastName')) qs('#lastName').value = nameParts[nameParts.length - 1] || '';
      if (nameParts.length > 2 && qs('#middleName')) {
        qs('#middleName').value = nameParts.slice(1, -1).join(' ');
      }
    }
    if (qs('#birthDate')) qs('#birthDate').value = memorialData.basic.birthDate || '';
    if (qs('#deathDate')) qs('#deathDate').value = memorialData.basic.deathDate || '';
    if (qs('#headline')) qs('#headline').value = memorialData.basic.headline || '';
    if (qs('#openingStatement')) qs('#openingStatement').value = memorialData.basic.openingStatement || '';
    
    // Story
    if (qs('#lifeStory')) qs('#lifeStory').innerHTML = memorialData.story.obituary || '';
    
    // Additional info
    if (qs('#serviceNote')) qs('#serviceNote').value = memorialData.additionalInfo || '';
    
    // Privacy settings
    if (memorialData.settings.privacy) {
      const privacyRadio = document.querySelector(`input[name="privacy"][value="${memorialData.settings.privacy}"]`);
      if (privacyRadio) {
        privacyRadio.checked = true;
        togglePasswordField(); // Update password field visibility
      }
    }
    
    // Password if private
    if (memorialData.settings.password && qs('#memorialPassword')) {
      qs('#memorialPassword').value = memorialData.settings.password;
    }
  } catch (error) {
    console.error('Error populating form:', error);
  }
}

/* ──────────────────────────────────────────
   PUBLISH MEMORIAL TO SUPABASE
   ────────────────────────────────────────── */
const publishMemorial = withErrorHandling(async function() {
  const supabase = getClient();
  if (!supabase) {
    showToast('Application not initialized', 'error');
    return;
  }

  // CRITICAL FIX: Use supabase.auth.getUser() instead of window.currentUser
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    showToast('Please sign in to publish', 'error');
    return;
  }

  // Validate required fields
  const validationErrors = [];
  
  if (!memorialData.basic.name?.trim()) {
    validationErrors.push('Please enter the name of your loved one');
  }
  
  if (!memorialData.basic.birthDate && !memorialData.basic.deathDate) {
    validationErrors.push('Please enter at least one date (birth or death)');
  }
  
  // Check if dates are valid
  if (memorialData.basic.birthDate && memorialData.basic.deathDate) {
    const birthDate = new Date(memorialData.basic.birthDate);
    const deathDate = new Date(memorialData.basic.deathDate);
    
    if (birthDate > deathDate) {
      validationErrors.push('Birth date cannot be after death date');
    }
    
    if (deathDate > new Date()) {
      validationErrors.push('Death date cannot be in the future');
    }
  }
  
  // Validate password if private
  const isPrivate = memorialData.settings?.privacy === 'private';
  if (isPrivate) {
    const password = memorialData.settings?.password;
    if (!password || password.length < 6) {
      validationErrors.push('Private memorials require a password of at least 6 characters');
    }
  }
  
  // If there are validation errors, show them and stop
  if (validationErrors.length > 0) {
    showToast(validationErrors[0], 'error');
    return;
  }

  const btn = qs('[data-wizard-publish]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';

  try {
    // Get moments data from moments.js
    const momentsData = window.getMomentsForSave?.() || [];
    
    // Prepare memorial data
    const memorialToSave = {
      user_id: user.id,  // FIXED: Use user.id from supabase.auth.getUser()
      deceased_name: memorialData.basic.name,
      birth_date: memorialData.basic.birthDate || null,
      death_date: memorialData.basic.deathDate || null,
      headline: memorialData.basic.headline || null,
      opening_statement: memorialData.basic.openingStatement || null,
      additional_info: memorialData.additionalInfo || null,
      profile_photo_url: qs('#profilePhotoPreview')?.src || null,
      profile_photo_public_id: qs('#profilePhotoPreview')?.dataset.publicId || null,
      background_photo_url: qs('#backgroundPhotoPreview')?.src || null,
      background_photo_public_id: qs('#backgroundPhotoPreview')?.dataset.publicId || null,
      obituary: memorialData.story.obituary || '',
      life_story: memorialData.story.lifeStory || '',
      privacy_setting: memorialData.settings.privacy || 'public',
      access_password: memorialData.settings.password || null,
      is_published: true,
      is_draft: false,
      published_at: new Date().toISOString()
    };

    let memorial;
    const draftId = localStorage.getItem('currentDraftId');
    
    // Use retry logic for publish operation
    memorial = await retryOperation(async () => {
      if (draftId) {
        // Update existing draft to published
        const { data, error } = await supabase
          .from('memorials')
          .update(memorialToSave)
          .eq('id', draftId)
          .eq('user_id', user.id)  // FIXED: Use user.id here too
          .select()
          .single();
          
        if (error) throw error;
        return data;
      } else {
        // Create new memorial
        const { data, error } = await supabase
          .from('memorials')
          .insert(memorialToSave)
          .select()
          .single();
          
        if (error) throw error;
        return data;
      }
    }, 3, 2000);

    // Generate and update slug
    const { data: slugData } = await supabase
      .rpc('generate_memorial_slug', { name: memorialData.basic.name });
    
    if (slugData) {
      await supabase
        .from('memorials')
        .update({ slug: slugData })
        .eq('id', memorial.id);
      
      memorial.slug = slugData;
    }

    // Save services if any
    if (memorialData.services?.length > 0) {
      // Delete existing services first (in case of draft update)
      await supabase
        .from('memorial_services')
        .delete()
        .eq('memorial_id', memorial.id);
      
      const services = memorialData.services.map(service => ({
        memorial_id: memorial.id,
        service_type: service.type,
        service_date: service.date,
        service_time: service.time,
        location_name: service.locationName,
        location_address: service.address,
        location_city: service.city,
        location_state: service.state,
        additional_info: service.additionalInfo,
        is_virtual: service.isVirtual || false,
        virtual_meeting_url: service.virtualUrl
      }));

      await supabase.from('memorial_services').insert(services);
    }

    // Save moments if any
    if (momentsData.length > 0) {
      // Delete existing moments first (in case of draft update)
      await supabase
        .from('memorial_moments')
        .delete()
        .eq('memorial_id', memorial.id);
      
      const moments = momentsData.map((moment, index) => ({
        memorial_id: memorial.id,
        type: moment.type,
        url: moment.url,
        thumbnail_url: moment.thumbnailUrl,
        cloudinary_public_id: moment.publicId,
        caption: moment.caption,
        date_taken: moment.date,
        file_name: moment.fileName,
        display_order: index
      }));

      await supabase.from('memorial_moments').insert(moments);
    }

    // Clear draft data
    localStorage.removeItem('memorialDraft');
    localStorage.removeItem('currentDraftId');
    
    showToast('Memorial published successfully!', 'success');
    
    // Redirect to the memorial page
    setTimeout(() => {
      window.location.hash = `#memorial/${memorial.slug || memorial.id}`;
    }, 1500);
    
  } catch (error) {
    console.error('Error publishing memorial:', error);
    handleError(error, 'Publish Memorial');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-check"></i> Publish Memorial';
  }
}, 'Publish Memorial');

/* ──────────────────────────────────────────
     INTERNAL HELPERS
     ────────────────────────────────────────── */

function wireDelegatedClicks() {
  if (clickHandlerBound) return;
  
  document
    .getElementById('createMemorial')
    ?.addEventListener('click', (e) => {
      if (e.target.closest('[data-wizard-next]')) return nextStep();
      if (e.target.closest('[data-wizard-prev]')) return previousStep();
      if (e.target.closest('[data-wizard-skip]')) return skipStep();
      if (e.target.closest('[data-wizard-save-draft]')) return saveDraft();
      if (e.target.closest('[data-wizard-publish]')) return publishMemorial();
    });
    
  clickHandlerBound = true;
}

function wirePhotoUploadHandlers() {
  // Additional photo upload setup if needed
}

function wireMoments() {
  // Initialize moments functionality
  import('../memorials/moments.js').then(({ initMomentsBoard }) => {
    initMomentsBoard();
  }).catch(error => {
    console.error('Error loading moments module:', error);
  });
}

function resetWizard() {
  currentStep = 1;
  Object.keys(memorialData).forEach(key => {
    if (Array.isArray(memorialData[key])) {
      memorialData[key] = [];
    } else {
      memorialData[key] = {};
    }
  });
}

function loadDraft() {
  try {
    const draft = localStorage.getItem('memorialDraft');
    if (draft) {
      const parsed = JSON.parse(draft);
      Object.assign(memorialData, parsed);
    }
  } catch (error) {
    console.error('Error loading local draft:', error);
  }
}

function updatePreview() {
  // Update preview if on preview step
  if (currentStep === 5) {
    generatePreview();
  }
}

/* ---------- navigation ---------- */
function updateProgress() {
  try {
    // Count total steps dynamically
    totalSteps = document.querySelectorAll('.form-step').length;
    
    /* 1. progress bar */
    const bar = document.getElementById('progressFill');
    if (bar) bar.style.width = `${(currentStep / totalSteps) * 100}%`;

    /* 2. step indicators */
    document.querySelectorAll('.progress-step').forEach((step, idx) => {
      step.classList.remove('active', 'completed');
      if (idx < currentStep - 1) step.classList.add('completed');
      if (idx === currentStep - 1) step.classList.add('active');
    });

    /* 3. show / hide steps */
    document.querySelectorAll('.form-step').forEach((s) => {
      s.classList.remove('active');
      s.style.display = 'none';
    });
    const currentStepEl = qs(`#step${currentStep}`);
    if (currentStepEl) {
      currentStepEl.classList.add('active');
      currentStepEl.style.setProperty('display', 'block');
    }

    /* extra UX touches */
    window.scrollTo(0, 80); // keep nav visible
    qs('.create-memorial-page')?.classList.toggle('compact-layout', currentStep !== 1);

    /* step-specific hooks */
    if (currentStep === 2) {
      setTimeout(() => {
        initializeRichTextAutoSave();
        loadDraftLifeStory();
      }, 100);
    }
  } catch (error) {
    handleError(error, 'Update Progress');
  }
}

function nextStep() {
  try {
    if (!validateCurrentStep()) return;
    saveStepData();
    if (currentStep < totalSteps) {
      currentStep += 1;
      updateProgress();
      if (currentStep === 5) {
        // Generate preview when reaching the preview step
        generatePreview();
        
        // Add resize listener to update preview on window resize
        window.addEventListener('resize', debounce(generatePreview, 500));
      }
    }
  } catch (error) {
    handleError(error, 'Next Step');
  }
}


// Add debounce utility function if not already present
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}




function previousStep() {
  try {
    if (currentStep === 5) {
      // Remove resize listener when leaving preview step
      window.removeEventListener('resize', debounce(generatePreview, 500));
    }
    
    if (currentStep > 1) {
      currentStep -= 1;
      updateProgress();
    }
  } catch (error) {
    handleError(error, 'Previous Step');
  }
}

function skipStep() {
  try {
    if (currentStep < totalSteps) {
      currentStep += 1;
      updateProgress();
    }
  } catch (error) {
    handleError(error, 'Skip Step');
  }
}

/* ---------- validation ---------- */
function validateCurrentStep() {
  try {
    if (currentStep === 1) {
      // Check for both first and last name fields
      const firstName = qs('#firstName')?.value.trim();
      const lastName = qs('#lastName')?.value.trim();
      
      if (!firstName || !lastName) {
        showToast('Please enter both first and last name', 'error');
        return false;
      }
      
      // Also validate dates
      const birthDate = qs('#birthDate')?.value;
      const deathDate = qs('#deathDate')?.value;
      
      if (!birthDate || !deathDate) {
        showToast('Please enter both birth and death dates', 'error');
        return false;
      }
    }
    
    // Add validation for step 5 (privacy settings)
    if (currentStep === 5) {
      const isPrivate = document.querySelector('input[name="privacy"]:checked')?.value === 'private';
      const passwordInput = document.getElementById('memorialPassword');
      
      if (isPrivate && passwordInput) {
        const password = passwordInput.value.trim();
        
        if (password.length < 6) {
          passwordInput.classList.add('error');
          const errorEl = document.getElementById('passwordError');
          if (errorEl) {
            errorEl.classList.add('show');
          }
          showToast('Password must be at least 6 characters long', 'error');
          passwordInput.focus();
          return false;
        }
      }
    }
    
    return true;
  } catch (error) {
    handleError(error, 'Validate Step');
    return false;
  }
}

/* ---------- collect / save data ---------- */
function saveStepData() {
  try {
    switch (currentStep) {
      case 1:
        // Combine first, middle, and last names
        const firstName = qs('#firstName')?.value.trim();
        const middleName = qs('#middleName')?.value.trim();
        const lastName = qs('#lastName')?.value.trim();
        
        // Create full name with proper spacing
        let fullName = firstName;
        if (middleName) fullName += ` ${middleName}`;
        fullName += ` ${lastName}`;
        
        memorialData.basic = {
          name: fullName,
          firstName: firstName,
          middleName: middleName,
          lastName: lastName,
          birthDate: qs('#birthDate')?.value,
          deathDate: qs('#deathDate')?.value,
          headline: qs('#headline')?.value || '',
          openingStatement: qs('#openingStatement')?.value || ''
        };
        break;
        
      case 2:
        memorialData.story = {
          obituary: qs('#lifeStory')?.innerHTML || '',
          lifeStory: ''  // Empty if you don't have a separate life story field
        };
        break;
        
      case 3:
        // Collect all service information
        const services = [];
        const serviceItems = document.querySelectorAll('.service-item-form');
        
        serviceItems.forEach((item) => {
          const serviceType = item.querySelector('select[name="serviceType"]')?.value;
          const serviceDate = item.querySelector('input[name="serviceDate"]')?.value;
          const serviceTime = item.querySelector('input[name="serviceTime"]')?.value;
          const locationName = item.querySelector('input[name="locationName"]')?.value;
          const locationAddress = item.querySelector('input[name="locationAddress"]')?.value;
          const additionalInfo = item.querySelector('textarea[name="additionalInfo"]')?.value;
          
          // Only save if at least service type is selected
          if (serviceType) {
            services.push({
              type: serviceType,
              date: serviceDate,
              time: serviceTime,
              locationName: locationName,
              address: locationAddress,
              additionalInfo: additionalInfo
            });
          }
        });
        
        memorialData.services = services;
        
        // Also save any additional information from step 3
        memorialData.additionalInfo = qs('#serviceNote')?.value || '';
        break;
        
      case 4:
        // Get moments from the moments module and save them
        memorialData.moments = window.getMomentsForSave?.() || [];
        break;
        
      case 5:
        const privacySetting = qs('input[name="privacy"]:checked')?.value || 'public';
        memorialData.settings = {
          privacy: privacySetting
        };
        
        // Add password if private - FIXED to use consistent key
        if (privacySetting === 'private') {
          const password = qs('#memorialPassword')?.value.trim();
          if (password) {
            memorialData.settings.password = password; // Changed from 'access_password' to 'password'
          }
        } else {
          // Clear password if not private
          memorialData.settings.password = null;
        }
        break;
    }
  } catch (error) {
    handleError(error, 'Save Step Data');
  }
}



/* ──────────────────────────────────────────
   PRIVACY PASSWORD TOGGLE
   ────────────────────────────────────────── */
function setupPrivacyHandlers() {
  // Add change listener to privacy radio buttons
  const privacyRadios = document.querySelectorAll('input[name="privacy"]');
  privacyRadios.forEach(radio => {
    radio.addEventListener('change', togglePasswordField);
  });
  
  // Add input listener to password field to clear errors
  const passwordInput = document.getElementById('memorialPassword');
  if (passwordInput) {
    passwordInput.addEventListener('input', function() {
      if (this.value.length >= 6) {
        this.classList.remove('error');
        const errorEl = document.getElementById('passwordError');
        if (errorEl) {
          errorEl.classList.remove('show');
        }
      }
    });
  }
}

function togglePasswordField() {
  const isPrivate = document.querySelector('input[name="privacy"]:checked')?.value === 'private';
  const passwordSection = document.getElementById('passwordSection');
  const passwordInput = document.getElementById('memorialPassword');
  
  if (!passwordSection || !passwordInput) return;
  
  if (isPrivate) {
    passwordSection.style.display = 'block';
    passwordInput.required = true;
  } else {
    passwordSection.style.display = 'none';
    passwordInput.required = false;
    passwordInput.value = '';
    // Clear any error states
    passwordInput.classList.remove('error');
    const errorEl = document.getElementById('passwordError');
    if (errorEl) {
      errorEl.classList.remove('show');
    }
  }
}














/* ──────────────────────────────────────────
   PREVIEW FUNCTIONALITY - UPDATED TO MATCH EXAMPLE MEMORIAL
   ────────────────────────────────────────── */

// Replace the existing generatePreview function with this improved version
function generatePreview() {
  try {
    const iframe = document.getElementById('memorialPreview');
    const deviceFrame = document.getElementById('deviceFrame');
    if (!iframe || !deviceFrame) return;
    
    // Auto-detect device type based on screen width
    const screenWidth = window.innerWidth;
    let deviceType = 'desktop';
    
    if (screenWidth <= 768) {
      deviceType = 'mobile';
    } else if (screenWidth <= 1024) {
      deviceType = 'tablet';
    }
    
    // Remove all device classes first
    deviceFrame.classList.remove('desktop-view', 'tablet-view', 'mobile-view');
    
    // Apply appropriate device class and iframe dimensions
    switch(deviceType) {
      case 'mobile':
        deviceFrame.classList.add('mobile-view');
        // Keep the iframe responsive within mobile frame
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        break;
      case 'tablet':
        deviceFrame.classList.add('tablet-view');
        iframe.style.width = '100%';
        iframe.style.height = '100%';
        break;
      default: // desktop
        deviceFrame.classList.add('desktop-view');
        iframe.style.width = '100%';
        iframe.style.height = '600px';
    }
    
    // Generate the preview content
    const previewHTML = generatePreviewHTML();
    
    // Add responsive viewport meta tag to preview
    const responsivePreviewHTML = previewHTML.replace(
      '<head>',
      '<head><meta name="viewport" content="width=device-width, initial-scale=1">'
    );
    
    // Write the preview content to the iframe
    iframe.srcdoc = responsivePreviewHTML;
  } catch (error) {
    handleError(error, 'Generate Preview');
  }
}

// UPDATED generatePreviewHTML to match Example Memorial layout exactly
function generatePreviewHTML() {
  try {
    // Get the current memorial data
    const profilePhoto = qs('#profilePhotoPreview')?.src || 'https://via.placeholder.com/200';
    const backgroundPhoto = qs('#backgroundPhotoPreview')?.src || 'https://images.unsplash.com/photo-1516475429286-465d815a0df7?w=1200';
    
    const fullName = memorialData.basic?.name || 'Preview Name';
    const birthDate = memorialData.basic?.birthDate || '1950-01-01';
    const deathDate = memorialData.basic?.deathDate || '2024-01-01';
    const headline = memorialData.basic?.headline || '';
    const openingStatement = memorialData.basic?.openingStatement || '';
    
    const obituary = memorialData.story?.obituary || '<p>Memorial preview will appear here...</p>';
    const lifeStory = memorialData.story?.lifeStory || '';
    const additionalInfo = memorialData.additionalInfo || '';
    
    // Get services data
    const services = memorialData.services || [];
    
    // Get moments data
    const moments = memorialData.moments || window.getMomentsForSave?.() || [];
    
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
    
    // Format time
    const formatTime = (timeStr) => {
      if (!timeStr) return '';
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
      return `${displayHour}:${minutes} ${ampm}`;
    };
    
    // Get year only for hero display
    const birthYear = birthDate ? new Date(birthDate).getFullYear() : '';
    const deathYear = deathDate ? new Date(deathDate).getFullYear() : '';

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${fullName} - Memorial Preview</title>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Merriweather:wght@300;400&display=swap">
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
        <link rel="stylesheet" href="/src/styles/base.css">
        <link rel="stylesheet" href="/src/styles/layout.css">
        <link rel="stylesheet" href="/src/styles/components.css">
        <style>
          /* Ensure the preview uses the same styles */
          body {
            margin: 0;
            padding: 0;
            font-family: 'Inter', sans-serif;
            color: #4a4238;
            background: #fefdfb;
          }
          
          /* Hide inactive tab content in preview */
          .tab-pane {
            display: none;
          }
          
          .tab-pane.active {
            display: block;
          }
          
          /* Ensure proper section spacing */
          .memorial-page section {
            position: relative;
            z-index: 1;
          }
        </style>
      </head>
      <body>
        <section class="memorial-page">
          <!-- Hero Section -->
          <div class="memorial-hero" style="background-image: url('${backgroundPhoto}');">
            <div class="memorial-hero-overlay"></div>
            <div class="memorial-hero-content">
              <img src="${profilePhoto}" alt="${fullName}" class="memorial-main-photo">
              <h1 class="memorial-main-name">${fullName}</h1>
              <p class="memorial-main-dates">${birthYear} - ${deathYear}</p>
              ${headline ? `<p class="memorial-headline">"${headline}"</p>` : ''}
              
              <div class="memorial-hero-actions">
                <button class="memorial-hero-btn">
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
                  ${openingStatement ? `
                    <div class="opening-statement-section">
                      <p class="opening-statement">${openingStatement}</p>
                    </div>
                  ` : ''}
                  
                  ${obituary ? `
                    <section class="obituary-section">
                      <div class="obituary-container">
                        <h2 class="obituary-title">Celebrating a Life Well Lived</h2>
                        <div class="obituary-details">
                          ${obituary}
                        </div>
                      </div>
                    </section>
                  ` : ''}
                  
                  ${lifeStory ? `
                    <section class="life-story-section">
                      <h2 class="section-title">Life Story</h2>
                      <div class="life-story-content">
                        ${lifeStory}
                      </div>
                    </section>
                  ` : ''}
                  
                  ${additionalInfo ? `
                    <section class="additional-info-section">
                      <h2>Additional Information</h2>
                      <p>${additionalInfo}</p>
                    </section>
                  ` : ''}
                </div>
                
                <!-- Gallery Tab -->
                <div class="tab-pane" id="galleryTab">
                  <h2 class="section-title">Photos & Videos</h2>
                  <div class="moments-vsco">
                    ${moments.length > 0 ? moments.map(moment => `
                      <div class="moment-vsco">
                        <img src="${moment.url}" alt="${moment.caption || 'Memorial moment'}">
                        ${moment.caption ? `<p class="moment-caption-vsco">${moment.caption}</p>` : ''}
                      </div>
                    `).join('') : '<p class="no-moments-message">No photos or videos have been added yet.</p>'}
                  </div>
                </div>
                
                <!-- Tributes Tab -->
                <div class="tab-pane" id="tributesTab">
                  <section class="guestbook-section">
                    <div class="guestbook-container">
                      <h2 class="guestbook-title">Share a Memory</h2>
                      <div class="guestbook-form-card">
                        <form class="guestbook-form">
                          <div class="form-group">
                            <input type="text" placeholder="Your Name" disabled>
                          </div>
                          <div class="form-group">
                            <input type="email" placeholder="Your Email (optional)" disabled>
                          </div>
                          <div class="form-group">
                            <textarea placeholder="Share a memory or leave a message..." rows="4" disabled></textarea>
                          </div>
                          <button type="button" class="btn-primary" disabled>
                            <i class="fas fa-paper-plane"></i>
                            Share Memory
                          </button>
                        </form>
                      </div>
                      <div class="guestbook-entries">
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
                      <div class="services-grid">
                        ${services.length > 0 ? services.map(service => {
                          const serviceDate = new Date(service.date);
                          const formattedDate = formatDate(service.date);
                          
                          return `
                            <div class="service-card ${service.isVirtual ? 'virtual-service' : ''}">
                              <div class="service-icon">
                                <i class="fas ${service.isVirtual ? 'fa-video' : 'fa-location-dot'}"></i>
                              </div>
                              <h3>${service.type.replace('_', ' ').toUpperCase()}</h3>
                              <p class="service-date">${formattedDate}</p>
                              <p class="service-time">${formatTime(service.startTime)} - ${formatTime(service.endTime)}</p>
                              ${service.location ? `<p class="service-location">${service.location}</p>` : ''}
                              ${service.address ? `<p class="service-address">${service.address}</p>` : ''}
                              ${service.virtualLink ? `
                                <a href="${service.virtualLink}" class="virtual-link" target="_blank">
                                  <i class="fas fa-video"></i> Join Virtual Service
                                </a>
                              ` : ''}
                              ${service.additionalInfo ? `<p class="service-info">${service.additionalInfo}</p>` : ''}
                            </div>
                          `;
                        }).join('') : '<p class="no-services-message">No service information is available at this time.</p>'}
                      </div>
                    </div>
                  </section>
                </div>
              </div>
            </div>
          </div>
        </section>
        
        <script>
          // Simple tab switching for preview
          document.addEventListener('DOMContentLoaded', function() {
            const tabs = document.querySelectorAll('.memorial-tab');
            const panes = document.querySelectorAll('.tab-pane');
            
            tabs.forEach(tab => {
              tab.addEventListener('click', () => {
                // Remove active class from all
                tabs.forEach(t => t.classList.remove('active'));
                panes.forEach(p => p.classList.remove('active'));
                
                // Add active to clicked tab
                tab.classList.add('active');
                
                // Show corresponding pane
                const tabName = tab.getAttribute('data-tab');
                const pane = document.getElementById(tabName + 'Tab');
                if (pane) {
                  pane.classList.add('active');
                }
              });
            });
          });
        </script>
      </body>
      </html>
    `;
  } catch (error) {
    handleError(error, 'Generate Preview HTML');
    return '<html><body><p>Error generating preview</p></body></html>';
  }
}

// Helper functions for service icons and titles
function getServiceIcon(type) {
  const icons = {
    viewing: 'fa-pray',
    funeral: 'fa-church',
    memorial: 'fa-heart',
    celebration: 'fa-dove',
    reception: 'fa-users',
    burial: 'fa-cross'
  };
  return icons[type] || 'fa-calendar';
}

function getServiceTitle(type) {
  const titles = {
    viewing: 'Viewing & Visitation',
    funeral: 'Funeral Service',
    memorial: 'Memorial Service',
    celebration: 'Celebration of Life',
    reception: 'Reception',
    burial: 'Burial'
  };
  return titles[type] || 'Service';
}



/* ---------- rich text autosave ---------- */
function initializeRichTextAutoSave() {
  try {
    const editor = document.querySelector('#lifeStory');
    if (!editor) return;

    let autoSaveTimer;
    editor.addEventListener('input', () => {
      clearTimeout(autoSaveTimer);
      autoSaveTimer = setTimeout(() => {
        saveStepData();
        saveDraftToSupabase(); // Save to Supabase
      }, 2000); // Auto-save after 2 seconds of inactivity
    });
  } catch (error) {
    handleError(error, 'Initialize Auto Save');
  }
}

function loadDraftLifeStory() {
  try {
    if (memorialData.story?.lifeStory) {
      const editor = qs('#lifeStoryEditor');
      if (editor) editor.innerHTML = memorialData.story.lifeStory;
    }
    if (memorialData.story?.obituary) {
      const editor = qs('#lifeStory');
      if (editor) editor.innerHTML = memorialData.story.obituary;
    }
  } catch (error) {
    handleError(error, 'Load Draft Life Story');
  }
}