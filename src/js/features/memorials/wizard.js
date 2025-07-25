/*  src/js/features/memorials/wizard.js  */
let clickHandlerBound = false;
import {
  showNotification,
  qs /* ← you already export this from utils/ui.js */
} from '@/utils/ui.js';
import { MemorialSanitizer } from '@/utils/sanitizer.js';
import { cloudinaryConfig } from '@/api/cloudinaryClient.js'; // ADD THIS IMPORT

/* ──────────────────────────────────────────
     STATE
     ────────────────────────────────────────── */
// let currentStep = 1;
// const totalSteps = 5;

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
  updateProgress();
  // only bind once
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
  switch (currentStep) {
    case 1: {
      const firstName = qs('#firstName').value;
      const lastName = qs('#lastName').value;
      const birthDate = qs('#birthDate').value;
      const deathDate = qs('#deathDate').value;
      const headline = qs('#headline').value;
      const opening = qs('#openingStatement').value;

      if (!firstName || !lastName || !birthDate || !deathDate || !headline || !opening) {
        showNotification('Please fill in all required fields', 'error');
        return false;
      }
      if (!validateDates()) return false;
      
      // Check if profile photo is uploaded
      const profilePhoto = qs('#profilePhotoPreview');
      if (!profilePhoto?.src || profilePhoto.src === '' || profilePhoto.style.display === 'none') {
        showNotification('Please upload a profile photo', 'error');
        return false;
      }
      
      return true;
    }

    case 2: {
      const html = qs('#lifeStory').innerHTML;
      const text = qs('#lifeStory').textContent.trim();
      if (text.length < 50) {
        showNotification('Please write at least 50 characters for the obituary', 'error');
        return false;
      }
      if (html.includes('<script') || html.includes('javascript:')) {
        showNotification('Invalid content detected.', 'error');
        return false;
      }
      const sanitized = MemorialSanitizer.sanitizeRichText(html);
      if (sanitized.replace(/<[^>]+>/g, '').trim().length < 50) {
        showNotification('The obituary content is too short after sanitization', 'error');
        return false;
      }
      return true;
    }

    default:
      return true;
  }
}

/* ---------- save per-step ---------- */
function saveStepData() {
  switch (currentStep) {
    case 1:
      const profilePhoto = qs('#profilePhotoPreview');
      const backgroundPhoto = qs('#backgroundPhotoPreview');
      
      memorialData.basic = {
        firstName: qs('#firstName').value,
        middleName: qs('#middleName').value,
        lastName: qs('#lastName').value,
        birthDate: qs('#birthDate').value,
        deathDate: qs('#deathDate').value,
        headline: qs('#headline').value,
        openingStatement: qs('#openingStatement').value,
        profilePhoto: profilePhoto?.src,
        profilePhotoPublicId: profilePhoto?.dataset.publicId,
        backgroundPhoto: backgroundPhoto?.src,
        backgroundPhotoPublicId: backgroundPhoto?.dataset.publicId,
        backgroundPhotoIsDefault: backgroundPhoto?.dataset.isDefault === 'true'
      };
      break;
    case 2: {
      const raw = qs('#lifeStory').innerHTML;
      const sanitized = MemorialSanitizer.sanitizeRichText(raw);
      memorialData.story = {
        lifeStory: sanitized,
        lifeStoryRaw: raw,
        lifeStoryText: qs('#lifeStory').textContent.trim()
      };
      break;
    }
    case 3:
      memorialData.services = [];
      document.querySelectorAll('.service-item-form').forEach((form) => {
        const svc = {
          type: form.querySelector('[name="serviceType"]').value,
          date: form.querySelector('[name="serviceDate"]').value,
          time: form.querySelector('[name="serviceTime"]').value,
          locationName: form.querySelector('[name="locationName"]').value,
          locationAddress: form.querySelector('[name="locationAddress"]').value
        };
        if (svc.type) memorialData.services.push(svc);
      });
      memorialData.serviceNote = qs('#serviceNote')?.value || '';
      break;
    case 4:
      // Import moments data from moments.js
      if (window.getMomentsForSave) {
        memorialData.moments = window.getMomentsForSave();
      } else {
        memorialData.moments = window.moments || [];
      }
      break;
    case 5:
      memorialData.settings = {
        privacy: document.querySelector('input[name="privacy"]:checked').value
      };
      break;
  }
}

/* ---------- preview & publish ---------- */
function generatePreview() {
  saveStepData();
  showNotification('Generating preview...');
  const frame = qs('#memorialPreview');
  if (frame) frame.style.display = 'none';

  // Replace iframe with a simple placeholder message
  const container = frame?.parentElement;
  if (container) {
    container.querySelector('.preview-message')?.remove();
    const msg = document.createElement('div');
    msg.className = 'preview-message';
    msg.innerHTML = `
        <i class="fas fa-eye" style="font-size:3rem;margin-bottom:1rem;color:var(--primary-sage)"></i>
        <h3 style="margin-bottom:1rem;">Memorial Preview Ready</h3>
        <p>Your memorial has been prepared. Click "Publish Memorial" to make it live.</p>
        <button class="btn-secondary" data-page="exampleMemorial" style="margin-top:1rem;">
          <i class="fas fa-external-link-alt"></i> View Example Memorial
        </button>
      `;
    container.appendChild(msg);
  }
  console.log('Preview data', memorialData);
}

/* eslint-disable-next-line no-unused-vars */
function previewDevice(device) {
  const frame = document.querySelector('.device-frame');
  if (!frame) return;
  switch (device) {
    case 'desktop':
      frame.style.maxWidth = '1200px';
      frame.style.height = '600px';
      break;
    case 'tablet':
      frame.style.maxWidth = '768px';
      frame.style.height = '1024px';
      break;
    default:
      frame.style.maxWidth = '375px';
      frame.style.height = '667px';
  }
}

function saveDraft() {
  saveStepData();
  // Save to localStorage including uploaded image data
  localStorage.setItem('tayvu_memorial_draft', JSON.stringify({
    data: memorialData,
    timestamp: new Date().toISOString()
  }));
  showNotification('Draft saved successfully!');
}

function publishMemorial() {
  saveStepData();
  localStorage.removeItem('tayvu_draft_lifestory');
  localStorage.removeItem('tayvu_memorial_draft');

  // In a real app, this would:
  // 1. Save to database with all Cloudinary URLs
  // 2. Generate the memorial page
  // 3. Redirect to the published memorial

  showNotification('Memorial published successfully!');
  console.log('Publishing memorial with data:', memorialData);

  // For demo, redirect to profile
  setTimeout(() => window.goToProfile?.(), 2000);
}

/* ---------- rich-text auto-save ---------- */
let autoSaveTimer;
function initializeRichTextAutoSave() {
  const editor = qs('#lifeStory');
  if (!editor) return;
  editor.addEventListener('input', () => {
    // Clear existing timer
    clearTimeout(autoSaveTimer);

    // Set new timer - save after 2 seconds of no typing
    autoSaveTimer = setTimeout(() => {
      const raw = editor.innerHTML;
      const sanitized = MemorialSanitizer.sanitizeRichText(raw);
      localStorage.setItem(
        'tayvu_draft_lifestory',
        JSON.stringify({
          raw,
          sanitized,
          timestamp: new Date().toISOString()
        })
      );
      console.log('Draft auto-saved');
    }, 2000);
  });
}

function loadDraftLifeStory() {
  const draft = localStorage.getItem('tayvu_draft_lifestory');
  if (!draft) return;
  try {
    const { raw, timestamp } = JSON.parse(draft);
    if (Date.now() - new Date(timestamp).getTime() < 24 * 60 * 60 * 1000) {
      qs('#lifeStory').innerHTML = raw;
      showNotification('Draft restored from previous session');
    } else localStorage.removeItem('tayvu_draft_lifestory');
  } catch {
    localStorage.removeItem('tayvu_draft_lifestory');
  }
}

/* ---------- Create Memorial Functions ---------- */
function validateDates() {
  const birthDateInput = qs('#birthDate');
  const deathDateInput = qs('#deathDate');
  const birthDateError = qs('#birthDateError');
  const deathDateError = qs('#deathDateError');

  // Get today's date in YYYY-MM-DD format
  const today = new Date();
  const todayString = today.toISOString().split('T')[0];

  // Set min and max attributes
  const minDate = '1850-01-01';
  birthDateInput.setAttribute('min', minDate);
  birthDateInput.setAttribute('max', todayString);
  deathDateInput.setAttribute('min', minDate);
  deathDateInput.setAttribute('max', todayString);

  // Reset error messages
  birthDateError.style.display = 'none';
  deathDateError.style.display = 'none';
  birthDateError.textContent = '';
  deathDateError.textContent = '';

  if (birthDateInput.value && deathDateInput.value) {
    const birthDate = new Date(birthDateInput.value);
    const deathDate = new Date(deathDateInput.value);
    const minDateObj = new Date(minDate);

    // Validate birth date
    if (birthDate < minDateObj) {
      birthDateError.textContent = 'Date of birth cannot be before 1850';
      birthDateError.style.display = 'block';
      birthDateInput.setCustomValidity('Invalid date');
      return false;
    } else if (birthDate > today) {
      birthDateError.textContent = 'Date of birth cannot be in the future';
      birthDateError.style.display = 'block';
      birthDateInput.setCustomValidity('Invalid date');
      return false;
    } else {
      birthDateInput.setCustomValidity('');
    }

    // Validate death date
    if (deathDate < minDateObj) {
      deathDateError.textContent = 'Date of passing cannot be before 1850';
      deathDateError.style.display = 'block';
      deathDateInput.setCustomValidity('Invalid date');
      return false;
    } else if (deathDate > today) {
      deathDateError.textContent = 'Date of passing cannot be in the future';
      deathDateError.style.display = 'block';
      deathDateInput.setCustomValidity('Invalid date');
      return false;
    } else if (deathDate <= birthDate) {
      deathDateError.textContent = 'Date of passing must be after date of birth';
      deathDateError.style.display = 'block';
      deathDateInput.setCustomValidity('Invalid date');
      return false;
    } else {
      deathDateInput.setCustomValidity('');

      // Calculate age for additional validation
      const ageAtDeath = (deathDate - birthDate) / (365.25 * 24 * 60 * 60 * 1000);
      if (ageAtDeath > 150) {
        deathDateError.textContent = 'Please verify the dates (age exceeds 150 years)';
        deathDateError.style.display = 'block';
        return false;
      }
    }
  }

  return true;
}