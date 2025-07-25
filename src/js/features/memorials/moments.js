/*  src/js/features/memorials/moments.js  */
import { showNotification, qs, formatDate } from '@/utils/ui.js';
import { cloudinaryConfig } from '@/api/cloudinaryClient.js'; // ADD THIS IMPORT

/* ──────────────────────────────────────────
   STATE
   ────────────────────────────────────────── */
let moments = [];
let momentsViewMode = 'grid';
let draggedMomentIndex = null;
let uploadQueue = []; // ADD THIS
let isUploading = false; // ADD THIS

/* ──────────────────────────────────────────
   PUBLIC API
   ────────────────────────────────────────── */
export function initMomentsBoard() {
  /* drop-zone */
  const dropZone = qs('#momentsDropZone');
  if (dropZone) {
    dropZone.addEventListener('dragover', handleDragOver);
    dropZone.addEventListener('dragleave', handleDragLeave);
    dropZone.addEventListener('drop', handleDrop);
  }

  /* delegated clicks (browse, view-mode) */
  document.getElementById('step4')?.addEventListener('click', (e) => {
    if (e.target.closest('.btn-upload') || e.target.closest('[data-moments-browse]')) {
      return selectMoments();
    }
    const btn = e.target.closest('.view-btn');
    if (btn) {
      changeGridView(btn.querySelector('.fa-list') ? 'list' : 'grid');
    }
  });

  //   /* first render */
  updateMomentsDisplay();
  updateMomentsCount();
}

/* expose if other modules need the raw array */
export const getMoments = () => moments;

/* ADD THIS NEW EXPORT FUNCTION */
export function getMomentsForSave() {
  return moments.filter(m => !m.uploading).map(m => ({
    type: m.type,
    url: m.url,
    thumbnailUrl: m.thumbnailUrl,
    publicId: m.publicId,
    caption: m.caption,
    date: m.date,
    fileName: m.fileName
  }));
}

// Make it globally available for the wizard
window.getMomentsForSave = getMomentsForSave;

/* ──────────────────────────────────────────
   DRAG-AND-DROP UPLOAD
   ────────────────────────────────────────── */
function handleDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.currentTarget.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');
  const files = Array.from(e.dataTransfer.files).filter(
    file => file.type.startsWith('image/') || file.type.startsWith('video/')
  );
  handleMultipleUploads(files); // CHANGED THIS
}

/* ──────────────────────────────────────────
   FILE-SELECT UPLOAD
   ────────────────────────────────────────── */
function selectMoments() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*,video/*';
  input.multiple = true;
  input.onchange = ({ target }) => {
    const files = Array.from(target.files);
    handleMultipleUploads(files); // CHANGED THIS
  };
  input.click();
}

/* ADD THESE NEW FUNCTIONS FOR CLOUDINARY UPLOAD */
/* ──────────────────────────────────────────
   CLOUDINARY UPLOAD
   ────────────────────────────────────────── */
async function uploadToCloudinary(file) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('upload_preset', cloudinaryConfig.uploadPreset);
  
  // Add tags for organization
  const memorialId = window.currentMemorialId || 'draft';
  formData.append('tags', `memorial_${memorialId},moments`);
  
  // Set folder structure
  formData.append('folder', `tayvu/memorials/${memorialId}/moments`);
  
  try {
    const endpoint = file.type.startsWith('video/') 
      ? `${cloudinaryConfig.uploadUrl}/video/upload`
      : `${cloudinaryConfig.uploadUrl}/image/upload`;
      
    const response = await fetch(endpoint, {
      method: 'POST',
      body: formData
    });
    
    if (!response.ok) {
      throw new Error(`Upload failed: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Cloudinary upload error:', error);
    throw error;
  }
}

/* ──────────────────────────────────────────
   BATCH UPLOAD MANAGEMENT
   ────────────────────────────────────────── */
function handleMultipleUploads(files) {
  // Validate files
  const validFiles = files.filter(file => {
    if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
      showNotification(`${file.name} is not an image or video`, 'error');
      return false;
    }
    if (file.size > 50 * 1024 * 1024) {
      showNotification(`${file.name} is too large (max 50MB)`, 'error');
      return false;
    }
    return true;
  });
  
  if (validFiles.length === 0) return;
  
  // Add to upload queue
  uploadQueue.push(...validFiles);
  processUploadQueue();
}

async function processUploadQueue() {
  if (isUploading || uploadQueue.length === 0) return;
  
  isUploading = true;
  showUploadProgress(true);
  
  while (uploadQueue.length > 0) {
    const file = uploadQueue.shift();
    try {
      await addMoment(file);
      updateUploadProgress(uploadQueue.length);
    } catch (error) {
      console.error(`Failed to upload ${file.name}:`, error);
      showNotification(`Failed to upload ${file.name}`, 'error');
    }
  }
  
  isUploading = false;
  showUploadProgress(false);
  showNotification('All uploads complete!', 'success');
}

/* REPLACE THE OLD addMoment FUNCTION WITH THIS */
async function addMoment(file) {
  try {
    // Create temporary moment with local URL for immediate feedback
    const tempId = Date.now() + Math.random();
    const tempMoment = {
      id: tempId,
      type: file.type.startsWith('video/') ? 'video' : 'photo',
      url: URL.createObjectURL(file), // Temporary local URL
      caption: '',
      date: new Date().toISOString().split('T')[0],
      fileName: file.name,
      uploading: true
    };
    
    // Add temporary moment to show progress
    moments.push(tempMoment);
    updateMomentsDisplay();
    
    // Upload to Cloudinary
    const cloudinaryData = await uploadToCloudinary(file);
    
    // Update moment with Cloudinary data
    const momentIndex = moments.findIndex(m => m.id === tempId);
    if (momentIndex !== -1) {
      // Generate thumbnail URL for images
      const thumbnailUrl = file.type.startsWith('video/') 
        ? cloudinaryData.thumbnail_url 
        : cloudinaryData.secure_url.replace('/upload/', `/upload/${cloudinaryConfig.transformations.momentThumbnail}/`);
      
      moments[momentIndex] = {
        ...moments[momentIndex],
        url: cloudinaryData.secure_url,
        thumbnailUrl: thumbnailUrl,
        publicId: cloudinaryData.public_id,
        resourceType: cloudinaryData.resource_type,
        uploading: false
      };
    }
    
    // Clean up temporary URL
    URL.revokeObjectURL(tempMoment.url);
    
    updateMomentsDisplay();
    updateMomentsCount();
    
  } catch (error) {
    console.error('Upload error:', error);
    // Remove failed upload from moments
    moments = moments.filter(m => !m.uploading);
    updateMomentsDisplay();
    throw error;
  }
}

/* ADD THESE NEW UI FUNCTIONS */
/* ──────────────────────────────────────────
   UPLOAD PROGRESS UI
   ────────────────────────────────────────── */
function showUploadProgress(show) {
  let progressBar = qs('#uploadProgressBar');
  
  if (show && !progressBar) {
    const progressHTML = `
      <div id="uploadProgressBar" class="upload-progress-bar">
        <div class="upload-progress-content">
          <i class="fas fa-cloud-upload-alt"></i>
          <span>Uploading <span id="remainingCount">${uploadQueue.length}</span> file(s)...</span>
        </div>
      </div>
    `;
    document.querySelector('.moments-upload-section')?.insertAdjacentHTML('afterbegin', progressHTML);
  } else if (!show && progressBar) {
    progressBar.remove();
  }
}

function updateUploadProgress(remaining) {
  const remainingCount = qs('#remainingCount');
  if (remainingCount) {
    remainingCount.textContent = remaining;
  }
}

/* UPDATE THE RENDERING FUNCTION */
/* ──────────────────────────────────────────
   RENDERING
   ────────────────────────────────────────── */
function updateMomentsDisplay() {
  const grid = qs('#momentsPreviewGrid');
  if (!grid) return;

  const emptyState = qs('#momentsEmptyState');
  if (moments.length === 0) {
    emptyState?.style.setProperty('display', 'block');
    grid.innerHTML = '';
    emptyState && grid.appendChild(emptyState);
    return;
  }
  emptyState?.style.setProperty('display', 'none');

  grid.innerHTML = moments
    .map(
      (m, i) => `
    <div class="moment-preview-item ${momentsViewMode === 'list' ? 'list-view' : ''} ${m.uploading ? 'uploading' : ''}"
         draggable="${!m.uploading}"
         data-id="${m.id}"
         ondragstart="handleMomentDragStart(event, ${i})"
         ondragover="handleMomentDragOver(event)"
         ondrop="handleMomentDrop(event, ${i})"
         ondragend="handleMomentDragEnd(event)">
      
      ${m.uploading ? '<div class="upload-overlay"><i class="fas fa-spinner fa-spin"></i></div>' : ''}
      
      <div class="moment-preview-image">
        ${
          m.type === 'video'
            ? `<video src="${m.url}" muted></video>
               <div class="video-indicator-overlay"><i class="fas fa-play"></i></div>`
            : `<img src="${m.thumbnailUrl || m.url}" alt="${m.caption || 'Moment'}" loading="lazy">`
        }
      </div>
      <div class="moment-actions">
        <button class="moment-action-btn" onclick="editMomentCaption(${i})" title="Edit caption" ${m.uploading ? 'disabled' : ''}>
          <i class="fas fa-pen"></i>
        </button>
        <button class="moment-action-btn" onclick="removeMoment(${i})" title="Remove" ${m.uploading ? 'disabled' : ''}>
          <i class="fas fa-times"></i>
        </button>
      </div>
      <div class="moment-caption">
        <input class="caption-input" type="text"
               placeholder="Add a caption (optional)"
               value="${m.caption}"
               onchange="updateMomentCaption(${i}, this.value)"
               ${m.uploading ? 'disabled' : ''}>
        ${momentsViewMode === 'grid' ? `<div class="moment-date">${formatDate(m.date)}</div>` : ''}
      </div>
    </div>`
    )
    .join('');
}

function updateMomentsCount() {
  const photoEl = qs('#photoCount');
  const videoEl = qs('#videoCount');
  if (!photoEl || !videoEl) return; // ← bail if step-4 isn't in the DOM yet

  // Only count uploaded moments, not uploading ones
  photoEl.textContent = moments.filter((m) => m.type === 'photo' && !m.uploading).length;
  videoEl.textContent = moments.filter((m) => m.type === 'video' && !m.uploading).length;
}

/* ──────────────────────────────────────────
   VIEW TOGGLE & CAPTION EDIT
   ────────────────────────────────────────── */
function changeGridView(view) {
  momentsViewMode = view;
  document.querySelectorAll('.view-btn').forEach((b) => b.classList.remove('active'));
  event.target.closest('.view-btn').classList.add('active');

  const grid = qs('#momentsPreviewGrid');
  grid?.classList.toggle('list-view', view === 'list');
  updateMomentsDisplay();
}

function updateMomentCaption(i, caption) {
  if (moments[i]) moments[i].caption = caption;
}

/* eslint-disable-next-line no-unused-vars */
function editMomentCaption(i) {
  const input = event.target.closest('.moment-preview-item')?.querySelector('.caption-input');
  input?.focus();
  input?.select();
}

/* ──────────────────────────────────────────
   REMOVE
   ────────────────────────────────────────── */
function removeMoment(i) {
  const moment = moments[i];
  if (moment && moment.uploading) return; // Don't allow removal during upload
  
  if (confirm('Are you sure you want to remove this moment?')) {
    moments.splice(i, 1);
    updateMomentsDisplay();
    updateMomentsCount();
    showNotification('Moment removed');
  }
}

/* ──────────────────────────────────────────
   DRAG REORDER
   ────────────────────────────────────────── */
function handleMomentDragStart(e, i) {
  if (moments[i].uploading) {
    e.preventDefault();
    return;
  }
  draggedMomentIndex = i;
  e.target.classList.add('dragging');
}
function handleMomentDragOver(e) {
  e.preventDefault();
  e.currentTarget.classList.add('drag-over');
}
function handleMomentDrop(e, dropIdx) {
  e.preventDefault();
  e.currentTarget.classList.remove('drag-over');

  if (draggedMomentIndex !== null && draggedMomentIndex !== dropIdx) {
    const [dragged] = moments.splice(draggedMomentIndex, 1);
    moments.splice(draggedMomentIndex < dropIdx ? dropIdx - 1 : dropIdx, 0, dragged);
    updateMomentsDisplay();
    showNotification('Moments reordered');
  }
}
function handleMomentDragEnd(e) {
  e.target.classList.remove('dragging');
  document
    .querySelectorAll('.moment-preview-item')
    .forEach((el) => el.classList.remove('drag-over'));
  draggedMomentIndex = null;
}

/* ──────────────────────────────────────────
   TEMP GLOBAL SHIM – keeps any inline attrs working
   Remove once all inline handlers are gone.
   ────────────────────────────────────────── */
Object.assign(window, {
  handleDragOver,
  handleDragLeave,
  handleDrop,
  selectMoments,
  addMoment,
  updateMomentsDisplay,
  updateMomentsCount,
  changeGridView,
  updateMomentCaption,
  editMomentCaption,
  removeMoment,
  handleMomentDragStart,
  handleMomentDragOver,
  handleMomentDrop,
  handleMomentDragEnd,
  getMomentsForSave // ADD THIS
});