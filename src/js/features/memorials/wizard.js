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
  
  const obituary = memorialData.story?.obituary || '<p>Memorial preview will appear here...</p>';
  const lifeStory = memorialData.story?.lifeStory || '';
  
  // Get moments data if available
  const moments = window.collectedMoments || [];
  
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
  
  // Format life span dates
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
          text-shadow: 0 2px 10px rgba(0,0,0,0.3);
        }
        
        .memorial-main-dates {
          font-size: 1.125rem;
          opacity: 0.95;
          margin-bottom: 1.5rem;
        }
        
        .memorial-hero-actions {
          display: flex;
          gap: 1rem;
          justify-content: center;
        }
        
        .memorial-hero-btn {
          background: rgba(255,255,255,0.2);
          border: 1px solid rgba(255,255,255,0.3);
          color: white;
          padding: 0.75rem 1.5rem;
          border-radius: 25px;
          font-size: 0.875rem;
          font-weight: 500;
          cursor: pointer;
          backdrop-filter: blur(10px);
          transition: all 0.3s ease;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        .memorial-hero-btn:hover {
          background: rgba(255,255,255,0.3);
          transform: translateY(-2px);
        }
        
        /* Memorial Body */
        .memorial-body {
          max-width: 1200px;
          margin: 0 auto;
          padding: 3rem 1.5rem;
        }
        
        /* Obituary Section */
        .obituary-section {
          margin-bottom: 4rem;
        }
        
        .obituary-container {
          max-width: 800px;
          margin: 0 auto;
        }
        
        .obituary-title {
          font-size: 2rem;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 2rem;
          text-align: center;
          position: relative;
          padding-bottom: 1rem;
        }
        
        .obituary-title::after {
          content: '';
          position: absolute;
          bottom: 0;
          left: 50%;
          transform: translateX(-50%);
          width: 80px;
          height: 3px;
          background: linear-gradient(to right, #e4b755, #e8d5b7);
          border-radius: 2px;
        }
        
        .obituary-content {
          color: #475569;
          line-height: 1.8;
        }
        
        .obituary-lead {
          font-family: 'Merriweather', serif;
          font-size: 1.25rem;
          color: #334155;
          margin-bottom: 2rem;
          font-weight: 300;
          font-style: italic;
        }
        
        .obituary-details p {
          margin-bottom: 1.5rem;
        }
        
        /* Life Story Section */
        .life-story-section {
          background: #faf8f3;
          padding: 3rem 2rem;
          border-radius: 12px;
          margin-bottom: 4rem;
        }
        
        .life-story-title {
          font-size: 1.75rem;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          gap: 0.75rem;
        }
        
        .life-story-content {
          color: #475569;
          line-height: 1.8;
        }
        
        /* Moments Gallery */
        .moments-section {
          margin-bottom: 4rem;
        }
        
        .moments-header {
          text-align: center;
          margin-bottom: 3rem;
        }
        
        .moments-title {
          font-size: 2rem;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 0.5rem;
        }
        
        .moments-subtitle {
          color: #64748b;
          font-size: 1.125rem;
        }
        
        .moments-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(250px, 1fr));
          gap: 1.5rem;
          margin-bottom: 2rem;
        }
        
        .moment-card {
          background: white;
          border-radius: 12px;
          overflow: hidden;
          box-shadow: 0 4px 12px rgba(0,0,0,0.08);
          transition: all 0.3s ease;
          cursor: pointer;
        }
        
        .moment-card:hover {
          transform: translateY(-4px);
          box-shadow: 0 8px 24px rgba(0,0,0,0.12);
        }
        
        .moment-image {
          width: 100%;
          height: 200px;
          object-fit: cover;
        }
        
        .moment-details {
          padding: 1rem;
        }
        
        .moment-date {
          font-size: 0.875rem;
          color: #94a3b8;
          margin-bottom: 0.5rem;
        }
        
        .moment-caption {
          color: #334155;
          font-size: 0.9375rem;
        }
        
        /* Guestbook Section */
        .guestbook-section {
          background: white;
          border-radius: 16px;
          padding: 3rem;
          box-shadow: 0 4px 20px rgba(0,0,0,0.06);
        }
        
        .guestbook-header {
          text-align: center;
          margin-bottom: 3rem;
        }
        
        .guestbook-title {
          font-size: 2rem;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 0.5rem;
        }
        
        .guestbook-subtitle {
          color: #64748b;
        }
        
        .guestbook-empty {
          text-align: center;
          padding: 3rem;
          color: #94a3b8;
        }
        
        .guestbook-empty i {
          font-size: 3rem;
          margin-bottom: 1rem;
          opacity: 0.5;
        }
        
        /* Preview Badge */
        .preview-badge {
          position: fixed;
          top: 20px;
          right: 20px;
          background: linear-gradient(135deg, #e4b755, #d4a29c);
          color: white;
          padding: 0.75rem 1.5rem;
          border-radius: 30px;
          font-size: 0.875rem;
          font-weight: 600;
          box-shadow: 0 4px 20px rgba(228, 183, 85, 0.4);
          z-index: 1000;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }
        
        /* Responsive Design */
        @media (max-width: 768px) {
          .memorial-hero {
            height: 350px;
          }
          
          .memorial-main-photo {
            width: 120px;
            height: 120px;
          }
          
          .memorial-main-name {
            font-size: 1.875rem;
          }
          
          .memorial-body {
            padding: 2rem 1rem;
          }
          
          .obituary-title {
            font-size: 1.5rem;
          }
          
          .obituary-lead {
            font-size: 1.125rem;
          }
          
          .moments-grid {
            grid-template-columns: 1fr;
          }
          
          .guestbook-section {
            padding: 2rem 1.5rem;
          }
        }
      </style>
    </head>
    <body>
      <div class="preview-badge">
        <i class="fas fa-eye"></i> Preview Mode
      </div>
      
      <!-- Memorial Hero -->
      <div class="memorial-hero">
        <div class="memorial-hero-overlay"></div>
        <div class="memorial-hero-content">
          <img src="${profilePhoto}" alt="${fullName}" class="memorial-main-photo">
          <h1 class="memorial-main-name">${fullName}</h1>
          <p class="memorial-main-dates">${formatDate(birthDate)} - ${formatDate(deathDate)}</p>
          
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
        <!-- Obituary Section -->
        <section class="obituary-section">
          <div class="obituary-container">
            <h2 class="obituary-title">Celebrating a Life Well Lived</h2>
            <div class="obituary-content">
              ${obituary.includes('class="obituary-lead"') ? obituary : `
                <p class="obituary-lead serif-text">
                  ${obituary.replace(/<[^>]*>/g, '').substring(0, 200)}${obituary.length > 200 ? '...' : ''}
                </p>
                <div class="obituary-details">
                  ${obituary}
                </div>
              `}
            </div>
          </div>
        </section>
        
        ${lifeStory ? `
          <section class="life-story-section">
            <h2 class="life-story-title">
              <i class="fas fa-heart"></i> Life Story
            </h2>
            <div class="life-story-content">
              ${lifeStory}
            </div>
          </section>
        ` : ''}
        
        ${moments.length > 0 ? `
          <section class="moments-section">
            <div class="moments-header">
              <h2 class="moments-title">Cherished Moments</h2>
              <p class="moments-subtitle">A collection of memories shared with love</p>
            </div>
            <div class="moments-grid">
              ${moments.slice(0, 6).map(moment => `
                <div class="moment-card">
                  <img src="${moment.photo_url}" alt="${moment.caption}" class="moment-image">
                  <div class="moment-details">
                    <p class="moment-date">${moment.date || 'Date not specified'}</p>
                    <p class="moment-caption">${moment.caption || 'A cherished memory'}</p>
                  </div>
                </div>
              `).join('')}
            </div>
          </section>
        ` : ''}
        
        <!-- Guestbook Section -->
        <section class="guestbook-section">
          <div class="guestbook-header">
            <h2 class="guestbook-title">Guestbook</h2>
            <p class="guestbook-subtitle">Share your memories and condolences</p>
          </div>
          <div class="guestbook-empty">
            <i class="fas fa-book-open"></i>
            <p>No messages yet. Be the first to sign the guestbook.</p>
          </div>
        </section>
      </div>
    </body>
    </html>
  `;
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