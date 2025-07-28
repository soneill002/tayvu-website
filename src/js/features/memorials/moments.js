/*  src/js/features/memorials/moments.js  */
import { showNotification, qs } from '@/utils/ui.js';
import { cloudinaryConfig } from '@/api/cloudinaryClient.js';

/* ──────────────────────────────────────────
   STATE
   ────────────────────────────────────────── */
let moments = [];
let momentsViewMode = 'grid'; // 'grid' | 'list'
let isUploading = false;
let uploadQueue = [];

/* ──────────────────────────────────────────
   PUBLIC API
   ────────────────────────────────────────── */
export function initMomentsBoard() {
  /*
    Don't wire clicks directly; let the parent pages 
    handle routing to this dedicated moments page.
  */
  const board = qs('#memorialMoments');
  if (!board) return;

  /* drag-drop zone */
  const dropzone = qs('#momentsDropzone');
  if (dropzone) {
    dropzone.addEventListener('dragover', handleDragOver);
    dropzone.addEventListener('dragleave', handleDragLeave);
    dropzone.addEventListener('drop', handleDrop);
  }

  /* UI delegated clicks */
  board.addEventListener('click', (e) => {
    if (e.target.closest('[data-action="select-moments"]')) {
      selectMoments();
    } else if (e.target.closest('[data-action="toggle-view"]')) {
      toggleViewMode();
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

// Add this function to load existing moments (for drafts)
export function loadExistingMoments(existingMoments) {
  moments = existingMoments.map(m => ({
    id: m.id,
    type: m.type,
    url: m.url,
    thumbnailUrl: m.thumbnail_url,
    publicId: m.cloudinary_public_id,
    caption: m.caption,
    date: m.date_taken,
    fileName: m.file_name,
    uploading: false
  }));
  
  updateMomentsDisplay();
  updateMomentsCount();
}

// Make it globally available
window.loadExistingMoments = loadExistingMoments;

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
  handleMultipleUploads(files);
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
    handleMultipleUploads(files);
  };
  input.click();
}

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

/* ──────────────────────────────────────────
   ADD MOMENT
   ────────────────────────────────────────── */
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
               <i class="fas fa-play-circle video-indicator"></i>`
            : `<img src="${m.thumbnailUrl || m.url}" alt="${m.caption || 'Moment'}" />`
        }
      </div>
      
      <div class="moment-preview-details">
        <input type="text"
               placeholder="Add a caption..."
               value="${m.caption || ''}"
               onchange="updateMomentCaption(${i}, this.value)"
               class="moment-caption-input" />
        
        <input type="date"
               value="${m.date || ''}"
               onchange="updateMomentDate(${i}, this.value)"
               class="moment-date-input" />
        
        <button class="remove-moment" onclick="removeMoment(${i})">
          <i class="fas fa-trash"></i>
        </button>
      </div>
    </div>
  `
    )
    .join('');
}

function updateMomentsCount() {
  const countEl = qs('#momentsCount');
  if (countEl) {
    const publishedCount = moments.filter(m => !m.uploading).length;
    countEl.textContent = `${publishedCount} ${publishedCount === 1 ? 'moment' : 'moments'}`;
  }
  
  // Also update the photo and video counts in the wizard
  const photoCount = qs('#photoCount');
  const videoCount = qs('#videoCount');
  if (photoCount && videoCount) {
    const photos = moments.filter(m => !m.uploading && m.type === 'photo').length;
    const videos = moments.filter(m => !m.uploading && m.type === 'video').length;
    photoCount.textContent = photos;
    videoCount.textContent = videos;
  }
}

/* ──────────────────────────────────────────
   MOMENT ACTIONS
   ────────────────────────────────────────── */
function updateMomentCaption(index, caption) {
  if (moments[index]) {
    moments[index].caption = caption;
  }
}

function updateMomentDate(index, date) {
  if (moments[index]) {
    moments[index].date = date;
  }
}

function removeMoment(index) {
  if (!confirm('Remove this moment?')) return;
  
  const moment = moments[index];
  if (moment) {
    // If it has a publicId, we could delete from Cloudinary here
    // For now, just remove from array
    moments.splice(index, 1);
    updateMomentsDisplay();
    updateMomentsCount();
  }
}

/* ──────────────────────────────────────────
   VIEW MODE TOGGLE
   ────────────────────────────────────────── */
function toggleViewMode() {
  momentsViewMode = momentsViewMode === 'grid' ? 'list' : 'grid';
  updateMomentsDisplay();
  
  // Update button icon
  const btn = qs('[data-action="toggle-view"]');
  if (btn) {
    btn.innerHTML = momentsViewMode === 'grid' 
      ? '<i class="fas fa-list"></i>' 
      : '<i class="fas fa-th"></i>';
  }
}

/* ──────────────────────────────────────────
   GRID VIEW TOGGLE (for wizard)
   ────────────────────────────────────────── */
function changeGridView(view) {
  momentsViewMode = view;
  updateMomentsDisplay();
  
  // Update active button state
  document.querySelectorAll('.view-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`.view-btn[onclick*="${view}"]`)?.classList.add('active');
}

/* ──────────────────────────────────────────
   DRAG AND DROP REORDERING
   ────────────────────────────────────────── */
let draggedIndex = null;

window.handleMomentDragStart = function(e, index) {
  draggedIndex = index;
  e.dataTransfer.effectAllowed = 'move';
  e.currentTarget.classList.add('dragging');
};

window.handleMomentDragOver = function(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
};

window.handleMomentDrop = function(e, dropIndex) {
  e.preventDefault();
  
  if (draggedIndex === null || draggedIndex === dropIndex) return;
  
  // Reorder moments array
  const draggedMoment = moments[draggedIndex];
  moments.splice(draggedIndex, 1);
  
  if (draggedIndex < dropIndex) {
    moments.splice(dropIndex - 1, 0, draggedMoment);
  } else {
    moments.splice(dropIndex, 0, draggedMoment);
  }
  
  updateMomentsDisplay();
  draggedIndex = null;
};

window.handleMomentDragEnd = function(e) {
  e.currentTarget.classList.remove('dragging');
  draggedIndex = null;
};

/* ──────────────────────────────────────────
   GLOBAL FUNCTIONS (for inline handlers)
   ────────────────────────────────────────── */
window.updateMomentCaption = updateMomentCaption;
window.updateMomentDate = updateMomentDate;
window.removeMoment = removeMoment;

// Expose selectMoments globally for the wizard
window.selectMoments = selectMoments;

// Expose drag and drop functions globally for the wizard
window.handleDrop = handleDrop;
window.handleDragOver = handleDragOver;
window.handleDragLeave = handleDragLeave;

// Expose changeGridView for the wizard
window.changeGridView = changeGridView;