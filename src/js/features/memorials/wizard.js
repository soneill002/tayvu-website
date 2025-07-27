/*  src/js/features/memorials/wizard.js  */
let clickHandlerBound = false;
import {
  showNotification,
  qs /* ← you already export this from utils/ui.js */
} from '@/utils/ui.js';
import { MemorialSanitizer } from '@/utils/sanitizer.js';
import { cloudinaryConfig } from '@/api/cloudinaryClient.js';
import { getClient } from '@/api/supabaseClient.js';

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
export function initWizard() {
  currentStep = 1;
  // Re-calculate on init in case you add/remove steps or mis-number your circles
  totalSteps = document.querySelectorAll('.form-step').length;
  
  // Try to load draft from Supabase first
  loadDraftFromSupabase().then(hasDraft => {
    if (hasDraft) {
      showNotification('Draft loaded', 'info');
    } else {
      // Fall back to localStorage draft
      const savedDraft = localStorage.getItem('memorialDraft');
      if (savedDraft) {
        Object.assign(memorialData, JSON.parse(savedDraft));
      }
    }
    
    updateProgress();
  });
  
  // Only bind once
  if (!clickHandlerBound) {
    wireDelegatedClicks();
    clickHandlerBound = true;
  }
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
  saveStepData();
  await saveDraftToSupabase();
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

  const btn = qs('[data-wizard-publish]');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Publishing...';

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
    showNotification('Failed to publish memorial. Please try again.', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Publish Memorial';
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
    const name = qs('#deceasedName')?.value.trim();
    if (!name) {
      showNotification('Please enter a name', 'error');
      return false;
    }
  }
  return true;
}

/* ---------- collect / save data ---------- */
function saveStepData() {
  switch (currentStep) {
    case 1:
      memorialData.basic = {
        name: qs('#deceasedName')?.value.trim(),
        birthDate: qs('#birthDate')?.value,
        deathDate: qs('#deathDate')?.value
      };
      break;
    case 2:
      memorialData.story = {
        obituary: qs('#obituaryEditor')?.innerHTML || '',
        lifeStory: qs('#lifeStoryEditor')?.innerHTML || ''
      };
      break;
    case 3:
      // Services would be collected here
      break;
    case 4:
      // Moments are handled by moments.js
      break;
    case 5:
      memorialData.settings = {
        privacy: qs('input[name="privacy"]:checked')?.value || 'public'
      };
      break;
  }
}

/* ---------- preview generation ---------- */
function generatePreview() {
  // Update preview elements
  qs('#previewName').textContent = memorialData.basic.name || 'Name';
  qs('#previewDates').textContent = `${memorialData.basic.birthDate || 'Birth'} - ${memorialData.basic.deathDate || 'Death'}`;
  
  // Preview photos
  const profileSrc = qs('#profilePhotoPreview')?.src;
  if (profileSrc) qs('#previewProfilePhoto').src = profileSrc;
  
  const bgSrc = qs('#backgroundPhotoPreview')?.src;
  if (bgSrc) qs('#previewBackgroundPhoto').src = bgSrc;
  
  // Preview story content
  qs('#previewObituary').innerHTML = memorialData.story.obituary || '<p>No obituary added</p>';
  qs('#previewLifeStory').innerHTML = memorialData.story.lifeStory || '<p>No life story added</p>';
}

/* ---------- rich text autosave ---------- */
function initializeRichTextAutoSave() {
  const editor = document.querySelector('.rich-text-editor');
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
    const editor = qs('#obituaryEditor');
    if (editor) editor.innerHTML = memorialData.story.obituary;
  }
}