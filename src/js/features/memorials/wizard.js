/*  src/js/features/memorials/wizard.js  */
let clickHandlerBound = false;
import {
  showNotification,
  qs /* ← you already export this from utils/ui.js */
} from '@/utils/ui.js';
import { MemorialSanitizer } from '@/utils/sanitizer.js';
import { cloudinaryConfig } from '@/api/cloudinaryClient.js';
import { getClient } from '@/api/supabaseClient.js';
import { showNotification, qs, setButtonLoading } from '@/utils/ui.js';
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
export async function initWizard() {
  console.log('initWizard() called from features/memorials/wizard.js');
  
  // Check if we're on the correct page
  const createMemorialSection = document.getElementById('createMemorial');
  if (!createMemorialSection || !createMemorialSection.classList.contains('active')) {
    console.log('Create memorial section not active, skipping initialization');
    return;
  }
  
  // Wire up delegated event handlers
  wireDelegatedClicks();
  
  // Set up photo upload handlers
  wirePhotoUploadHandlers();
  
  // Initialize moments board
  wireMoments();
  
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
      showNotification('Draft loaded', 'success');
    }
  } 
  // Load from localStorage if we have a local draft but no Supabase draft
  else if (memorialDraft && !currentDraftId) {
    console.log('Loading draft from localStorage...');
    loadDraft();
    showNotification('Draft loaded from local storage', 'success');
  }
  // Otherwise, start fresh
  else {
    console.log('Starting new memorial...');
    resetWizard();
  }
  
  // Always update progress to show current step
  updateProgress();
  updatePreview();
}

export { nextStep, previousStep }; // consumed elsewhere if needed

/* ──────────────────────────────────────────
     CLOUDINARY UPLOAD FUNCTIONS
     ────────────────────────────────────────── */
async function uploadImage(type) {
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
    
    if (file.size > 10 * 1024 * 1024) { // 10MB limit for profile/background
      showNotification('Image size must be less than 10MB', 'error');
      return;
    }
    
    try {
      showNotification('Uploading image...', 'info');
      
      const formData = new FormData();
      formData.append('file', file);
      formData.append('upload_preset', cloudinaryConfig.uploadPreset);
      
      // Use memorial ID if available, otherwise use 'draft'
      const memorialId = window.currentMemorialId || 'draft';
      formData.append('folder', `tayvu/memorials/${memorialId}/${type}`);
      
      const response = await fetch(
        `${cloudinaryConfig.uploadUrl}/image/upload`,
        { method: 'POST', body: formData }
      );
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.statusText}`);
      }
      
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
      
      showNotification('Image uploaded successfully!', 'success');
      
    } catch (error) {
      console.error('Upload error:', error);
      showNotification('Failed to upload image. Please try again.', 'error');
    }
  };
  
  input.click();
}

// Make uploadImage globally available for onclick handlers
window.uploadImage = uploadImage;

// Function to select default background
function selectDefaultBackground(bgUrl) {
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
}

// Make it globally available
window.selectDefaultBackground = selectDefaultBackground;


// Function to add a new service item
function addServiceItem() {
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
}

// Function to remove a service item
function removeServiceItem(button) {
  const serviceItem = button.closest('.service-item-form');
  if (serviceItem) {
    // Don't remove if it's the only service item
    const allServiceItems = document.querySelectorAll('.service-item-form');
    if (allServiceItems.length > 1) {
      serviceItem.remove();
      
      // Renumber remaining services
      renumberServices();
    } else {
      showNotification('At least one service must remain', 'info');
    }
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



/* ──────────────────────────────────────────
   DRAFT MANAGEMENT WITH SUPABASE
   ────────────────────────────────────────── */
async function saveDraftToSupabase() {
  const supabase = getClient();
  if (!supabase || !window.currentUser) {
    console.log('Cannot save draft - user not authenticated');
    return;
  }

  try {
    // Prepare draft data
    const draftData = {
      user_id: window.currentUser.id,
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
      is_published: false,
      is_draft: true
    };

    // Check if we already have a draft ID
    let draftId = localStorage.getItem('currentDraftId');
    
    if (draftId) {
      // Update existing draft
      const { error } = await supabase
        .from('memorials')
        .update(draftData)
        .eq('id', draftId)
        .eq('user_id', window.currentUser.id);
        
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
    
    showNotification('Draft saved', 'success');
  } catch (error) {
    console.error('Error saving draft:', error);
    // Fall back to localStorage if Supabase fails
    localStorage.setItem('memorialDraft', JSON.stringify(memorialData));
  }
}

// Replace the existing saveDraft function
async function saveDraft() {
  const btn = qs('[data-wizard-save-draft]');
  setButtonLoading(btn, true, 'Saving draft...');
  
  try {
    saveStepData();
    await saveDraftToSupabase();
  } finally {
    setButtonLoading(btn, false);
  }
}

// Add function to load draft from Supabase
async function loadDraftFromSupabase() {
  const supabase = getClient();
  if (!supabase || !window.currentUser) return false;

  try {
    // Find user's most recent draft
    const { data: drafts, error } = await supabase
      .from('memorials')
      .select('*')
      .eq('user_id', window.currentUser.id)
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
        deathDate: draft.death_date
      };
      
      memorialData.story = {
        obituary: draft.obituary || '',
        lifeStory: draft.life_story || ''
      };
      
      memorialData.settings = {
        privacy: draft.privacy_setting || 'public'
      };
      
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
      
      return true;
    }
    
    return false;
  } catch (error) {
    console.error('Error loading draft from Supabase:', error);
    return false;
  }
}

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

/* ──────────────────────────────────────────
   PUBLISH MEMORIAL TO SUPABASE
   ────────────────────────────────────────── */
async function publishMemorial() {
  const supabase = getClient();
  if (!supabase || !window.currentUser) {
    showNotification('Please sign in to publish', 'error');
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
  
  // If there are validation errors, show them and stop
  if (validationErrors.length > 0) {
    showNotification(validationErrors[0], 'error'); // Show first error
    return;
  }
  // END OF VALIDATION SECTION



  const btn = qs('[data-wizard-publish]');
setButtonLoading(btn, true, 'Publishing...');

  try {
    // Get moments data from moments.js
    const momentsData = window.getMomentsForSave?.() || [];
    
    // Prepare memorial data
    const memorialToSave = {
      user_id: window.currentUser.id,
      deceased_name: memorialData.basic.name,
      birth_date: memorialData.basic.birthDate || null,
      death_date: memorialData.basic.deathDate || null,
      profile_photo_url: qs('#profilePhotoPreview')?.src || null,
      profile_photo_public_id: qs('#profilePhotoPreview')?.dataset.publicId || null,
      background_photo_url: qs('#backgroundPhotoPreview')?.src || null,
      background_photo_public_id: qs('#backgroundPhotoPreview')?.dataset.publicId || null,
      obituary: memorialData.story.obituary || '',
      life_story: memorialData.story.lifeStory || '',
      privacy_setting: memorialData.settings.privacy || 'public',
      is_published: true,
      is_draft: false,
      published_at: new Date().toISOString()
    };

    
let memorial;
    const draftId = localStorage.getItem('currentDraftId');
    
    // ADD RETRY LOGIC HERE
    let retries = 3;
    let lastError;
    
    while (retries > 0) {
      try {
        if (draftId) {
          // Update existing draft to published
          const { data, error } = await supabase
            .from('memorials')
            .update(memorialToSave)
            .eq('id', draftId)
            .eq('user_id', window.currentUser.id)
            .select()
            .single();
            
          if (error) throw error;
          memorial = data;
        } else {
          // Create new memorial
          const { data, error } = await supabase
            .from('memorials')
            .insert(memorialToSave)
            .select()
            .single();
            
          if (error) throw error;
          memorial = data;
        }
        
        // If successful, break out of retry loop
        break;
        
      } catch (error) {
        lastError = error;
        retries--;
        
        if (retries > 0) {
          console.log(`Retry attempt ${3 - retries} failed, retrying...`);
          // Show a notification to user about retry
          showNotification(`Connection issue, retrying... (${retries} attempts left)`, 'info');
          // Wait 1 second before retrying
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    }
    
    // If all retries failed, throw the last error
    if (retries === 0 && lastError) {
      throw lastError;
    }
    // END RETRY LOGIC







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
    
    showNotification('Memorial published successfully!', 'success');
    
    // Redirect to the memorial page
    window.location.hash = `#memorial/${memorial.slug || memorial.id}`;
    
 } catch (error) {
    console.error('Error publishing memorial:', error);
    
    // Provide specific error messages based on the error
    let errorMessage = 'Failed to publish memorial. Please try again.';
    
    if (error.message?.includes('duplicate key')) {
      errorMessage = 'A memorial with this name already exists. Please choose a different name.';
    } else if (error.message?.includes('violates foreign key')) {
      errorMessage = 'There was a problem with your account. Please sign out and sign back in.';
    } else if (error.message?.includes('network') || error.message?.includes('fetch')) {
      errorMessage = 'Network error. Please check your internet connection and try again.';
    } else if (error.message?.includes('row-level security')) {
      errorMessage = 'You do not have permission to create memorials. Please contact support.';
    } else if (error.message?.includes('timeout')) {
      errorMessage = 'The operation timed out. Please try again.';
    } else if (error.message?.includes('Failed to fetch')) {
      errorMessage = 'Cannot connect to server. Please check your internet connection.';
    } else if (error.message?.includes('Too many requests')) {
      errorMessage = 'Too many requests. Please wait a moment and try again.';
    } else if (error.message?.includes('invalid input syntax for type uuid')) {
      errorMessage = 'Invalid data format. Please refresh the page and try again.';
    } else if (error.message?.includes('JWT')) {
      errorMessage = 'Your session has expired. Please sign in again.';
    } else if (error.message?.includes('unique constraint')) {
      errorMessage = 'This memorial already exists. Please use a different name.';
    } else if (error.message) {
      // Use the actual error message if it's user-friendly
      errorMessage = error.message;
    }
    
    showNotification(errorMessage, 'error');
    
  } finally {
    btn.disabled = false;
    btn.textContent = 'Publish Memorial';
    btn.innerHTML = '<i class="fas fa-check"></i> Publish Memorial'; // Reset with icon
  }







}

/* ──────────────────────────────────────────
     INTERNAL HELPERS
     ────────────────────────────────────────── */

function wireDelegatedClicks() {
  document
    .getElementById('createMemorial') // root of the wizard page
    ?.addEventListener('click', (e) => {
      if (e.target.closest('[data-wizard-next]')) return nextStep();
      if (e.target.closest('[data-wizard-prev]')) return previousStep();
      if (e.target.closest('[data-wizard-skip]')) return skipStep();
      if (e.target.closest('[data-wizard-save-draft]')) return saveDraft();
      if (e.target.closest('[data-wizard-publish]')) return publishMemorial();
    });
}

/* ---------- navigation ---------- */
function updateProgress() {
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
  qs(`#step${currentStep}`)?.classList.add('active');
  qs(`#step${currentStep}`)?.style.setProperty('display', 'block');

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
}

function nextStep() {
  if (!validateCurrentStep()) return;
  saveStepData();
  if (currentStep < totalSteps) {
    currentStep += 1;
    updateProgress();
    if (currentStep === 5) generatePreview();
  }
}

function previousStep() {
  if (currentStep > 1) {
    currentStep -= 1;
    updateProgress();
  }
}

function skipStep() {
  if (currentStep < totalSteps) {
    currentStep += 1;
    updateProgress();
  }
}

/* ---------- validation ---------- */
function validateCurrentStep() {
  if (currentStep === 1) {
    // Check for both first and last name fields
    const firstName = qs('#firstName')?.value.trim();
    const lastName = qs('#lastName')?.value.trim();
    
    if (!firstName || !lastName) {
      showNotification('Please enter both first and last name', 'error');
      return false;
    }
    
    // Also validate dates
    const birthDate = qs('#birthDate')?.value;
    const deathDate = qs('#deathDate')?.value;
    
    if (!birthDate || !deathDate) {
      showNotification('Please enter both birth and death dates', 'error');
      return false;
    }
  }
  return true;
}

/* ---------- collect / save data ---------- */
function saveStepData() {
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
        // THESE TWO LINES ARE NEW - They save the headline and opening statement
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
      // THIS ENTIRE CASE 3 IS NEW - It saves all service information
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
      memorialData.settings = {
        privacy: qs('input[name="privacy"]:checked')?.value || 'public'
      };
      break;
  }
}






/* ──────────────────────────────────────────
   PREVIEW FUNCTIONALITY
   ────────────────────────────────────────── */

// Replace the existing generatePreview function with this improved version
function generatePreview() {
  const iframe = document.getElementById('memorialPreview');
  if (!iframe) return;
  
  // Instead of loading an external URL, we'll generate the preview content inline
  const previewHTML = generatePreviewHTML();
  
  // Write the preview content to the iframe
  iframe.srcdoc = previewHTML;
}


// New function to generate the preview HTML matching the Example Memorial page
function generatePreviewHTML() {
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
  
  // Get moments data if available - first try saved data, then get fresh data
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
  
  // Format life span dates
  const birthYear = birthDate ? new Date(birthDate).getFullYear() : '';
  const deathYear = deathDate ? new Date(deathDate).getFullYear() : '';
  // Format full dates for display
const formattedBirthDate = birthDate ? formatDate(birthDate) : '';
const formattedDeathDate = deathDate ? formatDate(deathDate) : '';


  // Generate services HTML
  const servicesHTML = services.length > 0 ? services.map(service => `
    <div class="service-item">
      <div class="service-icon">
        <i class="fas ${getServiceIcon(service.type)}"></i>
      </div>
      <div class="service-details">
        <h3>${getServiceTitle(service.type)}</h3>
        ${service.date ? `<p class="service-date">${formatDate(service.date)}${service.time ? ` at ${formatTime(service.time)}` : ''}</p>` : ''}
        ${service.locationName ? `<p class="service-location"><strong>${service.locationName}</strong></p>` : ''}
        ${service.address ? `<p class="service-address">${service.address}</p>` : ''}
        ${service.additionalInfo ? `<p class="service-info">${service.additionalInfo}</p>` : ''}
      </div>
    </div>
  `).join('') : '<p class="no-services">No services scheduled at this time.</p>';
  
  // Generate moments gallery HTML
  const momentsHTML = moments.length > 0 ? `
    <div class="moments-gallery">
      ${moments.slice(0, 6).map(moment => `
        <div class="moment-item">
          <img src="${moment.url}" alt="${moment.caption || 'Memorial moment'}" />
          ${moment.caption ? `<p class="moment-caption">${moment.caption}</p>` : ''}
        </div>
      `).join('')}
    </div>
  ` : '';
  
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${fullName} - Memorial Preview</title>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Merriweather:wght@300;400&display=swap">
      <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
      <style>
        /* Reset and Base */
        * {
          margin: 0;
          padding: 0;
          box-sizing: border-box;
        }
        
        body {
          font-family: 'Inter', sans-serif;
          color: #4a4238;
          background: #fefdfb;
          line-height: 1.6;
        }
        
        /* Memorial Hero Section */
        .memorial-hero {
          position: relative;
          height: 400px;
          background: url('${backgroundPhoto}') center/cover;
          display: flex;
          align-items: center;
          justify-content: center;
          overflow: hidden;
        }
        
        .memorial-hero-overlay {
          position: absolute;
          inset: 0;
          background: linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.5));
        }
        
        .memorial-hero-content {
          position: relative;
          text-align: center;
          color: white;
          padding: 2rem;
          z-index: 1;
        }
        
        .memorial-main-photo {
          width: 160px;
          height: 160px;
          border-radius: 50%;
          border: 4px solid white;
          margin-bottom: 1rem;
          object-fit: cover;
          box-shadow: 0 4px 20px rgba(0,0,0,0.3);
        }
        
        .memorial-main-name {
          font-size: 2.5rem;
          font-weight: 600;
          margin-bottom: 0.5rem;
        }
        
        .memorial-dates {
          font-size: 1.1rem;
          opacity: 0.9;
        }
        
        .memorial-headline {
          font-size: 1.3rem;
          font-style: italic;
          margin-top: 1rem;
          opacity: 0.95;
        }
        
        /* Content Container */
        .memorial-content {
          max-width: 800px;
          margin: 0 auto;
          padding: 3rem 2rem;
        }
        
        /* Opening Statement */
        .opening-statement {
          text-align: center;
          font-size: 1.2rem;
          color: #6b9174;
          font-style: italic;
          margin-bottom: 3rem;
          padding: 2rem;
          background: rgba(107, 145, 116, 0.05);
          border-radius: 10px;
        }
        
        /* Section Headers */
        h2 {
          font-size: 2rem;
          color: #4a4238;
          margin: 3rem 0 1.5rem;
          font-family: 'Merriweather', serif;
        }
        
        /* Obituary Section */
        .obituary-content {
          font-family: 'Merriweather', serif;
          line-height: 1.8;
          color: #4a4238;
          margin-bottom: 2rem;
        }
        
        .obituary-content p {
          margin-bottom: 1rem;
        }
        
        /* Life Story Section */
        .life-story {
          background: #f9f9f9;
          padding: 2rem;
          border-radius: 10px;
          margin: 2rem 0;
        }
        
        .life-story p {
          margin-bottom: 1rem;
          line-height: 1.8;
        }
        
        /* Service Section */
        .service-section {
          margin: 3rem 0;
        }
        
        .service-item {
          display: flex;
          gap: 1.5rem;
          margin-bottom: 2rem;
          padding: 1.5rem;
          background: white;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
        }
        
        .service-icon {
          flex-shrink: 0;
          width: 50px;
          height: 50px;
          background: linear-gradient(135deg, #6b9174, #4f7354);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        
        .service-details h3 {
          font-size: 1.2rem;
          color: #4a4238;
          margin-bottom: 0.5rem;
        }
        
        .service-details p {
          color: #64748b;
          margin-bottom: 0.25rem;
        }
        
        .service-location {
          font-weight: 500;
        }
        
        .no-services {
          text-align: center;
          color: #64748b;
          font-style: italic;
        }
        
        /* Additional Info */
        .additional-info {
          background: #faf8f3;
          padding: 2rem;
          border-radius: 10px;
          margin: 2rem 0;
          border-left: 4px solid #6b9174;
        }
        
        /* Moments Gallery */
        .moments-gallery {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
          gap: 1rem;
          margin: 2rem 0;
        }
        
        .moment-item {
          position: relative;
          border-radius: 10px;
          overflow: hidden;
          box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        
        .moment-item img {
          width: 100%;
          height: 200px;
          object-fit: cover;
        }
        
        .moment-caption {
          position: absolute;
          bottom: 0;
          left: 0;
          right: 0;
          background: rgba(0,0,0,0.7);
          color: white;
          padding: 0.5rem;
          font-size: 0.875rem;
        }
        
        /* Guestbook Section */
        .guestbook-section {
          margin-top: 3rem;
          padding: 2rem;
          background: white;
          border-radius: 10px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.05);
          text-align: center;
        }
        
        .guestbook-section p {
          color: #64748b;
          margin-top: 1rem;
        }
      </style>
    </head>
    <body>
      <div class="memorial-page">
        <!-- Hero Section -->
        <section class="memorial-hero">
          <div class="memorial-hero-overlay"></div>
          <div class="memorial-hero-content">
            <img src="${profilePhoto}" alt="${fullName}" class="memorial-main-photo" />
            <h1 class="memorial-main-name">${fullName}</h1>
            <p class="memorial-dates">${formattedBirthDate} - ${formattedDeathDate}</p>
            ${headline ? `<p class="memorial-headline">"${headline}"</p>` : ''}
          </div>
        </section>
        
        <!-- Content -->
        <div class="memorial-content">
          ${openingStatement ? `
            <div class="opening-statement">
              ${openingStatement}
            </div>
          ` : ''}
          
          <!-- Obituary -->
          <section>
            <h2>Celebrating a Life Well Lived</h2>
            <div class="obituary-content">
              ${obituary}
            </div>
          </section>
          
          <!-- Life Story -->
          ${lifeStory ? `
            <section>
              <h2>Life Story</h2>
              <div class="life-story">
                ${lifeStory}
              </div>
            </section>
          ` : ''}
          
          <!-- Service Information -->
          ${services.length > 0 ? `
            <section class="service-section">
              <h2>Service Information</h2>
              ${servicesHTML}
            </section>
          ` : ''}
          
          <!-- Additional Information -->
          ${additionalInfo ? `
            <section>
              <h2>Additional Information</h2>
              <div class="additional-info">
                ${additionalInfo}
              </div>
            </section>
          ` : ''}
          
          <!-- Moments Gallery -->
          ${moments.length > 0 ? `
            <section>
              <h2>Cherished Moments</h2>
              ${momentsHTML}
            </section>
          ` : ''}
          
          <!-- Guestbook -->
          <section class="guestbook-section">
            <h2>Guestbook</h2>
            <p>Be the first to sign the guestbook.</p>
          </section>
        </div>
      </div>
    </body>
    </html>
  `;
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






// Device preview function
window.previewDevice = function(device) {
  const frame = document.querySelector('.device-frame');
  const iframe = document.getElementById('memorialPreview');
  
  if (!frame) return;
  
  // Remove all device classes
  frame.classList.remove('desktop-view', 'tablet-view', 'mobile-view');
  
  // Add the selected device class and update iframe dimensions
  switch(device) {
    case 'desktop':
      frame.classList.add('desktop-view');
      iframe.style.width = '100%';
      iframe.style.height = '600px';
      break;
    case 'tablet':
      frame.classList.add('tablet-view');
      iframe.style.width = '768px';
      iframe.style.height = '1024px';
      break;
    case 'mobile':
      frame.classList.add('mobile-view');
      iframe.style.width = '375px';
      iframe.style.height = '667px';
      break;
  }
  
  // Update button states
  document.querySelectorAll('.preview-actions button').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.closest('button').classList.add('active');
}

/* ---------- rich text autosave ---------- */
function initializeRichTextAutoSave() {
  const editor = document.querySelector('#lifeStory');  // Changed from .rich-text-editor to #lifeStory
  if (!editor) return;

  let autoSaveTimer;
  editor.addEventListener('input', () => {
    clearTimeout(autoSaveTimer);
    autoSaveTimer = setTimeout(() => {
      saveStepData();
      saveDraftToSupabase(); // Save to Supabase
    }, 2000); // Auto-save after 2 seconds of inactivity
  });
}

function loadDraftLifeStory() {
  if (memorialData.story?.lifeStory) {
    const editor = qs('#lifeStoryEditor');
    if (editor) editor.innerHTML = memorialData.story.lifeStory;
  }
  if (memorialData.story?.obituary) {
    const editor = qs('#lifeStory');  // Changed from #obituaryEditor to #lifeStory
    if (editor) editor.innerHTML = memorialData.story.obituary;
  }
}